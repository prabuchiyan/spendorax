import { Platform } from 'react-native';
import { executeSql } from '../database/db';
import events from './events';
import { removeTransactionFromBill } from './bills';

async function refreshCreditCardBySource(sourceId) {
  if (!sourceId) return;
  try {
    const { getCreditCardBySourceId, refreshCreditCardTotals, syncCreditCardBillAmount } = require('./creditCards');
    const card = await getCreditCardBySourceId(sourceId);
    if (card) {
      await refreshCreditCardTotals(card.id);
      await syncCreditCardBillAmount(card.id);
    }
  } catch (e) {
    console.warn('Credit card refresh failed', e);
  }
}

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
  // Default to 1 (counted) if not explicitly passed
  const is_counted = tx.is_counted !== undefined ? (tx.is_counted ? 1 : 0) : 1;

  const res = await executeSql(
    `INSERT INTO transactions 
    (type, amount, category_id, source_id, date, notes, bill_id, transfer_group_id, direction, loan_id, loan_payment_type, principal_component, interest_component, outstanding_after_payment, linked_date, is_counted)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      type, amount, category_id || null, source_id || null,
      date || new Date().toISOString(), notes || null,
      bill_id || null, transfer_group_id || null, direction || null,
      loan_id, loan_payment_type, principal_component,
      interest_component, outstanding_after_payment, linked_date,
      is_counted
    ]
  );

  try { events.emit('transactionsChanged', { action: 'create', id: res.insertId }); } catch (e) { }
  await refreshCreditCardBySource(source_id || null);
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
  referenceDate = new Date(),
  onlyCounted = false
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
      // Exclude uncounted transactions from calculations when requested
      if (onlyCounted && row.is_counted === 0) return false;

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

export async function getTransactionsPaginated({
  limit = 20,
  offset = 0,
  searchQuery = '',
  filterType = 'all'
}) {
  try {
    if (Platform.OS === 'web') {
      const [txRes, catRes, srcRes] = await Promise.all([
        executeSql('SELECT * FROM transactions'),
        executeSql('SELECT * FROM categories'),
        executeSql('SELECT * FROM sources')
      ]);

      const transactions = [];
      for (let i = 0; i < txRes.rows.length; i++) transactions.push(txRes.rows.item(i));
      
      const categories = [];
      for (let i = 0; i < catRes.rows.length; i++) categories.push(catRes.rows.item(i));
      
      const sources = [];
      for (let i = 0; i < srcRes.rows.length; i++) sources.push(srcRes.rows.item(i));

      let result = transactions.map(t => ({
        ...t,
        category_name: categories.find(c => String(c.id) === String(t.category_id))?.name,
        source_name: sources.find(s => String(s.id) === String(t.source_id))?.name,
      }));

      if (filterType === 'expense') {
        result = result.filter(t => t.type === 'expense');
      } else if (filterType === 'income') {
        result = result.filter(t => t.type === 'income');
      } else if (filterType === 'transfer') {
        result = result.filter(t => t.type === 'transfer' || t.transfer_group_id !== null || t.is_transfer === 1);
      }

      if (searchQuery && searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        result = result.filter(t => {
          const notes = (t.notes || '').toLowerCase();
          const cat = (t.category_name || '').toLowerCase();
          const src = (t.source_name || '').toLowerCase();
          const amt = (t.amount || '').toString().toLowerCase();
          return notes.includes(q) || cat.includes(q) || src.includes(q) || amt.includes(q);
        });
      }

      result.sort((a, b) => {
        const dA = (a.date || '').replace(' ', 'T');
        const dB = (b.date || '').replace(' ', 'T');
        if (dA > dB) return -1;
        if (dA < dB) return 1;
        return b.id - a.id;
      });

      return result.slice(offset, offset + limit);
    }

    const params = [];
    const conditions = [];

    let query = `
      SELECT t.*,
             c.name as category_name,
             s.name as source_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN sources s ON t.source_id = s.id
    `;

    if (filterType === 'expense') {
      conditions.push(`t.type = 'expense'`);
    } else if (filterType === 'income') {
      conditions.push(`t.type = 'income'`);
    } else if (filterType === 'transfer') {
      conditions.push(`(t.type = 'transfer' OR t.transfer_group_id IS NOT NULL OR t.is_transfer = 1)`);
    }

    if (searchQuery && searchQuery.trim().length > 0) {
      const q = `%${searchQuery.trim()}%`;
      conditions.push(`(
        t.notes LIKE ? OR
        c.name LIKE ? OR
        s.name LIKE ? OR
        CAST(t.amount AS TEXT) LIKE ?
      )`);
      params.push(q, q, q, q);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY REPLACE(t.date, ' ', 'T') DESC, t.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const res = await executeSql(query, params);

    const rows = [];
    for (let i = 0; i < res.rows.length; i++) {
      rows.push(res.rows.item(i));
    }
    return rows;
  } catch (error) {
    console.error('getTransactionsPaginated error:', error);
    return [];
  }
}

export async function deleteTransaction(id) {
  // Query existing transaction before delete so we can refresh credit card totals.
  const txRes = await executeSql(
    `SELECT source_id FROM transactions WHERE id = ? LIMIT 1`,
    [id]
  );
  const existingTx = txRes.rows.length > 0 ? txRes.rows.item(0) : null;

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

  await refreshCreditCardBySource(existingTx?.source_id || null);
}

export async function updateTransaction(id, fields) {
  const txRes = await executeSql(
    `SELECT source_id FROM transactions WHERE id = ? LIMIT 1`,
    [id]
  );
  const existingTx = txRes.rows.length > 0 ? txRes.rows.item(0) : null;

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

  await refreshCreditCardBySource(existingTx?.source_id || null);
  if (fields.source_id !== undefined && fields.source_id !== existingTx?.source_id) {
    await refreshCreditCardBySource(fields.source_id);
  }
}

export async function createTransfer({
  fromAccount,
  toAccount,
  amount,
  note,
  date
}) {
  const groupId = Date.now().toString();

  // Debit Transaction
  const debitTransactionId = await createTransaction({
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

  // Credit Transaction
  const creditTransactionId = await createTransaction({
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

  return {
    groupId,
    debitTransactionId,
    creditTransactionId,
  };
}

export async function getTransactionNoteSuggestions() {
  if (Platform.OS === 'web') {
    const transactionsRes = await executeSql('SELECT * FROM transactions');
    const categoriesRes = await executeSql('SELECT * FROM categories');
    const categories = [];
    for (let i = 0; i < categoriesRes.rows.length; i++) {
      categories.push(categoriesRes.rows.item(i));
    }
    const map = {};
    for (let i = 0; i < transactionsRes.rows.length; i++) {
      const tx = transactionsRes.rows.item(i);
      if (!tx.notes || !tx.notes.trim()) continue;

      const category = categories.find(c => String(c.id) === String(tx.category_id));
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
    }
    return Object.values(map).sort((a, b) => {
      if (b.usage_count !== a.usage_count) return b.usage_count - a.usage_count;
      return new Date(b.last_used) - new Date(a.last_used);
    });
  }

  const query = `
    SELECT t.category_id, t.notes, MAX(t.date) as last_used, COUNT(*) as usage_count, c.name as category_name, c.icon, c.color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.notes IS NOT NULL AND t.notes != ''
    GROUP BY t.category_id, lower(t.notes)
    ORDER BY usage_count DESC, last_used DESC
  `;
  try {
    const res = await executeSql(query);
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) {
      const item = res.rows.item(i);
      rows.push({
        notes: item.notes,
        category_id: item.category_id,
        category_name: item.category_name || 'Uncategorized',
        icon: item.icon || 'currency-inr',
        color: item.color || '#4B7CF3',
        usage_count: item.usage_count,
        last_used: item.last_used
      });
    }
    return rows;
  } catch (error) {
    console.error('getTransactionNoteSuggestions SQL error:', error);
    return [];
  }
}

export async function getTransactionById(id) {
  const res = await executeSql('SELECT * FROM transactions WHERE id = ?', [id]);
  if (res.rows.length === 0) return null;
  return res.rows.item(0);
}

export async function getSourceTransactionBalances() {
  try {
    const result = await executeSql(`
      SELECT source_id, type, amount
      FROM transactions
      WHERE source_id IS NOT NULL
    `);
    const rows = result?.rows;
    const balanceMap = {};
    if (!rows || !Number.isFinite(rows.length)) {
      return balanceMap;
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows.item(i);
      if (
        row?.source_id === null ||
        row?.source_id === undefined
      ) {
        continue;
      }
      const sourceId = String(row.source_id);
      const amount = Number(row.amount || 0);
      if (!balanceMap[sourceId]) {
        balanceMap[sourceId] = 0;
      }
      const type = String(row.type || "").toLowerCase();
      if (type === "income") {
        balanceMap[sourceId] += amount;
      } else if (type === "expense") {
        balanceMap[sourceId] -= amount;
      }
    }
    return balanceMap;
  } catch (error) {
    console.error(
      "getSourceTransactionBalances error:",
      error,
    );

    return {};
  }
}

export async function getHomeExpenseTransactions(
  referenceDate = new Date()
) {
  try {
    const year = referenceDate.getFullYear();

    const month = String(
      referenceDate.getMonth() + 1
    ).padStart(2, "0");

    const monthKey = `${year}-${month}`;

    const res = await executeSql(
      `
      SELECT *
      FROM transactions
      WHERE type = ?
        AND transfer_group_id IS NULL
      ORDER BY id DESC
      `,
      ["expense"]
    );

    const rows = [];

    if (
      !res?.rows ||
      !Number.isFinite(res.rows.length)
    ) {
      return rows;
    }

    for (
      let i = 0;
      i < res.rows.length;
      i++
    ) {
      const row = res.rows.item(i);

      if (!row?.date) {
        continue;
      }

      // Ignore transactions explicitly marked as not counted.
      if (
        row.is_counted !== null &&
        row.is_counted !== undefined &&
        Number(row.is_counted) === 0
      ) {
        continue;
      }

      const txMonth = String(row.date)
        .replace(" ", "T")
        .substring(0, 7);

      if (txMonth !== monthKey) {
        continue;
      }

      // Extra protection for transfer transactions.
      if (
        row.direction &&
        String(row.direction).toLowerCase() ===
        "transfer"
      ) {
        continue;
      }

      rows.push(row);
    }

    return rows;
  } catch (error) {
    console.error(
      "getHomeExpenseTransactions error:",
      error
    );

    return [];
  }
}

export async function getAllTransactionsByYears(years = 3) {
  try {
    console.log('🔥 getAllTransactionsByYears INPUT:', years);
    console.log('🔥 INPUT TYPE:', typeof years);

    const normalizedYears = Math.max(1, Number(years) || 3);

    console.log('🔥 NORMALIZED YEARS:', normalizedYears);

    const cutoffDate = new Date();
    cutoffDate.setHours(0, 0, 0, 0);
    cutoffDate.setFullYear(
      cutoffDate.getFullYear() - normalizedYears
    );

    const cutoffDateString = cutoffDate.toISOString();

    console.log('🔥 CUTOFF DATE:', cutoffDateString);

    const query = `
      SELECT *
      FROM transactions
      WHERE date >= ?
      ORDER BY date DESC, id DESC
    `;

    const res = await executeSql(query, [cutoffDateString]);

    const rows = new Array(res.rows.length);

    for (let i = 0; i < res.rows.length; i++) {
      rows[i] = res.rows.item(i);
    }

    console.log(
      `🔥 RESULT: ${rows.length} transactions for ${normalizedYears} years`
    );

    return rows;
  } catch (error) {
    console.error('getAllTransactionsByYears error:', error);
    return [];
  }
}

export async function getCategoryAndSourceUsage(years = 1) {
  if (Platform.OS === 'web') {
    const transactions = await getAllTransactionsByYears(years);
    const categoryCount = {};
    const sourceCount = {};
    (transactions || []).forEach((txn) => {
      // Category usage
      if (txn.category_id && txn.type !== "transfer") {
        const categoryKey = String(txn.category_id);
        categoryCount[categoryKey] =
          (categoryCount[categoryKey] || 0) + 1;
      }
      // Source usage
      if (txn.source_id) {
        const sourceKey = String(txn.source_id);
        sourceCount[sourceKey] = (sourceCount[sourceKey] || 0) + 1;
      }
    });
    return { categoryCount, sourceCount };
  }

  try {
    const normalizedYears = Math.max(1, Number(years) || 1);
    const cutoffDate = new Date();
    cutoffDate.setHours(0, 0, 0, 0);
    cutoffDate.setFullYear(cutoffDate.getFullYear() - normalizedYears);
    const cutoffDateString = cutoffDate.toISOString();

    const [catRes, srcRes] = await Promise.all([
      executeSql(`
        SELECT category_id, COUNT(*) as count 
        FROM transactions 
        WHERE type != 'transfer' AND date >= ? AND category_id IS NOT NULL 
        GROUP BY category_id
      `, [cutoffDateString]),
      executeSql(`
        SELECT source_id, COUNT(*) as count 
        FROM transactions 
        WHERE date >= ? AND source_id IS NOT NULL 
        GROUP BY source_id
      `, [cutoffDateString])
    ]);

    const categoryCount = {};
    for(let i=0; i<catRes.rows.length; i++) {
      categoryCount[String(catRes.rows.item(i).category_id)] = catRes.rows.item(i).count;
    }

    const sourceCount = {};
    for(let i=0; i<srcRes.rows.length; i++) {
      sourceCount[String(srcRes.rows.item(i).source_id)] = srcRes.rows.item(i).count;
    }

    return { categoryCount, sourceCount };
  } catch (error) {
    console.error('getCategoryAndSourceUsage error:', error);
    return { categoryCount: {}, sourceCount: {} };
  }
}

export async function getTransactionsByDateRange(categoryId, startDateStr, endDateStr) {
  try {
    if (Platform.OS === 'web') {
      const res = await executeSql('SELECT * FROM transactions');
      const rows = [];
      for (let i = 0; i < res.rows.length; i++) {
        rows.push(res.rows.item(i));
      }
      
      const filtered = rows.filter(tx => {
        if (categoryId && Number(tx.category_id) !== Number(categoryId)) return false;
        if (!tx.date) return false;
        const dStr = String(tx.date).replace(' ', 'T');
        if (startDateStr && dStr < startDateStr) return false;
        if (endDateStr && dStr > endDateStr) return false;
        return true;
      });
      
      filtered.sort((a, b) => {
        const dA = String(a.date).replace(' ', 'T');
        const dB = String(b.date).replace(' ', 'T');
        if (dA > dB) return -1;
        if (dA < dB) return 1;
        return b.id - a.id;
      });
      
      return filtered;
    }

    const params = [];
    let query = `SELECT * FROM transactions WHERE 1=1`;

    if (categoryId) {
      query += ` AND category_id = ?`;
      params.push(Number(categoryId));
    }

    if (startDateStr) {
      query += ` AND REPLACE(date, ' ', 'T') >= ?`;
      params.push(startDateStr);
    }

    if (endDateStr) {
      query += ` AND REPLACE(date, ' ', 'T') <= ?`;
      params.push(endDateStr);
    }

    query += ` ORDER BY REPLACE(date, ' ', 'T') DESC, id DESC`;

    const res = await executeSql(query, params);
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) {
      rows.push(res.rows.item(i));
    }
    return rows;
  } catch (error) {
    console.error('getTransactionsByDateRange error:', error);
    return [];
  }
}