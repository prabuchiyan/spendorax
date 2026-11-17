# Bill Details: Payment Sync, Unskip Modal, Skip Loader & Occurrence Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement robust full/partial payment synchronization, create an `UnskipBillModal` with cycle info, add skip loading state with sibling button disabling, and fix default occurrence selection to prioritize current month / previous unpaid cycles.

**Architecture:**
1. In `src/services/bills.js` and `billUtils.js`, unify payment status syncing via `syncBillPaymentStatus` so that linking payments (either from `BillDetailScreen` or `TransactionAdd`/`LinkedBillCard`) correctly records `'partially_paid'` or `'paid'` in SQLite and computes `paid_amount` across all reads.
2. Create `src/components/UnskipBillModal.js` styled identically to `SkipBillModal.js` with cycle information, warning notice, and confirm button.
3. Wire loading states in `SkipBillModal.js`, `BillDetailScreen.js`, and `BillsScreen.js` to render the spinner inside the button and disable all cancellation and sibling actions during execution.
4. Implement the occurrence selection hierarchy in `BillDetailScreen.js` and `BillsScreen.js` so that current month defaults when unpaid, previous unpaid defaults when current is settled, and historical template `s[0]` is never erroneously selected.

**Tech Stack:** React Native, Expo, React Native Paper, SQLite, `@expo/vector-icons` (`MaterialCommunityIcons`).

