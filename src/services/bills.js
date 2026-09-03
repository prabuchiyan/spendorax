import { Platform } from "react-native";
import { executeSql } from "../database/db";
import { createTransaction, createTransfer } from "./transactions";
import { emit } from "./events";
import {
  BILL_STATUS,
  computeBillStatus,
  todayStr,
  daysBetween,
  monthKey,
  generateOccurrenceDates,
} from "./billUtils";
import { runCreditCardStatementScheduler } from "./creditCardScheduler";

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

function nowIso() {
  return new Date().toISOString();
}
function emitBillsChanged() {
  emit("billsChanged");
}

async function fetchAllBillsRaw() {
  const res = await executeSql(`SELECT * FROM bills`, []);
  return rowsToArray(res).filter((r) => !r.deleted_at);
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
      [billId, transactionId],
    );

    const res = await executeSql(
      `SELECT * FROM bill_linked_transactions WHERE bill_id = ?`,
      [billId],
    );
  } catch (e) {
    console.log(e);
  }
}

export async function removeTransactionFromBill(billId, transactionId) {
  // 1. Remove the bill ↔ transaction link
  await executeSql(
    `DELETE FROM bill_linked_transactions
     WHERE bill_id = ? AND transaction_id = ?`,
    [billId, transactionId],
  );

  // 2. Check whether any transactions are still linked
  const remaining = rowsToArray(
    await executeSql(
      `SELECT * FROM bill_linked_transactions
       WHERE bill_id = ?`,
      [billId],
    ),
  );

  // 3. If no transactions remain, the bill is no longer paid
  if (remaining.length === 0) {
    const now = nowIso();

    await executeSql(
      `UPDATE bills
       SET
         status = ?,
         is_paid = ?,
         linked_transaction_id = NULL,
         paid_at = NULL,
         updated_at = ?
       WHERE id = ?`,
      [BILL_STATUS.PENDING, 0, now, billId],
    );

    // 4. If this bill is linked to a credit-card statement,
    //    reset that statement back to generated/unpaid.
    await executeSql(
      `UPDATE credit_card_statements
       SET status = ?
       WHERE bill_id = ?`,
      ["generated", billId],
    );

    console.log("[removeTransactionFromBill] Bill reset to pending:", billId);

    console.log(
      "[removeTransactionFromBill] Credit card statement reset to generated:",
      billId,
    );
  }

  emitBillsChanged();
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
      [billId],
    );
    return rowsToArray(res);
  } catch (e) {
    // Web fallback (localStorage executeSql doesn't support JOIN)
    const links = rowsToArray(
      await executeSql(
        `SELECT * FROM bill_linked_transactions WHERE bill_id = ?`,
        [billId],
      ),
    );

    const transactions = rowsToArray(
      await executeSql(`SELECT * FROM transactions`, []),
    );

    const sources = rowsToArray(await executeSql(`SELECT * FROM sources`, []));

    const categories = rowsToArray(
      await executeSql(`SELECT * FROM categories`, []),
    );

    return links
      .map((link) => {
        const tx = transactions.find((t) => t.id == link.transaction_id);
        if (!tx) return null;

        return {
          ...tx,
          source_name: sources.find((s) => s.id == tx.source_id)?.name,
          category_name: categories.find((c) => c.id == tx.category_id)?.name,
          category_icon: categories.find((c) => c.id == tx.category_id)?.icon,
          category_color: categories.find((c) => c.id == tx.category_id)?.color,
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
      [transactionId],
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
    ],
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
      [],
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
      [],
    );
  } catch (e) {
    // Column already exists.
  }

  recurrenceColumnReady = true;
}

// ─── recurring occurrence deletion exclusions ────────────────────────────────

let recurrenceDeletionTableReady = false;

/**
 * Stores recurrence occurrences that the user intentionally deleted.
 *
 * IMPORTANT:
 * We cannot store this information in `bills` because the bill row is
 * permanently deleted.
 *
 * Example:
 * parent_bill_id = 172
 * recurrence_occurrence_key = "2026-09"
 *
 * This tells the recurrence engine:
 * "September 2026 was intentionally deleted — do not recreate it."
 */
async function ensureRecurringDeletionTable() {
  if (recurrenceDeletionTableReady) return;

  await executeSql(
    `CREATE TABLE IF NOT EXISTS bill_deleted_occurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_bill_id INTEGER NOT NULL,
      recurrence_occurrence_key TEXT NOT NULL,
      deleted_at TEXT DEFAULT (datetime('now')),
      UNIQUE(parent_bill_id, recurrence_occurrence_key)
    )`,
    [],
  );

  recurrenceDeletionTableReady = true;
}

/**
 * Remember that a recurring occurrence was intentionally deleted.
 */
async function markRecurringOccurrenceDeleted(
  parentBillId,
  recurrenceOccurrenceKey,
) {
  if (!parentBillId || !recurrenceOccurrenceKey) {
    return;
  }

  await ensureRecurringDeletionTable();

  await executeSql(
    `INSERT OR IGNORE INTO bill_deleted_occurrences (
      parent_bill_id,
      recurrence_occurrence_key,
      deleted_at
    )
    VALUES (?, ?, ?)`,
    [
      Number(parentBillId),
      String(recurrenceOccurrenceKey),
      nowIso(),
    ],
  );
}

/**
 * Get all intentionally deleted occurrence keys for a recurrence series.
 */
