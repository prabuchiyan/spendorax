# Paper Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a realistic math calculation book / paper ledger screen with an 80%/20% split layout, month-by-month transaction importing, custom income/expense scratchpad entry, row deletion, net calculation (Income - Expenses), WhatsApp text sharing, and drawer menu integration.

**Architecture:** 
1. Utility layer (`src/utils/paperLedgerUtils.js`) provides pure functions for net balance computation, WhatsApp message formatting, and mapping SQLite transactions to paper ledger items.
2. Reusable UI components (`src/components/PaperAddRowModal.js`, `src/components/PaperMonthPickerModal.js`) handle user input for adding ad-hoc lines and picking transaction months.
3. The main screen (`src/screens/PaperLedgerScreen.js`) implements an authentic ruled math ledger paper layout with a continuous 80/20 vertical divider, row-level deletion, real-time totals, and WhatsApp share actions.
4. Navigation integration in `navigation/DrawerNavigator.js` and `App.js` exposes "Paper Ledger" in the drawer menu.

**Tech Stack:** React Native, Expo SDK 51, `@expo/vector-icons`, `react-native-paper`, React Navigation.

**Spec:** [docs/superpowers/specs/2026-11-17-paper-ledger-screen-design.md](file:///c:/Users/Prabu.S/Prabuchiyan\spendorax\docs\superpowers\specs\2026-11-17-paper-ledger-screen-design.md)

## Global Constraints
- React Native 0.74.5, Expo SDK 51.
- Split screen: 80% left column (description & item details) and 20% right column (amounts).
- Bottom calculation line: Total on left, Net Balance `(Income - Expenses)` on the 20% right column.
- Row deletion: user can delete any entire transaction row with instant total recalculation.
- No direct database writes (pure scratchpad calculation screen).
- WhatsApp sharing: clean text export with aligned columns, numbered transactions, and net total.
- Drawer menu entry: "Paper Ledger" with `notebook-edit-outline` icon.

## Review Focus
1. **Net Balance Calculation with Mixed Types**: Adding incomes and expenses must correctly calculate `sum(incomes) - sum(expenses)`, handling zero, negative balances, and decimal amounts accurately.
2. **Empty & Single-Item Ledger State**: When all items are deleted or the ledger is cleared, total must show 0.00 without errors or layout shifts.
3. **WhatsApp Text Alignment & Special Characters**: Notes with spaces, emojis, or punctuation must format cleanly into the WhatsApp share text without breaking line columns or URL encoding.
4. **Month Import Duplication & Accumulation**: Importing a month multiple times or importing different months should either append or give clear control without corrupting item serial numbers.
5. **Theme Support**: The paper look (cream paper in light mode, dark slate ledger in dark mode) must maintain strong contrast for text, red/amber margin rules, and amounts.

---

### Task 1: Paper Ledger Calculation & WhatsApp Sharing Utilities

**Files:**
- Create: `src/utils/paperLedgerUtils.js`
- Create: `test/test_paper_ledger_utils.js`

**Interfaces:**
- Consumes: Standard JS Math & String utilities.
- Produces:
  - `calculateLedgerTotals(items: Array<{ type: string, amount: number | string }>) -> { totalIncome: number, totalExpense: number, netTotal: number }`
  - `formatWhatsAppLedgerText(items: Array<{ title: string, type: string, amount: number }>, netTotal: number) -> string`
  - `mapDbTransactionsToPaperItems(transactions: Array<Object>) -> Array<{ id: string, title: string, type: 'income' | 'expense', amount: number, originalId?: number }>`

- [ ] **Step 1: Write test for calculation and WhatsApp formatting**

```javascript
// test/test_paper_ledger_utils.js
const assert = require('assert');
const {
  calculateLedgerTotals,
  formatWhatsAppLedgerText,
  mapDbTransactionsToPaperItems
} = require('../src/utils/paperLedgerUtils');

// 1. Test calculation
const sampleItems = [
  { id: '1', title: 'Salary', type: 'income', amount: 5000 },
  { id: '2', title: 'Rent', type: 'expense', amount: 1500 },
  { id: '3', title: 'Groceries', type: 'expense', amount: 500 },
];

const totals = calculateLedgerTotals(sampleItems);
assert.strictEqual(totals.totalIncome, 5000);
assert.strictEqual(totals.totalExpense, 2000);
assert.strictEqual(totals.netTotal, 3000);

// 2. Test empty items
const emptyTotals = calculateLedgerTotals([]);
assert.strictEqual(emptyTotals.netTotal, 0);

// 3. Test negative net total
const deficitItems = [
  { id: '1', title: 'Bill', type: 'expense', amount: 800 }
];
assert.strictEqual(calculateLedgerTotals(deficitItems).netTotal, -800);

// 4. Test WhatsApp formatting
const shareText = formatWhatsAppLedgerText(sampleItems, 3000);
assert.ok(shareText.includes('Paper Ledger'));
assert.ok(shareText.includes('1) Salary'));
assert.ok(shareText.includes('3) Groceries'));
assert.ok(shareText.includes('3,000') || shareText.includes('3000'));

// 5. Test DB transaction mapping
const dbTxs = [
  { id: 101, type: 'income', amount: 1200, notes: 'Freelance' },
  { id: 102, type: 'expense', amount: 300, category_name: 'Food', notes: null }
];
const mapped = mapDbTransactionsToPaperItems(dbTxs);
assert.strictEqual(mapped.length, 2);
assert.strictEqual(mapped[0].title, 'Freelance');
assert.strictEqual(mapped[0].type, 'income');
assert.strictEqual(mapped[0].amount, 1200);
assert.strictEqual(mapped[1].title, 'Food');

console.log('Task 1 tests passed successfully!');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/test_paper_ledger_utils.js`  
Expected: FAIL with "Cannot find module '../src/utils/paperLedgerUtils'"

- [ ] **Step 3: Implement `src/utils/paperLedgerUtils.js`**

Implement `calculateLedgerTotals`, `formatWhatsAppLedgerText`, and `mapDbTransactionsToPaperItems`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/test_paper_ledger_utils.js`  
Expected: PASS with "Task 1 tests passed successfully!"

---

### Task 2: Modals for Adding Custom Line & Importing Month

**Files:**
- Create: `src/components/PaperAddRowModal.js`
- Create: `src/components/PaperMonthPickerModal.js`

**Interfaces:**
- `PaperAddRowModal`:
  - Props: `visible: boolean`, `onClose: () => void`, `onAdd: ({ title, type, amount }) => void`
- `PaperMonthPickerModal`:
  - Props: `visible: boolean`, `months: Array<string>`, `onClose: () => void`, `onSelectMonth: (monthStr: string) => void`, `onSelectAll?: () => void`

- [ ] **Step 1: Implement `src/components/PaperAddRowModal.js`**
  - Text input for Description / Item Name.
  - Type toggle between Income (`+`) and Expense (`-`).
  - Numeric input for Amount with validation (> 0).
  - Clean Paper dialog / sheet styling supporting Light & Dark mode.

- [ ] **Step 2: Implement `src/components/PaperMonthPickerModal.js`**
  - Lists available months formatted as "MMMM YYYY" (e.g., "November 2026").
  - Quick action to "Import All Transactions" or pick an individual month.
  - Loading indicator while fetching transactions.

- [ ] **Step 3: Verify components compile cleanly**

Run node verification script to confirm exports and syntax.

---

### Task 3: Paper Ledger Screen Implementation (`PaperLedgerScreen.js`)

**Files:**
- Create: `src/screens/PaperLedgerScreen.js`

**Interfaces:**
- Screen Component registered in Navigation.
- State:
  - `items`: Array of `{ id, title, type, amount, date? }`
  - `isAddModalVisible`: boolean
  - `isMonthModalVisible`: boolean
  - `availableMonths`: Array<string>
  - `loading`: boolean
- Features:
  - Ruled paper container with notebook margin line at 80% width.
  - Left 80%: serial number `index + 1) `, title/description, income/expense badge, delete row button with trash icon.
  - Right 20%: amount aligned to right, formatted with currency symbol and type indicator (`+` green, `-` red).
  - Bottom Footer: Fixed at the bottom of the paper sheet, dividing 80% "Total (Income - Expenses)" and 20% Net Total amount.
  - Header actions:
    - "Import Month" (calendar-import)
    - "+ Add Entry" (plus)
    - "Clear" (delete-sweep)
    - "Share to WhatsApp" (whatsapp)
  - WhatsApp share action:
    - Calls `formatWhatsAppLedgerText`.
    - Opens `whatsapp://send?text=${encodeURIComponent(text)}` with fallback to `https://api.whatsapp.com/send?text=...` or standard `Share.share`.

