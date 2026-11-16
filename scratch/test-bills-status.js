// scratch/test-bills-status.js
// Unit tests for bill status computation, BillCard status/button logic,
// getPreferredBillOccurrence, and summary overdue calculations.

const assert = require('assert');

// 1. Mock BILL_STATUS constants
const BILL_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  PARTIALLY_PAID: 'partially_paid',
  SKIPPED: 'skipped',
};

function todayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 2. Logic from computeBillStatus
function computeBillStatus(bill, today = todayStr()) {
  if (!bill) return BILL_STATUS.PENDING;
  if (bill.deleted_at) return null;
  if (bill.status === BILL_STATUS.SKIPPED) return BILL_STATUS.SKIPPED;
  const paidAmount = Number(bill.paid_amount || bill.total_paid || 0);
  const amount = Number(bill.amount || 0);
  const roundedPaid = Math.round(paidAmount * 100);
  const roundedAmount = Math.round(amount * 100);
  if (
    bill.status === BILL_STATUS.PAID ||
    Number(bill.is_paid) === 1 ||
    Boolean(bill.is_completely_paid) ||
    (roundedAmount > 0 && roundedPaid >= roundedAmount)
  ) {
    return BILL_STATUS.PAID;
  }
  if (
    bill.status === "partially_paid" ||
    Boolean(bill.is_partially_paid) ||
    (roundedPaid > 0 && roundedPaid < roundedAmount)
  ) {
    return "partially_paid";
  }
  if (bill.due_date && bill.due_date.slice(0, 10) < today)
    return BILL_STATUS.OVERDUE;
  return BILL_STATUS.PENDING;
}

// 3. Logic from BillCard status and action button determination
function getBillCardViewModel(bill) {
  const today = todayStr();
  const roundedPaid = Math.round(Number(bill.paid_amount || bill.total_paid || 0) * 100);
  const roundedAmount = Math.round(Number(bill.amount || 0) * 100);

  const status = bill.status || 'pending';
  const isPaid =
    status === 'paid' ||
    Number(bill.is_paid) === 1 ||
    Boolean(bill.is_completely_paid) ||
    (roundedAmount > 0 && roundedPaid >= roundedAmount);
  const isPartiallyPaid =
    !isPaid &&
    (status === 'partially_paid' ||
      Boolean(bill.is_partially_paid) ||
      (roundedPaid > 0 && roundedPaid < roundedAmount));
  const isSkipped = status === 'skipped';
  const isDueDatePast = Boolean(
    bill.due_date && String(bill.due_date).slice(0, 10) < today,
  );
  const isOverdue = !isPaid && !isPartiallyPaid && !isSkipped && (status === 'overdue' || isDueDatePast);

  let badgeLabel = '• PENDING';
  if (isOverdue) badgeLabel = '• OVERDUE';
  else if (isPaid) badgeLabel = '• PAID';
  else if (isPartiallyPaid) badgeLabel = '• PARTIAL';
  else if (isSkipped) badgeLabel = '• SKIPPED';

  let actionButton = null;
  if (bill._isCreditCardParent) {
    actionButton = 'Statements';
  } else if (isOverdue) {
    actionButton = 'Pay Now';
  } else if (!isPaid && !isSkipped) {
    actionButton = 'Pay';
  }

  return { isPaid, isOverdue, isPartiallyPaid, isSkipped, badgeLabel, actionButton };
}

