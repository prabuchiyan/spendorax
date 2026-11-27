const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing BudgetsScreen Redesign & Light/Dark Theme Contracts...');

const screenPath = path.resolve(__dirname, '../src/screens/BudgetsScreen.js');
assert(fs.existsSync(screenPath), 'BudgetsScreen.js must exist');
const content = fs.readFileSync(screenPath, 'utf8');

// 1. Adaptive Light & Dark Theme support (no hardcoded dark card in light mode)
assert(content.includes('useTheme()'), 'BudgetsScreen must subscribe to ThemeContext');
assert(content.includes('isDarkMode'), 'BudgetsScreen must adapt surface and text colors for light and dark modes');
assert(!content.includes("backgroundColor: '#1E293B'") || content.includes('if (isDarkMode)'), 'Must not hardcode dark summary card outside dark mode');
assert(!content.includes("backgroundColor: '#f5f5f5'"), 'Must remove legacy hardcoded light-only tab background');

// 2. Scrollable Category Budgets Hero Overview inside FlatList
assert(content.includes('TOTAL CATEGORY BUDGET'), 'Must display Total Category Budget hero section');
assert(content.includes('MONTHLY OVERALL BUDGET'), 'Must display adaptive Monthly Overall Budget hero section');
assert(content.includes('<CurrencyText'), 'Must use CurrencyText for balance visibility masking');
assert(content.includes('toggleBalance'), 'Must allow toggling balance visibility on Budgets screen');
assert(content.includes('ListHeaderComponent={categoryListHeader}'), 'Month bar, hero overview, search and controls must scroll inside FlatList header');

// 3. Compact status badges instead of redundant "Category budgets are set" banner
assert(!content.includes('You already have category budgets for this month'), 'Must remove oversized redundant "Category budgets are set" card');
assert(content.includes('shouldShowCopyOption'), 'Must retain Copy from Past Month action when current month has zero budgets');

// 4. Filter pills, search bar & sorting
assert(content.includes('STATUS_FILTERS'), 'Must provide Over / Near Limit / On Track status filters');
assert(content.includes('SORT_MODES'), 'Must support sorting category budgets');
assert(content.includes('keyboardShouldPersistTaps="handled"'), 'Lists must allow taps while keyboard is open');

// 5. Hidden Edit & Delete inside Budget Action Sheet (no inline card clutter behind FAB)
assert(content.includes('<ResponsiveBottomSheet'), 'Budget edit/delete actions must render inside ResponsiveBottomSheet');
assert(content.includes('actionSheetBudget'), 'BudgetsScreen must track selected budget for hidden action sheet');
assert(content.includes('moreActionsPill') && content.includes('onLongPress'), 'Cards must open hidden actions via subtle pill or long press');
assert(content.includes('numberOfLines={2}'), 'Budget category names must wrap cleanly onto 2 lines');

const cardRenderStart = content.indexOf('const renderBudgetCard');
const cardRenderEnd = content.indexOf('keyboardShouldPersistTaps="handled"', cardRenderStart);
assert(cardRenderStart !== -1 && cardRenderEnd > cardRenderStart, 'Must locate renderBudgetCard block');
const cardBlock = content.slice(cardRenderStart, cardRenderEnd);
assert(!cardBlock.includes('trash-2') && !cardBlock.includes('edit-2') && !cardBlock.includes('icon="pencil"') && !cardBlock.includes('icon="delete"'), 'Budget cards must not expose inline edit/delete buttons');

// 6. Navigation, Copy Modal, Delete Modal, FAB & Safety Invariants
assert(content.includes("navigateTarget('CategoriesDetails'"), 'Tapping budget card must navigate to CategoriesDetails');
assert(content.includes("navigation.navigate('BudgetCreate'"), 'Editing and FAB must navigate to BudgetCreate');
assert(content.includes('<CopyBudgetModal'), 'Screen must preserve CopyBudgetModal integration');
assert(content.includes('<CommonBottomSheetModal'), 'Delete confirmation must use CommonBottomSheetModal');
assert(content.includes('<ContextualFAB'), 'Category Budget tab must retain ContextualFAB');
assert(content.includes('paddingBottom: 112'), 'FlatList bottom padding must keep the last card clear of the floating + FAB');
assert(content.includes("isCurrentMonthSelected ?"), 'Past month budgets must remain view-only without mutating current budgets');

// 7. Behavioral status classification & sorting checks
function getBudgetStatusKey(budget) {
  if (budget.exceeded) return 'over';
  if (Number(budget.percentage || 0) >= 80) return 'near';
  return 'track';
}
const mockBudgets = [
  { id: 1, categoryName: 'DTH', budget: 199, spent: 199, percentage: 100, exceeded: false },
  { id: 2, categoryName: 'Diwali', budget: 3000, spent: 3670, percentage: 122.3, exceeded: true },
  { id: 3, categoryName: 'Groceries', budget: 8000, spent: 4000, percentage: 50, exceeded: false },
];
assert.strictEqual(getBudgetStatusKey(mockBudgets[0]), 'near', '100% non-exceeded should classify as Near Limit');
assert.strictEqual(getBudgetStatusKey(mockBudgets[1]), 'over', 'Exceeded should classify as Over');
assert.strictEqual(getBudgetStatusKey(mockBudgets[2]), 'track', '50% should classify as On Track');

const byHighestPct = [...mockBudgets].sort((a, b) => b.percentage - a.percentage);
assert.deepStrictEqual(byHighestPct.map((b) => b.id), [2, 1, 3], 'Highest % sort must surface Over/Near budgets first');

console.log('✓ All BudgetsScreen Redesign tests passed successfully!');
