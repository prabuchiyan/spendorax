# Design Document: Paper Ledger (Math Calculation Book Screen)

**Date**: 2026-11-17  
**Status**: Pending Approval  
**Topic**: Paper Ledger / Math Calculation Book Screen (`PaperLedgerScreen.js`)

---

## 1. Intent & Context
Users often want a quick, scratchpad-style ledger that looks and feels like a classic physical math calculation notebook (ruled paper with an 80/20 vertical margin line). 
On this screen, users can:
1. Import existing transactions from SpendoraX month-by-month (or all available months) to calculate totals.
2. Add custom ad-hoc income and expense items on the fly.
3. Delete individual transaction rows as needed.
4. View real-time net calculation `(Income - Expenses)` at the bottom right margin.
5. Share the formatted breakdown and total directly to WhatsApp text.
6. Access this screen easily from the drawer menu under the intuitive name **"Paper Ledger"**.

Currently, this is a scratchpad/calculation tool that does not alter or mutate the main SQLite database, but its data model is structured cleanly so database saving/loading can be attached in the future without breaking changes.

---

## 2. Goals & Non-Goals

### Goals
- **Ruled Notebook Aesthetic**: Authentic math ledger paper design (cream/off-white sheet with subtle horizontal lines, dark mode counterpart, top binder/header tape, and a distinct vertical rule dividing the 80% description column and 20% amount column).
- **80% / 20% Split Column Layout**:
  - **80% Left Column**: Row serial number, transaction title/note, income/expense pill tag or visual indicator.
  - **20% Right Column**: Formatted numeric amount (`₹` currency formatted, income in green/positive, expense in red/negative).
  - **Bottom Row**: Horizontal dividing rule with continuous 80/20 vertical divide: `Total` on the left 80% and Net Balance `(Total Income - Total Expense)` on the right 20%.
- **Import Existing Transactions**:
  - "Import Month" picker modal / sheet displaying available months with transaction counts.
  - Option to append transactions month-by-month or load all.
  - Automatically maps type (`income` vs `expense`), note/category name, and amount.
- **Custom Line Entry**:
  - Quick "+ Add Line" modal or bottom bar to jot down a custom calculation entry (Title, Type: Income/Expense, Amount).
- **Row Deletion**:
  - Ability to delete any row with immediate net total recalculation.
  - Swipe or trash icon action on each row.
- **WhatsApp Share**:
  - Formats transactions and net total into a clean WhatsApp text format and triggers `Linking.openURL('whatsapp://send?text=...')` with fallback to web WhatsApp / share sheet.
- **Drawer Navigation**:
  - Add "Paper Ledger" to `DrawerNavigator.js` menu with icon `notebook-edit-outline`.
  - Register `PaperLedger` in `App.js` Stack / Drawer navigation.

### Non-Goals
- Directly writing/updating back to the SQLite `transactions` table (it is explicitly a scratchpad calculation screen; database mutations are left for a future persistence update).
- Multi-currency conversions on the same page.

---

## 3. Approaches Considered & Selected

- **Approach 1 (Selected): Interactive Ruled Notebook Ledger**:
  - Direct on-paper view with floating or header actions for "Import Month", "+ Add Row", "Clear", and "Share".
  - High fidelity notebook appearance with seamless row deletions and dynamic recalculations.
- **Approach 2 (Discarded): Dual-Tab Setup**:
  - Tab 1 for raw selection and Tab 2 for paper render. Adds unnecessary tapping friction.
- **Approach 3 (Discarded): Freeform Monospace Text**:
  - Markdown-based text parsing. Fragile to typing mistakes on mobile keyboards.

---

## 4. Detailed Component & UI/UX Design

### A. Screen Architecture (`src/screens/PaperLedgerScreen.js`)
1. **Header Toolbar**:
   - Navigation drawer menu button (standard SpendoraX header).
   - Action buttons: "Import Month" (calendar-plus icon), "Clear All" (refresh/trash icon), and "WhatsApp Share" (whatsapp/share icon).
2. **Notebook Paper Canvas**:
   - Paper container with realistic subtle border/shadow, cream background `#FDFBF7` (or dark slate `#1E222B` in dark mode).
   - Horizontal ruled guide lines (`#E5E0D8` / dark `#2D323F`).
   - Vertical dividing rule at `80%` width (`#D97706` amber/leather or `#EF4444` red margin line).
3. **Transaction List (80% / 20%)**:
   - **80% Left**:
     - Serial number: `1)`, `2)`, etc.
     - Title / Notes (e.g. `Salary`, `Groceries`, `Electricity Bill`).
     - Badge / Dot for Income (`+`) vs Expense (`-`).
     - Delete button (trash icon or quick action).
   - **20% Right**:
     - Amount aligned to the right (e.g. `₹5,000`, `-₹1,200`).
4. **Bottom Calculation Footer**:
   - Pinned at the bottom of the paper sheet.
   - 80% Left: `Total (Income - Expenses)` with item count.
   - 20% Right: Net Total amount in bold, color-coded (green if >= 0, red if < 0).
5. **Add Row Dialog / Bottom Sheet**:
   - Quick input: Description / Title.
   - Type selector: Income (`+`) or Expense (`-`).
   - Amount input with numpad.
   - "Add to Paper" button.
6. **Month Picker Modal**:
   - Fetches available months using `getAvailableMonths()` from `transactions.js`.
   - Lists months with year (e.g. "November 2026", "October 2026").
   - Selecting a month fetches and appends its transactions to the calculation sheet.

---

## 5. WhatsApp Sharing Format

The formatted string sent to WhatsApp:
```text
📓 *SpendoraX - Paper Ledger*
📅 Date: 17 Nov 2026
-----------------------------------
1) Salary (Income)          |  ₹50,000
2) Rent (Expense)           | -₹15,000
3) Groceries (Expense)      |  -₹4,200
4) Bonus (Income)           |  ₹10,000
-----------------------------------
*Total (Net)*               |  *₹40,800*
-----------------------------------
Generated from SpendoraX Paper Ledger
```

---

## 6. Navigation & Naming
- **Route Name**: `PaperLedger`
- **Menu Label**: `Paper Ledger`
- **Icon**: `notebook-edit-outline` (active: `notebook-edit`)
- **Placement**: Under `Transactions` in `DrawerNavigator.js`.

