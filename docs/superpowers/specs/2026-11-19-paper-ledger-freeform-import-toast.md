# Paper Ledger Freeform Notepad Typing, Selective Import & Toast Design Spec

## 1. Goal
Modernize the interaction model of Paper Ledger:
1. **Freeform Notepad-Style Typing (Option B):** Replace the multi-step modal with an inline text input bar where users type entries freely (e.g. `Coffee 45`, `Salary +50000`, `Grocery 100+25`). Pressing Enter automatically parses title, type, and amount/formula, adds the line to the ledger, recalculates totals, and leaves the input focused for the next line.
2. **Selective Import Checklist:** When importing transactions by month or all months, show an interactive checklist modal allowing users to review, select/deselect transactions, and import only chosen items.
3. **Formatted Import Title:** Format imported transaction titles as `DD-MM-YYYY: Category: Notes` (e.g. `14-12-2026: Groceries: Supermarket`).
4. **No Text Cutoff:** Ensure titles in calculation rows wrap cleanly without truncation (`numberOfLines` removed or flexible).
5. **Modern In-App Toast:** Replace generic alert popups on save and import with an elegant animated floating toast notification.
6. **Local Verification Constraint:** Do not push commits to remote (`no git push`).

## 2. Approaches Considered
- **Approach A (Inline Table Row):** Two separate text inputs directly inside the 65%/35% table cells. Tabbing or hitting Enter moves between cells.
- **Approach B (Freeform Single-Line Notepad Parser - Selected):** A single rapid input line where user writes description and amount/expression together. Hitting Enter commits and resets. This is faster and feels exactly like typing in a quick notepad scratchpad.

## 3. Detailed Component & Logic Design

### 3.1 Freeform Parser (`parseNotepadLine`)
Located in `src/utils/paperLedgerUtils.js`:
- Supports patterns:
  - `<Title> <Amount>` (e.g. `Groceries 450` -> title: `Groceries`, amount: 450, type: `expense`)
  - `<Title> +<Amount>` or `+<Title> <Amount>` (e.g. `Bonus +5000` -> title: `Bonus`, amount: 5000, type: `income`)
  - `<Title> <Formula>` (e.g. `Dinner 100+25` -> title: `Dinner`, amount: 125, formula: `100+25`, type: `expense`)
  - `<Title> +<Formula>` (e.g. `Freelance +100*5` -> title: `Freelance`, amount: 500, formula: `100*5`, type: `income`)
  - `<Formula>` alone (e.g. `100 + 25` -> title: `Item`, amount: 125, formula: `100 + 25`, type: `expense`)
- Returns `{ title, amount, formula, type, isValid }`.

### 3.2 Inline Notepad Input Bar in `PaperLedgerScreen`
- Placed directly inside the paper card above or below the rows.
- Features:
  - Fast TextInput with placeholder: `Type like notepad (e.g. Coffee 50 or Bonus +5000) & press Enter...`
  - Inline `+ / −` pill toggle so user can quickly switch type or rely on auto-detection.
  - Quick action button `Add ↵` for mobile touch users who don't press keyboard Enter.
  - `onSubmitEditing`: Parses the input line, appends to `items`, scrolls into view, clears input, and keeps focus.

### 3.3 Selective Import Modal (`PaperImportSelectModal`)
- Triggered after selecting a month in `PaperMonthPickerModal` (or "Import All").
- Fetches candidate transactions (excluding transfers).
- Displays:
  - Header with `Select Transactions to Import` and candidate count badge.
  - "Select All" / "Deselect All" button.
  - Scrollable list of transaction rows with:
    - Checkbox (selected state).
    - Formatted title: `DD-MM-YYYY: Category: Notes`.
    - Colored amount (`+₹...` / `−₹...`).
  - Action footer: "Cancel" and "Import Selected (N)".
- When confirmed, maps only selected transactions into paper items and shows toast!

### 3.4 Text Wrapping (No Cutoff) in `PaperSwipeableRow`
- Remove `numberOfLines={2}` from `styles.itemTitle`.
- Allow flexible multi-line wrapping so `DD-MM-YYYY: Category: Notes` is 100% visible with comfortable line height.

### 3.5 Modern In-App Toast (`PaperToast`)
- Floating animated toast pill at the top of the screen:
  - Success icon (`check-circle` in emerald `#10B981` or primary blue `#3B82F6`).
  - Clear message text (e.g. `Imported 8 transactions into ledger`, `Sheet "December Budget" saved`).
  - Auto-dismisses after 2.8 seconds.
  - Replaces all alert popups for Save, Update, and Import.

## 4. Verification & Testing
- Unit tests for `parseNotepadLine` (positive, negative, formulas, edge cases).
- Unit tests for date title formatting: `DD-MM-YYYY: Category: Notes`.
- Unit tests for selective import state and toggle.
- Regression tests for all existing paper ledger suites.
- Commits saved locally; no remote push.

