export async function healBogusStatementRefunds() {
  try {
    const stmtsRes = await executeSql(`SELECT * FROM credit_card_statements`, []);
    const stmts = rowsToArray(stmtsRes).filter((s) => Number(s.refunds || 0) > 0);
    if (!stmts.length) return;

    for (const stmt of stmts) {
      const cardRes = await executeSql(`SELECT source_id FROM credit_cards WHERE id = ?`, [stmt.card_id]);
      if (!cardRes.rows.length) continue;
      const sourceId = cardRes.rows.item(0).source_id;

      const txsRes = await executeSql(`SELECT * FROM transactions WHERE source_id = ?`, [sourceId]);
      const cardTxs = rowsToArray(txsRes);
      const { refunds: actualRefunds } = calcCycleAmounts(cardTxs, stmt.statement_start, stmt.statement_end);

      // If statement's refunds exceeds actual merchant refunds
      if (Number(stmt.is_generated) === 1 && Number(stmt.refunds || 0) > actualRefunds) {
        console.log(
          `[CC Scheduler Healing] Statement #${stmt.id}: resetting refunds from ${stmt.refunds} to ${actualRefunds}`
        );
        const oldRefunds = Number(stmt.refunds || 0);
        const refundDiff = oldRefunds - actualRefunds;
        const newClosingBalance = Math.max(0, Number(stmt.closing_balance || 0) + refundDiff);

        let newPayments = Number(stmt.payments || 0);
        if (stmt.status === 'paid') {
          newPayments = newClosingBalance;
        }

        await executeSql(
          `UPDATE credit_card_statements
           SET refunds = ?, closing_balance = ?, payments = ?
           WHERE id = ?`,
          [actualRefunds, newClosingBalance, newPayments, stmt.id]
        );

        if (stmt.bill_id) {
          await executeSql(
            `UPDATE bills SET amount = ? WHERE id = ?`,
            [newClosingBalance, stmt.bill_id]
          );
        }
      }
    }
  } catch (err) {
    console.warn("[CC Scheduler] Error in healBogusStatementRefunds:", err);
  }
}

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

