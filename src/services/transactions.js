import { executeSql } from '../database/db';
import events from './events';
import {
  getBillsForTransaction,
  removeTransactionFromBill,
} from './bills';

export async function createTransaction(tx) {
  const {
    type,
    amount,
    category_id,
    source_id,
    date,
    notes,
    bill_id,
    transfer_group_id,
    direction
  } = tx;
  // Support optional loan-linking fields without breaking existing callers
  const loan_id = tx.loan_id || null;
  const loan_payment_type = tx.loan_payment_type || null;
  const principal_component = tx.principal_component != null ? tx.principal_component : null;
  const interest_component = tx.interest_component != null ? tx.interest_component : null;
  const outstanding_after_payment = tx.outstanding_after_payment != null ? tx.outstanding_after_payment : null;
  const linked_date = tx.linked_date || null;

  const res = await executeSql(
    `INSERT INTO transactions 
    (type, amount, category_id, source_id, date, notes, bill_id, transfer_group_id, direction, loan_id, loan_payment_type, principal_component, interest_component, outstanding_after_payment, linked_date)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      type,
      amount,
      category_id || null,
      source_id || null,
      date || new Date().toISOString(),
      notes || null,
      bill_id || null,
      transfer_group_id || null,
      direction || null,
      loan_id,
      loan_payment_type,
      principal_component,
      interest_component,
      outstanding_after_payment,
      linked_date
    ]
  );

  try {
    events.emit('transactionsChanged', { action: 'create', id: res.insertId });
  } catch (e) { }
  return res.insertId;
}

// emit change after creation
const _origCreate = createTransaction;

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function parseTransactionDate(value) {
  if (!value) return null;

  let d = new Date(value);
  if (isValidDate(d)) return d;

  // fallback if some legacy values are stored as "YYYY-MM-DD HH:mm:ss"
  d = new Date(String(value).replace(' ', 'T'));
  if (isValidDate(d)) return d;

  return null;
}

function getPeriodBounds(period, referenceDate = new Date(), minDate = null) {
  const ref = new Date(referenceDate);

  let start = null;
  let end = null;

  switch (period) {
    case 'day': {
      start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
      end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 1);
      break;
    }

    case 'week': {
      start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 1);
      end.setHours(0, 0, 0, 0);
      break;
    }

    case 'month': {
      start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
      break;
    }

    case 'year': {
      start = minDate ? new Date(minDate) : new Date(0);
      start.setHours(0, 0, 0, 0);

      end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 1);
      end.setHours(0, 0, 0, 0);
      break;
    }

    default:
      return null;
  }

  return { start, end };
}

function matchesPeriod(txDate, period, referenceDate = new Date()) {
  if (!period) return true;

  const bounds = getPeriodBounds(period, referenceDate);
  if (!bounds) return true;

  return txDate >= bounds.start && txDate < bounds.end;
}

export async function getTransactions(
  limit = 100,
  isTransferInclude = 'No',
  sourceId = null,
  categoryId = null,
  period = null,
  referenceDate = new Date()
) {
  try {
    const params = [];
    const conditions = [];
    let query = `SELECT * FROM transactions`;

    const normalizedSourceId =
      sourceId !== null && sourceId !== undefined ? Number(sourceId) : null;

    const normalizedCategoryId =
      categoryId !== null && categoryId !== undefined ? Number(categoryId) : null;

    // Only use SQL for guaranteed-safe filters
    if (normalizedSourceId !== null && !Number.isNaN(normalizedSourceId)) {
      conditions.push(`source_id = ?`);
      params.push(normalizedSourceId);
    }

    if (normalizedCategoryId !== null && !Number.isNaN(normalizedCategoryId)) {
      conditions.push(`category_id = ?`);
      params.push(normalizedCategoryId);
    }

    if (isTransferInclude === 'No') {
      conditions.push(`transfer_group_id IS NULL`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Don't apply date filtering in SQL
    query += ` ORDER BY id DESC`;

    const res = await executeSql(query, params);

    const rows = [];
    for (let i = 0; i < res.rows.length; i++) {
      rows.push(res.rows.item(i));
    }

    // Filter by period in JS
    const filtered = rows.filter((row) => {

      if (isTransferInclude === 'No' && row.transfer_group_id !== null) return false;

      const txDate = parseTransactionDate(row.date);
      if (!txDate) {
        console.warn('Invalid transaction date:', row.id, row.date);
        return false;
      }

      return matchesPeriod(txDate, period, referenceDate);
    });

    // Sort again safely by parsed date desc
    filtered.sort((a, b) => {
      const da = parseTransactionDate(a.date)?.getTime() || 0;
      const db = parseTransactionDate(b.date)?.getTime() || 0;
      return db - da;
    });

    return filtered.slice(0, Number(limit));
  } catch (error) {
    console.error('getTransactions error:', error);
    return [];
  }
}

export async function deleteTransaction(id) {
  // Find every bill linked to this transaction
  const result = await executeSql(
    `SELECT bill_id
     FROM bill_linked_transactions
     WHERE transaction_id = ?`,
    [id]
  );

  const linkedBills = [];
  for (let i = 0; i < result.rows.length; i++) {
    linkedBills.push(result.rows.item(i));
  }

  // Remove bill links FIRST
  for (const row of linkedBills) {
    await removeTransactionFromBill(row.bill_id, id);
  }

  // Now delete the transaction
  await executeSql(
    `DELETE FROM transactions
     WHERE id = ?`,
    [id]
  );

  try {
    events.emit('transactionsChanged', {
      action: 'delete',
      id,
    });
    events.emit('billsChanged');
  } catch (e) { }
}

export async function updateTransaction(id, fields) {
  const sets = [];
  const vals = [];
  for (const k of Object.keys(fields)) {
    sets.push(`${k} = ?`);
    vals.push(fields[k]);
  }
  if (sets.length === 0) return;
  vals.push(id);
  const sql = `UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`;
  await executeSql(sql, vals);
  try { events.emit('transactionsChanged', { action: 'update', id, fields }); } catch (e) { }
}

export async function createTransfer({
  fromAccount,
  toAccount,
  amount,
  note,
  date
}) {
  const groupId = Date.now().toString();
  // Debit
  await createTransaction({
    type: 'expense',
    amount,
    category_id: null,
    source_id: fromAccount,
    date,
    notes: note || 'Transfer',
    bill_id: null,
    transfer_group_id: groupId,
    direction: 'debit'
  });

  // Credit
  await createTransaction({
    type: 'income',
    amount,
    category_id: null,
    source_id: toAccount,
    date,
    notes: note || 'Transfer',
    bill_id: null,
    transfer_group_id: groupId,
    direction: 'credit'
  });
}

export async function getTransactionNoteSuggestions() {
  const transactions = await getTransactions(1000000, 'Yes');
  const categoriesRes = await executeSql(`SELECT * FROM categories`);

  const categories = [];

  for (let i = 0; i < categoriesRes.rows.length; i++) {
    categories.push(categoriesRes.rows.item(i));
  }

  const map = {};

  transactions.forEach(tx => {
    if (!tx.notes || !tx.notes.trim()) return;

    const category = categories.find(c => c.id === tx.category_id);
    // Group by category if available, otherwise group only by note
    const key = `${tx.category_id ?? 'uncategorized'}_${tx.notes.toLowerCase()}`;

    if (!map[key]) {
      map[key] = {
        notes: tx.notes,
        category_id: tx.category_id ?? null,
        category_name: category?.name ?? 'Uncategorized',
        icon: category?.icon ?? 'currency-inr',
        color: category?.color ?? '#4B7CF3',
        usage_count: 1,
        last_used: tx.date,
      };
    } else {
      map[key].usage_count++;

      if (new Date(tx.date) > new Date(map[key].last_used)) {
        map[key].last_used = tx.date;
      }
    }
  });

  return Object.values(map).sort((a, b) => {
    if (b.usage_count !== a.usage_count) {
      return b.usage_count - a.usage_count;
    }

    return new Date(b.last_used) - new Date(a.last_used);
  });
}

export async function getTransactionById(id) {
  const res = await executeSql('SELECT * FROM transactions WHERE id = ?', [id]);
  if (res.rows.length === 0) return null;
  return res.rows.item(0);
}