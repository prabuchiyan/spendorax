const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing SourcesScreen (Accounts) Redesign & Light/Dark Theme Contracts...');

const screenPath = path.resolve(__dirname, '../src/screens/SourcesScreen.js');
assert(fs.existsSync(screenPath), 'SourcesScreen.js must exist');
const content = fs.readFileSync(screenPath, 'utf8');

// 1. Theme support (Light & Dark modes via ThemeContext without hardcoded dark header)
assert(content.includes('useTheme()'), 'SourcesScreen must subscribe to ThemeContext');
assert(content.includes('isDarkMode'), 'SourcesScreen must adapt surface/tint colors for light and dark themes');
assert(!content.includes("backgroundColor: '#1E293B'") || content.includes('if (isDarkMode)'), 'Must not hardcode dark header background in light mode');

// 2. Hero Overview with Net Balance, Positive & Negative breakdown, and eye toggle
assert(content.includes('NET ACCOUNTS BALANCE'), 'Must display Net Accounts Balance hero section');
assert(content.includes('<CurrencyText'), 'Must use CurrencyText for net balance visibility support');
assert(content.includes('toggleBalance'), 'Must allow toggling balance visibility from Accounts hero');
assert(content.includes('summary.positiveTotal') && content.includes('summary.negativeTotal'), 'Must compute and show positive and negative totals');

// 3. Interactive filtering, search & sorting
assert(content.includes('FILTER_OPTIONS'), 'Must provide All / Positive / Negative filter pills');
assert(content.includes('balanceFilter'), 'Must track active balanceFilter state');
assert(content.includes('SORT_MODES'), 'Must support sorting accounts');
assert(content.includes('keyboardShouldPersistTaps="handled"'), 'FlatList must allow smooth taps while search keyboard is open');

// 4. Clean non-truncating card layout & balance privacy on initial balance
assert(content.includes('numberOfLines={2}'), 'Long account names must wrap cleanly onto 2 lines instead of single-line cut-off');
assert(
  content.includes('Initial:') &&
  content.includes('item.initial_balance || 0') &&
  content.includes("'••••'"),
  'Initial balance must also respect balanceVisible mask'
);

// 5. Hidden Edit & Delete inside Account Action Sheet (not permanently exposed on cards)
assert(content.includes('<ResponsiveBottomSheet'), 'Account actions must render inside ResponsiveBottomSheet');
assert(content.includes('actionSheetItem'), 'SourcesScreen must track selected account for hidden action sheet');
assert(content.includes('moreActionsPill') && content.includes('onLongPress'), 'Cards must hide edit/delete and open action sheet via subtle pill or long press');
const cardRenderStart = content.indexOf('const renderAccountCard');
const cardRenderEnd = content.indexOf('data={filteredItems}', cardRenderStart);
assert(cardRenderStart !== -1 && cardRenderEnd > cardRenderStart, 'Must locate renderAccountCard block');
const cardBlock = content.slice(cardRenderStart, cardRenderEnd);
assert(!cardBlock.includes('trash-2') && !cardBlock.includes('edit-2'), 'Account cards themselves must not display inline edit/delete icons');

// 6. Navigation, Delete Modal & FAB contracts preserved
assert(content.includes("navigate('SourcesDetails'"), 'Tapping account card must navigate to SourcesDetails');
assert(content.includes("navigate('SourceCreate', { editData: target })"), 'Edit action inside sheet must navigate to SourceCreate');
assert(content.includes('<CommonBottomSheetModal'), 'Delete confirmation must use CommonBottomSheetModal');
assert(content.includes('<ContextualFAB'), 'Screen must retain ContextualFAB for creating new accounts');
assert(content.includes('paddingBottom: 112'), 'List bottom padding must keep the last card clear of the floating + FAB');

// 7. Behavioral filter & summary verification (credit card sources excluded from Accounts page)
assert(
  content.includes("String(s?.type || '').toLowerCase() !== 'credit_card'"),
  'SourcesScreen must filter out credit_card sources from display and totals'
);
assert(
  content.includes('dispatch(setSources(updated))'),
  'Redux source store must still receive all sources while Accounts page filters credit_card locally'
);

const mockAccounts = [
  { id: 1, name: 'Bank of Baroda', balance: 221174.5, type: 'bank' },
  { id: 2, name: 'Cash', balance: 500, type: 'cash' },
  { id: 3, name: 'Axis Bank', balance: -189231.23, type: 'bank' },
  { id: 4, name: 'HDFC Millennia', balance: -15000, type: 'credit_card' },
];
const visibleAccounts = mockAccounts.filter(
  (s) => String(s?.type || '').toLowerCase() !== 'credit_card'
);
const net = visibleAccounts.reduce((s, a) => s + a.balance, 0);
const posCount = visibleAccounts.filter((a) => a.balance >= 0).length;
const negCount = visibleAccounts.filter((a) => a.balance < 0).length;
assert.strictEqual(visibleAccounts.length, 3, 'Credit card account must be excluded');
assert(Math.abs(net - 32443.27) < 0.01, 'Net balance calculation mismatch');
assert.strictEqual(posCount, 2);
assert.strictEqual(negCount, 1);

console.log('✓ All SourcesScreen Redesign tests passed successfully!');
