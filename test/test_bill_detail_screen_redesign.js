const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing BillDetailScreen & PremiumRoundedBarChart Light/Dark Theme Redesign...');

const screenPath = path.resolve(__dirname, '../src/screens/BillDetailScreen.js');
const chartPath = path.resolve(__dirname, '../src/components/PremiumRoundedBarChart.js');

assert(fs.existsSync(screenPath), 'BillDetailScreen.js must exist');
assert(fs.existsSync(chartPath), 'PremiumRoundedBarChart.js must exist');

const content = fs.readFileSync(screenPath, 'utf8');
const chartContent = fs.readFileSync(chartPath, 'utf8');

// 1. Light & Dark Theme support (removed hardcoded dark navy hero card and light-only boxes)
assert(content.includes('useTheme()'), 'BillDetailScreen must subscribe to ThemeContext');
assert(content.includes('isDarkMode'), 'BillDetailScreen must adapt colors cleanly for Light & Dark themes');
assert(!content.includes('heroGradient'), 'Must remove hardcoded dark SVG gradient hero card in Light Mode');
assert(!content.includes("backgroundColor: '#0c1626'") && !content.includes('backgroundColor: "#0c1626"'), 'Must not hardcode dark navy hero card outside dark theme');
assert(chartContent.includes('useTheme()') && chartContent.includes('isDarkMode'), 'PremiumRoundedBarChart must adapt bar tracks and text to Light & Dark modes');

// 2. Balance visibility support across hero, series & linked entries
assert(content.includes('useBalanceVisibility()') && content.includes('toggleBalance'), 'BillDetailScreen must support toggling balance visibility');

// 3. Clean uncluttered Bottom Dock + Unified ResponsiveBottomSheet Actions & Pickers
assert(content.includes('<ResponsiveBottomSheet'), 'BillDetailScreen must use ResponsiveBottomSheet for Manage Actions, Link Transaction & Source Picker');
assert(content.includes('showActionSheet'), 'BillDetailScreen must route secondary actions through unified Action Sheet instead of Alert.alert or 5 crowded dock buttons');
assert(!content.includes('Alert.alert(\n      bill.name'), 'Must replace native Alert.alert popup menu with themed ResponsiveBottomSheet');

// 4. Credit Card bill payment bug fix (markBillPaid expects options object, not null second param)
assert(
  content.includes('createTransaction: false') && content.includes('existingTransactionId: paymentId'),
  'Credit card bill payment on BillDetailScreen must pass options object to markBillPaid'
);
assert(!content.includes('markBillPaid(activeBill.id, null, paymentId)'), 'Must fix broken 3-arg markBillPaid(id, null, paymentId) call');

// 5. All core modals, sections & navigation preserved
assert(content.includes('LinkedTransactionsCard'), 'Must preserve LinkedTransactionsCard');
assert(content.includes('Series Overview'), 'Must preserve Series Overview card');
assert(content.includes('Billing History'), 'Must preserve Billing History chart card');
assert(content.includes('YearQuickJumpModal'), 'Must preserve YearQuickJumpModal');
assert(content.includes('<SkipBillModal') && content.includes('<UnskipBillModal'), 'Must preserve Skip/Unskip modals');
assert(content.includes('<CommonBottomSheetModal'), 'Must preserve Delete Occurrence and Unlink Transaction modals');
assert(content.includes("navigate('BillOccurrenceEdit'"), 'Must preserve BillOccurrenceEdit navigation');
assert(content.includes("navigate('TransactionAdd'"), 'Must preserve editing linked transactions');

console.log('✓ All BillDetailScreen Redesign tests passed successfully!');
