import { Platform } from 'react-native';
import { executeSql } from '../database/db';
import { createTransaction, createTransfer } from './transactions';
import { emit } from './events';
import {
  BILL_STATUS,
  computeBillStatus,
  todayStr,
  daysBetween,
  monthKey,
  generateOccurrenceDates,
} from './billUtils';

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function nowIso() { return new Date().toISOString(); }
function emitBillsChanged() { emit('billsChanged'); }

async function fetchAllBillsRaw() {
  const res = await executeSql(`SELECT * FROM bills`, []);
  return rowsToArray(res).filter(r => !r.deleted_at);
}

// ─── bill_linked_transactions ─────────────────────────────────────────────────

export async function createBillLinkedTransactionsTable() {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS bill_linked_transactions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id        INTEGER NOT NULL,
      transaction_id INTEGER NOT NULL,
      linked_at      TEXT DEFAULT (datetime('now')),
      UNIQUE(bill_id, transaction_id)
    )
  `);
}

export async function addTransactionToBill(billId, transactionId) {
  try {
    await executeSql(
      `INSERT OR IGNORE INTO bill_linked_transactions (bill_id, transaction_id) VALUES (?, ?)`,
      [billId, transactionId]
    );

    const res = await executeSql(
      `SELECT * FROM bill_linked_transactions WHERE bill_id = ?`,
      [billId]
    );
  } catch (e) {
    console.log(e);
  }
}

export async function removeTransactionFromBill(billId, transactionId) {
  await executeSql(
    `DELETE FROM bill_linked_transactions
     WHERE bill_id = ? AND transaction_id = ?`,
    [billId, transactionId]
  );

  // Any links remaining?
  const remaining = rowsToArray(
    await executeSql(
      `SELECT * FROM bill_linked_transactions
       WHERE bill_id = ?`,
      [billId]
    )
  );
  // No linked transactions left -> reset bill status
  if (remaining.length === 0) {
    await executeSql(
      `UPDATE bills
     SET
       status = ?,
       is_paid = ?,
       linked_transaction_id = NULL,
       paid_at = NULL,
       updated_at = ?
     WHERE id = ?`,
      [
        BILL_STATUS.PENDING,
        0,
        nowIso(),
        billId,
      ]
    );
  }
}

export async function getBillLinkedTransactions(billId) {
  try {
    const res = await executeSql(
      `SELECT t.*, s.name as source_name, c.name as category_name,
              c.icon as category_icon, c.color as category_color
       FROM bill_linked_transactions blt
       JOIN transactions t ON t.id = blt.transaction_id
       LEFT JOIN sources s ON s.id = t.source_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE blt.bill_id = ?
       ORDER BY t.date DESC`,
      [billId]
    );
    return rowsToArray(res);
  } catch (e) {
    // Web fallback (localStorage executeSql doesn't support JOIN)
    const links = rowsToArray(
      await executeSql(
        `SELECT * FROM bill_linked_transactions WHERE bill_id = ?`,
        [billId]
      )
    );

    const transactions = rowsToArray(
      await executeSql(`SELECT * FROM transactions`, [])
    );

    const sources = rowsToArray(
      await executeSql(`SELECT * FROM sources`, [])
    );

    const categories = rowsToArray(
      await executeSql(`SELECT * FROM categories`, [])
    );

    return links
      .map(link => {
        const tx = transactions.find(t => t.id == link.transaction_id);
        if (!tx) return null;

        return {
          ...tx,
          source_name: sources.find(s => s.id == tx.source_id)?.name,
          category_name: categories.find(c => c.id == tx.category_id)?.name,
          category_icon: categories.find(c => c.id == tx.category_id)?.icon,
          category_color: categories.find(c => c.id == tx.category_id)?.color,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}

export async function getBillsForTransaction(transactionId) {
  try {
    const res = await executeSql(
      `SELECT
        b.id,
        b.name,
        b.amount,
        b.due_date,
        b.status,
        b.is_paid,
        b.is_recurring,
        b.recurrence_type,
        b.category_id,
        b.source_id,
        b.notes,
        b.reminder_days_before,
        b.auto_pay,
        b.attachment_url,
        b.linked_transaction_id,
        b.created_at,
        b.updated_at,
        b.deleted_at
       FROM bill_linked_transactions blt
       JOIN bills b ON b.id = blt.bill_id
       WHERE blt.transaction_id = ? AND b.deleted_at IS NULL`,
      [transactionId]
    );
    return rowsToArray(res).map(normalizeBill).filter(Boolean);
  } catch (e) {
    return [];
  }
}

// ─── core createBill (internal, no backfill) ──────────────────────────────────

/**
 * Low-level insert — used internally by backfillBillOccurrences.
 * Never triggers another backfill (_skipBackfill is always true here).
 */
// ─── core createBill (internal, no backfill) ──────────────────────────────────

/**
 * Low-level insert.
 *
 * recurrence_occurrence_key is the stable identity of a recurring occurrence.
 *
 * Examples:
 *   YEARLY  -> 2026
 *   MONTHLY -> 2026-09
 *   DAILY   -> 2026-09-20
 *
 * IMPORTANT:
 * The key does NOT change when the user edits due_date.
 */
async function _insertBill({
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
  parent_bill_id = null,
  recurrence_occurrence_key = null,
  recurrence_effective_date = null,
}) {
  const ts = nowIso();
  const res = await executeSql(
    `INSERT INTO bills (
      name,
      amount,
      due_date,
      status,
      is_recurring,
      recurrence_type,
      recurrence_interval,
      recurrence_end_date,
      category_id,
      source_id,
      reminder_days_before,
      auto_pay,
      notes,
      attachment_url,
      paid_at,
      is_paid,
      linked_transaction_id,
      parent_bill_id,
      recurrence_occurrence_key,
      recurrence_effective_date,
      created_at,
      updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      recurrence_occurrence_key,
      recurrence_effective_date,
      ts,
      ts,
    ]
  );
  return res.insertId;
}

// ─── recurring occurrence migration ───────────────────────────────────────────

let recurrenceColumnReady = false;

async function ensureRecurringOccurrenceColumn() {
  if (recurrenceColumnReady) return;
  try {
    await executeSql(
      `ALTER TABLE bills
       ADD COLUMN recurrence_occurrence_key TEXT`,
      []
    );
  } catch (e) {
    // Column already exists.
  }

  // New column:
  // Defines when the CURRENT recurrence rule became effective.
  //
  // Example:
  // Monthly: 2024-01-01
  // Changed to yearly: 2026-01-01
  //
  // Existing monthly occurrences before this date remain untouched.
  try {
    await executeSql(
      `ALTER TABLE bills
       ADD COLUMN recurrence_effective_date TEXT`,
      []
    );
  } catch (e) {
    // Column already exists.
  }

  recurrenceColumnReady = true;
}

