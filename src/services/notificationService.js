import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { executeSql } from '../database/db';
import {
  getNotifications,
  getNotificationByType,
  updateNotification
} from '../database/notifications';

// ── Configure how notifications appear when app is foregrounded ──
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

// ─────────────────────────────────────────
// Setup Android Notification Channels
// ─────────────────────────────────────────
export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync('bills_channel', {
      name: 'Bills & Payments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#DC2626',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('statements_channel', {
      name: 'Credit Card Statements',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('loans_channel', {
      name: 'Loan EMIs',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#059669',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('daily_reminders_channel', {
      name: 'Daily Expense Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  } catch (e) {
    console.warn('Failed to setup notification channels:', e);
  }
}

// ─────────────────────────────────────────
// Permission
// ─────────────────────────────────────────
export async function requestPermission() {
  if (Platform.OS === 'web') return true; // pretend granted on web
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─────────────────────────────────────────
// Schedule a daily repeating notification
// ─────────────────────────────────────────
export async function scheduleNotification({ id, title, body, hour, minute, payload, channelId }) {
  if (Platform.OS === 'web') {
    const fakeIdentifier = `web-mock-${id}-${Date.now()}`;
    return fakeIdentifier;
  }

  // Cancel only the previous identifier for this specific notification
  try {
    const existing = await executeSql(
      `SELECT notification_identifier FROM notifications WHERE id = ? LIMIT 1`, [id]
    );
    if (existing.rows.length > 0) {
      const oldIdentifier = existing.rows.item(0).notification_identifier;
      if (oldIdentifier) {
        await Notifications.cancelScheduledNotificationAsync(oldIdentifier);
      }
    }
  } catch (e) { }

  // Expo SDK 51 fires one minute early — compensate
  const adjustedMinute = (minute + 1) % 60;
  const adjustedHour = minute + 1 >= 60 ? (hour + 1) % 24 : hour;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: payload ?
        typeof payload === 'string' ? JSON.parse(payload) : payload :
        {},
      sound: true,
      channelId: channelId || 'daily_reminders_channel'
    },
    trigger: {
      hour: adjustedHour,
      minute: adjustedMinute,
      repeats: true
    }
  });

  return identifier;
}

// ─────────────────────────────────────────
// Cancel by identifier
// ─────────────────────────────────────────
export async function cancelNotification(identifier) {
  if (!identifier || Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (e) {
    console.warn('Individual cancel failed, skipping', e);
  }
}

// ─────────────────────────────────────────
// Cancel all notifications of a type
// ─────────────────────────────────────────
export async function cancelByType(type) {
  if (Platform.OS === 'web') return;
  const res = await executeSql(
    `SELECT notification_identifier FROM notifications WHERE type = ?`, [type]
  );
  for (let i = 0; i < res.rows.length; i++) {
    const identifier = res.rows.item(i).notification_identifier;
    if (identifier) {
      try { await Notifications.cancelScheduledNotificationAsync(identifier); } catch (e) { }
    }
  }
}

// ─────────────────────────────────────────
// Reschedule all enabled notifications
// Called on app start to restore after restart
// ─────────────────────────────────────────
export async function rescheduleAll() {
  if (Platform.OS === 'web') return;

  // Cancel ALL first — prevents stacking duplicates on every app start
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('Failed to cancel all notifications', e);
  }

  const notifications = await getNotifications();

  for (const n of notifications) {
    if (!n.enabled) continue;

    // Only master types DAILY_SPEND and YESTERDAY_SPEND get repeating triggers
    if (n.type !== 'DAILY_SPEND' && n.type !== 'YESTERDAY_SPEND') continue;

    try {
      // Expo SDK 51 fires one minute early — compensate with +1
      const adjustedMinute = (n.minute + 1) % 60;
      const adjustedHour = n.minute + 1 >= 60 ?
        (n.hour + 1) % 24 :
        n.hour;

      let channelId = 'daily_reminders_channel';
      let title = n.title;
      let body = n.body;

      if (n.type === 'DAILY_SPEND') {
        title = '📝 Daily Expense Check-in';
        body = "Spent anything today? Take 15 seconds to log your expenses and keep your budget in check 🎯";
      } else if (n.type === 'YESTERDAY_SPEND') {
        title = '⚠️ Missed Expense Alert';
        body = "No expenses logged for yesterday. Forgot to record a spend or had a zero-spend day? Tap to review 📊";
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: n.payload ?
            typeof n.payload === 'string' ?
              JSON.parse(n.payload) :
              n.payload :
            {},
          sound: true,
          channelId
        },
        trigger: {
          hour: adjustedHour,
          minute: adjustedMinute,
          repeats: true
        }
      });

      // Save new identifier quietly
      await updateNotification(n.id, {
        notification_identifier: identifier
      });
    } catch (e) {
      console.warn('Failed to reschedule notification', n.type, e);
    }
  }

  // Delegate date-specific notifications
  await syncBillNotifications();
  await syncLoanEmiNotifications();
}