// 4. Corrected getPreferredBillOccurrence logic
function getPreferredBillOccurrence(bill, allBills) {
  if (!bill.is_recurring && !bill._isRecurringSeries) {
    return bill;
  }
  const templateId = Number(bill._templateId || bill.parent_bill_id || bill.id);
  if (!templateId) {
    return bill;
  }
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const occurrences = allBills
    .filter((row) => {
      const rowTemplateId = Number(
        row.parent_bill_id || row._templateId || row.id,
      );
      return rowTemplateId === templateId && !row.deleted_at;
    })
    .filter((row) => Boolean(row.due_date))
    .sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""));

  if (!occurrences.length) {
    return {
      ...bill,
      due_date: null,
      _noDueDate: true,
    };
  }

  const currentMonthBill = occurrences.find((row) =>
    row.due_date.startsWith(currentMonthPrefix),
  );

  // KEY FIX: If an occurrence for the current month exists, ALWAYS return it,
  // even if it is paid! This ensures the current month card displays as PAID.
  if (currentMonthBill) {
    return currentMonthBill;
  }

  // Fallback for non-monthly (e.g. quarterly) without a current month occurrence
  const todayString = todayStr();
  const previousPending = occurrences.find((row) => {
    return (
      row.due_date <= todayString &&
      row.status !== "paid" &&
      row.status !== "skipped"
    );
  });

  if (previousPending) {
    return previousPending;
  }

  const upcoming = occurrences
    .filter((row) => row.due_date > todayString)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  if (upcoming) {
    return upcoming;
  }

  return {
    ...bill,
    due_date: null,
    _noDueDate: true,
  };
}

