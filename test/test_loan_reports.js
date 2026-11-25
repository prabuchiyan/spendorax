const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing Single-Loan Reports Logic & Screen Contracts...');

// 1. Contract checks on LoanDetailsScreen & LoanReportsScreen
const detailsPath = path.resolve(__dirname, '../src/screens/LoanDetailsScreen.js');
const reportsPath = path.resolve(__dirname, '../src/screens/LoanReportsScreen.js');
const utilsPath = path.resolve(__dirname, '../src/utils/loanReportUtils.js');

assert(fs.existsSync(detailsPath), 'LoanDetailsScreen.js must exist');
assert(fs.existsSync(reportsPath), 'LoanReportsScreen.js must exist');
assert(fs.existsSync(utilsPath), 'loanReportUtils.js must exist');

const detailsContent = fs.readFileSync(detailsPath, 'utf8');
const reportsContent = fs.readFileSync(reportsPath, 'utf8');

// LoanDetailsScreen + loanDetailsLayout must pass { id: loan.id } for both LENT and BORROWED LoanReports navigation
const { getLoanActionsConfig } = require('../src/utils/loanDetailsLayout');
const lentReportsAction = getLoanActionsConfig({ id: 101, loan_direction: 'LENT' }).secondary.find(
  (a) => a.route === 'LoanReports'
);
const borrowedReportsAction = getLoanActionsConfig({ id: 202, loan_direction: 'BORROWED' }).secondary.find(
  (a) => a.route === 'LoanReports'
);
assert.deepStrictEqual(lentReportsAction && lentReportsAction.params, { id: 101 });
assert.deepStrictEqual(borrowedReportsAction && borrowedReportsAction.params, { id: 202 });
assert(
  detailsContent.includes('navigation.navigate(action.route, action.params)'),
  'LoanDetailsScreen secondary actions must forward action.params (including { id: loan.id })'
);
assert(
  !/navigation\.navigate\(\s*["']LoanReports["']\s*\)/.test(detailsContent),
  'LoanDetailsScreen must NOT navigate to LoanReports without loan id param'
);

// LoanReportsScreen must read route?.params?.id and use SVG charts + loanReportUtils + theme
assert(
  reportsContent.includes('route?.params?.id') || reportsContent.includes('route.params'),
  'LoanReportsScreen must read route params for single-loan filtering'
);
assert(
  reportsContent.includes('loanReportUtils'),
  'LoanReportsScreen must use loanReportUtils'
);
assert(
  reportsContent.includes('react-native-svg'),
  'LoanReportsScreen must render visual charts with react-native-svg'
);
assert(
  reportsContent.includes('theme.textPrimary'),
  'LoanReportsScreen must respect dark/light theme textPrimary'
);

// 2. Unit tests on loanReportUtils
const {
  isAdditionPaymentType,
  buildSingleLoanSummary,
  buildSingleLoanMonthlySeries,
  sampleSeriesPoints,
} = require('../src/utils/loanReportUtils');

// 2a. Addition type detection
assert.strictEqual(isAdditionPaymentType('TOP_UP'), true);
assert.strictEqual(isAdditionPaymentType('advance'), true);
assert.strictEqual(isAdditionPaymentType('EMI'), false);
assert.strictEqual(isAdditionPaymentType('PREPAYMENT'), false);
assert.strictEqual(isAdditionPaymentType('FORECLOSURE'), false);

// 2b. Single-loan filtering: payments from other loans MUST be excluded
const borrowedLoan = {
  id: 10,
  loan_name: 'Home Loan',
  lender: 'HDFC Bank',
  loan_direction: 'BORROWED',
  principal_amount: 120000,
  original_principal_amount: 100000,
  interest_rate: 12,
  loan_start_date: '2026-08-01T10:00:00.000Z',
  tenure_months: 12,
  emi_amount: 10000,
  outstanding_amount: 90000,
  principal_paid: 30000,
  interest_paid: 3000,
  total_paid: 33000,
  total_prepayment: 10000,
  remaining_months: 10,
  status: 'Active',
};

const mixedPayments = [
  {
    id: 1,
    loan_id: 10,
    payment_date: '2026-09-01T10:00:00.000Z',
    payment_amount: 10000,
    principal_component: 9000,
    interest_component: 1000,
    remaining_balance: 91000,
    payment_type: 'EMI',
  },
  {
    id: 2,
    loan_id: 10,
    payment_date: '2026-10-01T10:00:00.000Z',
    payment_amount: 20000,
    principal_component: 20000,
    interest_component: 0,
    remaining_balance: 111000,
    payment_type: 'TOP_UP',
  },
  {
    id: 3,
    loan_id: 10,
    payment_date: '2026-10-15T10:00:00.000Z',
    payment_amount: 13000,
    principal_component: 11000,
    interest_component: 2000,
    remaining_balance: 100000,
    payment_type: 'EMI',
  },
  {
    id: 4,
    loan_id: 10,
    payment_date: '2026-11-01T10:00:00.000Z',
    payment_amount: 10000,
    principal_component: 10000,
    interest_component: 0,
    remaining_balance: 90000,
    payment_type: 'PREPAYMENT',
  },
  // Another loan's payment MUST be ignored!
  {
    id: 99,
    loan_id: 25,
    payment_date: '2026-10-20T10:00:00.000Z',
    payment_amount: 50000,
    principal_component: 45000,
    interest_component: 5000,
    remaining_balance: 0,
    payment_type: 'EMI',
  },
];

const summary = buildSingleLoanSummary(borrowedLoan, mixedPayments);
assert.strictEqual(summary.loanId, 10);
assert.strictEqual(summary.isLent, false);
assert.strictEqual(summary.originalPrincipal, 100000);
assert.strictEqual(summary.currentPrincipal, 120000);
assert.strictEqual(summary.additionsTotal, 20000, 'TOP_UP must count under additionsTotal, not principalPaid');
assert.strictEqual(summary.principalPaid, 30000);
assert.strictEqual(summary.interestPaid, 3000);
assert.strictEqual(summary.totalPaid, 33000);
assert.strictEqual(summary.outstandingAmount, 90000);
assert.strictEqual(summary.prepaymentTotal, 10000);
assert.strictEqual(summary.repaymentProgressPct, 25); // (120000 - 90000) / 120000 = 25%
assert.strictEqual(summary.paymentMix.emi.count, 2);
assert.strictEqual(summary.paymentMix.emi.amount, 23000);
assert.strictEqual(summary.paymentMix.prepayment.count, 1);
assert.strictEqual(summary.paymentMix.prepayment.amount, 10000);
assert.strictEqual(summary.paymentMix.addition.count, 1);
assert.strictEqual(summary.paymentMix.addition.amount, 20000);
assert(summary.interestRemaining > 0, 'Active loan with EMI and rate should calculate remaining interest');

// Donut segments must reflect Principal Paid, Interest Paid, Remaining Balance
assert.strictEqual(summary.donutSegments.length, 3);
const segMap = Object.fromEntries(summary.donutSegments.map(s => [s.key, s]));
assert.strictEqual(segMap.principalPaid.amount, 30000);
assert.strictEqual(segMap.interestPaid.amount, 3000);
assert.strictEqual(segMap.remaining.amount, 90000);

// 2c. Monthly series excludes loan 25, separates TOP_UP from repayments, and appends future payoff projection
const series = buildSingleLoanMonthlySeries(borrowedLoan, mixedPayments, {
  now: new Date('2026-11-25T10:00:00.000Z'),
});
assert(series.actualMonths.length >= 4, 'Should include Aug..Nov 2026');
const octMonth = series.actualMonths.find(m => m.key === '2026-10');
assert(octMonth, 'Oct 2026 should exist in series');
assert.strictEqual(octMonth.principalPaid, 11000, 'Oct principalPaid must NOT include TOP_UP amount');
assert.strictEqual(octMonth.interestPaid, 2000);
assert.strictEqual(octMonth.additionAmount, 20000, 'Oct additionAmount should record the TOP_UP');
assert.strictEqual(octMonth.balance, 100000, 'Oct ending balance should match final payment remaining_balance');

const novMonth = series.actualMonths.find(m => m.key === '2026-11');
assert.strictEqual(novMonth.principalPaid, 10000);
assert.strictEqual(novMonth.balance, 90000);

// Active months should exclude months with 0 payments and 0 additions (Aug 2026)
assert.strictEqual(series.activeMonths.some(m => m.key === '2026-08'), false);
assert.strictEqual(series.activeMonths.length, 3);

// Projected balance points should descend to 0
assert(series.projectedMonths.length > 0, 'Active loan with remainingMonths should produce projected payoff months');
assert.strictEqual(
  series.projectedMonths[series.projectedMonths.length - 1].balance,
  0,
  'Final projected balance should reach 0'
);

// 2d. LENT loan edge case + no fixed EMI/tenure
const lentLoan = {
  id: 42,
  loan_name: 'Lent to Ravi',
  lender: 'Ravi',
  loan_direction: 'LENT',
  principal_amount: 50000,
  interest_rate: 0,
  loan_start_date: '2026-10-01T00:00:00.000Z',
  tenure_months: 0,
  emi_amount: 0,
  outstanding_amount: 50000,
  principal_paid: 0,
  interest_paid: 0,
  total_paid: 0,
  remaining_months: Infinity,
  status: 'Active',
};
const lentSummary = buildSingleLoanSummary(lentLoan, []);
assert.strictEqual(lentSummary.isLent, true);
assert.strictEqual(lentSummary.remainingMonths, 0);
assert.strictEqual(lentSummary.interestRemaining, 0);
assert.strictEqual(lentSummary.repaymentProgressPct, 0);
const lentSeries = buildSingleLoanMonthlySeries(lentLoan, [], {
  now: new Date('2026-11-25T10:00:00.000Z'),
});
assert.strictEqual(lentSeries.activeMonths.length, 0);
assert.strictEqual(lentSeries.projectedMonths.length, 0);
assert(lentSeries.actualMonths.length >= 2);
assert.strictEqual(lentSeries.actualMonths[lentSeries.actualMonths.length - 1].balance, 50000);

// 2e. Closed loan edge case
const closedLoan = {
  id: 77,
  loan_name: 'Bike Loan',
  loan_direction: 'BORROWED',
  principal_amount: 60000,
  interest_rate: 10,
  loan_start_date: '2026-01-01T00:00:00.000Z',
  tenure_months: 6,
  emi_amount: 10300,
  outstanding_amount: 0,
  principal_paid: 60000,
  interest_paid: 1800,
  total_paid: 61800,
  remaining_months: 0,
  status: 'Closed',
};
const closedSummary = buildSingleLoanSummary(closedLoan, []);
assert.strictEqual(closedSummary.isClosed, true);
assert.strictEqual(closedSummary.repaymentProgressPct, 100);
assert.strictEqual(closedSummary.interestRemaining, 0);
const closedSeries = buildSingleLoanMonthlySeries(closedLoan, [], {
  now: new Date('2026-11-25T10:00:00.000Z'),
});
assert.strictEqual(closedSeries.projectedMonths.length, 0, 'Closed loan must not project future balance');
assert.strictEqual(closedSeries.actualMonths[closedSeries.actualMonths.length - 1].balance, 0);

// 2g. Current month balance always anchors to live loan.outstanding_amount (e.g. after manual edit)
const editedLoan = {
  ...borrowedLoan,
  id: 88,
  outstanding_amount: 82000,
};
const editedPayments = [
  {
    id: 501,
    loan_id: 88,
    payment_date: '2026-09-01T10:00:00.000Z',
    payment_amount: 10000,
    principal_component: 9000,
    interest_component: 1000,
    remaining_balance: 91000,
    payment_type: 'EMI',
  },
];
const editedSeries = buildSingleLoanMonthlySeries(editedLoan, editedPayments, {
  now: new Date('2026-11-25T10:00:00.000Z'),
});
assert.strictEqual(
  editedSeries.actualMonths[editedSeries.actualMonths.length - 1].balance,
  82000,
  'Final actual month balance must match live outstanding_amount'
);

// 2f. Downsampling helper preserves first, pivot (last actual), and final point
const manyPoints = Array.from({ length: 40 }, (_, i) => ({
  key: `m-${i}`,
  label: `M${i}`,
  balance: 40000 - i * 1000,
  isProjected: i >= 15,
}));
const sampled = sampleSeriesPoints(manyPoints, 12, 14);
assert(sampled.length <= 13, 'Sampled points should stay compact');
assert.strictEqual(sampled[0].key, 'm-0');
assert(sampled.some(p => p.key === 'm-14'), 'Must preserve current pivot point');
assert.strictEqual(sampled[sampled.length - 1].key, 'm-39');

console.log('✓ All Single-Loan Reports Tests Passed Successfully!');
