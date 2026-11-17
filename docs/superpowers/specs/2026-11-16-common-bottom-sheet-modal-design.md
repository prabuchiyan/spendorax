# Common Bottom-Sheet Modal Design Specification

## Intent & The Why
SpendoraX recently introduced modern, high-quality bottom-sheet modals for billing actions (`DeleteBillModal`, `SkipBillModal`, `UnskipBillModal`). These components feature top drag handles, thematic icon badges, contextual warning cards with bullet points ("related warnings"), disabled action states during execution, and submit button loaders.

However, across the rest of the application, confirmation dialogs still relied on legacy unstyled `react-native-paper` `ConfirmDialog` components or disparate custom inline modals without consistent warning notices, theme adaptations, or action loaders. 

This project cleans up and unifies modal design across the entire application by:
1. Creating a single, highly reusable `src/components/CommonBottomSheetModal.js`.
2. Migrating all screens and components to use `CommonBottomSheetModal`.
3. Adding relevant contextual warnings and consequences to every destructive/critical action.
4. Ensuring submit buttons show a loading spinner and disable all modal buttons while actions execute.
5. Deleting the legacy `src/components/ConfirmDialog.js` to keep the codebase clean.
6. Strictly preserving all existing business logic, states, and functionality.

---

## Goals, Non-Goals, and Anti-Goals

### Goals
- **Unified Bottom-Sheet Layout:** Provide a standardized slide-up modal with drag handle, backdrop dismiss, dark/light theme support, and smooth presentation across iOS and Android.
- **Contextual Warning Notices:** Give every critical/destructive modal a dedicated warning section outlining exact consequences (e.g. data permanence, account balance updates, linked transaction safety, irreversibility).
- **Action State Feedback:** While an action is in progress (`loading = true`), display an `ActivityIndicator` on the confirm button, disable both confirm and cancel buttons, and prevent backdrop dismiss.
- **Clean Codebase:** Eliminate `src/components/ConfirmDialog.js` and redundant inline modal boilerplate across the application.
- **100% Logic Preservation:** No change to state management, service calls, navigation, or data mutations.

### Non-Goals
- Modifying specialized full-screen forms (like `BillForm.js`), date/time pickers (`MuiDateTimePicker.js`), or complex multi-input search filters (`SearchScreen.js`).
- Modifying backend databases, queries, or business rules.

### Anti-Goals
- Changing confirmation flow triggers or altering parameter payloads passed to deletion/action functions.
- Leaving legacy `ConfirmDialog` unused in the repository.

---

## Constraints
- **Platform Compatibility:** Must render reliably on both Android and iOS inside React Native / Expo SDK 51.
- **Theme Support:** Must integrate with `ThemeContext` (`useTheme`), adapting card backgrounds, borders, typography, and contrast for light and dark modes.
- **Zero Regression:** All existing test suites and Babel compilations must pass without errors.

---

## Approaches Considered

1. **Option 1: Upgrade `ConfirmDialog.js` in place**
   - *Description:* Overwrite `ConfirmDialog.js` with the bottom-sheet layout.
   - *Trade-off:* Quick, but leaves an obsolete component name (`ConfirmDialog`) representing a bottom sheet modal, keeping legacy nomenclature.
2. **Option 2: Create `CommonBottomSheetModal.js` and Clean Up Legacy Code (Selected)**
   - *Description:* Build `CommonBottomSheetModal.js`, migrate every caller, add rich contextual warnings, and delete `ConfirmDialog.js`.
   - *Trade-off:* Requires touching all call sites, but delivers a clean, modern, and unified architecture with zero dead code.
3. **Option 3: Hybrid adapter**
   - *Description:* Create `CommonBottomSheetModal.js` and keep `ConfirmDialog.js` as an adapter.
   - *Trade-off:* Adds unnecessary layers when the user explicitly desires full codebase clean-up.

---

