# Notifications System Redesign Specification

## 1. Intent and Why
SpendoraX currently has a basic notification setup where several notifications are either generic, static, or missing entirely:
- Credit card statement alerts exist only as minimal plain text and deep-link to Bill Details instead of Statement Details.
- Recurring bill occurrences generated in the background fire no notification at all.
- Loan EMI notifications are a single daily static alert rather than personalized to individual loans with loan name, amount, and due date.
- Missed expense alerts are scheduled statically without dynamic verification.
- No Android Notification Channels (`setNotificationChannelAsync`) are configured, preventing proper heads-up banners, priority grouping, and OS-level channel management.
- The `NotificationSettingsScreen` only provides toggles for 4 legacy types and lacks controls for statement and bill generation events, while the scheduled times for bill reminders are hardcoded rather than honoring the user's selected time.

This redesign elevates all notifications to a professional, high-clarity standard with consistent layout designs, rich entity details (names, amounts, due dates, lenders/accounts), event-driven generation triggers, precise date scheduling, dedicated Android channels, reliable deep-linking, and full user customization in `NotificationSettingsScreen`.

---

## 2. Goals, Non-Goals, Anti-Goals

### Goals
- **High-Signal Visual Design**: Every notification uses clean, structured copy with emojis, entity names, currency amounts (`₹X,XX,XXX.XX`), and due dates.
- **Event-Driven Instant Notifications**: Trigger immediate notifications when a credit card statement is generated (`creditCardScheduler.js`) and when a recurring bill occurrence is created (`bills.js`).
- **Personalized Loan EMI Alerts**: Schedule individual loan EMI reminders (`syncLoanEmiNotifications`) that include the loan name, EMI amount, due date, and lender.
- **Dynamic Missed Expense Check**: Ensure missed expense reminders check whether any expenses were logged before alerting.
- **Direct Deep Linking**: Route notification taps to the exact target screens (`CreditCardStatementDetail`, `BillDetail`, `LoanDetails`, `Transactions`, `TransactionAdd`).
- **User Control in Settings**: Support individual toggle on/off and reminder time customization in `NotificationSettingsScreen` for all notification types.
- **Android Notification Channels**: Register 4 high-priority channels with vibration, badges, and sound.

### Non-Goals
- Push notifications via remote servers (Firebase/APNs). All notifications remain local, private, and offline-first on the device.
- Action buttons embedded directly in the notification shade (e.g. "Pay Now" inline button) due to OS-level background service complexity across diverse Android versions; instead, 1-tap navigation takes the user directly to the action modal/screen.

### Anti-Goals
- No notification spam: avoid repeated triggers for already-notified statements or bills on app open.
- No duplicate scheduled alarms on app restart (ensure clean deduplication and cancel/re-sync).

---

## 3. Approaches Considered

- **Approach 1: Hybrid Event-Driven + Precise Date Scheduling with User Control (Selected)**
  - *Description*: Instant triggers for generation events (Statement Generated, Bill Generated) + exact date/time triggers for due dates (`syncBillNotifications`, `syncLoanEmiNotifications`) + time-of-day alarms for daily expense reminders.
  - *Why Selected*: Combines real-time feedback when financial records are computed with precise advance warnings before due dates. Gives users full toggle and time control.
- **Approach 2: Pure Daily Batch Alarm**
  - *Rejected*: Fails to notify users immediately when they trigger statement generation or bill creation. Batches everything at 9 AM, causing notification clutter.
- **Approach 3: Consolidated Daily Digest**
  - *Rejected*: Loses direct deep-linking to specific bills/loans and dilutes clear information about individual bills or loans due.

---

## 4. Notification Types & Database Model

### Database Table: `notifications`
Types supported in `notifications` table (with `reference_id IS NULL` for master settings):
1. `STATEMENT_GENERATED`: Credit Card Statement Alert (Default: Enabled, instant trigger on generation)
2. `BILL_GENERATED`: New Bill Generated Alert (Default: Enabled, instant trigger on occurrence generation)
3. `BILL_DUE`: Bill Due Reminder (Default: Enabled, scheduled time: 09:00 AM, advance days from bill)
4. `LOAN_EMI`: Loan EMI Reminder (Default: Enabled, scheduled time: 09:00 AM, advance days: 2 days before & on due day)
5. `DAILY_SPEND`: Daily Expense Reminder (Default: Enabled, scheduled time: 21:00 / 09:00 PM)
6. `YESTERDAY_SPEND`: Missed Expense Alert (Default: Enabled, scheduled time: 09:00 AM)

For specific scheduled reminders, `notifications` table stores rows with:
- `type`: `'SPECIFIC_BILL_DUE'` (with `reference_id = bill.id`)
- `type`: `'SPECIFIC_LOAN_EMI'` (with `reference_id = loan.id`)
These are cleaned and re-synced dynamically when data changes.

---

## 5. Android Notification Channels

