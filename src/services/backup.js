import { Platform, InteractionManager } from 'react-native';
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
import { getLoans } from './loans';
import { getNotifications, updateNotification, getNotificationByType } from '../database/notifications';
import { rescheduleAll } from './notificationService';

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
    // Fetch notification settings
    let notificationSettings = [];
    try {
      const ns = await getNotifications();
      notificationSettings = ns;
    } catch (e) {
      notificationSettings = [];
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
        loan_payments: loanPayments,
        notification_settings: notificationSettings
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

// =======================================================
// Restore Helpers
// =======================================================

const MOBILE_BATCH_SIZE = 25;
const WEB_BATCH_SIZE = 100;

function getBatchSize() {
  return Platform.OS === 'web'
    ? WEB_BATCH_SIZE
    : MOBILE_BATCH_SIZE;
}

async function yieldToUI() {
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(resolve);
    });
  });
}

async function beginDbTransaction() {
  try {
    await executeSql('BEGIN TRANSACTION');
  } catch (_) {
    // Web/localStorage shim ignores transactions
  }
}

async function commitDbTransaction() {
  try {
    await executeSql('COMMIT');
  } catch (_) {
    // Web/localStorage shim ignores transactions
  }
}

async function rollbackDbTransaction() {
  try {
    await executeSql('ROLLBACK');
  } catch (_) {
    // Web/localStorage shim ignores transactions
  }
}

/**
 * Generic batch processor
 *
 * items           -> array
 * handler(item)   -> async function
 * onChunkDone(n)  -> progress callback
 */
async function processBatch(items, handler, onChunkDone) {
  const batchSize = getBatchSize();

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    await beginDbTransaction();
    try {
      for (const item of chunk) {
        await handler(item);
      }

      await commitDbTransaction();
    } catch (err) {
      await rollbackDbTransaction();
      throw err;
    }

    if (onChunkDone) {
      onChunkDone(chunk.length);
    }

    await yieldToUI();

    // Keep UI responsive only on mobile
    if (Platform.OS !== 'web') {
      await yieldToUI();
    }
  }
}

