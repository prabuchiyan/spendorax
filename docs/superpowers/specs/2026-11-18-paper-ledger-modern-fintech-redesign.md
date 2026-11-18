# Paper Ledger Modern Fintech UI Redesign Spec

## 1. Context & Motivation
The current Paper Ledger uses vintage physical accounting ledger motifs:
- A dark brown stitched binding tape (`#854D0E`) with white stitching dots.
- A yellowish parchment paper background (`#FDFBF7`) and ruled notebook paper lines.
- A vertical red margin line (`#EF4444`) dividing particulars from amount.
- Empty fake notebook lines to fill out the sheet.
- A flat accounting ledger total row with a traditional double-rule underline.

The user requested: *"Now can you update the ledger paper design. It's looks very old ledger. Make a design for current trend."* and selected the **Modern Fintech Look**.

## 2. Design Goals & Principles
1. **Modern Fintech Surface:** Clean, crisp surfaces (Light: `#FFFFFF` card on `#F8FAFC` screen; Dark: `#131926` card on `#0B0F17` screen) with sleek micro-borders (`#E2E8F0` / `#1F293D`) and subtle shadows.
2. **Sleek Header Pill:** Replace brown tape with a modern header bar containing:
   - Elevated sheet title pill with icon and inline edit pencil.
   - Tinted `+ New` button pill and entry counter badge.
   - Elegant metadata/hint text.
3. **Clean 65% / 35% Grid:**
   - Remove the harsh red vertical margin line; replace with a clean, subtle divider (`#F1F5F9` / `#1E293B`).
   - Clean column headers: `TRANSACTION / FORMULA` and `AMOUNT` with modern typography.
4. **Modern Transaction Rows (`PaperSwipeableRow`):**
   - Clean serial numbers (`01`, `02`, etc. or `#1`).
   - Modern emerald (`#10B981` / `#059669`) income pills and rose (`#F43F5E` / `#E11D48`) expense pills.
   - Monospaced formula badges with calculator icon (`bg-slate-100`, border `slate-200`).
   - Bold tabular amount figures.
   - Modern rounded swipe action capsules for Delete (Rose) and Edit (Indigo/Blue).
5. **Fintech Net Summary Hero Card:**
   - Remove the double-line accounting rules and fake empty ruled lines.
   - Replace with a modern balance summary card:
     - Side-by-side or stacked inflow/outflow breakdown badges.
     - Large bold net balance with status badge (`Surplus`, `Deficit`, `Balanced`).
6. **Zero Regressions & Local Commit Constraint:**
   - Keep all database persistence, pinning, math expression calculation, multi-selection, and WhatsApp export intact.
   - Maintain the user constraint: **Do NOT run `git push`** (local commits only).

## 3. Scope of Changes
- `src/screens/PaperLedgerScreen.js`: Redesign sheet card, header tape, table column header, empty state, and summary hero card.
- `src/components/PaperSwipeableRow.js`: Update row styling, column divider, serial format, formula badge, and swipe capsules.
- `test/test_paper_ledger_modern_ui.js`: New tests asserting the modern fintech theme classes, elements, and calculations.
