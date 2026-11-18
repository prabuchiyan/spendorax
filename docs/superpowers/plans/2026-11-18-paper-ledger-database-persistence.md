# Paper Ledger Database Persistence & Pinning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Paper Ledger calculation sheets into a dedicated SQLite database table (`paper_ledgers`) storing the entire items array as a single-row JSON object, with Save, Edit (last-updated date), Open list, Pin/Unpin, and Delete capabilities.

**Architecture:** Add `paper_ledgers` table to `src/database/init.js`; implement CRUD service in `src/services/paperLedgerService.js`; build `PaperSaveSheetModal.js` and `PaperSavedSheetsModal.js`; wire up state and actions in `src/screens/PaperLedgerScreen.js`.

**Tech Stack:** React Native, Expo, SQLite / Web localStorage shim, Babel, Node.js assert.

**Spec:** `docs/superpowers/specs/2026-11-18-paper-ledger-database-persistence.md`

## Global Constraints

- Separate table: `paper_ledgers` with columns `id`, `title`, `data`, `total_income`, `total_expense`, `net_total`, `is_pinned`, `created_at`, `updated_at`.
- Single-row object storage: `data` column contains the entire JSON serialized items array.
- Sorting: Always `ORDER BY is_pinned DESC, updated_at DESC`.
- Local verification only: Do NOT push commits to remote branch (`no git push`).

## Review Focus

1. Creating, saving, and updating a paper sheet correctly writes to `paper_ledgers` with valid JSON data and timestamps.
2. Pinned sheets sort first (`is_pinned = 1`), followed by unpinned sheets by most recent `updated_at`.
3. Tapping a saved sheet in the browser opens its exact items, formulas, and totals in `PaperLedgerScreen`.
4. Updating an existing saved sheet bumps `updated_at` and keeps the same sheet ID.
5. Deleting a saved sheet prompts for confirmation and removes it from the database.

---

### Task 1: Database Table & Service Layer

**Files:**
- Modify: `src/database/init.js`
- Create: `src/services/paperLedgerService.js`
- Test: `test/test_paper_ledger_service.js`

- [ ] **Step 1: Write test for paper ledger DB service**
  Create `test/test_paper_ledger_service.js` testing:
  - Saving a new ledger returns an ID.
  - Updating an existing ledger modifies title, data, totals, and `updated_at`.
  - Fetching ledgers returns records sorted by `is_pinned DESC, updated_at DESC`.
  - Pinning and unpinning toggles `is_pinned`.
  - Deleting removes the record.
- [ ] **Step 2: Run test to verify failure**
  Run `node test/test_paper_ledger_service.js`.
- [ ] **Step 3: Implement table in `init.js` and service in `paperLedgerService.js`**
  - Add `CREATE TABLE IF NOT EXISTS paper_ledgers` in `init.js`.
  - Add `paper_ledgers` to `clearAllTables` array.
  - Implement functions in `src/services/paperLedgerService.js`: `savePaperLedger`, `getPaperLedgers`, `getPaperLedgerById`, `togglePinPaperLedger`, `deletePaperLedger`, `renamePaperLedger`.
- [ ] **Step 4: Verify test passes**
  Run `node test/test_paper_ledger_service.js`.
- [ ] **Step 5: Local commit**
  Commit Task 1 locally (do not push).

---

### Task 2: Save Sheet Modal & Saved Sheets Browser Modal

**Files:**
- Create: `src/components/PaperSaveSheetModal.js`
- Create: `src/components/PaperSavedSheetsModal.js`
- Test: `test/test_paper_saved_sheets_components.js`

- [ ] **Step 1: Write tests for modal component logic**
  Create `test/test_paper_saved_sheets_components.js` testing:
  - Title validation and default date naming in save modal.
  - Pin sorting and filtering logic in saved sheets modal.
- [ ] **Step 2: Run test to verify failure**
  Run `node test/test_paper_saved_sheets_components.js`.
- [ ] **Step 3: Implement `PaperSaveSheetModal.js` & `PaperSavedSheetsModal.js`**
  - `PaperSaveSheetModal`: prompt for title, Save / Save as Copy options.
  - `PaperSavedSheetsModal`: list of sheets with pinned golden badge, quick Pin/Unpin button, Open, Delete, and Search filter.
- [ ] **Step 4: Verify test passes & Babel check**
  Run `node test/test_paper_saved_sheets_components.js` and Babel syntax check.
- [ ] **Step 5: Local commit**
  Commit Task 2 locally (do not push).

---

### Task 3: Wire into `PaperLedgerScreen.js` and End-to-End Verification

**Files:**
- Modify: `src/screens/PaperLedgerScreen.js`
- Test: `test/test_paper_ledger_db_e2e.js`

- [ ] **Step 1: Write end-to-end integration test**
  Create `test/test_paper_ledger_db_e2e.js`.
- [ ] **Step 2: Update `PaperLedgerScreen.js`**
  - Add `activeSheetId`, `activeSheetTitle`, `savedSheetsCount`.
  - Add "Save" and "Sheets (N)" to the top toolbar.
  - Show active sheet title in notebook binding tape with rename and "+ New Sheet" buttons.
  - Wire up Save modal, Saved Sheets modal, Pin/Unpin, and Load Sheet.
- [ ] **Step 3: Run full test suite & Babel AST checks**
  Run all 10+ test suites and verify Babel syntax across all modified files.
- [ ] **Step 4: Local commit**
  Commit Task 3 locally (do not push).
