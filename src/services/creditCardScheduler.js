/**
 * Credit Card Statement Scheduler
 *
 * Generation rules:
 * 1. Scan ALL past cycles from card's first transaction up to today.
 * 2. A statement is generated for a cycle if:
 *      - The cycle's statement date has passed (or is today)
 *      - The cycle has at least one transaction
 *      - The closing balance is > 0
 * 3. If a statement row already exists for a cycle AND its bill is paid → skip (do not regenerate).
 * 4. If a statement row exists but is NOT paid → update it (amount may have changed).
 * 5. If no statement row exists → create one (deleted statements regenerate automatically).
 *
 * Triggers (call runCreditCardStatementScheduler):
 *   - App open / maintenance run
 *   - A transaction is added/edited/deleted for a credit card source
 *   - A statement bill is marked paid
 *   - A statement is deleted (deleteStatement calls it immediately after deletion)
 */

import { executeSql } from "../database/db";
import { getBillById, deleteBill } from "./bills";
import { BILL_STATUS } from "./billUtils";
import { emit } from "./events";

// ─── helpers ──────────────────────────────────────────────────────────────────

function rowsToArray(res) {
  const out = [];
  for (let i = 0; i < res.rows.length; i++) out.push(res.rows.item(i));
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

function padTwo(v) {
  return String(v).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

/**
 * Clamps the day to the last valid day of the given month.
 * e.g. statement_day=31 in February → 28/29
 */
function clampDay(day, year, month /* 1-based */) {
  const lastDay = new Date(year, month, 0).getDate();
  return Math.min(Number(day) || 1, lastDay);
}

/**
 * Returns the statement date for a given year+month (1-based).
 * e.g. getStatementDate(25, 2026, 8) → Date(2026-08-25)
 */
function getStatementDate(statementDay, year, month) {
  const day = clampDay(statementDay, year, month);
  return new Date(year, month - 1, day);
}

// Add this function in creditCardScheduler.js

async function repairMissingTemplate(card) {
  console.log(
    `[CC Scheduler] Repairing missing template bill for card ${card.id} (${card.name})`,
  );

  const ts = nowIso();

  // Create a new template bill for this card
  const billRes = await executeSql(
    `INSERT INTO bills (
      name, amount, due_date, status,
      is_recurring, recurrence_type, recurrence_interval,
      category_id, source_id, reminder_days_before,
      auto_pay, notes, is_paid, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      card.name,
      0, // template amount — overridden per statement
      null, // no due date on template
      "pending",
      1, // is_recurring = 1 (marks it as a template)
      "monthly",
      1,
      null, // category_id — none
      card.source_id,
      2,
      0,
      `Recurring payment template for ${card.name}`,
      0,
      ts,
      ts,
    ],
  );

  const newBillId = billRes.insertId;

  // Update the credit card to point to the new template
  await executeSql(
    `UPDATE credit_cards SET payment_bill_id = ?, updated_at = ? WHERE id = ?`,
    [newBillId, ts, card.id],
  );

  console.log(
    `[CC Scheduler] Repaired: card ${card.id} now has template bill ${newBillId}`,
  );

  // Return the new template row
  return await getRawBillById(newBillId);
}

async function getRawBillById(id) {
  try {
    const res = await executeSql(`SELECT * FROM bills WHERE id = ?`, [id]);
    if (!res.rows.length) return null;
    return res.rows.item(0); // raw row, no deleted_at filter
  } catch (e) {
    return null;
  }
}

/**
 * For a given statement date, compute the billing cycle:
 *
 *   cycleStart = previous statement date + 1 day
 *   cycleEnd   = this statement date - 1 day
 *
 * Example (statement_day = 25):
 *   Statement date : 2026-08-25
 *   cycleStart     : 2026-07-26
 *   cycleEnd       : 2026-08-24
 */
function getCyclePeriod(statementDay, statementDate) {
  // Previous statement date: same day last month (clamped)
  const prevYear =
    statementDate.getMonth() === 0
      ? statementDate.getFullYear() - 1
      : statementDate.getFullYear();
  const prevMonth =
    statementDate.getMonth() === 0 ? 12 : statementDate.getMonth(); // getMonth() is 0-based, so this gives previous month 1-based
  const prevDay = clampDay(statementDay, prevYear, prevMonth);
  const prevStatementDate = new Date(prevYear, prevMonth - 1, prevDay);

  const cycleStart = new Date(prevStatementDate);
  cycleStart.setDate(cycleStart.getDate() + 1);

  const cycleEnd = new Date(statementDate);
  cycleEnd.setDate(cycleEnd.getDate() - 1);

  return {
    cycleStart: formatDate(cycleStart),
    cycleEnd: formatDate(cycleEnd),
  };
}

/**
 * Generates an ordered list of all statement dates for a card,
 * from the first transaction date (or card creation) up to today.
 *
 * Each entry: { statementDate: Date, statementDateStr, cycleStart, cycleEnd }
 */
function getAllCycles(statementDay, fromDate, todayDate) {
  const cycles = [];

  let year = fromDate.getFullYear();
  let month = fromDate.getMonth() + 1;

  let safety = 0;

  while (safety++ < 120) {
    const statementDate = getStatementDate(statementDay, year, month);

    // IMPORTANT:
    // Do NOT generate a statement until its statement date
    // has arrived.
    //
    // Example:
    // Today:          2026-08-30
    // Statement date: 2026-09-13
    //
    // The Sep 13 statement must NOT exist yet.
    if (statementDate > todayDate) {
      break;
    }

    const { cycleStart, cycleEnd } = getCyclePeriod(
      statementDay,
      statementDate,
    );

    cycles.push({
      statementDate,
      statementDateStr: formatDate(statementDate),
      cycleStart,
      cycleEnd,
    });

    month++;

    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return cycles;
}

// ─── core scheduler for a single card ────────────────────────────────────────

async function processCard(card, allTransactions, allStatements, allBills) {
  // ── TEMPORARY DEBUG — remove after fixing ─────────────────────────────────
  console.log("[CC Debug] Processing card:", {
    id: card.id,
    name: card.name,
    payment_bill_id: card.payment_bill_id,
    source_id: card.source_id,
    status: card.status,
    statement_day: card.statement_day,
  });

  console.log("[CC Debug] Total bills loaded:", allBills.length);
  console.log(
    "[CC Debug] Bill ids in allBills:",
    allBills.map((b) => b.id),
  );

  const templateInList = allBills.find(
    (b) => Number(b.id) === Number(card.payment_bill_id),
  );
  console.log(
    "[CC Debug] Template found in allBills?",
    !!templateInList,
    templateInList
      ? {
          id: templateInList.id,
          name: templateInList.name,
          deleted_at: templateInList.deleted_at,
          notes: templateInList.notes,
        }
      : "NOT FOUND",
  );

  const cardTxsCheck = allTransactions.filter(
    (t) => Number(t.source_id) === Number(card.source_id),
  );
  console.log(
    "[CC Debug] Transactions for this card source:",
    cardTxsCheck.length,
    cardTxsCheck.map((t) => ({
      id: t.id,
      date: t.date,
      type: t.type,
      amount: t.amount,
      source_id: t.source_id,
    })),
  );
  // ── END DEBUG ──────────────────────────────────────────────────────────────

  const today = new Date();
  const todayStr = formatDate(today);

  const statementDay = Number(card.statement_day);
  if (!statementDay || card.status !== "active") return;

  if (!card.payment_bill_id) {
    console.warn(
      `[CC Scheduler] Card ${card.id} (${card.name}) has no payment_bill_id — skipping`,
    );
    return;
  }

  // Load template directly from allBills (already fetched upfront),
  // ignoring deleted_at — the template must never be soft-deleted,
  // but even if it is we still need it to generate statement bills.
  let template =
    allBills.find((b) => Number(b.id) === Number(card.payment_bill_id)) ||
    (await getRawBillById(card.payment_bill_id));

  if (!template) {
    // Template bill was hard-deleted — recreate it and update the card reference
    template = await repairMissingTemplate(card);
    if (!template) {
      console.warn(
        `[CC Scheduler] Could not repair template for card ${card.id} (${card.name}) — skipping`,
      );
      return;
    }
  }

  const cardTxs = allTransactions.filter(
    (t) => Number(t.source_id) === Number(card.source_id),
  );

  if (cardTxs.length === 0) return;

  const sortedDates = cardTxs
    .map((t) => String(t.date || "").slice(0, 10))
    .filter(Boolean)
    .sort();

  const firstTxDateStr = sortedDates[0];
  const fromDate = new Date(firstTxDateStr);
  const cycles = getAllCycles(statementDay, fromDate, today);

  for (const cycle of cycles) {
    await processCycle(
      card,
      cycle,
      cardTxs,
      allStatements,
      allBills,
      todayStr,
      template,
    );
  }
}

async function processCycle(
  card,
  cycle,
  cardTxs,
  allStatements,
  allBills,
  todayStr,
  template,
) {
  const { statementDateStr, cycleStart, cycleEnd } = cycle;

  // ── TEMPORARY DEBUG ───────────────────────────────────────────────────────
  console.log(
    `[CC Cycle Debug] Card ${card.id} | Statement: ${statementDateStr} | Cycle: ${cycleStart} → ${cycleEnd}`,
  );
  // ── END DEBUG ──

  // ── Check existing statement for this cycle ───────────────────────────────
  const existingStatement = allStatements.find(
    (s) =>
      Number(s.card_id) === Number(card.id) &&
      String(s.statement_date || "").slice(0, 10) === statementDateStr,
  );

  if (existingStatement) {
    // Bill currently linked to this statement
    const linkedBill = allBills.find(
      (b) => Number(b.id) === Number(existingStatement.bill_id),
    );

    // ─────────────────────────────────────────────────────────────
    // Check the directly linked bill first
    // ─────────────────────────────────────────────────────────────
    const isLinkedBillPaid =
      !linkedBill?.deleted_at &&
      (linkedBill?.status === BILL_STATUS.PAID || linkedBill?.is_paid === 1);

    if (isLinkedBillPaid) {
      // Paid statement → never modify it
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // IMPORTANT:
    // The statement can sometimes point to an older/duplicate
    // occurrence of the same credit-card bill.
    //
    // Example:
    //   Bill 103 → parent 5 → PAID
    //   Bill 172 → parent 5 → PENDING
    //   Statement → bill 172
    //
    // If another child of the same template is already paid,
    // associate the statement with that paid bill.
    // ─────────────────────────────────────────────────────────────
    if (linkedBill?.parent_bill_id) {
      const paidSiblingBill = allBills.find(
        (b) =>
          Number(b.parent_bill_id) === Number(linkedBill.parent_bill_id) &&
          Number(b.id) !== Number(linkedBill.id) &&
          !b.deleted_at &&
          (b.status === BILL_STATUS.PAID || b.is_paid === 1) &&
          Number(b.amount || 0) === Number(linkedBill.amount || 0) &&
          String(b.due_date || "").slice(0, 10) ===
            String(linkedBill.due_date || "").slice(0, 10),
      );

      if (paidSiblingBill) {
        console.log("[CC Scheduler] Found paid sibling bill:", {
          statementId: existingStatement.id,
          oldBillId: linkedBill.id,
          paidBillId: paidSiblingBill.id,
          parentBillId: linkedBill.parent_bill_id,
        });

        // Re-link the statement to the bill that is actually paid
        await executeSql(
          `UPDATE credit_card_statements
         SET bill_id = ?, status = ?
         WHERE id = ?`,
          [paidSiblingBill.id, "paid", existingStatement.id],
        );

        console.log(
          "[CC Scheduler] Statement re-linked to paid bill:",
          existingStatement.id,
          "→ bill",
          paidSiblingBill.id,
        );

        return;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // No paid bill found.
    // Continue with the existing unpaid-statement logic.
    // ─────────────────────────────────────────────────────────────

    const { openingBalance, purchases, payments } = calcCycleAmounts(
      cardTxs,
      cycleStart,
      cycleEnd,
    );

    const closingBalance = openingBalance + purchases - payments;

    console.log(
      `[CC Cycle Debug] Amounts | opening: ${openingBalance} | purchases: ${purchases} | payments: ${payments} | closing: ${closingBalance}`,
    );

    const txsInCycle = cardTxs.filter((t) => {
      const d = String(t.date || "").slice(0, 10);
      return d >= cycleStart && d <= cycleEnd;
    });

    console.log(
      `[CC Cycle Debug] Txs in cycle:`,
      txsInCycle.map((t) => ({
        date: t.date?.slice(0, 10),
        type: t.type,
        amount: t.amount,
      })),
    );

    if (closingBalance <= 0) {
      // Balance dropped to zero → remove statement + bill
      await softDeleteStatement(existingStatement);
      return;
    }

    await updateExistingStatement(
      existingStatement,
      closingBalance,
      purchases,
      payments,
      openingBalance,
      card,
    );

    return;
  }

  // Check whether this cycle has any transactions.
  //
  // For a closed cycle:
  //   cycleStart → cycleEnd
  //
  // For the current/open cycle:
  //   cycleStart → today
  //
  const effectiveCycleEnd = cycle.isCurrent ? todayStr : cycleEnd;

  const cycleHasTxs = cardTxs.some((t) => {
    const d = String(t.date || "").slice(0, 10);
    return d >= cycleStart && d <= cycleEnd;
  });

  if (!cycleHasTxs) return;

  const { openingBalance, purchases, payments } = calcCycleAmounts(
    cardTxs,
    cycleStart,
    cycleEnd,
  );

  const closingBalance = openingBalance + purchases - payments;

  if (closingBalance <= 0) return;

  // Calculate due date
  const dueDate = new Date(cycle.isCurrent ? todayStr : cycle.statementDate);
  if (card.due_after_days != null) {
    dueDate.setDate(dueDate.getDate() + Number(card.due_after_days || 0));
  }
  const dueDateStr = formatDate(dueDate);
  const minimumDue =
    closingBalance * (Number(card.minimum_due_percent || 0) / 100);
  // Create the bill
  const ts = nowIso();
  const billRes = await executeSql(
    `INSERT INTO bills (
      name, amount, due_date, status,
      is_recurring, recurrence_type, recurrence_interval,
      category_id, source_id, reminder_days_before,
      auto_pay, notes, attachment_url, parent_bill_id,
      is_paid, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      template.name,
      closingBalance,
      dueDateStr,
      BILL_STATUS.PENDING,
      0,
      null,
      1,
      template.category_id,
      template.source_id,
      template.reminder_days_before,
      template.auto_pay,
      `Statement ${statementDateStr}\n\n${template.notes || ""}`,
      template.attachment_url,
      template.id,
      0,
      ts,
      ts,
    ],
  );

  const billId = billRes.insertId;

  // Create statement record
  await executeSql(
    `INSERT INTO credit_card_statements (
      card_id, bill_id,
      statement_start, statement_end, statement_date, due_date,
      opening_balance, purchases, refunds, fees, interest,
      payments, closing_balance, minimum_due,
      is_generated, generated_at, status, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
    [
      card.id,
      billId,
      cycleStart,
      cycleEnd,
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
      ts,
      "generated",
    ],
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculates opening balance, purchases, and payments for a cycle.
 *
 * Opening balance = net of ALL transactions BEFORE cycleStart
 *   (expenses add to it, income/payments reduce it)
 *
 * Purchases/payments = transactions strictly within [cycleStart, cycleEnd]
 */
function calcCycleAmounts(cardTxs, cycleStart, cycleEnd) {
  let openingBalance = 0;
  let purchases = 0;
  let payments = 0;

  for (const tx of cardTxs) {
    const d = String(tx.date || "").slice(0, 10);
    const amount = Number(tx.amount || 0);

    if (d >= cycleStart && d <= cycleEnd) {
      // Within cycle — these are this statement's purchases/payments
      if (tx.type === "expense") purchases += amount;
      else if (tx.type === "income") payments += amount;
    }
    // Transactions outside this cycle window are NOT included.
    // Each statement only shows what happened in its own cycle period.
    // Opening balance carry-over is handled by the payment flow,
    // not by re-summing all historical transactions.
  }

  return { openingBalance, purchases, payments };
}

async function updateExistingStatement(
  statement,
  closingBalance,
  purchases,
  payments,
  openingBalance,
  card,
) {
  const minimumDue =
    closingBalance * (Number(card.minimum_due_percent || 0) / 100);
  const ts = nowIso();

  // Update statement row
  await executeSql(
    `UPDATE credit_card_statements SET
       opening_balance = ?,
       purchases       = ?,
       payments        = ?,
       closing_balance = ?,
       minimum_due     = ?,
       generated_at    = ?
     WHERE id = ?`,
    [
      openingBalance,
      purchases,
      payments,
      closingBalance,
      minimumDue,
      ts,
      statement.id,
    ],
  );

  // Update linked bill amount
  if (statement.bill_id) {
    await executeSql(
      `UPDATE bills SET amount = ?, updated_at = ? WHERE id = ?`,
      [closingBalance, ts, statement.bill_id],
    );
  }
}

/**
 * Soft-deletes a statement and its linked bill when balance drops to zero.
 * This frees the cycle to regenerate if balance returns.
 */
async function softDeleteStatement(statement) {
  const ts = nowIso();

  if (statement.bill_id) {
    await executeSql(
      `UPDATE bills SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [ts, ts, statement.bill_id],
    );
  }

  await executeSql(`DELETE FROM credit_card_statements WHERE id = ?`, [
    statement.id,
  ]);
}

// ─── public: run scheduler for all active cards ───────────────────────────────
export async function runCreditCardStatementScheduler() {
  try {
    const cardsRes = await executeSql(`SELECT * FROM credit_cards`, []);
    const txRes = await executeSql(
      `SELECT id, type, amount, date, source_id, is_counted FROM transactions`,
      [],
    );
    const statementsRes = await executeSql(
      `SELECT * FROM credit_card_statements`,
      [],
    );
    const billsRes = await executeSql(`SELECT * FROM bills`, []);

    const cards = rowsToArray(cardsRes);
    const txs = rowsToArray(txRes);
    const statements = rowsToArray(statementsRes);
    const bills = rowsToArray(billsRes);

    // ── TEMPORARY DEBUG — place AFTER variable declarations ──────────────────
    console.log(
      "[CC Debug] Scheduler started. Cards:",
      cards.length,
      "Bills:",
      bills.length,
      "Txs:",
      txs.length,
    );
    console.log(
      "[CC Debug] All bill ids:",
      bills.map((b) => b.id),
    );
    console.log(
      "[CC Debug] Cards payment_bill_ids:",
      cards.map((c) => ({ card: c.id, payment_bill_id: c.payment_bill_id })),
    );
    // ── END DEBUG ─────────────────────────────────────────────────────────────

    for (const card of cards) {
      try {
        await processCard(card, txs, statements, bills);
      } catch (cardErr) {
        console.error(
          `[CC Scheduler] Card ${card.id} (${card.name}) failed:`,
          cardErr,
        );
      }
    }

    emit("billsChanged");
  } catch (err) {
    console.error("[CC Scheduler] Fatal error:", err);
    throw err;
  }
}

// ─── public: delete a statement and regenerate immediately ────────────────────

/**
 * Deletes a credit card statement (and its linked bill),
 * then immediately re-runs the scheduler so it regenerates
 * if transactions still exist in that cycle.
 *
 * Rules:
 * - If the statement's bill was PAID, the statement regenerates
 *   as UNPAID (the payment history stays in transactions).
 * - Caller should pass the full statement row from credit_card_statements.
 */
export async function deleteStatement(statementId) {
  const stmtRes = await executeSql(
    `SELECT * FROM credit_card_statements WHERE id = ?`,
    [statementId],
  );

  if (!stmtRes.rows.length) {
    console.warn(
      `[CC Scheduler] deleteStatement: statement ${statementId} not found`,
    );
    return;
  }

  const statement = stmtRes.rows.item(0);
  const ts = nowIso();

  // Hard-delete the statement row
  await executeSql(`DELETE FROM credit_card_statements WHERE id = ?`, [
    statementId,
  ]);

  // Soft-delete the linked bill (so it disappears from Bills screen)
  if (statement.bill_id) {
    await executeSql(
      `UPDATE bills SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [ts, ts, statement.bill_id],
    );
  }

  // Immediately re-run scheduler — will regenerate this cycle if balance > 0
  await runCreditCardStatementScheduler();
}

// ─── public: call this when a transaction is added/edited/deleted ─────────────

/**
 * Re-runs the scheduler for cards whose source matches the transaction's source_id.
 * Call this whenever a transaction touching a credit card source changes.
 */
export async function onCardTransactionChanged(sourceId) {
  try {
    const cardsRes = await executeSql(
      `SELECT * FROM credit_cards WHERE source_id = ? AND status = 'active'`,
      [sourceId],
    );

    if (!cardsRes.rows.length) return; // Not a credit card source

    // Full scheduler re-run (it loads fresh data)
    await runCreditCardStatementScheduler();
  } catch (err) {
    console.error("[CC Scheduler] onCardTransactionChanged error:", err);
  }
}

// ─── public: call this when a statement bill is marked paid ──────────────────

/**
 * After marking a statement's bill as paid, call this so the scheduler
 * can immediately check whether the next cycle needs a statement.
 */
export async function onStatementPaid(cardId) {
  try {
    await runCreditCardStatementScheduler();
  } catch (err) {
    console.error("[CC Scheduler] onStatementPaid error:", err);
  }
}
