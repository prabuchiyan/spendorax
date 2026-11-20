# Specification: Paper Ledger Direct On-Paper Freeform Line Editing

## Overview
Transform the Paper Ledger into a true paper notepad interaction where users type directly onto ruled lines on the sheet (not inside form boxes or text containers), and edit existing rows directly in-place on the paper with zero modal popups.

## Key Requirements
1. **Direct On-Paper New Line:**
   - Display a perpetual blank ruled row at the bottom of the paper sheet.
   - Features the next serial number (e.g. `04`), transparent borderless `TextInput` directly on the paper ruling, and the standard 65% / 35% table column divider.
   - Pressing **Enter** (`onSubmitEditing`) commits the line, recalculates net totals, shows a sleek toast, and keeps focus on the new next line (`05`) with `blurOnSubmit={false}`.
2. **Direct In-Place Row Editing:**
   - Tapping an existing row (or swiping left) converts that row directly into an inline freeform edit line prefilled with its text (e.g. `Dinner 450` or `Salary +50000`).
   - Pressing **Enter** (or tapping outside / onEndEditing) parses the edited string via `parseNotepadLine`, updates the row, recalculates live totals, and exits edit mode.
   - Completely eliminates modal popups (`PaperAddRowModal` is no longer needed).
3. **Helper Function `formatItemToFreeformLine`:**
   - Converts an existing item object `{ title, amount, type, formula }` into a clean freeform string for inline editing:
     - Income: `Title +Amount` (or `Title +Formula`)
     - Expense: `Title Amount` (or `Title Formula`)
4. **App FAB:**
   - Tapping the FAB scrolls to and focuses the direct on-paper new entry line.
5. **No Push Constraint:**
   - Do NOT push code to remote git branch. Local commits only.

