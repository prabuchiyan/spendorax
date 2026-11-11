# Dark Mode Contrast & Visibility Enhancement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure all text, cards, modals, and list items have crisp, high-contrast visibility in Dark Mode while guaranteeing 100% preservation of Light Mode appearance with zero logic changes.

**Architecture:** 
1. Expand `ThemeContext.js` with universal property aliases (`text`, `subText`, `title`, `subtitle`, `card`, `background`, `mutedText`) so any theme token access resolves safely in both modes.
2. In each screen and component, dynamically bind `{ backgroundColor: theme.cardBg, borderColor: theme.border }` to surface cards/modals, `{ color: theme.textPrimary }` to titles/primary text, and `{ color: theme.textSecondary }` to labels/subtitles, while keeping `StyleSheet.create` statically valid for module load safety.
3. Light Mode maps to the exact original colors (`#FFFFFF` surface, `#0B1C30` primary text, `#64748B` secondary text, `#E2E8F0` border), ensuring zero visual regression in Light Mode.

**Tech Stack:** React Native, Expo, React Context, React Native Paper.

## Global Constraints
- Strictly UI styling updates — NO changes to calculations, SQLite database queries, statement generators, or navigation routes.
- Preserve all existing props, handlers, accessibility labels, and comments.
- Dynamic styles must be applied in component JSX arrays (e.g. `style={[styles.title, { color: theme.textPrimary }]}`); `StyleSheet.create` must never reference `theme` at module scope.
- All file links must use `file:///` format with forward slashes.

---

### Task 1: Expand Theme Tokens in ThemeContext.js

**Files:**
- Modify: `src/context/ThemeContext.js:6-120`

**Interfaces:**
- Consumes: `lightTheme`, `darkTheme`
- Produces: Enhanced theme tokens with aliases (`text`, `subText`, `title`, `subtitle`, `card`, `background`, `mutedText`, `chipBg`, `chipText`)

- [ ] **Step 1: Add aliases to `lightTheme` and `darkTheme`**
  Add universal aliases to `lightTheme` (light values) and `darkTheme` (dark values) so any component using `theme.text`, `theme.subText`, `theme.card`, etc. always gets high-contrast values.

- [ ] **Step 2: Run verification script to confirm tokens exist**
  Verify all token properties return valid hex strings in both themes.

---

### Task 2: Fix Credit Card Screens (`CreditCardsScreen.js`, `CreditCardStatementsScreen.js`, `CreditCardStatementDetailScreen.js`, `CreditCardStatementEditScreen.js`)

**Files:**
- Modify: `src/screens/CreditCardsScreen.js`
- Modify: `src/screens/CreditCardStatementsScreen.js`
- Modify: `src/screens/CreditCardStatementDetailScreen.js`
- Modify: `src/screens/CreditCardStatementEditScreen.js`

**Issues Addressed:**
- `CreditCardsScreen.js`: `overviewCard`, `mainBalanceValue`, `statValue`, `sectionTitle`, `creditCardBoard` have hardcoded dark text (`#111827`, `#0F172A`) or white backgrounds that are invisible/blinding in dark mode.
- `CreditCardStatementsScreen.js`: `heroCard`, `cardName`, `detailValue`, `regenerateModal`, `regenerateTitle`, `regenerateMessage`, `cancelRegenerateText` have hardcoded `#FFFFFF` background or `#111827` text.
- `CreditCardStatementDetailScreen.js`: `headerCard`, `bankName`, `dateValue`, `summaryValue`, `totalValue` have hardcoded dark text on dark surfaces.
- `CreditCardStatementEditScreen.js`: Modal & preview card background and input text contrast.

- [ ] **Step 1: Update `CreditCardsScreen.js` with themed card backgrounds and high-contrast text**
- [ ] **Step 2: Update `CreditCardStatementsScreen.js` with themed hero card, statement list items, and modal text**
- [ ] **Step 3: Update `CreditCardStatementDetailScreen.js` with themed summary cards, detail values, and edit dialog**
- [ ] **Step 4: Update `CreditCardStatementEditScreen.js` with themed input fields and calculation preview**
- [ ] **Step 5: Run AST and Babel check on modified credit card screens**

---

### Task 3: Fix Bills Screens & Components (`LinkedBillCard.js`, `BillDetailScreen.js`, `BillForm.js`, `BillsScreen.js`, `BillCard.js`, `BillSummaryBar.js`)

**Files:**
- Modify: `src/components/LinkedBillCard.js`
- Modify: `src/screens/BillDetailScreen.js`
- Modify: `src/components/BillForm.js`
- Modify: `src/screens/BillsScreen.js`
- Modify: `src/components/BillCard.js`
- Modify: `src/components/BillSummaryBar.js`

**Issues Addressed:**
- `LinkedBillCard.js`: `emptyContainer` and `billRow` use hardcoded `backgroundColor: '#fff'`, `candidateName` uses `color: '#0f172a'` (invisible in dark mode), search box, and transfer leg picker chips.
- `BillDetailScreen.js`: `sectionTitle`, `txTitle`, `txAmountText`, `emptyLinkedTitle`, `modalHeaderTitle`, `candidateNotes`, candidate cards have hardcoded dark text.
- `BillForm.js`: Form input cards, labels, and recurrence selectors.
- `BillsScreen.js`: Filter tabs, empty state text, summary container.
- `BillCard.js` & `BillSummaryBar.js`: Status badges and high contrast text on dark cards.

