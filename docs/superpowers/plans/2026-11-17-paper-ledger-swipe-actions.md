# Paper Ledger Swipe-to-Edit & Swipe-to-Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement distinct swipe actions on Paper Ledger calculation rows: swiping left triggers editing the row via an edit modal, and swiping right triggers deletion via the confirmation modal.

**Architecture:** Update `PaperSwipeableRow.js` to expose distinct left/right background action panels and gesture handling; enhance `PaperAddRowModal.js` to support editing with `initialItem`; and wire up `editingItem` state and update handlers in `PaperLedgerScreen.js`.

**Tech Stack:** React Native, Expo, PanResponder, Animated API, Babel, Node.js assert.

**Spec:** `docs/superpowers/specs/2026-11-17-paper-ledger-swipe-actions.md`

## Global Constraints

- Scratchpad behavior: Calculations and edits remain in-memory unless exported.
- Swipe left (`dx < 0`): triggers Edit action with blue background (`#2563EB`) and pencil icon.
- Swipe right (`dx > 0`): triggers Delete action with red background (`#EF4444`) and trash can icon.
- Delete must always prompt with confirmation modal before removal.
- Editing an entry must update the item in place and reactively recalculate the net total `(Income - Expenses)`.

## Review Focus

1. Editing an item updates description, type, and amount accurately without altering unaffected items.
2. Editing an item updates the running net balance correctly.
3. Swiping left opens the edit modal with the selected item's pre-filled values.
4. Swiping right opens the delete confirmation modal for the selected item.
5. In multi-select mode, swipe gestures remain disabled to prevent conflict with selection taps.

---

### Task 1: Enhance Modal for Edit Support

**Files:**
- Modify: `src/components/PaperAddRowModal.js`
- Test: `test/test_paper_ledger_edit_modal.js`

- [x] **Step 1: Write test for edit modal logic and props**
  Create `test/test_paper_ledger_edit_modal.js` verifying that initial item data populates title, amount, and type, and that submission outputs an updated object preserving the item ID.
- [x] **Step 2: Run test to verify failure**
  Run `node test/test_paper_ledger_edit_modal.js`.
- [x] **Step 3: Implement edit capabilities in `PaperAddRowModal.js`**
  - Add `initialItem` prop (default `null`).
  - Add `useEffect` to sync form values (`title`, `amount`, `type`) when `initialItem` or `visible` changes.
  - Dynamically render title: `initialItem ? 'Edit Paper Entry' : 'Add Paper Entry'`.
  - Dynamically render button text: `initialItem ? 'Save Changes' : 'Add Line'`.
  - Pass edited object (including existing `initialItem.id`) to `onAdd` / `onSave`.
- [x] **Step 4: Verify test passes**
  Run `node test/test_paper_ledger_edit_modal.js`.
- [x] **Step 5: Commit changes**
  Git commit Task 1.

---

### Task 2: Differentiate Left (Edit) & Right (Delete) Swipes in `PaperSwipeableRow.js`

**Files:**
- Modify: `src/components/PaperSwipeableRow.js`
- Test: `test/test_paper_ledger_swipe_actions.js`

- [x] **Step 1: Write unit test for swipe gesture direction resolution**
  Create `test/test_paper_ledger_swipe_actions.js` asserting:
  - `dx < -40` triggers `onRequestEdit`.
  - `dx > 40` triggers `onRequestDelete`.
- [x] **Step 2: Run test to verify failure**
  Run `node test/test_paper_ledger_swipe_actions.js`.
- [x] **Step 3: Update `PaperSwipeableRow.js`**
  - Add `onRequestEdit` prop.
  - Separate background actions:
    - Left background: Red container (`#EF4444`) with `trash-can-outline` and "Delete" label.
    - Right background: Blue container (`#2563EB`) with `pencil` and "Edit" label.
  - Update `onPanResponderRelease`:
    - If `gestureState.dx > 40` or `gestureState.vx > 0.3`: snap to `+80` and call `onRequestDelete(item, resetPosition)`.
    - If `gestureState.dx < -40` or `gestureState.vx < -0.3`: snap to `-80` and call `onRequestEdit(item, resetPosition)`.
  - Wrap both action indicators in `TouchableOpacity` so tapping directly triggers the action.
- [x] **Step 4: Verify test passes & Babel check**
  Run `node test/test_paper_ledger_swipe_actions.js` and Babel syntax check.
- [x] **Step 5: Commit changes**
  Git commit Task 2.

---

### Task 3: Wire Edit Workflow into `PaperLedgerScreen.js` and Verify

**Files:**
- Modify: `src/screens/PaperLedgerScreen.js`
- Test: `test/test_paper_ledger_e2e.js`

- [x] **Step 1: Update `PaperLedgerScreen.js`**
  - Add `editingItem` state (`null` when not editing).
  - Implement `handleOpenEdit(item, resetRow)` to set `editingItem` and open modal.
  - Implement `handleSaveEdit(updatedItem)` to update `items` in state by `id` and recalculate.
  - Pass `onRequestEdit={handleOpenEdit}` to `PaperSwipeableRow`.
  - Connect `PaperAddRowModal` with `initialItem={editingItem}` and `onClose={() => { setIsAddModalVisible(false); setEditingItem(null); }}`.
  - Update guide hint in notebook tape: `"Swipe right to delete • Swipe left to edit • Tap Select for bulk"`.
- [x] **Step 2: Update and run all tests**
  Update `test/test_paper_ledger_e2e.js` to test in-place editing and balance recalculation.
  Run full test suite:
  `node test/test_paper_ledger_utils.js; node test/test_paper_ledger_fixes.js; node test/test_paper_ledger_multiselect.js; node test/test_paper_ledger_swipe_actions.js; node test/test_paper_ledger_edit_modal.js; node test/test_paper_ledger_e2e.js`
- [x] **Step 3: Commit changes**
  Git commit Task 3.
