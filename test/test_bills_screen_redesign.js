const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing BillsScreen, BillSummaryBar, BillCard & BillCalendarView Redesign...');

const screenPath = path.resolve(__dirname, '../src/screens/BillsScreen.js');
const summaryPath = path.resolve(__dirname, '../src/components/BillSummaryBar.js');
const cardPath = path.resolve(__dirname, '../src/components/BillCard.js');
const calPath = path.resolve(__dirname, '../src/components/BillCalendarView.js');

assert(fs.existsSync(screenPath), 'BillsScreen.js must exist');
assert(fs.existsSync(summaryPath), 'BillSummaryBar.js must exist');
assert(fs.existsSync(cardPath), 'BillCard.js must exist');
assert(fs.existsSync(calPath), 'BillCalendarView.js must exist');

const screenContent = fs.readFileSync(screenPath, 'utf8');
const summaryContent = fs.readFileSync(summaryPath, 'utf8');
const cardContent = fs.readFileSync(cardPath, 'utf8');
const calContent = fs.readFileSync(calPath, 'utf8');

// 1. BillSummaryBar truthful status & no 3-column rupee truncation
assert(
  summaryContent.includes('if (overdueCount > 0 || overdue > 0)'),
  'Summary bar must show Overdue alert instead of claiming 100% Settled when overdue bills exist'
);
assert(
  summaryContent.includes('toggleBalance') && summaryContent.includes('<CurrencyText'),
  'BillSummaryBar must integrate balance visibility toggle'
);
assert(
  summaryContent.includes('upcomingStrip'),
  'Next 7 Days amount must get full-width strip when overdue tile is shown so values do not truncate'
);

// 2. BillCard non-truncating 2-line titles + hidden menu trigger via ResponsiveBottomSheet
assert(cardContent.includes('numberOfLines={2}'), 'Bill titles must allow 2 lines instead of tight single-line cut-off');
assert(!cardContent.includes("from 'react-native-paper'"), 'BillCard must avoid Paper Menu popup in favor of unified Action Sheet');
assert(cardContent.includes('moreActionsPill') && cardContent.includes('onOpenActions'), 'BillCard must route secondary actions cleanly to Bill Action Sheet');
assert(cardContent.includes('onLongPress'), 'BillCard must support long-press to open action sheet');

// 3. BillsScreen layout, dark/light theme, FAB & modals
assert(screenContent.includes('<ResponsiveBottomSheet'), 'BillsScreen must render Bill Actions and filter pickers in ResponsiveBottomSheet');
assert(screenContent.includes('actionSheetBill'), 'BillsScreen must track selected bill for Action Sheet');
assert(screenContent.includes('<ContextualFAB'), 'BillsScreen must place Add Bill in floating ContextualFAB so top bar never clips right edge');
assert(screenContent.includes('paddingBottom: 112'), 'ScrollView bottom padding must keep the last bill card above ContextualFAB');
assert(screenContent.includes('SORT_MODES'), 'BillsScreen must expose Due Date / Highest Amount sort toggle');
assert(screenContent.includes('<DeleteBillModal') && screenContent.includes('<SkipBillModal'), 'BillsScreen must preserve DeleteBillModal and SkipBillModal');
assert(screenContent.includes("navigate('CreditCardStatements'"), 'BillsScreen must preserve CreditCardStatements navigation');
assert(screenContent.includes("navigate('BillDetail'"), 'BillsScreen must preserve BillDetail navigation');

// 4. Calendar Dark Mode support & valid status dot detection
assert(calContent.includes('useTheme()') && calContent.includes('isDarkMode'), 'BillCalendarView must adapt cleanly to Light and Dark themes');
assert(!calContent.includes('.key ==='), 'Calendar must not read nonexistent .key field from getBillDisplayStatus');

console.log('✓ All BillsScreen Redesign tests passed successfully!');
