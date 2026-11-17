# MuiDateTimePicker Modern Material 3 Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `MuiDateTimePicker.js` to an elegant Modern Material 3 (M3 Expressive) design with seamless dark/light theme support while strictly preserving all existing business logic, validation, and component APIs.

**Architecture:**
- Modernize the container into an elevated 28px continuous corner dialog card with dynamic theme colors.
- Unify the top area into an airy M3 header featuring contextual micro-labels, hero formatted value, and an integrated pill segmented control (`[ 📅 Date | 🕒 Time ]`).
- Polish the calendar views: circular day cells, accent outline ring for "today", interactive month/year pill chips, and clean in-header year pagination (`< 2024 – 2035 >`).
- Redesign the time picker: rounded digital time capsules with soft brand tints, crisp AM/PM toggle, and a theme-aware analog clock dial.
- Restyle the action footer with clear visual hierarchy (red "Clear", muted "Cancel", filled primary "OK" pill).

**Tech Stack:** React Native, Expo, React Native Paper (`Button`), `react-native-svg` (`Svg`, `Line`, `Circle`), `@expo/vector-icons` (`MaterialCommunityIcons`).

**Spec:** [`docs/superpowers/specs/2026-11-12-mui-date-time-picker-m3-redesign.md`](file:///c:/Users/Prabu.S/Prabuchiyan/spendorax/docs/superpowers/specs/2026-11-12-mui-date-time-picker-m3-redesign.md)

## Global Constraints
- Preserve all existing props: `visible`, `initialDate`, `onClose`, `onSelect`, `disableFutureDates`, `minDate`, `maxDate`, `allowClear`, `onClear`, `hideTime`, `hideDate`.
- Preserve all selection logic, date clamping, disabled checks (`isDateDisabled`, `isMonthDisabled`, `isYearDisabled`), and auto-switch from date to time.
- Zero hardcoded light-only colors (`#fff`, `#111827`, `#F3F4F6`); dynamically consume `useTheme()` (`theme` and `isDarkMode`).
- Brand primary color remains `#3F8F6B` (`PRIMARY_COLOR`).

## Review Focus
1. **Dark & Light Mode Contrast:** Ensure every text element, background, border, and active state is crisp and accessible across both themes.
2. **Year Pagination Without Negative Margins:** Ensure the year picker pagination `<` `2024 – 2035` `>` never clips or overflows on narrow screens.
3. **Today's Date Distinction:** Ensure current day is clearly distinguished via an accent outline ring when unselected, and transitions cleanly when selected.
4. **Time Mode Switching & Clock Interaction:** Ensure selecting an hour smoothly advances to minutes, and AM/PM toggles update immediately.
5. **Clear / Cancel / OK Action Handling:** Ensure "Clear" triggers `onClear` (or `onSelect(null)`), "Cancel" triggers `onClose`, and "OK" triggers `onSelect(date)`.

---

### Task 1: Refactor Dialog Card Surface & Unified M3 Header

**Files:**
- Modify: `src/components/MuiDateTimePicker.js:126-150` (Header rendering)
- Modify: `src/components/MuiDateTimePicker.js:487-515` (Modal wrapper & Tabs placement)
- Modify: `src/components/MuiDateTimePicker.js:542-610` (Card & Header styles)

**Interfaces:**
- Consumes: `tab`, `setTab`, `date`, `dateMode`, `setDateMode`, `hideDate`, `hideTime`, `theme`, `isDarkMode`
- Produces: Integrated M3 header with contextual micro-label, hero date/time text, and segmented pill tab control

- [ ] **Step 1: Replace solid banner header with dynamic M3 header**
  In `renderMaterialHeader`:
  - Top row: Context micro-label ("SELECT DATE" / "SELECT TIME") on the left; when `!hideTime && !hideDate`, render the segmented pill control on the right with icons (`calendar-month` and `clock-outline`) and active pill indicator.
  - Hero row: Formatted date string (`Wed, Nov 12` / `10:30 AM`) in `theme.textPrimary` with `fontSize: 24`, `fontWeight: '800'`.
  - Add subtle bottom border line dividing the header from the content.

- [ ] **Step 2: Update modal card container styles**
  In `card` style:
  - `backgroundColor: theme.cardBg`
  - `borderRadius: 28`
  - `borderWidth: 1`, `borderColor: theme.border`
  - `elevation: 10`, `shadowOpacity: 0.15`, `shadowRadius: 20`
  - Remove the separate `tabContainer` under the header since it is now unified in the header.

- [ ] **Step 3: Run Babel verification on `MuiDateTimePicker.js`**
  ```powershell
  node -e "require('@babel/core').transformFileSync('src/components/MuiDateTimePicker.js', { configFile: './babel.config.js' })"
  ```

---

### Task 2: Redesign Calendar Views (Days, Months, and Years)

**Files:**
- Modify: `src/components/MuiDateTimePicker.js:151-216` (Month header & navigation)
- Modify: `src/components/MuiDateTimePicker.js:219-358` (Days, Months, and Years grids)
- Modify: `src/components/MuiDateTimePicker.js:626-787` (Calendar styles)

**Interfaces:**
- Consumes: `viewMonth`, `dateMode`, `date`, `isDateDisabled`, `isMonthDisabled`, `isYearDisabled`, `yearPageStart`
- Produces: Polished Material 3 day grid, interactive month/year pill buttons, and header-paginated year grid

- [ ] **Step 1: Polish Month & Year header selectors**
  In `renderDate`:
  - Replace basic text buttons with interactive pill chips (`November ▾`, `2026 ▾`) using soft background (`theme.activeBg` or subtle tint) and rounded pill styling (`borderRadius: 20`).
  - Modernize left/right month navigation arrows into circular touch buttons with subtle border and theme colors.

- [ ] **Step 2: Refine Days grid styling and "Today" indicator**
  In `renderDaysGrid`:
  - Weekday labels: clean uppercase typography with `theme.textSecondary`.
  - Day cells: circular geometry (`width: '14.28%', aspectRatio: 1`).
  - Selected day: `PRIMARY_COLOR` solid circle with white bold text and subtle shadow.
  - Today (unselected): `borderWidth: 1.5`, `borderColor: PRIMARY_COLOR`, bold text in `PRIMARY_COLOR`.
  - Idle day: `color: theme.textPrimary`, `fontWeight: '500'`.
  - Disabled day: `color: theme.textMuted`, opacity `0.35`.

- [ ] **Step 3: Refine Months grid**
  In `renderMonthsGrid`:
  - 3x4 grid of cards with `borderRadius: 14`, height 44px.
  - Idle: `backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC'`, `borderColor: theme.border`, `color: theme.textPrimary`.
  - Selected: `backgroundColor: PRIMARY_COLOR`, `borderColor: PRIMARY_COLOR`, `color: '#fff'`.

- [ ] **Step 4: Redesign Years grid with clean header pagination**
  In `renderYearsGrid`:
  - Eliminate the negative-margin side arrows (`marginHorizontal: -12`).
  - Introduce an elegant year pagination bar at the top of the years view: `<  2024 – 2035  >` with circular navigation buttons and centered range label in `theme.textPrimary`.
  - Render the 3x4 grid below it with consistent rounded cards matching the month grid.

- [ ] **Step 5: Run Babel verification on `MuiDateTimePicker.js`**
  ```powershell
  node -e "require('@babel/core').transformFileSync('src/components/MuiDateTimePicker.js', { configFile: './babel.config.js' })"
  ```

---

### Task 3: Redesign Time Picker View & Action Footer

**Files:**
- Modify: `src/components/MuiDateTimePicker.js:390-484` (Time header & clock rendering)
- Modify: `src/components/MuiDateTimePicker.js:519-540` (Footer rendering)
- Modify: `src/components/MuiDateTimePicker.js:789-869` (Time & Footer styles)

**Interfaces:**
- Consumes: `timeMode`, `date`, `handleTimeSelect`, `toggleAmPm`, `allowClear`, `onClear`, `onClose`, `onSelect`
- Produces: Polished digital time capsules, refined analog clock dial, and M3 action footer

- [ ] **Step 1: Redesign digital time display & AM/PM switch**
  In `renderTime`:
  - Digital capsules: Hours and Minutes cards with `borderRadius: 16`, padded layout.
  - Idle capsule: `backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9'`.
  - Active capsule: `backgroundColor: `${PRIMARY_COLOR}18``, `borderWidth: 1.5`, `borderColor: PRIMARY_COLOR`.
  - Colon `:` in `theme.textSecondary`.
  - AM/PM Switch: Segmented pill container (`borderRadius: 12`, `borderWidth: 1`, `borderColor: theme.border`), active segment highlighted in `PRIMARY_COLOR`.

- [ ] **Step 2: Polish clock dial and needle styling**
  In `renderTime`:
  - Face: `backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9'`, subtle border `theme.border`.
  - SVG center circle and needle in `PRIMARY_COLOR`, endpoint selector circle (`r="16"`).
  - Dial numerals: centered text targets, bold `theme.textPrimary` for idle, `#fff` for active number.

- [ ] **Step 3: Redesign Action Footer**
  In footer:
  - Background `theme.cardBg`, top border `theme.border`.
  - Optional "Clear" button: `textColor={theme.danger || '#EF4444'}`.
  - "Cancel" button: `textColor={theme.textSecondary}`.
  - "OK" button: `mode="contained"`, `buttonColor={PRIMARY_COLOR}`, `borderRadius: 20`, padding horizontal 16.

- [ ] **Step 4: Run Babel verification on `MuiDateTimePicker.js`**
  ```powershell
  node -e "require('@babel/core').transformFileSync('src/components/MuiDateTimePicker.js', { configFile: './babel.config.js' })"
  ```

---

### Task 4: Complete Styling & Integration Verification

**Files:**
- Verify: `src/components/MuiDateTimePicker.js`

- [ ] **Step 1: Check all style rules for missing dynamic theme tokens**
  Verify that all sub-views (days, months, years, time, header, footer) properly use `theme` colors with zero hardcoded light-only styles.

- [ ] **Step 2: Run Babel syntax check across all screens utilizing `MuiDateTimePicker`**
  ```powershell
  node -e "['src/components/MuiDateTimePicker.js', 'src/components/TransactionForm.js', 'src/components/BillForm.js', 'src/screens/LoanFormScreen.js'].forEach(f => require('@babel/core').transformFileSync(f, { configFile: './babel.config.js' }))"
  ```

- [ ] **Step 3: Commit completed redesign changes**
  ```powershell
  git add src/components/MuiDateTimePicker.js
  git commit -m "feat(ui): redesign MuiDateTimePicker to Modern Material 3"
  ```

