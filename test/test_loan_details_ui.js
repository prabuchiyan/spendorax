const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing LoanDetails Responsive Actions & UI Upgrade...');

const layoutUtilPath = path.resolve(__dirname, '../src/utils/loanDetailsLayout.js');
const detailsScreenPath = path.resolve(__dirname, '../src/screens/LoanDetailsScreen.js');

assert(fs.existsSync(layoutUtilPath), 'loanDetailsLayout.js must exist');
assert(fs.existsSync(detailsScreenPath), 'LoanDetailsScreen.js must exist');

const detailsContent = fs.readFileSync(detailsScreenPath, 'utf8');

// 1. Contract assertions on LoanDetailsScreen.js
assert(
  detailsContent.includes('loanDetailsLayout'),
  'LoanDetailsScreen must use loanDetailsLayout helper'
);
assert(
  detailsContent.includes('onLayout'),
  'LoanDetailsScreen must measure real container width via onLayout for responsive action buttons'
);
assert(
  !detailsContent.includes('(screenWidth - horizontalPadding * 2 - ACTION_GAP * 2) / 3'),
  'Broken actionWidth formula ignoring Card padding must be removed'
);
assert(
  detailsContent.includes('theme.textPrimary') && detailsContent.includes('theme.cardBgSecondary'),
  'LoanDetailsScreen must apply theme tokens for dark/light mode support'
);
const layoutContent = fs.readFileSync(layoutUtilPath, 'utf8');
assert(
  detailsContent.includes('navigation.navigate(action.route, action.params)') &&
    layoutContent.includes("route: 'LoanReports'"),
  'LoanDetailsScreen must forward action.params (including loan id) to LoanReports'
);

// 2. Unit tests on loanDetailsLayout.js
const {
  computeActionGridLayout,
  getLoanActionsConfig,
} = require('../src/utils/loanDetailsLayout');

// Verify BORROWED loan actions (1 primary + 6 secondary = 7 total, zero orphan rows)
const borrowedConfig = getLoanActionsConfig({
  id: 12,
  loan_name: 'Car Loan',
  loan_direction: 'BORROWED',
});
assert.strictEqual(borrowedConfig.primary.title, 'Pay EMI');
assert.strictEqual(borrowedConfig.primary.route, 'LoanPayment');
assert.deepStrictEqual(borrowedConfig.primary.params, { id: 12 });
assert.strictEqual(borrowedConfig.secondary.length, 6);
const borrowedRoutes = borrowedConfig.secondary.map((a) => a.route);
assert.deepStrictEqual(borrowedRoutes, [
  'TopUp',
  'LoanPayment',
  'LoanForeclose',
  'LoanHistory',
  'LoanReports',
  'LoanForm',
]);
const borrowedReports = borrowedConfig.secondary.find((a) => a.route === 'LoanReports');
assert.deepStrictEqual(borrowedReports.params, { id: 12 });
const borrowedPrepay = borrowedConfig.secondary.find((a) => a.title === 'Prepay');
assert.deepStrictEqual(borrowedPrepay.params, { id: 12, mode: 'prepayment' });

// Verify LENT loan actions (1 primary + 4 secondary = 5 total, zero orphan rows)
const lentConfig = getLoanActionsConfig({
  id: 34,
  loan_name: 'Friend Loan',
  loan_direction: 'LENT',
});
assert.strictEqual(lentConfig.primary.title, 'Receive Payment');
assert.strictEqual(lentConfig.primary.route, 'LoanPayment');
assert.deepStrictEqual(lentConfig.primary.params, { id: 34, mode: 'receive' });
assert.strictEqual(lentConfig.secondary.length, 4);
const lentRoutes = lentConfig.secondary.map((a) => a.route);
assert.deepStrictEqual(lentRoutes, [
  'LendMore',
  'LoanHistory',
  'LoanReports',
  'LoanForm',
]);
const lentReports = lentConfig.secondary.find((a) => a.route === 'LoanReports');
assert.deepStrictEqual(lentReports.params, { id: 34 });

// Verify responsive grid math never overflows container width across all screen sizes
const testWidths = [240, 268, 304, 312, 360, 440, 560, 720];
for (const w of testWidths) {
  for (const count of [4, 6]) {
    const layout = computeActionGridLayout(w, count);
    assert(layout.columns >= 2, `Columns must be >= 2 at width ${w}`);
    assert(layout.tileWidth > 0, `Tile width must be positive at width ${w}`);
    const totalUsedWidth = layout.tileWidth * layout.columns + layout.gap * (layout.columns - 1);
    assert(
      totalUsedWidth <= w,
      `Overflow at width ${w} for ${count} items: ${totalUsedWidth} > ${w}`
    );
    assert.strictEqual(
      count % layout.columns,
      0,
      `Expected symmetrical rows (zero orphans) for ${count} items at width ${w}, got ${layout.columns} cols`
    );
  }
}

// Verify responsive breakpoints adapt cleanly
assert.strictEqual(computeActionGridLayout(268, 4).columns, 2);
assert.strictEqual(computeActionGridLayout(312, 6).columns, 3);
assert.strictEqual(computeActionGridLayout(450, 4).columns, 4);
assert.strictEqual(computeActionGridLayout(680, 6).columns, 6);

// Verify edge case: 0 / negative / invalid width returns safe fallback
const safeFallback = computeActionGridLayout(0, 6);
assert(safeFallback.tileWidth > 0 && Number.isFinite(safeFallback.tileWidth));
assert(safeFallback.columns >= 2);

console.log('✓ All LoanDetails Responsive Actions & UI Tests Passed Successfully!');
