import { executeSql } from "../database/db";
import { createSource, updateSource } from "./sources";
import { createTransfer } from "./transactions";
import { createBill, updateBill, deleteBill } from "./bills";
import { BILL_STATUS } from "./billUtils";

export async function createCreditCard({
  name,
  bank = null,
  last4 = null,
  network = null,
  credit_limit = 0,
  statement_day = null,
  due_after_days = null,
  minimum_due_percent = 0,
  currency = "INR",
  color = "#4B7CF3",
  notes = null,
  status = "active",
  interest_rate_percent = 0,
}) {
  const sourceId = await createSource({
    name,
    type: "credit_card",
    initial_balance: 0,
    icon: "credit-card-outline",
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
    interest_rate_percent,
    currency,
    color,
    notes,
    status,
    source_id,
    payment_bill_id,
    created_at,
    updated_at
  )
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
      Number(interest_rate_percent || 0),
      currency,
      color,
      notes,
      status,
      sourceId,
      null,
      now,
      now,
    ],
  );

  const cardId = res.insertId;

  // Create recurring bill template
  const today = new Date();

  const statementDate = new Date(today);
  statementDate.setDate(Number(statement_day || today.getDate()));

  const dueDate = new Date(statementDate);

  if (due_after_days != null) {
    dueDate.setDate(dueDate.getDate() + Number(due_after_days));
  }

  const templateBillId = await createBill({
    name,
    amount: 0,

    due_date: dueDate.toISOString().slice(0, 10),

    status: BILL_STATUS.PENDING,

    is_recurring: 1,
    recurrence_type: "monthly",
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
    [templateBillId, cardId],
  );

  return cardId;
}

export async function updateCreditCard(id, fields) {
  const card = await getCreditCardById(id);
  if (!card) return null;

  const sets = [];
  const vals = [];
  for (const key of Object.keys(fields)) {
    if (key === "source_id" || key === "id") continue;
    sets.push(`${key} = ?`);
    vals.push(fields[key]);
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    const sql = `UPDATE credit_cards SET ${sets.join(", ")} WHERE id = ?`;
    vals.push(id);
    await executeSql(sql, vals);
  }

  // Keep the linked source display in sync
  if (fields.name || fields.color || fields.status) {
    await updateSource(card.source_id, {
      name: fields.name || card.name,
      color: fields.color || card.color,
      type: "credit_card",
      initial_balance: 0,
      icon: "credit-card-outline",
      is_active: (fields.status || card.status) !== "inactive" ? 1 : 0,
    });
  }

  // Keep recurring bill template in sync
  if (card.payment_bill_id) {
    const statementDay = Number(fields.statement_day ?? card.statement_day);

    const dueAfterDays = Number(
      fields.due_after_days ?? card.due_after_days ?? 0,
    );

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

      recurrence_type: "monthly",
      recurrence_interval: 1,
    });
  }

  return getCreditCardById(id);
}

export async function getCreditCards(activeOnly = true) {
  const res = await executeSql(
    `SELECT * FROM credit_cards ORDER BY name`,
    [],
  );

  const rows = [];
  const sourceIds = [];
  for (let i = 0; i < res.rows.length; i++) {
    const row = res.rows.item(i);
    rows.push(row);
    if (row.source_id) sourceIds.push(row.source_id);
  }

  // Fetch sources manually
  const sourceMap = {};
  if (sourceIds.length > 0) {
    const uniqueSourceIds = [...new Set(sourceIds)];
    const placeholders = uniqueSourceIds.map(() => "?").join(",");
    const sourcesRes = await executeSql(
      `SELECT id, name, type, is_active FROM sources WHERE id IN (${placeholders})`,
      uniqueSourceIds
    );
    for (let i = 0; i < sourcesRes.rows.length; i++) {
      const src = sourcesRes.rows.item(i);
      sourceMap[src.id] = src;
    }
  }

  const totalsBySource = {};
  if (sourceIds.length > 0) {
    const placeholders = sourceIds.map(() => "?").join(",");
    const txRes = await executeSql(
      `SELECT source_id, type, amount FROM transactions WHERE source_id IN (${placeholders})`, // AND IFNULL(is_counted, 1) = 1
      sourceIds,
    );

    for (let i = 0; i < txRes.rows.length; i++) {
      const tx = txRes.rows.item(i);
      const sourceId = tx.source_id;
      if (!sourceId) continue;
      const amount = Number(tx.amount || 0);
      totalsBySource[sourceId] = totalsBySource[sourceId] || 0;
      if (tx.type === "expense") {
        totalsBySource[sourceId] += amount;
      } else if (tx.type === "income") {
        totalsBySource[sourceId] -= amount;
      }
    }
  }

  const normalizedRows = rows.map((row) => {
    const src = sourceMap[row.source_id] || {};
    const outstanding = Number(
      totalsBySource[row.source_id] || row.outstanding || 0,
    );
    const limit = Number(row.credit_limit || 0);
    return {
      ...row,
      source_name: src.name || null,
      source_type: src.type || null,
      source_active: src.is_active !== undefined ? src.is_active : null,
      outstanding,
      available_limit: limit - outstanding,
    };
  });

  return activeOnly
    ? normalizedRows.filter((r) => r.status !== "inactive")
    : normalizedRows;
}

