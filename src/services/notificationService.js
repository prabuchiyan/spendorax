import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { executeSql } from '../database/db';
import {
  getNotifications,

  updateNotification } from
'../database/notifications';

// ── Configure how notifications appear when app is foregrounded ──
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

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
export async function scheduleNotification({ id, title, body, hour, minute, payload }) {
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
  } catch (e) {}

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
      sound: true
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
      try {await Notifications.cancelScheduledNotificationAsync(identifier);} catch (e) {}
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

    try {
      // Expo SDK 51 fires one minute early — compensate with +1
      const adjustedMinute = (n.minute + 1) % 60;
      const adjustedHour = n.minute + 1 >= 60 ?
      (n.hour + 1) % 24 :
      n.hour;

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: n.title,
          body: n.body,
          data: n.payload ?
          typeof n.payload === 'string' ?
          JSON.parse(n.payload) :
          n.payload :
          {},
          sound: true
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
  if (Platform.OS === 'web') return () => {}; // no-op on web

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    handleNotificationTap(data, navigationRef);
  });

  return () => sub.remove();
}

// ─────────────────────────────────────────
// Handle tap — navigate to correct screen
// ─────────────────────────────────────────
export function handleNotificationTap(data, navigationRef) {
  if (!data || !navigationRef?.isReady?.()) return;

  try {
    const { screen, loanId, billId, type } = data;

    switch (screen) {
      case 'LoanDetails':
        if (loanId) navigationRef.navigate('LoanDetails', { id: loanId });
        break;
      case 'BillDetail':
        if (billId) navigationRef.navigate('BillDetail', { id: billId });
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
      default:
        break;
    }
  } catch (e) {
    console.warn('Notification tap navigation failed', e);
  }
}

// ─────────────────────────────────────────
// Sync individual bill notifications
// ─────────────────────────────────────────
export async function syncBillNotifications() {
  if (Platform.OS === 'web') return;

  // 1. Cancel previously scheduled specific bill notifications
  try {
    const res = await executeSql(
      `SELECT notification_identifier FROM notifications WHERE type = ?`, ['SPECIFIC_BILL_DUE']
    );
    
    for (let i = 0; i < res.rows.length; i++) {
      const identifier = res.rows.item(i).notification_identifier;
      if (identifier) {
        try {
          await Notifications.cancelScheduledNotificationAsync(identifier);
        } catch (e) {}
      }
    }

    // 2. Remove them from DB to start fresh
    await executeSql(`DELETE FROM notifications WHERE type = ?`, ['SPECIFIC_BILL_DUE']);

    // 3. Fetch pending bills (including credit card statements)
    const billsRes = await executeSql(
      `SELECT * FROM bills WHERE is_paid = 0 AND deleted_at IS NULL AND is_recurring = 0 AND (status IS NULL OR status != 'paid')`
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < billsRes.rows.length; i++) {
      const bill = billsRes.rows.item(i);
      if (!bill.due_date) continue;

      const dueDate = new Date(bill.due_date);
      dueDate.setHours(0, 0, 0, 0);

      // Is it a credit card bill?
      const stmtRes = await executeSql(`SELECT id FROM credit_card_statements WHERE bill_id = ?`, [bill.id]);
      const isCreditCard = stmtRes.rows.length > 0;

      let reminderDays = isCreditCard ? 5 : (bill.reminder_days_before != null ? bill.reminder_days_before : 2);
      
      // Schedule one notification for each day from (dueDate - reminderDays) to dueDate
      for (let d = reminderDays; d >= 0; d--) {
        const scheduleDate = new Date(dueDate);
        scheduleDate.setDate(scheduleDate.getDate() - d);
        scheduleDate.setHours(9, 0, 0, 0); // 9:00 AM

        // Only schedule if the time is in the future
        if (scheduleDate.getTime() > new Date().getTime()) {
          const title = isCreditCard ? 'Credit Card Bill Due' : 'Bill Due Reminder';
          const dayWord = d === 0 ? 'today' : (d === 1 ? 'tomorrow' : `in ${d} days`);
          
          // Format amount beautifully
          const formattedAmount = Number(bill.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const body = `Your ${bill.name} bill of ${formattedAmount} is due ${dayWord}.`;
          
          try {
            const identifier = await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body,
                data: { screen: 'BillDetail', billId: bill.id, type: 'SPECIFIC_BILL_DUE' },
                sound: true
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: scheduleDate
              }
            });

            // Insert into notifications so we can cancel later if needed
            await executeSql(
              `INSERT INTO notifications (type, reference_id, title, body, enabled, hour, minute, notification_identifier, payload)
               VALUES (?, ?, ?, ?, 1, 9, 0, ?, ?)`,
              ['SPECIFIC_BILL_DUE', bill.id, title, body, identifier, JSON.stringify({ screen: 'BillDetail', billId: bill.id, type: 'SPECIFIC_BILL_DUE' })]
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

export default {
  requestPermission,
  scheduleNotification,
  cancelNotification,
  cancelByType,
  rescheduleAll,
  registerNotificationListener,
  handleNotificationTap,
  checkYesterdaySpend,
  checkBillDue,
  checkLoanEmi,
  syncBillNotifications
};