export async function restoreBackup(backupData, mode = 'replace', onProgress = null) {
  const BATCH_SIZE = getBatchSize();

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
            `INSERT INTO loans (id, loan_name, loan_type, lender, principal_amount, interest_rate, loan_start_date, loan_end_date, tenure_months, emi_amount, emi_day, outstanding_amount, principal_paid, interest_paid, total_paid, total_prepayment, remaining_months, status, notes, transaction_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
            [
            loan.id, loan.loan_name, loan.loan_type, loan.lender, loan.principal_amount,
            loan.interest_rate, loan.loan_start_date, loan.loan_end_date, loan.tenure_months,
            loan.emi_amount, loan.emi_day, loan.outstanding_amount, loan.principal_paid,
            loan.interest_paid, loan.total_paid, loan.total_prepayment, loan.remaining_months,
            loan.status, loan.notes, loan.transaction_id || null,
            loan.created_at, loan.updated_at
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

      // Restore notification settings on rollback
      // Only restore preferences, then reschedule
      try {
        const { rescheduleAll: reSchedule } = require('./notificationService');
        // Notifications table is not cleared by clearAllTables
        // so we don't need to re-insert, just reschedule
        await reSchedule();
      } catch (e) {
        console.warn('Failed to reschedule notifications during rollback', e);
      }

      console.log('Database rollback completed.');
      safeOnProgress(lastPercentage, 'Rollback completed.');
    } catch (rollbackErr) {
      console.error('Database rollback failed critically:', rollbackErr);
    }
  };

  try {
    safeOnProgress(0, 'Initializing restore...');
    await yieldToUI();

    if (mode === 'replace') {
      safeOnProgress(0, 'Clearing database...');
      await clearAllTables();
      await yieldToUI();
    }

    const {
      categories = [],
      sources = [],
      budgets = [],
      bills = [],
      transactions = [],
      loans = [],
      loan_payments = [],
      notification_settings = [],
    } = backupData.data || {};
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
    const loanMap = {};

    // 1. Categories
    await processBatch(
      categories,
      async (cat) => {
        if (mode === 'merge') {
          const existing = await executeSql(
            `SELECT id FROM categories WHERE name = ? AND type = ?`,
            [cat.name, cat.type]
          );

          if (existing.rows.length > 0) {
            categoryMap[cat.id] = existing.rows.item(0).id;
            return;
          }
        }

        const newId = await createCategory(cat);
        categoryMap[cat.id] = newId;
      },
      (count) => {
        updateProgress(count, 'Importing categories...');
      }
    );

    // 2. Sources
    await processBatch(
      sources,
      async (src) => {
        if (mode === 'merge') {
          const existing = await executeSql(
            `SELECT id FROM sources WHERE name = ?`,
            [src.name]
          );

          if (existing.rows.length > 0) {
            sourceMap[src.id] = existing.rows.item(0).id;
            return;
          }
        }

        const newId = await createSource(src);
        sourceMap[src.id] = newId;
      },
      (count) => {
        updateProgress(count, 'Importing sources...');
      }
    );

    // 3. Bills
    await processBatch(
      bills,
      async (bill) => {
        if (mode === 'merge') {
          const existing = await executeSql(
            `SELECT id FROM bills WHERE name = ? AND due_date = ?`,
            [bill.name, bill.due_date]
          );

          if (existing.rows.length > 0) {
            billMap[bill.id] = existing.rows.item(0).id;
            return;
          }
        }

        const billToCreate = {
          ...bill,
          category_id: categoryMap[bill.category_id] || null,
          source_id: sourceMap[bill.source_id] || null,
        };

        const newId = await createBill(billToCreate);
        billMap[bill.id] = newId;
      },
      (count) => {
        updateProgress(count, 'Importing bills...');
      }
    );

    // 4. Loans
    const sortedLoans = [...loans].sort(
      (a, b) =>
        new Date(a.loan_start_date) -
        new Date(b.loan_start_date)
    );
    await processBatch(
      sortedLoans,
      async (loan) => {
        if (mode === 'merge') {
          const existing = await executeSql(
            `SELECT id
              FROM loans
              WHERE loan_name = ?
                AND lender = ?
                AND principal_amount = ?
                AND loan_start_date = ?
                AND IFNULL(loan_direction, 'BORROWED') = ?
              LIMIT 1`,
            [
              loan.loan_name,
              loan.lender,
              loan.principal_amount,
              loan.loan_start_date,
              loan.loan_direction || 'BORROWED'
            ]
          );

          if (existing.rows.length > 0) {
            loanMap[loan.id] = existing.rows.item(0).id;
            return;
          }
        }

        // Direct INSERT instead of createLoan() to avoid auto-creating
        // a duplicate transaction (transactions are restored separately)
        const res = await executeSql(
          `INSERT INTO loans (
                loan_name, loan_type, lender, loan_direction,
                principal_amount, interest_rate, loan_start_date, loan_end_date,
                tenure_months, emi_amount, emi_day, outstanding_amount,
                principal_paid, interest_paid, total_paid, total_prepayment,
                remaining_months, status, notes, created_at, updated_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            loan.loan_name, loan.loan_type, loan.lender,
            loan.loan_direction || 'BORROWED',
            loan.principal_amount, loan.interest_rate,
            loan.loan_start_date, loan.loan_end_date,
            loan.tenure_months, loan.emi_amount, loan.emi_day,
            loan.outstanding_amount, loan.principal_paid,
            loan.interest_paid, loan.total_paid,
            loan.total_prepayment || 0, loan.remaining_months,
            loan.status || 'Active', loan.notes,
            loan.created_at || new Date().toISOString(),
            loan.updated_at || new Date().toISOString()
          ]
        );

        loanMap[loan.id] = res.insertId;
      },
      (count) => {
        updateProgress(count, 'Importing loans...');
      }
    );

    // 5. Transactions
    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
    await processBatch(
      sortedTransactions,
      async (tx) => {
        // Merge mode duplicate detection
        if (mode === 'merge') {
          const existing = await executeSql(
            `SELECT id
              FROM transactions
              WHERE type = ?
              AND amount = ?
              AND date = ?
              AND IFNULL(notes,'') = IFNULL(?, '')
              AND IFNULL(loan_id,0) = IFNULL(?,0)
              LIMIT 1`,
            [
              tx.type,
              tx.amount,
              tx.date,
              tx.notes,
              tx.loan_id ? (loanMap[tx.loan_id] || null) : null
            ]
          );

          if (existing.rows.length > 0) {
            transactionMap[tx.id] = existing.rows.item(0).id;
            return;
          }
        }

        const txToCreate = {
          ...tx,

          // Remap foreign keys
          category_id: categoryMap[tx.category_id] || null,
          source_id: sourceMap[tx.source_id] || null,
          bill_id: tx.bill_id ? (billMap[tx.bill_id] || null) : null,
          loan_id: tx.loan_id ? (loanMap[tx.loan_id] || null) : null,

          // Preserve loan metadata
          loan_payment_type: tx.loan_payment_type || null,
          principal_component: tx.principal_component || null,
          interest_component: tx.interest_component || null,
          outstanding_after_payment: tx.outstanding_after_payment || null,
          linked_date: tx.linked_date || null,

          // Preserve transfer metadata
          transfer_group_id: tx.transfer_group_id || null,
          direction: tx.direction || null
        };

        const newTransactionId = await createTransaction(txToCreate);

        // Backup transaction id -> restored transaction id
        transactionMap[tx.id] = newTransactionId;
      },
      (count) => {
        updateProgress(count, 'Importing transactions...');
      }
    );

    // 5b. Link restored transaction_id back to loans
    for (const loan of loans) {
      if (!loan.transaction_id) continue;
      const newLoanId = loanMap[loan.id];
      const newTxId = transactionMap[loan.transaction_id];
      if (!newLoanId || !newTxId) continue;
      try {
        await executeSql(
          `UPDATE loans SET transaction_id = ? WHERE id = ?`,
          [newTxId, newLoanId]
        );
      } catch (e) {
        console.warn(`Failed to link transaction_id for loan ${loan.id}`, e);
      }
    }

    // 6. Update Bills with linked transactions
    await processBatch(
      billsWithLinkedTx,
      async (bill) => {
        const newBillId = billMap[bill.id];
        const newTransactionId = transactionMap[bill.linked_transaction_id];

        if (!newBillId || !newTransactionId) {
          return;
        }

        await updateBill(newBillId, {
          linked_transaction_id: newTransactionId
        });
      },
      (count) => {
        updateProgress(count, 'Linking transactions to bills...');
      }
    );

    // 7. Loan payments
    await processBatch(
      loan_payments || [],
      async (payment) => {
        const newLoanId = loanMap[payment.loan_id];

        if (!newLoanId) {
          console.warn(
            `Skipping loan payment ${payment.id}. Loan ${payment.loan_id} was not restored.`
          );
          return;
        }

        if (mode === 'merge') {
          try {
            const existing = await executeSql(
              `SELECT id
         FROM loan_payments
         WHERE loan_id = ?
           AND payment_date = ?
           AND payment_amount = ?
           AND payment_type = ?
         LIMIT 1`,
              [
                newLoanId,
                payment.payment_date,
                payment.payment_amount,
                payment.payment_type
              ]
            );

            if (existing.rows.length > 0) {
              return;
            }
          } catch (e) {
            console.error(
              'Loan payment insert failed',
              {
                paymentId: payment.id,
                backupLoanId: payment.loan_id,
                mappedLoanId: newLoanId,
                backupTransactionId: payment.transaction_id,
                mappedTransactionId: newTransactionId
              },
              e
            );
            throw e;
          }
        }

        const newTransactionId = payment.transaction_id
          ? (transactionMap[payment.transaction_id] || null)
          : null;

        if (payment.transaction_id && !transactionMap[payment.transaction_id]) {
          console.warn(
            `Loan payment ${payment.id}: transaction ${payment.transaction_id} was not restored.`
          );
        }

        await executeSql(
          `INSERT INTO loan_payments
      (
        loan_id,
        payment_date,
        payment_amount,
        principal_component,
        interest_component,
        remaining_balance,
        payment_type,
        payment_source_id,
        payment_category_id,
        transaction_id,
        remarks,
        created_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            newLoanId,
            payment.payment_date,
            payment.payment_amount,
            payment.principal_component,
            payment.interest_component,
            payment.remaining_balance,
            payment.payment_type,
            payment.payment_source_id
              ? (sourceMap[payment.payment_source_id] || null)
              : null,

            payment.payment_category_id
              ? (categoryMap[payment.payment_category_id] || null)
              : null,
            payment.transaction_id
              ? (transactionMap[payment.transaction_id] || null)
              : null,
            payment.remarks,
            payment.created_at
          ]
        );
      },
      (count) => {
        updateProgress(count, 'Importing loan payments...');
      }
    );

    // 8. Budgets
    await processBatch(
      budgets,
      async (budget) => {
        const mappedCategoryId = categoryMap[budget.category_id] || null;

        if (mode === 'merge') {
          const existing = await executeSql(
            `SELECT id
         FROM budgets
         WHERE category_id = ?
           AND month = ?`,
            [
              mappedCategoryId,
              budget.month
            ]
          );

          if (existing.rows.length > 0) {
            return;
          }
        }

        await createBudget({
          ...budget,
          category_id: mappedCategoryId
        });
      },
      (count) => {
        updateProgress(count, 'Importing budgets...');
      }
    );

    // 9. Restore notification settings
    // Only restore user preferences (enabled, hour, minute)
    // Never restore notification_identifier — it's device-specific
    if (notification_settings.length > 0) {
      for (const ns of notification_settings) {
        try {
          // Match by type — don't create new rows, just update existing seeded ones
          const existing = await getNotificationByType(ns.type);
          if (existing) {
            await updateNotification(existing.id, {
              enabled: ns.enabled,
              hour: ns.hour,
              minute: ns.minute,
              title: ns.title,
              body: ns.body,
              // Never restore notification_identifier
            });
          }
        } catch (e) {
          console.warn('Failed to restore notification setting', ns.type, e);
        }
      }

      // Reschedule all enabled notifications with restored times
      try {
        await rescheduleAll();
      } catch (e) {
        console.warn('Failed to reschedule notifications after restore', e);
      }
    }

    safeOnProgress(100, 'Restore completed successfully!');
    await yieldToUI();
    return { success: true };
  } catch (error) {
    console.error('Restore failed:', error);
    await rollback();
    throw error;
  }
}
