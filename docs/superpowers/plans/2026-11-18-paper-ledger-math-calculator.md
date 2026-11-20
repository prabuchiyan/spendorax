# Paper Ledger Math Calculator & Expression Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to perform inline arithmetic calculations (`+`, `−`, `×`, `÷`, and `%` for percentage) when adding/editing Paper Ledger transactions, with a live preview badge, quick operator toolbar, and formula tag on the ledger paper.

**Architecture:** Create a pure, safe math expression evaluator in `src/utils/mathExpressionParser.js`; add an operator toolbar and live evaluation pill in `src/components/PaperAddRowModal.js`; render formula tags on calculation rows in `src/components/PaperSwipeableRow.js`; and update WhatsApp text export in `src/utils/paperLedgerUtils.js`.

**Tech Stack:** React Native, Expo, Babel, Node.js assert.

**Spec:** `docs/superpowers/specs/2026-11-18-paper-ledger-math-calculator-design.md`

## Global Constraints

- Safe evaluation: No `eval()` or `Function()` constructor.
- Scratchpad behavior: Calculations remain in-memory unless exported.
- Mobile UX: Operator strip eliminates needing to switch keyboards on mobile.
- Percentage logic: `A % B` evaluates as `A * (B / 100)` (e.g. `100 % 25 = 25`).
- Incomplete input while typing: Must not throw exceptions or crash UI.

## Review Focus

1. Evaluates all basic operations: `+`, `−`, `×`, `÷`, `%`, and parentheses `( )`.
2. `100 % 25` correctly evaluates to `25` (25% of 100).
3. Live preview badge displays the real-time result only when an operator is present and expression is valid.
4. Saving preserves the calculated total as `amount` and the expression as `formula`.
5. Swiping left to edit restores the formula into the input.
6. WhatsApp export retains the calculation formula alongside the description.

---

### Task 1: Safe Math Expression Parser Utility

**Files:**
- Create: `src/utils/mathExpressionParser.js`
- Test: `test/test_math_expression_parser.js`

- [x] **Step 1: Write unit tests for math expression parser**
  Create `test/test_math_expression_parser.js` testing:
  - `100 + 25` = 125
  - `100 - 25` = 75
  - `100 / 25` = 4
  - `100 * 5` = 500
  - `100 % 25` = 25
  - `(100 + 25) * 2` = 250
  - Division by zero handling
  - Incomplete expression handling (`100 + ` returns pending/no crash)
  - Unicode operator normalization (`×` to `*`, `÷` to `/`, `−` to `-`)
- [x] **Step 2: Run test to verify failure**
  Run `node test/test_math_expression_parser.js`.
- [x] **Step 3: Implement `src/utils/mathExpressionParser.js`**
  Implement safe tokenizer and shunting-yard / recursive descent evaluator with percentage calculation.
- [x] **Step 4: Verify test passes**
  Run `node test/test_math_expression_parser.js`.
- [x] **Step 5: Commit changes**
  Git commit Task 1.

---

### Task 2: Modal Operator Bar & Live Evaluation

**Files:**
- Modify: `src/components/PaperAddRowModal.js`
- Test: `test/test_paper_add_row_modal_math.js`

- [x] **Step 1: Write test for modal math state and submission**
  Create `test/test_paper_add_row_modal_math.js` testing:
  - Input with formula `100 + 25` outputs `amount: 125, formula: '100 + 25'`.
  - Input with plain number `150` outputs `amount: 150, formula: null`.
  - Restoring `initialItem.formula` when editing.
- [x] **Step 2: Run test to verify failure**
  Run `node test/test_paper_add_row_modal_math.js`.
- [x] **Step 3: Update `PaperAddRowModal.js`**
  - Add quick operator strip (`+`, `−`, `×`, `÷`, `%`, `(`, `)`, `C`) above Amount input.
  - Add live preview pill badge below Amount input (`= ₹<result>`).
  - Update input sanitization to allow arithmetic characters `[0-9. +−×÷*/%()]`.
  - Synchronize `formula` when `initialItem` changes.
  - Return `{ title, type, amount: evaluatedAmount, formula }` on submit.
- [x] **Step 4: Verify test passes & Babel check**
  Run `node test/test_paper_add_row_modal_math.js` and Babel syntax check.
- [x] **Step 5: Commit changes**
  Git commit Task 2.

---

### Task 3: Display Formula Tag on Paper Row & WhatsApp Export

**Files:**
- Modify: `src/components/PaperSwipeableRow.js`
- Modify: `src/utils/paperLedgerUtils.js`
- Test: `test/test_paper_ledger_math_e2e.js`

- [x] **Step 1: Write end-to-end test for paper row formula tag and WhatsApp export**
  Create `test/test_paper_ledger_math_e2e.js` asserting:
  - Rows with `formula` format WhatsApp output with formula details.
  - Net totals compute correctly from evaluated `amount`.
- [x] **Step 2: Run test to verify failure**
  Run `node test/test_paper_ledger_math_e2e.js`.
- [x] **Step 3: Update `PaperSwipeableRow.js` and `paperLedgerUtils.js`**
  - In `PaperSwipeableRow.js`, render a formula badge `🧮 {item.formula}` next to the income/expense badge if `item.formula` is present.
  - In `paperLedgerUtils.js`, update `formatWhatsAppLedgerText` to include `[formula]` when available.
- [x] **Step 4: Run full test suite & Babel AST check**
  Run all test files.
- [x] **Step 5: Commit changes**
  Git commit Task 3.