/**
 * Returns the stable identity for a recurring occurrence.
 *
 * YEARLY:
 *   2026
 *
 * MONTHLY:
 *   2026-09
 *
 * WEEKLY:
 *   Uses the generated occurrence date.
 *
 * DAILY:
 *   2026-09-20
 *
 * The key represents the recurrence occurrence,
 * NOT the editable bill due date.
 */
function getRecurrenceOccurrenceKey(
  recurrenceType,
  occurrenceDate,
  recurrenceInterval = 1
) {
  if (!occurrenceDate) return null;

  const date = String(occurrenceDate).slice(0, 10);

  if (!date || date.length < 10) return null;

  const type = String(recurrenceType || '').toLowerCase();

  const year = date.slice(0, 4);
  const month = date.slice(0, 7);

  if (
    type === 'yearly' ||
    type === 'year' ||
    type === 'annual'
  ) {
    return year;
  }

  if (
    type === 'monthly' ||
    type === 'month'
  ) {
    return month;
  }

  if (
    type === 'weekly' ||
    type === 'week'
  ) {
    // Generated date is the occurrence identity.
    return `W:${date}`;
  }

  if (
    type === 'daily' ||
    type === 'day'
  ) {
    return date;
  }

  // Fallback for custom recurrence types.
  return `${type || 'custom'}:${date}:${recurrenceInterval || 1}`;
}

/**
 * Backward compatibility:
 *
 * Existing child bills created before recurrence_occurrence_key existed
 * don't have a key.
 *
 * We infer the key from their original due_date.
 *
 * IMPORTANT:
 * This only happens once and stores the inferred key permanently.
 */
async function backfillMissingOccurrenceKeys(template) {
  if (!template || !template.is_recurring) return;

  await ensureRecurringOccurrenceColumn();

  const childrenRes = await executeSql(
    `SELECT id, due_date, recurrence_occurrence_key
     FROM bills
     WHERE parent_bill_id = ?
       AND deleted_at IS NULL`,
    [template.id]
  );

  const children = rowsToArray(childrenRes);
  for (const child of children) {
    if (child.recurrence_occurrence_key) continue;
    if (!child.due_date) continue;
    const key = getRecurrenceOccurrenceKey(
      template.recurrence_type,
      child.due_date,
      template.recurrence_interval
    );
    if (!key) continue;
    await executeSql(
      `UPDATE bills
       SET recurrence_occurrence_key = ?,
           updated_at = ?
       WHERE id = ?`,
      [key, nowIso(), child.id]
    );
  }
}

// ─── backfill ─────────────────────────────────────────────────────────────────

/**
 * FIX: Generates ALL occurrences up to recurrence_end_date (or today if no
 * end date is set), instead of capping to the current month.
 *
 * Root cause of the original bug:
 *   The old code computed `endOfCurrentMonth` and used it as the upper bound
 *   for `upTo`. If the bill was created in Nov 2021, `endOfCurrentMonth` was
 *   "2021-11-30" — meaning only the template's own date fell in that window,
 *   which was then skipped by the `continue` guard. Result: 0 child rows
 *   were ever inserted.
 *
 * Fix:
 *   - When `recurrence_end_date` is set, use it directly as `upTo`.
 *   - When it is not set, fall back to today's date so we don't generate
 *     unbounded future bills for open-ended recurring series.
 *
 * Called once:
 *  • After createBill for a recurring bill
 *  • After updateBill when recurrence settings change
 *
 * Safe to call multiple times — existing dates are queried from DB first
 * and skipped.
 */
export async function backfillBillOccurrences(templateId) {
  await ensureRecurringOccurrenceColumn();
  await ensureRecurringOccurrenceUniqueIndex();

  const template = await getBillById(templateId);

  if (
    !template ||
    !template.is_recurring ||
    !template.recurrence_type
  ) {
    return;
  }

  // Make sure old occurrences have their permanent keys.
  await backfillMissingOccurrenceKeys(template);

  const today = todayStr();

  /*
   * IMPORTANT:
   *
   * recurrence_effective_date tells us when the CURRENT
   * recurrence rule started.
   *
   * Example:
   *
   * 2024-01 -> Monthly
   * 2025-01 -> Monthly
   * 2025-12 -> Monthly
   *
   * Changed to Yearly on:
   *
   * 2026-01-01
   *
   * Therefore we MUST NOT generate yearly occurrences
   * for 2024 or 2025.
   */
  const effectiveDate =
    template.recurrence_effective_date ||
    template.due_date ||
    today;

  const effectiveDateOnly =
    String(effectiveDate).slice(0, 10);

  const upTo = template.recurrence_end_date
    ? template.recurrence_end_date.slice(0, 10)
    : today;

  const expectedDates = generateOccurrenceDates(
    template,
    upTo
  );

  const existingRes = await executeSql(
    `SELECT
       id,
       parent_bill_id,
       due_date,
       recurrence_occurrence_key,
       deleted_at
     FROM bills
     WHERE id = ?
        OR parent_bill_id = ?`,
    [templateId, templateId]
  );

  const existingRows = rowsToArray(existingRes);

  const existingOccurrenceKeys = new Set();

  for (const row of existingRows) {
    if (row.deleted_at) continue;

    if (Number(row.id) === Number(templateId)) {
      if (row.due_date) {
        const key = getRecurrenceOccurrenceKey(
          template.recurrence_type,
          row.due_date,
          template.recurrence_interval
        );
        if (key) {
          existingOccurrenceKeys.add(String(key));
        }
      }
      continue;
    }

    if (row.recurrence_occurrence_key) {
      existingOccurrenceKeys.add(
        String(row.recurrence_occurrence_key)
      );
      continue;
    }

    // Old occurrence without a key.
    if (row.due_date) {
      const key = getRecurrenceOccurrenceKey(
        template.recurrence_type,
        row.due_date,
        template.recurrence_interval
      );
      if (key) {
        existingOccurrenceKeys.add(String(key));
      }
    }
  }

  for (const dueDate of expectedDates) {
    if (!dueDate) continue;

    const dueDateOnly =
      String(dueDate).slice(0, 10);
    /*
     * IMPORTANT:
     *
     * Never generate the NEW recurrence before
     * recurrence_effective_date.
     *
     * This protects historical monthly bills.
     */
    if (dueDateOnly < effectiveDateOnly) {
      continue;
    }

    /*
     * The template itself already represents its
     * original occurrence.
     */
    if (
      template.due_date &&
      template.due_date.slice(0, 10) === dueDateOnly
    ) {
      continue;
    }

    const occurrenceKey =
      getRecurrenceOccurrenceKey(
        template.recurrence_type,
        dueDateOnly,
        template.recurrence_interval
      );

    if (!occurrenceKey) continue;

    /*
     * Already exists.
     */
    if (
      existingOccurrenceKeys.has(
        String(occurrenceKey)
      )
    ) {
      continue;
    }

    await _insertBill({
      name: template.name,
      amount: template.amount,
      due_date: dueDateOnly,
      is_recurring: 0,
      recurrence_type: null,
      recurrence_interval: 1,
      recurrence_end_date: null,
      category_id: template.category_id,
      source_id: template.source_id,
      reminder_days_before: template.reminder_days_before,
      auto_pay: template.auto_pay,
      notes: template.notes,
      attachment_url: template.attachment_url,
      parent_bill_id: templateId,
      recurrence_occurrence_key: occurrenceKey,
      /*
       * Child keeps the recurrence version
       * that created it.
       */
      recurrence_effective_date: effectiveDateOnly,
    });

    existingOccurrenceKeys.add(
      String(occurrenceKey)
    );
  }
}

