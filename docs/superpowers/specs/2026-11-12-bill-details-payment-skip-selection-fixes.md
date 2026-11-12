# Bill Details: Payment Sync, Unskip Modal, Skip Loader & Occurrence Selection Spec

## Intent and Why
This specification addresses four critical usability and functional requirements on `BillDetailScreen` and `BillsScreen`:
1. **Full vs. Partial Payment Synchronization:** Accurately compute, store, and highlight "Paid" vs. "Partially Paid" status across the application, whether payments are linked directly from `BillDetailScreen` or from `TransactionAdd` (`LinkedBillCard`).
2. **Unskip Modal with Info:** Provide an `UnskipBillModal` with cycle details, amount, due date, and impact notice before unskipping a bill occurrence.
3. **Skip Button Loading & Button Disabling:** Render a spinner on the Skip action button and disable all sibling buttons (cancel button, pay button, backdrop) during skip execution on both `BillDetailScreen` and `BillsScreen`.
4. **Default Occurrence Selection:** Ensure default selection on opening `BillDetailScreen` prioritizes the current month cycle if unpaid, or the previous unpaid cycle if current month is paid/skipped, eliminating erroneous jumps to the first historical occurrence (`s[0]`).

## Requirements Breakdown

### 1. Full vs. Partial Payment Synchronization
- In `src/services/bills.js`:
  - `linkAdditionalTransaction(billId, transactionId)`: Replace hardcoded `SET status = 'paid', is_paid = 1` with a call to `syncBillPaymentStatus(billId)`.
  - `syncBillPaymentStatus(billId)`: When `totalPaid > 0 && totalPaid < billAmount`, set `status = 'partially_paid'`, `is_paid = 0` in SQLite. When `totalPaid >= billAmount`, set `status = 'paid'`, `is_paid = 1`.
  - `getBillById(id)` & `getBillSeries(templateId)`: Enrich all returned bill objects with `paid_amount`, `total_paid`, `remaining_amount`, `is_partially_paid`, and `is_completely_paid`.
  - `getBillDisplayStatus(bill)` in `billUtils.js`: Accurately return `"Partially Paid"` (blue `#3B82F6`) when partially paid, and `"Paid"` (green `#3F8F6B`) when fully settled.
- In `BillDetailScreen.js`:
  - Hero Status Pill: Display distinctive blue styling with `progress-check` icon for "Partially Paid" (`heroStatusPillPartiallyPaid`).
  - Hero Paid Amount Panel: Display `<CurrencyText amount={activeBill.paid_amount || 0} />` with "Partially Paid" blue badge or "Fully Settled" green badge.
  - Bottom Dock: If partially paid, show "Pay Remaining" or "Mark as Paid" primary button. If fully paid or skipped, hide the pay button.
  - Cycle grid in Jump Modal: Accurately display "Partially Paid" status dot and text.

### 2. Unskip Modal with Information
- Create `src/components/UnskipBillModal.js` following the design standards of `SkipBillModal.js`:
  - `undo-variant` blue icon circle.
  - Bill name, recurrence badge, cycle due date, and amount.
  - "Reactivation Notice" explaining that the occurrence will return to pending/due status and be restored to upcoming bill schedules.
  - "Keep Skipped" cancel button and "Unskip Bill" confirm button with loading spinner when executing.
- In `BillDetailScreen.js`:
  - Bottom dock "Unskip" button triggers `setShowUnskipModal(true)`.
  - On confirm, invoke `unskipBill` with loading state, refresh data, and display toast feedback.

### 3. Skip Button Loading & Sibling Button Disabling
- In `SkipBillModal.js`:
  - Confirm button displays `ActivityIndicator` when `loading` is true.
  - Cancel button is disabled (`disabled={loading}`).
  - Modal backdrop dismiss is disabled when `loading` is true.
- In `BillDetailScreen.js`:
  - Add `isSkipping` state and pass to `SkipBillModal`.
  - Disable bottom dock action buttons when `isSkipping || isMarkingPaid`.
- In `BillsScreen.js`:
  - Add `isSkipping` state and pass `loading={isSkipping}` to `SkipBillModal`.
  - Disable interactions while skip is processing.

### 4. Default Occurrence Selection
- In `BillsScreen.js`:
  - In `openDetail(bill)`, pass `occurrenceId: bill._displayOccurrenceId || (bill._isRecurringSeries ? bill.id : undefined)`.
- In `BillDetailScreen.js`:
  - When selecting default occurrence in `load()`:
    1. If `targetOccId` or `targetDueDate` or valid `occurrenceId` is provided (and is not a recurring template matching `s[0]`), select that occurrence.
    2. Otherwise:
       - Find `currentMonthOcc` (`year === now.getFullYear() && month === now.getMonth()`).
       - Find `prevUnpaidOccs` (unpaid occurrences with due date prior to current month, sorted newest to oldest).
       - User rule: If `currentMonthOcc` is unpaid, select `currentMonthOcc` (current month takes precedence over previous unpaid).
       - If `currentMonthOcc` is paid or skipped, select the most recent `prevUnpaidOcc` if any exist.
       - If neither has unpaid bills, select `currentMonthOcc` if it exists, or the latest occurrence `s[s.length - 1]`.
       - Never default to `s[0]` unless it is the only occurrence in `s`.

