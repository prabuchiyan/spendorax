import { executeSql } from '../database/db';
import events from './events';
import { createTransaction } from './transactions';
import calc from './loanCalculations';

export async function createLoan(loan) {
    const res = await executeSql(
        `INSERT INTO loans (loan_name, loan_type, lender, principal_amount, interest_rate, loan_start_date, tenure_months, emi_amount, emi_day, outstanding_amount, remaining_months, status, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
            loan.loan_name,
            loan.loan_type,
            loan.lender,
            loan.principal_amount || 0,
            loan.interest_rate || 0,
            loan.loan_start_date || null,
            loan.tenure_months || 0,
            loan.emi_amount || 0,
            loan.emi_day || null,
            loan.outstanding_amount || loan.principal_amount || 0,
            loan.remaining_months || loan.tenure_months || 0,
            loan.status || 'Active',
            loan.notes || null
        ]
    );

    try { events.emit('loansChanged', { action: 'create', id: res.insertId }); } catch (e) { }
    return res.insertId;
}

export async function updateLoan(id, fields) {
    const sets = [];
    const vals = [];
    for (const k of Object.keys(fields)) {
        sets.push(`${k} = ?`);
        vals.push(fields[k]);
    }
    if (sets.length === 0) return;
    vals.push(id);
    await executeSql(`UPDATE loans SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`, vals);
    try { events.emit('loansChanged', { action: 'update', id, fields }); } catch (e) { }
}

export async function getLoans() {
    const res = await executeSql('SELECT * FROM loans ORDER BY id DESC');
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
    return rows;
}

export async function getLoanById(id) {
    const res = await executeSql('SELECT * FROM loans WHERE id = ?', [id]);
    if (res.rows.length === 0) return null;
    return res.rows.item(0);
}

export async function recordPayment({ loanId, date, amount, paymentType = 'EMI', sourceId = null, categoryId = null, notes = '' }) {
    // Fetch loan
    const loan = await getLoanById(loanId);
    if (!loan) throw new Error('Loan not found');

    // Calculate interest component
    const interestComponent = calc.calculateInterestComponent(loan.outstanding_amount, loan.interest_rate);
    let principalComponent = +(amount - interestComponent).toFixed(2);
    if (principalComponent < 0) principalComponent = 0;

    const remaining = +(loan.outstanding_amount - principalComponent).toFixed(2);

    // guard duplicate EMI/payment
    if (await hasDuplicatePayment(loanId, date || new Date().toISOString(), amount, paymentType)) {
        throw new Error('Duplicate payment detected for the same date/amount');
    }

    // Insert payment
    const pRes = await executeSql(`INSERT INTO loan_payments (loan_id, payment_date, payment_amount, principal_component, interest_component, remaining_balance, payment_type, payment_source_id, payment_category_id, remarks) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [loanId, date || new Date().toISOString(), amount, principalComponent, interestComponent, remaining, paymentType, sourceId || null, categoryId || null, notes || null]
    );

    // Update loan aggregates
    const newPrincipalPaid = +(Number(loan.principal_paid || 0) + principalComponent).toFixed(2);
    const newInterestPaid = +(Number(loan.interest_paid || 0) + interestComponent).toFixed(2);
    const newTotalPaid = +(Number(loan.total_paid || 0) + Number(amount)).toFixed(2);

    const newStatus = remaining <= 0 ? 'Closed' : loan.status;

    await executeSql(`UPDATE loans SET outstanding_amount = ?, principal_paid = ?, interest_paid = ?, total_paid = ?, remaining_months = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
        [remaining < 0 ? 0 : remaining, newPrincipalPaid, newInterestPaid, newTotalPaid, calc.calculateRemainingMonths(remaining, loan.emi_amount || 0, loan.interest_rate), newStatus, loanId]
    );

    // Create linked expense transaction
    try {
        const txId = await createTransaction({
            type: 'expense',
            amount: amount,
            category_id: categoryId || null,
            source_id: sourceId || null,
            date: date || new Date().toISOString(),
            notes: `Loan payment: ${loan.loan_name}`,
            bill_id: null,
            transfer_group_id: null,
            direction: 'debit'
        });
        // Link transaction id to payment row
        await executeSql('UPDATE loan_payments SET transaction_id = ? WHERE id = ?', [txId, pRes.insertId]);
    } catch (e) {
        console.warn('Failed to create linked transaction', e);
    }

    try { events.emit('loanPaymentsChanged', { action: 'create', id: pRes.insertId, loanId }); } catch (e) { }
    try { events.emit('loansChanged', { action: 'update', id: loanId }); } catch (e) { }

    return pRes.insertId;
}

export async function recordPrepayment({ loanId, date, amount, reduceEMI = false, sourceId = null, categoryId = null, notes = '' }) {
    // Prepayment treated as extra principal payment, can choose to reduce EMI or tenure
    const loan = await getLoanById(loanId);
    if (!loan) throw new Error('Loan not found');

    const interestComponent = calc.calculateInterestComponent(loan.outstanding_amount, loan.interest_rate);
    let principalComponent = +(amount - interestComponent).toFixed(2);
    if (principalComponent < 0) principalComponent = Number(amount);

    const remaining = +(loan.outstanding_amount - principalComponent).toFixed(2);

    // guard duplicate
    if (await hasDuplicatePayment(loanId, date || new Date().toISOString(), amount, 'PREPAYMENT')) {
        throw new Error('Duplicate prepayment detected for the same date/amount');
    }

    const pRes = await executeSql(`INSERT INTO loan_payments (loan_id, payment_date, payment_amount, principal_component, interest_component, remaining_balance, payment_type, payment_source_id, payment_category_id, remarks) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [loanId, date || new Date().toISOString(), amount, principalComponent, interestComponent, remaining, 'PREPAYMENT', sourceId || null, categoryId || null, notes || null]
    );

    const newPrincipalPaid = +(Number(loan.principal_paid || 0) + principalComponent).toFixed(2);
    const newTotalPrepayment = +(Number(loan.total_prepayment || 0) + Number(amount)).toFixed(2);
    const newInterestPaid = +(Number(loan.interest_paid || 0) + interestComponent).toFixed(2);
    const newTotalPaid = +(Number(loan.total_paid || 0) + Number(amount)).toFixed(2);

    // Recalculate EMI or remaining months if requested
    let newEmi = loan.emi_amount;
    let newRemainingMonths = calc.calculateRemainingMonths(remaining, loan.emi_amount || 0, loan.interest_rate);
    if (reduceEMI && remaining > 0) {
        // calculate new EMI keeping remaining months same
        newEmi = calc.calculateEMI(remaining, loan.interest_rate, newRemainingMonths) || loan.emi_amount;
    }

    const newStatus = remaining <= 0 ? 'Closed' : loan.status;

    await executeSql(`UPDATE loans SET outstanding_amount = ?, principal_paid = ?, total_prepayment = ?, interest_paid = ?, total_paid = ?, emi_amount = ?, remaining_months = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
        [remaining < 0 ? 0 : remaining, newPrincipalPaid, newTotalPrepayment, newInterestPaid, newTotalPaid, newEmi, newRemainingMonths, newStatus, loanId]
    );

    // Create linked expense transaction for prepayment
    try {
        const txId = await createTransaction({
            type: 'expense',
            amount: amount,
            category_id: categoryId || null,
            source_id: sourceId || null,
            date: date || new Date().toISOString(),
            notes: `Loan prepayment: ${loan.loan_name}`,
            bill_id: null,
            transfer_group_id: null,
            direction: 'debit'
        });
        await executeSql('UPDATE loan_payments SET transaction_id = ? WHERE id = ?', [txId, pRes.insertId]);
    } catch (e) {
        console.warn('Failed to create linked prepayment transaction', e);
    }

    try { events.emit('loanPaymentsChanged', { action: 'prepayment', id: pRes.insertId, loanId }); } catch (e) { }
    try { events.emit('loansChanged', { action: 'update', id: loanId }); } catch (e) { }

    return pRes.insertId;
}

export async function forecloseLoan({ loanId, date, finalPaymentAmount, foreclosureCharges = 0, sourceId = null, categoryId = null, notes = '' }) {
    const loan = await getLoanById(loanId);
    if (!loan) throw new Error('Loan not found');

    const amount = Number(finalPaymentAmount || loan.outstanding_amount || 0) + Number(foreclosureCharges || 0);
    const outstandingPrincipal = Number(loan.outstanding_amount || 0);
    const interestComponent =
        outstandingPrincipal != null
            ? Math.max(0, +(amount - outstandingPrincipal).toFixed(2))
            : 0;
    const principalComponent = outstandingPrincipal;
    const remaining = 0;

    // guard duplicate
    if (await hasDuplicatePayment(loanId, date || new Date().toISOString(), amount, 'FORECLOSURE')) {
        throw new Error('Duplicate foreclosure detected for the same date/amount');
    }

    const pRes = await executeSql(`INSERT INTO loan_payments (loan_id, payment_date, payment_amount, principal_component, interest_component, remaining_balance, payment_type, payment_source_id, payment_category_id, remarks) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [loanId, date || new Date().toISOString(), amount, principalComponent, interestComponent, remaining, 'FORECLOSURE', sourceId || null, categoryId || null, notes || null]
    );

    const newPrincipalPaid = +(Number(loan.principal_paid || 0) + principalComponent).toFixed(2);
    const newInterestPaid = +(Number(loan.interest_paid || 0) + interestComponent).toFixed(2);
    const newTotalPaid = +(Number(loan.total_paid || 0) + Number(amount)).toFixed(2);

    await executeSql(`UPDATE loans SET outstanding_amount = 0, principal_paid = ?, interest_paid = ?, total_paid = ?, remaining_months = 0, status = 'Closed', updated_at = datetime('now') WHERE id = ?`,
        [newPrincipalPaid, newInterestPaid, newTotalPaid, loanId]
    );

    // Create linked expense transaction for foreclosure
    try {
        const txId = await createTransaction({
            type: 'expense',
            amount: amount,
            category_id: categoryId || null,
            source_id: sourceId || null,
            date: date || new Date().toISOString(),
            notes: `Loan foreclosure: ${loan.loan_name}`,
            bill_id: null,
            transfer_group_id: null,
            direction: 'debit'
        });
        await executeSql('UPDATE loan_payments SET transaction_id = ? WHERE id = ?', [txId, pRes.insertId]);
    } catch (e) {
        console.warn('Failed to create linked foreclosure transaction', e);
    }

    try { events.emit('loanPaymentsChanged', { action: 'foreclosure', id: pRes.insertId, loanId }); } catch (e) { }
    try { events.emit('loansChanged', { action: 'update', id: loanId }); } catch (e) { }

    return pRes.insertId;
}

export async function getLoanPayments(loanId, limit = 1000, offset = 0) {
    // support pagination via limit & offset
    const res = await executeSql('SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY payment_date DESC LIMIT ? OFFSET ?', [loanId, limit, offset]);
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
    return rows;
}

export async function hasDuplicatePayment(loanId, date, amount, paymentType) {
    if (!loanId || !date) return false;
    // consider same-day duplicates: check payments for same loan, type and amount on the same date
    const dayStart = date.substring(0, 10) + "T00:00:00";
    const dayEnd = date.substring(0, 10) + "T23:59:59";
    const res = await executeSql('SELECT * FROM loan_payments WHERE loan_id = ? AND payment_type = ? AND payment_amount = ? AND payment_date BETWEEN ? AND ? LIMIT 1', [loanId, paymentType, amount, dayStart, dayEnd]);
    return res.rows.length > 0;
}

export default {
    createLoan,
    updateLoan,
    getLoans,
    getLoanById,
    recordPayment,
    recordPrepayment,
    forecloseLoan,
    getLoanPayments,
    hasDuplicatePayment
};
