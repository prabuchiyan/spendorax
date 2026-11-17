# Common Bottom-Sheet Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable, modern bottom-sheet modal component (`CommonBottomSheetModal.js`) with contextual warnings and action loaders, migrate all screens from legacy dialogs/inline modals to this component, and remove the obsolete `ConfirmDialog.js`.

**Architecture:** Create `src/components/CommonBottomSheetModal.js` featuring slide-up animation, grab handle, dark/light theme integration via `useTheme`, icon badge, preview card, and a structured warning notice card with icon bullets. Wire this common component across all 11+ screens with action-specific warnings, action loaders on submit buttons, and disabled states during execution, then safely delete `ConfirmDialog.js`.

**Tech Stack:** React Native, Expo SDK 51, `@expo/vector-icons` (`MaterialCommunityIcons`), `useTheme` (`ThemeContext`), Babel AST compilation.

**Spec:** `docs/superpowers/specs/2026-11-16-common-bottom-sheet-modal-design.md`

## Global Constraints
- **Platform Compatibility:** Must render smoothly on Android and iOS without layout shifts.
- **Theme Integration:** Strictly use `useTheme` from `../context/ThemeContext` (or `./ThemeContext`) for card backgrounds, text colors, and borders.
- **Button Action Safety:** While `loading` is true, both Cancel and Confirm buttons must be disabled (`disabled={loading}`), backdrop tap dismiss must be blocked, and the Confirm button must show an `ActivityIndicator` (spinner) while hiding its text label.
- **Zero Logic Regressions:** Preserve existing business logic, states, parameters, and async handlers across all screens.
- **Clean Codebase:** Eliminate `src/components/ConfirmDialog.js` completely.

## Review Focus
1. `loading` state active: verify backdrop press does not call `onCancel` or dismiss the modal.
2. `warnings` prop variations: verify the component gracefully renders both string arrays (`['Warning 1', 'Warning 2']`) and object arrays (`[{ title: '...', text: '...' }]`) or single `message` fallback.
3. Dark mode contrast: verify warning box backgrounds, badge circles, and text colors maintain accessible contrast in both light and dark modes.
4. Button double-tap prevention: verify submit button prevents multiple invocations while `loading=true`.
5. Unused imports: verify no lingering `import ConfirmDialog` references remain anywhere in the project.

---

### Task 1: Create `CommonBottomSheetModal.js` Core Component

**Files:**
- Create: `src/components/CommonBottomSheetModal.js`
- Test: `scratch/test-common-bottom-sheet-modal.js`

**Interfaces:**
- Produces:
  ```typescript
  export default function CommonBottomSheetModal(props: {
    visible: boolean;
    onCancel: () => void;
    onConfirm: () => void | Promise<void>;
    loading?: boolean;
    type?: 'danger' | 'warning' | 'info' | 'success';
    icon?: string;
    title: string;
    subtitle?: string;
    message?: string;
    warnings?: Array<{ title?: string; text: string; icon?: string; color?: string } | string>;
    warningTitle?: string;
    itemPreview?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmIcon?: string;
  }): JSX.Element | null
  ```

- [ ] **Step 1: Write the failing test for `CommonBottomSheetModal`**

Create `scratch/test-common-bottom-sheet-modal.js` verifying component structure, prop handling, Babel AST compilation, and exported interface.

```javascript
const assert = require('assert');
const fs = require('fs');
const babel = require('@babel/core');

console.log('Testing Task 1: CommonBottomSheetModal...');
const modalPath = 'src/components/CommonBottomSheetModal.js';
assert(fs.existsSync(modalPath), 'CommonBottomSheetModal.js must exist');
babel.transformFileSync(modalPath, { presets: ['babel-preset-expo'] });

const code = fs.readFileSync(modalPath, 'utf8');
assert(code.includes('export default function CommonBottomSheetModal'), 'Exports CommonBottomSheetModal');
assert(code.includes('ActivityIndicator'), 'Includes ActivityIndicator loader');
assert(code.includes('sheetHandle'), 'Includes sheetHandle for bottom sheet design');
assert(code.includes('disabled={loading}'), 'Disables buttons when loading');
console.log('✓ Task 1 test passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scratch/test-common-bottom-sheet-modal.js`
Expected: FAIL with "CommonBottomSheetModal.js must exist"

