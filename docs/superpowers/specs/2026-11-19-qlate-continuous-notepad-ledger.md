# Specification: Qlate Continuous Multiline Calculator + Notepad Ledger (Option A)

## 1. Overview
Redesign SpendoraX Paper Ledger into a true **Qlate (Calculator + Notepad)** continuous document experience. The entire sheet becomes an open, multiline ruled notepad where users type text and mathematical expressions freely on the left, while evaluated calculation results line up locked to the right margin in real-time. Modals and popup forms are completely eliminated.

## 2. User Experience & Core Workflows

### A. The Qlate Notepad Document (Left: Text, Right: Live Results)
- **Continuous Notepad Editor (Left ~72%):**
  - A single continuous `TextInput` with `multiline={true}`.
  - Zero input boxes, zero card outlines, zero borders around lines. The text sits directly on the paper ruling with a consistent line pitch (`lineHeight: 36`).
  - Users can click anywhere to position the cursor, type, backspace, paste text, or press Enter freely.
  - Line numbers badge column on the left (e.g. `01`, `02`, `03`...) tracks each line.
- **Synchronized Results Margin (Right ~28%):**
  - Parallel column locked to the right-hand margin.
  - For each line in the text, evaluates math/amounts in real-time:
    - Inflow (`+`): Emerald badge `+ ₹50,000`
    - Outflow (`−` or default): Rose badge `− ₹450`
    - Math formulas (e.g. `100+25`): Evaluates formula live `− ₹125`
    - Plain text / empty line: Stays clean (empty space) without cluttering.
  - Exactly matches the vertical line pitch (`36px`) so every line's result is parallel to its text.

### B. Instant Reactive Balance Summary
- Bottom Hero Summary Card updates live on every keystroke:
  - Total Inflow (sum of all `+` lines)
  - Total Outflow (sum of all expense lines)
  - Net Balance = Inflow - Outflow
  - Surplus / Deficit / Balanced status tag

### C. Selective Import from Database
- Opens `PaperImportSelectModal` to pick transactions.
- Selected transactions are appended directly as text lines to the continuous document:
  `DD-MM-YYYY: Category: Notes Amount` (e.g. `14-12-2026: Groceries: Supermarket 1500`).
- The right results column immediately evaluates and reflects each line.
- In-app floating toast confirms: `Imported N transactions into notepad`.

### D. Sheet Persistence & Saved Sheets
- Saved to SQLite `paper_ledgers` table:
  - `raw_text`: The full multiline notepad string.
  - `items`: Parsed array of non-empty calculation lines for cross-compatibility.
  - `totalIncome`, `totalExpense`, `netTotal`.
- Loading a sheet sets the text into the editor.
- "New Sheet" resets text to empty.
- "Clear" confirmation dialog resets text to empty.

### E. Zero Modals
- `PaperAddRowModal` is deleted/unmounted. Adding, editing, and deleting happen 100% inside the document.

## 3. Constraints
- Never run `git push`. All commits local.