- [ ] **Step 1: Implement `PaperLedgerScreen.js`**
  - Implement full layout, theme adaptation, 80/20 grid, row rendering, and action handlers.

- [ ] **Step 2: Verify syntax and module resolution**

Run: `node -e "require('./src/screens/PaperLedgerScreen')"` or syntax verification.

---

### Task 4: Navigation Integration (Drawer & App Stack)

**Files:**
- Modify: `navigation/DrawerNavigator.js`
- Modify: `App.js`

**Interfaces:**
- Drawer navigation menu item:
  - `name: 'PaperLedger'`
  - `label: 'Paper Ledger'`
  - `icon: 'notebook-edit-outline'`
  - `activeIcon: 'notebook-edit'`
- Stack navigation screen in `App.js` (for direct routing/linking).

- [ ] **Step 1: Add Paper Ledger to `DrawerNavigator.js`**
  - Add to `menuItems` array right after `Transactions`.
  - Add `<Drawer.Screen name="PaperLedger" component={PaperLedgerScreen} options={{ title: 'Paper Ledger' }} />`.

- [ ] **Step 2: Add Stack Screen in `App.js`**
  - Register `<Stack.Screen name="PaperLedger" component={PaperLedgerScreen} options={{ title: 'Paper Ledger' }} />`.

- [ ] **Step 3: Verification of drawer and app configuration**

Run node verification script to ensure both files compile and export properly without syntax errors.

---

### Task 5: End-to-End Verification & Polish

**Files:**
- Test: `test/test_paper_ledger_e2e.js`

- [ ] **Step 1: Write and run verification script checking:**
  - Net balance with multiple transactions.
  - Row deletion recalculation.
  - WhatsApp formatting completeness and URL safety.
  - Empty state calculations.
  - Month loading and item mapping.

- [ ] **Step 2: Verify app bundling / syntax integrity**

Run `expo doctor` or node checks to verify no dependency or syntax issues.