async function getDeletedOccurrenceKeys(parentBillId) {
  if (!parentBillId) {
    return new Set();
  }

  await ensureRecurringDeletionTable();

  const result = await executeSql(
    `SELECT recurrence_occurrence_key
     FROM bill_deleted_occurrences
     WHERE parent_bill_id = ?`,
    [Number(parentBillId)],
  );

  const keys = new Set();

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);

    if (row?.recurrence_occurrence_key) {
      keys.add(String(row.recurrence_occurrence_key));
    }
  }

  return keys;
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
  recurrenceInterval = 1,
) {
  if (!occurrenceDate) return null;

  const date = String(occurrenceDate).slice(0, 10);

  if (!date || date.length < 10) return null;

  const type = String(recurrenceType || "").toLowerCase();

  const year = date.slice(0, 4);
  const month = date.slice(0, 7);

  if (type === "yearly" || type === "year" || type === "annual") {
    return year;
  }

  if (type === "monthly" || type === "month") {
    return month;
  }

  if (type === "weekly" || type === "week") {
    // Generated date is the occurrence identity.
    return `W:${date}`;
  }

  if (type === "daily" || type === "day") {
    return date;
  }

  // Fallback for custom recurrence types.
  return `${type || "custom"}:${date}:${recurrenceInterval || 1}`;
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
    [template.id],
  );

  const children = rowsToArray(childrenRes);
  for (const child of children) {
    if (child.recurrence_occurrence_key) continue;
    if (!child.due_date) continue;
    const key = getRecurrenceOccurrenceKey(
      template.recurrence_type,
      child.due_date,
      template.recurrence_interval,
    );
    if (!key) continue;
    await executeSql(
      `UPDATE bills
       SET recurrence_occurrence_key = ?,
           updated_at = ?
       WHERE id = ?`,
      [key, nowIso(), child.id],
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
  await ensureRecurringDeletionTable();

  const numericTemplateId = Number(templateId);

  if (!Number.isInteger(numericTemplateId) || numericTemplateId <= 0) {
    console.warn(
      "[backfillBillOccurrences] Invalid template ID:",
      templateId
    );
    return;
  }

  // =========================================================
  // 1. LOAD RECURRING TEMPLATE
  // =========================================================

  const template = await getBillById(numericTemplateId);

  if (
    !template ||
    Number(template.is_recurring) !== 1 ||
    !template.recurrence_type ||
    !template.due_date
  ) {
    console.log(
      "[backfillBillOccurrences] Not a valid recurring template:",
      {
        templateId: numericTemplateId,
      }
    );
    return;
  }

  const templateDate =
    String(template.due_date).slice(0, 10);

  const today = todayStr();

  // =========================================================
  // 2. DETERMINE EFFECTIVE START DATE
  // =========================================================
  //
  // For a bill created on:
  //
  //   2025-09-10
  //
  // monthly recurrence should generate:
  //
  //   2025-09-10  template
  //   2025-10-10
  //   2025-11-10
  //   ...
  //   2026-08-10
  //
  // September 2026 is NOT generated until its due date arrives.
  // =========================================================

  const effectiveDate =
    template.recurrence_effective_date ||
    template.due_date;

  const effectiveDateOnly =
    String(effectiveDate).slice(0, 10);

  // =========================================================
  // 3. DETERMINE END DATE
  // =========================================================

  let upTo = today;

  if (template.recurrence_end_date) {
    const recurrenceEndDate =
      String(template.recurrence_end_date).slice(0, 10);

    if (recurrenceEndDate < upTo) {
      upTo = recurrenceEndDate;
    }
  }

  // Nothing to generate yet.
  if (effectiveDateOnly > upTo) {
    console.log(
      "[backfillBillOccurrences] Effective date is after today:",
      {
        templateId: numericTemplateId,
        effectiveDateOnly,
        upTo,
      }
    );
    return;
  }

  // =========================================================
  // 4. GENERATE EXPECTED DATES
  // =========================================================

  const expectedDates =
    generateOccurrenceDates(template, upTo);

  console.log(
    "[backfillBillOccurrences] EXPECTED DATES:",
    {
      templateId: numericTemplateId,
      templateDate,
      effectiveDateOnly,
      upTo,
      count: expectedDates.length,
      dates: expectedDates,
    }
  );

  // =========================================================
  // 5. LOAD DELETED OCCURRENCE KEYS
  // =========================================================

  const deletedOccurrenceKeys =
    await getDeletedOccurrenceKeys(
      numericTemplateId
    );

  // =========================================================
  // 6. LOAD ALL EXISTING CHILDREN
  // =========================================================
  // Keep this SELECT simple because the Web SQLite shim
  // supports basic SELECT/WHERE queries more reliably.
  // Filter deleted rows in JavaScript.

  const existingResult = await executeSql(
    `SELECT * FROM bills WHERE parent_bill_id = ?`,
    [numericTemplateId]
  );

  const existingChildren = rowsToArray(existingResult)
    .filter((row) => !row.deleted_at);

  const existingOccurrenceKeys = new Set();

  for (const child of existingChildren) {
    let key =
      child.recurrence_occurrence_key;

    // Backward compatibility:
    // old occurrence rows may not have a key.
    if (!key && child.due_date) {
      key = getRecurrenceOccurrenceKey(
        template.recurrence_type,
        child.due_date,
        template.recurrence_interval
      );

      // Permanently save the recovered key.
      if (key) {
        await executeSql(
          `UPDATE bills
           SET recurrence_occurrence_key = ?,
               updated_at = ?
           WHERE id = ?`,
          [
            String(key),
            nowIso(),
            child.id,
          ]
        );
      }
    }

    if (key) {
      existingOccurrenceKeys.add(
        String(key)
      );
    }
  }

  console.log(
    "[backfillBillOccurrences] EXISTING CHILD KEYS:",
    Array.from(existingOccurrenceKeys)
  );

  console.log(
    "[backfillBillOccurrences] DELETED KEYS:",
    Array.from(deletedOccurrenceKeys)
  );

  // =========================================================
  // 7. CREATE ONLY MISSING OCCURRENCES
  // =========================================================

  let createdCount = 0;

  for (const generatedDate of expectedDates) {
    if (!generatedDate) continue;

    const dueDateOnly =
      String(generatedDate).slice(0, 10);

    // Never generate anything before effective date.
    if (dueDateOnly < effectiveDateOnly) {
      continue;
    }

    // Never create a child for the template's own date.
    if (dueDateOnly === templateDate) {
      continue;
    }

    // Safety: never create future bills.
    if (dueDateOnly > today) {
      continue;
    }

    const occurrenceKey =
      getRecurrenceOccurrenceKey(
        template.recurrence_type,
        dueDateOnly,
        template.recurrence_interval
      );

    if (!occurrenceKey) {
      continue;
    }

    const key =
      String(occurrenceKey);

    // -------------------------------------------------------
    // User explicitly deleted this occurrence.
    // -------------------------------------------------------

    if (
      deletedOccurrenceKeys.has(key)
    ) {
      console.log(
        "[backfillBillOccurrences] SKIP DELETED:",
        {
          templateId: numericTemplateId,
          dueDate: dueDateOnly,
          key,
        }
      );

      continue;
    }

    // -------------------------------------------------------
    // Already exists.
    // -------------------------------------------------------

    if (
      existingOccurrenceKeys.has(key)
    ) {
      continue;
    }

    // -------------------------------------------------------
    // Create occurrence.
    // -------------------------------------------------------

    console.log(
      "[backfillBillOccurrences] CREATE:",
      {
        templateId: numericTemplateId,
        dueDate: dueDateOnly,
        key,
      }
    );

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

      reminder_days_before:
        template.reminder_days_before,

      auto_pay:
        template.auto_pay,

      notes:
        template.notes,

      attachment_url:
        template.attachment_url,

      paid_at: null,
      is_paid: 0,
      linked_transaction_id: null,

      parent_bill_id:
        numericTemplateId,

      recurrence_occurrence_key:
        key,

      recurrence_effective_date:
        effectiveDateOnly,
    });

    // Important:
    // Prevent another occurrence with the same key
    // during THIS execution.
    existingOccurrenceKeys.add(key);

    createdCount++;
  }

  // =========================================================
  // 8. FINAL LOG
  // =========================================================

  console.log(
    "[backfillBillOccurrences] COMPLETE:",
    {
      templateId: numericTemplateId,
      expectedCount: expectedDates.length,
      existingCount:
        existingOccurrenceKeys.size,
      createdCount,
      deletedCount:
        deletedOccurrenceKeys.size,
    }
  );
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

  // CC payment templates: is_recurring=1 but recurrence_type=null
  // Fetch children directly by parent_bill_id
  const isCCTemplate =
    template.is_recurring &&
    typeof template.notes === "string" &&
    template.notes.startsWith("Recurring payment template for");

  if (!template.is_recurring && !isCCTemplate) {
    return [template];
  }

  // For CC templates with no recurrence_type, skip the normal recurring logic
  // and just return all non-deleted children sorted by due_date
  if (isCCTemplate || !template.recurrence_type) {
    const allChildren = (await fetchAllBillsRaw())
      .filter((r) => Number(r.parent_bill_id) === Number(templateId))
      .map(normalizeBill)
      .filter(Boolean);

    const links = rowsToArray(
      await executeSql(`SELECT * FROM bill_linked_transactions`, []),
    );
    const transactions = rowsToArray(
      await executeSql(`SELECT * FROM transactions`, []),
    );

    const enriched = allChildren.map((bill) => {
      const billLinks = links.filter(
        (l) => Number(l.bill_id) === Number(bill.id),
      );
      const paidAmount = billLinks.reduce((sum, link) => {
        const tx = transactions.find(
          (t) => Number(t.id) === Number(link.transaction_id),
        );
        return sum + Number(tx?.amount || 0);
      }, 0);
      return { ...bill, paid_amount: paidAmount };
    });

    return enriched.sort((a, b) =>
      (a.due_date || "").localeCompare(b.due_date || ""),
    );
  }

  // Normal recurring bill — existing logic below
  const allChildren = (await fetchAllBillsRaw())
    .filter((r) => Number(r.parent_bill_id) === Number(templateId))
    .map(normalizeBill)
    .filter(Boolean);

  const children = allChildren.filter((c) => !c.deleted_at);

  let activeTemplate = template;
  if (template.due_date) {
    const templateMonth = template.due_date.slice(0, 7);
    const overrideChild = allChildren.find(
      (c) => c.due_date && c.due_date.slice(0, 7) === templateMonth,
    );
    if (overrideChild) activeTemplate = null;
  }

  const series = activeTemplate ? [activeTemplate, ...children] : [...children];

  const links = rowsToArray(
    await executeSql(`SELECT * FROM bill_linked_transactions`, []),
  );
  const transactions = rowsToArray(
    await executeSql(`SELECT * FROM transactions`, []),
  );

  const enriched = series.map((bill) => {
    const billLinks = links.filter(
      (l) => Number(l.bill_id) === Number(bill.id),
    );
    const paidAmount = billLinks.reduce((sum, link) => {
      const tx = transactions.find(
        (t) => Number(t.id) === Number(link.transaction_id),
      );
      return sum + Number(tx?.amount || 0);
    }, 0);
    return { ...bill, paid_amount: paidAmount };
  });

  return enriched.sort((a, b) =>
    (a.due_date || "").localeCompare(b.due_date || ""),
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

  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  // ============================================================
  // LOAD ALL BILLS
  // ============================================================

  const allRaw = await fetchAllBillsRaw();

  // ============================================================
  // LOAD CREDIT CARD PAYMENT TEMPLATE IDS
  // ============================================================
  //
  // credit_cards.payment_bill_id points to the recurring
  // credit-card payment template.
  //
  // Example:
  //
  // payment_bill_id = 5
  //
  // bills:
  //   id 5   -> CC template
  //   id 191 -> statement 1
  //   id 192 -> statement 2
  //
  // The template is hidden.
  // Statements are displayed individually.
  // ============================================================

  let creditCardPaymentBillIds = new Set();

  try {
    const ccRes = await executeSql(
      `SELECT payment_bill_id
       FROM credit_cards
       WHERE payment_bill_id IS NOT NULL`,
      [],
    );

    creditCardPaymentBillIds = new Set(
      rowsToArray(ccRes)
        .map((row) => Number(row.payment_bill_id))
        .filter(Boolean),
    );
  } catch (e) {
    console.warn(
      "getBillsForCurrentMonth: unable to load credit card payment bill IDs",
      e,
    );
  }

  // ============================================================
  // CLASSIFY BILLS
  // ============================================================

  const recurringGroups = {};
  const nonRecurring = [];

  for (const row of allRaw) {
    const rowId = Number(row.id);

    const parentBillId = Number(row.parent_bill_id || 0);

    // ==========================================================
    // CREDIT CARD PAYMENT TEMPLATE
    // ==========================================================
    //
    // Never show the recurring CC payment template.
    //

    const isCreditCardTemplate =
      parentBillId === 0 &&
      Number(row.is_recurring) === 1 &&
      creditCardPaymentBillIds.has(rowId);

    if (isCreditCardTemplate) {
      continue;
    }

    // ==========================================================
    // CREDIT CARD GENERATED STATEMENT
    // ==========================================================
    //
    // Every generated statement is an independent bill.
    //
    // IMPORTANT:
    // Do NOT put these into recurringGroups.
    //

    const isCreditCardStatement =
      parentBillId > 0 &&
      Number(row.is_recurring) === 0 &&
      creditCardPaymentBillIds.has(parentBillId);

    if (isCreditCardStatement) {
      nonRecurring.push(row);
      continue;
    }

    // ==========================================================
    // NORMAL NON-RECURRING BILL
    // ==========================================================

    if (!row.is_recurring || !row.recurrence_type) {
      if (!row.parent_bill_id) {
        nonRecurring.push(row);
      }

      continue;
    }

    // ==========================================================
    // NORMAL RECURRING BILL
    // ==========================================================

    const templateId = row.parent_bill_id || row.id;

    if (!recurringGroups[templateId] || row.parent_bill_id === null) {
      recurringGroups[templateId] = row;
    }
  }

  const result = [];

  // ============================================================
  // NON-RECURRING BILLS
  // ============================================================

  for (const row of nonRecurring) {
    const parentBillId = Number(row.parent_bill_id || 0);

    // ==========================================================
    // CREDIT CARD STATEMENT
    // ==========================================================

    const isCCStatement =
      parentBillId > 0 &&
      Number(row.is_recurring) === 0 &&
      creditCardPaymentBillIds.has(parentBillId);

    if (isCCStatement) {
      // --------------------------------------------------------
      // READ STATEMENT DATE FROM NOTES
      // --------------------------------------------------------
      //
      // Scheduler creates notes similar to:
      //
      // Statement 2026-08-13
      //
      // We use the statement date to decide whether the
      // statement has actually been generated/reached.
      //

      const notes = String(row.notes || "");

      const statementMatch = notes.match(/Statement\s+(\d{4}-\d{2}-\d{2})/);

      const statementDate = statementMatch ? statementMatch[1] : null;

      // --------------------------------------------------------
      // FUTURE STATEMENT
      // --------------------------------------------------------
      //
      // Example:
      //
      // Today          = 2026-08-30
      // Statement date = 2026-09-13
      //
      // Do NOT display it yet.
      //

      if (statementDate && statementDate > today) {
        continue;
      }

      // --------------------------------------------------------
      // NORMALIZE
      // --------------------------------------------------------

      const n = normalizeBill(row);

      if (!n) {
        continue;
      }

      // --------------------------------------------------------
      // IMPORTANT
      // --------------------------------------------------------
      //
      // This is an INDIVIDUAL bill.
      //
      // Do NOT set:
      //
      // _templateId
      // _isRecurringSeries: true
      //
      // Otherwise the Bills UI can treat multiple CC
      // statements as one recurring series and combine
      // their amounts.
      //

      result.push({
        ...n,

        _isCreditCardStatement: true,

        _isRecurringSeries: false,

        _templateId: null,

        statement_date: statementDate,

        closing_balance: Number(n.amount || 0),
      });

      continue;
    }

    // ==========================================================
    // NORMAL NON-RECURRING BILL
    // ==========================================================

    const n = normalizeBill(row);

    if (n) {
      result.push(n);
    }
  }

  // ============================================================
  // NORMAL RECURRING SERIES
  // ============================================================

  for (const template of Object.values(recurringGroups)) {
    const endOfMonth = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    const upTo = template.recurrence_end_date
      ? [template.recurrence_end_date.slice(0, 10), endOfMonth].sort()[0]
      : endOfMonth;

    const allDates = generateOccurrenceDates(template, upTo);

    const thisMonthDate = allDates.find((d) =>
      d.startsWith(currentMonthPrefix),
    );

    // ----------------------------------------------------------
    // NO OCCURRENCE THIS MONTH
    // ----------------------------------------------------------

    if (!thisMonthDate) {
      const n = normalizeBill(template);

      if (n) {
        result.push({
          ...n,

          _templateId: template.id,

          _isRecurringSeries: true,
        });
      }

      continue;
    }

    // ----------------------------------------------------------
    // LOAD LATEST BILLS
    // ----------------------------------------------------------

    const allBills = await fetchAllBillsRaw();

    // ----------------------------------------------------------
    // OCCURRENCE KEY
    // ----------------------------------------------------------
    const occurrenceKey = getRecurrenceOccurrenceKey(
      template.recurrence_type,
      thisMonthDate,
      template.recurrence_interval,
    );

    // ==========================================================
    // IMPORTANT:
    // Check permanent deletion marker FIRST.
    // ==========================================================

    let occurrenceRow = null;
    let wasIntentionallyDeleted = false;

    try {
      await ensureRecurringDeletionTable();

      const deletedKeys = await getDeletedOccurrenceKeys(
        Number(template.id),
      );

      wasIntentionallyDeleted =
        occurrenceKey &&
        deletedKeys.has(String(occurrenceKey));

      console.log(
        "[getBillsForCurrentMonth] DELETION CHECK:",
        {
          templateId: template.id,
          dueDate: thisMonthDate,
          occurrenceKey,
          wasIntentionallyDeleted,
          deletedKeys: Array.from(deletedKeys),
        },
      );
    } catch (e) {
      console.warn(
        "[getBillsForCurrentMonth] Deletion check failed:",
        e,
      );
    }

    // ==========================================================
    // USER DELETED THIS OCCURRENCE
    // ==========================================================

    if (wasIntentionallyDeleted) {
      console.log(
        "[getBillsForCurrentMonth] DELETED OCCURRENCE FOUND:",
        {
          templateId: template.id,
          dueDate: thisMonthDate,
          occurrenceKey,
        },
      );

      // Remove any stale/recreated occurrence from DB.
      const staleResult = await executeSql(
        `DELETE FROM bills
         WHERE parent_bill_id = ?
           AND (
             recurrence_occurrence_key = ?
             OR due_date = ?
           )`,
        [
          Number(template.id),
          String(occurrenceKey),
          thisMonthDate,
        ],
      );

      console.log(
        "[getBillsForCurrentMonth] STALE DELETED OCCURRENCE REMOVED:",
        {
          rowsAffected: staleResult.rowsAffected,
          templateId: template.id,
          occurrenceKey,
          dueDate: thisMonthDate,
        },
      );

      occurrenceRow = null;
    } else {
      // ========================================================
      // NORMAL OCCURRENCE LOOKUP
      // ========================================================

      occurrenceRow = allBills.find(
        (b) =>
          Number(b.parent_bill_id) === Number(template.id) &&
          !b.deleted_at &&
          String(b.recurrence_occurrence_key || "") ===
          String(occurrenceKey),
      );

      // ========================================================
      // EXISTING OCCURRENCE
      // ========================================================

      if (occurrenceRow) {
        occurrenceRow = normalizeBill(occurrenceRow);
      }

      // ========================================================
      // TEMPLATE ITSELF IS THIS MONTH
      // ========================================================

      else if (
        template.due_date &&
        template.due_date.slice(0, 10) === thisMonthDate
      ) {
        occurrenceRow = normalizeBill(template);
      }

      // ========================================================
      // OLD OCCURRENCE WITHOUT KEY
      // ========================================================

      else {
        occurrenceRow = allBills.find(
          (b) =>
            Number(b.parent_bill_id) === Number(template.id) &&
            !b.deleted_at &&
            b.due_date?.slice(0, 10) === thisMonthDate,
        );

        if (occurrenceRow) {
          occurrenceRow = normalizeBill(occurrenceRow);

          // Give old occurrence its permanent key.
          if (
            occurrenceRow &&
            !occurrenceRow.recurrence_occurrence_key &&
            occurrenceKey
          ) {
            await executeSql(
              `UPDATE bills
               SET recurrence_occurrence_key = ?,
                   updated_at = ?
               WHERE id = ?`,
              [
                String(occurrenceKey),
                nowIso(),
                occurrenceRow.id,
              ],
            );

            occurrenceRow.recurrence_occurrence_key =
              String(occurrenceKey);
          }
        } else {
          // ======================================================
          // CREATE ONLY IF NOT INTENTIONALLY DELETED
          // ======================================================

          console.log(
            "[getBillsForCurrentMonth] CREATING MISSING OCCURRENCE:",
            {
              templateId: template.id,
              occurrenceKey,
              dueDate: thisMonthDate,
            },
          );

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

            reminder_days_before:
              template.reminder_days_before,

            auto_pay:
              template.auto_pay,

            notes:
              template.notes,

            attachment_url:
              template.attachment_url,

            parent_bill_id:
              template.id,

            recurrence_occurrence_key:
              occurrenceKey,

            recurrence_effective_date:
              template.recurrence_effective_date ||
              template.due_date ||
              todayStr(),
          });

          occurrenceRow = normalizeBill(
            await getBillById(newId),
          );
        }
      }
    }

    if (!occurrenceRow) {
      continue;
    }

    // ----------------------------------------------------------
    // NEVER SHOW CREDIT CARD TEMPLATE
    // ----------------------------------------------------------

    const isCreditCardTemplate =
      !template.parent_bill_id &&
      Number(template.is_recurring) === 1 &&
      creditCardPaymentBillIds.has(Number(template.id));

    if (
      isCreditCardTemplate &&
      Number(occurrenceRow.id) === Number(template.id)
    ) {
      continue;
    }

    // ----------------------------------------------------------
    // NORMAL RECURRING BILL
    // ----------------------------------------------------------

    result.push({
      ...occurrenceRow,

      _templateId: template.id,

      _isRecurringSeries: true,
    });
  }

  // ============================================================
  // FILTERS
  // ============================================================

  let filtered = result.filter(Boolean);

  if (options.status && options.status !== "all") {
    const statuses = Array.isArray(options.status)
      ? options.status
      : [options.status];

    filtered = filtered.filter((bill) => statuses.includes(bill.status));
  }

  if (options.category_id) {
    filtered = filtered.filter(
      (bill) => bill.category_id === options.category_id,
    );
  }

  // ============================================================
  // SORT
  // ============================================================

  const sortBy = options.sortBy || "due_date";

  const dir = options.sortDir === "desc" ? -1 : 1;

  filtered.sort((a, b) => {
    if (sortBy === "amount") {
      return (Number(a.amount) - Number(b.amount)) * dir;
    }

    const ad = a.due_date || "9999-12-31";

    const bd = b.due_date || "9999-12-31";

    if (ad < bd) {
      return -1 * dir;
    }

    if (ad > bd) {
      return 1 * dir;
    }

    return (a.name || "").localeCompare(b.name || "") * dir;
  });

  return filtered;
}

