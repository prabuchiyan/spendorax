# Bill History Graph Year Quick-Jump Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an interactive Year Quick-Jump pill and modal on the Bill Details screen so users can jump to any year or month in their bill's history in 1–2 taps.

**Architecture:**
1. In `src/screens/BillDetailScreen.js`, derive available years and occurrence-to-year mappings from `series`.
2. Add a Year Quick-Jump Pill in the Billing History section header that displays the currently visible year range and opens the modal.
3. Build `YearQuickJumpModal` containing "Oldest" / "Latest" quick action shortcuts, a year selector grid, and month sub-chips.
4. Calculate the optimal `chartOffset` upon selection to center the target occurrence in the 5-item chart window, select that occurrence, and load its status and linked transactions.

**Tech Stack:** React Native, Expo, React Native Paper, `@expo/vector-icons` (`MaterialCommunityIcons`).

**Spec:** [`docs/superpowers/specs/2026-11-11-bill-history-year-quick-jump-design.md`](file:///c:/Users/Prabu.S/Prabuchiyan/spendorax/docs/superpowers/specs/2026-11-11-bill-history-year-quick-jump-design.md)

## Global Constraints
- Preserve all existing chart rendering, bar tap behavior, and reconciliation footer.
- The 5-bar layout of `PremiumRoundedBarChart` remains unchanged.
- Seamless Dark and Light theme styling via `useTheme()`.
- Clean error boundary and fallbacks when a bill has few or single occurrences.

## Review Focus
1. **Bills spanning few cycles (<= 5 cycles):** Pill should either display the single year without opening or disable cleanly when no scrolling is possible.
2. **Oldest / Latest boundary jumps:** Jumping to oldest (e.g. index 0) or latest (last index) must clamp `chartOffset` strictly to valid ranges `[0, series.length - 5]`.
3. **Active occurrence selection:** Choosing a year or month must update `selectedOcc`, `selectedLabel`, `chartOffset`, and linked transactions simultaneously.
4. **Dark mode contrast:** Year pills, month chips, and modal backgrounds must remain crisp and readable in dark and light modes.
5. **Dismissal without selection:** Closing the modal via backdrop or close button must not alter the current chart scroll offset or selection.

---

### Task 1: Derive Available Years & Visible Year in `BillDetailScreen.js`

**Files:**
- Modify: `src/screens/BillDetailScreen.js:520-560`

**Interfaces:**
- Consumes: `series`, `displayChartData`, `chartOffset`
- Produces: `availableYears` (sorted descending), `visibleYearLabel`, `yearGroups` (occurrences grouped by year)

- [ ] **Step 1: Compute `yearGroups` and `availableYears`**
  Group `series` occurrences by `getFullYear()` of `due_date` and compute unique years sorted descending.

- [ ] **Step 2: Compute `visibleYearLabel`**
  Derive the year label from `displayChartData` to reflect the timeframe currently shown in the 5-bar chart window.

- [ ] **Step 3: Run Babel verification on `BillDetailScreen.js`**
  Verify syntax compiles cleanly.

---

### Task 2: Build `YearQuickJumpModal` Component & Year Pill in `BillDetailScreen.js`

**Files:**
- Modify: `src/screens/BillDetailScreen.js:210-300` (component)
- Modify: `src/screens/BillDetailScreen.js:1250-1280` (pill JSX in header)
- Modify: `src/screens/BillDetailScreen.js:1400-1450` (modal JSX)
- Modify: `src/screens/BillDetailScreen.js:2350-2500` (styles)

**Interfaces:**
- Consumes: `visible`, `onClose`, `availableYears`, `yearGroups`, `activeYear`, `onSelectOccurrence`
- Produces: Themed Quick-Jump Modal with shortcuts, year grid, and month chips

- [ ] **Step 1: Create `YearQuickJumpModal` component**
  - Top icon badge with `calendar-clock` icon.
  - Quick action buttons: *"⏮ Oldest"* and *"⏭ Latest"*.
  - Year buttons grid: each year rendered as a selectable button.
  - Month chips container: displays months available for the currently selected year.
  - Close button.

- [ ] **Step 2: Add Year Jump Pill to Billing History header**
  Insert a clickable pill `[ 📅 {visibleYearLabel} ▾ ]` between the count badge and the `<` `>` pagination controls.

- [ ] **Step 3: Add themed styles for Year Pill and Jump Modal**
  Add styles for `yearJumpPill`, `yearJumpPillText`, `jumpModalCard`, `jumpShortcutsRow`, `jumpShortcutBtn`, `yearGrid`, `yearGridBtn`, `yearGridBtnActive`, `monthChipsRow`, `monthChip`.

- [ ] **Step 4: Run Babel verification on `BillDetailScreen.js`**
  Verify syntax compiles cleanly.

---

### Task 3: Implement Jump Alignment & Selection Logic

**Files:**
- Modify: `src/screens/BillDetailScreen.js:780-840`

**Interfaces:**
- Consumes: `targetOcc`, `series`, `chartData`
- Produces: `handleJumpToOccurrence(targetOcc)` updating `chartOffset` and calling `handleSelectOccurrence(targetOcc)`

- [ ] **Step 1: Implement `handleJumpToOccurrence`**
  Calculate `start = Math.max(0, Math.min(series.length - 5, targetIdx - 2))` and set `chartOffset = series.length - 5 - start`.
  Call `handleSelectOccurrence(targetOcc)` to load occurrence details.

- [ ] **Step 2: Connect handlers in `YearQuickJumpModal`**
  Wire shortcut buttons (oldest and latest) and year/month chips to invoke `handleJumpToOccurrence`.

- [ ] **Step 3: Run Babel verification on `BillDetailScreen.js`**
  Verify syntax compiles cleanly.

---

### Task 4: Automated Verification & Validation

**Files:**
- Test: `scratch/verify-year-jump.js`

- [ ] **Step 1: Write scratch verification script**
  Test available years derivation, offset calculation math, component JSX bindings, and Babel compilation.

- [ ] **Step 2: Run verification script**
  Verify all assertions pass.

