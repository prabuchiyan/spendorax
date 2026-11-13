# Notifications System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign and expand the SpendoraX notification system to support instant alerts for statement and bill generation, personalized loan EMI reminders, rich card/bill/loan details in notification designs, Android notification channels, direct deep-linking, and full user customization in `NotificationSettingsScreen`.

**Architecture:**
1. In `src/database/init.js` and `notifications.js`, migrate SQLite schema to add `is_notified` to `credit_card_statements` and seed master settings rows for `STATEMENT_GENERATED` and `BILL_GENERATED`.
2. In `src/services/notificationService.js`, configure 4 dedicated Android Notification Channels (`Bills & Payments`, `Statements`, `Loan EMIs`, `Daily Reminders`), implement `syncLoanEmiNotifications()` with payment awareness and month-end clamping, update `syncBillNotifications()` to respect user-configured reminder times, and unify deep-link tap routing.
3. In `src/services/creditCardScheduler.js`, `bills.js`, and `loans.js`, trigger instant notifications upon generation (with deduplication tracking via `is_notified`) and hook loan mutations to re-sync scheduled EMI reminders.
4. In `src/screens/NotificationSettingsScreen.js`, expand UI to present all 6 notification types with independent switches and time pickers.

**Tech Stack:** React Native, Expo Notifications (`expo-notifications`), Expo SQLite (`expo-sqlite`), `@expo/vector-icons`, React Navigation.

