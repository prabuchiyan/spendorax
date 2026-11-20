# Design Specification: Paper Ledger Math Calculator & Expression Support

## 1. Intent & Problem Statement
The Paper Ledger functions as a math calculation notebook / scratchpad. When calculating income and expenses, users often need to record figures derived from simple arithmetic:
- Sub-item totals: `100 + 25 = 125`
- Subtractions/discounts: `100 - 25 = 75`
- Unit pricing / multiples: `100 * 5 = 500`
- Splitting / division: `100 / 25 = 4`
- Percentages (e.g. tax, tips, percentage share): `100 % 25 = 25` (25% of 100 = 25)

Rather than forcing users to switch out to an external calculator app, the Paper Ledger should support inline arithmetic expressions with immediate evaluation, quick operator insertion, and formula preservation on the ledger sheet.

## 2. Goals & Non-Goals

### Goals
- **Safe Math Expression Evaluator (`evaluateMathExpression`)**:
  - Pure JS arithmetic parser handling `+`, `-` / `−`, `*` / `×`, `/` / `÷`, `%` (percentage of previous term: `A % B = A * (B / 100)`), and parentheses `( )`.
  - Safely handles division by zero and incomplete expressions during typing without throwing exceptions.
  - Returns `{ isValid, result, expression, hasOperator }`.
- **Add/Edit Modal Operator Bar**:
  - Horizontal strip of quick operator buttons (`+`, `−`, `×`, `÷`, `%`, `(`, `)`, `C`) directly above the amount input so mobile users do not need to switch keyboard modes.
  - Live preview badge showing `= ₹<result>` as the user types.
- **Formula Retention & Display on Paper**:
  - Evaluated numeric amount is stored as `item.amount`.
  - The math formula string is stored as `item.formula`.
  - In `PaperSwipeableRow.js`, if `formula` exists, displays a neat formula tag in the 65% Particulars column (e.g., `🧮 100 + 25`).
- **Edit & WhatsApp Continuity**:
  - When editing a row (swipe left), the formula is restored into the amount input for easy tweaking.
  - In WhatsApp share export, the formula is included alongside the description.

### Non-Goals
- Full scientific calculator features (trigonometry, calculus, etc.).
- Modifying underlying SQLite database schema (in-memory scratchpad).

## 3. Approaches Considered
- **Approach 1 (Chosen)**: Smart Math Input with Quick Operator Toolbar & Live Formula Tag. Clean, mobile-friendly, reinforces the math notebook concept.
- **Approach 2**: Full In-Modal Grid Calculator Pad (occupies too much vertical space on mobile).
- **Approach 3**: Magic parser in title field (unintuitive and risks parsing conflicts).

## 4. Technical Architecture
1. **`src/utils/mathExpressionParser.js`**:
   - `tokenize(expr)`
   - `evaluateMathExpression(expr)`
   - Pure, robust unit-tested implementation.
2. **`src/components/PaperAddRowModal.js`**:
   - Add operator buttons toolbar.
   - Live result badge.
   - Output `{ title, type, amount: evaluatedNumber, formula: exprOrNull }`.
3. **`src/components/PaperSwipeableRow.js`**:
   - Render formula chip/tag when `item.formula` is present.
4. **`src/utils/paperLedgerUtils.js`**:
   - Update WhatsApp formatter to include `item.formula` when present.