export function getTxDateString(dateVal) {
  if (!dateVal) return "";
  const str = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str.includes(" ") ? str.replace(" ", "T") : str);
  if (isNaN(d.getTime())) return str.slice(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    `[CC Scheduler] Repairing missing template bill for card ${card.id} (${card.name})`
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
      ts]

  );

  const newBillId = billRes.insertId;

  // Update the credit card to point to the new template
  await executeSql(
    `UPDATE credit_cards SET payment_bill_id = ?, updated_at = ? WHERE id = ?`,
    [newBillId, ts, card.id]
  );

  console.log(
    `[CC Scheduler] Repaired: card ${card.id} now has template bill ${newBillId}`
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
 *   cycleStart = previous statement date (e.g. 2026-09-13)
 *   cycleEnd   = day before this statement date (e.g. 2026-10-12)
 *
 * Example (statement_day = 13):
 *   Statement date : 2026-10-13
 *   cycleStart     : 2026-09-13 (starts on September 13th)
 *   cycleEnd       : 2026-10-12 (ends on October 12th)
 */
function getCyclePeriod(statementDay, statementDate) {
  // Previous statement date: same day last month (clamped)
  const prevYear =
    statementDate.getMonth() === 0 ?
      statementDate.getFullYear() - 1 :
      statementDate.getFullYear();
  const prevMonth =
    statementDate.getMonth() === 0 ? 12 : statementDate.getMonth(); // getMonth() is 0-based, so this gives previous month 1-based
  const prevDay = clampDay(statementDay, prevYear, prevMonth);
  const prevStatementDate = new Date(prevYear, prevMonth - 1, prevDay);

  // Billing cycle STARTS on previous statement date (e.g. Sep 13)
  const cycleStart = new Date(prevStatementDate);

  // Billing cycle ENDS day before current statement date (e.g. Oct 12)
  const cycleEnd = new Date(statementDate);
  cycleEnd.setDate(cycleEnd.getDate() - 1);

  return {
    cycleStart: formatDate(cycleStart),
    cycleEnd: formatDate(cycleEnd)
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
    if (formatDate(statementDate) > formatDate(todayDate)) {
      break;
    }

    const { cycleStart, cycleEnd } = getCyclePeriod(
      statementDay,
      statementDate
    );

    cycles.push({
      statementDate,
      statementDateStr: formatDate(statementDate),
      cycleStart,
      cycleEnd
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
    statement_day: card.statement_day
  });

  console.log("[CC Debug] Total bills loaded:", allBills.length);
  console.log(
    "[CC Debug] Bill ids in allBills:",
    allBills.map((b) => b.id)
  );

  const templateInList = allBills.find(
    (b) => Number(b.id) === Number(card.payment_bill_id)
  );
  console.log(
    "[CC Debug] Template found in allBills?",
    !!templateInList,
    templateInList ?
      {
        id: templateInList.id,
        name: templateInList.name,
        deleted_at: templateInList.deleted_at,
        notes: templateInList.notes
      } :
      "NOT FOUND"
  );

  const cardTxsCheck = allTransactions.filter(
    (t) => Number(t.source_id) === Number(card.source_id)
  );
  console.log(
    "[CC Debug] Transactions for this card source:",
    cardTxsCheck.length,
    cardTxsCheck.map((t) => ({
      id: t.id,
      date: t.date,
      type: t.type,
      amount: t.amount,
      source_id: t.source_id
    }))
  );
  // ── END DEBUG ──────────────────────────────────────────────────────────────

  const today = new Date();
  const todayStr = formatDate(today);

  const statementDay = Number(card.statement_day);
  if (!statementDay || card.status !== "active") return;

  if (!card.payment_bill_id) {
    console.warn(
      `[CC Scheduler] Card ${card.id} (${card.name}) has no payment_bill_id — skipping`
    );
    return;
  }

  // Load template directly from allBills (already fetched upfront),
  // ignoring deleted_at — the template must never be soft-deleted,
  // but even if it is we still need it to generate statement bills.
  let template =
    allBills.find((b) => Number(b.id) === Number(card.payment_bill_id)) || (
      await getRawBillById(card.payment_bill_id));

  if (!template) {
    // Template bill was hard-deleted — recreate it and update the card reference
    template = await repairMissingTemplate(card);
    if (!template) {
      console.warn(
        `[CC Scheduler] Could not repair template for card ${card.id} (${card.name}) — skipping`
      );
      return;
    }
  }

  const cardTxs = allTransactions.filter(
    (t) => Number(t.source_id) === Number(card.source_id)
  );

  if (cardTxs.length === 0) return;

  const sortedDates = cardTxs.
    map((t) => String(t.date || "").slice(0, 10)).
    filter(Boolean).
    sort();

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
      template
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
  template) {
  const { statementDateStr, cycleStart, cycleEnd } = cycle;

  // ── TEMPORARY DEBUG ───────────────────────────────────────────────────────
  console.log(
    `[CC Cycle Debug] Card ${card.id} | Statement: ${statementDateStr} | Cycle: ${cycleStart} → ${cycleEnd}`
  );
  // ── END DEBUG ──

  // ── Check existing statement for this cycle ───────────────────────────────
  const existingStatement = allStatements.find(
    (s) =>
      Number(s.card_id) === Number(card.id) &&
      String(s.statement_date || "").slice(0, 10) === statementDateStr
  );

  if (existingStatement) {
    // Bill currently linked to this statement
    const linkedBill = allBills.find(
      (b) => Number(b.id) === Number(existingStatement.bill_id)
    );

    // ─────────────────────────────────────────────────────────────
    // Check the directly linked bill first
    // ─────────────────────────────────────────────────────────────
    const isLinkedBillPaid =
      !linkedBill?.deleted_at && (
        linkedBill?.status === BILL_STATUS.PAID || linkedBill?.is_paid === 1);

    if (isLinkedBillPaid) {
      // Paid statement → never modify financial amounts
      // But ensure statement cycle dates and purchases match the cycle
      const { purchases: paidPurchases } = calcCycleAmounts(
        cardTxs,
        cycleStart,
        cycleEnd
      );
      if (
        existingStatement.statement_start !== cycleStart ||
        existingStatement.statement_end !== cycleEnd ||
        Number(existingStatement.purchases || 0) !== paidPurchases
      ) {
        await executeSql(
          `UPDATE credit_card_statements SET statement_start = ?, statement_end = ?, purchases = ? WHERE id = ?`,
          [cycleStart, cycleEnd, paidPurchases, existingStatement.id]
        );
        existingStatement.statement_start = cycleStart;
        existingStatement.statement_end = cycleEnd;
        existingStatement.purchases = paidPurchases;
      }
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
          !b.deleted_at && (
            b.status === BILL_STATUS.PAID || b.is_paid === 1) &&
          (
            String(b.notes || "").includes(`Statement ${statementDateStr}`) ||
            String(b.due_date || "").slice(0, 10) === String(linkedBill.due_date || "").slice(0, 10)
          )
      );

      if (paidSiblingBill) {
        console.log("[CC Scheduler] Found paid sibling bill:", {
          statementId: existingStatement.id,
          oldBillId: linkedBill.id,
          paidBillId: paidSiblingBill.id,
          parentBillId: linkedBill.parent_bill_id
        });

        // Re-link the statement to the bill that is actually paid
        await executeSql(
          `UPDATE credit_card_statements
         SET bill_id = ?, status = ?, payments = closing_balance
         WHERE id = ?`,
          [paidSiblingBill.id, "paid", existingStatement.id]
        );

        existingStatement.bill_id = paidSiblingBill.id;
        existingStatement.status = "paid";

        // Clean up duplicate unpaid bill if it has no linked transactions
        if (linkedBill && linkedBill.is_paid !== 1 && linkedBill.status !== BILL_STATUS.PAID) {
          try {
            const txLinksRes = await executeSql(
              `SELECT COUNT(*) as count FROM bill_linked_transactions WHERE bill_id = ?`,
              [linkedBill.id]
            );
            const count = txLinksRes.rows.length > 0 ? txLinksRes.rows.item(0).count : 0;
            if (count === 0) {
              await executeSql(`DELETE FROM bills WHERE id = ?`, [linkedBill.id]);
            }
          } catch (cleanErr) {
            console.warn("[CC Scheduler] Error cleaning up duplicate unpaid bill:", cleanErr);
          }
        }

        console.log(
          "[CC Scheduler] Statement re-linked to paid bill:",
          existingStatement.id,
          "→ bill",
          paidSiblingBill.id
        );

        return;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // No paid bill found.
    // Continue with the existing unpaid-statement logic.
    // ─────────────────────────────────────────────────────────────

    // Find previous statement to determine opening balance
    const pastStatements = allStatements.filter((s) => Number(s.card_id) === Number(card.id) && s.statement_end < cycleStart);
    pastStatements.sort((a, b) => String(b.statement_end || '').localeCompare(String(a.statement_end || '')));
    const previousStatement = pastStatements[0];

    let prevCarryOver = 0;
    let isPrevPaid = false;
    if (previousStatement) {
      isPrevPaid = previousStatement.status === 'paid';
      if (!isPrevPaid && Number(previousStatement.closing_balance || 0) > 0 && Number(previousStatement.payments || 0) >= Number(previousStatement.closing_balance || 0)) {
        isPrevPaid = true;
      }
      if (!isPrevPaid && previousStatement.bill_id) {
        const prevBill = allBills.find((b) => Number(b.id) === Number(previousStatement.bill_id));
        isPrevPaid = prevBill && !prevBill.deleted_at && (prevBill.status === BILL_STATUS.PAID || prevBill.is_paid === 1);
      }
      if (!isPrevPaid && card.payment_bill_id) {
        const prevStmtDateStr = String(previousStatement.statement_date || "").slice(0, 10);
        const prevDueDateStr = String(previousStatement.due_date || "").slice(0, 10);
        const paidSiblingBill = allBills.find(
          (b) =>
            Number(b.parent_bill_id) === Number(card.payment_bill_id) &&
            !b.deleted_at &&
            (b.status === BILL_STATUS.PAID || b.is_paid === 1) &&
            (
              String(b.notes || "").includes(`Statement ${prevStmtDateStr}`) ||
              (b.due_date && String(b.due_date).slice(0, 10) === prevDueDateStr)
            )
        );
        if (paidSiblingBill) {
          isPrevPaid = true;
        }
      }
      if (!isPrevPaid) {
        prevCarryOver = Math.max(0, Number(previousStatement.closing_balance || 0) - Number(previousStatement.payments || 0));
      }
    }

    const { purchases, payments: inCyclePayments, refunds: inCycleRefunds } = calcCycleAmounts(
      cardTxs,
      cycleStart,
      cycleEnd
    );

    const openingBalance = Number(existingStatement.is_generated) === 0 && existingStatement.opening_balance != null
      ? Number(existingStatement.opening_balance)
      : prevCarryOver;

    const statementFees = Number(existingStatement.fees || 0);
    const autoInterest = previousStatement && !isPrevPaid && Number(card.interest_rate_percent || 0) > 0
      ? (openingBalance * (Number(card.interest_rate_percent) / 100)) / 12
      : 0;
    const statementInterest = Number(existingStatement.is_generated) === 0
      ? Number(existingStatement.interest || 0)
      : autoInterest;
    const statementRefunds = Number(existingStatement.is_generated) === 0 ? Number(existingStatement.refunds || 0) : inCycleRefunds;

    // Calculate new closing balance keeping existing fees/interest and actual in-cycle refunds
    const closingBalance = Math.max(0, openingBalance + purchases + statementFees + statementInterest - statementRefunds);

    console.log(
      `[CC Cycle Debug] Amounts | opening: ${openingBalance} | purchases: ${purchases} | refunds: ${statementRefunds} | closing: ${closingBalance}`
    );

    const txsInCycle = cardTxs.filter((t) => {
      const d = getTxDateString(t.date);
      const rawD = String(t.date || "").slice(0, 10);
      return (d >= cycleStart && d <= cycleEnd) || (rawD >= cycleStart && rawD <= cycleEnd);
    });

    console.log(
      `[CC Cycle Debug] Txs in cycle:`,
      txsInCycle.map((t) => ({
        date: t.date?.slice(0, 10),
        type: t.type,
        amount: t.amount
      }))
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
      statementRefunds,
      openingBalance,
      card,
      cycleStart,
      cycleEnd,
      statementFees,
      statementInterest
    );

    existingStatement.statement_start = cycleStart;
    existingStatement.statement_end = cycleEnd;
    existingStatement.opening_balance = openingBalance;
    existingStatement.purchases = purchases;
    existingStatement.fees = statementFees;
    existingStatement.interest = statementInterest;
    existingStatement.refunds = statementRefunds;
    existingStatement.closing_balance = closingBalance;

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
    const d = getTxDateString(t.date);
    const rawD = String(t.date || "").slice(0, 10);
    return (d >= cycleStart && d <= cycleEnd) || (rawD >= cycleStart && rawD <= cycleEnd);
  });

  if (!cycleHasTxs) return;

  const pastStatements = allStatements.filter((s) => Number(s.card_id) === Number(card.id) && s.statement_end < cycleStart);
  pastStatements.sort((a, b) => String(b.statement_end || '').localeCompare(String(a.statement_end || '')));
  const previousStatement = pastStatements[0];

  let openingBalance = 0;
  let isPrevPaid = false;
  if (previousStatement) {
    isPrevPaid = previousStatement.status === 'paid';
    if (!isPrevPaid && Number(previousStatement.closing_balance || 0) > 0 && Number(previousStatement.payments || 0) >= Number(previousStatement.closing_balance || 0)) {
      isPrevPaid = true;
    }
    if (!isPrevPaid && previousStatement.bill_id) {
      const prevBill = allBills.find((b) => Number(b.id) === Number(previousStatement.bill_id));
      isPrevPaid = prevBill && !prevBill.deleted_at && (prevBill.status === BILL_STATUS.PAID || prevBill.is_paid === 1);
    }
    if (!isPrevPaid && card.payment_bill_id) {
      const prevStmtDateStr = String(previousStatement.statement_date || "").slice(0, 10);
      const prevDueDateStr = String(previousStatement.due_date || "").slice(0, 10);
      const paidSiblingBill = allBills.find(
        (b) =>
          Number(b.parent_bill_id) === Number(card.payment_bill_id) &&
          !b.deleted_at &&
          (b.status === BILL_STATUS.PAID || b.is_paid === 1) &&
          (
            String(b.notes || "").includes(`Statement ${prevStmtDateStr}`) ||
            (b.due_date && String(b.due_date).slice(0, 10) === prevDueDateStr)
          )
      );
      if (paidSiblingBill) {
        isPrevPaid = true;
      }
    }
    if (!isPrevPaid) {
      openingBalance = Math.max(0, Number(previousStatement.closing_balance || 0) - Number(previousStatement.payments || 0));
    }
  }

  let autoInterest = 0;
  if (previousStatement && !isPrevPaid && Number(card.interest_rate_percent || 0) > 0) {
    autoInterest = (openingBalance * (Number(card.interest_rate_percent) / 100)) / 12;
  }

  const { purchases, payments: inCyclePayments, refunds: inCycleRefunds } = calcCycleAmounts(
    cardTxs,
    cycleStart,
    cycleEnd
  );

  const closingBalance = Math.max(0, openingBalance + purchases + autoInterest - inCycleRefunds);

  if (closingBalance <= 0) return;

  // Calculate due date
  const dueDate = new Date(cycle.isCurrent ? todayStr : cycle.statementDate);
  if (card.due_after_days != null) {
    dueDate.setDate(dueDate.getDate() + Number(card.due_after_days || 0));
  }
  const dueDateStr = formatDate(dueDate);
  const minimumDue =
    closingBalance * (Number(card.minimum_due_percent || 0) / 100);

  // Check if an existing paid bill already exists for this card and statement cycle
  const existingPaidBill = allBills.find(
    (b) =>
      !b.deleted_at &&
      Number(b.parent_bill_id) === Number(template.id) &&
      (b.status === BILL_STATUS.PAID || b.is_paid === 1) &&
      (
        String(b.notes || "").includes(`Statement ${statementDateStr}`) ||
        (b.due_date && String(b.due_date).slice(0, 10) === dueDateStr)
      )
  );

  let billId;
  let stmtStatus = "generated";
  let stmtPayments = 0;

  if (existingPaidBill) {
    billId = existingPaidBill.id;
    stmtStatus = "paid";
    stmtPayments = closingBalance;
  } else {
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
      ]
    );
    billId = billRes.insertId;
  }

  const ts = nowIso();
  const stmtRes = await executeSql(
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
      inCycleRefunds, // actual merchant refunds in this cycle
      0, // fees
      autoInterest, // auto calculated interest
      stmtPayments,
      closingBalance,
      minimumDue,
      1,
      ts,
      stmtStatus,
    ]
  );

  allStatements.push({
    id: stmtRes.insertId,
    card_id: card.id,
    bill_id: billId,
    statement_start: cycleStart,
    statement_end: cycleEnd,
    statement_date: statementDateStr,
    due_date: dueDateStr,
    opening_balance: openingBalance,
    purchases,
    refunds: 0,
    fees: 0,
    interest: autoInterest,
    payments: 0,
    closing_balance: closingBalance,
    minimum_due: minimumDue,
    status: "generated",
  });

  try {
    const Notifications = require('expo-notifications');
    const formattedAmount = Number(closingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Statement Generated',
        body: `Your ${card.name} statement for ${formattedAmount} is ready.`,
        data: { screen: 'BillDetail', billId: billId },
        sound: true
      },
      trigger: null // Deliver immediately
    });
  } catch (e) {
    console.warn('Failed to notify statement generation', e);
  }
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
  let purchases = 0;
  let payments = 0;
  let refunds = 0;

  for (const tx of cardTxs) {
    const d = getTxDateString(tx.date);
    const rawD = String(tx.date || "").slice(0, 10);
    const amount = Number(tx.amount || 0);

    const inRange =
      (d >= cycleStart && d <= cycleEnd) ||
      (rawD >= cycleStart && rawD <= cycleEnd);

    if (inRange) {
      // Within cycle — these are this statement's purchases/payments/refunds.
      // Note: Include all transactions regardless of is_counted (including is_counted === 0,
      // i.e. "Not a Spend" and "Not a Income") because all credit card charges and credits
      // must be reflected on the credit card statement.
      if (tx.type === "expense") {
        purchases += amount;
      } else if (tx.type === "income") {
        const noteOrTitle = `${tx.notes || ""} ${tx.title || ""} ${tx.category_name || ""}`.toLowerCase();
        const isTransferOrPayment = !!(
          (tx.transfer_group_id && String(tx.transfer_group_id).trim() !== "") ||
          tx.is_transfer === 1 ||
          tx.direction === "credit" ||
          tx.bill_id ||
          noteOrTitle.includes("payment") ||
          noteOrTitle.includes("bill")
        );

        if (isTransferOrPayment) {
          payments += amount;
        } else {
          refunds += amount;
        }
      }
    }
  }

  return { purchases, payments, refunds };
}