**Spec:** [`docs/superpowers/specs/2026-11-13-notifications-system-redesign.md`](file:///c:/Users/Prabu.S/Prabuchiyan/spendorax/docs/superpowers/specs/2026-11-13-notifications-system-redesign.md)

## Global Constraints
- All notifications are local, offline-first on device (no remote push server dependencies).
- Android Notification Channels must be initialized on app launch with `AndroidImportance.HIGH` for alerts and `DEFAULT` for daily reminders.
- Number and currency formatting must use standard locale string representation (`₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).
- Prevent notification spam: statements must track `is_notified` so they alert strictly once upon generation.
- Zero crashes on web fallback (preserve `Platform.OS === 'web'` mock guards in `notificationService.js`).

## Review Focus
1. **Statement Generation Alert**: Generating a statement in `creditCardScheduler.js` triggers an instant notification with card name, closing balance, due date, and minimum due; subsequent runs do not re-notify already notified statements.
2. **Recurring Bill Occurrence Generation**: When `_ensureNextOccurrence` creates a new bill cycle, it triggers an instant notification with bill name, amount, and due date.
3. **Loan EMI Scheduled Reminders**: `syncLoanEmiNotifications()` schedules alerts on `dueDate - 2 days` and `dueDate` with loan name, EMI amount, due date, lender, and remaining balance. If this month's EMI is already paid, it skips to next month.
4. **User Control in Settings**: Disabling a toggle in `NotificationSettingsScreen` cancels scheduled alarms / disables instant triggers; updating reminder time reschedules all associated alerts with the new hour/minute.
5. **Deep Linking & Tap Handling**: Tapping notifications opens the corresponding detail screens (`CreditCardStatementDetail`, `BillDetail`, `LoanDetails`, `TransactionAdd`, `Transactions`) even after app cold start.

---

### Task 1: Database Migration & Settings Seeding

**Files:**
- Modify: `src/database/init.js:120-150`
- Modify: `src/database/notifications.js:20-75`

**Interfaces:**
- Consumes: `executeSql`
- Produces: `credit_card_statements.is_notified` column; seeded master rows in `notifications` for `STATEMENT_GENERATED` and `BILL_GENERATED`; helper `isNotificationEnabled(type)`

- [ ] **Step 1: Add `is_notified` column migration in `src/database/init.js`**
  Add safe `ALTER TABLE credit_card_statements ADD COLUMN is_notified INTEGER DEFAULT 0` in `initDB`.

- [ ] **Step 2: Seed new notification types in `src/database/notifications.js`**
  In `createNotificationsTable()`, add seeds for:
  - `STATEMENT_GENERATED` (Title: "Statement Generated Alert", Body: "Notifies when a credit card statement is ready", hour: 9, minute: 0, payload: `{ screen: 'CreditCardStatements', type: 'STATEMENT_GENERATED' }`)
  - `BILL_GENERATED` (Title: "New Bill Generated Alert", Body: "Notifies when a recurring bill occurrence is scheduled", hour: 9, minute: 0, payload: `{ screen: 'Bills', type: 'BILL_GENERATED' }`)

- [ ] **Step 3: Add `isNotificationEnabled(type)` helper in `src/database/notifications.js`**
  Export helper function:
  ```javascript
  export async function isNotificationEnabled(type) {
    const row = await getNotificationByType(type);
    return row ? Boolean(row.enabled) : false;
  }
  ```

- [ ] **Step 4: Verify Babel compile**
  Run: `node -e "const babel = require('@babel/core'); babel.transformFileSync('src/database/notifications.js'); console.log('notifications.js compiled');"`

---

### Task 2: Android Channels, Loan EMI Sync & Notification Service Overhaul

**Files:**
- Modify: `src/services/notificationService.js`

**Interfaces:**
- Consumes: `getNotifications()`, `getNotificationByType()`, `isNotificationEnabled()`, SQLite `loans`, `loan_payments`, `bills`
- Produces: `setupNotificationChannels()`, `syncLoanEmiNotifications()`, updated `syncBillNotifications()`, updated `rescheduleAll()`, updated `handleNotificationTap()`

- [ ] **Step 1: Implement `setupNotificationChannels()`**
  In `notificationService.js`, register the 4 Android channels when `Platform.OS === 'android'`:
  - `bills_channel`: Name "Bills & Payments", `AndroidImportance.HIGH`, light `#DC2626`, vibration.
  - `statements_channel`: Name "Credit Card Statements", `AndroidImportance.HIGH`, light `#2563EB`, vibration.
  - `loans_channel`: Name "Loan EMIs", `AndroidImportance.HIGH`, light `#059669`, vibration.
  - `daily_reminders_channel`: Name "Daily Expense Reminders", `AndroidImportance.DEFAULT`.

- [ ] **Step 2: Refactor `rescheduleAll()`**
  - Cancel all previously scheduled notifications.
  - For rows where `reference_id IS NULL`: ONLY schedule repeating triggers for `DAILY_SPEND` and `YESTERDAY_SPEND`.
  - Do NOT schedule generic daily repeating triggers for `BILL_DUE`, `LOAN_EMI`, `STATEMENT_GENERATED`, or `BILL_GENERATED`.
  - Call `await syncBillNotifications();` and `await syncLoanEmiNotifications();`.

- [ ] **Step 3: Update `syncBillNotifications()` with user time preference & rich formatting**
  - Fetch `BILL_DUE` config from `notifications` table. If `!config.enabled`, cancel `SPECIFIC_BILL_DUE` and return.
  - Use `config.hour` and `config.minute` (instead of hardcoded 9:00 AM) for scheduled date triggers.
  - Set `channelId: 'bills_channel'`.
  - Format title: `🔔 Bill Due ${dayWord} • ${bill.name}`
  - Format body: `Amount: ₹${formattedAmount} | Due: ${dueDateStr}${accountStr}\nTap to mark as paid or view details.`
  - Payload: `{ screen: 'BillDetail', billId: bill.id, type: 'SPECIFIC_BILL_DUE' }`.

- [ ] **Step 4: Implement `syncLoanEmiNotifications()`**
  - Fetch `LOAN_EMI` config from `notifications` table.
  - Cancel existing `SPECIFIC_LOAN_EMI` notifications from OS and delete from `notifications` table.
  - If `!config.enabled`, return.
  - Query active borrowed loans: `SELECT * FROM loans WHERE status = 'Active' AND loan_direction = 'BORROWED' AND emi_amount > 0 AND outstanding_amount > 0`.
  - For each loan:
    - Check if this month's EMI is already paid in `loan_payments` (query `loan_payments` where `loan_id = ?` and payment_date is within current calendar month and amount >= 0.9 * emi_amount).
    - Determine candidate due date: current month on clamped `emi_day`, or next month if current month is already in the past or paid.
    - Schedule for `candidateDate - 2 days` and `candidateDate` at `config.hour` and `config.minute`.
    - Only schedule if in future.
    - Channel: `loans_channel`.
    - Title: `🚨 EMI Due ${dayWord} • ${loan.loan_name}`
    - Body: `EMI: ₹${formattedEmi} | Due: ${dueDateStr} | Lender: ${loan.lender || 'Loan'}\nRemaining: ₹${formattedOutstanding}. Tap to pay.`
    - Data: `{ screen: 'LoanDetails', loanId: loan.id, type: 'SPECIFIC_LOAN_EMI' }`.

- [ ] **Step 5: Update `handleNotificationTap()`**
  - Add cases for `CreditCardStatementDetail`: navigate to `CreditCardStatementDetail` with `{ statementId, id: statementId, cardId }`.
  - Support `BillDetail` with `{ id: billId }`.
  - Support `LoanDetails` with `{ id: loanId }`.

- [ ] **Step 6: Verify Babel compile**
  Run: `node -e "const babel = require('@babel/core'); babel.transformFileSync('src/services/notificationService.js'); console.log('notificationService.js compiled');"`

---

### Task 3: Hook Instant Triggers in Credit Card Scheduler, Bills & Loans

**Files:**
- Modify: `src/services/creditCardScheduler.js:760-840`
- Modify: `src/services/bills.js:1250-1310` (`_ensureNextOccurrence`)
- Modify: `src/services/loans.js:40-60, 130-150, 250-270, 390-420`

**Interfaces:**
- Consumes: `isNotificationEnabled()`, `syncLoanEmiNotifications()`
- Produces: Instant alerts on statement creation and bill occurrence creation; auto re-sync of loan EMI alerts on loan mutations

- [ ] **Step 1: Update Statement Generation notification in `creditCardScheduler.js`**
  - In `processCycle`: when inserting a new statement:
    - Check `await isNotificationEnabled('STATEMENT_GENERATED')`.
    - Check `stmt.is_notified === 0`.
    - Format title: `💳 Statement Generated • ${card.name}`
    - Format body: `Amount Due: ₹${formattedAmount} | Due: ${dueDateStr}\nMin Due: ₹${formattedMinDue} • Tap to view statement breakdown & pay.`
    - Channel: `statements_channel`.
    - Payload: `{ screen: 'CreditCardStatementDetail', statementId: stmtRes.insertId, cardId: card.id, type: 'STATEMENT_GENERATED' }`.
    - Set `is_notified = 1` in `credit_card_statements`.

- [ ] **Step 2: Add Recurring Bill Occurrence notification in `bills.js`**
  - In `_ensureNextOccurrence(templateId)`: after inserting a new child bill occurrence:
    - Check `await isNotificationEnabled('BILL_GENERATED')`.
    - If enabled, schedule immediate notification:
      - Title: `📋 New Bill Generated • ${newOccurrence.name}`
      - Body: `Amount: ₹${formattedAmount} | Due Date: ${dueDateStr}\nAdded to your schedule. Tap to view details.`
      - Channel: `bills_channel`.
      - Payload: `{ screen: 'BillDetail', billId: newBillId, type: 'BILL_GENERATED' }`.

- [ ] **Step 3: Wire Loan Mutations to `syncLoanEmiNotifications()` in `loans.js`**
  - Import `{ syncLoanEmiNotifications } from './notificationService';`.
  - Call `syncLoanEmiNotifications()` in:
    - `createLoan`
    - `updateLoan`
    - `deleteLoan`
    - `recordPayment`
    - `forecloseLoan`

- [ ] **Step 4: Verify Babel compile**
  Run: `node -e "const babel = require('@babel/core'); babel.transformFileSync('src/services/creditCardScheduler.js'); babel.transformFileSync('src/services/bills.js'); babel.transformFileSync('src/services/loans.js'); console.log('services compiled');"`

---

### Task 4: Notification Settings Screen Enhancements

**Files:**
- Modify: `src/screens/NotificationSettingsScreen.js`

**Interfaces:**
- Consumes: All 6 types from `notifications` table
- Produces: Enhanced settings UI with toggles for all 6 types and time pickers for scheduled types (`BILL_DUE`, `LOAN_EMI`, `DAILY_SPEND`, `YESTERDAY_SPEND`)

- [ ] **Step 1: Expand `TYPE_META` in `NotificationSettingsScreen.js`**
  Add metadata for:
  - `STATEMENT_GENERATED` (`credit-card-check-outline`, color `#2563EB`, bg `#DBEAFE`, "Statement Generated Alert", "Instant notification whenever a credit card statement is ready.")
  - `BILL_GENERATED` (`file-plus-outline`, color `#0D9488`, bg `#CCFBF1`, "New Bill Generated Alert", "Instant notification whenever a recurring bill occurrence is scheduled.")
  - `BILL_DUE` (`file-document-alert-outline`, color `#DC2626`, bg `#FEE2E2`, "Bill Due Reminder", "Alerts before and on the day your bills are due.")
  - `LOAN_EMI` (`bank-outline`, color `#059669`, bg `#D1FAE5`, "Loan EMI Reminder", "Alerts before and on your EMI due day for active loans.")
  - `DAILY_SPEND` (`calendar-check-outline`, color `#7C3AED`, bg `#EDE9FE`, "Daily Expense Reminder", "Daily reminder to log today's expenses.")
  - `YESTERDAY_SPEND` (`calendar-clock`, color `#EA580C`, bg `#FED7AA`, "Missed Expense Alert", "Alerts you in the morning if no expenses were logged yesterday.")

- [ ] **Step 2: Update `handleToggle` logic**
  - For instant types (`STATEMENT_GENERATED`, `BILL_GENERATED`): simply update DB `enabled: 1` or `0`.
  - For `BILL_DUE`: update DB, then call `syncBillNotifications()`.
  - For `LOAN_EMI`: update DB, then call `syncLoanEmiNotifications()`.
  - For `DAILY_SPEND` / `YESTERDAY_SPEND`: call `scheduleNotification` / `cancelNotification`.

- [ ] **Step 3: Update `saveTime` logic**
  - Save `hour` and `minute` in SQLite.
  - If `BILL_DUE`: call `syncBillNotifications()` to re-schedule all upcoming bill alerts with the new time.
  - If `LOAN_EMI`: call `syncLoanEmiNotifications()` to re-schedule all upcoming loan EMI alerts with the new time.
  - If `DAILY_SPEND` / `YESTERDAY_SPEND`: reschedule OS daily repeating alarm.

- [ ] **Step 4: Update render to only show Time Picker button on schedulable types**
  - Hide the time row for instant types (`STATEMENT_GENERATED`, `BILL_GENERATED`) as they trigger immediately upon event rather than on a clock time.
  - Show time picker row for `BILL_DUE`, `LOAN_EMI`, `DAILY_SPEND`, `YESTERDAY_SPEND`.

- [ ] **Step 5: Verify Babel compile**
  Run: `node -e "const babel = require('@babel/core'); babel.transformFileSync('src/screens/NotificationSettingsScreen.js'); console.log('NotificationSettingsScreen.js compiled');"`

---

### Task 5: App Integration & End-to-End Test Verification

**Files:**
- Modify: `App.js`
- Create: `scratch/test-notifications.js`

**Interfaces:**
- Consumes: `setupNotificationChannels`, `syncLoanEmiNotifications`, `syncBillNotifications`, `rescheduleAll`
- Produces: App lifecycle initialization and test verification suite

- [ ] **Step 1: Initialize notification channels and sync in `App.js`**
  - Import `setupNotificationChannels, syncLoanEmiNotifications` from `./src/services/notificationService`.
  - In `App.js` startup effect:
    - Call `await setupNotificationChannels();`.
    - Call `await syncLoanEmiNotifications();` alongside `syncBillNotifications()`.

- [ ] **Step 2: Create comprehensive test script `scratch/test-notifications.js`**
  Write an automated test script verifying:
  - Database table seeds contain all 6 notification types.
  - Formatting for Statement Generated, Bill Generated, Bill Due, and Loan EMI notifications matches the spec.
  - `is_notified` column exists on `credit_card_statements` and properly prevents duplicate triggers.
  - Loan EMI clamping works for all month lengths (e.g. Feb 28, Apr 30, Oct 31).
  - Deep-link payload routes correctly to expected screens.

- [ ] **Step 3: Run the test suite**
  Run: `node scratch/test-notifications.js`
  Expected: All checks pass with 0 errors.

- [ ] **Step 4: Verify full project compilation**
  Run: `node -e "const babel = require('@babel/core'); ['App.js', 'src/services/notificationService.js', 'src/services/creditCardScheduler.js', 'src/services/bills.js', 'src/services/loans.js', 'src/screens/NotificationSettingsScreen.js'].forEach(f => babel.transformFileSync(f)); console.log('All files passed Babel!');"`