// ─── public createBill ────────────────────────────────────────────────────────

export async function createBill(fields) {
  await ensureRecurringOccurrenceColumn();
  await ensureRecurringOccurrenceUniqueIndex();
  const newId = await _insertBill(fields);

  if (
    fields.is_recurring &&
    fields.recurrence_type &&
    fields.due_date &&
    !fields.parent_bill_id
  ) {
    await backfillBillOccurrences(newId);
  }

  emitBillsChanged();
  return newId;
}

// ─── getBillById ──────────────────────────────────────────────────────────────

export async function getBillById(id) {
  const res = await executeSql(`SELECT * FROM bills WHERE id = ?`, [id]);
  if (!res.rows.length) return null;
  return normalizeBill(res.rows.item(0));
}

// ─── getBillSeries ────────────────────────────────────────────────────────────

/**
 * FIX: No longer calls backfillBillOccurrences — read-only, safe to call
 * on every screen focus without creating duplicates.
 */
export async function getBillSeries(templateId) {
  const template = await getBillById(templateId);
  if (!template) return [];

  if (!template.is_recurring || !template.recurrence_type) {
    return [template];
  }

  const allChildren = (await fetchAllBillsRaw())
    .filter(r => Number(r.parent_bill_id) === Number(templateId))
    .map(normalizeBill)
    .filter(Boolean);

  const children = allChildren.filter(c => !c.deleted_at);

  // If a child row exists (even if deleted) for the exact same month as the template's due_date,
  // it acts as an override for the template. We should replace the template with the child row
  // for that month.
  let activeTemplate = template;
  if (template.due_date) {
    const templateMonth = template.due_date.slice(0, 7);
    const overrideChild = allChildren.find(c => c.due_date && c.due_date.slice(0, 7) === templateMonth);
    if (overrideChild) {
      // The child overrides the template for this month. 
      // We don't need to show the template occurrence.
      activeTemplate = null;
    }
  }

  // Combine and sort newest first
  const series = activeTemplate ? [activeTemplate, ...children] : [...children];

  const links = rowsToArray(
    await executeSql(`SELECT * FROM bill_linked_transactions`, [])
  );

  const transactions = rowsToArray(
    await executeSql(`SELECT * FROM transactions`, [])
  );

  const enriched = series.map(bill => {

    const billLinks = links.filter(
      l => Number(l.bill_id) === Number(bill.id)
    );

    const paidAmount = billLinks.reduce((sum, link) => {
      const tx = transactions.find(
        t => Number(t.id) === Number(link.transaction_id)
      );
      return sum + Number(tx?.amount || 0);
    }, 0);

    return {
      ...bill,
      paid_amount: paidAmount,
    };
  });

  return enriched.sort((a, b) =>
    (a.due_date || '').localeCompare(b.due_date || '')
  );
}

// ─── getBillsForCurrentMonth ──────────────────────────────────────────────────

/**
 * FIX: No longer calls backfillBillOccurrences on every load.
 * Read-only — just queries what's already in DB.
 *
 * For the current-month occurrence:
 *  - If a child row exists for this month → use it
 *  - If the template itself is this month → use it
 *  - Otherwise → create it once (this handles the case where backfill
 *    ran before this month existed, e.g. new month just started)
 *
 * The "create if missing" path is guarded by a DB existence check so it
 * only fires at most once per bill per month, not on every page load.
 */