// 5. Corrected summary calculation logic
function calculateSummary(bills, today = todayStr()) {
  const activeBills = bills.filter((b) => {
    if (!b || b.deleted_at) return false;
    // Exclude recurring templates (blueprints)
    const isTemplate = !b.parent_bill_id && Number(b.is_recurring) === 1;
    return !isTemplate;
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const mk = `${year}-${String(month + 1).padStart(2, "0")}`;

  const thisMonth = activeBills.filter((b) => {
    if (!b.due_date) return false;
    const d = new Date(b.due_date.slice(0, 10));
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const totalThisMonth = thisMonth.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalPaid = thisMonth
    .filter((b) => b.status === BILL_STATUS.PAID || b.status === BILL_STATUS.SKIPPED || Number(b.is_paid) === 1)
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const paidCount = thisMonth.filter(
    (b) => b.status === BILL_STATUS.PAID || b.status === BILL_STATUS.SKIPPED || Number(b.is_paid) === 1,
  ).length;

  const overdueBills = activeBills.filter((b) => {
    if (b.status === BILL_STATUS.PAID || b.status === BILL_STATUS.SKIPPED || Number(b.is_paid) === 1) return false;
    return b.status === BILL_STATUS.OVERDUE || (b.due_date && b.due_date.slice(0, 10) < today);
  });

  const overdueAmount = overdueBills.reduce((s, b) => s + Number(b.amount || 0), 0);
  const overdueCount = overdueBills.length;

  return {
    totalThisMonth,
    totalPaid,
    paidCount,
    overdueAmount,
    overdueCount,
  };
}

// =============================================================================
// TESTS
// =============================================================================
console.log('Running test suite for bill status & summary...');

// Test 1: Overdue bill with status='pending' in DB
{
  const overdueBill = {
    id: 1,
    name: 'Internet Bill',
    amount: 1000,
    due_date: '2026-11-05', // 11 days ago
    status: 'pending', // DB had pending
    is_paid: 0,
  };
  const vm = getBillCardViewModel(overdueBill);
  assert.strictEqual(vm.isOverdue, true, 'Bill should be recognized as overdue');
  assert.strictEqual(vm.badgeLabel, '• OVERDUE', 'Badge should show OVERDUE');
  assert.strictEqual(vm.actionButton, 'Pay Now', 'Action button must be "Pay Now"');
  console.log('✓ Test 1 Passed: Overdue bill with pending status correctly renders OVERDUE & Pay Now');
}

// Test 2: Paid bill should NOT show Pay Now or Pay
{
  const paidBill = {
    id: 2,
    name: 'Rent',
    amount: 15000,
    due_date: '2026-11-01',
    status: 'paid',
    is_paid: 1,
    paid_amount: 15000,
  };
  const vm = getBillCardViewModel(paidBill);
  assert.strictEqual(vm.isPaid, true, 'Bill should be recognized as paid');
  assert.strictEqual(vm.isOverdue, false, 'Paid bill should not be overdue');
  assert.strictEqual(vm.badgeLabel, '• PAID', 'Badge should show PAID');
  assert.strictEqual(vm.actionButton, null, 'Paid bill must NOT have Pay or Pay Now button');
  console.log('✓ Test 2 Passed: Paid bill renders PAID badge and NO action button');
}

// Test 3: Future pending bill shows Pay
{
  const futureBill = {
    id: 3,
    name: 'Electricity',
    amount: 2500,
    due_date: '2026-11-28',
    status: 'pending',
    is_paid: 0,
  };
  const vm = getBillCardViewModel(futureBill);
  assert.strictEqual(vm.isPaid, false);
  assert.strictEqual(vm.isOverdue, false);
  assert.strictEqual(vm.badgeLabel, '• PENDING');
  assert.strictEqual(vm.actionButton, 'Pay', 'Future pending bill shows "Pay"');
  console.log('✓ Test 3 Passed: Future pending bill renders PENDING badge and "Pay" button');
}

// Test 4: Skipped bill shows SKIPPED and NO action button
{
  const skippedBill = {
    id: 4,
    name: 'Gym',
    amount: 1200,
    due_date: '2026-11-10',
    status: 'skipped',
    is_paid: 0,
  };
  const vm = getBillCardViewModel(skippedBill);
  assert.strictEqual(vm.isSkipped, true);
  assert.strictEqual(vm.isOverdue, false);
  assert.strictEqual(vm.badgeLabel, '• SKIPPED');
  assert.strictEqual(vm.actionButton, null, 'Skipped bill should not show Pay');
  console.log('✓ Test 4 Passed: Skipped bill renders SKIPPED badge and NO action button');
}

// Test 5: getPreferredBillOccurrence returns current month bill even when paid
{
  const recurringSeries = [
    {
      id: 10,
      parent_bill_id: null,
      is_recurring: 1,
      recurrence_type: 'monthly',
      due_date: '2026-01-15',
    },
    {
      id: 101,
      parent_bill_id: 10,
      is_recurring: 0,
      due_date: '2026-11-15',
      status: 'paid',
      is_paid: 1,
      paid_amount: 500,
      amount: 500,
    },
    {
      id: 102,
      parent_bill_id: 10,
      is_recurring: 0,
      due_date: '2026-12-15',
      status: 'pending',
      is_paid: 0,
      amount: 500,
    },
  ];

  const preferred = getPreferredBillOccurrence(recurringSeries[0], recurringSeries);
  assert.strictEqual(preferred.id, 101, 'Must return November occurrence (id 101) even if paid');
  assert.strictEqual(preferred.status, 'paid');
  console.log('✓ Test 5 Passed: getPreferredBillOccurrence preserves current month paid occurrence');
}

// Test 6: Summary does NOT count recurring templates as overdue
{
  const bills = [
    // Template from 2024 (due_date in past!)
    {
      id: 10,
      parent_bill_id: null,
      is_recurring: 1,
      due_date: '2024-01-15',
      status: 'overdue',
      amount: 1000,
      is_paid: 0,
    },
    // November child occurrence (paid)
    {
      id: 101,
      parent_bill_id: 10,
      is_recurring: 0,
      due_date: '2026-11-15',
      status: 'paid',
      is_paid: 1,
      amount: 1000,
    },
    // One-time overdue bill (Nov 5)
    {
      id: 200,
      parent_bill_id: null,
      is_recurring: 0,
      due_date: '2026-11-05',
      status: 'overdue',
      amount: 3000,
      is_paid: 0,
    },
    // One-time future pending bill (Nov 25)
    {
      id: 201,
      parent_bill_id: null,
      is_recurring: 0,
      due_date: '2026-11-25',
      status: 'pending',
      amount: 2000,
      is_paid: 0,
    },
  ];

  const sum = calculateSummary(bills);
  assert.strictEqual(sum.totalThisMonth, 6000, 'Total this month = 1000 + 3000 + 2000 = 6000');
  assert.strictEqual(sum.totalPaid, 1000, 'Total paid = 1000');
  assert.strictEqual(sum.paidCount, 1, 'Paid count = 1');
  assert.strictEqual(sum.overdueCount, 1, 'Overdue count must be 1 (NOT 2 from template!)');
  assert.strictEqual(sum.overdueAmount, 3000, 'Overdue amount must be 3000 (NOT 4000 from template!)');
  console.log('✓ Test 6 Passed: Summary correctly excludes recurring templates from overdueCount and overdueAmount');
}

console.log('\nAll 6 tests PASSED successfully!');
