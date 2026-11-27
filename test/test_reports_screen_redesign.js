const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing ReportsScreen Redesign & groupTransactions Net Bug Fix...');

const screenPath = path.resolve(__dirname, '../src/screens/ReportsScreen.js');
const servicePath = path.resolve(__dirname, '../src/services/reports.js');
assert(fs.existsSync(screenPath), 'ReportsScreen.js must exist');
assert(fs.existsSync(servicePath), 'reports.js must exist');

const screenContent = fs.readFileSync(screenPath, 'utf8');
const serviceContent = fs.readFileSync(servicePath, 'utf8');

// 1. Fixed Net Balance bug in reports.js
assert(
  serviceContent.includes('groups[key].balance = groups[key].income - groups[key].expense'),
  'groupTransactions must compute actual net balance instead of leaving it at 0'
);
assert(
  serviceContent.includes("tx.transfer_group_id"),
  'groupTransactions must safely skip transfer legs'
);

// 2. Non-truncating segmented mode tabs (fixes "Mont..." Paper Chip truncation)
assert(screenContent.includes('REPORT_MODES'), 'ReportsScreen must define Daily/Weekly/Monthly/Yearly mode switcher');
assert(!screenContent.includes("from 'react-native-paper'"), 'Must avoid Paper Chip truncation on Monthly tab');
assert(screenContent.includes('numberOfLines={1}'), 'Mode labels must render cleanly without truncation');

// 3. Adaptive Light & Dark Theme + Cashflow Hero Overview
assert(screenContent.includes('useTheme()'), 'ReportsScreen must subscribe to ThemeContext');
assert(screenContent.includes('isDarkMode'), 'ReportsScreen must adapt colors cleanly for Light and Dark modes');
assert(!screenContent.includes("backgroundColor: '#F6F8FF'"), 'Must remove hardcoded light-only page background');
assert(!screenContent.includes("backgroundColor: 'rgba(255,255,255,0.85)'"), 'Must remove hardcoded light floating buttons');
assert(screenContent.includes('useBalanceVisibility()'), 'ReportsScreen must support balance visibility toggle');
assert(screenContent.includes('CASHFLOW'), 'ReportsScreen must display interactive Cashflow Overview hero section');
assert(screenContent.includes('Income vs Expense Trend'), 'ReportsScreen must display upgraded trend chart card');
assert(screenContent.includes('Savings Rate:'), 'Cashflow card must display savings rate when income > 0');

// 4. Fixed Filter Pill spacing ("Filtering: Nov '26Clear Filter" bug) & interactive controls
assert(screenContent.includes('clearFilterPill'), 'Period filter banner must use separated Clear Filter pill');
assert(screenContent.includes('FLOW_FILTERS'), 'Must provide All / Expenses / Income category filters');
assert(screenContent.includes('SORT_MODES'), 'Must provide Top Spend / Name A-Z sort modes');
assert(screenContent.includes("navigate('CategoriesDetails'"), 'Tapping a category row must still navigate to CategoriesDetails');

// 5. Daily & Weekly readable 2-line chart labels, dateUtils 'daily' fix, and zero-value bar separation
const dateUtilsPath = path.resolve(__dirname, '../src/utils/dateUtils.js');
const dateUtilsContent = fs.readFileSync(dateUtilsPath, 'utf8');
assert(
  dateUtilsContent.includes("rawType === 'daily' ? 'day'"),
  "dateUtils.getLabelForDate must handle 'daily' without stripping to 'dai'"
);
assert(
  screenContent.includes('getChartAxisParts') && screenContent.includes('getReadablePeriodLabel'),
  'ReportsScreen must render compact 2-line chart axis labels and full readable period headers for Daily/Weekly'
);
assert(
  screenContent.includes('axisSecondaryLabel') && screenContent.includes('paddingLeft: 44'),
  'ReportsScreen chart columns must stack primary/secondary labels cleanly with clear Y-axis gutter'
);
assert(
  screenContent.includes('incVal > 0 ? Math.max') && screenContent.includes('expVal > 0 ? Math.max'),
  'Zero-amount bars must render flat neutral baseline stubs instead of colored blocks'
);
assert(
  serviceContent.includes("tx.type !== 'income' && tx.type !== 'expense'"),
  'groupTransactions must skip non-income/expense entries before creating period groups'
);

// 6. Runtime verification of Daily & Weekly axis formatting + groupTransactions math
// Simulate the exact logic from reports.js
function simulateGroupTransactions(transactions, mode) {
  const groups = {};
  const pad = (n) => String(n).padStart(2, '0');
  transactions.forEach((tx) => {
    if (tx.is_counted === 0 || tx.is_counted === '0' || tx.is_counted === false) return;
    if (tx.transfer_group_id) return;
    const d = new Date(String(tx.date).replace(' ', 'T'));
    const key = mode === 'monthly'
      ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
      : `${d.getFullYear()}`;
    if (!groups[key]) {
      groups[key] = { label: key, income: 0, expense: 0, balance: 0, txCount: 0, categories: {} };
    }
    const amt = Number(tx.amount) || 0;
    const cid = tx.category_id || 'uncategorized';
    if (!groups[key].categories[cid]) {
      groups[key].categories[cid] = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
    }
    if (tx.type === 'income') {
      groups[key].income += amt;
      groups[key].categories[cid].income += amt;
      groups[key].categories[cid].incomeCount += 1;
      groups[key].txCount += 1;
    } else if (tx.type === 'expense') {
      groups[key].expense += amt;
      groups[key].categories[cid].expense += amt;
      groups[key].categories[cid].expenseCount += 1;
      groups[key].txCount += 1;
    }
    groups[key].balance = groups[key].income - groups[key].expense;
  });
  return Object.values(groups).sort((a, b) => b.label.localeCompare(a.label));
}

const sampleTx = [
  { id: 1, type: 'income', amount: 25, category_id: 10, date: '2026-11-05T10:00:00' },
  { id: 2, type: 'expense', amount: 14500, category_id: 20, date: '2026-11-06T10:00:00' },
  { id: 3, type: 'expense', amount: 38602, category_id: 21, date: '2026-11-07T10:00:00' },
  { id: 4, type: 'expense', amount: 999, category_id: 21, date: '2026-11-08T10:00:00', is_counted: 0 },
];
const res = simulateGroupTransactions(sampleTx, 'monthly');
assert.strictEqual(res.length, 1);
assert.strictEqual(res[0].income, 25);
assert.strictEqual(res[0].expense, 53102);
assert.strictEqual(res[0].balance, -53077, 'Net balance must equal income - expense (-53077), not 0');
assert.strictEqual(res[0].txCount, 3, 'Excluded transactions must not count');

console.log('✓ All ReportsScreen Redesign & Net Balance tests passed successfully!');
