# Design Specification: Paper Ledger Swipe-to-Edit & Swipe-to-Delete

## 1. Intent & Problem Statement
Currently, swiping a row in either direction on the Paper Ledger screen triggers row deletion. The user requested a functional separation of gestures:
- **Left swipe** to edit the transaction.
- **Right swipe** to delete the transaction (with confirmation warning).

## 2. Goals & Non-Goals
### Goals
- **Left swipe gesture (`dx < 0`)**: Moves the row to the left, revealing an **Edit action** on the right side (Blue `#2563EB` background with pencil icon and "Edit" label). Snaps or releases to trigger the Edit modal for that transaction.
- **Right swipe gesture (`dx > 0`)**: Moves the row to the right, revealing a **Delete action** on the left side (Red `#EF4444` background with trash can icon and "Delete" label). Snaps or releases to trigger the delete confirmation modal.
- **Edit Modal Integration**: Enhance `PaperAddRowModal.js` to accept an optional `initialItem` prop. When present, the modal titles itself "Edit Paper Entry", pre-fills `title`, `type` (income/expense), and `amount`, and presents a "Save Changes" button that updates the row without changing its order or deleting it.
- **Reactive Recalculation**: Updating an edited transaction immediately recalculates the ledger's net total `(Income - Expenses)`.

### Non-Goals
- Changing the database layer (calculations remain scratchpad in-memory unless exported).
- Changing multi-select bulk delete behavior.

## 3. Approaches Considered
- **Approach 1 (Chosen by user - Option A)**:
  - Swipe Left (`dx < 0`): triggers Edit action.
  - Swipe Right (`dx > 0`): triggers Delete action.
  - Distinct color-coded backgrounds: Right-side revealed on left swipe is Blue (`#2563EB`) with pencil icon; Left-side revealed on right swipe is Red (`#EF4444`) with trash icon.
- **Approach 2 (Option B)**:
  - Swipe Right reveals Edit on left, Swipe Left reveals Delete on right.
  - *Trade-off:* User explicitly selected Option A.

## 4. Component Changes
1. **`PaperSwipeableRow.js`**:
   - Split background action layers into a left-side Delete container (`#EF4444`, icon `trash-can-outline`, text "Delete") and a right-side Edit container (`#2563EB`, icon `pencil`, text "Edit").
   - Update PanResponder:
     - When `dx > 0` (moving right): snap to +80 and trigger `onRequestDelete(item, resetPosition)`.
     - When `dx < 0` (moving left): snap to -80 and trigger `onRequestEdit(item, resetPosition)`.
   - Both indicator banners are individually pressable `TouchableOpacity` components for guaranteed touch response.
2. **`PaperAddRowModal.js`**:
   - Add `initialItem` prop.
   - Use `useEffect` to sync state (`title`, `amount`, `type`) when `initialItem` changes or modal opens.
   - Dynamically adjust title to "Edit Paper Entry" / "Add Paper Entry" and button label to "Save Changes" / "Add Line".
   - On submit, call `onSave(updatedItem)` or `onAdd(newItem)`.
3. **`PaperLedgerScreen.js`**:
   - Add `editingItem` state.
   - Implement `handleEditRow(updatedItem)`: updates `items` by replacing the matched item by `id`, resets swipe, closes modal, and recalculates totals.
   - Pass `onRequestEdit` callback to `PaperSwipeableRow`.