- [ ] **Step 1: Update `LinkedBillCard.js` with themed empty container, bill rows, candidate list, and search box**
- [ ] **Step 2: Update `BillDetailScreen.js` with themed linked transaction cards, candidate picker modal, and notes**
- [ ] **Step 3: Update `BillForm.js` with themed input cards and high contrast text**
- [ ] **Step 4: Update `BillsScreen.js`, `BillCard.js`, and `BillSummaryBar.js` for crisp dark mode contrast**
- [ ] **Step 5: Run AST and Babel check on modified bill files**

---

### Task 4: Fix Accounts & Sources Screens (`SourcesDashboard.js`, `SourcesDetails.js`, `SourcesScreen.js`)

**Files:**
- Modify: `src/screens/SourcesDashboard.js`
- Modify: `src/screens/SourcesDetails.js`
- Modify: `src/screens/SourcesScreen.js`

**Issues Addressed:**
- `SourcesDashboard.js`: `balanceCard`, `sectionTitle`, `emptyTitle`, `activeTab` text, source card list items.
- `SourcesDetails.js`: `hero`, `heroLabel`, `heroAmount`, `headerTitle`, `emptyTitle`.
- `SourcesScreen.js`: Account list items, balance text.

- [ ] **Step 1: Update `SourcesDashboard.js` with themed balance card, tab switcher, and section titles**
- [ ] **Step 2: Update `SourcesDetails.js` with themed hero card, amount text, and transaction list**
- [ ] **Step 3: Update `SourcesScreen.js` with themed source rows and balances**
- [ ] **Step 4: Run AST and Babel check on accounts screens**

---

### Task 5: Fix Loans Suite Screens & Cards

**Files:**
- Modify: `src/screens/LoanDashboardScreen.js`
- Modify: `src/screens/LoanDetailsScreen.js`
- Modify: `src/screens/LoanPaymentScreen.js`
- Modify: `src/screens/LoanForeclosureScreen.js`
- Modify: `src/screens/LoanFormScreen.js`
- Modify: `src/screens/LoanHistoryScreen.js`
- Modify: `src/screens/TopUpScreen.js`
- Modify: `src/screens/LendMoreScreen.js`
- Modify: `src/screens/LoanListScreen.js`
- Modify: `src/components/ActiveLoanCard.js`
- Modify: `src/components/UpcomingEMICard.js`
- Modify: `src/components/LoanHealthCard.js`
- Modify: `src/components/RecentActivityItem.js`

**Issues Addressed:**
- Form inputs, modal sheets, note boxes, and detail values in `LoanPaymentScreen.js`, `LoanForeclosureScreen.js`, `LoanFormScreen.js`, `TopUpScreen.js`, `LendMoreScreen.js`.
- Card text contrast in `LoanDashboardScreen.js`, `LoanCard.js`, `ActiveLoanCard.js`, `LoanDetailsScreen.js`.

- [ ] **Step 1: Update `LoanDashboardScreen.js`, `ActiveLoanCard.js`, `UpcomingEMICard.js`, `LoanHealthCard.js`, `RecentActivityItem.js`**
- [ ] **Step 2: Update `LoanDetailsScreen.js` and `LoanHistoryScreen.js`**
- [ ] **Step 3: Update `LoanPaymentScreen.js`, `LoanForeclosureScreen.js`, `TopUpScreen.js`, `LendMoreScreen.js`**
- [ ] **Step 4: Update `LoanFormScreen.js` and `LoanListScreen.js`**
- [ ] **Step 5: Run AST and Babel check on loans suite**

---

### Task 6: Fix Home, Transactions, Budgets, Categories & Settings

**Files:**
- Modify: `src/screens/HomeScreen.js`
- Modify: `src/screens/TransactionsScreen.js`
- Modify: `src/components/TransactionListItem.js`
- Modify: `src/components/TransactionForm.js`
- Modify: `src/screens/ReportsScreen.js`
- Modify: `src/screens/CategoriesDetails.js`
- Modify: `src/screens/SpendAreasDashboard.js`
- Modify: `src/screens/NotificationSettingsScreen.js`
- Modify: `src/components/MuiDateTimePicker.js`
- Modify: `src/components/BottomStatsBar.js`

**Issues Addressed:**
- `HomeScreen.js`: Upcoming bills list, account balances, budget widgets text contrast.
- `TransactionsScreen.js` & `TransactionListItem.js`: Note text, account tags, date group headers.
- `TransactionForm.js`: More options bottom sheet, labels, category chips.
- `ReportsScreen.js`, `CategoriesDetails.js`, `SpendAreasDashboard.js`: Breakdown category rows, chart titles.
- `NotificationSettingsScreen.js`: Time row, labels.
- `MuiDateTimePicker.js`: Calendar picker modal, month/year selector text.

- [ ] **Step 1: Update `HomeScreen.js`, `TransactionsScreen.js`, `TransactionListItem.js`, `TransactionForm.js`**
- [ ] **Step 2: Update `ReportsScreen.js`, `CategoriesDetails.js`, `SpendAreasDashboard.js`**
- [ ] **Step 3: Update `NotificationSettingsScreen.js`, `MuiDateTimePicker.js`, `BottomStatsBar.js`**
- [ ] **Step 4: Run AST and Babel check on these screens**

---

### Task 7: Full Verification & Regression Testing

- [ ] **Step 1: Run comprehensive AST scanner verifying 0 unbound variables, 0 parse errors**
- [ ] **Step 2: Run Babel React compilation check across all modified files**
- [ ] **Step 3: Run full suite of automated regression tests:**
  - `verify_opening_balance_fix.js`
  - `verify_unlink_bill.js`
  - `verify_multi_tx_bill_link.js`
  - `verify_refund_fix.js`
  - `verify_is_counted.js`
  - `test_statement_redirection.js`

