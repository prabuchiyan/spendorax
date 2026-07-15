import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { executeSql } from '../database/db';
import { clearAllTables } from '../database/init';
import { getCategories, createCategory } from './categories';
import { getSources, createSource } from './sources';
import { getTransactions, createTransaction } from './transactions';
import { getBudgets, createBudget } from './budgets';
import { getBills, createBill, updateBill } from './bills';
import { getLoans, createLoan } from './loans';

const BACKUP_VERSION = 1;

export async function exportBackup() {
  try {
    const categories = await getCategories(false);
    const sources = await getSources(false);
    const transactions = await getTransactions(1000000, 'Yes');
    const budgets = await getBudgets();
    const bills = await getBills();
    const loans = await getLoans();
    // fetch all loan payments directly (if table exists)
    let loanPayments = [];
    try {
      const lp = await executeSql('SELECT * FROM loan_payments');
      for (let i = 0; i < lp.rows.length; i++) loanPayments.push(lp.rows.item(i));
    } catch (e) {
      loanPayments = [];
    }

    const backupData = {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      data: {
        transactions,
        categories,
        sources,
        budgets,
        bills,
        loans,
        loan_payments: loanPayments
      },
    };

    const backupJson = JSON.stringify(backupData);
    const fileName = `SpendoraX_Backup_${new Date().toISOString().split('T')[0]}.json`;

    if (Platform.OS === 'web') {
      // Web Fallback: Create a blob and trigger a download
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      return { success: true, timestamp: backupData.timestamp };
    }

    // Native Mobile logic
    const fileUri = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(fileUri, backupJson);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      throw new Error('Sharing is not available on this device');
    }

    return { success: true, timestamp: backupData.timestamp };
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

export async function pickBackupFile() {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    let fileContent;

    if (Platform.OS === 'web') {
      // On web, we might get the file directly or need to fetch the URI
      if (asset.file) {
        fileContent = await asset.file.text();
      } else {
        const response = await fetch(asset.uri);
        fileContent = await response.text();
      }
    } else {
      fileContent = await FileSystem.readAsStringAsync(asset.uri);
    }

    const backupData = JSON.parse(fileContent);


    // Validation
    if (backupData.version !== BACKUP_VERSION) {
      throw new Error('Invalid backup version');
    }

    const requiredKeys = ['transactions', 'categories', 'sources', 'budgets', 'bills', 'loans', 'loan_payments'];
    for (const key of requiredKeys) {
      if (!backupData.data || !backupData.data[key]) {
        throw new Error(`Missing required data: ${key}`);
      }
    }

    return backupData;
  } catch (error) {
    console.error('Picking file failed:', error);
    throw error;
  }
}