- [ ] **Step 3: Implement `CommonBottomSheetModal.js`**

Implement `src/components/CommonBottomSheetModal.js` adhering to:
- Slide-up bottom sheet with top drag handle (`borderTopLeftRadius: 28`, `borderTopRightRadius: 28`).
- Semi-transparent backdrop with touch-to-dismiss (blocked if `loading=true`).
- Theme colors from `useTheme()` (`isDarkMode`, `theme.modalBg`, `theme.cardBg`, `theme.border`, `theme.textPrimary`, `theme.textSecondary`).
- Header icon wrap with color and background tailored to `type` (`danger`: `#DC2626`, `warning`: `#D97706`, `info`: `#2563EB`, `success`: `#059669`).
- Title and subtitle typography.
- Optional `itemPreview` node.
- Contextual Warning Notice Box ("Related Warnings"):
  - Header with icon and `warningTitle` (defaulting to e.g. "Permanent Action Warning" for danger, "Important Notice" for warning, "Action Information" for info).
  - Normalization of `warnings` strings or structured objects into bullet rows with icon bullets and bold labels.
- Action Buttons Row:
  - Cancel button: disabled when `loading=true`.
  - Confirm button: styled by type, disabled when `loading=true`, showing `ActivityIndicator` (white) when loading, hiding text.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scratch/test-common-bottom-sheet-modal.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/CommonBottomSheetModal.js scratch/test-common-bottom-sheet-modal.js
