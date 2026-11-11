# Bill Details: Billing History Graph Year Quick-Jump

## Intent and Why
For long-running recurring bills spanning multiple years (e.g., from 2017 to 2026), users currently have to click the left arrow (`chevron-left`) one month at a time to view historical cycles. For an 8–9 year bill, this requires nearly 100 taps. This feature introduces an intuitive **Year Quick-Jump Pill & Modal** in the Billing History section, allowing users to jump directly to any year or month in 1–2 taps.

## Goals
- **Year Quick-Jump Pill:** Add a compact, clickable pill in the Billing History header showing the currently visible year with a dropdown indicator (e.g., `📅 2026 ▾`).
- **Quick-Jump Modal:**
  - Header with `calendar-clock` badge, title *"Jump to Billing Period"*, and subtitle.
  - **Quick Action Shortcuts:** One-tap jump buttons for *"Oldest"* (e.g. 2017) and *"Latest"* (e.g. 2026).
  - **Year Selector Grid:** Visual grid of all years present in the bill's `series`, highlighting the active year.
  - **Month Sub-Chips:** Selecting a year displays its available months/cycles for that year (or quick-jumping directly to the year).
  - **Automatic Chart Alignment:** Selecting any year or month computes the exact `chartOffset`, scrolls the 5-item chart window directly to that timeframe, and automatically selects that occurrence to display its status and linked transactions.
- **Theme & Dark Mode Support:** Follow Spendorax's dark/light design system with smooth feedback and touch affordances.

## Non-Goals & Anti-Goals
- **Non-Goals:**
  - Altering the 5-bar layout of `PremiumRoundedBarChart` (it remains 5 bars wide for optimal touch targets and chart legibility).
  - Modifying how bill occurrences are stored or fetched in SQLite.
- **Anti-Goals:**
  - Do not crowd the chart header or push the navigation arrows off-screen.
  - Do not require users to scroll through huge nested pickers; keep shortcuts prominent and selection instantaneous.

## Constraints
- Must handle single-occurrence bills and one-time bills gracefully (disabling or hiding the jump pill if only 1 cycle or <= 5 cycles exist).
- Must be fully responsive across small and large phone screens.

## Approaches Considered
1. **Approach 1 (Chosen): Year Quick-Jump Pill & Modal**
   - Clickable year pill in the section header that opens a dedicated, theme-aware jump modal with oldest/latest shortcuts and year/month selection.
   - *Best balance of clean UI, instant discoverability, and minimal taps.*
2. **Approach 2: Horizontal Scrollable Year Chips Bar**
   - Permanent row of year chips above the chart.
   - *Rejected: Clutters the card and consumes vertical space on every view.*
3. **Approach 3: Double-Chevron Stepper (`|<<` / `>>|`)**
   - Jump by 1 year at a time.
   - *Rejected: Still takes ~9 clicks to go from 2026 to 2017.*

## Implementation Details
1. **Derived Year Data in `BillDetailScreen.js`:**
   - Extract unique years from `series` due dates: `availableYears = [...new Set(series.map(s => new Date(s.due_date).getFullYear()))].sort((a,b) => b - a)`.
   - Identify oldest and latest occurrence in `series`.
   - Compute the currently visible year from `displayChartData`.
2. **UI Year Pill:**
   - Render in `sectionHeaderRow` next to the `<` `>` pagination controls.
   - Tapping sets `showYearJumpModal(true)`.
3. **Modal Component & Selection:**
   - Modal with themed overlay, `calendar-clock` icon badge, "Oldest" and "Latest" shortcut buttons, year pills grid, and month sub-chips for the selected year.
   - When a year/occurrence is chosen, calculate `chartOffset`:
     ```js
     const targetIdx = series.findIndex(o => o.id === selectedOcc.id);
     const newOffset = Math.max(0, Math.min(series.length - 5, series.length - 5 - targetIdx));
     setChartOffset(newOffset);
     handleSelectOccurrence(selectedOcc);
     ```
   - Close modal smoothly.