export async function getBillsForCurrentMonth(options = {}) {
  await syncBillStatuses();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = todayStr();
  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const allRaw = await fetchAllBillsRaw();

  // ── Deduplicate recurring series ──────────────────────────────────────────
  const recurringGroups = {};
  const nonRecurring = [];

  for (const row of allRaw) {

    // ============================================================
    // CREDIT CARD PAYMENT TEMPLATE
    // ============================================================
    //
    // Credit-card templates are recurring bills used ONLY as a
    // template by runCreditCardStatementScheduler().
    //
    // They must NEVER appear in the Bills list and must NEVER
    // generate a normal recurring occurrence here.
    //
    // The actual bill displayed to the user is the generated
    // statement child:
    //
    //   parent_bill_id = template.id
    //   is_recurring   = 0
    //   notes          = "Statement YYYY-MM-DD..."
    //
    const isCreditCardTemplate =
      !row.parent_bill_id && row.is_recurring &&
      typeof row.notes === 'string' && row.notes.startsWith('Recurring payment template for');

    if (isCreditCardTemplate) {
      // IMPORTANT:
      // Do not add this to recurringGroups.
      // Credit-card scheduler owns these bills.
      continue;
    }

    // ============================================================
    // CREDIT CARD GENERATED STATEMENT BILL
    // ============================================================
    //
    // This is the real bill that should appear in the Bills list.
    //
    const isCreditCardStatementBill = Number(row.parent_bill_id) > 0 && Number(row.is_recurring) === 0 &&
      typeof row.notes === 'string' && row.notes.startsWith('Statement ');

    if (isCreditCardStatementBill) {
      nonRecurring.push(row);
      continue;
    }

    // ============================================================
    // NORMAL NON-RECURRING BILL
    // ============================================================

    if (!row.is_recurring || !row.recurrence_type) {
      if (!row.parent_bill_id) {
        nonRecurring.push(row);
      }
      continue;
    }

    // ============================================================
    // NORMAL RECURRING BILL
    // ============================================================

    const templateId = row.parent_bill_id || row.id;
    if (!recurringGroups[templateId] || row.parent_bill_id === null) {
      recurringGroups[templateId] = row;
    }
  }
  const result = [];

  // ── Non-recurring bills ───────────────────────────────────────────────────
  for (const row of nonRecurring) {
    // Hide Credit Card template bills.
    // Their generated statement child bill will be displayed instead.
    const isCreditCardTemplate = !row.parent_bill_id && row.is_recurring &&
      typeof row.notes === 'string' && row.notes.startsWith('Recurring payment template for');
    if (isCreditCardTemplate) {
      continue;
    }
    const n = normalizeBill(row);
    if (n) { result.push(n); }
  }

  // ── Recurring series ──────────────────────────────────────────────────────
  for (const template of Object.values(recurringGroups)) {
    // Determine this month's expected due date via string arithmetic
    const endOfMonth = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    const upTo = template.recurrence_end_date ? [template.recurrence_end_date.slice(0, 10), endOfMonth].sort()[0] : endOfMonth;
    const allDates = generateOccurrenceDates(template, upTo);

    // Find this month's date purely by string prefix — no Date parsing,
    // no timezone risk.
    const thisMonthDate = allDates.find(d => d.startsWith(currentMonthPrefix));
    if (!thisMonthDate) {
      // Series has no occurrence this month
      const n = normalizeBill(template);
      if (n) result.push({ ...n, _templateId: template.id, _isRecurringSeries: true });
      continue;
    }

    // Always check latest DB state (avoids duplicate occurrence creation)
    const allBills = await fetchAllBillsRaw();
    // ============================================================
    // FIND CURRENT RECURRING OCCURRENCE
    // ============================================================
    //
    // IMPORTANT:
    // Always check recurrence_occurrence_key FIRST.
    //
    // Example:
    // Expected recurring bill = September 2026
    // User moved bill to = August 2026
    //
    // occurrence_key is still:
    // 2026
    //
    // Therefore August bill is already the September occurrence.
    // DO NOT create another September bill.
    //

    const occurrenceKey = getRecurrenceOccurrenceKey(
      template.recurrence_type,
      thisMonthDate,
      template.recurrence_interval
    );

    let occurrenceRow = allBills.find(
      b =>
        Number(b.parent_bill_id) === Number(template.id) &&
        !b.deleted_at &&
        String(b.recurrence_occurrence_key || '') ===
        String(occurrenceKey)
    );

    if (occurrenceRow) {
      // Existing occurrence found by stable recurrence key.
      occurrenceRow = normalizeBill(occurrenceRow);
    } else if (
      template.due_date &&
      template.due_date.slice(0, 10) === thisMonthDate
    ) {
      // Template itself represents this occurrence.
      occurrenceRow = normalizeBill(template);

    } else {
      // Backward compatibility for old bills created
      // before recurrence_occurrence_key was added.
      occurrenceRow = allBills.find(
        b =>
          Number(b.parent_bill_id) === Number(template.id) &&
          !b.deleted_at &&
          b.due_date?.slice(0, 10) === thisMonthDate
      );

      if (occurrenceRow) {
        occurrenceRow = normalizeBill(occurrenceRow);
      } else {
        // No existing occurrence -> create exactly ONE.
        const newId = await _insertBill({
          name: template.name,
          amount: template.amount,
          due_date: thisMonthDate,
          is_recurring: 0,
          recurrence_type: null,
          recurrence_interval: 1,
          recurrence_end_date: null,
          category_id: template.category_id,
          source_id: template.source_id,
          reminder_days_before: template.reminder_days_before,
          auto_pay: template.auto_pay,
          notes: template.notes,
          attachment_url: template.attachment_url,
          parent_bill_id: template.id,
          recurrence_occurrence_key: occurrenceKey,
        });

        occurrenceRow = normalizeBill(
          await getBillById(newId)
        );
      }
    }

    if (!occurrenceRow) continue;
    if (occurrenceRow) {
      // Hide Credit Card template bills from Bills screen.
      // Only show the generated statement (child) bill.
      const isCreditCardTemplate =
        !template.parent_bill_id &&
        template.is_recurring &&
        typeof template.notes === 'string' &&
        template.notes.startsWith('Recurring payment template for');

      // If we're still pointing at the template itself, don't display it.
      if (
        isCreditCardTemplate &&
        Number(occurrenceRow.id) === Number(template.id)
      ) {
        continue;
      }

      result.push({
        ...occurrenceRow,
        _templateId: template.id,
        _isRecurringSeries: true,
      });
    }
  }

  // ── Filter & sort ─────────────────────────────────────────────────────────
  let filtered = result.filter(Boolean);

  if (options.status && options.status !== 'all') {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    filtered = filtered.filter(b => statuses.includes(b.status));
  }
  if (options.category_id) {
    filtered = filtered.filter(b => b.category_id === options.category_id);
  }

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

// ─── getBills (legacy, unchanged) ────────────────────────────────────────────

export async function getBills({
  status = null, category_id = null,
  sortBy = 'due_date', sortDir = 'asc', includeSkipped = true,
} = {}) {
  await syncBillStatuses();
  let rows = (await fetchAllBillsRaw()).map(normalizeBill).filter(Boolean);
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    rows = rows.filter(b => statuses.includes(b.status));
  }
  if (category_id) rows = rows.filter(b => b.category_id === category_id);
  if (!includeSkipped) rows = rows.filter(b => b.status !== BILL_STATUS.SKIPPED);
  const dir = sortDir === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    if (sortBy === 'amount') return (Number(a.amount) - Number(b.amount)) * dir;
    const ad = a.due_date || '9999-12-31';
    const bd = b.due_date || '9999-12-31';
    if (ad < bd) return -1 * dir;
    if (ad > bd) return 1 * dir;
    return (a.name || '').localeCompare(b.name || '') * dir;
  });
  return rows;
}

// ─── syncBillStatuses ─────────────────────────────────────────────────────────

export async function syncBillStatuses() {
  const today = todayStr();
  const rows = await fetchAllBillsRaw();
  for (const bill of rows) {
    const status = computeBillStatus(bill, today);
    if (
      status !== bill.status &&
      status !== BILL_STATUS.SKIPPED &&
      status !== BILL_STATUS.PAID
    ) {
      await executeSql(
        `UPDATE bills SET status = ?, updated_at = ? WHERE id = ?`,
        [status, nowIso(), bill.id]
      );
    }
  }
}

// ─── summary / insights ───────────────────────────────────────────────────────

