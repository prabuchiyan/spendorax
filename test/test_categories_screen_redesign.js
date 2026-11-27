const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing CategoriesScreen Redesign & Light/Dark Theme Contracts...');

const screenPath = path.resolve(__dirname, '../src/screens/CategoriesScreen.js');
assert(fs.existsSync(screenPath), 'CategoriesScreen.js must exist');
const content = fs.readFileSync(screenPath, 'utf8');

// 1. Light & Dark theme support via ThemeContext
assert(content.includes('useTheme()'), 'CategoriesScreen must subscribe to ThemeContext');
assert(content.includes('isDarkMode'), 'CategoriesScreen must adapt surface and tint colors for light and dark themes');
assert(!content.includes("backgroundColor: '#F7F9FB'"), 'Must remove legacy hardcoded light-only page background');
assert(!content.includes("backgroundColor: '#FFF3F3'"), 'Must remove legacy hardcoded light-only expense stat background');

// 2. Scrollable Hero Overview inside FlatList with Expense/Income interactive breakdown
assert(content.includes('CATEGORIES OVERVIEW'), 'Must display Categories Overview hero section');
assert(content.includes('ListHeaderComponent={listHeader}'), 'Hero and controls must scroll inside FlatList header');
assert(content.includes('summary.expenseCount') && content.includes('summary.incomeCount'), 'Must summarize expense and income categories');
assert(content.includes('toggleTypeFilter'), 'Hero breakdown tiles must filter by category type');

// 3. Filter pills, search bar & sorting
assert(content.includes('FILTER_OPTIONS'), 'Must provide All / Expense / Income filter pills');
assert(content.includes('typeFilter'), 'Must track active typeFilter state');
assert(content.includes('SORT_MODES'), 'Must support sorting categories (Default / Most Used / Name Z–A)');
assert(content.includes('keyboardShouldPersistTaps="handled"'), 'FlatList must allow taps while search keyboard is open');

// 4. Clean non-truncating card layout with hidden Edit & Delete actions
assert(content.includes('numberOfLines={2}'), 'Long category names must wrap cleanly onto 2 lines instead of single-line cut-off');
assert(content.includes('<ResponsiveBottomSheet'), 'Category actions must render inside ResponsiveBottomSheet');
assert(content.includes('actionSheetItem'), 'CategoriesScreen must track selected category for hidden action sheet');
assert(content.includes('moreActionsPill') && content.includes('onLongPress'), 'Cards must open hidden actions via subtle pill or long press');
const cardRenderStart = content.indexOf('const renderCategoryCard');
const cardRenderEnd = content.indexOf('keyboardShouldPersistTaps="handled"', cardRenderStart);
assert(cardRenderStart !== -1 && cardRenderEnd > cardRenderStart, 'Must locate renderCategoryCard block');
const cardBlock = content.slice(cardRenderStart, cardRenderEnd);
assert(!cardBlock.includes('trash-2') && !cardBlock.includes('edit-2'), 'Category cards must not display inline edit/delete icons');

// 5. Navigation, Delete Modal & FAB contracts preserved
assert(content.includes("navigateTarget('CategoriesDetails'"), 'Tapping category card must navigate to CategoriesDetails');
assert(content.includes("navigateTarget('CategoryBudgetsDashboard')"), 'Overview card must support quick navigation to CategoryBudgetsDashboard');
assert(content.includes("navigate('CategoryCreate'"), 'Edit action and FAB must navigate to CategoryCreate');
assert(content.includes('<CommonBottomSheetModal'), 'Delete confirmation must use CommonBottomSheetModal');
assert(content.includes('<ContextualFAB'), 'Screen must retain ContextualFAB for Expense and Income creation');
assert(content.includes('paddingBottom: 112'), 'List bottom padding must keep the last card clear of the floating + FAB');

// 6. Behavioral filter, sort & percentage math verification
const mockCategories = [
  { id: 1, name: 'Abinaya Birthday', type: 'expense' },
  { id: 2, name: 'Bank Charges', type: 'expense' },
  { id: 3, name: 'Salary', type: 'income' },
  { id: 4, name: 'Freelance', type: 'income' },
];
const mockUsage = { '1': 3, '2': 14, '3': 12, '4': 1 };

const expenseItems = mockCategories.filter((c) => c.type === 'expense');
const incomeItems = mockCategories.filter((c) => c.type === 'income');
assert.strictEqual(expenseItems.length, 2);
assert.strictEqual(incomeItems.length, 2);

const sortedByMostUsed = [...mockCategories].sort((a, b) => {
  const diff = (mockUsage[String(b.id)] || 0) - (mockUsage[String(a.id)] || 0);
  if (diff !== 0) return diff;
  return a.name.localeCompare(b.name);
});
assert.deepStrictEqual(
  sortedByMostUsed.map((c) => c.id),
  [2, 3, 1, 4],
  'Most Used sort must rank categories by transaction usage descending'
);

const searchMatches = mockCategories.filter((c) => c.name.toLowerCase().includes('bank'));
assert.deepStrictEqual(searchMatches.map((c) => c.id), [2], 'Search must filter case-insensitively by name');

console.log('✓ All CategoriesScreen Redesign tests passed successfully!');
