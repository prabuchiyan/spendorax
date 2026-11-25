const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing Advanced Search Stability Contracts & Performance Fixes...');

const searchScreenPath = path.resolve(__dirname, '../src/screens/SearchScreen.js');
const listItemPath = path.resolve(__dirname, '../src/components/TransactionListItem.js');

assert(fs.existsSync(searchScreenPath), 'SearchScreen.js must exist');
assert(fs.existsSync(listItemPath), 'TransactionListItem.js must exist');

const searchContent = fs.readFileSync(searchScreenPath, 'utf8');
const listItemContent = fs.readFileSync(listItemPath, 'utf8');

// 1. SectionList stability props
assert(searchContent.includes('removeClippedSubviews={false}'), 'Must set removeClippedSubviews={false} on SectionList to stop Android cell detachment jitter');
assert(searchContent.includes('sectionListRef'), 'Must have sectionListRef to reset scroll position on dataset changes');
assert(searchContent.includes('initialNumToRender={15}') || searchContent.includes('initialNumToRender'), 'Must define initialNumToRender');
assert(searchContent.includes('maxToRenderPerBatch'), 'Must define maxToRenderPerBatch');
assert(searchContent.includes('windowSize'), 'Must tune windowSize');

// 2. Section stable keys in groupedResults
assert(searchContent.includes('key: dateKey'), 'Each section in groupedResults must have explicit stable key');

// 3. Category & Source maps for O(1) lookups
assert(searchContent.includes('categoryMap'), 'Must use categoryMap for O(1) lookups');
assert(searchContent.includes('sourceMap'), 'Must use sourceMap for O(1) lookups');

// 4. Memoized renderItem & renderSectionHeader
assert(searchContent.includes('const renderItem = useCallback'), 'Must memoize renderItem');
assert(searchContent.includes('const renderSectionHeader = useCallback'), 'Must memoize renderSectionHeader');

// 5. Loading indicator state to prevent empty layout thrashing
assert(searchContent.includes('isSearching'), 'Must track isSearching state');
assert(searchContent.includes('ActivityIndicator'), 'Must show ActivityIndicator during search/filter fetch');

// 6. Preserve scroll offset after editing/returning; only scroll to top on explicit filter/search change
assert(searchContent.includes('shouldScrollToTopRef'), 'Must guard scroll-to-top with shouldScrollToTopRef');
assert(searchContent.includes('handleSearchQueryChange'), 'Must use handleSearchQueryChange to mark explicit query changes');
assert(searchContent.includes('if (shouldScrollToTopRef.current)'), 'Must only reset scroll position when explicitly requested');
assert(!searchContent.includes('dispatch(setFilteredTransactions(transactions));\n      try {\n        sectionListRef.current'), 'Must NOT unconditionally scroll to top on focus refresh');

// 7. Memoized TransactionListItem
assert(listItemContent.includes('React.memo'), 'TransactionListItem must be wrapped in React.memo');

// 8. Advanced Search pickers use unified Transaction-page card design without name truncation
const pickerContent = fs.readFileSync(
  path.resolve(__dirname, '../src/components/SearchableItemPickerModal.js'),
  'utf8'
);
assert(searchContent.includes('<SearchableItemPickerModal'), 'SearchScreen must use SearchableItemPickerModal');
assert(searchContent.includes('<ResponsiveBottomSheet'), 'Advanced Filters sheet must use ResponsiveBottomSheet so picker portals stack above it cleanly');
assert(pickerContent.includes('itemIconCircle'), 'Advanced Search pickers must match Transaction circular icon card design');
assert(pickerContent.includes('minHeight: 88'), 'Advanced Search picker tiles must preserve consistent height for single & wrapped 2-line names');

console.log('✓ All Advanced Search Stability tests passed successfully!');