// ─── getBills (legacy, unchanged) ────────────────────────────────────────────

export async function getBills({
  status = null,
  category_id = null,
  sortBy = "due_date",
  sortDir = "asc",
  includeSkipped = true,
} = {}) {
  await syncBillStatuses();
  let rows = (await fetchAllBillsRaw()).map(normalizeBill).filter(Boolean);
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    rows = rows.filter((b) => statuses.includes(b.status));
  }
  if (category_id) rows = rows.filter((b) => b.category_id === category_id);
  if (!includeSkipped)
    rows = rows.filter((b) => b.status !== BILL_STATUS.SKIPPED);
  const dir = sortDir === "desc" ? -1 : 1;
  rows.sort((a, b) => {
    if (sortBy === "amount") return (Number(a.amount) - Number(b.amount)) * dir;
    const ad = a.due_date || "9999-12-31";
    const bd = b.due_date || "9999-12-31";
    if (ad < bd) return -1 * dir;
    if (ad > bd) return 1 * dir;
    return (a.name || "").localeCompare(b.name || "") * dir;
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
        [status, nowIso(), bill.id],
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
  const rows = (await fetchAllBillsRaw()).map(normalizeBill).filter(Boolean);

  const active = rows.filter((b) => {
    if (b.status === BILL_STATUS.SKIPPED) {
      return false;
    }

    const isCreditCardTemplate =
      !b.parent_bill_id &&
      b.is_recurring &&
      typeof b.notes === "string" &&
      b.notes.startsWith("Recurring payment template for");

    return !isCreditCardTemplate;
  });

  const thisMonth = active.filter((b) => {
    if (!b.due_date) return false;
    const d = new Date(b.due_date.slice(0, 10));
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const totalThisMonth = thisMonth.reduce(
    (s, b) => s + Number(b.amount || 0),
    0,
  );
  const totalPaid = thisMonth
    .filter((b) => b.status === BILL_STATUS.PAID)
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const overdueAmount = active
    .filter((b) => b.status === BILL_STATUS.OVERDUE)
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const overdueCount = active.filter(
    (b) => b.status === BILL_STATUS.OVERDUE,
  ).length;

  const upcoming7 = active
    .filter((b) => {
      if (b.status === BILL_STATUS.PAID || b.status === BILL_STATUS.SKIPPED)
        return false;
      const days = daysBetween(today, b.due_date);
      return days !== null && days >= 0 && days <= 7;
    })
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  const upcoming3 = active.filter((b) => {
    if (b.status === BILL_STATUS.PAID || b.status === BILL_STATUS.SKIPPED)
      return false;
    const days = daysBetween(today, b.due_date);
    return days !== null && days >= 0 && days <= 3;
  });

  const inThisCalMonth = (b) => {
    if (!b.due_date) return false;
    const d = new Date(b.due_date);
    return (
      !isNaN(d.getTime()) &&
      d.getMonth() === todayDate.getMonth() &&
      d.getFullYear() === todayDate.getFullYear()
    );
  };

  const dueThisMonthCount = active.filter(
    (b) =>
      b.status !== BILL_STATUS.PAID &&
      b.status !== BILL_STATUS.SKIPPED &&
      inThisCalMonth(b),
  ).length;

  const dueThisMonthAmount = active
    .filter(
      (b) =>
        b.status !== BILL_STATUS.PAID &&
        b.status !== BILL_STATUS.SKIPPED &&
        inThisCalMonth(b),
    )
    .reduce((s, b) => s + Number(b.amount || 0), 0);

  const upcomingAndPendingDueAmt = active
    .filter((b) => !b.is_paid && inThisCalMonth(b))
    .reduce(
      (acc, b) => {
        acc.totalAmount += Number(b.amount || 0);
        acc.count += 1;
        return acc;
      },
      { totalAmount: 0, count: 0 },
    );

  return {
    month: mk,
    totalThisMonth,
    totalPaid,
    overdueAmount,
    overdueCount,
    upcoming7,
    upcoming3Count: upcoming3.length,
    dueThisMonthCount,
    dueThisMonthAmount,
    pendingCount: active.filter((b) => b.status === BILL_STATUS.PENDING).length,
    upcomingAndPendingDueAmt,
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

  const upcomingDues = active.filter((b) => {
    if (b.status === BILL_STATUS.PAID) return false;
    const days = daysBetween(today, b.due_date);
    return days !== null && days >= 0 && days <= 7;
  });

  const byCategory = {};
  for (const b of active) {
    const cid = b.category_id || 0;
    byCategory[cid] = (byCategory[cid] || 0) + Number(b.amount || 0);
  }
  let topCategoryId = null,
    topCategoryAmount = 0;
  for (const [cid, amt] of Object.entries(byCategory)) {
    if (amt > topCategoryAmount) {
      topCategoryId = Number(cid);
      topCategoryAmount = amt;
    }
  }

  return {
    recurringMonthlyTotal: recurringMonthly,
    upcomingDues,
    topCategoryId,
    topCategoryAmount,
  };
}

// ─── markBillPaid ─────────────────────────────────────────────────────────────

export async function markBillPaid(
  billId,
  {
    source_id = null,
    date = null,
    notes = "Bill payment",
    createTransaction: shouldCreateTx = true,
    existingTransactionId = null,
  } = {},
) {
  const bill = await getBillById(billId);
  if (!bill) throw new Error("Bill not found");
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
      [bill.parent_bill_id || bill.id],
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
        type: "expense",
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
    [BILL_STATUS.PAID, 1, paidAt, txId, paidAt, billId],
  );

  // DEBUG: verify the actual DB value immediately after UPDATE
  const paidBillCheck = await executeSql(
    `SELECT id, status, is_paid, paid_at, linked_transaction_id
   FROM bills
   WHERE id = ?`,
    [billId],
  );

  console.log(
    "[markBillPaid] BILL AFTER UPDATE:",
    paidBillCheck.rows.length ? paidBillCheck.rows.item(0) : "BILL NOT FOUND",
  );

  const statementCheck = await executeSql(
    `SELECT id, card_id, bill_id, statement_date, status
   FROM credit_card_statements
   WHERE bill_id = ?`,
    [billId],
  );

  console.log(
    "[markBillPaid] statement linked to bill:",
    statementCheck.rows.length
      ? statementCheck.rows.item(0)
      : "NO STATEMENT FOUND",
  );

  // Record in junction table (idempotent)
  if (txId) await addTransactionToBill(billId, txId);

  // Next-month occurrence: create on-demand when current month is paid
  // (replaces old generateNextRecurringBill — targeted, not bulk)
  const parentId = bill.parent_bill_id || (bill.is_recurring ? bill.id : null);
  if (parentId) {
    await _ensureNextOccurrence(parentId);

    // DEBUG: verify again after next-occurrence processing
    const finalBillCheck = await executeSql(
      `SELECT id, status, is_paid, paid_at, linked_transaction_id
   FROM bills
   WHERE id = ?`,
      [billId],
    );

    console.log(
      "[markBillPaid] BILL AFTER _ensureNextOccurrence:",
      finalBillCheck.rows.length
        ? finalBillCheck.rows.item(0)
        : "BILL NOT FOUND",
    );
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
  await ensureRecurringDeletionTable();

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
    template.recurrence_type || ""
  ).toLowerCase();

  const effectiveDate =
    template.recurrence_effective_date ||
    template.due_date ||
    todayStr();

  const effectiveDateOnly =
    String(effectiveDate).slice(0, 10);

  const future = new Date();

  if (
    type === "yearly" ||
    type === "year" ||
    type === "annual"
  ) {
    future.setFullYear(
      future.getFullYear() + 10
    );
  } else if (
    type === "monthly" ||
    type === "month"
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

  const allDates = generateOccurrenceDates(
    template,
    upTo
  );

  if (!allDates || !allDates.length) {
    return null;
  }

  // ==========================================================
  // LOAD INTENTIONALLY DELETED OCCURRENCES
  // ==========================================================

  const deletedOccurrenceKeys =
    await getDeletedOccurrenceKeys(
      Number(templateId)
    );

  console.log(
    "[_ensureNextOccurrence] Deleted occurrence keys:",
    {
      templateId,
      keys: Array.from(deletedOccurrenceKeys),
    }
  );

  // ==========================================================
  // LOAD EXISTING CHILD OCCURRENCES
  // ==========================================================

  const existingRes = await executeSql(
    `SELECT *
     FROM bills
     WHERE parent_bill_id = ?`,
    [Number(templateId)]
  );

  const existingRows = rowsToArray(existingRes);

  const existingKeys = new Set();

  for (const row of existingRows) {
    if (row.recurrence_occurrence_key) {
      existingKeys.add(
        String(row.recurrence_occurrence_key)
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

  console.log(
    "[_ensureNextOccurrence] Existing keys:",
    Array.from(existingKeys)
  );

  // ==========================================================
  // FIND FIRST FUTURE OCCURRENCE
  // ==========================================================

  const sortedDates = [...allDates]
    .map((d) => String(d).slice(0, 10))
    .sort();

  for (const occurrenceDate of sortedDates) {
    if (!occurrenceDate) {
      continue;
    }

    if (occurrenceDate < effectiveDateOnly) {
      continue;
    }

    const occurrenceKey =
      getRecurrenceOccurrenceKey(
        template.recurrence_type,
        occurrenceDate,
        template.recurrence_interval
      );

    if (!occurrenceKey) {
      continue;
    }

    const key = String(occurrenceKey);

    // ========================================================
    // CRITICAL:
    // NEVER recreate intentionally deleted occurrence.
    // ========================================================

    if (deletedOccurrenceKeys.has(key)) {
      console.log(
        "[_ensureNextOccurrence] SKIPPING DELETED OCCURRENCE:",
        {
          templateId,
          occurrenceDate,
          occurrenceKey: key,
        }
      );

      continue;
    }

    // Already exists.
    if (existingKeys.has(key)) {
      continue;
    }

    console.log(
      "[_ensureNextOccurrence] CREATING:",
      {
        templateId,
        occurrenceDate,
        occurrenceKey: key,
      }
    );

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

      reminder_days_before:
        template.reminder_days_before,

      auto_pay:
        template.auto_pay,

      notes:
        template.notes,

      attachment_url:
        template.attachment_url,

      parent_bill_id:
        template.id,

      recurrence_occurrence_key:
        key,

      recurrence_effective_date:
        effectiveDateOnly,
    });

    return newId;
  }

  return null;
}

async function ensureRecurringOccurrenceUniqueIndex() {
  try {
    await executeSql(
      `
      CREATE UNIQUE INDEX IF NOT EXISTS
      idx_bills_recurring_occurrence
      ON bills(parent_bill_id, recurrence_occurrence_key)
      WHERE parent_bill_id IS NOT NULL
        AND recurrence_occurrence_key IS NOT NULL
        AND deleted_at IS NULL
    `,
      [],
    );
  } catch (e) {
    console.warn(
      "[Bills] Could not create recurring occurrence unique index:",
      e,
    );
  }
}

// ─── linkAdditionalTransaction ────────────────────────────────────────────────
export async function linkAdditionalTransaction(billId, transactionId) {
  const now = nowIso();

  const billDebug = await executeSql(`SELECT * FROM bills WHERE id = ?`, [
    billId,
  ]);

  console.log(
    "[linkAdditionalTransaction] BILL:",
    billDebug.rows.length ? billDebug.rows.item(0) : "BILL NOT FOUND",
  );

  const statementDebug = await executeSql(
    `SELECT * FROM credit_card_statements`,
    [],
  );

  for (let i = 0; i < statementDebug.rows.length; i++) {
    console.log(
      "[linkAdditionalTransaction] STATEMENT:",
      statementDebug.rows.item(i),
    );
  }

  await addTransactionToBill(billId, transactionId);

  await executeSql(
    `UPDATE bills
     SET
       status = ?,
       is_paid = 1,
       paid_at = ?,
       linked_transaction_id = ?,
       updated_at = ?
     WHERE id = ?`,
    [BILL_STATUS.PAID, now, transactionId, now, billId],
  );

  const relatedBills = await executeSql(`SELECT * FROM bills`, []);

  for (let i = 0; i < relatedBills.rows.length; i++) {
    const b = relatedBills.rows.item(i);

    if (
      Number(b.id) === 103 ||
      Number(b.id) === 172 ||
      Number(b.parent_bill_id) === 103 ||
      Number(b.parent_bill_id) === 172
    ) {
      console.log("[DEBUG] BILL ID:", b.id);
      console.log("[DEBUG] BILL PARENT:", b.parent_bill_id);
      console.log("[DEBUG] BILL STATUS:", b.status);
      console.log("[DEBUG] BILL DUE:", b.due_date);
    }
  }

  emitBillsChanged();
}

// ─── getTransactionsForBillLink ───────────────────────────────────────────────
export async function getTransactionsForBillLink(bill) {
  try {
    let rows = [];
    const billDate = bill?.due_date ? new Date(bill.due_date) : new Date();
    // One month before the bill date
    const fromDate = new Date(billDate);
    fromDate.setMonth(fromDate.getMonth() - 1);
    // Compare dates using the actual Date objects
    const fromTime = fromDate.getTime();
    const toTime = billDate.getTime();

    if (Platform.OS === "web") {
      const txRes = await executeSql(
        `SELECT *
         FROM transactions
         WHERE type = 'expense'
         ORDER BY date DESC`,
        [],
      );
      const sourceRes = await executeSql(`SELECT * FROM sources`, []);
      const catRes = await executeSql(`SELECT * FROM categories`, []);
      const sourceMap = new Map(rowsToArray(sourceRes).map((s) => [s.id, s]));
      const catMap = new Map(rowsToArray(catRes).map((c) => [c.id, c]));
      rows = rowsToArray(txRes).map((t) => ({
        ...t,
        source_name: sourceMap.get(t.source_id)?.name || "",
        category_name: catMap.get(t.category_id)?.name || "",
        category_color: catMap.get(t.category_id)?.color || "",
        category_icon: catMap.get(t.category_id)?.icon || "",
      }));
    } else {
      const res = await executeSql(
        `SELECT
           t.*,
           s.name AS source_name,
           c.name AS category_name,
           c.color AS category_color,
           c.icon AS category_icon
         FROM transactions t
         LEFT JOIN sources s ON s.id = t.source_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.type = 'expense'
         ORDER BY t.date DESC`,
        [],
      );
      rows = rowsToArray(res);
    }

    // ---------------------------------------------------------
    // STRICT FILTER
    // Only EXPENSE transactions within one month of bill date
    // ---------------------------------------------------------
    rows = rows.filter((tx) => {
      if (String(tx.type).toLowerCase() !== "expense") {
        return false;
      }
      if (!tx.date) {
        return false;
      }
      const txDate = new Date(tx.date);
      if (Number.isNaN(txDate.getTime())) {
        return false;
      }
      const txTime = txDate.getTime();
      return txTime >= fromTime && txTime <= toTime;
    });

    // Remove transactions already linked to this bill
    const linked = await getBillLinkedTransactions(bill.id);
    const linkedIds = new Set(linked.map((l) => Number(l.id)));
    rows = rows.filter((tx) => !linkedIds.has(Number(tx.id)));
    // Same category + same amount first
    rows.sort((a, b) => {
      const aScore =
        (Number(a.category_id) === Number(bill.category_id) ? 2 : 0) +
        (Number(a.amount) === Number(bill.amount) ? 1 : 0);

      const bScore =
        (Number(b.category_id) === Number(bill.category_id) ? 2 : 0) +
        (Number(b.amount) === Number(bill.amount) ? 1 : 0);
      if (bScore !== aScore) {
        return bScore - aScore;
      }
      return new Date(b.date) - new Date(a.date);
    });

    return rows.slice(0, 50);
  } catch (e) {
    console.warn("getTransactionsForBillLink error", e);
    return [];
  }
}

// ─── skip / update / delete ───────────────────────────────────────────────────
export async function skipBill(billId) {
  const bill = await getBillById(billId);

  if (!bill) {
    throw new Error("Bill not found");
  }

  await executeSql(
    `UPDATE bills
     SET status = ?, updated_at = ?
     WHERE id = ?`,
    [BILL_STATUS.SKIPPED, nowIso(), billId],
  );

  /*
   * Credit Card Statement bills are generated by the
   * Credit Card Scheduler.
   *
   * Do NOT create the next occurrence here, otherwise
   * skipping a statement can create an extra bill with
   * the template amount instead of the future statement's
   * actual transaction data.
   */
  const isCreditCardStatement =
    typeof bill.notes === "string" && bill.notes.startsWith("Statement ");

  if (!isCreditCardStatement) {
    const parentId =
      bill.parent_bill_id || (bill.is_recurring ? bill.id : null);

    if (parentId) {
      await _ensureNextOccurrence(parentId);
    }
  }

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
    [status, nowIso(), billId],
  );

  emitBillsChanged();
}

export async function updateBill(id, fields) {
  const existing = await getBillById(id);

  if (!existing) {
    throw new Error("Bill not found");
  }

  await ensureRecurringOccurrenceColumn();
  await ensureRecurringDeletionTable();

  // =========================================================
  // 1. Detect recurrence-rule changes
  // =========================================================

  const dueDateChanged =
    fields.due_date !== undefined &&
    String(fields.due_date).slice(0, 10) !==
    String(existing.due_date || "").slice(0, 10);

  const recurrenceTypeChanged =
    fields.recurrence_type !== undefined &&
    fields.recurrence_type !== existing.recurrence_type;

  const recurrenceIntervalChanged =
    fields.recurrence_interval !== undefined &&
    Number(fields.recurrence_interval || 1) !==
    Number(existing.recurrence_interval || 1);

  const recurrenceEndDateChanged =
    fields.recurrence_end_date !== undefined &&
    String(fields.recurrence_end_date || "").slice(0, 10) !==
    String(existing.recurrence_end_date || "").slice(0, 10);

  const recurrenceEnabledChanged =
    fields.is_recurring !== undefined &&
    Boolean(fields.is_recurring) !==
    Boolean(existing.is_recurring);

  const recurrenceChanged =
    dueDateChanged ||
    recurrenceTypeChanged ||
    recurrenceIntervalChanged ||
    recurrenceEndDateChanged ||
    recurrenceEnabledChanged;

  const isRecurringTemplate =
    Number(existing.is_recurring) === 1 &&
    !existing.parent_bill_id;

  console.log(
    "[updateBill] RECURRENCE CHANGE CHECK:",
    {
      id,
      isRecurringTemplate,
      recurrenceChanged,
      dueDateChanged,
      recurrenceTypeChanged,
      recurrenceIntervalChanged,
      recurrenceEndDateChanged,
      recurrenceEnabledChanged,
    }
  );

  // =========================================================
  // 2. Determine NEW recurrence effective date
  // =========================================================

  let recurrenceEffectiveDate =
    existing.recurrence_effective_date || null;

  if (
    isRecurringTemplate &&
    recurrenceChanged
  ) {
    /*
     * If the due date itself changed, the new recurrence
     * starts from the NEW due date.
     *
     * Otherwise, when only the recurrence rule changes,
     * we continue AFTER the latest existing bill.
     *
     * Example:
     *
     * Existing yearly:
     * 2020-01-01
     * 2021-01-01
     * ...
     * 2025-01-01
     *
     * Change yearly -> monthly
     * due date remains 2020-01-01
     *
     * New monthly recurrence starts after 2025-01-01.
     */

    if (dueDateChanged) {
      recurrenceEffectiveDate =
        fields.due_date
          ? String(fields.due_date).slice(0, 10)
          : todayStr();
    } else {
      // -------------------------------------------------------
      // Recurrence rule changed but due date stayed the same.
      //
      // Keep ALL existing child bills because they may contain
      // linked transactions.
      //
      // Find the latest existing bill and start the NEW
      // recurrence immediately after that bill.
      // -------------------------------------------------------

      const existingChildrenResult =
        await executeSql(
          `SELECT * FROM bills WHERE parent_bill_id = ?`,
          [Number(existing.id)]
        );

      const existingChildren =
        rowsToArray(existingChildrenResult)
          .filter((row) => !row.deleted_at);

      let latestExistingDate = null;

      for (const child of existingChildren) {
        if (!child.due_date) continue;

        const childDate =
          String(child.due_date).slice(0, 10);

        if (
          !latestExistingDate ||
          childDate > latestExistingDate
        ) {
          latestExistingDate = childDate;
        }
      }

      // Also consider the parent/template date.
      const templateDate =
        existing.due_date
          ? String(existing.due_date).slice(0, 10)
          : null;

      if (
        templateDate &&
        (
          !latestExistingDate ||
          templateDate > latestExistingDate
        )
      ) {
        latestExistingDate = templateDate;
      }

      // -------------------------------------------------------
      // IMPORTANT:
      // We need the NEW recurrence start date to be the next
      // occurrence after the latest existing bill.
      //
      // Use generateOccurrenceDates() with the NEW rule and
      // find the first generated date AFTER latestExistingDate.
      //
      // This avoids directly calling addRecurrence().
      // -------------------------------------------------------

      if (
        latestExistingDate &&
        (
          fields.recurrence_type ||
          fields.recurrence_interval !== undefined ||
          fields.recurrence_end_date !== undefined
        )
      ) {
        const newRecurrenceType =
          fields.recurrence_type !== undefined
            ? fields.recurrence_type
            : existing.recurrence_type;

        const newInterval =
          fields.recurrence_interval !== undefined
            ? Number(
              fields.recurrence_interval || 1
            )
            : Number(
              existing.recurrence_interval || 1
            );

        // IMPORTANT:
        // Always use the ORIGINAL due date as the recurrence anchor.
        //
        // Example:
        // Original due date = 2020-01-01
        // Existing monthly bills through = 2021-12-01
        // New recurrence = yearly
        //
        // Probe:
        // 2020-01-01
        // 2021-01-01
        // 2022-01-01  <-- first date after latest existing bill
        //
        // This prevents 2022-01-01 from being missed.

        const originalDueDate =
          existing.due_date
            ? String(existing.due_date).slice(0, 10)
            : latestExistingDate;

        const recurrenceProbeBill = {
          ...existing,

          is_recurring: 1,

          due_date: originalDueDate,

          recurrence_type:
            newRecurrenceType,

          recurrence_interval:
            newInterval,

          // Ignore the old end date while probing.
          recurrence_end_date: null,
        };

        const probeDates =
          generateOccurrenceDates(
            recurrenceProbeBill,
            todayStr()
          );

        const nextDate =
          probeDates.find(
            (date) =>
              String(date).slice(0, 10) >
              latestExistingDate
          );

        recurrenceEffectiveDate =
          nextDate || latestExistingDate;

        console.log(
          "[updateBill] CONTINUING NEW RECURRENCE FROM ORIGINAL DUE-DATE ANCHOR:",
          {
            originalDueDate,
            latestExistingDate,
            newRecurrenceType,
            newInterval,
            recurrenceEffectiveDate,
          }
        );
      } else {
        recurrenceEffectiveDate =
          existing.due_date
            ? String(existing.due_date).slice(0, 10)
            : todayStr();
      }
    }

    // ---------------------------------------------------------
    // Old deletion exclusions belong to the old recurrence rule.
    // They must not block the new recurrence.
    // ---------------------------------------------------------

    await executeSql(
      `DELETE FROM bill_deleted_occurrences
       WHERE parent_bill_id = ?`,
      [Number(existing.id)]
    );
  }

  // =========================================================
  // 3. Merge updated values
  // =========================================================

  const merged = {
    name:
      fields.name ?? existing.name,

    amount:
      fields.amount ?? existing.amount,

    due_date:
      fields.due_date !== undefined
        ? fields.due_date
        : existing.due_date,

    status:
      fields.status ?? existing.status,

    is_recurring:
      fields.is_recurring !== undefined
        ? fields.is_recurring
          ? 1
          : 0
        : existing.is_recurring,

    recurrence_type:
      fields.recurrence_type !== undefined
        ? fields.recurrence_type
        : existing.recurrence_type,

    recurrence_interval:
      fields.recurrence_interval !== undefined
        ? fields.recurrence_interval
        : existing.recurrence_interval ?? 1,

    recurrence_end_date:
      fields.recurrence_end_date !== undefined
        ? fields.recurrence_end_date
        : existing.recurrence_end_date,

    category_id:
      fields.category_id !== undefined
        ? fields.category_id
        : existing.category_id,

    source_id:
      fields.source_id !== undefined
        ? fields.source_id
        : existing.source_id,

    reminder_days_before:
      fields.reminder_days_before ??
      existing.reminder_days_before ??
      2,

    auto_pay:
      fields.auto_pay !== undefined
        ? fields.auto_pay
          ? 1
          : 0
        : existing.auto_pay,

    notes:
      fields.notes !== undefined
        ? fields.notes
        : existing.notes,

    attachment_url:
      fields.attachment_url !== undefined
        ? fields.attachment_url
        : existing.attachment_url,

    is_paid:
      fields.is_paid !== undefined
        ? fields.is_paid
          ? 1
          : 0
        : existing.is_paid,

    paid_at:
      fields.paid_at !== undefined
        ? fields.paid_at
        : existing.paid_at,

    last_reminded_at:
      fields.last_reminded_at !== undefined
        ? fields.last_reminded_at
        : existing.last_reminded_at,

    linked_transaction_id:
      fields.linked_transaction_id !== undefined
        ? fields.linked_transaction_id
        : existing.linked_transaction_id,
  };

  // =========================================================
  // 4. Update parent/template
  // =========================================================

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

  // =========================================================
  // 5. Generate NEW recurrence occurrences
  // =========================================================

  if (
    isRecurringTemplate &&
    recurrenceChanged &&
    Number(merged.is_recurring) === 1 &&
    merged.recurrence_type &&
    merged.due_date
  ) {
    console.log(
      "[updateBill] BACKFILLING NEW RECURRENCE SERIES:",
      {
        templateId: id,
        dueDate:
          String(merged.due_date).slice(0, 10),
        recurrenceType:
          merged.recurrence_type,
        recurrenceInterval:
          merged.recurrence_interval,
        recurrenceEndDate:
          merged.recurrence_end_date,
        effectiveDate:
          recurrenceEffectiveDate,
      }
    );

    await backfillBillOccurrences(id);
  }

  emitBillsChanged();

  console.log(
    "[updateBill] COMPLETE:",
    {
      id,
      recurrenceChanged,
      recurrenceEffectiveDate,
    }
  );
}

export async function deleteBill(id) {
  console.log("=================================================");
  console.log("[deleteBill] START");
  console.log("[deleteBill] Raw ID received:", id);
  console.log("[deleteBill] Raw ID type:", typeof id);

  if (id === null || id === undefined || id === "") {
    throw new Error("Bill ID is required.");
  }

  // =========================================================
  // 0. Normalize credit-card synthetic IDs
  // =========================================================

  let rawId = id;

  if (
    typeof rawId === "string" &&
    rawId.startsWith("cc-")
  ) {
    rawId = rawId.substring(3);

    console.log(
      "[deleteBill] Normalized credit-card ID:",
      rawId
    );
  }

  const billId = Number(rawId);

  if (!Number.isInteger(billId) || billId <= 0) {
    throw new Error("Invalid bill ID.");
  }

  try {
    // =========================================================
    // 1. Find requested bill
    // =========================================================

    const billResult = await executeSql(
      `SELECT *
       FROM bills
       WHERE id = ?
       LIMIT 1`,
      [billId]
    );

    if (!billResult.rows.length) {
      throw new Error("Bill not found.");
    }

    const bill = billResult.rows.item(0);

    console.log("[deleteBill] BILL FOUND:", {
      id: bill.id,
      name: bill.name,
      amount: bill.amount,
      due_date: bill.due_date,
      is_recurring: bill.is_recurring,
      parent_bill_id: bill.parent_bill_id,
      linked_transaction_id: bill.linked_transaction_id,
      is_paid: bill.is_paid,
      paid_at: bill.paid_at,
    });

    // =========================================================
    // 2. Determine the ROOT recurring parent
    //
    // If deleting a child occurrence, delete the whole series.
    // If deleting the parent, delete the whole series.
    // =========================================================

    let rootBillId = billId;

    const hasParent =
      bill.parent_bill_id !== null &&
      bill.parent_bill_id !== undefined &&
      bill.parent_bill_id !== "" &&
      Number(bill.parent_bill_id) > 0;

    if (hasParent) {
      rootBillId = Number(bill.parent_bill_id);

      console.log(
        "[deleteBill] Child occurrence detected. Root parent:",
        rootBillId
      );
    }

    // =========================================================
    // 3. Build complete bill family
    //
    // Parent + ALL generated occurrences.
    // =========================================================

    const billIds = [rootBillId];

    const childrenResult = await executeSql(
      `SELECT id
       FROM bills
       WHERE parent_bill_id = ?`,
      [rootBillId]
    );

    for (let i = 0; i < childrenResult.rows.length; i++) {
      const child = childrenResult.rows.item(i);
      const childId = Number(child.id);

      if (
        Number.isInteger(childId) &&
        childId > 0 &&
        !billIds.includes(childId)
      ) {
        billIds.push(childId);
      }
    }

    console.log(
      "[deleteBill] COMPLETE BILL FAMILY TO DELETE:",
      billIds
    );

    // =========================================================
    // 4. Remove bill-linked-transaction relationships
    //
    // IMPORTANT:
    // Transactions themselves are NEVER deleted.
    // =========================================================

    for (const targetBillId of billIds) {
      const linkedResult = await executeSql(
        `SELECT id, bill_id, transaction_id
         FROM bill_linked_transactions
         WHERE bill_id = ?`,
        [targetBillId]
      );

      console.log(
        `[deleteBill] Linked transaction count for bill ${targetBillId}:`,
        linkedResult.rows.length
      );

      const unlinkResult = await executeSql(
        `DELETE FROM bill_linked_transactions
         WHERE bill_id = ?`,
        [targetBillId]
      );

      console.log(
        `[deleteBill] Unlink result for bill ${targetBillId}:`,
        {
          rowsAffected: unlinkResult.rowsAffected,
        }
      );
    }

    // =========================================================
    // 5. Clear direct bill -> transaction references
    //
    // Transaction rows remain untouched.
    // =========================================================

    for (const targetBillId of billIds) {
      const result = await executeSql(
        `UPDATE bills
         SET
           linked_transaction_id = NULL,
           paid_at = NULL,
           is_paid = 0,
           updated_at = ?
         WHERE id = ?`,
        [nowIso(), targetBillId]
      );

      console.log(
        `[deleteBill] Cleared transaction reference for ${targetBillId}:`,
        {
          rowsAffected: result.rowsAffected,
        }
      );
    }

    // =========================================================
    // 6. Remove credit-card statement records
    // =========================================================

    for (const targetBillId of billIds) {
      const result = await executeSql(
        `DELETE FROM credit_card_statements
         WHERE bill_id = ?`,
        [targetBillId]
      );

      if (result.rowsAffected) {
        console.log(
          `[deleteBill] Credit-card statement removed for ${targetBillId}:`,
          result.rowsAffected
        );
      }
    }

    // =========================================================
    // 7. Permanently delete ALL bill records
    //
    // Parent/template is deleted too.
    // =========================================================

    for (const targetBillId of billIds) {
      const result = await executeSql(
        `DELETE FROM bills
         WHERE id = ?`,
        [targetBillId]
      );

      console.log(
        `[deleteBill] BILL DELETE ${targetBillId}:`,
        {
          rowsAffected: result.rowsAffected,
        }
      );
    }

    // =========================================================
    // 8. IMPORTANT:
    // Remove recurring-occurrence deletion markers for this
    // series because the entire series itself is gone.
    // =========================================================

    try {
      await ensureRecurringDeletionTable();

      const markerResult = await executeSql(
        `DELETE FROM bill_deleted_occurrences
         WHERE parent_bill_id = ?`,
        [rootBillId]
      );

      console.log(
        "[deleteBill] Removed recurring deletion markers:",
        {
          parentBillId: rootBillId,
          rowsAffected: markerResult.rowsAffected,
        }
      );
    } catch (markerError) {
      console.warn(
        "[deleteBill] Could not remove recurring deletion markers:",
        markerError
      );
    }

    // =========================================================
    // 9. FINAL VERIFICATION
    // =========================================================

    const remainingResult = await executeSql(
      `SELECT id, name, parent_bill_id, is_recurring
       FROM bills
       WHERE id = ?
          OR parent_bill_id = ?`,
      [rootBillId, rootBillId]
    );

    console.log(
      "[deleteBill] REMAINING BILL FAMILY:",
      {
        rows: remainingResult.rows.length,
      }
    );

    if (remainingResult.rows.length > 0) {
      const remaining = [];

      for (
        let i = 0;
        i < remainingResult.rows.length;
        i++
      ) {
        remaining.push(remainingResult.rows.item(i));
      }

      console.error(
        "[deleteBill] WARNING - BILL FAMILY STILL EXISTS:",
        remaining
      );
    } else {
      console.log(
        "[deleteBill] SUCCESS - COMPLETE BILL FAMILY DELETED:",
        billIds
      );
    }

    // =========================================================
    // 10. Notify the app
    // =========================================================

    emitBillsChanged();

    console.log(
      "[deleteBill] Permanently deleted bills:",
      billIds
    );

    console.log(
      "[deleteBill] Linked transactions were preserved."
    );

    console.log("[deleteBill] COMPLETE");
    console.log("=================================================");

  } catch (error) {
    console.error(
      "[deleteBill] FAILED:",
      error
    );

    console.log("=================================================");

    throw error;
  }
}

// ─── scheduler / reminders ────────────────────────────────────────────────────

export async function runRecurringScheduler() {
  await syncBillStatuses();
}

function padDateValue(value) {
  return String(value).padStart(2, "0");
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
    month + 1,
  );

  const statementDate = new Date(year, month, currentStatementDay);

  // Previous month
  const previousMonthDate = new Date(year, month - 1, 1);

  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth();

  const previousStatementDay = normalizeStatementDay(
    statementDay,
    previousYear,
    previousMonth + 1,
  );

  const previousStatementDate = new Date(
    previousYear,
    previousMonth,
    previousStatementDay,
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

export async function processReminders() {
  await syncBillStatuses();
  const today = todayStr();
  const rows = (await fetchAllBillsRaw()).map(normalizeBill).filter(Boolean);
  const due = [];

  for (const bill of rows) {
    if (bill.status === BILL_STATUS.PAID || bill.status === BILL_STATUS.SKIPPED)
      continue;
    if (!bill.due_date) continue;
    const days = daysBetween(today, bill.due_date);
    const remindBefore = bill.reminder_days_before ?? 2;
    if (days === null || days < 0 || days > remindBefore) continue;
    const lastReminded = bill.last_reminded_at?.slice(0, 10);
    if (lastReminded === today) continue;
    const remindedAt = nowIso();
    await executeSql(
      `UPDATE bills SET last_reminded_at=?, updated_at=? WHERE id=?`,
      [remindedAt, remindedAt, bill.id],
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
  createBill,
  getBills,
  getBillById,
  getBillSeries,
  getBillsForCurrentMonth,
  backfillBillOccurrences,
  getBillsSummary,
  getBillInsights,
  markBillPaid,
  linkAdditionalTransaction,
  addTransactionToBill,
  removeTransactionFromBill,
  getBillLinkedTransactions,
  getBillsForTransaction,
  getTransactionsForBillLink,
  skipBill,
  unskipBill,
  updateBill,
  deleteBill,
  runRecurringScheduler,
  processReminders,
  runBillMaintenance,
  syncBillStatuses,
  createBillLinkedTransactionsTable,
};