## Component Architecture: `CommonBottomSheetModal.js`

### Visual Anatomy
1. **Backdrop:** Semi-transparent overlay (`rgba(15, 23, 42, 0.65)` in light, `rgba(0, 0, 0, 0.75)` in dark) with touch-to-dismiss (blocked when `loading`).
2. **Sheet Container:** Slide-up sheet with rounded top corners (`borderTopLeftRadius: 28`, `borderTopRightRadius: 28`), theme background, theme border, and elevation/shadow.
3. **Handle Bar:** Centered pill handle (`width: 44`, `height: 5`).
4. **Header Section:**
   - Circular icon badge with themed tint (Red for `danger`, Amber for `warning`, Blue for `info`, Green for `success`).
   - Title (`fontSize: 20`, `fontWeight: '800'`).
   - Subtitle / Description (`fontSize: 13`, `fontWeight: '500'`).
5. **Optional Item Preview Card:** Rendered if `itemPreview` or `previewNode` is provided (e.g. item name, category badge, amount).
6. **Warning / Notice Box ("Related Warnings"):**
   - Tinted background and border corresponding to action type.
   - Header with alert icon and title (e.g. "Permanent Action Warning", "Important Notice", "Reactivation Info").
   - Bulleted list of notices with icon bullets and bold labels.
7. **Action Buttons:**
   - **Cancel Button:** Outlined/neutral button ("Cancel", "Keep", "Discard"). Disabled when `loading` is true.
   - **Confirm Button:** Primary action button with type-based color (`#DC2626` for danger, `#D97706` for warning, `#2563EB` for info).
   - **Loading State:** When `loading` is true, confirm button shows `ActivityIndicator` (white), text is hidden, and all interactions are locked.

### Props API
```typescript
interface CommonBottomSheetModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  type?: 'danger' | 'warning' | 'info' | 'success'; // default: 'danger'
  icon?: string; // MaterialCommunityIcons name
  title: string;
  subtitle?: string;
  message?: string; // Fallback if no warnings passed
  warnings?: Array<{
    title?: string;
    text: string;
    icon?: string;
    color?: string;
  } | string>;
  warningTitle?: string;
  itemPreview?: React.ReactNode;
  confirmLabel?: string; // default: 'Confirm'
  cancelLabel?: string; // default: 'Cancel'
  confirmIcon?: string;
}
```

---

## Screen Migrations

