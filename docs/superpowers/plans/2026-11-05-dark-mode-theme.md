# Global Dark Mode & Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a persistent, seamless global Dark Mode & Light Mode system across SpendoraX with a toggle in the drawer menu, removing redundant per-screen dark toggles (such as in `BillsScreen.js`), without changing any business logic or application behavior.

**Architecture:** 
1. Create `ThemeContext.js` with `useTheme()` hook providing `{ isDarkMode, toggleDarkMode, setDarkMode, theme }`, persisting state via `AsyncStorage` (`app_dark_mode`).
2. Export unified semantic color tokens from `src/components/Theme.js` matching SpendoraX's premium slate/obsidian palette (`#0B0F17` / `#182234` / `#334155` / `#F3F4F6` / `#9CA3AF`).
3. Add the Dark Mode toggle switch in `DrawerNavigator.js` footer alongside "Show Balance", dynamically theming the drawer and navigation headers.
4. Remove the localized `isDarkMode` state and sun/moon button from `BillsScreen.js`, connecting it directly to `useTheme()`.
5. Update core shared components (`Card.js`, `BottomStatsBar.js`, `TransactionListItem.js`, `BillCard.js`, `BillSummaryBar.js`, `ContextualFAB.js`, `Header.js`, etc.) and all screen views to read `useTheme()` for backgrounds, surfaces, text, and borders.

**Tech Stack:** React Native, Expo, React Navigation, React Native Paper, AsyncStorage, Redux.

---

## Global Constraints
- **UI-Only**: Zero changes to business logic, database queries, calculations, statement generators, or navigation routes.
- **Persistence**: Theme choice must persist across app restarts using `AsyncStorage`.
- **Clean Fallbacks**: When no saved preference exists, gracefully default to light mode (or system preference if available).
- **Code Integrity**: Retain all existing props, handlers, comments, and accessibility labels.

---

## Review Focus
1. **Drawer Menu Toggle**: Toggling Dark Mode in the drawer instantly updates all open screens, the drawer itself, and persists on next launch.
2. **BillsScreen Cleanup**: Local sun/moon header button is removed; bills screen, summaries, and child cards follow global theme.
3. **Contrast & Legibility**: In Dark Mode, all primary texts are `#F3F4F6`, secondary texts `#9CA3AF`, surfaces `#182234`, and backgrounds `#0B0F17` without unreadable dark-on-dark or light-on-light text.
4. **Form & Input Legibility**: All text inputs, selectors, and modals in forms remain clearly visible with themed background and contrasting text color.
5. **No Performance Degradation**: Using React Context with minimal re-render footprint.

---

## Tasks

### Task 1: Create ThemeContext & Centralized Theme Tokens
**Files:**
- Create: `src/context/ThemeContext.js`
- Modify: `src/components/Theme.js`
- Modify: `App.js`

- [ ] **Step 1: Create `src/context/ThemeContext.js`**
  - Implement `ThemeProvider` and `useTheme()`.
  - Provide `{ isDarkMode, toggleDarkMode, setDarkMode, theme }`.
  - Persist theme preference to `AsyncStorage` under key `app_dark_mode`.
  - Generate full semantic theme object: `bg`, `cardBg`, `cardBgSecondary`, `border`, `borderSubtle`, `textPrimary`, `textSecondary`, `textMuted`, `activeChipBg`, `inputBg`, `modalBg`, `headerBg`, `headerText`, `bottomBarBg`, `accent`, `primary`, etc.
- [ ] **Step 2: Update `src/components/Theme.js`**
  - Export `LightColors` and `DarkColors` alongside existing `Colors` and `Spacing` for backward compatibility.
- [ ] **Step 3: Wrap `App.js` with `ThemeProvider`**
  - Integrate `ThemeProvider` inside `App.js`.
  - Update `StatusBar` style and background color dynamically based on `isDarkMode`.
  - Update React Navigation Stack screen options header styling dynamically.
- [ ] **Step 4: Verify with Babel check**
  - Run babel syntax check on `ThemeContext.js`, `Theme.js`, and `App.js`.

---

### Task 2: Add Dark Mode Toggle to Drawer & Theme Drawer Navigator
**Files:**
- Modify: `navigation/DrawerNavigator.js`

