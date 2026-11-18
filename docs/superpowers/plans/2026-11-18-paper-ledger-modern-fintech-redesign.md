# Paper Ledger Modern Fintech UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Paper Ledger UI from an old-fashioned brown/parchment physical notebook into a sleek, 2026 modern fintech calculation card with clean surfaces, modern badge pills, clean column dividers, and a prominent net balance hero summary.

**Architecture:**
- Modernize `PaperSwipeableRow.js`: remove red margin line; add subtle modern divider; modernize income/expense pills and formula badges; polish swipe action indicators.
- Modernize `PaperLedgerScreen.js`: replace brown stitched tape with modern fintech header card; modernize 65%/35% column headers; remove fake empty notebook lines; replace double-rule total row with an elevated Net Balance summary block.
- Maintain 100% backward compatibility with database persistence, pinning, math calculation, WhatsApp export, and multi-selection.

**Tech Stack:** React Native, Expo, SQLite, Babel, Node.js assert.

**Spec:** `docs/superpowers/specs/2026-11-18-paper-ledger-modern-fintech-redesign.md`

## Global Constraints
- Local commits only; **NEVER** run `git push`.
- All clickable file links in chat must use `file:///` format with forward slashes.
- All existing 12+ unit and integration test suites must continue passing.

---

### Task 1: Modernize `PaperSwipeableRow.js`
**Files:**
- Modify: `src/components/PaperSwipeableRow.js`
- Create / Update: `test/test_paper_ledger_modern_ui.js`

- [ ] **Step 1: Write test for modern row styling & elements**
  Create `test/test_paper_ledger_modern_ui.js` asserting modern styling structure, tabular amount format, and pill attributes.
- [ ] **Step 2: Update `PaperSwipeableRow.js`**
  - Replace `redMarginLine` border with a subtle modern divider (`subtleDividerColor`).
  - Style serial index cleanly (`#01`, `#02`, etc.).
  - Polish income (`+ Inflow`) and expense (`− Outflow` or `− Expense`) pills with modern soft colors.
  - Polish formula badge into a clean monospaced calculation chip.
  - Round swipe action reveal indicators into modern action capsules.
- [ ] **Step 3: Verify Babel syntax and unit test**
  Run `node test/test_paper_ledger_modern_ui.js` and Babel syntax check.
- [ ] **Step 4: Local commit Task 1**
  Commit locally: `feat(paper-ledger): modernize swipeable rows with sleek fintech styling` (no push).

---

### Task 2: Modernize `PaperLedgerScreen.js`
**Files:**
- Modify: `src/screens/PaperLedgerScreen.js`

- [ ] **Step 1: Update surface styling & remove retro elements**
  - Replace parchment paper backgrounds with pure elevated card surfaces (`#FFFFFF` in light, `#131926` in dark).
  - Remove brown binding tape and white stitch dots; replace with modern sleek header card.
  - Modernize sheet title pill, inline edit button, `+ New` button pill, and count badge.
- [ ] **Step 2: Modernize column headers and empty state**
  - Update 65% / 35% header to `TRANSACTION / FORMULA` and `AMOUNT` with clean letter spacing and subtle divider.
  - Modernize empty state with clean icon and typography.
  - Remove fake blank notebook ruled lines.
- [ ] **Step 3: Build Modern Fintech Net Balance Hero Summary**
  - Replace double-line ledger footer with a modern hero summary block:
    - Side-by-side Inflow and Outflow breakdown pills.
    - Large Net Balance display with dynamic color (`#10B981` positive, `#F43F5E` negative) and status pill (`Surplus`, `Deficit`, `Balanced`).
- [ ] **Step 4: Verify Babel syntax & run test suite**
  Run all test suites including `test_paper_ledger_db_e2e.js` and `test_paper_ledger_modern_ui.js`.
- [ ] **Step 5: Local commit Task 2**
  Commit locally: `feat(paper-ledger): redesign paper ledger with modern fintech card and summary hero` (no push).

---

### Task 3: Full End-to-End Regression Verification
**Files:**
- All test suites in `test/`

- [ ] **Step 1: Run all test suites across the project**
  Ensure all DB persistence, pinning, math expression, swipe, and modal tests pass 100%.
- [ ] **Step 2: Present final verification to user**
  Summarize changes and provide local verification guide.