**Spec:** [`docs/superpowers/specs/2026-11-12-bill-details-payment-skip-selection-fixes.md`](file:///c:/Users/Prabu.S/Prabuchiyan/spendorax/docs/superpowers/specs/2026-11-12-bill-details-payment-skip-selection-fixes.md)

## Global Constraints
- Preserve existing database schema and table structures.
- Support Dark and Light themes seamlessly across all modal and card states.
- Follow the user rule: When both previous month and current month are unpaid, current month takes default precedence.
- Zero uncaught promises or unhandled rejections during background async operations.

## Review Focus
1. **Partial payment linking:** Linking a transaction whose amount is less than the bill amount must mark the bill as `partially_paid` with non-zero `paid_amount`, and NOT mark it as fully paid.
2. **Full payment linking:** Linking a transaction whose amount is $\ge$ bill amount (or multiple transactions summing to $\ge$ bill amount) must mark the bill as `paid` and hide the "Mark as Paid" action.
3. **Unskip confirmation flow:** Tapping "Unskip" must open `UnskipBillModal` with accurate cycle date, amount, and recurrence; confirming must reactivate the cycle to pending.
4. **Skip loading state:** Confirming a skip must immediately show a spinner inside the button and prevent backdrop dismissal or double-clicking.
5. **Screen launch occurrence selection:** Opening a recurring bill series must default to the current month occurrence (or previous unpaid occurrence if current is paid/skipped), and never default to the oldest historical cycle `s[0]`.

---

### Task 1: Fix Partial vs. Full Payment Sync in `bills.js` and `billUtils.js`

**Files:**
- Modify: `src/services/bills.js:337-420` (`syncBillPaymentStatus`)
- Modify: `src/services/bills.js:1638-1645` (`getBillById`)
- Modify: `src/services/bills.js:1760-1780` (`getBillSeries`)
- Modify: `src/services/bills.js:3272-3305` (`linkAdditionalTransaction`)
- Modify: `src/services/billUtils.js:134-165` (`getBillDisplayStatus`)

**Interfaces:**
- Consumes: `billId`, `transactionId`
- Produces: Correct `status` ('paid' vs 'partially_paid' vs 'pending') and enriched `paid_amount` fields on all returned bill objects

- [ ] **Step 1: Update `linkAdditionalTransaction` in `bills.js`**
  Add transaction link to junction table and call `await syncBillPaymentStatus(billId)` instead of hardcoded `status = 'paid'`.

- [ ] **Step 2: Update `syncBillPaymentStatus` in `bills.js`**
  When `totalPaid > 0 && totalPaid < billAmount`, update SQLite `status = 'partially_paid'`, `is_paid = 0`.
  When `totalPaid >= billAmount`, update SQLite `status = 'paid'`, `is_paid = 1`.

- [ ] **Step 3: Enrich `getBillById` and `getBillSeries` with `paid_amount` and `status`**
  Ensure all reads calculate and return `paid_amount`, `is_partially_paid`, and `is_completely_paid`.

- [ ] **Step 4: Update `getBillDisplayStatus` in `billUtils.js`**
  Accurately check for partially paid status based on `paid_amount` and `status`.

- [ ] **Step 5: Verify Babel compile**
  Run `node -e "const babel = require('@babel/core'); babel.transformFileSync('src/services/bills.js'); console.log('bills.js passed');"`

---

### Task 2: Build `UnskipBillModal` Component

**Files:**
- Create: `src/components/UnskipBillModal.js`

**Interfaces:**
- Consumes: `visible`, `bill`, `onCancel`, `onConfirm`, `loading`
- Produces: Themed confirmation modal for unskipping a bill occurrence with informative breakdown

- [ ] **Step 1: Implement `UnskipBillModal.js`**
  - Header badge with `undo-variant` blue icon circle.
  - Title "Unskip Bill Occurrence" and subtitle.
  - Summary card displaying bill name, recurrence badge, due date, and amount.
  - Reactivation notice card explaining status restoration.
  - Cancel ("Keep Skipped") and Confirm ("Unskip Bill") buttons with loading spinner support.

- [ ] **Step 2: Verify Babel compile**
  Run `node -e "const babel = require('@babel/core'); babel.transformFileSync('src/components/UnskipBillModal.js', { presets: ['babel-preset-expo'] }); console.log('UnskipBillModal.js passed');"`

---

### Task 3: Implement Skip Button Loading & Sibling Button Disabling

**Files:**
- Modify: `src/components/SkipBillModal.js:330-365`
- Modify: `src/screens/BillDetailScreen.js:1695-1715` (skip confirm logic)
- Modify: `src/screens/BillsScreen.js:1360-1380` (skip confirm logic)

**Interfaces:**
- Consumes: `loading` prop in `SkipBillModal`
- Produces: Active spinner on confirm button, disabled cancel button, disabled backdrop, and disabled dock buttons

- [ ] **Step 1: Ensure `SkipBillModal` disables backdrop and cancel button when `loading`**
  Verify backdrop and cancel button have `disabled={loading}`.

- [ ] **Step 2: Add `isSkipping` state to `BillDetailScreen.js`**
  Pass `loading={isSkipping}` to `SkipBillModal`. Set `isSkipping(true)` during `onConfirm` and disable bottom dock buttons during skip.

- [ ] **Step 3: Add `isSkipping` state to `BillsScreen.js`**
  Pass `loading={isSkipping}` to `SkipBillModal`. Set `isSkipping(true)` during `onConfirm` and reset in `finally`.

- [ ] **Step 4: Verify Babel compile**
  Run `node -e "const babel = require('@babel/core'); babel.transformFileSync('src/screens/BillsScreen.js', { presets: ['babel-preset-expo'] }); console.log('BillsScreen.js passed');"`

---

### Task 4: Fix Default Occurrence Selection & Payment Highlighting in `BillDetailScreen.js`

**Files:**
- Modify: `src/screens/BillsScreen.js:350-355` (`openDetail`)
- Modify: `src/screens/BillDetailScreen.js:940-985` (`load()` occurrence selection)
- Modify: `src/screens/BillDetailScreen.js:1080-1095` (`handleUnskip` wiring)
- Modify: `src/screens/BillDetailScreen.js:1340-1430` (Hero status pill & paid amount highlight)
- Modify: `src/screens/BillDetailScreen.js:1890-1940` (Dock action buttons & `UnskipBillModal` integration)
- Modify: `src/screens/BillDetailScreen.js:2340-2360` (Hero status pill partially paid styles)

**Interfaces:**
- Consumes: `occurrenceId`, `billId`, `series`
- Produces: Unskip modal integration, correct default occurrence selection, and blue highlight for partially paid bills

- [ ] **Step 1: Update `openDetail` in `BillsScreen.js`**
  Pass `occurrenceId: bill._displayOccurrenceId || (bill._isRecurringSeries ? bill.id : undefined)`.

- [ ] **Step 2: Refactor default occurrence selection in `BillDetailScreen.js`**
  Implement the user rule: Current month takes default precedence when unpaid; if current month is paid/skipped, select the most recent previous unpaid cycle. Never select `s[0]` if `s.length > 1`.

- [ ] **Step 3: Integrate `UnskipBillModal` in `BillDetailScreen.js`**
  Import `UnskipBillModal`. Wire dock "Unskip" button to open modal; implement `onConfirm` with loading state.

- [ ] **Step 4: Add Partially Paid Hero Pill & Styling in `BillDetailScreen.js`**
  Add `styles.heroStatusPillPartiallyPaid` and render "Partially Paid" with `progress-check` icon and blue theme accents.

- [ ] **Step 5: Verify Babel compile**
  Run `node -e "const babel = require('@babel/core'); babel.transformFileSync('src/screens/BillDetailScreen.js', { presets: ['babel-preset-expo'] }); console.log('BillDetailScreen.js passed');"`

---

### Task 5: Automated Verification Script & Validation

**Files:**
- Create: `scratch/verify-payment-skip-selection.js`

**Interfaces:**
- Consumes: `bills.js`, `billUtils.js`, `BillDetailScreen.js`, `BillsScreen.js`, `UnskipBillModal.js`
- Produces: End-to-end automated unit assertions for payment calculation, unskip modal presence, skip loader props, and occurrence selection logic

- [ ] **Step 1: Create verification script**
  Test:
  1. `syncBillPaymentStatus` calculates partially paid vs paid correctly.
  2. `getBillDisplayStatus` accurately identifies "Partially Paid" vs "Paid".
  3. `UnskipBillModal` exists and compiles cleanly.
  4. `BillDetailScreen.js` and `BillsScreen.js` pass `loading={isSkipping}`.
  5. Default occurrence selection selects current month when unpaid and previous unpaid when current is settled.

- [ ] **Step 2: Run verification script**
  Run `node scratch/verify-payment-skip-selection.js`
  Expected: All checks pass.

