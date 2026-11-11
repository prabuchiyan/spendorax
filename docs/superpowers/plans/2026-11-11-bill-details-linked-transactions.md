# Bill Details: Linked Transactions Unlink Confirmation Modal & Dynamic Edit Flow Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a confirmation modal before unlinking a transaction on the Bill Details screen and make the left side of the linked transaction item dynamic and clickable to edit the transaction directly.

**Architecture:** 
1. In `src/services/bills.js`, expand `getBillLinkedTransactions` to query `source_color` and `source_icon` so transaction accounts have rich dynamic visual representation.
2. In `src/screens/BillDetailScreen.js`, update `LinkedTransactionsCard` to dynamically render category/source icon & color avatars, display the source account tag, and make the left transaction area a touchable trigger that navigates directly to `TransactionAdd` with `{ isEdit: true, transaction: tx }`.
3. In `src/screens/BillDetailScreen.js`, replace immediate unlinking with an unlinking state (`unlinkingTx`) and render a themed confirmation modal matching the Spendorax design language (`LinkedBillCard` / `SkipBillModal` style) with danger badge, transaction preview card, amber warning notice, and cancel/confirm buttons.

**Tech Stack:** React Native, Expo, React Navigation, React Native Paper, SQLite (`expo-sqlite`).

**Spec:** [`docs/superpowers/specs/2026-11-11-bill-details-linked-transactions-design.md`](file:///c:/Users/Prabu.S/Prabuchiyan/spendorax/docs/superpowers/specs/2026-11-11-bill-details-linked-transactions-design.md)

## Global Constraints
- Preserve all existing bill calculation logic, occurrence series management, payment flows, and soft-delete functions.
- Follow Spendorax's theme system (`useTheme()`, `theme.cardBg`, `theme.border`, `theme.textPrimary`, `theme.textSecondary`, `isDarkMode`) for light and dark mode compatibility.
- Ensure all touchable areas have accessibility roles and labels.
- Verify code syntax using node/babel compile checks after every task.

## Review Focus
1. **Unlink cancellation / dismissal:** Dismissing or canceling the modal must clear `unlinkingTx` without modifying any state or database records.
2. **Asynchronous unlinking lifecycle:** Confirm button must show `ActivityIndicator`, disable interactions while in-flight, and safely reload bill occurrences and summary upon completion.
3. **Transaction without source or category:** If a transaction has null `source_id`, `category_id`, or `notes`, the card must render graceful fallbacks without crashing.
4. **Direct edit navigation & back-sync:** Tapping the left side must navigate to `TransactionAdd` with `{ isEdit: true, transaction: tx }`; navigating back must trigger `useFocusEffect` to refresh linked transactions.
5. **Dark mode contrast:** Text in the confirmation modal, warning box, and transaction cards must remain readable and high-contrast in both dark and light modes.

---

### Task 1: Update `getBillLinkedTransactions` Query in `src/services/bills.js`

**Files:**
- Modify: `src/services/bills.js:134-184`

**Interfaces:**
- Consumes: `bill_linked_transactions`, `transactions`, `sources`, `categories` tables
- Produces: `getBillLinkedTransactions(billId)` returning array of transactions with `source_color`, `source_icon`, `source_name`, `category_color`, `category_icon`, `category_name`

- [ ] **Step 1: Update SQLite query in `getBillLinkedTransactions`**
  Add `s.color as source_color, s.icon as source_icon` to the `SELECT` clause in `src/services/bills.js`.

- [ ] **Step 2: Update Web / Local fallback in `getBillLinkedTransactions`**
  Add `source_color: sources.find((s) => s.id == tx.source_id)?.color` and `source_icon: sources.find((s) => s.id == tx.source_id)?.icon` to the mapped transaction object.

- [ ] **Step 3: Run node syntax verification on `src/services/bills.js`**
  Verify the modified file contains valid JS syntax without syntax errors.

---

### Task 2: Update `LinkedTransactionsCard` in `src/screens/BillDetailScreen.js` for Dynamic Left Side & Edit Navigation

**Files:**
- Modify: `src/screens/BillDetailScreen.js:108-208`
- Modify: `src/screens/BillDetailScreen.js:1980-2020` (styles)

**Interfaces:**
- Consumes: `linkedTxs`, `onAddMore`, `onUnlink`, `onEdit` props
- Produces: Dynamic interactive transaction card item with icon/avatar, source tag, formatted amount, and edit trigger

- [ ] **Step 1: Update `LinkedTransactionsCard` component signature and props**
  Add `onEdit` to props: `function LinkedTransactionsCard({ linkedTxs, onAddMore, onUnlink, onEdit })`.

- [ ] **Step 2: Implement dynamic avatar and metadata in `LinkedTransactionsCard`**
  - Replace static `bankChip` (`#97144d` maroon) with dynamic avatar wrap using `tx.category_icon || tx.source_icon || "cash"` and corresponding color tints (`${tx.category_color || tx.source_color || '#006a61'}18` bg, colored icon).
  - Include source name tag (`tx.source_name`) in `txMetaRow` alongside date and TXN ID.
  - Wrap the left avatar and details in a `TouchableOpacity` with `activeOpacity={0.7}` calling `onEdit?.(tx)` with appropriate accessibility label.

- [ ] **Step 3: Update `styles` in `src/screens/BillDetailScreen.js`**
  Adjust avatar chip and metadata styles for dark mode compatibility and flexible row layout.

- [ ] **Step 4: Run syntax check on `src/screens/BillDetailScreen.js`**
  Verify valid syntax.

---

### Task 3: Implement Unlink Confirmation Modal and Connect Edit Navigation in `BillDetailScreen`

**Files:**
- Modify: `src/screens/BillDetailScreen.js:425-450` (state)
- Modify: `src/screens/BillDetailScreen.js:763-775` (unlink handlers)
- Modify: `src/screens/BillDetailScreen.js:1100-1110` (card props)
- Modify: `src/screens/BillDetailScreen.js:1270-1320` (modal JSX)
- Modify: `src/screens/BillDetailScreen.js:2020-2100` (modal styles)

**Interfaces:**
- Consumes: `removeTransactionFromBill`, `useTheme`, `navigation.navigate('TransactionAdd')`
- Produces:
  - `unlinkingTx` state & `handleConfirmUnlink`
  - `handleEditTransaction` handler passed to `LinkedTransactionsCard`
  - Unlink Confirmation Modal with danger badge, transaction preview, warning box, and actions

- [ ] **Step 1: Add modal state and handlers in `BillDetailScreen`**
  - Add `const [unlinkingTx, setUnlinkingTx] = useState(null);`
  - Add `const [unlinking, setUnlinking] = useState(false);`
  - Add `handleConfirmUnlink`: executes `removeTransactionFromBill`, clears `unlinkingTx`, refreshes occurrence and bill, and displays toast notice.
  - Add `handleEditTransaction`: calls `navigation.navigate("TransactionAdd", { isEdit: true, transaction: tx })`.

- [ ] **Step 2: Connect `onUnlink` and `onEdit` in `LinkedTransactionsCard` JSX**
  - Pass `onUnlink={(tx) => setUnlinkingTx(tx)}`.
  - Pass `onEdit={handleEditTransaction}`.

- [ ] **Step 3: Render the Unlink Confirmation Modal in `BillDetailScreen`**
  Render `<Modal visible={Boolean(unlinkingTx)} transparent animationType="fade" ...>`:
  - Overlay backdrop closing on press when not in-flight.
  - Centered card with `backgroundColor: theme.cardBg`, themed border.
  - Red danger badge circle with `link-variant-off` icon (`#EF4444`).
  - Title: "Unlink Transaction?" and subtitle: "Are you sure you want to remove this linked transaction from the bill?".
  - Preview card displaying transaction notes, formatted amount, date, and source account name.
  - Amber warning box (`alert-circle-outline` icon): "Unlinking will recalculate the bill's paid amount. If total paid drops below the due amount, the bill will return to unpaid/pending status."
  - Buttons: Cancel (`setUnlinkingTx(null)`) and Unlink (calls `handleConfirmUnlink`, shows `ActivityIndicator` when loading).

- [ ] **Step 4: Add modal styles to `BillDetailScreen.js`**
  Add styles for `unlinkModalCard`, `unlinkIconCircle`, `unlinkModalTitle`, `unlinkModalSubtitle`, `unlinkPreviewCard`, `unlinkWarningBox`, `unlinkWarningText`, `unlinkActionRow`, `unlinkCancelBtn`, and `unlinkConfirmBtn`.

- [ ] **Step 5: Run comprehensive syntax and AST validation**
  Run syntax check across modified files to ensure zero compilation or syntax errors.

---

### Task 4: End-to-End Verification and Testing

**Files:**
- Test verification script in `brain/1e700586-0d43-450d-a501-bfe2e9e45ddb/scratch/verify-unlink-modal.js`

- [ ] **Step 1: Write an automated verification script**
  Verify that:
  - `getBillLinkedTransactions` SQL query contains `source_color` and `source_icon`.
  - `LinkedTransactionsCard` has `onEdit` prop and dynamic avatar / source tag.
  - `BillDetailScreen` renders the unlink modal with warning message, transaction preview, and cancel/confirm buttons.
  - Direct navigation to `TransactionAdd` with `{ isEdit: true, transaction: tx }` is correctly wired.

- [ ] **Step 2: Run verification script**
  Run: `node <scratch_path>/verify-unlink-modal.js`
  Expected: PASS on all assertions.

