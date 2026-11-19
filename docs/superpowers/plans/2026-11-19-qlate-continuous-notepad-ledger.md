# Implementation Plan: Qlate Continuous Multiline Calculator + Notepad Ledger

## Tasks

### Task 1: Document Parsing Utility & Unit Tests
- Create `parseNotepadDocument(text)` in `src/utils/paperLedgerUtils.js`:
  - Splits text by `\n`.
  - For each line, parses via `parseNotepadLine(line, 'expense')`.
  - Returns array of line evaluations + `totalIncome`, `totalExpense`, `netTotal`, `validCount`.
- Create `test/test_qlate_document_parser.js` testing:
  - Multi-line evaluation with mixed expenses, incomes (`+`), and formulas (`100+25`).
  - Blank lines and commentary lines without amounts.
  - Live recalculation of totals.
- Verify test passes.

### Task 2: Build `QlateNotepadSheet.js` Component
- Create `src/components/QlateNotepadSheet.js`:
  - Main container styled as modern fintech ruled paper.
  - Header with Table Columns: `LINE` (line numbers), `EXPRESSION / NOTE` (~68%), `RESULT (₹)` (~28%).
  - Synchronized dual-pane body:
    - Left: Multiline `TextInput` on the paper, `lineHeight: 36`, `paddingVertical: 0`, transparent background.
    - Right: Parallel results column with matching `minHeight: 36` per line showing evaluated badges/text.
    - Far Left: Line numbers column (`01`, `02`, `03`...).
  - Empty document helper text.

### Task 3: Integrate into `PaperLedgerScreen.js`
- Replace row-by-row rendering with `QlateNotepadSheet`.
- State: `const [notepadText, setNotepadText] = useState('')`.
- Reactive totals via `useMemo(() => parseNotepadDocument(notepadText), [notepadText])`.
- Wire Selective Import: appends selected transactions as new lines to `notepadText`.
- Wire Save/Update: persists `raw_text` and parsed items to database.
- Wire New Sheet / Clear: resets `notepadText` to `''`.
- Wire Share to WhatsApp: shares evaluated document.
- Verify all tests pass & Babel syntax check.
- Local commit (NO PUSH).