async function updateExistingStatement(
  statement,
  closingBalance,
  purchases,
  effectiveRefunds,
  openingBalance,
  card,
  cycleStart,
  cycleEnd,
  fees = 0,
  interest = 0
) {
  const minimumDue =
    closingBalance * (Number(card.minimum_due_percent || 0) / 100);
  const ts = nowIso();
  const finalStart = cycleStart || statement.statement_start;
  const finalEnd = cycleEnd || statement.statement_end;

  // Update statement row
  await executeSql(
    `UPDATE credit_card_statements SET
       statement_start = ?,
       statement_end   = ?,
       opening_balance = ?,
       purchases       = ?,
       fees            = ?,
       interest        = ?,
       refunds         = ?,
       closing_balance = ?,
       minimum_due     = ?,
       generated_at    = ?
     WHERE id = ?`,
    [
      finalStart,
      finalEnd,
      openingBalance,
      purchases,
      fees,
      interest,
      effectiveRefunds,
      closingBalance,
      minimumDue,
      ts,
      statement.id,
    ]
  );

  // Update linked bill amount if not paid
  if (statement.bill_id) {
    const bRes = await executeSql(`SELECT status, is_paid FROM bills WHERE id = ?`, [statement.bill_id]);
    if (bRes.rows.length > 0) {
      const b = bRes.rows.item(0);
      if (b.status !== 'paid' && b.is_paid === 0) {
        await executeSql(
          `UPDATE bills SET amount = ?, updated_at = ? WHERE id = ?`,
          [closingBalance, ts, statement.bill_id]
        );
      }
    }
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
      [ts, ts, statement.bill_id]
    );
  }

  await executeSql(`DELETE FROM credit_card_statements WHERE id = ?`, [
    statement.id]
  );
}

