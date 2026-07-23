import { executeSql } from '../database/db';
import { createTransaction, getTransactions } from './transactions';
import { emit } from './events';
import {
  BILL_STATUS,
  addRecurrence,
  computeBillStatus,
  todayStr,
  daysBetween,
  monthKey,
  generateOccurrenceDates,
  getMissingOccurrenceDates,
} from './billUtils';

function rowsToArray(res) {
  const rows = [];
  for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
  return rows;
}

function normalizeBill(row) {
  if (!row || row.deleted_at) return null;
  const status = computeBillStatus(row);
  return { ...row, status, is_paid: status === BILL_STATUS.PAID ? 1 : 0 };
}

function nowIso() {
  return new Date().toISOString();
}

function emitBillsChanged() {
  emit('billsChanged');
}

async function fetchAllBillsRaw() {
  const res = await executeSql(`SELECT * FROM bills`, []);
  return rowsToArray(res).filter((r) => !r.deleted_at);
}

export async function syncBillStatuses() {
  const today = todayStr();
  const rows = await fetchAllBillsRaw();
  for (const bill of rows) {
    const status = computeBillStatus(bill, today);
    if (status !== bill.status && status !== BILL_STATUS.SKIPPED && status !== BILL_STATUS.PAID) {
      await executeSql(
        `UPDATE bills SET status = ?, updated_at = ? WHERE id = ?`,
        [status, nowIso(), bill.id]
      );
    }
  }
}

