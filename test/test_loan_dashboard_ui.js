const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing LoanDashboard Interactive UI & Utils...');

const utilsPath = path.resolve(__dirname, '../src/utils/loanDashboardUtils.js');
const dashboardPath = path.resolve(__dirname, '../src/screens/LoanDashboardScreen.js');
const quickActionsPath = path.resolve(__dirname, '../src/components/LoanQuickActions.js');
const listPath = path.resolve(__dirname, '../src/screens/LoanListScreen.js');

assert(fs.existsSync(utilsPath), 'loanDashboardUtils.js must exist');
assert(fs.existsSync(dashboardPath), 'LoanDashboardScreen.js must exist');
assert(fs.existsSync(quickActionsPath), 'LoanQuickActions.js must exist');
assert(fs.existsSync(listPath), 'LoanListScreen.js must exist');

const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
const quickActionsContent = fs.readFileSync(quickActionsPath, 'utf8');
const listContent = fs.readFileSync(listPath, 'utf8');

// 1. Contract checks on LoanDashboardScreen
assert(
  dashboardContent.includes('loanDashboardUtils'),
  'LoanDashboardScreen must use loanDashboardUtils'
);
assert(
  dashboardContent.includes('LoanQuickActions'),
  'LoanDashboardScreen must render LoanQuickActions for instant shortcuts'
);
assert(
  dashboardContent.includes('useWindowDimensions'),
  'LoanDashboardScreen must use reactive useWindowDimensions instead of static Dimensions.get'
);
assert(
  !dashboardContent.includes('Dimensions.get('),
  'LoanDashboardScreen must not rely on static Dimensions.get'
);
assert(
  dashboardContent.includes('RefreshControl'),
  'LoanDashboardScreen should support pull-to-refresh'
);
assert(
  dashboardContent.includes('theme.cardBg') && dashboardContent.includes('theme.textPrimary'),
  'LoanDashboardScreen must apply dark/light theme colors'
);
assert(
  quickActionsContent.includes('useTheme') && quickActionsContent.includes('receive') && quickActionsContent.includes('lendMore'),
  'LoanQuickActions must support theme and LENT actions (receive, lendMore)'
);
assert(
  listContent.includes('theme.cardBg') && listContent.includes('theme.textPrimary'),
  'LoanListScreen must apply theme colors across search and status filters'
);

// 2. Unit tests on loanDashboardUtils
const {
  getLoanDirection,
  isLoanActive,
  isLoanOverdue,
  computeDirectionSummary,
  computeUpcomingDueInfo,
  getRecentActivityMeta,
  getDashboardQuickActions,
  resolveQuickActionTarget,
} = require('../src/utils/loanDashboardUtils');

// 2a. Direction normalization
assert.strictEqual(getLoanDirection({ loan_direction: 'LENT' }), 'LENT');
assert.strictEqual(getLoanDirection({ direction: 'lent' }), 'LENT');
assert.strictEqual(getLoanDirection({ loan_direction: 'BORROWED' }), 'BORROWED');
assert.strictEqual(getLoanDirection({}), 'BORROWED');

// 2b. Summary aggregation & overdue detection
const now = new Date('2026-11-25T10:00:00.000Z');
const loans = [
  {
    id: 1,
    loan_name: 'Home Loan',
    loan_direction: 'BORROWED',
    status: 'Active',
    outstanding_amount: 80000,
    principal_paid: 20000,
    interest_paid: 4000,
    emi_amount: 5000,
    emi_day: 25,
    loan_end_date: '2027-06-01T00:00:00.000Z',
  },
  {
    id: 2,
    loan_name: 'Car Loan',
    loan_direction: 'BORROWED',
    status: 'Active',
    outstanding_amount: 10000,
    principal_paid: 30000,
    interest_paid: 2500,
    emi_amount: 2500,
    emi_day: 28,
    loan_end_date: '2026-11-10T00:00:00.000Z', // overdue!
  },
  {
    id: 3,
    loan_name: 'Old Bike',
    loan_direction: 'BORROWED',
    status: 'Closed',
    outstanding_amount: 0,
    principal_paid: 50000,
    interest_paid: 3000,
    emi_amount: 4000,
  },
];

assert.strictEqual(isLoanActive(loans[0]), true);
assert.strictEqual(isLoanActive(loans[2]), false);
assert.strictEqual(isLoanOverdue(loans[0], now), false);
assert.strictEqual(isLoanOverdue(loans[1], now), true);
assert.strictEqual(isLoanOverdue(loans[2], now), false);