// ─── public: run scheduler for all active cards ───────────────────────────────
export async function runCreditCardStatementScheduler() {
  try {
    await healBogusStatementRefunds();
    // Self-healing: Un-soft-delete any paid bills that were accidentally marked deleted by earlier buggy regeneration
    try {
      await executeSql(
        `UPDATE bills SET deleted_at = NULL WHERE is_paid = 1 AND deleted_at IS NOT NULL`,
        []
      );
      await executeSql(
        `UPDATE bills SET deleted_at = NULL WHERE status = 'paid' AND deleted_at IS NOT NULL`,
        []
      );
    } catch (healErr) {
      console.warn("[CC Scheduler] Error healing soft-deleted paid bills:", healErr);
    }

    const cardsRes = await executeSql(`SELECT * FROM credit_cards`, []);
    const txRes = await executeSql(
      `SELECT * FROM transactions`,
      []
    );
    const statementsRes = await executeSql(
      `SELECT * FROM credit_card_statements`,
      []
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
      txs.length
    );
    console.log(
      "[CC Debug] All bill ids:",
      bills.map((b) => b.id)
    );
    console.log(
      "[CC Debug] Cards payment_bill_ids:",
      cards.map((c) => ({ card: c.id, payment_bill_id: c.payment_bill_id }))
    );
    // ── END DEBUG ─────────────────────────────────────────────────────────────

    for (const card of cards) {
      try {
        await processCard(card, txs, statements, bills);
        try {
          const { refreshCreditCardTotals, syncCreditCardBillAmount } = require("./creditCards");
          await refreshCreditCardTotals(card.id);
          await syncCreditCardBillAmount(card.id);
        } catch (syncErr) {
          console.warn(`[CC Scheduler] Card ${card.id} totals sync warning:`, syncErr);
        }
      } catch (cardErr) {
        console.error(
          `[CC Scheduler] Card ${card.id} (${card.name}) failed:`,
          cardErr
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
 * Deletes a credit card statement.
 * If the statement's bill is UNPAID, soft-deletes the bill.
 * If the bill is PAID, preserves the paid bill.
 * Then re-runs the scheduler so it regenerates properly.
 */
export async function deleteStatement(statementId) {
  const stmtRes = await executeSql(
    `SELECT * FROM credit_card_statements WHERE id = ?`,
    [statementId]
  );

  if (!stmtRes.rows.length) {
    console.warn(
      `[CC Scheduler] deleteStatement: statement ${statementId} not found`
    );
    return;
  }

  const statement = stmtRes.rows.item(0);
  const ts = nowIso();

  // Hard-delete the statement row
  await executeSql(`DELETE FROM credit_card_statements WHERE id = ?`, [
    statementId
  ]);

  // Soft-delete the linked bill ONLY IF it is not paid
  if (statement.bill_id) {
    try {
      const billRes = await executeSql(
        `SELECT status, is_paid FROM bills WHERE id = ?`,
        [statement.bill_id]
      );
      const bill = billRes.rows.length > 0 ? billRes.rows.item(0) : null;
      const isPaid = bill && (bill.status === BILL_STATUS.PAID || bill.is_paid === 1);
      if (!isPaid) {
        await executeSql(
          `UPDATE bills SET deleted_at = ?, updated_at = ? WHERE id = ?`,
          [ts, ts, statement.bill_id]
        );
      }
    } catch (e) {
      console.warn("[CC Scheduler] Error checking bill paid status on delete:", e);
    }
  }

  // Immediately re-run scheduler — will regenerate this cycle if balance > 0
  await runCreditCardStatementScheduler();
}

// ─── public: regenerate statement without resetting paid bills ────────────────

/**
 * Regenerates a credit card statement based on latest transactions.
 * If the statement's bill was already paid, the paid bill is PRESERVED and NOT reset.
 * If the bill was unpaid, its amount and due date can be updated to match the latest balance.
 */
export async function regenerateCreditCardStatement(statementId) {
  const stmtRes = await executeSql(
    `SELECT * FROM credit_card_statements WHERE id = ?`,
    [statementId]
  );

  if (!stmtRes.rows.length) {
    console.warn(
      `[CC Scheduler] regenerateCreditCardStatement: statement ${statementId} not found`
    );
    return;
  }

  const statement = stmtRes.rows.item(0);
  const cardRes = await executeSql(
    `SELECT * FROM credit_cards WHERE id = ?`,
    [statement.card_id]
  );
  if (!cardRes.rows.length) return;
  const card = cardRes.rows.item(0);

  // Check if linked bill is paid
  let isBillPaid = false;
  let linkedBill = null;
  if (statement.bill_id) {
    const billRes = await executeSql(
      `SELECT * FROM bills WHERE id = ?`,
      [statement.bill_id]
    );
    if (billRes.rows.length > 0) {
      linkedBill = billRes.rows.item(0);
      isBillPaid = !linkedBill.deleted_at && (linkedBill.status === BILL_STATUS.PAID || linkedBill.is_paid === 1);
    }
  }
  if (!isBillPaid && statement.status === "paid") {
    isBillPaid = true;
  }

  const statementDay = Number(card.statement_day);
  const statementDate = new Date(statement.statement_date);
  const { cycleStart, cycleEnd } = getCyclePeriod(statementDay, statementDate);
  const statementDateStr = String(statement.statement_date || "").slice(0, 10);

  // If directly linked bill is not paid, check if a paid sibling bill exists for this cycle
  if (!isBillPaid && card.payment_bill_id) {
    try {
      const siblingRes = await executeSql(
        `SELECT * FROM bills WHERE parent_bill_id = ?`,
        [card.payment_bill_id]
      );
      for (let i = 0; i < siblingRes.rows.length; i++) {
        const b = siblingRes.rows.item(i);
        if (!b.deleted_at && (b.status === BILL_STATUS.PAID || b.is_paid === 1)) {
          const notesMatch = String(b.notes || "").includes(`Statement ${statementDateStr}`);
          const dateMatch = b.due_date && String(b.due_date).slice(0, 10) === String(statement.due_date || "").slice(0, 10);
          if (notesMatch || dateMatch) {
            linkedBill = b;
            isBillPaid = true;
            // Re-link statement to this paid bill
            await executeSql(
              `UPDATE credit_card_statements SET bill_id = ?, status = 'paid', payments = closing_balance WHERE id = ?`,
              [b.id, statement.id]
            );
            break;
          }
        }
      }
    } catch (e) {
      console.warn("[CC Scheduler] Error checking paid sibling bill on regenerate:", e);
    }
  }

  const txRes = await executeSql(
    `SELECT * FROM transactions WHERE source_id = ?`,
    [card.source_id]
  );
  const cardTxs = rowsToArray(txRes);

  const { purchases, payments: inCyclePayments, refunds: inCycleRefunds } = calcCycleAmounts(cardTxs, cycleStart, cycleEnd);
  const ts = nowIso();

  const statementFees = Number(statement.fees || 0);
  const statementRefunds = Number(statement.is_generated) === 0 ? Number(statement.refunds || 0) : inCycleRefunds;

  if (isBillPaid) {
    // ─────────────────────────────────────────────────────────────
    // PAID: DO NOT reset or alter the paid bill!
    // Update statement cycle dates and purchases to match current transactions
    // ─────────────────────────────────────────────────────────────
    const paidInterest = Number(statement.interest || 0);
    await executeSql(
      `UPDATE credit_card_statements SET
         statement_start = ?,
         statement_end   = ?,
         purchases       = ?,
         fees            = ?,
         interest        = ?,
         refunds         = ?,
         status          = 'paid',
         payments        = closing_balance,
         generated_at    = ?
       WHERE id = ?`,
      [cycleStart, cycleEnd, purchases, statementFees, paidInterest, statementRefunds, ts, statement.id]
    );

    // Re-run scheduler so downstream statements/balances are kept in sync
    await runCreditCardStatementScheduler();
    return;
  }

  // ─────────────────────────────────────────────────────────────
  // UNPAID: Recalculate financial amounts and update unpaid bill
  // ─────────────────────────────────────────────────────────────
  const pastStmtRes = await executeSql(
    `SELECT * FROM credit_card_statements WHERE card_id = ?`,
    [card.id]
  );
  const pastStatements = rowsToArray(pastStmtRes).filter(
    (s) => Number(s.id) !== Number(statement.id) && s.statement_end < cycleStart
  );
  pastStatements.sort((a, b) => String(b.statement_end || '').localeCompare(String(a.statement_end || '')));
  const previousStatement = pastStatements[0];

  let prevCarryOver = 0;
  let isPrevPaid = false;
  if (previousStatement) {
    isPrevPaid = previousStatement.status === 'paid';
    if (!isPrevPaid && Number(previousStatement.closing_balance || 0) > 0 && Number(previousStatement.payments || 0) >= Number(previousStatement.closing_balance || 0)) {
      isPrevPaid = true;
    }
    if (!isPrevPaid && previousStatement.bill_id) {
      const pbRes = await executeSql(
        `SELECT status, is_paid, deleted_at FROM bills WHERE id = ?`,
        [previousStatement.bill_id]
      );
      if (pbRes.rows.length > 0) {
        const pb = pbRes.rows.item(0);
        isPrevPaid = !pb.deleted_at && (pb.status === BILL_STATUS.PAID || pb.is_paid === 1);
      }
    }
    if (!isPrevPaid && card.payment_bill_id) {
      const prevStmtDateStr = String(previousStatement.statement_date || "").slice(0, 10);
      const prevDueDateStr = String(previousStatement.due_date || "").slice(0, 10);
      const sibRes = await executeSql(
        `SELECT * FROM bills WHERE parent_bill_id = ? AND deleted_at IS NULL AND (status = 'paid' OR is_paid = 1)`,
        [card.payment_bill_id]
      );
      for (let i = 0; i < sibRes.rows.length; i++) {
        const b = sibRes.rows.item(i);
        if (
          String(b.notes || "").includes(`Statement ${prevStmtDateStr}`) ||
          (b.due_date && String(b.due_date).slice(0, 10) === prevDueDateStr)
        ) {
          isPrevPaid = true;
          break;
        }
      }
    }
    if (!isPrevPaid) {
      prevCarryOver = Math.max(0, Number(previousStatement.closing_balance || 0) - Number(previousStatement.payments || 0));
    }
  }
  const openingBalance = previousStatement
    ? prevCarryOver
    : (Number(statement.is_generated) === 0 && statement.opening_balance != null
      ? Number(statement.opening_balance)
      : prevCarryOver);

  let autoInterest = 0;
  if (previousStatement && !isPrevPaid && Number(card.interest_rate_percent || 0) > 0) {
    autoInterest = (openingBalance * (Number(card.interest_rate_percent) / 100)) / 12;
  }

  const statementInterest = Number(statement.is_generated) === 0 ? Number(statement.interest || 0) : autoInterest;

  const closingBalance = Math.max(
    0,
    openingBalance +
    purchases +
    statementFees +
    statementInterest -
    statementRefunds
  );

  if (closingBalance <= 0) {
    await softDeleteStatement(statement);
    await runCreditCardStatementScheduler();
    return;
  }

  const minimumDue = closingBalance * (Number(card.minimum_due_percent || 0) / 100);

  await executeSql(
    `UPDATE credit_card_statements SET
       statement_start = ?,
       statement_end   = ?,
       opening_balance = ?,
       purchases       = ?,
       fees            = ?,
       interest        = ?,
       refunds         = ?,
       closing_balance = ?,
       minimum_due     = ?,
       generated_at    = ?
     WHERE id = ?`,
    [cycleStart, cycleEnd, openingBalance, purchases, statementFees, statementInterest, statementRefunds, closingBalance, minimumDue, ts, statement.id]
  );

  if (statement.bill_id && linkedBill && !linkedBill.deleted_at) {
    await executeSql(
      `UPDATE bills SET amount = ?, updated_at = ? WHERE id = ?`,
      [closingBalance, ts, statement.bill_id]
    );
  }

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
      [sourceId]
    );

    if (!cardsRes.rows.length) return; // Not a credit card source

    // Refresh card totals and recurring bill amount
    try {
      const { refreshCreditCardTotals, syncCreditCardBillAmount } = require("./creditCards");
      for (let i = 0; i < cardsRes.rows.length; i++) {
        const c = cardsRes.rows.item(i);
        await refreshCreditCardTotals(c.id);
        await syncCreditCardBillAmount(c.id);
      }
    } catch (e) {
      console.warn("[CC Scheduler] Error syncing card totals onCardTransactionChanged:", e);
    }

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