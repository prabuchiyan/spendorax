# Bill Details: Jump to Period Responsive Fixed Design

## Intent and Why
In `BillDetailScreen.js`, the "Jump to Period" modal allows users to jump between years and month cycles. However, on various mobile screen sizes (especially compact screens 320px–375px), the month cycle chips wrap unevenly, stretch across full rows due to `flexGrow: 1`, truncate currency amounts, and cause visual instability. This design specification defines a responsive, fixed 2-column cycle card grid and responsive container sizing to ensure flawless presentation across all mobile devices.

## Goals
- **Fixed 2-Column Responsive Cycle Grid:** Ensure month cycle cards always render in a clean, predictable 2-column layout (each column ~48.5% width) without jagged wraps or awkward single-item stretching.
- **Card Hierarchy & Zero-Truncation Layout:**
  - Header line: Status indicator dot + Month Name (e.g. "Jan", "Feb") + Active/Current indicator badge or paid checkmark icon.
  - Footer line: Formatted amount (`formatCurrency(occ.amount)`) + small status label ("Paid", "Due", "Skipped").
- **Current Cycle Highlighting:** Visually distinguish the currently active cycle with an accent border, subtle background tint, and a "Current" indicator.
- **Responsive Year Selector:** Clean horizontal scroll or wrap pills with uniform touch targets.
- **Mobile-Adaptive Modal Shell:** Responsive card padding, height containment (`maxHeight: "82%"`), and a fixed bottom Close button so actions remain accessible on all mobile heights.

## Non-Goals & Anti-Goals
- **Non-Goals:**
  - Changing the chart offset jump algorithm (`handleJumpToOccurrence`).
  - Changing backend bill fetching or transaction linking logic.
- **Anti-Goals:**
  - Do not allow flex items to stretch to 100% when an odd number of cycles exist in a year.
  - Do not truncate currency amounts with `...` on standard or compact mobile devices.

## Approaches Considered
1. **Approach 1 (Chosen): Structured 2-Column Fixed Cards**
   - Each cycle card is strictly 48.5% width with stacked rows (Month & status on top, Amount and status text below).
   - *Best readability, completely eliminates text collision, scales reliably from 320px to 430px+.*
2. **Approach 2: Inline 3-Column Chips with `minWidth: 29%`**
   - Current approach.
   - *Rejected: Causes severe text truncation and asymmetric stretching.*
3. **Approach 3: Single-Column Full-Width List**
   - Each cycle takes full row width.
   - *Rejected: Takes too much vertical space; requires excessive scrolling for 12 months.*

