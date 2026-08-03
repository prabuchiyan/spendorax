import { executeSql } from '../database/db';
import { createSource, updateSource } from './sources';
import { createTransfer } from './transactions';
import {
  createBill,
  updateBill,
  deleteBill,
} from './bills';
import { BILL_STATUS } from './billUtils';

export async function createCreditCard({
    name,
    bank = null,
    last4 = null,
    network = null,
    credit_limit = 0,
    statement_day = null,
    due_after_days = null,
    minimum_due_percent = 0,
    currency = 'INR',
    color = '#4B7CF3',
    notes = null,
    status = 'active',
}) {
    const sourceId = await createSource({
        name,
        type: 'credit_card',
        initial_balance: 0,
        icon: 'credit-card-outline',
        color,
    });

    const outstanding = 0;
    const available_limit = Number(credit_limit || 0);
    const now = new Date().toISOString();

    const res = await executeSql(
        `INSERT INTO credit_cards (
    name,
    bank,
    last4,
    network,
    credit_limit,
    outstanding,
    available_limit,
    statement_day,
    due_after_days,
    minimum_due_percent,
    currency,
    color,
    notes,
    status,
    source_id,
    payment_bill_id,
    created_at,
    updated_at
  )
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
            name,
            bank,
            last4,
            network,
            Number(credit_limit || 0),
            outstanding,
            available_limit,
            statement_day,
            due_after_days,
            Number(minimum_due_percent || 0),
            currency,
            color,
            notes,
            status,
            sourceId,
            null,
            now,
            now,
        ]
    );

    const cardId = res.insertId;

    // Create recurring bill template
    const today = new Date();

    const statementDate = new Date(today);
    statementDate.setDate(Number(statement_day || today.getDate()));

    const dueDate = new Date(statementDate);

    if (due_after_days != null) {
        dueDate.setDate(
            dueDate.getDate() + Number(due_after_days)
        );
    }

    const templateBillId = await createBill({
        name,
        amount: 0,

        due_date: dueDate.toISOString().slice(0, 10),

        status: BILL_STATUS.PENDING,

        is_recurring: 1,
        recurrence_type: 'monthly',
        recurrence_interval: 1,
        recurrence_end_date: null,

        category_id: null,
        source_id: null,

        reminder_days_before: 2,
        auto_pay: 0,

        notes: `Recurring payment template for ${name}`,

        attachment_url: null,
    });

    // Link template to card
    await executeSql(
        `UPDATE credit_cards
   SET payment_bill_id = ?
   WHERE id = ?`,
        [templateBillId, cardId]
    );

    return cardId;
}

export async function updateCreditCard(id, fields) {
    const card = await getCreditCardById(id);
    if (!card) return null;

    const sets = [];
    const vals = [];
    for (const key of Object.keys(fields)) {
        if (key === 'source_id' || key === 'id') continue;
        sets.push(`${key} = ?`);
        vals.push(fields[key]);
    }

    if (sets.length > 0) {
        sets.push('updated_at = datetime(\'now\')');
        const sql = `UPDATE credit_cards SET ${sets.join(', ')} WHERE id = ?`;
        vals.push(id);
        await executeSql(sql, vals);
    }

    // Keep the linked source display in sync
    if (fields.name || fields.color || fields.status) {
        await updateSource(card.source_id, {
            name: fields.name || card.name,
            color: fields.color || card.color,
            type: 'credit_card',
            initial_balance: 0,
            icon: 'credit-card-outline',
            is_active: (fields.status || card.status) !== 'inactive' ? 1 : 0,
        });
    }

    // Keep recurring bill template in sync
    if (card.payment_bill_id) {

        const statementDay =
            Number(fields.statement_day ?? card.statement_day);

        const dueAfterDays =
            Number(fields.due_after_days ?? card.due_after_days ?? 0);

        const today = new Date();

        const statementDate = new Date(today);
        statementDate.setDate(statementDay);

        const dueDate = new Date(statementDate);
        dueDate.setDate(dueDate.getDate() + dueAfterDays);

        await updateBill(card.payment_bill_id, {
            name: fields.name ?? card.name,

            due_date: dueDate.toISOString().slice(0, 10),

            notes:
                fields.notes ??
                card.notes ??
                `Recurring payment template for ${fields.name ?? card.name}`,

            recurrence_type: 'monthly',
            recurrence_interval: 1,
        });
    }

    return getCreditCardById(id);
}

export async function getCreditCards(activeOnly = true) {
    const res = await executeSql(
        `SELECT cc.*, s.name as source_name, s.type as source_type, s.is_active as source_active
     FROM credit_cards cc
     LEFT JOIN sources s ON s.id = cc.source_id
     ORDER BY cc.name`,
        []
    );

    const rows = [];
    const sourceIds = [];
    for (let i = 0; i < res.rows.length; i++) {
        const row = res.rows.item(i);
        rows.push(row);
        if (row.source_id) sourceIds.push(row.source_id);
    }

    const totalsBySource = {};
    if (sourceIds.length > 0) {
        const placeholders = sourceIds.map(() => '?').join(',');
        const txRes = await executeSql(
            `SELECT source_id, type, amount FROM transactions WHERE source_id IN (${placeholders})`,
            sourceIds
        );

        for (let i = 0; i < txRes.rows.length; i++) {
            const tx = txRes.rows.item(i);
            const sourceId = tx.source_id;
            if (!sourceId) continue;
            const amount = Number(tx.amount || 0);
            totalsBySource[sourceId] = totalsBySource[sourceId] || 0;
            if (tx.type === 'expense') {
                totalsBySource[sourceId] += amount;
            } else if (tx.type === 'income') {
                totalsBySource[sourceId] -= amount;
            }
        }
    }

    const normalizedRows = rows.map(row => {
        const outstanding = Number(totalsBySource[row.source_id] || row.outstanding || 0);
        const limit = Number(row.credit_limit || 0);
        return {
            ...row,
            outstanding,
            available_limit: limit - outstanding,
        };
    });

    return activeOnly
        ? normalizedRows.filter(r => r.status !== 'inactive')
        : normalizedRows;
}

export async function getCreditCardById(id) {
    const res = await executeSql(
        `SELECT cc.*, s.name as source_name, s.type as source_type, s.is_active as source_active
     FROM credit_cards cc
     LEFT JOIN sources s ON s.id = cc.source_id
     WHERE cc.id = ? LIMIT 1`,
        [id]
    );
    if (res.rows.length === 0) return null;

    const row = res.rows.item(0);
    if (!row.source_id) return row;

    const txRes = await executeSql(
        `SELECT type, amount FROM transactions WHERE source_id = ?`,
        [row.source_id]
    );
    let outstanding = 0;
    for (let i = 0; i < txRes.rows.length; i++) {
        const tx = txRes.rows.item(i);
        const amount = Number(tx.amount || 0);
        if (tx.type === 'expense') {
            outstanding += amount;
        } else if (tx.type === 'income') {
            outstanding -= amount;
        }
    }

    const limit = Number(row.credit_limit || 0);
    return {
        ...row,
        outstanding,
        available_limit: limit - outstanding,
    };
}

export async function getCreditCardBySourceId(sourceId) {
    const res = await executeSql(
        `SELECT * FROM credit_cards WHERE source_id = ? LIMIT 1`,
        [sourceId]
    );
    if (res.rows.length === 0) return null;
    return res.rows.item(0);
}

export async function refreshCreditCardTotals(cardId) {
    const card = await getCreditCardById(cardId);
    if (!card || !card.source_id) return null;

    const txRes = await executeSql(
        `SELECT type, amount FROM transactions WHERE source_id = ?`,
        [card.source_id]
    );
    let outstanding = 0;
    for (let i = 0; i < txRes.rows.length; i++) {
        const tx = txRes.rows.item(i);
        const amount = Number(tx.amount || 0);
        if (tx.type === 'expense') {
            outstanding += amount;
        } else if (tx.type === 'income') {
            outstanding -= amount;
        }
    }

    const limit = Number(card.credit_limit || 0);
    const available_limit = limit - outstanding;

    await executeSql(
        `UPDATE credit_cards SET outstanding = ?, available_limit = ?, updated_at = datetime('now') WHERE id = ?`,
        [outstanding, available_limit, cardId]
    );

    return getCreditCardById(cardId);
}

export async function createCreditCardPayment({
    cardId,
    statementId = null,
    amount,
    payment_date = null,
    source_id,
    notes = null,
}) {
    const card = await getCreditCardById(cardId);

    if (!card) {
        throw new Error('Credit card not found');
    }

    if (!card.source_id) {
        throw new Error('Credit card source is missing');
    }

    if (!source_id) {
        throw new Error('Payment source is required');
    }

    const date = payment_date || new Date().toISOString();

    // Create transfer and capture both transaction ids
    const transfer = await createTransfer({
        fromAccount: source_id,
        toAccount: card.source_id,
        amount,
        note: notes || `Credit Card Payment - ${card.name}`,
        date,
    });

    const res = await executeSql(
        `INSERT INTO credit_card_payments
    (
      card_id,
      statement_id,
      bank_transaction_id,
      card_transaction_id,
      amount,
      payment_date,
      source_id,
      notes
    )
    VALUES (?,?,?,?,?,?,?,?)`,
        [
            cardId,
            statementId,
            transfer.debitTransactionId,
            transfer.creditTransactionId,
            amount,
            date,
            source_id,
            notes,
        ]
    );

    // Refresh card totals
    await refreshCreditCardTotals(cardId);

    // Update statement payment amount if linked
    if (statementId) {
        await executeSql(
            `UPDATE credit_card_statements
       SET payments = COALESCE(payments,0) + ?
       WHERE id = ?`,
            [amount, statementId]
        );

        // Auto close statement if fully paid
        await executeSql(
            `UPDATE credit_card_statements
       SET status =
         CASE
           WHEN closing_balance <= (COALESCE(payments,0))
           THEN 'paid'
           ELSE status
         END
       WHERE id = ?`,
            [statementId]
        );
    }

    return res.insertId;
}

export async function createCreditCardStatement(fields) {
    const keys = [
        'card_id', 'statement_start', 'statement_end', 'statement_date', 'due_date',
        'opening_balance', 'purchases', 'refunds', 'fees', 'interest', 'payments',
        'closing_balance', 'minimum_due', 'status'
    ];

    const values = keys.map(k => fields[k] != null ? fields[k] : null);
    const res = await executeSql(
        `INSERT INTO credit_card_statements (
      card_id, statement_start, statement_end, statement_date, due_date,
      opening_balance, purchases, refunds, fees, interest, payments,
      closing_balance, minimum_due, status, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
        values
    );

    return res.insertId;
}

export async function getCreditCardStatements(cardId) {
    const res = await executeSql(
        `SELECT * FROM credit_card_statements WHERE card_id = ? ORDER BY statement_date DESC`,
        [cardId]
    );
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
    return rows;
}

export async function getAllCreditCardStatements() {
    const res = await executeSql(
        `SELECT ccs.*, cc.name as card_name, cc.color as card_color, cc.currency as card_currency
     FROM credit_card_statements ccs
     LEFT JOIN credit_cards cc ON cc.id = ccs.card_id
     ORDER BY ccs.statement_date DESC`,
        []
    );
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
    return rows;
}

export async function getCreditCardPayments(cardId) {
    const res = await executeSql(
        `SELECT * FROM credit_card_payments WHERE card_id = ? ORDER BY payment_date DESC`,
        [cardId]
    );
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
    return rows;
}

export async function deleteCreditCard(id) {
    const card = await getCreditCardById(id);
    if (!card) return;

    // Deactivate the credit card
    await executeSql(
        `UPDATE credit_cards
     SET status = 'inactive',
         updated_at = datetime('now')
     WHERE id = ?`,
        [id]
    );

    // Deactivate linked source
    if (card.source_id) {
        await updateSource(card.source_id, {
            name: card.source_name || card.name,
            type: 'credit_card',
            initial_balance: 0,
            icon: 'credit-card-outline',
            color: card.color || '#4B7CF3',
            is_active: 0,
        });
    }

    // Archive recurring bill template
    if (card.payment_bill_id) {
        try {
            await deleteBill(card.payment_bill_id);
        } catch (e) {
            console.warn('Failed to archive credit card bill template', e);
        }
    }
}
