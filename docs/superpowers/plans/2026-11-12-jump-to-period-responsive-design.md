# Jump to Period Cycle Responsive Fixed Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a responsive, fixed 2-column cycle grid and mobile-adaptive container layout for the "Jump to Period" modal in `BillDetailScreen.js` to ensure consistent, unclipped rendering across all mobile screen sizes.

**Architecture:** 
1. Pass the currently selected/active bill occurrence ID to `YearQuickJumpModal` to enable active cycle identification.
2. Refactor the month cycles container in `YearQuickJumpModal` from an irregular wrap-stretched layout into a predictable 2-column fixed card grid (each item ~48.5% width) with dual-row content (status dot, month, and badge on row 1; formatted currency amount and status text on row 2).
3. Update the modal card and overlay styles with responsive padding and containment so narrow phones (320px–360px) and standard/large devices (375px–430px+) maintain balanced proportions.

**Tech Stack:** React Native, Expo, React Native Paper, `@expo/vector-icons` (`MaterialCommunityIcons`).

**Spec:** [`docs/superpowers/specs/2026-11-12-jump-to-period-responsive-design.md`](file:///c:/Users/Prabu.S/Prabuchiyan/spendorax/docs/superpowers/specs/2026-11-12-jump-to-period-responsive-design.md)

## Global Constraints
- Preserve existing jump calculations (`handleJumpToOccurrence`) and occurrence selection behavior.
- Support both Light and Dark themes seamlessly via `useTheme()`.
- Ensure currency amounts and month names never truncate with ellipsis on compact screens (>=320px).
- Zero broken single-child stretching (no `flexGrow: 1` stretching odd-numbered cycle items across full widths).

## Review Focus
1. **Odd number of cycles in year (e.g., 1, 3, 5, 7, 11 cycles):** The last cycle must remain strictly in its 50% column and never stretch to 100% width.
2. **Compact mobile viewports (320px–360px):** Formatted currency values (e.g. `₹15,000.00`) and month names must fit comfortably without overlapping or clipping.
3. **Current cycle visual indication:** The active occurrence must display an active highlight (accent border, subtle tint, and "Current" badge) so users know their current position.
4. **Many years available (> 4 years):** Year selector pills must wrap or scroll cleanly without breaking row alignments.
5. **Dismissal and re-opening:** Modal must open with the active bill's year pre-selected and dismiss without unexpected state retention.

---

### Task 1: Pass Active Occurrence ID to `YearQuickJumpModal`

**Files:**
- Modify: `src/screens/BillDetailScreen.js:1838-1850`

**Interfaces:**
- Consumes: `activeBill?.id`
- Produces: `activeOccurrenceId` prop passed into `YearQuickJumpModal`

- [ ] **Step 1: Update modal JSX invocation in `BillDetailScreen.js`**
  Pass `activeOccurrenceId={activeBill?.id}` into `<YearQuickJumpModal ... />`.

- [ ] **Step 2: Verify Babel transpile**
  Run `node -e "const babel = require('@babel/core'); babel.transformFileSync('src/screens/BillDetailScreen.js', { presets: ['babel-preset-expo'] }); console.log('Transpiled Task 1 successfully');"`
  Expected: PASS

---

### Task 2: Refactor `YearQuickJumpModal` Component Structure

**Files:**
- Modify: `src/screens/BillDetailScreen.js:240-475`

**Interfaces:**
- Consumes: `visible`, `onClose`, `series`, `availableYears`, `yearGroups`, `activeYear`, `activeOccurrenceId`, `onSelectOccurrence`
- Produces: Refactored `YearQuickJumpModal` with fixed 2-column cycle cards, active cycle indicator, and responsive year selector

- [ ] **Step 1: Update component signature and state**
  Accept `activeOccurrenceId` in `YearQuickJumpModal({ visible, onClose, series, availableYears, yearGroups, activeYear, activeOccurrenceId, onSelectOccurrence })`.

- [ ] **Step 2: Restructure cycle cards with dual-row layout**
  For each cycle in `monthsInSelectedYear`:
  - Check `isCurrentOcc = Number(occ.id) === Number(activeOccurrenceId)`.
  - Row 1: Status dot + Month Name (plus day number if bi-weekly/weekly) + "Current" pill or checkmark if paid.
  - Row 2: Formatted currency amount + status text ("Paid", "Due", "Skipped").

- [ ] **Step 3: Update Year selector container**
  Ensure year pills render in a clean responsive wrap grid with uniform padding and touch targets.

- [ ] **Step 4: Verify Babel transpile**
  Run `node -e "const babel = require('@babel/core'); babel.transformFileSync('src/screens/BillDetailScreen.js', { presets: ['babel-preset-expo'] }); console.log('Transpiled Task 2 successfully');"`
  Expected: PASS

---

### Task 3: Refactor Jump Modal Responsive Styles in `BillDetailScreen.js`

**Files:**
- Modify: `src/screens/BillDetailScreen.js:2770-2920`

**Interfaces:**
- Consumes: StyleSheet definitions
- Produces: Polished responsive styles for `jumpModalCard`, `monthChipsGrid`, `monthChipBtn`, `cycleCardHeader`, `cycleCardFooter`, `yearGridBtn`, `jumpShortcutBtn`

- [ ] **Step 1: Replace flexible/unstable styles with fixed responsive 2-column styles**
  - Set `monthChipsGrid` with `flexDirection: "row"`, `flexWrap: "wrap"`, `justifyContent: "space-between"`, `rowGap: 8`.
  - Set `monthChipBtn` to `width: "48.5%"`, removing `minWidth: "29%"` and `flexGrow: 1`.
  - Add styles for `cycleCardHeader`, `cycleMonthText`, `cycleCurrentBadge`, `cycleCurrentBadgeText`, `cycleCardFooter`, `cycleAmountText`, `cycleStatusText`.
  - Adjust `jumpModalCard` padding and max constraints for compact screen resilience.

- [ ] **Step 2: Verify Babel transpile**
  Run `node -e "const babel = require('@babel/core'); babel.transformFileSync('src/screens/BillDetailScreen.js', { presets: ['babel-preset-expo'] }); console.log('Transpiled Task 3 successfully');"`
  Expected: PASS

---

### Task 4: Automated Verification Script & Layout Verification

**Files:**
- Create: `scratch/verify-jump-responsive.js`

**Interfaces:**
- Consumes: `src/screens/BillDetailScreen.js`
- Produces: Automated verification test assertions for 2-column math, Babel transpilation, and component properties

- [ ] **Step 1: Create verification script**
  Verify that:
  - `activeOccurrenceId` is passed and handled.
  - `monthChipBtn` has fixed 2-column percentage (`width: "48.5%"`) and no `flexGrow: 1`.
  - Babel compiles `src/screens/BillDetailScreen.js` with zero errors.
  - 2-column layout width calculation fits on 320px, 360px, 375px, and 414px mobile widths without truncation.

- [ ] **Step 2: Run verification script**
  Run `node scratch/verify-jump-responsive.js`
  Expected: All checks pass.

