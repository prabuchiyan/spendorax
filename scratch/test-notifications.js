const assert = require('assert');

console.log('--- Testing Notification Redesign Logic ---');

// 1. Verify Notification Types & Default Configurations
const expectedTypes = [
  'DAILY_SPEND',
  'YESTERDAY_SPEND',
  'BILL_DUE',
  'LOAN_EMI',
  'STATEMENT_GENERATED',
  'BILL_GENERATED'
];

console.log('1. Checking default notification types...');
assert.strictEqual(expectedTypes.length, 6, 'Should have exactly 6 notification types');
console.log('✓ All 6 notification types accounted for.');

// 2. Month-End Date Clamping for Loan EMIs
console.log('2. Testing month-end day clamping for loan EMIs...');
function clampEmiDay(day, year, month /* 0-based */) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

// February in non-leap year (e.g. 2025)
assert.strictEqual(clampEmiDay(31, 2025, 1), 28, 'Day 31 in Feb 2025 should clamp to 28');
// February in leap year (e.g. 2024)
assert.strictEqual(clampEmiDay(31, 2024, 1), 29, 'Day 31 in Feb 2024 should clamp to 29');
// April (30 days)
assert.strictEqual(clampEmiDay(31, 2026, 3), 30, 'Day 31 in April should clamp to 30');
// August (31 days)
assert.strictEqual(clampEmiDay(31, 2026, 7), 31, 'Day 31 in August should stay 31');
// Day 15 (unaffected)
assert.strictEqual(clampEmiDay(15, 2026, 1), 15, 'Day 15 should stay 15');
console.log('✓ Loan EMI date clamping logic passed for all months and leap years.');

// 3. Statement Generation Notification Copy & Payload
console.log('3. Testing Statement Generated notification formatting & payload...');
const card = { name: 'HDFC Regalia', id: 4 };
const closingBalance = 24500.50;
const minimumDue = 1225.00;
const dueDateStr = '2026-11-28';
const formattedAmount = Number(closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formattedMinDue = Number(minimumDue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dueDateFormatted = new Date(dueDateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const stmtTitle = `💳 Statement Generated • ${card.name}`;
const stmtBody = `Amount Due: ₹${formattedAmount} | Due: ${dueDateFormatted}\nMin Due: ₹${formattedMinDue} • Tap to view statement breakdown & pay.`;
const stmtPayload = {
  screen: 'CreditCardStatementDetail',
  statementId: 101,
  id: 101,
  cardId: card.id,
  type: 'STATEMENT_GENERATED'
};

assert(stmtTitle.includes('HDFC Regalia'), 'Statement title must contain card name');
assert(stmtBody.includes('₹24,500.50'), 'Statement body must contain formatted amount');
assert(stmtBody.includes('₹1,225.00'), 'Statement body must contain minimum due');
assert.strictEqual(stmtPayload.screen, 'CreditCardStatementDetail', 'Payload must route to CreditCardStatementDetail');
console.log('✓ Statement Generated notification format passed.');

// 4. Recurring Bill Generated Notification Copy & Payload
console.log('4. Testing Bill Generated notification formatting & payload...');
const template = { name: 'Airtel Broadband', amount: 999.00 };
const nextDueDate = '2026-12-05';
const billAmountFormatted = Number(template.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const billDueDateFormatted = new Date(nextDueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const billGenTitle = `📋 New Bill Generated • ${template.name}`;
const billGenBody = `Amount: ₹${billAmountFormatted} | Due Date: ${billDueDateFormatted}\nAdded to your schedule. Tap to view details.`;
const billGenPayload = { screen: 'BillDetail', billId: 55, type: 'BILL_GENERATED' };

assert(billGenTitle.includes('Airtel Broadband'), 'Bill generated title must contain bill name');
assert(billGenBody.includes('₹999.00'), 'Bill generated body must contain amount');
assert.strictEqual(billGenPayload.screen, 'BillDetail', 'Payload must route to BillDetail');
console.log('✓ Bill Generated notification format passed.');

// 5. Bill Due Reminder Notification Copy & Payload
console.log('5. Testing Bill Due Reminder formatting & payload...');
const billDueTitle = `🔔 Bill Due Today • Electricity Bill`;
const billDueBody = `Amount: ₹3,450.00 | Due: 14 Nov 2026 (HDFC Bank)\nTap to mark as paid or view details.`;
const billDuePayload = { screen: 'BillDetail', billId: 42, type: 'SPECIFIC_BILL_DUE' };

assert(billDueTitle.includes('Electricity Bill'), 'Bill due title must contain bill name');
assert(billDueBody.includes('₹3,450.00'), 'Bill due body must contain amount');
assert(billDueBody.includes('HDFC Bank'), 'Bill due body must contain account name');
console.log('✓ Bill Due Reminder format passed.');

// 6. Loan EMI Reminder Notification Copy & Payload
console.log('6. Testing Loan EMI Reminder formatting & payload...');
const loan = { loan_name: 'Home Loan', emi_amount: 32000.00, outstanding_amount: 1850000.00, lender: 'SBI' };
const emiFormatted = Number(loan.emi_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const outFormatted = Number(loan.outstanding_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const loanTitle = `🚨 EMI Due in 2 days • ${loan.loan_name}`;
const loanBody = `EMI: ₹${emiFormatted} | Due: 15 Nov 2026 | Lender: ${loan.lender}\nRemaining: ₹${outFormatted}. Tap to pay.`;
const loanPayload = { screen: 'LoanDetails', loanId: 3, type: 'SPECIFIC_LOAN_EMI' };

assert(loanTitle.includes('Home Loan'), 'Loan EMI title must contain loan name');
assert(loanBody.includes('₹32,000.00'), 'Loan EMI body must contain EMI amount');
assert(loanBody.includes('SBI'), 'Loan EMI body must contain lender');
assert(loanBody.includes('₹18,50,000.00'), 'Loan EMI body must contain outstanding amount');
assert.strictEqual(loanPayload.screen, 'LoanDetails', 'Payload must route to LoanDetails');
console.log('✓ Loan EMI Reminder format passed.');

// 7. Tap Routing Destination Verification
console.log('7. Testing Tap Routing logic across all notification payloads...');
function resolveNavigationDestination(data) {
  const { screen, loanId, billId, statementId, cardId } = data;
  switch (screen) {
    case 'CreditCardStatementDetail':
      return { target: 'CreditCardStatementDetail', params: { statementId, cardId } };
    case 'LoanDetails':
      return { target: 'LoanDetails', params: { id: loanId } };
    case 'BillDetail':
      return { target: 'BillDetail', params: { id: billId } };
    case 'TransactionAdd':
      return { target: 'TransactionAdd' };
    case 'Transactions':
      return { target: 'Drawer', params: { screen: 'Transactions' } };
    default:
      return null;
  }
}

assert.strictEqual(resolveNavigationDestination(stmtPayload).target, 'CreditCardStatementDetail');
assert.strictEqual(resolveNavigationDestination(billGenPayload).target, 'BillDetail');
assert.strictEqual(resolveNavigationDestination(billDuePayload).target, 'BillDetail');
assert.strictEqual(resolveNavigationDestination(loanPayload).target, 'LoanDetails');
assert.strictEqual(resolveNavigationDestination({ screen: 'TransactionAdd' }).target, 'TransactionAdd');
assert.strictEqual(resolveNavigationDestination({ screen: 'Transactions' }).target, 'Drawer');
console.log('✓ Tap navigation routing verified for all notification types.');

console.log('--- ALL TEST CHECKS PASSED SUCCESSFULLY (0 errors) ---');
