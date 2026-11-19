# Paper Ledger Freeform Notepad Typing, Selective Import & Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement freeform notepad-style line typing with Enter-to-next-line, selective transaction import checklist, `DD-MM-YYYY: Category: Notes` formatting with full title visibility (no text cutoff), and an in-app modern toast notification for save and import.

**Architecture:**
- Extend `src/utils/paperLedgerUtils.js` with `parseNotepadLine` (freeform title + amount/expression parsing) and `formatImportTransactionTitle`.
- Create `src/components/PaperToast.js` (animated floating toast) and `src/components/PaperImportSelectModal.js` (transaction selection checklist).
- Integrate the notepad input bar, selective import modal, text wrapping, and toast into `src/screens/PaperLedgerScreen.js` and `src/components/PaperSwipeableRow.js`.

**Tech Stack:** React Native, Expo, SQLite, Babel, Node.js assert.

**Spec:** `docs/superpowers/specs/2026-11-19-paper-ledger-freeform-import-toast.md`

## Global Constraints
- Local commits only; **NEVER** run `git push`.
- All clickable file links in chat must use `file:///` format with forward slashes.
- All existing 14 unit and integration test suites must continue passing.

---

### Task 1: Freeform Line Parser & Title Formatter Utility
**Files:**
- Modify: `src/utils/paperLedgerUtils.js`
- Create: `test/test_paper_ledger_freeform_parser.js`

- [ ] **Step 1: Write test for freeform line parser and title formatter**
  Create `test/test_paper_ledger_freeform_parser.js` testing:
  - `Dinner 450` -> `{ title: 'Dinner', amount: 450, type: 'expense', formula: null }`
  - `Salary +50000` or `+ Salary 50000` -> `{ title: 'Salary', amount: 50000, type: 'income', formula: null }`
  - `Grocery 100+25` -> `{ title: 'Grocery', amount: 125, formula: '100+25', type: 'expense' }`
  - `Freelance +100*5` -> `{ title: 'Freelance', amount: 500, formula: '100*5', type: 'income' }`
  - `100 + 25` (no title) -> `{ title: 'Calculation', amount: 125, formula: '100 + 25', type: 'expense' }`
  - Date format: `DD-MM-YYYY: Category: Notes` (e.g. `14-12-2026: Groceries: Supermarket`).
- [ ] **Step 2: Run test to verify failure**
  Run `node test/test_paper_ledger_freeform_parser.js`.
- [ ] **Step 3: Implement `parseNotepadLine` and `formatImportTransactionTitle` in `paperLedgerUtils.js`**
  - Implement regex and math parser integration in `parseNotepadLine`.
  - Implement date and title builder in `formatImportTransactionTitle`.
  - Update `mapDbTransactionsToPaperItems` to use formatted titles.
- [ ] **Step 4: Verify test passes & Babel check**
  Run `node test/test_paper_ledger_freeform_parser.js` and Babel syntax check.
- [ ] **Step 5: Local commit Task 1**
  Commit locally: `feat(paper-ledger): implement freeform notepad parser and import title formatter` (no push).

---

### Task 2: Modern In-App Toast & Selective Import Checklist Modal
**Files:**
- Create: `src/components/PaperToast.js`
- Create: `src/components/PaperImportSelectModal.js`
- Create: `test/test_paper_import_select_modal.js`

- [ ] **Step 1: Write tests for selective import checklist logic**
  Create `test/test_paper_import_select_modal.js` testing:
  - Default selection (all candidate transactions selected).
  - Toggle single item selection.
  - Select all / Deselect all toggling.
  - Importing only the checked items.
- [ ] **Step 2: Run test to verify failure**
  Run `node test/test_paper_import_select_modal.js`.
- [ ] **Step 3: Implement `PaperToast.js` & `PaperImportSelectModal.js`**
  - `PaperToast`: Floating pill with icon, message, smooth fade/slide in-out, and auto-dismiss timer (~2.8s).
  - `PaperImportSelectModal`: Modal with search, "Select All", checklist cards with formatted title `DD-MM-YYYY: Category: Notes`, amount badge, and "Import Selected (N)" button.
- [ ] **Step 4: Verify test passes & Babel check**
  Run `node test/test_paper_import_select_modal.js` and Babel syntax check.
- [ ] **Step 5: Local commit Task 2**
  Commit locally: `feat(paper-ledger): create in-app toast and selective import modal` (no push).

---

### Task 3: Wire into `PaperLedgerScreen.js` and `PaperSwipeableRow.js`
**Files:**
- Modify: `src/screens/PaperLedgerScreen.js`
- Modify: `src/components/PaperSwipeableRow.js`

- [ ] **Step 1: Remove text truncation in `PaperSwipeableRow.js`**
  - Remove `numberOfLines={2}` from `itemTitle` so the full formatted title (`DD-MM-YYYY: Category: Notes`) is completely visible.
- [ ] **Step 2: Add Notepad Input Bar to `PaperLedgerScreen.js`**
  - Render an inline typing bar directly on the paper ledger:
    - TextInput: placeholder `Type like notepad (e.g. Coffee 50 or Bonus +5000) & press Enter...`
    - `+ / −` pill toggle.
    - Inline `Add ↵` button.
    - `onSubmitEditing`: Calls `parseNotepadLine`, commits item to state, recalculates live totals, and keeps input ready for next line.
- [ ] **Step 3: Connect Selective Import Modal and Toast in `PaperLedgerScreen.js`**
  - When month is picked (or Import All), open `PaperImportSelectModal` with candidate transactions.
  - On confirm, import selected items and trigger `showToast("Imported N transactions into ledger")`.
  - On sheet save/update, trigger `showToast('Sheet "..." saved to database')`.
- [ ] **Step 4: Run full test suite across the project**
  Run all 15 test suites and verify Babel syntax.
- [ ] **Step 5: Local commit Task 3**
  Commit locally: `feat(paper-ledger): wire up freeform notepad typing, selective import, and in-app toast` (no push).