Configure in `notificationService.js` on app initialization:
```javascript
Notifications.setNotificationChannelAsync('bills_channel', {
  name: 'Bills & Payments',
  importance: Notifications.AndroidImportance.HIGH,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#DC2626',
  sound: 'default',
});

Notifications.setNotificationChannelAsync('statements_channel', {
  name: 'Credit Card Statements',
  importance: Notifications.AndroidImportance.HIGH,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#2563EB',
  sound: 'default',
});

Notifications.setNotificationChannelAsync('loans_channel', {
  name: 'Loan EMIs',
  importance: Notifications.AndroidImportance.HIGH,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#059669',
  sound: 'default',
});

Notifications.setNotificationChannelAsync('daily_reminders_channel', {
  name: 'Daily Expense Reminders',
  importance: Notifications.AndroidImportance.DEFAULT,
  sound: 'default',
});
```

---

## 6. Notification Copy & Design Specifications

### 1) Credit Card Statement Generated
- **Trigger**: In `creditCardScheduler.js` when a statement is first generated.
- **Channel**: `statements_channel`
- **Condition**: Only if `STATEMENT_GENERATED` setting is `enabled = 1`, and this statement has not already been notified (`is_notified = 0`).
- **Title**: `💳 Statement Generated • {card.name}`
- **Body**: `Amount Due: ₹{closing_balance} | Due: {due_date}\nMin Due: ₹{minimum_due} • Tap to view statement & pay.`
- **Data Payload**: `{ screen: 'CreditCardStatementDetail', statementId: stmt.id, cardId: card.id, type: 'STATEMENT_GENERATED' }`

### 2) Bill Generated
- **Trigger**: In `bills.js` (`_ensureNextOccurrence`) when a new recurring child occurrence is generated.
- **Channel**: `bills_channel`
- **Condition**: Only if `BILL_GENERATED` setting is `enabled = 1`.
- **Title**: `📋 New Bill Generated • {bill.name}`
- **Body**: `Amount: ₹{amount} | Due Date: {due_date}\nAdded to your schedule. Tap to view details.`
- **Data Payload**: `{ screen: 'BillDetail', billId: bill.id, type: 'BILL_GENERATED' }`

### 3) Bill Due Reminder
- **Trigger**: In `syncBillNotifications()` for pending bills. Scheduled at the user's configured `BILL_DUE` hour/minute (default 9:00 AM) on:
  - `dueDate - reminder_days_before` (e.g. 2 days before)
  - `dueDate` (due today)
- **Channel**: `bills_channel`
- **Condition**: Only if `BILL_DUE` setting is `enabled = 1`.
- **Title**: `🔔 Bill Due {Today / in X days} • {bill.name}`
- **Body**: `Amount: ₹{amount} | Due: {due_date} ({account_name})\nTap to mark as paid or review.`
- **Data Payload**: `{ screen: 'BillDetail', billId: bill.id, type: 'SPECIFIC_BILL_DUE' }`

### 4) Daily Expense Reminder
- **Trigger**: Daily repeating alarm at user-configured `DAILY_SPEND` time (default 21:00 / 9:00 PM).
- **Channel**: `daily_reminders_channel`
- **Condition**: Only if `DAILY_SPEND` setting is `enabled = 1`.
- **Title**: `📝 Daily Expense Check-in`
- **Body**: `Spent anything today? Take 15 seconds to log your expenses and keep your budget in check 🎯`
- **Data Payload**: `{ screen: 'TransactionAdd', type: 'DAILY_SPEND' }`

### 5) Missed Expense Alert
- **Trigger**: Daily repeating alarm at user-configured `YESTERDAY_SPEND` time (default 09:00 AM).
- **Channel**: `daily_reminders_channel`
- **Condition**: Only if `YESTERDAY_SPEND` setting is `enabled = 1`.
- **Title**: `⚠️ Missed Expense Alert`
- **Body**: `No expenses logged for yesterday. Forgot to record a spend or had a zero-spend day? Tap to review 📊`
- **Data Payload**: `{ screen: 'Transactions', type: 'YESTERDAY_SPEND' }`

### 6) Loan EMI Due & Scheduled
- **Trigger**: `syncLoanEmiNotifications()` in `notificationService.js`.
  - For all active borrowed loans with `emi_amount > 0` and `outstanding_amount > 0`.
  - Checks `loan_payments` for the current month cycle; if already paid, skips or advances to next month's EMI.
  - Clamps `emi_day` to last day of month.
  - Schedules notifications on `dueDate - 2 days` and on `dueDate` at user's configured `LOAN_EMI` hour/minute (default 9:00 AM).
- **Channel**: `loans_channel`
- **Condition**: Only if `LOAN_EMI` setting is `enabled = 1`.
- **Title**: `🚨 EMI Due {Today / in 2 days} • {loan.loan_name}`
- **Body**: `EMI: ₹{emi_amount} | Due: {due_date} | Lender: {lender}\nRemaining Balance: ₹{outstanding_amount}. Tap to pay.`
- **Data Payload**: `{ screen: 'LoanDetails', loanId: loan.id, type: 'SPECIFIC_LOAN_EMI' }`

---

## 7. Deep Linking & Tap Navigation

