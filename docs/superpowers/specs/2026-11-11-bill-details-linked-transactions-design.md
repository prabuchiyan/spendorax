# Bill Details: Linked Transactions Unlink Modal & Dynamic Edit Flow

## Intent and Why
In the Bill Details screen (`BillDetailScreen.js`), linked transactions currently unlink immediately when tapping the unlink icon without confirmation, risking accidental unlinking and disruption of bill payment statuses. Additionally, the left side of the linked transaction card is static (hardcoded bank avatar styling and non-touchable), preventing users from navigating to edit the transaction. This update introduces a confirmation modal with warning messages matching the Spendorax design system and transforms the left transaction container into a dynamic, clickable card navigating directly to the existing transaction editor (`TransactionAdd`).

## Goals
- **Confirmation Modal for Unlink:** When tapping the unlink icon on a linked transaction, present a confirmation modal matching Spendorax design patterns (`LinkedBillCard` / `SkipBillModal`):
  - Top red warning badge (`link-variant-off` icon).
  - Clear confirmation title and subtitle.
  - Preview card of the transaction (notes, date, bank account/source name, formatted amount).
  - Warning alert box (`alert-circle-outline`) informing the user that unlinking will recalculate the bill's paid amount and may return its status to pending.
  - "Cancel" and "Unlink" action buttons with loading state handling.
- **Dynamic Left Avatar & Metadata:**
  - Query source attributes (`source_color`, `source_icon`) alongside category attributes in `getBillLinkedTransactions`.
  - Replace the hardcoded Axis Bank maroon chip (`#97144d`) with dynamic styling: category or source icon with respective background tint and color, or dynamic bank initials styled with source/theme colors.
  - Display the source name dynamically in the transaction metadata row.
- **Direct Navigation to Edit:**
  - Tapping the left transaction container navigates directly to `TransactionAdd` with `{ isEdit: true, transaction: tx }`.
  - Automatically reload occurrence and linked transactions on return via `useFocusEffect`.

## Non-Goals & Anti-Goals
- **Non-Goals:**
  - Creating a separate transaction edit modal inside `BillDetailScreen` (we leverage the existing `TransactionAdd` screen).
  - Modifying the underlying database unlinking logic in `removeTransactionFromBill`.
- **Anti-Goals:**
  - Do not use a plain alert or raw Paper dialog that ignores Spendorax's custom modal design language.
  - Do not keep hardcoded bank colors or static styling on the linked transaction row.

## Constraints
- Must support both Light and Dark themes via `useTheme()`.
- Must remain fully responsive on mobile screens and handle long transaction notes gracefully.

## Approaches Considered
1. **Approach 1 (Chosen): Spendorax Modal Pattern + Rich Dynamic Left Avatar & Direct Edit**
   - Modal with rounded card, top icon badge, preview card, warning note, and async confirm.
   - Dynamic left avatar reflecting category/source icons/colors.
   - Clickable left container directly navigating to `TransactionAdd`.
   - *Trades off slightly more component styling for complete visual and functional consistency.*
2. **Approach 2: Paper ConfirmDialog + Minimal Text Initials**
   - Use basic React Native Paper `<ConfirmDialog>` with plain text.
   - Keep basic initials with no icons or rich warning box.
   - *Trades off design quality and warning clarity for minimal lines of code. Rejected in favor of Approach 1.*

## Implementation Details
1. **Service Query Update (`src/services/bills.js`):**
   - Update `getBillLinkedTransactions(billId)` SQL query to also fetch `s.color as source_color` and `s.icon as source_icon` (in SQLite query and web fallback).
2. **Modal Component / State in `BillDetailScreen.js`:**
   - Add state: `unlinkingTx` (transaction pending unlink) and `unlinking` (boolean loading state).
   - Add `<Modal>` for unlink confirmation with backdrop overlay, animated/clean card container, danger icon badge, title, preview details, warning notice, and action buttons (`Cancel` and `Unlink`).
3. **Dynamic Left Avatar & Details (`LinkedTransactionsCard`):**
   - Replace static `bankChip` styling with dynamic icon/avatar wrap using `category_icon` / `source_icon` and `category_color` / `source_color`.
   - Render dynamic source tag (`tx.source_name`) in the metadata row next to the date.
   - Wrap left portion in `TouchableOpacity` with `activeOpacity={0.7}` and `onPress={() => onEdit(tx)}`.
4. **Navigation Callback:**
   - Pass `onEdit={(tx) => navigation.navigate('TransactionAdd', { isEdit: true, transaction: tx })}` to `LinkedTransactionsCard`.
   - On screen focus (`useFocusEffect`), occurrence and linked transactions reload automatically.

## Builder Check & Next Steps
- This is a targeted UI & UX enhancement. Once approved, proceed to invoke `superpowers:writing-plans` to create the detailed execution plan.