- [ ] **Step 1: Connect `useTheme` in `DrawerNavigator.js`**
  - Consume `{ isDarkMode, toggleDarkMode, theme }` in `CustomDrawerContent` and `DrawerNavigator`.
- [ ] **Step 2: Add Dark Mode Toggle Switch in Drawer Footer**
  - Place a dedicated footer item right next to "Show Balance" with `theme-light-dark` / `weather-night` icon, label "Dark Mode", and a `<Switch value={isDarkMode} onValueChange={toggleDarkMode} />`.
- [ ] **Step 3: Theme Drawer Views and Headers**
  - Theme drawer container background, header section, divider, active/inactive items, footer buttons, and header bar (`headerStyle`, `headerTintColor`).
- [ ] **Step 4: Verify with Babel check**
  - Run babel syntax check on `navigation/DrawerNavigator.js`.

---

### Task 3: Theme Core Shared Components
**Files:**
- Modify: `src/components/Card.js`
- Modify: `src/components/BottomStatsBar.js`
- Modify: `src/components/TransactionListItem.js`
- Modify: `src/components/BillCard.js`
- Modify: `src/components/BillSummaryBar.js`
- Modify: `src/components/ExitConfirmationModal.js`
- Modify: `src/components/PageLoader.js`
- Modify: `src/components/LinkedBillCard.js`

- [ ] **Step 1: Theme `Card.js` and `BottomStatsBar.js`**
  - Connect to `useTheme()`; apply `theme.cardBg`, `theme.border`, and appropriate text/divider colors.
- [ ] **Step 2: Theme `TransactionListItem.js`**
  - Apply `theme.cardBg`, `theme.textPrimary`, `theme.textSecondary`, and high-contrast badges.
- [ ] **Step 3: Update `BillCard.js` & `BillSummaryBar.js`**
  - Default `isDarkMode` prop to `useTheme().isDarkMode` so all bills everywhere adapt automatically.
- [ ] **Step 4: Theme `ExitConfirmationModal.js` and `LinkedBillCard.js`**
  - Ensure modals, cards, badges, and unlink modal render seamlessly in dark & light modes.
- [ ] **Step 5: Verify with Babel check**
  - Run babel syntax check on modified components.

---

### Task 4: Connect BillsScreen & Bill Details to Global Theme
**Files:**
- Modify: `src/screens/BillsScreen.js`
- Modify: `src/screens/BillDetailScreen.js`
- Modify: `src/screens/BillOccurrenceEditScreen.js`

- [ ] **Step 1: Update `BillsScreen.js`**
  - Remove local `const [isDarkMode, setIsDarkMode] = useState(false)`.
  - Import and use `const { isDarkMode, theme } = useTheme()`.
  - Remove the sun/moon button from the header (keep the "+ Add Bill" and calendar month filter).
- [ ] **Step 2: Update `BillDetailScreen.js` & `BillOccurrenceEditScreen.js`**
  - Connect to `useTheme()`; update container background, cards, labels, and action sheets.
- [ ] **Step 3: Verify with Babel check**
  - Run babel syntax check on `BillsScreen.js`, `BillDetailScreen.js`, `BillOccurrenceEditScreen.js`.

---

### Task 5: Theme Dashboard & Transactions Screens
**Files:**
- Modify: `src/screens/HomeScreen.js`
- Modify: `src/screens/TransactionsScreen.js`
- Modify: `src/screens/TransactionAddScreen.js`
- Modify: `src/components/TransactionForm.js`
- Modify: `src/screens/SearchScreen.js`

- [ ] **Step 1: Theme `HomeScreen.js`**
  - Use `useTheme()`; update background (`#0B0F17` vs `#F5FAF7`), budget card texts, source balances cards, spend area charts container, and upcoming bills.
- [ ] **Step 2: Theme `TransactionsScreen.js`**
  - Update container background, search input, filter chips, date section headers, empty state.
- [ ] **Step 3: Theme `TransactionForm.js` & `TransactionAddScreen.js`**
  - Update form container, segmented type selector, inputs, more options bottom sheet, and date picker modal.
- [ ] **Step 4: Theme `SearchScreen.js`**
  - Update search container, filters, results list items, and highlights.