export async function restoreBackup(backupData, mode = 'replace', onProgress = null) {
  const yieldToEventLoop = () => new Promise(resolve => setTimeout(resolve, 0));
  const BATCH_SIZE = 20;

  let lastPercentage = 0;
  const safeOnProgress = (percentage, message) => {
    if (onProgress) {
      if (percentage > lastPercentage) {
        lastPercentage = percentage;
      }
      onProgress(lastPercentage, message);
    }
  };

  // Snapshot original data in-memory for recovery
  const originalData = {
    categories: [],
    sources: [],
    budgets: [],
    bills: [],
    transactions: [],
    loans: [],
    loan_payments: []
  };

  try {
    const cats = await executeSql('SELECT * FROM categories');
    for (let i = 0; i < cats.rows.length; i++) originalData.categories.push(cats.rows.item(i));

    const srcs = await executeSql('SELECT * FROM sources');
    for (let i = 0; i < srcs.rows.length; i++) originalData.sources.push(srcs.rows.item(i));

    const bdgts = await executeSql('SELECT * FROM budgets');
    for (let i = 0; i < bdgts.rows.length; i++) originalData.budgets.push(bdgts.rows.item(i));

    const bls = await executeSql('SELECT * FROM bills');
    for (let i = 0; i < bls.rows.length; i++) originalData.bills.push(bls.rows.item(i));

    const txs = await executeSql('SELECT * FROM transactions');
    for (let i = 0; i < txs.rows.length; i++) originalData.transactions.push(txs.rows.item(i));

    // Snapshot loans (if table exists)
    try {
      const lns = await executeSql('SELECT * FROM loans');
      for (let i = 0; i < lns.rows.length; i++) originalData.loans.push(lns.rows.item(i));
    } catch (e) {
      // ignore if loans table missing
    }

    // Snapshot loan payments (if table exists)
    try {
      const lps = await executeSql('SELECT * FROM loan_payments');
      for (let i = 0; i < lps.rows.length; i++) originalData.loan_payments.push(lps.rows.item(i));
    } catch (e) {
      // ignore if table missing
    }
  } catch (snapshotErr) {
    console.error('Failed to snapshot original database:', snapshotErr);
  }

  const rollback = async () => {
    console.log('Initiating database rollback...');
    safeOnProgress(lastPercentage, 'Restoring original database...');
    try {
      await clearAllTables();

      // Restore categories
      for (const cat of originalData.categories) {
        await executeSql(
          `INSERT INTO categories (id, name, type, icon, color, is_active, created_at) VALUES (?,?,?,?,?,?,?)`,
          [cat.id, cat.name, cat.type, cat.icon, cat.color, cat.is_active, cat.created_at]
        );
      }

      // Restore sources
      for (const src of originalData.sources) {
        await executeSql(
          `INSERT INTO sources (id, name, type, initial_balance, is_active, icon, color) VALUES (?,?,?,?,?,?,?)`,
          [src.id, src.name, src.type, src.initial_balance, src.is_active, src.icon, src.color]
        );
      }

      // Restore bills
      for (const bill of originalData.bills) {
        await executeSql(
          `INSERT INTO bills (id, name, amount, due_date, status, is_recurring, recurrence_type, recurrence_interval, recurrence_end_date, category_id, source_id, reminder_days_before, last_reminded_at, auto_pay, notes, attachment_url, linked_transaction_id, paid_at, is_paid, created_at, updated_at, deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            bill.id, bill.name, bill.amount, bill.due_date, bill.status, bill.is_recurring,
            bill.recurrence_type, bill.recurrence_interval, bill.recurrence_end_date,
            bill.category_id, bill.source_id, bill.reminder_days_before, bill.last_reminded_at,
            bill.auto_pay, bill.notes, bill.attachment_url, bill.linked_transaction_id,
            bill.paid_at, bill.is_paid, bill.created_at, bill.updated_at, bill.deleted_at
          ]
        );
      }

      // Restore transactions
      for (const tx of originalData.transactions) {
        await executeSql(
          `INSERT INTO transactions (id, type, amount, category_id, source_id, date, notes, bill_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
          [tx.id, tx.type, tx.amount, tx.category_id, tx.source_id, tx.date, tx.notes, tx.bill_id, tx.created_at]
        );
      }

      // Restore budgets
      for (const budget of originalData.budgets) {
        await executeSql(
          `INSERT INTO budgets (id, category_id, monthly_limit, month) VALUES (?,?,?,?)`,
          [budget.id, budget.category_id, budget.monthly_limit, budget.month]
        );
      }

      // Restore loans
      for (const loan of originalData.loans) {
        try {
          await executeSql(
            `INSERT INTO loans (id, loan_name, loan_type, lender, principal_amount, interest_rate, loan_start_date, loan_end_date, tenure_months, emi_amount, emi_day, outstanding_amount, principal_paid, interest_paid, total_paid, total_prepayment, remaining_months, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              loan.id, loan.loan_name, loan.loan_type, loan.lender, loan.principal_amount,
              loan.interest_rate, loan.loan_start_date, loan.loan_end_date, loan.tenure_months,
              loan.emi_amount, loan.emi_day, loan.outstanding_amount, loan.principal_paid,
              loan.interest_paid, loan.total_paid, loan.total_prepayment, loan.remaining_months,
              loan.status, loan.notes, loan.created_at, loan.updated_at
            ]
          );
        } catch (e) {
          console.warn('Failed to restore loan', loan.id, e);
        }
      }

      // Restore loan payments
      for (const p of originalData.loan_payments) {
        try {
          await executeSql(
            `INSERT INTO loan_payments (id, loan_id, payment_date, payment_amount, principal_component, interest_component, remaining_balance, payment_type, payment_source_id, payment_category_id, transaction_id, remarks, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [p.id, p.loan_id, p.payment_date, p.payment_amount, p.principal_component, p.interest_component, p.remaining_balance, p.payment_type, p.payment_source_id, p.payment_category_id || null, p.transaction_id, p.remarks, p.created_at]
          );
        } catch (e) {
          console.warn('Failed to restore loan payment', p.id, e);
        }
      }

      console.log('Database rollback completed.');
      safeOnProgress(lastPercentage, 'Rollback completed.');
    } catch (rollbackErr) {
      console.error('Database rollback failed critically:', rollbackErr);
    }
  };

  try {
    safeOnProgress(0, 'Initializing restore...');
    await yieldToEventLoop();

    if (mode === 'replace') {
      safeOnProgress(0, 'Clearing database...');
      await clearAllTables();
      await yieldToEventLoop();
    }

    const { categories = [], sources = [], budgets = [], bills = [], transactions = [], loans = [], loan_payments = [] } = backupData.data || {};
    const billsWithLinkedTx = bills.filter(b => b.linked_transaction_id);
    const totalItems = categories.length + sources.length + bills.length + transactions.length + budgets.length + billsWithLinkedTx.length + loans.length + loan_payments.length;
    let processedItems = 0;

    const updateProgress = (completedInChunk, stepMessage) => {
      processedItems += completedInChunk;
      if (totalItems > 0) {
        const percentage = Math.min(99, Math.round((processedItems / totalItems) * 100));
        safeOnProgress(percentage, `${stepMessage} (${processedItems}/${totalItems})`);
      }
    };

    const categoryMap = {};
    const sourceMap = {};
    const billMap = {};
    const transactionMap = {};

    // 1. Categories
    for (let i = 0; i < categories.length; i += BATCH_SIZE) {
      const chunk = categories.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map(async (cat) => {
        if (mode === 'merge') {
          const existing = await executeSql(`SELECT id FROM categories WHERE name = ? AND type = ?`, [cat.name, cat.type]);
          if (existing.rows.length > 0) {
            categoryMap[cat.id] = existing.rows.item(0).id;
            return;
          }
        }
        const newId = await createCategory(cat);
        categoryMap[cat.id] = newId;
      }));
      updateProgress(chunk.length, 'Importing categories...');
      await yieldToEventLoop();
    }

    // 2. Sources
    for (let i = 0; i < sources.length; i += BATCH_SIZE) {
      const chunk = sources.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map(async (src) => {
        if (mode === 'merge') {
          const existing = await executeSql(`SELECT id FROM sources WHERE name = ?`, [src.name]);
          if (existing.rows.length > 0) {
            sourceMap[src.id] = existing.rows.item(0).id;
            return;
          }
        }
        const newId = await createSource(src);
        sourceMap[src.id] = newId;
      }));
      updateProgress(chunk.length, 'Importing sources...');
      await yieldToEventLoop();
    }

    // 3. Bills
    for (let i = 0; i < bills.length; i += BATCH_SIZE) {
      const chunk = bills.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map(async (bill) => {
        if (mode === 'merge') {
          const existing = await executeSql(`SELECT id FROM bills WHERE name = ? AND due_date = ?`, [bill.name, bill.due_date]);
          if (existing.rows.length > 0) {
            billMap[bill.id] = existing.rows.item(0).id;
            return;
          }
        }
        const billToCreate = {
          ...bill,
          category_id: categoryMap[bill.category_id] || null,
          source_id: sourceMap[bill.source_id] || null
        };
        const newId = await createBill(billToCreate);
        billMap[bill.id] = newId;
      }));
      updateProgress(chunk.length, 'Importing bills...');
      await yieldToEventLoop();
    }

    // 4. Loans
    const loanMap = {};
    for (let i = 0; i < loans.length; i += BATCH_SIZE) {
      const chunk = loans.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map(async (ln) => {
        if (mode === 'merge') {
          const existing = await executeSql(`SELECT id FROM loans WHERE loan_name = ? AND lender = ? AND principal_amount = ?`, [ln.loan_name, ln.lender, ln.principal_amount]);
          if (existing.rows.length > 0) {
            loanMap[ln.id] = existing.rows.item(0).id;
            return;
          }
        }
        const newId = await createLoan(ln);
        loanMap[ln.id] = newId;
      }));
      updateProgress(chunk.length, 'Importing loans...');
      await yieldToEventLoop();
    }

    // 5. Transactions
    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const chunk = transactions.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map(async (tx) => {
        if (mode === 'merge') {
          const existing = await executeSql(
            `SELECT id FROM transactions WHERE type = ? AND amount = ? AND date = ? AND notes = ?`,
            [tx.type, tx.amount, tx.date, tx.notes]
          );
          if (existing.rows.length > 0) {
            transactionMap[tx.id] = existing.rows.item(0).id;
            return;
          }
        }
        const txToCreate = {
          ...tx,
          category_id: categoryMap[tx.category_id] || null,
          source_id: sourceMap[tx.source_id] || null,
          bill_id: billMap[tx.bill_id] || null,
          loan_id: tx.loan_id
            ? (loanMap[tx.loan_id] || null)
            : null
        };
        const newId = await createTransaction(txToCreate);
        transactionMap[tx.id] = newId;
      }));
      updateProgress(chunk.length, 'Importing transactions...');
      await yieldToEventLoop();
    }

    // 6. Update Bills with linked transactions
    if (billsWithLinkedTx.length > 0) {
      for (let i = 0; i < billsWithLinkedTx.length; i += BATCH_SIZE) {
        const chunk = billsWithLinkedTx.slice(i, i + BATCH_SIZE);
        await Promise.all(chunk.map(async (bill) => {
          const newTxId = transactionMap[bill.linked_transaction_id];
          const newBillId = billMap[bill.id];
          if (newTxId && newBillId) {
            await updateBill(newBillId, { linked_transaction_id: newTxId });
          }
        }));
        updateProgress(chunk.length, 'Linking transactions to bills...');
        await yieldToEventLoop();
      }
    }

    // 7. Loan payments
    const loanPaymentsArr = loan_payments || [];
    for (let i = 0; i < loanPaymentsArr.length; i += BATCH_SIZE) {
      const chunk = loanPaymentsArr.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map(async (p) => {
        const newLoanId = loanMap[p.loan_id];
        if (!newLoanId) return;

        if (mode === 'merge') {
          const exists = await executeSql(`SELECT id FROM loan_payments WHERE loan_id = ? AND payment_date = ? AND payment_amount = ? AND payment_type = ? LIMIT 1`, [newLoanId, p.payment_date, p.payment_amount, p.payment_type]);
          if (exists.rows.length > 0) return;
        }

        const newTxId = p.transaction_id ? transactionMap[p.transaction_id] : null;
        await executeSql(
          `INSERT INTO loan_payments (loan_id, payment_date, payment_amount, principal_component, interest_component, remaining_balance, payment_type, payment_source_id, payment_category_id, transaction_id, remarks, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [newLoanId, p.payment_date, p.payment_amount, p.principal_component, p.interest_component, p.remaining_balance, p.payment_type, p.payment_source_id, p.payment_category_id || null, newTxId || null, p.remarks, p.created_at]
        );
      }));
      updateProgress(chunk.length, 'Importing loan payments...');
      await yieldToEventLoop();
    }

    // 8. Budgets
    for (let i = 0; i < budgets.length; i += BATCH_SIZE) {
      const chunk = budgets.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map(async (budget) => {
        if (mode === 'merge') {
          const existing = await executeSql(
            `SELECT id FROM budgets WHERE category_id = ? AND month = ?`,
            [categoryMap[budget.category_id] || null, budget.month]
          );
          if (existing.rows.length > 0) return;
        }
        await createBudget({
          ...budget,
          category_id: categoryMap[budget.category_id] || null
        });
      }));
      updateProgress(chunk.length, 'Importing budgets...');
      await yieldToEventLoop();
    }

    safeOnProgress(100, 'Restore completed successfully!');
    await yieldToEventLoop();
    return { success: true };
  } catch (error) {
    console.error('Restore failed:', error);
    await rollback();
    throw error;
  }
}