export async function getBillsSummary() {
  await syncBillStatuses();
  const today = todayStr();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const mk = monthKey(year, month);
  const todayDate = new Date();

  // Hide Credit Card template bills from all dashboard statistics.
  // Only the generated statement (child) bill should be counted.
  const rows = (await fetchAllBillsRaw())
    .map(normalizeBill)
    .filter(Boolean);

  const active = rows.filter(b => {
    if (b.status === BILL_STATUS.SKIPPED) {
      return false;
    }

    const isCreditCardTemplate =
      !b.parent_bill_id &&
      b.is_recurring &&
      typeof b.notes === 'string' &&
      b.notes.startsWith('Recurring payment template for');

    return !isCreditCardTemplate;
  });

  const thisMonth = active.filter(b => {
    if (!b.due_date) return false;
    const d = new Date(b.due_date.slice(0, 10));
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const totalThisMonth = thisMonth.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalPaid = thisMonth
    .filter(b => b.status === BILL_STATUS.PAID)
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const overdueAmount = active
    .filter(b => b.status === BILL_STATUS.OVERDUE)
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const overdueCount = active.filter(b => b.status === BILL_STATUS.OVERDUE).length;

  const upcoming7 = active
    .filter(b => {
      if (b.status === BILL_STATUS.PAID || b.status === BILL_STATUS.SKIPPED) return false;
      const days = daysBetween(today, b.due_date);
      return days !== null && days >= 0 && days <= 7;
    })
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  const upcoming3 = active.filter(b => {
    if (b.status === BILL_STATUS.PAID || b.status === BILL_STATUS.SKIPPED) return false;
    const days = daysBetween(today, b.due_date);
    return days !== null && days >= 0 && days <= 3;
  });

  const inThisCalMonth = b => {
    if (!b.due_date) return false;
    const d = new Date(b.due_date);
    return (
      !isNaN(d.getTime()) &&
      d.getMonth() === todayDate.getMonth() &&
      d.getFullYear() === todayDate.getFullYear()
    );
  };

  const dueThisMonthCount = active.filter(b =>
    b.status !== BILL_STATUS.PAID && b.status !== BILL_STATUS.SKIPPED && inThisCalMonth(b)
  ).length;

  const dueThisMonthAmount = active
    .filter(b => b.status !== BILL_STATUS.PAID && b.status !== BILL_STATUS.SKIPPED && inThisCalMonth(b))
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  const upcomingAndPendingDueAmt = active
    .filter(b => !b.is_paid && inThisCalMonth(b))
    .reduce((acc, b) => {
      acc.totalAmount += Number(b.amount || 0);
      acc.count += 1;
      return acc;
    }, { totalAmount: 0, count: 0 });

  return {
    month: mk, totalThisMonth, totalPaid,
    overdueAmount, overdueCount,
    upcoming7, upcoming3Count: upcoming3.length,
    dueThisMonthCount, dueThisMonthAmount,
    pendingCount: active.filter(b => b.status === BILL_STATUS.PENDING).length,
    upcomingAndPendingDueAmt,
  };
}

export async function getBillInsights() {
  await syncBillStatuses();
  const today = todayStr();
  const rows = (await fetchAllBillsRaw()).map(normalizeBill).filter(Boolean);
  const active = rows.filter(b => b.status !== BILL_STATUS.SKIPPED);

  const recurringMonthly = active
    .filter(b => b.is_recurring)
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  const upcomingDues = active.filter(b => {
    if (b.status === BILL_STATUS.PAID) return false;
    const days = daysBetween(today, b.due_date);
    return days !== null && days >= 0 && days <= 7;
  });

  const byCategory = {};
  for (const b of active) {
    const cid = b.category_id || 0;
    byCategory[cid] = (byCategory[cid] || 0) + Number(b.amount || 0);
  }
  let topCategoryId = null, topCategoryAmount = 0;
  for (const [cid, amt] of Object.entries(byCategory)) {
    if (amt > topCategoryAmount) { topCategoryId = Number(cid); topCategoryAmount = amt; }
  }

  return { recurringMonthlyTotal: recurringMonthly, upcomingDues, topCategoryId, topCategoryAmount };
}

// ─── markBillPaid ─────────────────────────────────────────────────────────────

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
  const payDate = date || nowIso();
  const paidAt = nowIso();

  let txId = existingTransactionId || bill.linked_transaction_id;

  if (!txId && shouldCreateTx) {

    // Check whether this bill belongs to a Credit Card
    const ccRes = await executeSql(
      `SELECT *
        FROM credit_cards
        WHERE payment_bill_id = ?
        LIMIT 1`,
      [bill.parent_bill_id || bill.id]
    );
    const isCreditCardBill = ccRes.rows.length > 0;
    if (isCreditCardBill) {
      const card = ccRes.rows.item(0);
      const transfer = await createTransfer({
        fromAccount: paySource,
        toAccount: card.source_id,
        amount: bill.amount,
        note: notes || `Credit Card Payment - ${card.name}`,
        date: payDate,
      });
      // Link the debit transaction with the bill
      txId = transfer.debitTransactionId;
    } else {
      // Normal bill payment
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
  }

  await executeSql(
    `UPDATE bills SET status=?, is_paid=?, paid_at=?, linked_transaction_id=?, updated_at=? WHERE id=?`,
    [BILL_STATUS.PAID, 1, paidAt, txId, paidAt, billId]
  );

  // Record in junction table (idempotent)
  if (txId) await addTransactionToBill(billId, txId);

  // Next-month occurrence: create on-demand when current month is paid
  // (replaces old generateNextRecurringBill — targeted, not bulk)
  const parentId = bill.parent_bill_id || (bill.is_recurring ? bill.id : null);
  if (parentId) {
    await _ensureNextOccurrence(parentId);
  }

  emitBillsChanged();
  return txId;
}

/**
 * When a bill is paid, ensure exactly one future occurrence exists (next month).
 * This is the only place future bills are created — never in bulk.
 */
/**
 * Ensure the next recurring occurrence exists.
 *
 * IMPORTANT:
 * This works for:
 *
 *   Daily
 *   Weekly
 *   Monthly
 *   Yearly
 *
 * It does NOT assume "next month".
 */
async function _ensureNextOccurrence(templateId) {
  await ensureRecurringOccurrenceColumn();
  await ensureRecurringOccurrenceUniqueIndex();
  const template = await getBillById(templateId);
  if (
    !template ||
    !template.is_recurring ||
    !template.recurrence_type
  ) {
    return;
  }

  await backfillMissingOccurrenceKeys(template);
  const type = String(
    template.recurrence_type || ''
  ).toLowerCase();

  /*
   * Current recurrence becomes valid from this date.
   */
  const effectiveDate =
    template.recurrence_effective_date ||
    template.due_date ||
    todayStr();

  const effectiveDateOnly =
    String(effectiveDate).slice(0, 10);

  /*
   * Generate enough future dates.
   */
  const future = new Date();

  if (
    type === 'yearly' ||
    type === 'year' ||
    type === 'annual'
  ) {
    future.setFullYear(
      future.getFullYear() + 10
    );
  } else if (
    type === 'monthly' ||
    type === 'month'
  ) {
    future.setFullYear(
      future.getFullYear() + 2
    );
  } else {
    future.setFullYear(
      future.getFullYear() + 1
    );
  }
  let upTo = formatDate(future);
  if (
    template.recurrence_end_date &&
    template.recurrence_end_date.slice(0, 10) < upTo
  ) {
    upTo =
      template.recurrence_end_date.slice(0, 10);
  }
  const allDates =
    generateOccurrenceDates(
      template,
      upTo
    );
  if (!allDates || !allDates.length) {
    return;
  }
  const existingRes = await executeSql(
    `SELECT
       id,
       due_date,
       recurrence_occurrence_key,
       deleted_at
     FROM bills
     WHERE parent_bill_id = ?`,
    [templateId]
  );

  const existingRows = rowsToArray(existingRes);
  const existingKeys = new Set();
  for (const row of existingRows) {
    if (row.deleted_at) continue;
    if (row.recurrence_occurrence_key) {
      existingKeys.add(
        String(
          row.recurrence_occurrence_key
        )
      );
    } else if (row.due_date) {
      const key =
        getRecurrenceOccurrenceKey(
          template.recurrence_type,
          row.due_date,
          template.recurrence_interval
        );
      if (key) {
        existingKeys.add(String(key));
      }
    }
  }

  const sortedDates = [...allDates]
    .map(d => String(d).slice(0, 10))
    .sort();
  for (const occurrenceDate of sortedDates) {
    if (!occurrenceDate) continue;

    /*
     * NEVER create an occurrence belonging to the
     * previous recurrence rule.
     */
    if (
      occurrenceDate < effectiveDateOnly
    ) {
      continue;
    }
    const occurrenceKey =
      getRecurrenceOccurrenceKey(
        template.recurrence_type,
        occurrenceDate,
        template.recurrence_interval
      );

    if (!occurrenceKey) continue;
    /*
     * Already exists.
     */
    if (
      existingKeys.has(
        String(occurrenceKey)
      )
    ) {
      continue;
    }
    const newId = await _insertBill({
      name: template.name,
      amount: template.amount,
      due_date: occurrenceDate,
      is_recurring: 0,
      recurrence_type: null,
      recurrence_interval: 1,
      recurrence_end_date: null,
      category_id: template.category_id,
      source_id: template.source_id,
      reminder_days_before: template.reminder_days_before,
      auto_pay: template.auto_pay,
      notes: template.notes,
      attachment_url: template.attachment_url,
      parent_bill_id: template.id,
      recurrence_occurrence_key: occurrenceKey,
      recurrence_effective_date: effectiveDateOnly,
    });
    return newId;
  }
  return null;
}

async function ensureRecurringOccurrenceUniqueIndex() {
  try {
    await executeSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS
      idx_bills_recurring_occurrence
      ON bills(parent_bill_id, recurrence_occurrence_key)
      WHERE parent_bill_id IS NOT NULL
        AND recurrence_occurrence_key IS NOT NULL
        AND deleted_at IS NULL
    `, []);
  } catch (e) {
    console.warn(
      '[Bills] Could not create recurring occurrence unique index:',
      e
    );
  }
}

// ─── linkAdditionalTransaction ────────────────────────────────────────────────

export async function linkAdditionalTransaction(billId, transactionId) {
  // Create the bill ↔ transaction link
  await addTransactionToBill(billId, transactionId);

  // Always update the bill
  await executeSql(
    `UPDATE bills
     SET
       status = ?,
       is_paid = 1,
       paid_at = ?,
       linked_transaction_id = ?,
       updated_at = ?
     WHERE id = ?`,
    [
      BILL_STATUS.PAID,
      nowIso(),
      transactionId,
      nowIso(),
      billId,
    ]
  );

  emitBillsChanged();
}

// ─── getTransactionsForBillLink ───────────────────────────────────────────────

export async function getTransactionsForBillLink(bill) {
  try {
    // month prefix e.g. '2026-02' — used as the primary filter
    const dueDatePrefix = bill.due_date ? bill.due_date.slice(0, 7) : null;

    let rows = [];

    if (Platform.OS === 'web') {
      const txRes = await executeSql(`SELECT * FROM transactions WHERE type = 'expense' ORDER BY date DESC`, []);
      const sourceRes = await executeSql(`SELECT * FROM sources`, []);
      const catRes = await executeSql(`SELECT * FROM categories`, []);
      const sourceMap = new Map(rowsToArray(sourceRes).map(s => [s.id, s]));
      const catMap = new Map(rowsToArray(catRes).map(c => [c.id, c]));
      rows = rowsToArray(txRes).map(t => ({
        ...t,
        source_name: sourceMap.get(t.source_id)?.name || '',
        category_name: catMap.get(t.category_id)?.name || '',
        category_color: catMap.get(t.category_id)?.color || '',
        category_icon: catMap.get(t.category_id)?.icon || '',
      }));
    } else {
      const res = await executeSql(
        `SELECT t.*, s.name AS source_name, c.name AS category_name,
                c.color AS category_color, c.icon AS category_icon
         FROM transactions t
         LEFT JOIN sources s    ON s.id = t.source_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.type = 'expense'
         ORDER BY t.date DESC`,
        []
      );
      rows = rowsToArray(res);
    }

    // Remove already-linked transactions for this bill
    const linked = await getBillLinkedTransactions(bill.id);
    const linkedIds = new Set(linked.map(l => l.id));
    rows = rows.filter(t => !linkedIds.has(t.id));

    // ── PRIMARY FILTER: always restrict to the occurrence's month ────────────
    // This is the main fix — the user must see only transactions from the
    // same month as the bill occurrence they are trying to link.
    if (dueDatePrefix) {
      rows = rows.filter(t => t.date && String(t.date).startsWith(dueDatePrefix));
    }

    // ── SORT: same-category & same-amount rows rise to the top ───────────────
    rows.sort((a, b) => {
      const aScore =
        (a.category_id === bill.category_id ? 2 : 0) +
        (Number(a.amount) === Number(bill.amount) ? 1 : 0);
      const bScore =
        (b.category_id === bill.category_id ? 2 : 0) +
        (Number(b.amount) === Number(bill.amount) ? 1 : 0);
      if (bScore !== aScore) return bScore - aScore;
      return new Date(b.date) - new Date(a.date);
    });

    return rows.slice(0, 50);
  } catch (e) {
    console.warn('getTransactionsForBillLink error', e);
    return [];
  }
}

// ─── skip / update / delete ───────────────────────────────────────────────────

export async function skipBill(billId) {
  const bill = await getBillById(billId);
  if (!bill) throw new Error('Bill not found');
  await executeSql(
    `UPDATE bills SET status=?, updated_at=? WHERE id=?`,
    [BILL_STATUS.SKIPPED, nowIso(), billId]
  );
  // Ensure next occurrence exists so series continues
  const parentId = bill.parent_bill_id || (bill.is_recurring ? bill.id : null);
  if (parentId) await _ensureNextOccurrence(parentId);
  emitBillsChanged();
}

export async function unskipBill(billId) {
  const bill = await getBillById(billId);

  const today = todayStr();

  const status =
    bill?.due_date && bill.due_date.slice(0, 10) < today
      ? BILL_STATUS.OVERDUE
      : BILL_STATUS.PENDING;

  await executeSql(
    `UPDATE bills
     SET
       status = ?,
       updated_at = ?
     WHERE id = ?`,
    [
      status,
      nowIso(),
      billId,
    ]
  );

  emitBillsChanged();
}

export async function updateBill(id, fields) {
  const existing = await getBillById(id);
  if (!existing) {
    throw new Error('Bill not found');
  }

  /*
   * Detect recurrence-rule changes BEFORE updating.
   */
  const recurrenceChanged =
    (fields.recurrence_type !== undefined &&
      fields.recurrence_type !==
      existing.recurrence_type) ||

    (fields.recurrence_interval !== undefined &&
      fields.recurrence_interval !==
      existing.recurrence_interval) ||

    (fields.recurrence_end_date !== undefined &&
      fields.recurrence_end_date !==
      existing.recurrence_end_date);

  /*
   * If the recurrence rule changes on the MAIN TEMPLATE,
   * the new rule becomes effective from today.
   *
   * Existing child occurrences are NOT modified.
   *
   * Example:
   *
   * 2024 monthly  -> KEEP
   * 2025 monthly  -> KEEP
   * 2026 onward   -> NEW yearly rule
   */
  let recurrenceEffectiveDate =
    existing.recurrence_effective_date || null;

  if (
    recurrenceChanged &&
    existing.is_recurring &&
    !existing.parent_bill_id
  ) {
    recurrenceEffectiveDate = todayStr();
  }

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
  await ensureRecurringOccurrenceColumn();

  await executeSql(
    `UPDATE bills SET
       name=?,
       amount=?,
       due_date=?,
       status=?,
       is_recurring=?,
       recurrence_type=?,
       recurrence_interval=?,
       recurrence_end_date=?,
       category_id=?,
       source_id=?,
       reminder_days_before=?,
       auto_pay=?,
       notes=?,
       attachment_url=?,
       is_paid=?,
       paid_at=?,
       last_reminded_at=?,
       linked_transaction_id=?,
       recurrence_effective_date=?,
       updated_at=?
     WHERE id=?`,
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
      recurrenceEffectiveDate,
      nowIso(),
      id,
    ]
  );
  /*
   * Generate occurrences for the NEW recurrence only.
   *
   * Historical occurrences remain untouched.
   */
  if (
    existing.is_recurring &&
    !existing.parent_bill_id &&
    recurrenceChanged
  ) {
    await backfillBillOccurrences(id);
  }

  emitBillsChanged();
}

export async function deleteBill(id) {
  const ts = nowIso();
  await executeSql(
    `UPDATE bills SET deleted_at=?, updated_at=? WHERE id=?`,
    [ts, ts, id]
  );
  emitBillsChanged();
}

// ─── scheduler / reminders ────────────────────────────────────────────────────

export async function runRecurringScheduler() {
  await syncBillStatuses();
}

function padDateValue(value) {
  return String(value).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getFullYear()}-${padDateValue(date.getMonth() + 1)}-${padDateValue(date.getDate())}`;
}

function normalizeStatementDay(day, year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  return Math.min(Number(day) || 1, lastDay);
}

function getStatementPeriod(statementDay, referenceDate) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  // Current statement date
  const currentStatementDay = normalizeStatementDay(
    statementDay,
    year,
    month + 1
  );

  const statementDate = new Date(
    year,
    month,
    currentStatementDay
  );

  // Previous month
  const previousMonthDate = new Date(
    year,
    month - 1,
    1
  );

  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth();

  const previousStatementDay = normalizeStatementDay(
    statementDay,
    previousYear,
    previousMonth + 1
  );

  const previousStatementDate = new Date(
    previousYear,
    previousMonth,
    previousStatementDay
  );

  // Billing cycle starts the day AFTER previous statement
  const statementStart = new Date(previousStatementDate);
  statementStart.setDate(statementStart.getDate() + 1);

  // Billing cycle ends the DAY BEFORE current statement
  const statementEnd = new Date(statementDate);
  statementEnd.setDate(statementEnd.getDate() - 1);

  return {
    statementStart,
    statementEnd,
    statementDate,
  };
}

export async function runCreditCardStatementScheduler() {
  const today = new Date();
  const todayStrValue = formatDate(today);

  try {
    const cardsRes = await executeSql(
      `SELECT * FROM credit_cards`,
      []
    );

    for (let i = 0; i < cardsRes.rows.length; i++) {
      const card = cardsRes.rows.item(i);

      try {
        if (card.status !== 'active') {
          continue;
        }

        const statementDay = Number(card.statement_day);

        if (!statementDay) {
          continue;
        }

        /*
         * We check:
         *
         * 1. Current month's statement
         * 2. Previous month's statement
         *
         * This allows the app to recover if it wasn't opened
         * on the actual statement date.
         */
        const candidateDates = [
          new Date(
            today.getFullYear(),
            today.getMonth(),
            1
          ),
          new Date(
            today.getFullYear(),
            today.getMonth() - 1,
            1
          ),
        ];

        for (const referenceDate of candidateDates) {
          const {
            statementStart,
            statementEnd,
            statementDate,
          } = getStatementPeriod(
            statementDay,
            referenceDate
          );
          const statementDateStr = formatDate(statementDate);
          const startDateStr = formatDate(statementStart);
          const endDateStr = formatDate(statementEnd);

          /*
           * Do not generate future statements.
           */
          if (statementDateStr > todayStrValue) {
            continue;
          }

          // ============================================================
          // CHECK EXISTING STATEMENT
          // ============================================================

          const statementsRes = await executeSql(
            `SELECT * FROM credit_card_statements`,
            []
          );

          let existingStatement = null;
          for (
            let si = 0;
            si < statementsRes.rows.length;
            si++
          ) {
            const stmt = statementsRes.rows.item(si);
            if (
              Number(stmt.card_id) === Number(card.id) &&
              String(stmt.statement_date || '').slice(0, 10) ===
              statementDateStr
            ) {
              existingStatement = stmt;
              break;
            }
          }

          if (existingStatement) {
            continue;
          }

          // ============================================================
          // GET TRANSACTIONS
          // ============================================================

          const txRes = await executeSql(
            `SELECT type, amount, date
             FROM transactions
             WHERE source_id = ? AND IFNULL(is_counted, 1) = 1`,
            [card.source_id]
          );

          let openingBalance = 0;
          let purchases = 0;
          let payments = 0;

          for (let j = 0; j < txRes.rows.length; j++) {
            const tx = txRes.rows.item(j);
            const txDate = tx.date
              ? String(tx.date).slice(0, 10)
              : null;
            if (!txDate) continue;

            const amount = Number(tx.amount || 0);

            /*
             * Everything before this billing cycle contributes
             * to the opening balance.
             */
            if (txDate < startDateStr) {
              if (tx.type === 'expense') {
                openingBalance += amount;
              } else if (tx.type === 'income') {
                openingBalance -= amount;
              }
            }

            /*
             * ONLY transactions between:
             *
             * startDate <= transactionDate <= endDate
             *
             * are included in this statement.
             *
             * Since endDate is statementDate - 1,
             * transactions on the statement date or later
             * are NOT included.
             */
            else if (
              txDate >= startDateStr &&
              txDate <= endDateStr
            ) {
              if (tx.type === 'expense') {
                purchases += amount;
              } else if (tx.type === 'income') {
                payments += amount;
              }
            }
          }

          const closingBalance = openingBalance + purchases - payments;

          // ============================================================
          // ZERO BALANCE
          // ============================================================

          if (closingBalance <= 0) {
            continue;
          }

          // ============================================================
          // MINIMUM DUE
          // ============================================================

          const minimumDue = closingBalance * (Number(card.minimum_due_percent || 0) / 100);

          // ============================================================
          // DUE DATE
          // ============================================================

          const dueDate = new Date(statementDate);

          if (card.due_after_days != null) {
            dueDate.setDate(
              dueDate.getDate() +
              Number(card.due_after_days || 0)
            );
          }

          const dueDateStr = formatDate(dueDate);

          // ============================================================
          // GET CREDIT CARD BILL TEMPLATE
          // ============================================================

          if (!card.payment_bill_id) {
            throw new Error(
              `Credit card ${card.id} (${card.name}) ` +
              `does not have payment_bill_id`
            );
          }

          const template = await getBillById(card.payment_bill_id);

          if (!template) {
            throw new Error(
              `Credit card ${card.id} (${card.name}) ` +
              `payment bill template ${card.payment_bill_id} not found`
            );
          }

          // ============================================================
          // FIND EXISTING GENERATED BILL
          // ============================================================

          const billsRes = await executeSql(
            `SELECT * FROM bills`,
            []
          );

          let existingBill = null;

          for (
            let bi = 0;
            bi < billsRes.rows.length;
            bi++
          ) {
            const bill = billsRes.rows.item(bi);

            /*
             * IMPORTANT:
             *
             * Only a bill generated for THIS template,
             * THIS due date, and NOT deleted counts.
             */
            if (
              Number(bill.parent_bill_id) ===
              Number(template.id) &&
              String(bill.due_date || '').slice(0, 10) ===
              dueDateStr &&
              !bill.deleted_at
            ) {
              existingBill = bill;
              break;
            }
          }

          let billId = null;

          if (existingBill) {
            /*
             * Normally this should not happen if the statement
             * does not exist, but it protects against a partial
             * previous run.
             */
            billId = existingBill.id;
            await executeSql(
              `UPDATE bills
               SET amount = ?,
                   status = ?,
                   notes = ?,
                   updated_at = ?
               WHERE id = ?`,
              [
                closingBalance,
                BILL_STATUS.PENDING,
                `Statement ${statementDateStr}\n\n${template.notes || ''}`,
                nowIso(),
                billId,
              ]
            );
          } else {
            // ==========================================================
            // CREATE GENERATED BILL
            // ==========================================================

            billId = await _insertBill({
              name: template.name,

              /*
               * IMPORTANT:
               *
               * Bill amount is EXACTLY statement amount.
               */
              amount: closingBalance,
              due_date: dueDateStr,
              status: BILL_STATUS.PENDING,
              is_recurring: 0,
              recurrence_type: null,
              recurrence_interval: 1,
              recurrence_end_date: null,
              category_id: template.category_id,
              source_id: template.source_id,
              reminder_days_before: template.reminder_days_before,
              auto_pay: template.auto_pay,
              notes: `Statement ${statementDateStr}\n\n` + `${template.notes || ''}`,
              attachment_url: template.attachment_url,
              parent_bill_id: template.id,
            });
          }

          // ============================================================
          // VERIFY BILL
          // ============================================================

          const createdBill = await getBillById(billId);
          if (!createdBill) {
            throw new Error(
              `Generated credit card bill ${billId} ` +
              `could not be found`
            );
          }

          if (
            Math.abs(
              Number(createdBill.amount || 0) -
              Number(closingBalance || 0)
            ) > 0.01
          ) {
            throw new Error(
              `Credit card bill amount mismatch. ` +
              `Expected ${closingBalance}, ` +
              `received ${createdBill.amount}`
            );
          }

          // ============================================================
          // CREATE STATEMENT
          // ============================================================

          await executeSql(
            `INSERT INTO credit_card_statements (
              card_id,
              bill_id,
              statement_start,
              statement_end,
              statement_date,
              due_date,
              opening_balance,
              purchases,
              refunds,
              fees,
              interest,
              payments,
              closing_balance,
              minimum_due,
              is_generated,
              generated_at,
              status,
              created_at
            )
            VALUES (
              ?,?,?,?,?,?,
              ?,?,?,?,?,?,
              ?,?,
              ?,?,
              ?,
              datetime('now')
            )`,
            [
              card.id,
              billId,
              startDateStr,
              endDateStr,
              statementDateStr,
              dueDateStr,
              openingBalance,
              purchases,
              0,
              0,
              0,
              payments,
              closingBalance,
              minimumDue,
              1,
              nowIso(),
              'generated',
            ]
          );
        }
      } catch (cardError) {
        console.error(
          `[CC Scheduler] Card ${card.id} (${card.name}) failed:`,
          cardError
        );

        /*
         * Do NOT stop other cards because one card failed.
         */
      }
    }
  } catch (error) {
    console.error(
      '[CC Scheduler] Fatal error:',
      error
    );

    throw error;
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
      `UPDATE bills SET last_reminded_at=?, updated_at=? WHERE id=?`,
      [remindedAt, remindedAt, bill.id]
    );
    due.push({ bill, daysUntilDue: days });
  }
  return due;
}

export async function runBillMaintenance() {
  await syncBillStatuses();
  await runRecurringScheduler();
  await runCreditCardStatementScheduler();
  return processReminders();
}

export default {
  createBill, getBills, getBillById,
  getBillSeries, getBillsForCurrentMonth, backfillBillOccurrences,
  getBillsSummary, getBillInsights,
  markBillPaid, linkAdditionalTransaction,
  addTransactionToBill, removeTransactionFromBill,
  getBillLinkedTransactions, getBillsForTransaction,
  getTransactionsForBillLink,
  skipBill, unskipBill, updateBill, deleteBill,
  runRecurringScheduler, processReminders, runBillMaintenance,
  syncBillStatuses, createBillLinkedTransactionsTable,
};