// ─────────────────────────────────────────
// Check yesterday's spend
// Returns true if NO expense was recorded yesterday
// ─────────────────────────────────────────
export async function checkYesterdaySpend() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const res = await executeSql(
    `SELECT COUNT(*) as count FROM transactions
         WHERE type = 'expense' AND date LIKE ?`,
    [`${dateStr}%`]
  );
  const count = res.rows.item(0).count;
  return count === 0; // true = no spend yesterday = should notify
}

// ─────────────────────────────────────────
// Check bills due
// Returns array of due bills
// ─────────────────────────────────────────
export async function checkBillDue() {
  const today = new Date().toISOString().slice(0, 10);

  const res = await executeSql(
    `SELECT * FROM bills
         WHERE is_paid = 0
         AND deleted_at IS NULL`
  );

  const rows = [];
  const todayObj = new Date(today);

  for (let i = 0; i < res.rows.length; i++) {
    const bill = res.rows.item(i);
    if (!bill.due_date) continue;

    const dueDate = new Date(bill.due_date.substring(0, 10));
    const reminderDays = bill.reminder_days_before !== null && bill.reminder_days_before !== undefined
      ? Number(bill.reminder_days_before)
      : 2;

    // Calculate the trigger date (due_date - reminder_days_before)
    const triggerDate = new Date(dueDate);
    triggerDate.setDate(triggerDate.getDate() - reminderDays);

    // Check if today is between triggerDate and dueDate (inclusive)
    if (todayObj >= triggerDate && todayObj <= dueDate) {
      rows.push(bill);
    }
  }
  return rows;
}

// ─────────────────────────────────────────
// Check loan EMIs due
// Returns array of loans with EMI due today
// ─────────────────────────────────────────
export async function checkLoanEmi() {
  const today = new Date();
  const todayDay = today.getDate();

  const res = await executeSql(
    `SELECT * FROM loans
         WHERE status = 'Active'
         AND loan_direction = 'BORROWED'
         AND emi_day = ?`,
    [todayDay]
  );

  const rows = [];
  for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
  return rows;
}

// ─────────────────────────────────────────
// Register tap handler — call once on app start
// ─────────────────────────────────────────
export function registerNotificationListener(navigationRef) {
  if (Platform.OS === 'web') return () => { }; // no-op on web

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    handleNotificationTap(data, navigationRef);
  });

  return () => sub.remove();
}

let pendingNotificationData = null;

// ─────────────────────────────────────────
// Handle tap — navigate to correct screen
// ─────────────────────────────────────────
export function handleNotificationTap(data, navigationRef) {
  if (!data) return;
  if (!navigationRef?.isReady?.()) {
    // App is likely locked or navigation is not mounted yet
    pendingNotificationData = data;
    return;
  }

  try {
    const { screen, loanId, billId, statementId, cardId, type } = data;

    switch (screen) {
      case 'CreditCardStatementDetail':
        if (statementId) {
          navigationRef.navigate('CreditCardStatementDetail', {
            statementId: Number(statementId),
            id: Number(statementId),
            cardId: cardId ? Number(cardId) : undefined
          });
        } else {
          navigationRef.navigate('CreditCardStatements');
        }
        break;
      case 'LoanDetails':
        if (loanId) navigationRef.navigate('LoanDetails', { id: Number(loanId) });
        break;
      case 'BillDetail':
        if (billId) navigationRef.navigate('BillDetail', { id: Number(billId) });
        break;
      case 'TransactionAdd':
        navigationRef.navigate('TransactionAdd');
        break;
      case 'Transactions':
        navigationRef.navigate('Drawer', { screen: 'Transactions' });
        break;
      case 'Bills':
        navigationRef.navigate('Bills');
        break;
      case 'Loans':
        navigationRef.navigate('Drawer', { screen: 'Loans' });
        break;
      case 'CreditCards':
        navigationRef.navigate('Drawer', { screen: 'CreditCards' });
        break;
      case 'CreditCardStatements':
        navigationRef.navigate('CreditCardStatements');
        break;
      default:
        break;
    }
  } catch (e) {
    console.warn('Notification tap navigation failed', e);
  }
}

// ─────────────────────────────────────────
// Process pending notification (called after login/ready)
// ─────────────────────────────────────────
export function processPendingNotification(navigationRef) {
  if (pendingNotificationData && navigationRef?.isReady?.()) {
    handleNotificationTap(pendingNotificationData, navigationRef);
    pendingNotificationData = null;
  }
}