- [ ] **Step 5: Verify with Babel check**
  - Run babel syntax check on these screens.

---

### Task 6: Theme Credit Cards & Statements Screens
**Files:**
- Modify: `src/screens/CreditCardsScreen.js`
- Modify: `src/screens/CreditCardCreateScreen.js`
- Modify: `src/screens/CreditCardStatementsScreen.js`
- Modify: `src/screens/CreditCardStatementDetailScreen.js`
- Modify: `src/screens/CreditCardStatementEditScreen.js`

- [ ] **Step 1: Theme `CreditCardsScreen.js` & `CreditCardCreateScreen.js`**
  - Update card containers, statement dates, limit progress bars, and creation forms.
- [ ] **Step 2: Theme `CreditCardStatementsScreen.js`**
  - Update statement items, status chips, card selector header, cycle info text.
- [ ] **Step 3: Theme `CreditCardStatementDetailScreen.js` & `CreditCardStatementEditScreen.js`**
  - Update statement summary cards, transactions breakdown list, fees & interest rows, and edit preview cards.
- [ ] **Step 4: Verify with Babel check**
  - Run babel syntax check on credit cards suite.

---

### Task 7: Theme Accounts, Budgets, Categories & Reports Screens
**Files:**
- Modify: `src/screens/SourcesScreen.js`, `SourcesDashboard.js`, `SourcesDetails.js`, `SourceCreateScreen.js`
- Modify: `src/screens/BudgetsScreen.js`, `CategoryBudgetsDashboard.js`, `BudgetCreateScreen.js`
- Modify: `src/screens/CategoriesScreen.js`, `CategoriesDetails.js`, `CategoryCreateScreen.js`, `SpendAreasDashboard.js`
- Modify: `src/screens/ReportsScreen.js`, `BackupScreen.js`, `NotificationSettingsScreen.js`, `SecuritySettingsScreen.js`

- [ ] **Step 1: Theme Accounts suite (`Sources*`)**
  - Update accounts list, balance cards, detail views, and create form.
- [ ] **Step 2: Theme Budgets & Categories suite (`Budgets*`, `Categories*`)**
  - Update budget progress cards, category donut container, category list items, and creation forms.
- [ ] **Step 3: Theme Reports & Settings screens (`ReportsScreen`, `BackupScreen`, `*SettingsScreen`)**
  - Update chart containers, report cards, setting rows, and backup controls.
- [ ] **Step 4: Verify with Babel check**
  - Run babel syntax check on these screens.

---

### Task 8: Theme Loans Suite
**Files:**
- Modify: `src/screens/LoanDashboardScreen.js`, `LoanListScreen.js`, `LoanDetailsScreen.js`
- Modify: `src/components/LoanCard.js`, `src/components/ActiveLoanCard.js`, `src/components/LoanHealthCard.js`, `src/components/LoanQuickActions.js`, `src/components/LoanSummaryCard.js`, `src/components/UpcomingEMICard.js`
- Modify: `src/screens/LoanFormScreen.js`, `LoanPaymentScreen.js`, `LoanForeclosureScreen.js`, `LendMoreScreen.js`, `TopUpScreen.js`, `LoanHistoryScreen.js`, `LoanReportsScreen.js`

- [ ] **Step 1: Theme Loan components & dashboard**
  - Update loan cards, health cards, EMI cards, and metrics summaries.
- [ ] **Step 2: Theme Loan detail, payment, and form screens**
  - Update loan details timeline, payment records, and loan creation/edit forms.
- [ ] **Step 3: Verify with Babel check**
  - Run babel syntax check across loans suite.

---

### Task 9: System-Wide Verification & Testing
- [ ] **Step 1: Run full automated verification suite**
  - Run `verify_opening_balance_fix.js`, `verify_unlink_bill.js`, `verify_multi_tx_bill_link.js`, `verify_refund_fix.js`, `verify_is_counted.js` to confirm 100% zero logic regressions.
- [ ] **Step 2: Run Babel syntax check on all modified files**
  - Ensure every modified file passes syntax validation cleanly.
- [ ] **Step 3: Test ThemeContext persistence and toggle**
  - Verify `toggleDarkMode` transitions correctly and preserves state in `AsyncStorage`.