| Target Screen / Component | Current Implementation | Upgraded Implementation & Contextual Warnings |
|---|---|---|
| **BudgetsScreen.js** | `ConfirmDialog` ("Delete this category budget?") | `CommonBottomSheetModal` (`type="danger"`, "Delete Category Budget?").<br>• **Budget Removed:** Category spending limit will be deleted for this month.<br>• **Transactions Safe:** All recorded expenses remain intact.<br>• **Cannot Be Undone:** Action cannot be reversed. |
| **CategoriesScreen.js** | `ConfirmDialog` ("Delete Category") | `CommonBottomSheetModal` (`type="danger"`, "Delete Category?").<br>• **Category Removed:** Category will be permanently deleted from active list.<br>• **Transactions Preserved:** Associated transactions will retain their historical records.<br>• **Cannot Be Undone:** Action cannot be reversed. |
| **CategoriesDetails.js** | `ConfirmDialog` ("Delete Transaction") | `CommonBottomSheetModal` (`type="danger"`, "Delete Transaction?").<br>• **Permanent Removal:** Transaction will be deleted from database.<br>• **Balance Updated:** Associated account balances will be recalculated.<br>• **Cannot Be Undone:** Action cannot be reversed. |
| **CreditCardsScreen.js** | `ConfirmDialog` ("Delete Credit Card") | `CommonBottomSheetModal` (`type="danger"`, "Archive Credit Card?").<br>• **Card Removed:** Card will no longer appear in your active credit card list.<br>• **History Preserved:** Statements, bills, and transactions remain intact.<br>• **Cannot Be Undone:** Action cannot be reversed. |
| **SourcesScreen.js** | `ConfirmDialog` ("Delete Account") | `CommonBottomSheetModal` (`type="danger"`, "Delete Account?").<br>• **Account Removed:** Account will be permanently deleted.<br>• **Transactions Preserved:** Associated records remain in history.<br>• **Balance Removed:** Account balance will no longer contribute to net worth. |
| **LoanFormScreen.js** | `ConfirmDialog` ("Delete Loan?") | `CommonBottomSheetModal` (`type="danger"`, "Delete Loan Record?").<br>• **Loan Removed:** All loan data, terms, and schedules will be permanently deleted.<br>• **Payments Cleared:** Recorded payments and transactions will be unlinked.<br>• **Cannot Be Undone:** Action cannot be reversed. |
| **TransactionForm.js** (Delete) | `ConfirmDialog` ("Delete Transaction") | `CommonBottomSheetModal` (`type="danger"`, "Delete Transaction?").<br>• **Permanent Removal:** Transaction will be deleted from account history.<br>• **Balance Restored:** Account and category budgets will be updated.<br>• **Cannot Be Undone:** Action cannot be reversed. |
| **TransactionForm.js** (Discard) | `ConfirmDialog` ("Discard changes?") | `CommonBottomSheetModal` (`type="warning"`, "Discard Unsaved Changes?").<br>• **Edits Lost:** Any unsaved inputs and modifications will be discarded.<br>• **Keep Editing Available:** Tap Keep Editing to continue where you left off. |
| **BillDetailScreen.js** (Delete Occ) | `ConfirmDialog` ("Delete Occurrence") | `CommonBottomSheetModal` (`type="danger"`, "Delete Bill Occurrence?").<br>• **Occurrence Removed:** Occurrence deleted for this cycle.<br>• **Schedule Preserved:** Future recurring cycles remain active.<br>• **Transactions Safe:** Linked transactions are unlinked, not deleted. |
| **BillDetailScreen.js** (Unlink Tx) | Inline custom modal | `CommonBottomSheetModal` (`type="warning"`, "Unlink Transaction?").<br>• **Transaction Unlinked:** Bill will return to pending status.<br>• **Transaction Kept:** Expense transaction remains in account history. |
| **LinkedBillCard.js** (Unlink Bill) | Inline custom modal | `CommonBottomSheetModal` (`type="warning"`, "Unlink Bill?").<br>• **Transaction Link Cleared:** Bill link removed from transaction.<br>• **Bill Status Restored:** Bill returns to unpaid / pending status. |
| **CreditCardStatementsScreen.js** | Inline custom modal ("Regenerate?") | `CommonBottomSheetModal` (`type="info"`, "Regenerate Statement?").<br>• **Recalculate Statement:** Computes statement from latest transactions.<br>• **Paid Bills Intact:** Paid bills and payments will remain paid. |
| **ExitConfirmationModal.js** | Centered custom Animated modal | `CommonBottomSheetModal` (`type="warning"`, "Exit SpendoraX?").<br>• **App Session Ending:** SpendoraX will close.<br>• **Unsaved Changes:** Ensure all pending inputs have been saved. |
| **BillsScreen.js** | Unused `ConfirmDialog` import | Remove dead `ConfirmDialog` import. |
| **ConfirmDialog.js** | Legacy component | Delete file from repository. |

---

## Verification & Quality Assurance
- **Babel Syntax Compilation:** Run Babel AST check on all updated files to guarantee no syntax regressions.
- **Verification Script:** Automated verification script in `scratch/verify-common-modal.js` checking:
  - `CommonBottomSheetModal.js` exists and exports properly.
  - No remaining imports or references to `ConfirmDialog` anywhere in `src/`.
  - All modified screens properly pass loading state and disable actions during execution.
  - Dark/light mode theme variables properly applied.