// ─────────────────────────────────────────
// Sync individual bill notifications
// ─────────────────────────────────────────
export async function syncBillNotifications() {
  if (Platform.OS === 'web') return;

  try {
    // 1. Cancel previously scheduled specific bill notifications
    const res = await executeSql(
      `SELECT notification_identifier FROM notifications WHERE type = ?`, ['SPECIFIC_BILL_DUE']
    );

    for (let i = 0; i < res.rows.length; i++) {
      const identifier = res.rows.item(i).notification_identifier;
      if (identifier) {
        try {
          await Notifications.cancelScheduledNotificationAsync(identifier);
        } catch (e) { }
      }
    }

    // 2. Remove them from DB to start fresh
    await executeSql(`DELETE FROM notifications WHERE type = ?`, ['SPECIFIC_BILL_DUE']);

    // Check user preference
    const billDueConfig = await getNotificationByType('BILL_DUE');
    if (billDueConfig && !billDueConfig.enabled) {
      return; // Disabled by user in Settings
    }
    const configHour = billDueConfig && billDueConfig.hour != null ? Number(billDueConfig.hour) : 9;
    const configMinute = billDueConfig && billDueConfig.minute != null ? Number(billDueConfig.minute) : 0;

    // 3. Fetch pending bills (including credit card statements)
    const billsRes = await executeSql(
      `SELECT * FROM bills WHERE is_paid = 0 AND deleted_at IS NULL AND is_recurring = 0 AND (status IS NULL OR status != 'paid')`
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < billsRes.rows.length; i++) {
      const bill = billsRes.rows.item(i);
      if (!bill.due_date) continue;

      const billDueDateStr = String(bill.due_date || '').slice(0, 10);
      const dueDate = new Date(`${billDueDateStr}T00:00:00`);

      // Is it a credit card bill?
      const stmtRes = await executeSql(`SELECT id FROM credit_card_statements WHERE bill_id = ?`, [bill.id]);
      const isCreditCard = stmtRes.rows.length > 0;

      let reminderDays = isCreditCard ? 5 : (bill.reminder_days_before != null ? Number(bill.reminder_days_before) : 2);

      const daysToSchedule = Array.from(new Set([reminderDays, 0]));

      for (let d of daysToSchedule) {
        const scheduleDate = new Date(dueDate);
        scheduleDate.setDate(scheduleDate.getDate() - d);
        scheduleDate.setHours(configHour, configMinute, 0, 0);

        // Only schedule if the time is in the future
        if (scheduleDate.getTime() > new Date().getTime()) {
          const dayWord = d === 0 ? 'Today' : (d === 1 ? 'Tomorrow' : `in ${d} days`);
          const title = `🔔 Bill Due ${dayWord} • ${bill.name}`;

          let accountName = '';
          if (bill.source_id) {
            try {
              const sRes = await executeSql(`SELECT name FROM sources WHERE id = ?`, [bill.source_id]);
              if (sRes.rows.length > 0) accountName = ` (${sRes.rows.item(0).name})`;
            } catch (e) { }
          }

          const formattedAmount = Number(bill.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const dueDateFormatted = dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          const body = `Amount: ₹${formattedAmount} | Due: ${dueDateFormatted}${accountName}\nTap to mark as paid or view details.`;

          try {
            const identifier = await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                data: { screen: 'BillDetail', billId: bill.id, type: 'SPECIFIC_BILL_DUE' },
                sound: true,
                channelId: 'bills_channel'
              },
              trigger: {
                date: scheduleDate
              }
            });

            // Insert into notifications so we can cancel later if needed
            await executeSql(
              `INSERT INTO notifications (type, reference_id, title, body, enabled, hour, minute, notification_identifier, payload)
               VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
              ['SPECIFIC_BILL_DUE', bill.id, title, body, configHour, configMinute, identifier, JSON.stringify({ screen: 'BillDetail', billId: bill.id, type: 'SPECIFIC_BILL_DUE' })]
            );
          } catch (e) {
            console.warn('Failed to schedule specific bill notification', e);
          }
        }
      }
    }
  } catch (err) {
    console.error('syncBillNotifications error', err);
  }
}

// ─────────────────────────────────────────
// Sync individual loan EMI notifications
// ─────────────────────────────────────────
export async function syncLoanEmiNotifications() {
  if (Platform.OS === 'web') return;

  try {
    // 1. Cancel previously scheduled specific loan notifications
    const res = await executeSql(
      `SELECT notification_identifier FROM notifications WHERE type = ?`, ['SPECIFIC_LOAN_EMI']
    );

    for (let i = 0; i < res.rows.length; i++) {
      const identifier = res.rows.item(i).notification_identifier;
      if (identifier) {
        try {
          await Notifications.cancelScheduledNotificationAsync(identifier);
        } catch (e) { }
      }
    }

    // 2. Remove them from DB
    await executeSql(`DELETE FROM notifications WHERE type = ?`, ['SPECIFIC_LOAN_EMI']);

    // Check user preference
    const loanConfig = await getNotificationByType('LOAN_EMI');
    if (loanConfig && !loanConfig.enabled) {
      return; // Disabled by user in Settings
    }
    const configHour = loanConfig && loanConfig.hour != null ? Number(loanConfig.hour) : 9;
    const configMinute = loanConfig && loanConfig.minute != null ? Number(loanConfig.minute) : 0;

    // 3. Fetch active borrowed loans
    const loansRes = await executeSql(
      `SELECT * FROM loans WHERE status = 'Active' AND loan_direction = 'BORROWED' AND emi_amount > 0 AND outstanding_amount > 0`
    );

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based
    const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    for (let i = 0; i < loansRes.rows.length; i++) {
      const loan = loansRes.rows.item(i);
      const emiDay = Number(loan.emi_day) || (loan.loan_start_date ? new Date(loan.loan_start_date).getDate() : now.getDate());

      // Check if already paid this month
      let isAlreadyPaidThisMonth = false;
      try {
        const payRes = await executeSql(
          `SELECT SUM(payment_amount) as total_paid FROM loan_payments WHERE loan_id = ? AND payment_date LIKE ?`,
          [loan.id, `${currentMonthPrefix}%`]
        );
        const paidThisMonth = payRes.rows.length > 0 ? Number(payRes.rows.item(0).total_paid || 0) : 0;
        isAlreadyPaidThisMonth = paidThisMonth >= (Number(loan.emi_amount || 0) * 0.9);
      } catch (e) { }

      // Calculate target year and month
      let targetYear = currentYear;
      let targetMonth = currentMonth;

      // If already paid this month, move to next month
      if (isAlreadyPaidThisMonth) {
        targetMonth += 1;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear += 1;
        }
      }

      // Clamp emiDay to last day of target month
      const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const clampedDay = Math.min(emiDay, lastDayOfTargetMonth);
      let targetDueDate = new Date(targetYear, targetMonth, clampedDay);

      // Check if the final reminder time for this targetDueDate (day 0 at configHour:configMinute) is already in the past
      const finalReminderDate = new Date(targetDueDate);
      finalReminderDate.setHours(configHour, configMinute, 0, 0);

      // If already paid or the reminder window has passed, advance to next month
      if (isAlreadyPaidThisMonth || finalReminderDate.getTime() <= now.getTime()) {
        targetMonth += 1;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear += 1;
        }
        const nextMonthLastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        targetDueDate = new Date(targetYear, targetMonth, Math.min(emiDay, nextMonthLastDay));
      }

      const daysToSchedule = [2, 0];
      for (const d of daysToSchedule) {
        const scheduleDate = new Date(targetDueDate);
        scheduleDate.setDate(scheduleDate.getDate() - d);
        scheduleDate.setHours(configHour, configMinute, 0, 0);

        if (scheduleDate.getTime() > now.getTime()) {
          const dayWord = d === 0 ? 'Today' : 'in 2 days';
          const title = `🚨 EMI Due ${dayWord} • ${loan.loan_name}`;
          const formattedEmi = Number(loan.emi_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const formattedOutstanding = Number(loan.outstanding_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const dueDateFormatted = targetDueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          const lenderStr = loan.lender ? ` | Lender: ${loan.lender}` : '';
          const body = `EMI: ₹${formattedEmi} | Due: ${dueDateFormatted}${lenderStr}\nRemaining: ₹${formattedOutstanding}. Tap to pay.`;

          try {
            const identifier = await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                data: { screen: 'LoanDetails', loanId: loan.id, type: 'SPECIFIC_LOAN_EMI' },
                sound: true,
                channelId: 'loans_channel'
              },
              trigger: {
                date: scheduleDate
              }
            });

            await executeSql(
              `INSERT INTO notifications (type, reference_id, title, body, enabled, hour, minute, notification_identifier, payload)
               VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
              ['SPECIFIC_LOAN_EMI', loan.id, title, body, configHour, configMinute, identifier, JSON.stringify({ screen: 'LoanDetails', loanId: loan.id, type: 'SPECIFIC_LOAN_EMI' })]
            );
          } catch (e) {
            console.warn('Failed to schedule specific loan notification', e);
          }
        }
      }
    }
  } catch (err) {
    console.error('syncLoanEmiNotifications error', err);
  }
}

export default {
  setupNotificationChannels,
  requestPermission,
  scheduleNotification,
  cancelNotification,
  cancelByType,
  rescheduleAll,
  registerNotificationListener,
  handleNotificationTap,
  processPendingNotification,
  checkYesterdaySpend,
  checkBillDue,
  checkLoanEmi,
  syncBillNotifications,
  syncLoanEmiNotifications
};