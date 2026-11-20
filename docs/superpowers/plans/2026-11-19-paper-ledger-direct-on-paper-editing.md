# Implementation Plan: Direct On-Paper Freeform Line Editing

## Tasks

### Task 1: Utility helper `formatItemToFreeformLine` & Unit Tests
- Add `formatItemToFreeformLine(item)` to `src/utils/paperLedgerUtils.js`.
- Create `test/test_paper_ledger_inline_editing.js` testing:
  - Format plain expense item to `Title Amount`.
  - Format income item to `Title +Amount`.
  - Format formula item to `Title Formula`.
  - Parsing the formatted string back with `parseNotepadLine` returns identical data.
- Run tests to verify green.

### Task 2: Update `PaperSwipeableRow.js` for In-Place Ruled Line Editing
- Accept `isEditing`, `onStartEdit`, `onCommitEdit`, `onCancelEdit` props.
- When `isEditing` is true:
  - Render an inline borderless `TextInput` prefilled with `formatItemToFreeformLine(item)`.
  - `onSubmitEditing` commits the edit.
  - Quick action buttons (Save `✓` / Cancel `✕`) or Enter key support.
- When `isEditing` is false:
  - Tapping description triggers `onStartEdit`.
  - Swiping left triggers `onStartEdit` (instead of modal).
  - Swiping right triggers delete.

### Task 3: Update `PaperLedgerScreen.js` for Seamless Paper Row Typing
- Replace `notepadBar` with a natural ruled paper line:
  - Uses `col65` and `col35` matching existing rows.
  - Serial badge: `01`, `02`, `03`...
  - Borderless transparent `TextInput` directly on the paper ruling.
  - Col 35 shows preview amount or `↵ Add`.
- Wire `editingRowId`:
  - `handleStartEdit(rowId)`: Sets active editing row.
  - `handleCommitEdit(rowId, text)`: Parses text with `parseNotepadLine`, updates row, recalculates totals, clears editing row.
  - `handleCancelEdit()`: Clears active editing row.
- Remove `PaperAddRowModal` references.
- Connect FAB to focus the new line input.
- Run all 17 test suites and verify Babel syntax.
- Local commit (NO PUSH).