In `handleNotificationTap(data, navigationRef)`:
- `CreditCardStatementDetail`: Navigates to `CreditCardStatementDetail` passing `{ statementId, id: statementId }`.
- `BillDetail`: Navigates to `BillDetail` passing `{ id: billId }`.
- `LoanDetails`: Navigates to `LoanDetails` passing `{ id: loanId }`.
- `TransactionAdd`: Navigates to `TransactionAdd`.
- `Transactions`: Navigates to `Drawer` -> `Transactions`.

Compatible with `AppLockWrapper`: if app lock is active on cold start, `processPendingNotification` holds the payload and navigates once unlocked.

---

## 8. User Control in `NotificationSettingsScreen`

Update `TYPE_META` and UI in `NotificationSettingsScreen.js`:
- `STATEMENT_GENERATED`:
  - Icon: `credit-card-check-outline`, Color: `#2563EB`, Bg: `#DBEAFE`
  - Label: `Statement Generated Alert`
  - Description: `Instant notification whenever a credit card statement is generated.`
  - Control: On/Off Switch.
- `BILL_GENERATED`:
  - Icon: `file-plus-outline`, Color: `#0D9488`, Bg: `#CCFBF1`
  - Label: `New Bill Generated Alert`
  - Description: `Instant notification whenever a recurring bill occurrence is scheduled.`
  - Control: On/Off Switch.
- `BILL_DUE`:
  - Icon: `file-document-alert-outline`, Color: `#DC2626`, Bg: `#FEE2E2`
  - Label: `Bill Due Reminder`
  - Description: `Alerts before and on the day your bills are due.`
  - Control: On/Off Switch + Time Picker button (affects scheduled time for all bill reminders).
- `LOAN_EMI`:
  - Icon: `bank-outline`, Color: `#059669`, Bg: `#D1FAE5`
  - Label: `Loan EMI Reminder`
  - Description: `Alerts before and on your EMI due day for active loans.`
  - Control: On/Off Switch + Time Picker button (affects scheduled time for all loan reminders).
- `DAILY_SPEND`:
  - Icon: `calendar-check-outline`, Color: `#7C3AED`, Bg: `#EDE9FE`
  - Label: `Daily Expense Reminder`
  - Description: `Daily reminder to log today's expenses.`
  - Control: On/Off Switch + Time Picker button.
- `YESTERDAY_SPEND`:
  - Icon: `calendar-clock`, Color: `#EA580C`, Bg: `#FED7AA`
  - Label: `Missed Expense Alert`
  - Description: `Alerts you in the morning if no expenses were logged yesterday.`
  - Control: On/Off Switch + Time Picker button.

On toggle change or time change:
- Instantly updates SQLite table `notifications`.
- Calls `syncBillNotifications()` and `syncLoanEmiNotifications()` to re-schedule with new timing or cancel.

---

## 9. Builder Specifications & Architectural Clarifications

1. **Deduplication for Statements & Bills (Builder Call)**:
   - Add column `is_notified INTEGER DEFAULT 0` to `credit_card_statements` via safe `ALTER TABLE ... ADD COLUMN is_notified INTEGER DEFAULT 0` in `initDB`.
   - On new statement generation in `creditCardScheduler.js`: if `is_notified === 0` and `closing_balance > 0`, fire notification and update `is_notified = 1`.
   - On statement update: do not re-notify unless the statement was deleted and regenerated.
   - For `BILL_GENERATED`: triggered strictly in `_ensureNextOccurrence` for newly generated recurring child bills. One-time bills created manually by the user in `createBill` do not trigger an immediate notification.

2. **Master Rows vs. OS Alarms in `rescheduleAll()` (Builder Call)**:
   - `rescheduleAll()` will only schedule repeating daily OS alarms for types `DAILY_SPEND` and `YESTERDAY_SPEND`.
   - Master rows for `BILL_DUE`, `LOAN_EMI`, `STATEMENT_GENERATED`, and `BILL_GENERATED` act as configuration records.
   - `rescheduleAll()` will call `syncBillNotifications()` and `syncLoanEmiNotifications()`, which query the master row's `hour` and `minute` preferences to schedule exact date triggers.

3. **Loan EMI Payment Awareness & Hooks (Builder Call)**:
   - In `syncLoanEmiNotifications()`, check `loan_payments` for payment records within the current billing cycle month (`strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')`). If an EMI has already been paid for this month, calculate the next due date for the upcoming month instead.
   - Clamp `emi_day` using `Math.min(loan.emi_day, new Date(year, month, 0).getDate())` to avoid invalid day rollovers.
   - Hook `syncLoanEmiNotifications()` into `loans.js` on `createLoan`, `updateLoan`, `deleteLoan`, and `recordPayment`.

4. **Missed Expense Alert Implementation (Builder Call)**:
   - Kept as a reliable repeating OS alarm at the user's selected morning time (default 09:00 AM) with balanced copy: *"No expenses logged for yesterday. Forgot to record a spend or had a zero-spend day? Tap to review 📊"*. This avoids reliance on native background fetch, which is throttled by Android Doze.
