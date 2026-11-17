# Design Document: Advanced Filters Improvements

**Date**: 2026-11-17  
**Status**: Pending Approval  
**Topic**: Advanced Filters (New Transactions FAB, Account/Category Pickers, State Persistence)

---

## 1. Intent & Context
SpendoraX provides a dedicated Search and Advanced Filter screen (`SearchScreen.js`) to find transactions. Currently:
1. Users cannot create new transactions directly from this screen.
2. The Advanced Filters modal lacks filtering by Category or Account (Source).
3. Moving to another screen (such as opening `TransactionAdd` or navigating away) resets the filter state because it is held purely in local component `useState`.

This feature adds a `ContextualFAB` for creating Expense/Income/Transfer transactions, adds single-select Category and Account filters with searchable bottom sheets matching SpendoraX's common design, and persists the filter selections in Redux so that navigation between screens retains the active filters until explicitly reset.

---

## 2. Goals & Non-Goals

### Goals
- **ContextualFAB**: Floating action button on `SearchScreen` with actions for Expense, Income, and Transfer, navigating to `TransactionAdd`.
- **Category Filter**: In the Advanced Filters modal, a selectable row opening a searchable picker (with search input, icon + color chip, checkmark, and an "All Categories" option).
- **Account Source Filter**: In the Advanced Filters modal, a selectable row opening a searchable picker (with search input, icon + color chip, checkmark, and an "All Accounts" option).
- **Service Integration**: Update `getAdvancedSearchTransactions` in `src/services/transactions.js` (both SQLite and Web fallback) to filter by `categoryId` and `sourceId` (including checking debit/credit sides for transfer transactions).
- **Session Persistence**: Keep filter parameters and query state in Redux (`transactionSlice` or dedicated slice) so screen switching or navigating to add/edit transactions retains active filters and results without resetting.
- **Explicit Reset**: Reset button in the modal or clear button in the search bar clears the Redux filter state back to defaults.

### Non-Goals
- Multi-select categories or accounts (confirmed single-select with "All").
- Cold-boot disk persistence across app termination (in-session persistence via Redux fulfills the requirement without stale filters across days).

---

## 3. Approaches Considered & Selected

- **Approach A (Selected)**: Redux-backed filter state with live synchronization. Immediate screen-to-screen persistence, zero flicker, aligns with the app's Redux architecture, and resets cleanly on user demand.
- **Approach B (Discarded)**: AsyncStorage cold persistence. Would keep old filters indefinitely across days even after app restart, which can confuse users returning days later.

---

## 4. Detailed Component & Implementation Design

### A. Redux State (`src/redux/slices/transactionSlice.js` or `searchFilterSlice.js`)
Add state and actions for advanced filters:
```javascript
searchFilter: {
  searchQuery: '',
  advAmount: '',
  advNote: '',
  advType: 'all',          // 'all' | 'expense' | 'income' | 'transfer'
  advDateType: 'none',     // 'none' | 'exact' | 'month' | 'year' | 'duration'
  advExactDate: '',
  advMonth: '',
  advYear: '',
  advStartDate: '',
  advEndDate: '',
  advCategoryId: null,     // null means 'All'
  advSourceId: null,       // null means 'All'
  groupByOption: 'day',    // 'day' | 'month' | 'year'
  isFilterActive: false
}
```
Actions:
- `setSearchFilter(params)`: Updates filter criteria and marks `isFilterActive`.
- `resetSearchFilter()`: Restores defaults and clears results.
- `setSearchQueryText(query)`: Updates query string.

### B. Query Integration (`src/services/transactions.js`)
Update `getAdvancedSearchTransactions`:
- Parameter: `{ amount, note, type, exactDate, month, year, startDate, endDate, categoryId, sourceId }`.
- **SQLite**:
  - If `categoryId`: `conditions.push("category_id = ?"); queryParams.push(categoryId);`
  - If `sourceId`:
    - For regular transactions: `source_id = ?`
    - For transfers: match either `source_id = ?` or `transfer_group_id IN (SELECT transfer_group_id FROM transactions WHERE source_id = ?)` so that transfer operations involving the selected account are captured accurately.
- **Web**: Similar filtering logic applied to memory rows.

### C. Advanced Filters Modal UI (`src/screens/SearchScreen.js`)
- Add Account Source selector button/card showing the selected source icon, color, and name (or "All Accounts").
- Add Category selector button/card showing the selected category icon, color, and name (or "All Categories").
- When tapped, each opens a common searchable bottom sheet modal:
  - Search `TextInput` with search icon.
  - "All" default chip at the top.
  - Grid/list of items with their colored icon container, title, and checkmark if currently selected.
  - Tapping an item selects it, closes the sheet, and marks the selection.

### D. ContextualFAB on `SearchScreen.js`
- Import and render `ContextualFAB` at bottom right.
- Actions:
  - Expense (`#E35D6A`, icon `arrow-down`) -> `navigation.navigate('TransactionAdd', { initialType: 'expense' })`
  - Income (`#3F8F6B`, icon `arrow-up`) -> `navigation.navigate('TransactionAdd', { initialType: 'income' })`
  - Transfer (`#4B7CF3`, icon `swap-horizontal`) -> `navigation.navigate('TransactionAdd', { initialType: 'transfer' })`
- Position safely above bottom padding with clean list insets.

### E. Screen Focus & Persistence
- On `useFocusEffect` in `SearchScreen`:
  - Read persisted filter from Redux.
  - If `isFilterActive` or `searchQuery` is present, automatically re-fetch the latest transactions to incorporate any newly added or edited transactions while preserving the active filter.
- On "Reset": Clears Redux filter state, clears input, and restores initial search view.

---

## 5. Verification Plan
1. **ContextualFAB**: Verify tapping +, selecting Expense/Income/Transfer opens `TransactionAdd`, and returning to `SearchScreen` retains view and updates list.
2. **Account & Category Filtering**: Filter by specific Category, specific Account, and combined; verify SQLite queries and returned transactions.
3. **Common Modal Design**: Verify search filter inside the category and account modals filters the list seamlessly.
4. **Persistence**: Set filters, navigate away to Dashboard or other screens, return to Search; confirm all filter selections and results remain intact.
5. **Reset**: Tap Reset in Advanced Filters; verify all filters clear back to default.
