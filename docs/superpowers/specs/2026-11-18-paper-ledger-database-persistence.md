# Design Specification: Paper Ledger Database Persistence & Pinning

## 1. Intent & Problem Statement
Currently, Paper Ledger calculations are ephemeral/scratchpad in-memory sessions. The user needs to persist calculation sheets to SQLite so they can:
- Save new calculation sheets with a title.
- Store the entire sheet object in a single row as a JSON payload.
- Update saved sheets with automatic `updated_at` timestamps.
- Open a list of all saved sheets and load any sheet into the workspace.
- Pin / unpin sheets so bookmarked sheets appear first (`is_pinned DESC, updated_at DESC`).
- Keep all changes local without pushing to remote.

## 2. Goals & Non-Goals

### Goals
- **Database Schema (`paper_ledgers`)**:
  ```sql
  CREATE TABLE IF NOT EXISTS paper_ledgers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    data TEXT NOT NULL,           -- JSON array string of items
    total_income REAL DEFAULT 0,
    total_expense REAL DEFAULT 0,
    net_total REAL DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,  -- 1 = pinned, 0 = unpinned
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  ```
- **Service Layer (`src/services/paperLedgerService.js`)**:
  - `savePaperLedger({ id, title, items, totalIncome, totalExpense, netTotal, isPinned })`: inserts new or updates existing.
  - `getPaperLedgers()`: queries all records ordered by `is_pinned DESC, updated_at DESC`.
  - `getPaperLedgerById(id)`: fetches single ledger by id.
  - `togglePinPaperLedger(id, isPinned)`: updates `is_pinned` and returns updated state.
  - `deletePaperLedger(id)`: deletes ledger record.
  - `renamePaperLedger(id, newTitle)`: updates title and `updated_at`.
- **UI Components**:
  - **Save Sheet Modal (`PaperSaveSheetModal.js`)**: Prompt for title with validation, defaulting to e.g. "Calculation - 18 Nov 2026" or existing title.
  - **Saved Sheets Modal (`PaperSavedSheetsModal.js`)**:
    - Header with sheet counter and "New Sheet" action.
    - Search bar to filter saved ledgers by title.
    - Pinned badge on top cards; one-tap Pin/Unpin button (Amber `#F59E0B`).
    - Card displays title, net balance badge, item count, and formatted last updated date.
    - Tap to open in Paper Ledger.
    - Delete button with confirmation prompt.
  - **Paper Ledger Screen Toolbar**:
    - "Save" / "Update" button with saved status pill.
    - "Sheets" button with badge showing count of saved sheets.
    - Active sheet title shown in notebook tape with edit pencil and "New" button.

### Non-Goals
- Changing transaction records in the main app `transactions` table.
- Cloud syncing (local SQLite only).
- Running `git push` (must remain local).

## 3. Approaches Considered
- **Approach 1 (Chosen)**: In-Place "Saved Sheets" Modal + Active Sheet Header Bar. Fast, clean, avoids gesture conflicts with app drawer.
- **Approach 2**: Side-over drawer (conflicts with App drawer).
- **Approach 3**: Separate full gallery screen (slower navigation).