const summary = computeDirectionSummary(loans, now);
assert.strictEqual(summary.outstanding, 90000);
assert.strictEqual(summary.paid, 100000);
assert.strictEqual(summary.total, 190000);
assert.strictEqual(summary.emi, 7500);
assert.strictEqual(summary.interest, 9500);
assert.strictEqual(summary.overdue, 1);
assert.strictEqual(summary.activeCount, 2);
assert.strictEqual(summary.closedCount, 1);
assert.strictEqual(summary.totalCount, 3);

// 2c. Upcoming due info & clamped day-of-month (e.g. emi_day 31 in Nov has 30 days)
const dueToday = computeUpcomingDueInfo(loans[0], new Date(2026, 10, 25, 10, 0, 0));
assert.strictEqual(dueToday.daysUntilDue, 0);
assert.strictEqual(dueToday.urgencyLabel, 'Due Today');
assert.strictEqual(dueToday.urgencyTone, 'warning');

const overdueUpcoming = computeUpcomingDueInfo(loans[1], new Date(2026, 10, 25, 10, 0, 0));
assert.strictEqual(overdueUpcoming.isOverdue, true);
assert.strictEqual(overdueUpcoming.urgencyLabel, 'Overdue');
assert.strictEqual(overdueUpcoming.urgencyTone, 'danger');

const febDay31 = computeUpcomingDueInfo(
  { id: 9, emi_day: 31, outstanding_amount: 1000 },
  new Date(2026, 1, 10, 10, 0, 0) // Feb 10, 2026 (28 days in Feb)
);
const febDue = new Date(febDay31.nextDueDate);
assert.strictEqual(febDue.getMonth(), 1, 'Day 31 in Feb must clamp to Feb 28 instead of overflowing to Mar');
assert.strictEqual(febDue.getDate(), 28);

// 2d. Recent activity type meta distinguishes TOP_UP / ADVANCE / PREPAYMENT / FORECLOSURE
assert.strictEqual(getRecentActivityMeta({ payment_type: 'TOP_UP' }, 'BORROWED').label, 'TOP UP');
assert.strictEqual(getRecentActivityMeta({ payment_type: 'ADVANCE' }, 'LENT').label, 'LENT MORE');
assert.strictEqual(getRecentActivityMeta({ payment_type: 'PREPAYMENT' }, 'BORROWED').label, 'PREPAYMENT');
assert.strictEqual(getRecentActivityMeta({ payment_type: 'FORECLOSURE' }, 'BORROWED').label, 'FORECLOSURE');
assert.strictEqual(getRecentActivityMeta({ payment_type: 'EMI' }, 'BORROWED').label, 'PAYMENT');
assert.strictEqual(getRecentActivityMeta({ payment_type: 'EMI' }, 'LENT').label, 'RECOVERY');

// 2e. Quick action configuration & smart target resolution
assert.deepStrictEqual(getDashboardQuickActions('BORROWED'), ['add', 'pay', 'prepay', 'all']);
assert.deepStrictEqual(getDashboardQuickActions('LENT'), ['add', 'receive', 'lendMore', 'all']);

// 0 active loans -> empty
assert.strictEqual(
  resolveQuickActionTarget({ actionKey: 'pay', direction: 'BORROWED', activeLoans: [] }).type,
  'empty'
);

// 1 active loan -> direct navigation
const singlePay = resolveQuickActionTarget({
  actionKey: 'pay',
  direction: 'BORROWED',
  activeLoans: [loans[0]],
});
assert.strictEqual(singlePay.type, 'navigate');
assert.strictEqual(singlePay.route, 'LoanPayment');
assert.deepStrictEqual(singlePay.params, { id: 1 });

const singleReceive = resolveQuickActionTarget({
  actionKey: 'receive',
  direction: 'LENT',
  activeLoans: [{ id: 55, loan_name: 'Friend' }],
});
assert.strictEqual(singleReceive.type, 'navigate');
assert.strictEqual(singleReceive.route, 'LoanPayment');
assert.deepStrictEqual(singleReceive.params, { id: 55, mode: 'receive' });

// Multiple active loans -> opens quick loan picker
const multiPay = resolveQuickActionTarget({
  actionKey: 'prepay',
  direction: 'BORROWED',
  activeLoans: [loans[0], loans[1]],
});
assert.strictEqual(multiPay.type, 'pickLoan');
assert.strictEqual(multiPay.loans.length, 2);

console.log('✓ All LoanDashboard Interactive UI & Utils Tests Passed Successfully!');
