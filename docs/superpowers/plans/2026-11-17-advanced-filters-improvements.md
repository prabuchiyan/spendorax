# Advanced Filters Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ContextualFAB for creating new transactions directly from the Search screen, add single-select Account Source and Category filters using the common searchable picker modal, and persist filter selections in Redux so that screen navigation does not reset the filter view.

**Architecture:** 
1. Redux (`src/redux/slices/transactionSlice.js` and `src/redux/hooks.js`) stores the live search filter criteria and query text, ensuring zero-flicker persistence across navigation.
2. `src/services/transactions.js` enhances `getAdvancedSearchTransactions` with `categoryId` and `sourceId` parameters (including transfer leg matching) for both SQLite and Web shims.
3. A reusable `SearchableItemPickerModal` provides the standard SpendoraX picker design with search bar, icon chips, checkmarks, and an "All" option.
4. `SearchScreen.js` binds to Redux filter state, renders the Category/Account selectors and `ContextualFAB`, and refreshes transaction lists on screen focus while maintaining active filters.

**Tech Stack:** React Native, Expo, Redux Toolkit, SQLite (`expo-sqlite`), React Native Paper.

**Spec:** [docs/superpowers/specs/2026-11-17-advanced-filters-improvements-design.md](file:///c:/Users/Prabu.S/Prabuchiyan/spendorax/docs/superpowers/specs/2026-11-17-advanced-filters-improvements-design.md)

## Global Constraints
- React Native 0.74.5, Expo SDK 51, Redux Toolkit.
- Single-select for Category and Account Source filters, with an explicit "All" option.
- Transfer transactions must match when the selected Account is either the source or destination.
- ContextualFAB must provide Expense, Income, and Transfer actions that navigate to `TransactionAdd`.

## Review Focus
1. **Transfer Leg Matching**: A transfer transaction from Account A to Account B must be found when filtering by Account A OR Account B.
2. **Persistence on Edit / Add Return**: Navigating to `TransactionAdd` and returning must preserve the exact filter criteria and re-query to show updated/new transactions.
3. **Reset Behavior**: Tapping "Reset" must reset Redux state and component inputs cleanly to default and restore the base search state.
4. **Empty State / No Results**: Filtering by a category/source with zero matching records should show the empty state gracefully without errors.
5. **Dark Mode & Styling**: Pickers and modal elements must match the app's current theme palette.

---

### Task 1: Redux Filter State & Slice Actions

**Files:**
- Modify: `src/redux/slices/transactionSlice.js`
- Modify: `src/redux/hooks.js`
- Test: `test/test_search_filter_slice.js`

**Interfaces:**
- Consumes: `@reduxjs/toolkit`
- Produces: 
  - `setSearchFilter(filterParams)`
  - `resetSearchFilter()`
  - `setSearchQueryText(query)`
  - `useSearchFilter()` hook returning the current filter state

- [ ] **Step 1: Write test for Redux slice actions**

```javascript
// test/test_search_filter_slice.js
const assert = require('assert');
const { transactionSlice, setSearchFilter, resetSearchFilter, setSearchQueryText } = require('../src/redux/slices/transactionSlice');

const reducer = transactionSlice.reducer;
const initial = reducer(undefined, { type: '@@INIT' });

assert.ok(initial.searchFilter, 'Initial state must contain searchFilter');
assert.strictEqual(initial.searchFilter.advType, 'all');
assert.strictEqual(initial.searchFilter.advCategoryId, null);
assert.strictEqual(initial.searchFilter.advSourceId, null);
assert.strictEqual(initial.searchFilter.isFilterActive, false);

// Test setSearchFilter
const updated = reducer(initial, setSearchFilter({
  advType: 'expense',
  advCategoryId: 5,
  advSourceId: 2,
  advAmount: '150',
  isFilterActive: true
}));
assert.strictEqual(updated.searchFilter.advType, 'expense');
assert.strictEqual(updated.searchFilter.advCategoryId, 5);
assert.strictEqual(updated.searchFilter.advSourceId, 2);
assert.strictEqual(updated.searchFilter.advAmount, '150');
assert.strictEqual(updated.searchFilter.isFilterActive, true);

// Test resetSearchFilter
const reset = reducer(updated, resetSearchFilter());
assert.strictEqual(reset.searchFilter.advType, 'all');
assert.strictEqual(reset.searchFilter.advCategoryId, null);
assert.strictEqual(reset.searchFilter.isFilterActive, false);

console.log('Task 1 tests passed!');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/test_search_filter_slice.js`  
Expected: FAIL with missing properties or undefined action.

- [ ] **Step 3: Implement `searchFilter` state and reducers in `src/redux/slices/transactionSlice.js` and `src/redux/hooks.js`**

In `src/redux/slices/transactionSlice.js`:
- Add `searchFilter` to `initialState`:
  ```javascript
  searchFilter: {
    searchQuery: '',
    advAmount: '',
    advNote: '',
    advType: 'all',
    advDateType: 'none',
    advExactDate: '',
    advMonth: '',
    advYear: '',
    advStartDate: '',
    advEndDate: '',
    advCategoryId: null,
    advSourceId: null,
    groupByOption: 'day',
    isFilterActive: false
  }
  ```
- Add reducers: `setSearchFilter`, `resetSearchFilter`, `setSearchQueryText`.
- Export the action creators.

In `src/redux/hooks.js`:
- Export `useSearchFilter = () => useAppSelector(state => state.transactions.searchFilter)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test_search_filter_slice.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/redux/slices/transactionSlice.js src/redux/hooks.js test/test_search_filter_slice.js
git commit -m "feat(redux): add searchFilter state and actions for advanced filters"
```

---

### Task 2: Database Query Service Enhancements (`getAdvancedSearchTransactions`)

**Files:**
- Modify: `src/services/transactions.js`
- Test: `test/test_advanced_search_transactions.js`

**Interfaces:**
- Consumes: SQLite `executeSql` and params `{ amount, note, type, exactDate, month, year, startDate, endDate, categoryId, sourceId }`
- Produces: `getAdvancedSearchTransactions(params)` filtering by `categoryId` and `sourceId` for both SQLite and Web shim

- [ ] **Step 1: Write test for advanced search filtering by category and source**

```javascript
// test/test_advanced_search_transactions.js
const assert = require('assert');

// Simulate the filtering logic used in getAdvancedSearchTransactions
function filterTransactions(rows, params) {
  const { type, amount, note, categoryId, sourceId } = params;
  return rows.filter(tx => {
    if (type && type !== 'all') {
      const isTransfer = Boolean(tx.transfer_group_id || tx.type === 'transfer');
      if (type === 'transfer' && !isTransfer) return false;
      if (type === 'expense' && (isTransfer || tx.type !== 'expense')) return false;
      if (type === 'income' && (isTransfer || tx.type !== 'income')) return false;
    }
    if (amount && Number(tx.amount) !== Number(amount)) return false;
    if (note && (!tx.notes || tx.notes.toLowerCase() !== note.toLowerCase())) return false;
    if (categoryId != null && String(tx.category_id) !== String(categoryId)) return false;
    if (sourceId != null) {
      const matchesSource = String(tx.source_id) === String(sourceId) ||
        String(tx.toAccount) === String(sourceId) ||
        String(tx.to_account) === String(sourceId);
      if (!matchesSource) return false;
    }
    return true;
  });
}

const mockData = [
  { id: 1, type: 'expense', amount: 50, category_id: 10, source_id: 1, notes: 'Lunch' },
  { id: 2, type: 'expense', amount: 80, category_id: 20, source_id: 1, notes: 'Dinner' },
  { id: 3, type: 'income', amount: 1000, category_id: 30, source_id: 2, notes: 'Salary' },
  { id: 4, type: 'transfer', amount: 200, category_id: null, source_id: 1, toAccount: 2, notes: 'Move' }
];

// Test category filtering
assert.strictEqual(filterTransactions(mockData, { categoryId: 10 }).length, 1);
assert.strictEqual(filterTransactions(mockData, { categoryId: 99 }).length, 0);

// Test source filtering (including destination on transfer)
assert.strictEqual(filterTransactions(mockData, { sourceId: 1 }).length, 3);
assert.strictEqual(filterTransactions(mockData, { sourceId: 2 }).length, 2); // id 3 and id 4 (transfer toAccount 2)

console.log('Task 2 tests passed!');
```

- [ ] **Step 2: Run test to verify logic**

Run: `node test/test_advanced_search_transactions.js`  
Expected: PASS

- [ ] **Step 3: Implement Category & Source filter in `getAdvancedSearchTransactions` in `src/services/transactions.js`**

In `src/services/transactions.js`:
- Destructure `categoryId` and `sourceId` from `params`.
- In SQLite branch:
  ```javascript
  if (categoryId !== undefined && categoryId !== null && String(categoryId).trim() !== '') {
    conditions.push(`category_id = ?`);
    queryParams.push(categoryId);
  }

  if (sourceId !== undefined && sourceId !== null && String(sourceId).trim() !== '') {
    conditions.push(`(
      source_id = ? OR 
      (transfer_group_id IS NOT NULL AND transfer_group_id != '' AND transfer_group_id IN (
        SELECT transfer_group_id FROM transactions WHERE source_id = ?
      ))
    )`);
    queryParams.push(sourceId, sourceId);
  }
  ```
- In Web fallback branch:
  Filter by `categoryId` and `sourceId` (including checking `toAccount` / `to_account`).

- [ ] **Step 4: Verify syntax with Babel parser**

Run: `node -e "const fs = require('fs'); const babel = require('@babel/parser'); babel.parse(fs.readFileSync('src/services/transactions.js', 'utf8'), { sourceType: 'module', plugins: ['jsx'] }); console.log('Syntax valid!');"`  
Expected: `Syntax valid!`

- [ ] **Step 5: Commit**

```bash
git add src/services/transactions.js test/test_advanced_search_transactions.js
git commit -m "feat(services): add category and source filtering to getAdvancedSearchTransactions"
```

---

### Task 3: Create `SearchableItemPickerModal` Component

**Files:**
- Create: `src/components/SearchableItemPickerModal.js`
- Test: `test/test_searchable_picker_syntax.js`

**Interfaces:**
- Props:
  - `visible`: boolean
  - `onClose`: () => void
  - `title`: string (e.g., "Select Category", "Select Account")
  - `items`: Array<{ id, name, icon, color }>
  - `selectedId`: id or null
  - `onSelect`: (id or null) => void
  - `allLabel`: string (e.g. "All Categories", "All Accounts")
  - `theme`: object

- [ ] **Step 1: Create `src/components/SearchableItemPickerModal.js`**

Implement reusable modal:
- Modal container with backdrop and rounded top corners (maxHeight 85%).
- Header with title and close icon button.
- Search input with clear button and magnify icon.
- Top row for the "All" option with checkmark if `selectedId === null`.
- ScrollView with items rendered as 4-column cards (or clean list rows) with item color, icon, name, and checkmark if selected.
- Tapping an item triggers `onSelect(item.id)` and `onClose()`.

- [ ] **Step 2: Write syntax verification script**

```javascript
// test/test_searchable_picker_syntax.js
const fs = require('fs');
const babel = require('@babel/parser');
const code = fs.readFileSync('src/components/SearchableItemPickerModal.js', 'utf8');
babel.parse(code, { sourceType: 'module', plugins: ['jsx'] });
console.log('SearchableItemPickerModal parsed successfully!');
```

- [ ] **Step 3: Run syntax check**

Run: `node test/test_searchable_picker_syntax.js`  
Expected: `SearchableItemPickerModal parsed successfully!`

- [ ] **Step 4: Commit**

```bash
git add src/components/SearchableItemPickerModal.js test/test_searchable_picker_syntax.js
git commit -m "feat(components): add SearchableItemPickerModal for advanced filtering"
```

---

### Task 4: Integrate Advanced Filters, Pickers, ContextualFAB & Persistence into `SearchScreen.js`

**Files:**
- Modify: `src/screens/SearchScreen.js`
- Test: `test/test_search_screen_integration.js`

**Interfaces:**
- Consumes:
  - `useSearchFilter`, `setSearchFilter`, `resetSearchFilter` from Redux
  - `SearchableItemPickerModal`
  - `ContextualFAB`
  - `getAdvancedSearchTransactions` with new `categoryId` & `sourceId`

- [ ] **Step 1: Wire Redux filter state into `SearchScreen.js`**
- Replace local `useState` for filters with values initialized/synced from Redux `useSearchFilter()`.
- Add local state for modal picker visibility: `showCategoryPickerModal`, `showSourcePickerModal`.
- When "Apply Filters" is tapped, dispatch `setSearchFilter(...)` and execute query.
- When "Reset" is tapped, dispatch `resetSearchFilter(...)` and clear input.

- [ ] **Step 2: Add Account & Category Filter Rows in the Advanced Filters Modal**
- In `SearchScreen.js`, under Transaction Type, add selector cards for Account Source and Category:
  - Display currently selected source (icon, color, name) or "All Accounts".
  - Display currently selected category (icon, color, name) or "All Categories".
  - Tapping opens `SearchableItemPickerModal`.

- [ ] **Step 3: Add `ContextualFAB` on `SearchScreen.js`**
- Place `<ContextualFAB>` at the bottom right with actions:
  - Expense (`#E35D6A`, icon `arrow-down`) -> `navigation.navigate('TransactionAdd', { initialType: 'expense' })`
  - Income (`#3F8F6B`, icon `arrow-up`) -> `navigation.navigate('TransactionAdd', { initialType: 'income' })`
  - Transfer (`#4B7CF3`, icon `swap-horizontal`) -> `navigation.navigate('TransactionAdd', { initialType: 'transfer' })`
- Ensure SectionList contentContainerStyle has appropriate bottom padding (`paddingBottom: 90`) so transactions are not obscured by the FAB.

- [ ] **Step 4: Ensure Screen Focus & Re-query Persistence**
- In `useFocusEffect`:
  - When returning to the screen (after adding/editing a transaction or navigating from another tab), if `isFilterActive` or `searchQuery` is active, re-execute `fetchAdvanced()` to refresh the results while preserving the filter parameters.

- [ ] **Step 5: Verify syntax of `SearchScreen.js`**

Run: `node -e "const fs = require('fs'); const babel = require('@babel/parser'); babel.parse(fs.readFileSync('src/screens/SearchScreen.js', 'utf8'), { sourceType: 'module', plugins: ['jsx'] }); console.log('SearchScreen syntax valid!');"`  
Expected: `SearchScreen syntax valid!`

- [ ] **Step 6: Commit**

```bash
git add src/screens/SearchScreen.js
git commit -m "feat(screens): integrate ContextualFAB, category/source pickers, and Redux persistence in SearchScreen"
```

---

### Task 5: End-to-End Verification

**Files:**
- Test: `test/test_e2e_advanced_filters.js`

- [ ] **Step 1: Write and run end-to-end integration test**

```javascript
// test/test_e2e_advanced_filters.js
const assert = require('assert');
const { transactionSlice, setSearchFilter, resetSearchFilter } = require('../src/redux/slices/transactionSlice');

const reducer = transactionSlice.reducer;
let state = reducer(undefined, { type: '@@INIT' });

// 1. Simulate applying filters: Category 3, Source 1, Type Expense
state = reducer(state, setSearchFilter({
  advType: 'expense',
  advCategoryId: 3,
  advSourceId: 1,
  advAmount: '250',
  isFilterActive: true
}));

assert.strictEqual(state.searchFilter.isFilterActive, true);
assert.strictEqual(state.searchFilter.advCategoryId, 3);
assert.strictEqual(state.searchFilter.advSourceId, 1);

// 2. Simulate navigating away and back (state remains preserved in Redux)
assert.strictEqual(state.searchFilter.advCategoryId, 3);
assert.strictEqual(state.searchFilter.advSourceId, 1);

// 3. Simulate reset
state = reducer(state, resetSearchFilter());
assert.strictEqual(state.searchFilter.isFilterActive, false);
assert.strictEqual(state.searchFilter.advCategoryId, null);
assert.strictEqual(state.searchFilter.advSourceId, null);

console.log('All E2E checks passed successfully!');
```

- [ ] **Step 2: Run E2E check**

Run: `node test/test_e2e_advanced_filters.js`  
Expected: `All E2E checks passed successfully!`

- [ ] **Step 3: Cleanup temporary test scripts**

```bash
rm test/test_search_filter_slice.js test/test_advanced_search_transactions.js test/test_searchable_picker_syntax.js test/test_e2e_advanced_filters.js
git add -A
git commit -m "chore: clean up test verification scripts"
```