export async function getCreditCardById(id) {
  const res = await executeSql(
    `SELECT * FROM credit_cards WHERE id = ? LIMIT 1`,
    [id],
  );
  if (res.rows.length === 0) return null;

  const row = res.rows.item(0);
  
  if (row.source_id) {
    const srcRes = await executeSql(
      `SELECT name, type, is_active FROM sources WHERE id = ? LIMIT 1`,
      [row.source_id]
    );
    if (srcRes.rows.length > 0) {
      const src = srcRes.rows.item(0);
      row.source_name = src.name;
      row.source_type = src.type;
      row.source_active = src.is_active;
    }
  }

  if (!row.source_id) return row;

  const txRes = await executeSql(
    `SELECT type, amount FROM transactions WHERE source_id = ? AND IFNULL(is_counted, 1) = 1`,
    [row.source_id],
  );
  let outstanding = 0;
  for (let i = 0; i < txRes.rows.length; i++) {
    const tx = txRes.rows.item(i);
    const amount = Number(tx.amount || 0);
    if (tx.type === "expense") {
      outstanding += amount;
    } else if (tx.type === "income") {
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
    [sourceId],
  );
  if (res.rows.length === 0) return null;
  return res.rows.item(0);
}

export async function refreshCreditCardTotals(cardId) {
  const card = await getCreditCardById(cardId);
  if (!card || !card.source_id) return null;

  const txRes = await executeSql(
    `SELECT type, amount FROM transactions WHERE source_id = ?`, // AND IFNULL(is_counted, 1) = 1
    [card.source_id],
  );
  let outstanding = 0;
  for (let i = 0; i < txRes.rows.length; i++) {
    const tx = txRes.rows.item(i);
    const amount = Number(tx.amount || 0);
    if (tx.type === "expense") {
      outstanding += amount;
    } else if (tx.type === "income") {
      outstanding -= amount;
    }
  }

  const limit = Number(card.credit_limit || 0);
  const available_limit = limit - outstanding;

  await executeSql(
    `UPDATE credit_cards SET outstanding = ?, available_limit = ?, updated_at = datetime('now') WHERE id = ?`,
    [outstanding, available_limit, cardId],
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
    throw new Error("Credit card not found");
  }

  if (!card.source_id) {
    throw new Error("Credit card source is missing");
  }

  if (!source_id) {
    throw new Error("Payment source is required");
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

  await executeSql(
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
    ],
  );

  // Refresh card totals
  await refreshCreditCardTotals(cardId);

  // Update statement payment amount if linked
  if (statementId) {
    await executeSql(
      `UPDATE credit_card_statements
       SET payments = COALESCE(payments,0) + ?
       WHERE id = ?`,
      [amount, statementId],
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
      [statementId],
    );
  }

  /*
     Return the BANK transaction id.
     markBillPaid() links this transaction to the bill.
    */
  return transfer.debitTransactionId;
}

export async function payCreditCardBill({ bill, card, paymentSourceId }) {
  // Find the statement linked to this bill
  const statementRes = await executeSql(
    `SELECT id
         FROM credit_card_statements
         WHERE bill_id = ?
         LIMIT 1`,
    [bill.id],
  );
  const statementId =
    statementRes.rows.length > 0 ? statementRes.rows.item(0).id : null;
  const paymentId = await createCreditCardPayment({
    cardId: card.id,
    amount: bill.amount,
    source_id: paymentSourceId,
    statementId,
    notes: `Paid ${bill.name}`,
  });
  return paymentId;
}

export async function createCreditCardStatement(fields) {
  const keys = [
    "card_id",
    "statement_start",
    "statement_end",
    "statement_date",
    "due_date",
    "opening_balance",
    "purchases",
    "refunds",
    "fees",
    "interest",
    "payments",
    "closing_balance",
    "minimum_due",
    "status",
  ];

  const values = keys.map((k) => (fields[k] != null ? fields[k] : null));
  const res = await executeSql(
    `INSERT INTO credit_card_statements (
      card_id, statement_start, statement_end, statement_date, due_date,
      opening_balance, purchases, refunds, fees, interest, payments,
      closing_balance, minimum_due, status, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
    values,
  );

  return res.insertId;
}

export async function getCreditCardStatements(cardId) {
  const res = await executeSql(
    `SELECT * FROM credit_card_statements WHERE card_id = ? ORDER BY statement_date DESC`,
    [cardId],
  );
  const rows = [];
  for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
  return rows;
}

export async function getCreditCardStatementById(statementId) {
  const statementRes = await executeSql(
    `SELECT * FROM credit_card_statements WHERE id = ?`,
    [statementId]
  );
  if (statementRes.rows.length === 0) return null;
  const statement = statementRes.rows.item(0);

  const cardRes = await executeSql(
    `SELECT * FROM credit_cards WHERE id = ?`,
    [statement.card_id]
  );
  const card = cardRes.rows.length > 0 ? cardRes.rows.item(0) : {};

  return {
    ...statement,
    card_name: card.name,
    card_color: card.color,
    card_currency: card.currency,
    source_id: card.source_id,
  };
}

export async function getStatementTransactions(sourceId, startDate, endDate) {
  const res = await executeSql(
    `SELECT * FROM transactions
     WHERE source_id = ?
     ORDER BY date DESC, created_at DESC`,
    [sourceId]
  );
  const rows = [];
  const start = new Date(startDate).getTime();
  // To cover the whole end date, we can set the time to end of day if it's just a date string.
  // Assuming endDate is like YYYY-MM-DD. We want to include transactions on that day.
  const endStr = String(endDate).includes("T") ? endDate : `${endDate}T23:59:59.999Z`;
  const end = new Date(endStr).getTime();

  for (let i = 0; i < res.rows.length; i++) {
    const item = res.rows.item(i);
    if (!item.date) continue;
    
    // Some dates might be stored as YYYY-MM-DD, others as ISO string.
    const itemTime = new Date(item.date).getTime();
    
    // Filter between start and end (inclusive)
    if (itemTime >= start && itemTime <= end) {
      rows.push(item);
    }
  }
  return rows;
}


export async function getAllCreditCardStatements() {
    const cardsRes = await executeSql(
        `SELECT id, name, color, currency FROM credit_cards`,
        []
    );
    const cardsMap = {};
    for (let i = 0; i < cardsRes.rows.length; i++) {
        const c = cardsRes.rows.item(i);
        cardsMap[c.id] = c;
    }

    const res = await executeSql(
        `SELECT *
         FROM credit_card_statements
         ORDER BY statement_date DESC`,
        []
    );
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) {
        const statement = res.rows.item(i);
        let billStatus = null;
        let billIsPaid = 0;
        if (statement.bill_id) {
            const billRes = await executeSql(
                `SELECT status, is_paid
                 FROM bills
                 WHERE id = ?`,
                [statement.bill_id]
            );
            if (billRes.rows.length > 0) {
                const bill = billRes.rows.item(0);
                billStatus = bill.status;
                billIsPaid = bill.is_paid;
            }
        }
        
        const card = cardsMap[statement.card_id] || {};

        rows.push({
            ...statement,
            card_name: card.name,
            card_color: card.color,
            card_currency: card.currency,
            bill_status: billStatus,
            bill_is_paid: billIsPaid,
        });
    }
    return rows;
}

export async function deleteCreditCardStatement(statementId) {
  if (!statementId) {
    throw new Error("Statement ID is required");
  }

  // ---------------------------------------------------------
  // Find statement
  // ---------------------------------------------------------

  const statementsRes = await executeSql(
    `SELECT * FROM credit_card_statements`,
    [],
  );

  let statement = null;

  for (let i = 0; i < statementsRes.rows.length; i++) {
    const row = statementsRes.rows.item(i);

    if (Number(row.id) === Number(statementId)) {
      statement = row;
      break;
    }
  }

  if (!statement) {
    throw new Error("Credit card statement not found");
  }

  // ---------------------------------------------------------
  // Delete generated bill
  // ---------------------------------------------------------

  if (statement.bill_id) {
    await executeSql(`DELETE FROM bills WHERE id = ?`, [statement.bill_id]);

    // Remove bill ↔ transaction links if any
    await executeSql(`DELETE FROM bill_linked_transactions WHERE bill_id = ?`, [
      statement.bill_id,
    ]);
  }

  // ---------------------------------------------------------
  // Delete statement
  // ---------------------------------------------------------

  await executeSql(`DELETE FROM credit_card_statements WHERE id = ?`, [
    statementId,
  ]);
  return true;
}

export async function getCreditCardPayments(cardId) {
  const res = await executeSql(
    `SELECT * FROM credit_card_payments WHERE card_id = ? ORDER BY payment_date DESC`,
    [cardId],
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
    [id],
  );

  // Deactivate linked source
  if (card.source_id) {
    await updateSource(card.source_id, {
      name: card.source_name || card.name,
      type: "credit_card",
      initial_balance: 0,
      icon: "credit-card-outline",
      color: card.color || "#4B7CF3",
      is_active: 0,
    });
  }

  // Archive recurring bill template
  if (card.payment_bill_id) {
    try {
      await deleteBill(card.payment_bill_id);
    } catch (e) {
      console.warn("Failed to archive credit card bill template", e);
    }
  }
}

export async function syncCreditCardBillAmount(cardId) {
  let card = await getCreditCardById(cardId);
  if (!card) return;

  // =========================================================
  // FIND / RESTORE CREDIT CARD PAYMENT TEMPLATE
  // =========================================================

  if (!card.payment_bill_id) {
    const billsRes = await executeSql(`SELECT * FROM bills`, []);

    for (let i = 0; i < billsRes.rows.length; i++) {
      const b = billsRes.rows.item(i);

      if (
        !b.deleted_at &&
        Number(b.is_recurring) === 1 &&
        typeof b.notes === "string" &&
        b.notes === `Recurring payment template for ${card.name}`
      ) {
        await executeSql(
          `UPDATE credit_cards
                     SET payment_bill_id = ?
                     WHERE id = ?`,
          [b.id, cardId],
        );

        card = {
          ...card,
          payment_bill_id: b.id,
        };

        break;
      }
    }
  }

  if (!card.payment_bill_id) {
    return;
  }

  // =========================================================
  // UPDATE ONLY THE CREDIT CARD TEMPLATE
  // =========================================================
  //
  // IMPORTANT:
  // Do NOT update statement bills here.
  //
  // Each statement already has its own fixed amount.
  //
  // Example:
  //
  // Statement 1 = 15,000
  // Statement 2 = 24,740.42
  //
  // They MUST remain those amounts.
  // =========================================================

  const outstanding = Number(card.outstanding || 0);

  await updateBill(card.payment_bill_id, {
    amount: outstanding,
  });

  // =========================================================
  // DO NOT UPDATE CHILD STATEMENT BILLS
  // =========================================================
  //
  // Previously this function did:
  //
  // UPDATE bills
  // SET amount = outstanding
  // WHERE parent_bill_id = payment_bill_id
  //
  // That is WRONG for multi-cycle statements because it
  // changes every statement to the combined card outstanding.
  //
  // Statement amounts are owned by the statement generator.
  // =========================================================

  return;
}

export async function updateCreditCardStatement(statementId, fields) {
  const statement = await getCreditCardStatementById(statementId);
  if (!statement) {
    throw new Error("Credit card statement not found");
  }

  const newOpeningBalance = fields.opening_balance != null ? Number(fields.opening_balance) : Number(statement.opening_balance || 0);
  const newFees = fields.fees != null ? Number(fields.fees) : Number(statement.fees || 0);
  const newInterest = fields.interest != null ? Number(fields.interest) : Number(statement.interest || 0);
  const newRefunds = fields.refunds != null ? Number(fields.refunds) : Number(statement.refunds || 0);
  
  // Calculate new closing balance
  const closingBalance = newOpeningBalance + Number(statement.purchases || 0) + newFees + newInterest - Number(statement.payments || 0) - newRefunds;
  
  // Need to get card for minimum_due
  let minimumDue = statement.minimum_due;
  const cardRes = await executeSql(`SELECT minimum_due_percent FROM credit_cards WHERE id = ?`, [statement.card_id]);
  if (cardRes.rows.length > 0) {
    const card = cardRes.rows.item(0);
    minimumDue = closingBalance > 0 ? closingBalance * (Number(card.minimum_due_percent || 0) / 100) : 0;
  }

  await executeSql(
    `UPDATE credit_card_statements 
     SET opening_balance = ?, fees = ?, interest = ?, refunds = ?, closing_balance = ?, minimum_due = ?
     WHERE id = ?`,
    [newOpeningBalance, newFees, newInterest, newRefunds, closingBalance, minimumDue, statementId]
  );
  
  // Also update the linked bill amount if not paid
  if (statement.bill_id) {
    await executeSql(
      `UPDATE bills SET amount = ? WHERE id = ? AND (status != 'paid' AND is_paid = 0)`,
      [closingBalance, statement.bill_id]
    );
  }
}