export async function createBill({
  name,
  amount = 0,
  due_date = null,
  status = BILL_STATUS.PENDING,
  is_recurring = 0,
  recurrence_type = null,
  recurrence_interval = 1,
  recurrence_end_date = null,
  category_id = null,
  source_id = null,
  reminder_days_before = 2,
  auto_pay = 0,
  notes = null,
  attachment_url = null,
  paid_at = null,
  is_paid = 0,
  linked_transaction_id = null,
  // NEW: parent_bill_id links occurrence rows back to the template
  parent_bill_id = null,
}) {
  const ts = nowIso();
  const res = await executeSql(
    `INSERT INTO bills (
      name, amount, due_date, status, is_recurring, recurrence_type, recurrence_interval,
      recurrence_end_date, category_id, source_id, reminder_days_before, auto_pay,
      notes, attachment_url, paid_at, is_paid, linked_transaction_id,
      parent_bill_id, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      name,
      amount,
      due_date,
      status,
      is_recurring ? 1 : 0,
      recurrence_type,
      recurrence_interval || 1,
      recurrence_end_date,
      category_id,
      source_id,
      reminder_days_before ?? 2,
      auto_pay ? 1 : 0,
      notes,
      attachment_url,
      paid_at,
      is_paid ? 1 : 0,
      linked_transaction_id,
      parent_bill_id,
      ts,
      ts,
    ]
  );
  emitBillsChanged();
  return res.insertId;
}

export async function getBillById(id) {
  const res = await executeSql(`SELECT * FROM bills WHERE id = ?`, [id]);
  if (!res.rows.length) return null;
  return normalizeBill(res.rows.item(0));
}

/**
 * Returns all occurrence rows for a given template bill (parent_bill_id = id),
 * including the template itself as the first occurrence if it has a due_date.
 * Also backfills any missing occurrences up to today before returning.
 */
export async function getBillSeries(templateId) {
  const template = await getBillById(templateId);
  if (!template) return [];

  // If not recurring, just return the single bill
  if (!template.is_recurring || !template.recurrence_type) {
    return [template].filter(Boolean);
  }

  // Ensure parent_bill_id is set on the template itself (idempotent)
  // We treat the template row as the "first occurrence" if its due_date matches
  // the first generated date.

  // Fetch all children
  const childRes = await executeSql(
    `SELECT * FROM bills WHERE parent_bill_id = ? AND deleted_at IS NULL ORDER BY due_date ASC`,
    [templateId]
  );
  const children = rowsToArray(childRes).map(normalizeBill).filter(Boolean);

  // Backfill missing occurrences
  const allExpected = generateOccurrenceDates(template);
  // The template itself covers the first date — treat it as an existing row
  const allExisting = [template, ...children];
  const missing = getMissingOccurrenceDates(allExpected, allExisting);

  for (const dueDate of missing) {
    // Skip the template's own due_date
    if (dueDate === template.due_date?.slice(0, 10)) continue;
    await createBill({
      name: template.name,
      amount: template.amount,
      due_date: dueDate,
      is_recurring: 0, // occurrences are not themselves recurring
      recurrence_type: null,
      category_id: template.category_id,
      source_id: template.source_id,
      reminder_days_before: template.reminder_days_before,
      auto_pay: template.auto_pay,
      notes: template.notes,
      attachment_url: template.attachment_url,
      parent_bill_id: templateId,
    });
  }

  // Re-fetch children after backfill
  const childRes2 = await executeSql(
    `SELECT * FROM bills WHERE parent_bill_id = ? AND deleted_at IS NULL ORDER BY due_date ASC`,
    [templateId]
  );
  const freshChildren = rowsToArray(childRes2).map(normalizeBill).filter(Boolean);

  // Combine template + children sorted by due_date descending (most recent first)
  const all = [template, ...freshChildren].sort((a, b) => {
    const ad = a.due_date || '';
    const bd = b.due_date || '';
    return bd.localeCompare(ad); // newest first
  });

  return all;
}

/**
 * For the main bills list: returns one "current" bill per recurring series.
 * - For recurring bills, finds/creates the current-month occurrence and returns it.
 * - For non-recurring bills, returns as-is.
 * This ensures the main list always shows the current month's due.
 */
export async function getBillsForCurrentMonth(options = {}) {
  await syncBillStatuses();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Fetch only template bills (no parent) — these are the "series roots"
  const res = await executeSql(
    `SELECT * FROM bills WHERE parent_bill_id IS NULL AND deleted_at IS NULL`,
    []
  );
  const templates = rowsToArray(res).filter((r) => !r.deleted_at);

  const result = [];

  for (const tmpl of templates) {
    if (!tmpl.is_recurring || !tmpl.recurrence_type) {
      // Non-recurring: include as-is
      const normalized = normalizeBill(tmpl);
      if (normalized) result.push(normalized);
      continue;
    }

    // Find the occurrence for the current month
    const allDates = generateOccurrenceDates(tmpl);
    const thisMonthDate = allDates.find((d) => {
      const dt = new Date(d);
      return dt.getFullYear() === year && dt.getMonth() === month;
    });

    if (!thisMonthDate) {
      // No occurrence this month (e.g. recurrence ended before now)
      // Still show template so user is aware, but skip if ended
      if (tmpl.recurrence_end_date && tmpl.recurrence_end_date.slice(0, 10) < todayStr()) continue;
      const normalized = normalizeBill(tmpl);
      if (normalized) result.push(normalized);
      continue;
    }

    // Check if a row already exists for this month
    let occurrenceRow = null;

    if (tmpl.due_date?.slice(0, 10) === thisMonthDate) {
      // Template itself is this month's occurrence
      occurrenceRow = normalizeBill(tmpl);
    } else {
      // Look for a child row
      const childRes = await executeSql(
        `SELECT * FROM bills WHERE parent_bill_id = ? AND due_date LIKE ? AND deleted_at IS NULL LIMIT 1`,
        [tmpl.id, `${thisMonthDate.slice(0, 7)}%`]
      );
      if (childRes.rows.length) {
        occurrenceRow = normalizeBill(childRes.rows.item(0));
      } else {
        // Create the missing occurrence
        const newId = await createBill({
          name: tmpl.name,
          amount: tmpl.amount,
          due_date: thisMonthDate,
          is_recurring: 0,
          recurrence_type: null,
          category_id: tmpl.category_id,
          source_id: tmpl.source_id,
          reminder_days_before: tmpl.reminder_days_before,
          auto_pay: tmpl.auto_pay,
          notes: tmpl.notes,
          attachment_url: tmpl.attachment_url,
          parent_bill_id: tmpl.id,
        });
        occurrenceRow = normalizeBill(await getBillById(newId));
      }
    }

    if (occurrenceRow) {
      // Attach template info so the card can show the series name / navigate correctly
      result.push({
        ...occurrenceRow,
        _templateId: tmpl.id,
        _isRecurringSeries: true,
      });
    }
  }

  // Apply filters from options
  let filtered = result.filter(Boolean);

  if (options.status && options.status !== 'all') {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    filtered = filtered.filter((b) => statuses.includes(b.status));
  }
  if (options.category_id) {
    filtered = filtered.filter((b) => b.category_id === options.category_id);
  }

  // Sort
  const sortBy = options.sortBy || 'due_date';
  const dir = options.sortDir === 'desc' ? -1 : 1;
  filtered.sort((a, b) => {
    if (sortBy === 'amount') return (Number(a.amount) - Number(b.amount)) * dir;
    const ad = a.due_date || '9999-12-31';
    const bd = b.due_date || '9999-12-31';
    if (ad < bd) return -1 * dir;
    if (ad > bd) return 1 * dir;
    return (a.name || '').localeCompare(b.name || '') * dir;
  });

  return filtered;
}

export async function getBills({
  status = null,
  category_id = null,
  sortBy = 'due_date',
  sortDir = 'asc',
  includeSkipped = true,
} = {}) {
  await syncBillStatuses();
  let rows = (await fetchAllBillsRaw()).map(normalizeBill).filter(Boolean);

  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    rows = rows.filter((b) => statuses.includes(b.status));
  }
  if (category_id) rows = rows.filter((b) => b.category_id === category_id);
  if (!includeSkipped) rows = rows.filter((b) => b.status !== BILL_STATUS.SKIPPED);

  const dir = sortDir === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    if (sortBy === 'amount') {
      return (Number(a.amount) - Number(b.amount)) * dir;
    }
    const ad = a.due_date || '9999-12-31';
    const bd = b.due_date || '9999-12-31';
    if (ad < bd) return -1 * dir;
    if (ad > bd) return 1 * dir;
    return (a.name || '').localeCompare(b.name || '') * dir;
  });
  return rows;
}

export async function getBillsSummary() {
  await syncBillStatuses();
  const today = todayStr();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const mk = monthKey(year, month);
  const todayDate = new Date();

  const rows = (await fetchAllBillsRaw()).map(normalizeBill).filter(Boolean);
  const active = rows.filter((b) => b.status !== BILL_STATUS.SKIPPED);

  const thisMonth = active.filter((b) => {
    if (!b.due_date) return false;
    const d = new Date(b.due_date.slice(0, 10));
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const totalThisMonth = thisMonth.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalPaid = thisMonth
    .filter((b) => b.status === BILL_STATUS.PAID)
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const overdueAmount = active
    .filter((b) => b.status === BILL_STATUS.OVERDUE)
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  const upcomingAndPendingDueAmt = active
    .filter((b) => {
      if (b.is_paid) return false;
      const due = new Date(b.due_date);
      const now = new Date();
      return (
        due.getFullYear() === now.getFullYear() &&
        due.getMonth() === now.getMonth()
      );
    })
    .reduce(
      (acc, b) => {
        acc.totalAmount += Number(b.amount || 0);
        acc.count += 1;
        return acc;
      },
      { totalAmount: 0, count: 0 }
    );

  const upcoming7 = active
    .filter((b) => {
      if (b.status === BILL_STATUS.PAID || b.status === BILL_STATUS.SKIPPED) return false;
      const days = daysBetween(today, b.due_date);
      return days !== null && days >= 0 && days <= 7;
    })
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  const upcoming3 = active.filter((b) => {
    if (b.status === BILL_STATUS.PAID || b.status === BILL_STATUS.SKIPPED) return false;
    const days = daysBetween(today, b.due_date);
    return days !== null && days >= 0 && days <= 3;
  });

  const dueThisMonthCount = active.filter((b) => {
    if (b.status === BILL_STATUS.PAID || b.status === BILL_STATUS.SKIPPED) return false;
    if (!b.due_date) return false;

    const due = new Date(b.due_date);
    if (isNaN(due.getTime())) return false;

    return (
      due.getMonth() === todayDate.getMonth() &&
      due.getFullYear() === todayDate.getFullYear()
    );
  }).length;

  const dueThisMonthAmount = active
    .filter((b) => {
      if (b.status === BILL_STATUS.PAID || b.status === BILL_STATUS.SKIPPED) return false;
      if (!b.due_date) return false;

      const due = new Date(b.due_date);
      if (isNaN(due.getTime())) return false;

      return (
        due.getMonth() === todayDate.getMonth() &&
        due.getFullYear() === todayDate.getFullYear()
      );
    })
    .reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const overdueCount = active.filter((b) => b.status === BILL_STATUS.OVERDUE).length;

  return {
    month: mk,
    totalThisMonth,
    totalPaid,
    overdueAmount,
    upcoming7,
    upcoming3Count: upcoming3.length,
    dueThisMonthCount,
    dueThisMonthAmount,
    overdueCount,
    pendingCount: active.filter((b) => b.status === BILL_STATUS.PENDING).length,
    upcomingAndPendingDueAmt
  };
}

export async function getBillInsights() {
  await syncBillStatuses();
  const today = todayStr();
  const rows = (await fetchAllBillsRaw()).map(normalizeBill).filter(Boolean);
  const active = rows.filter((b) => b.status !== BILL_STATUS.SKIPPED);

  const recurringMonthly = active
    .filter((b) => b.is_recurring)
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  const upcoming5to7 = active.filter((b) => {
    if (b.status === BILL_STATUS.PAID) return false;
    const days = daysBetween(today, b.due_date);
    return days !== null && days >= 0 && days <= 7;
  });

  const byCategory = {};
  for (const b of active) {
    const cid = b.category_id || 0;
    byCategory[cid] = (byCategory[cid] || 0) + Number(b.amount || 0);
  }
  let topCategoryId = null;
  let topCategoryAmount = 0;
  for (const [cid, amt] of Object.entries(byCategory)) {
    if (amt > topCategoryAmount) {
      topCategoryId = Number(cid);
      topCategoryAmount = amt;
    }
  }

  return {
    recurringMonthlyTotal: recurringMonthly,
    upcomingDues: upcoming5to7,
    topCategoryId,
    topCategoryAmount,
  };
}

async function billExistsForDate(name, dueDate, excludeId = null) {
  const rows = await fetchAllBillsRaw();
  return rows.some(
    (b) =>
      b.name === name &&
      b.due_date?.slice(0, 10) === dueDate?.slice(0, 10) &&
      b.id !== excludeId
  );
}

export async function generateNextRecurringBill(bill) {
  if (!bill.is_recurring || !bill.recurrence_type) return null;

  const interval = bill.recurrence_interval || 1;
  const nextDue = addRecurrence(bill.due_date, bill.recurrence_type, interval);
  if (!nextDue) return null;

  if (bill.recurrence_end_date && nextDue > bill.recurrence_end_date.slice(0, 10)) {
    return null;
  }

  const exists = await billExistsForDate(bill.name, nextDue);
  if (exists) return null;

  // New occurrence references the template (or itself if it is the template)
  const parentId = bill.parent_bill_id || bill.id;

  const id = await createBill({
    name: bill.name,
    amount: bill.amount,
    due_date: nextDue,
    is_recurring: 0,
    recurrence_type: null,
    recurrence_interval: interval,
    recurrence_end_date: bill.recurrence_end_date,
    category_id: bill.category_id,
    source_id: bill.source_id,
    reminder_days_before: bill.reminder_days_before ?? 2,
    auto_pay: bill.auto_pay,
    notes: bill.notes,
    attachment_url: bill.attachment_url,
    parent_bill_id: parentId,
  });
  return id;
}

/**
 * Mark a bill paid.
 * @param {number} billId
 * @param {object} opts
 * @param {number|null}  opts.source_id
 * @param {string|null}  opts.date
 * @param {string}       opts.notes
 * @param {boolean}      opts.createTransaction  - if false, skip creating a new tx
 * @param {number|null}  opts.existingTransactionId - link to an already-existing transaction instead
 */
export async function markBillPaid(
  billId,
  {
    source_id = null,
    date = null,
    notes = 'Bill payment',
    createTransaction: shouldCreateTx = true,
    existingTransactionId = null,
  } = {}
) {
  const bill = await getBillById(billId);
  if (!bill) throw new Error('Bill not found');
  if (bill.status === BILL_STATUS.PAID) return bill.linked_transaction_id;

  const paySource = source_id ?? bill.source_id;
  const payDate = date || new Date().toISOString();
  const paidAt = nowIso();

  let txId = existingTransactionId || bill.linked_transaction_id;

  if (!txId && shouldCreateTx) {
    txId = await createTransaction({
      type: 'expense',
      amount: bill.amount,
      category_id: bill.category_id,
      source_id: paySource,
      date: payDate,
      notes: notes || `Paid: ${bill.name}`,
      bill_id: billId,
    });
  }

  await executeSql(
    `UPDATE bills SET status = ?, is_paid = ?, paid_at = ?, linked_transaction_id = ?, updated_at = ? WHERE id = ?`,
    [BILL_STATUS.PAID, 1, paidAt, txId, paidAt, billId]
  );

  // For recurring series: the template handles next-gen; occurrences don't
  if (bill.is_recurring) {
    await generateNextRecurringBill(bill);
  }

  emitBillsChanged();
  return txId;
}

/**
 * Fetch transactions that are candidates to link to a bill.
 * Filters by category_id and/or amount to narrow the picker.
 */
export async function getTransactionsForBillLink(bill) {
  try {
    const dueDateStr = bill.due_date ? bill.due_date.slice(0, 7) : null; // YYYY-MM

    // Pull recent expense transactions — fetch broadly and filter in JS
    const res = await executeSql(
      `SELECT * FROM transactions
       WHERE type = 'expense'
         AND (bill_id IS NULL OR bill_id = ?)
       ORDER BY date DESC
       LIMIT 200`,
      [bill.id]
    );
    let rows = rowsToArray(res);

    // Prefer same category
    const sameCategory = rows.filter((t) => t.category_id === bill.category_id);
    const others = rows.filter((t) => t.category_id !== bill.category_id);
    rows = [...sameCategory, ...others];

    // Filter by month if we have a due date
    if (dueDateStr) {
      const sameMonth = rows.filter(
        (t) => t.date && String(t.date).startsWith(dueDateStr)
      );
      // If any same-month matches exist prefer them, otherwise show all
      if (sameMonth.length > 0) rows = sameMonth;
    }

    return rows.slice(0, 50);
  } catch (e) {
    console.warn('getTransactionsForBillLink error', e);
    return [];
  }
}

export async function skipBill(billId) {
  const bill = await getBillById(billId);
  if (!bill) throw new Error('Bill not found');

  await executeSql(
    `UPDATE bills SET status = ?, updated_at = ? WHERE id = ?`,
    [BILL_STATUS.SKIPPED, nowIso(), billId]
  );

  if (bill.is_recurring) {
    await generateNextRecurringBill(bill);
  }

  emitBillsChanged();
}

export async function runRecurringScheduler() {
  await syncBillStatuses();
  const today = todayStr();
  const rows = await fetchAllBillsRaw();

  for (const bill of rows) {
    if (!bill.is_recurring) continue;

    const status = computeBillStatus(bill, today);
    const duePassed = bill.due_date && bill.due_date.slice(0, 10) <= today;

    if (duePassed && (status === BILL_STATUS.PAID || status === BILL_STATUS.SKIPPED)) {
      await generateNextRecurringBill({ ...bill, status });
    }
  }
}

export async function processReminders() {
  await syncBillStatuses();
  const today = todayStr();
  const rows = (await fetchAllBillsRaw()).map(normalizeBill).filter(Boolean);
  const due = [];

  for (const bill of rows) {
    if (bill.status === BILL_STATUS.PAID || bill.status === BILL_STATUS.SKIPPED) continue;
    if (!bill.due_date) continue;

    const days = daysBetween(today, bill.due_date);
    const remindBefore = bill.reminder_days_before ?? 2;
    if (days === null || days < 0 || days > remindBefore) continue;

    const lastReminded = bill.last_reminded_at?.slice(0, 10);
    if (lastReminded === today) continue;

    const remindedAt = nowIso();
    await executeSql(
      `UPDATE bills SET last_reminded_at = ?, updated_at = ? WHERE id = ?`,
      [remindedAt, remindedAt, bill.id]
    );
    due.push({ bill, daysUntilDue: days });
  }

  return due;
}

export async function updateBill(id, fields) {
  const existing = await getBillById(id);
  if (!existing) throw new Error('Bill not found');

  const merged = {
    name: fields.name ?? existing.name,
    amount: fields.amount ?? existing.amount,
    due_date: fields.due_date !== undefined ? fields.due_date : existing.due_date,
    status: fields.status ?? existing.status,
    is_recurring: fields.is_recurring !== undefined ? (fields.is_recurring ? 1 : 0) : existing.is_recurring,
    recurrence_type: fields.recurrence_type !== undefined ? fields.recurrence_type : existing.recurrence_type,
    recurrence_interval: fields.recurrence_interval ?? existing.recurrence_interval ?? 1,
    recurrence_end_date: fields.recurrence_end_date !== undefined ? fields.recurrence_end_date : existing.recurrence_end_date,
    category_id: fields.category_id !== undefined ? fields.category_id : existing.category_id,
    source_id: fields.source_id !== undefined ? fields.source_id : existing.source_id,
    reminder_days_before: fields.reminder_days_before ?? existing.reminder_days_before ?? 2,
    auto_pay: fields.auto_pay !== undefined ? (fields.auto_pay ? 1 : 0) : existing.auto_pay,
    notes: fields.notes !== undefined ? fields.notes : existing.notes,
    attachment_url: fields.attachment_url !== undefined ? fields.attachment_url : existing.attachment_url,
    is_paid: fields.is_paid !== undefined ? (fields.is_paid ? 1 : 0) : existing.is_paid,
    paid_at: fields.paid_at !== undefined ? fields.paid_at : existing.paid_at,
    last_reminded_at: fields.last_reminded_at !== undefined ? fields.last_reminded_at : existing.last_reminded_at,
    linked_transaction_id: fields.linked_transaction_id !== undefined ? fields.linked_transaction_id : existing.linked_transaction_id,
  };

  const updatedAt = nowIso();
  await executeSql(
    `UPDATE bills SET name = ?, amount = ?, due_date = ?, status = ?, is_recurring = ?, recurrence_type = ?,
      recurrence_interval = ?, recurrence_end_date = ?, category_id = ?, source_id = ?,
      reminder_days_before = ?, auto_pay = ?, notes = ?, attachment_url = ?, is_paid = ?,
      paid_at = ?, last_reminded_at = ?, linked_transaction_id = ?, updated_at = ? WHERE id = ?`,
    [
      merged.name,
      merged.amount,
      merged.due_date,
      merged.status,
      merged.is_recurring,
      merged.recurrence_type,
      merged.recurrence_interval,
      merged.recurrence_end_date,
      merged.category_id,
      merged.source_id,
      merged.reminder_days_before,
      merged.auto_pay,
      merged.notes,
      merged.attachment_url,
      merged.is_paid,
      merged.paid_at,
      merged.last_reminded_at,
      merged.linked_transaction_id,
      updatedAt,
      id,
    ]
  );
  emitBillsChanged();
}

export async function deleteBill(id) {
  const ts = nowIso();
  await executeSql(
    `UPDATE bills SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [ts, ts, id]
  );
  emitBillsChanged();
}

export async function runBillMaintenance() {
  await syncBillStatuses();
  await runRecurringScheduler();
  return processReminders();
}

export default {
  createBill,
  getBills,
  getBillById,
  getBillSeries,
  getBillsForCurrentMonth,
  getBillsSummary,
  getBillInsights,
  markBillPaid,
  getTransactionsForBillLink,
  skipBill,
  updateBill,
  deleteBill,
  runRecurringScheduler,
  processReminders,
  runBillMaintenance,
  syncBillStatuses,
};