git commit -m "feat: create CommonBottomSheetModal component with warnings and action loader"
```

---

### Task 2: Migrate Budget & Category Screens

**Files:**
- Modify: `src/screens/BudgetsScreen.js`
- Modify: `src/screens/CategoriesScreen.js`
- Modify: `src/screens/CategoriesDetails.js`
- Test: `scratch/test-common-bottom-sheet-modal.js`

**Interfaces:**
- Consumes: `CommonBottomSheetModal` from `src/components/CommonBottomSheetModal.js`

- [ ] **Step 1: Add verification assertions for Budget & Category screens to test script**

Add checks to `scratch/test-common-bottom-sheet-modal.js` asserting that `BudgetsScreen.js`, `CategoriesScreen.js`, and `CategoriesDetails.js`:
1. Import `CommonBottomSheetModal` and do NOT import `ConfirmDialog`.
2. Render `<CommonBottomSheetModal`.
3. Pass `warnings` array and `loading` state.

- [ ] **Step 2: Run test to verify failure**

Run: `node scratch/test-common-bottom-sheet-modal.js`
Expected: FAIL (files still import ConfirmDialog)

- [ ] **Step 3: Update `BudgetsScreen.js`**

1. Replace `import ConfirmDialog from '../components/ConfirmDialog';` with `import CommonBottomSheetModal from '../components/CommonBottomSheetModal';`.
2. Add `isDeletingBudget` state to manage loader on submit button.
3. Replace `<ConfirmDialog ... />` with:
   ```jsx
   <CommonBottomSheetModal
     visible={confirmVisible}
     type="danger"
     title="Delete Budget?"
     subtitle="Are you sure you want to delete this monthly budget?"
     confirmLabel="Delete Budget"
     cancelLabel="Keep Budget"
     loading={isDeletingBudget}
     warnings={[
       { title: 'Budget Removed', text: 'Category spending limit will be removed for this month.' },
       { title: 'Expenses Safe', text: 'All recorded transactions and expenses remain intact.' },
       { title: 'Cannot Be Undone', text: 'This action cannot be reversed.' },
     ]}
     onCancel={() => {
       if (isDeletingBudget) return;
       setConfirmVisible(false);
       setDeletingBudgetId(null);
     }}
     onConfirm={async () => {
       try {
         setIsDeletingBudget(true);
         await confirmDeleteCategoryBudget();
       } finally {
         setIsDeletingBudget(false);
       }
     }}
   />
   ```

- [ ] **Step 4: Update `CategoriesScreen.js`**

1. Replace `import ConfirmDialog from '../components/ConfirmDialog';` with `import CommonBottomSheetModal from '../components/CommonBottomSheetModal';`.
2. Add `isDeletingCategory` state to track delete execution.
3. Replace `<ConfirmDialog ... />` with `CommonBottomSheetModal`:
   - `type="danger"`, `title="Delete Category?"`, `confirmLabel="Delete Category"`, `cancelLabel="Keep Category"`.
   - `warnings`:
     - `{ title: 'Category Removed', text: 'Category will be permanently removed from your list.' }`
     - `{ title: 'Transactions Preserved', text: 'Associated transactions will retain their historical records.' }`
     - `{ title: 'Cannot Be Undone', text: 'Once deleted, this category cannot be recovered.' }`
   - `loading={isDeletingCategory}`.

- [ ] **Step 5: Update `CategoriesDetails.js`**

1. Replace `import ConfirmDialog from '../components/ConfirmDialog';` with `import CommonBottomSheetModal from '../components/CommonBottomSheetModal';`.
2. Replace `<ConfirmDialog ... />` with `CommonBottomSheetModal`:
   - `type="danger"`, `title="Delete Transaction?"`, `confirmLabel="Delete Transaction"`, `cancelLabel="Keep Transaction"`.
   - `loading={loading}`.
   - `warnings`:
     - `{ title: 'Permanent Removal', text: 'The transaction will be permanently removed from records.' }`
     - `{ title: 'Balances Recalculated', text: 'Account balances and spending stats will update automatically.' }`
     - `{ title: 'Cannot Be Undone', text: 'This transaction deletion cannot be reversed.' }`

- [ ] **Step 6: Run test to verify it passes**

Run: `node scratch/test-common-bottom-sheet-modal.js`
Expected: PASS for Task 2 checks

- [ ] **Step 7: Commit**

```bash
git add src/screens/BudgetsScreen.js src/screens/CategoriesScreen.js src/screens/CategoriesDetails.js scratch/test-common-bottom-sheet-modal.js
git commit -m "refactor(categories,budgets): migrate to CommonBottomSheetModal with warnings and loaders"
```

---

### Task 3: Migrate Credit Cards & Sources Screens

**Files:**
- Modify: `src/screens/CreditCardsScreen.js`
- Modify: `src/screens/CreditCardStatementsScreen.js`
- Modify: `src/screens/SourcesScreen.js`
- Test: `scratch/test-common-bottom-sheet-modal.js`

**Interfaces:**
- Consumes: `CommonBottomSheetModal` from `src/components/CommonBottomSheetModal.js`

- [ ] **Step 1: Add verification assertions for Credit Card & Sources screens**

Add assertions in `scratch/test-common-bottom-sheet-modal.js` checking:
1. `CreditCardsScreen.js` uses `CommonBottomSheetModal` instead of `ConfirmDialog`.
2. `CreditCardStatementsScreen.js` uses `CommonBottomSheetModal` instead of inline regenerate modal.
3. `SourcesScreen.js` uses `CommonBottomSheetModal` instead of `ConfirmDialog`.

- [ ] **Step 2: Run test to verify failure**

Run: `node scratch/test-common-bottom-sheet-modal.js`
Expected: FAIL

- [ ] **Step 3: Update `CreditCardsScreen.js`**

1. Replace `import ConfirmDialog from "../components/ConfirmDialog";` with `import CommonBottomSheetModal from "../components/CommonBottomSheetModal";`.
2. Add `isDeletingCard` state.
3. Replace `<ConfirmDialog ... />` with:
   ```jsx
   <CommonBottomSheetModal
     visible={confirmVisible}
     type="danger"
     title="Archive Credit Card?"
     subtitle="Are you sure you want to archive this credit card?"
     confirmLabel="Archive Card"
     cancelLabel="Keep Card"
     loading={isDeletingCard}
     warnings={[
       { title: 'Card Inactive', text: 'Card will be removed from your active credit card list.' },
       { title: 'History Preserved', text: 'All past statements, bills, and transactions remain intact.' },
       { title: 'Cannot Be Undone', text: 'Active card tracking for this card will cease.' },
     ]}
     onCancel={() => {
       if (isDeletingCard) return;
       setConfirmVisible(false);
     }}
     onConfirm={async () => {
       try {
         setIsDeletingCard(true);
         await handleDelete();
       } finally {
         setIsDeletingCard(false);
         setConfirmVisible(false);
       }
     }}
   />
   ```

- [ ] **Step 4: Update `CreditCardStatementsScreen.js`**

1. Import `CommonBottomSheetModal from '../components/CommonBottomSheetModal';`.
2. Replace the inline `<Modal visible={!!regenerateTarget} ...>` with:
   ```jsx
   <CommonBottomSheetModal
     visible={!!regenerateTarget}
     type="info"
     icon="refresh"
     title="Regenerate Statement?"
     subtitle={regenerateTarget ? `Statement from ${formatDate(regenerateTarget.statement_date)} for ${regenerateTarget.card_name || 'Credit Card'}` : ''}
     confirmLabel="Regenerate"
     cancelLabel="Cancel"
     confirmIcon="refresh"
     loading={regenerating}
     warningTitle="Statement Recalculation Notice"
     warnings={[
       { title: 'Recalculate Statement', text: 'Recalculates total dues and balances from latest transactions.' },
       { title: 'Payments Safe', text: 'Bills already marked as paid will remain paid.' },
       { title: 'Automatic Sync', text: 'Linked expenses and statement totals will sync immediately.' },
     ]}
     onCancel={() => {
       if (!regenerating) setRegenerateTarget(null);
     }}
     onConfirm={confirmRegenerateStatement}
   />
   ```
3. Remove unused inline styles (`regenerateOverlay`, `regenerateModal`, etc.).

- [ ] **Step 5: Update `SourcesScreen.js`**

1. Replace `import ConfirmDialog from '../components/ConfirmDialog';` with `import CommonBottomSheetModal from '../components/CommonBottomSheetModal';`.
2. Add `isDeletingSource` state.
3. Replace `<ConfirmDialog ... />` with `CommonBottomSheetModal`:
   - `type="danger"`, `title="Delete Account?"`, `confirmLabel="Delete Account"`, `cancelLabel="Keep Account"`.
   - `warnings`:
     - `{ title: 'Account Removed', text: 'This payment account will be permanently deleted.' }`
     - `{ title: 'Transactions Safe', text: 'Past transactions linked to this account remain in your history.' }`
     - `{ title: 'Cannot Be Undone', text: 'This account cannot be restored once deleted.' }`
   - `loading={isDeletingSource}`.

- [ ] **Step 6: Run test to verify it passes**

Run: `node scratch/test-common-bottom-sheet-modal.js`
Expected: PASS for Task 3 checks

- [ ] **Step 7: Commit**

```bash
git add src/screens/CreditCardsScreen.js src/screens/CreditCardStatementsScreen.js src/screens/SourcesScreen.js scratch/test-common-bottom-sheet-modal.js
git commit -m "refactor(cards,sources): migrate to CommonBottomSheetModal with warnings and loaders"
```

---

### Task 4: Migrate Loans & Transactions Screens

**Files:**
- Modify: `src/screens/LoanFormScreen.js`
- Modify: `src/components/TransactionForm.js`
- Test: `scratch/test-common-bottom-sheet-modal.js`

**Interfaces:**
- Consumes: `CommonBottomSheetModal` from `src/components/CommonBottomSheetModal.js`

- [ ] **Step 1: Add verification assertions for LoanFormScreen and TransactionForm**

Add assertions in `scratch/test-common-bottom-sheet-modal.js` verifying `LoanFormScreen.js` and `TransactionForm.js` use `CommonBottomSheetModal`.

- [ ] **Step 2: Run test to verify failure**

Run: `node scratch/test-common-bottom-sheet-modal.js`
Expected: FAIL

- [ ] **Step 3: Update `LoanFormScreen.js`**

1. Replace `import ConfirmDialog from "../components/ConfirmDialog";` with `import CommonBottomSheetModal from "../components/CommonBottomSheetModal";`.
2. Replace `<ConfirmDialog ... />` with:
   ```jsx
   <CommonBottomSheetModal
     visible={showConfirmDelete}
     type="danger"
     title={`Delete ${cfg.label}?`}
     subtitle={`Are you sure you want to delete this ${cfg.label.toLowerCase()}?`}
     confirmLabel={`Delete ${cfg.label}`}
     cancelLabel="Cancel"
     loading={deleting}
     warnings={[
       { title: 'Loan Record Removed', text: `This ${cfg.label.toLowerCase()} and its loan details will be permanently deleted.` },
       { title: 'Payments Unlinked', text: 'All associated payment history and records will be unlinked.' },
       { title: 'Cannot Be Undone', text: 'This operation cannot be reversed.' },
     ]}
     onCancel={() => {
       if (!deleting) setShowConfirmDelete(false);
     }}
     onConfirm={confirmDelete}
   />
   ```

- [ ] **Step 4: Update `TransactionForm.js`**

1. Replace `import ConfirmDialog from "./ConfirmDialog";` with `import CommonBottomSheetModal from "./CommonBottomSheetModal";`.
2. Replace delete `<ConfirmDialog ... />` with:
   ```jsx
   <CommonBottomSheetModal
     visible={confirmVisible}
     type="danger"
     title="Delete Transaction?"
     subtitle={`Are you sure you want to remove this ${type} transaction?`}
     confirmLabel="Delete Transaction"
     cancelLabel="Keep Transaction"
     loading={submitting}
     warnings={[
       { title: 'Permanent Removal', text: 'Transaction will be permanently removed from account records.' },
       { title: 'Balance Restored', text: 'Account balances and category monthly totals will update.' },
       { title: 'Cannot Be Undone', text: 'This transaction cannot be restored.' },
     ]}
     onCancel={() => {
       if (!submitting) setConfirmVisible(false);
     }}
     onConfirm={handleDelete}
   />
   ```
3. Replace unsaved changes `<ConfirmDialog ... />` with:
   ```jsx
   <CommonBottomSheetModal
     visible={showUnsavedDialog}
     type="warning"
     icon="alert-circle-outline"
     title="Discard Changes?"
     subtitle={isEdit ? "You've made changes that haven't been saved yet." : "You've started adding a new transaction."}
     confirmLabel="Discard"
     cancelLabel="Keep Editing"
     warningTitle="Unsaved Progress Notice"
     warnings={[
       { title: 'Edits Lost', text: 'If you leave now, all your unsaved modifications will be lost.' },
       { title: 'Keep Editing', text: 'Tap "Keep Editing" to continue working on this transaction.' },
     ]}
     onCancel={() => setShowUnsavedDialog(false)}
     onConfirm={() => {
       setShowUnsavedDialog(false);
       setIsDirty(false);
       if (onCancel) onCancel();
       else {
         setAmount("");
         // reset remaining fields
       }
     }}
   />
   ```

- [ ] **Step 5: Run test to verify it passes**

Run: `node scratch/test-common-bottom-sheet-modal.js`
Expected: PASS for Task 4 checks

- [ ] **Step 6: Commit**

```bash
git add src/screens/LoanFormScreen.js src/components/TransactionForm.js scratch/test-common-bottom-sheet-modal.js
git commit -m "refactor(loans,transactions): migrate to CommonBottomSheetModal with warnings and loaders"
```

---

### Task 5: Migrate Bill Details, Linked Bill Card, Exit Modal & Delete `ConfirmDialog.js`

**Files:**
- Modify: `src/screens/BillDetailScreen.js`
- Modify: `src/components/LinkedBillCard.js`
- Modify: `src/components/ExitConfirmationModal.js`
- Modify: `src/screens/BillsScreen.js`
- Delete: `src/components/ConfirmDialog.js`
- Test: `scratch/test-common-bottom-sheet-modal.js`

**Interfaces:**
- Consumes: `CommonBottomSheetModal` from `src/components/CommonBottomSheetModal.js`

- [ ] **Step 1: Add verification assertions for BillDetail, LinkedBillCard, ExitModal, and removal of ConfirmDialog**

Add assertions in `scratch/test-common-bottom-sheet-modal.js` verifying:
1. `src/components/ConfirmDialog.js` does NOT exist.
2. `git grep "ConfirmDialog"` across `src/` yields 0 matches.
3. All screens compile cleanly via Babel.

- [ ] **Step 2: Run test to verify failure**

Run: `node scratch/test-common-bottom-sheet-modal.js`
Expected: FAIL (ConfirmDialog still exists)

- [ ] **Step 3: Update `BillDetailScreen.js`**

1. Replace `import ConfirmDialog from "../components/ConfirmDialog";` with `import CommonBottomSheetModal from "../components/CommonBottomSheetModal";`.
2. Replace delete occurrence `<ConfirmDialog ... />` with `CommonBottomSheetModal`:
   - `type="danger"`, `title="Delete Occurrence?"`, `confirmLabel="Delete Occurrence"`, `cancelLabel="Keep Bill"`.
   - `warnings`:
     - `{ title: 'Occurrence Removed', text: `Delete occurrence for ${formatDueDate(activeBill.due_date)}.` }`
     - `{ title: 'Schedule Intact', text: 'Other recurring cycles will remain unaffected.' }`
     - `{ title: 'Cannot Be Undone', text: 'This bill occurrence will not be recreated.' }`
3. Replace inline unlink transaction `<Modal visible={Boolean(unlinkingTx)} ...>` with `CommonBottomSheetModal`:
   - `type="warning"`, `title="Unlink Transaction?"`, `confirmLabel="Unlink Transaction"`, `cancelLabel="Cancel"`, `loading={unlinking}`.
   - `warnings`:
     - `{ title: 'Transaction Unlinked', text: 'This transaction will be disconnected from the bill.' }`
     - `{ title: 'Bill Reverts to Pending', text: 'Bill status will return to unpaid/pending dues.' }`
     - `{ title: 'Expense Kept', text: 'The expense transaction itself remains in your account records.' }`

- [ ] **Step 4: Update `LinkedBillCard.js`**

1. Import `CommonBottomSheetModal from './CommonBottomSheetModal';`.
2. Replace inline unlink `<Modal visible={!!unlinkingBill} ...>` with `CommonBottomSheetModal`:
   - `type="warning"`, `title={unlinkingBill?.is_deleted ? 'Unlink Deleted Bill?' : 'Unlink Bill?'}`, `confirmLabel="Unlink"`, `cancelLabel="Cancel"`, `loading={unlinking}`.
   - `warnings`:
     - `{ title: 'Link Removed', text: 'The connection between this bill and transaction will be cleared.' }`
     - `{ title: 'Bill Status Synced', text: 'Bill will revert to unpaid status and statement amounts will update.' }`

- [ ] **Step 5: Update `ExitConfirmationModal.js`**

Refactor `ExitConfirmationModal.js` to render `CommonBottomSheetModal`:
- `type="warning"`, `icon="exit-to-app"`, `title="Exit SpendoraX?"`, `confirmLabel="Exit App"`, `cancelLabel="Cancel"`.
- `warningTitle="Closing Application"`.
- `warnings`:
  - `{ title: 'Session Ending', text: 'You are about to exit SpendoraX.' }`
  - `{ title: 'Unsaved Progress', text: 'Make sure all active transactions or bill edits have been saved.' }`

- [ ] **Step 6: Remove `ConfirmDialog` import in `BillsScreen.js`**

Remove line: `import ConfirmDialog from "../components/ConfirmDialog";` (BillsScreen already uses DeleteBillModal and SkipBillModal).

- [ ] **Step 7: Delete `src/components/ConfirmDialog.js`**

Delete `src/components/ConfirmDialog.js`.

- [ ] **Step 8: Run complete test script**

Run: `node scratch/test-common-bottom-sheet-modal.js`
Expected: ALL TESTS PASS with 0 errors, 0 legacy ConfirmDialog references.

- [ ] **Step 9: Commit**

```bash
git rm src/components/ConfirmDialog.js
git add src/screens/BillDetailScreen.js src/components/LinkedBillCard.js src/components/ExitConfirmationModal.js src/screens/BillsScreen.js scratch/test-common-bottom-sheet-modal.js
git commit -m "refactor: complete migration to CommonBottomSheetModal and remove legacy ConfirmDialog"
```
