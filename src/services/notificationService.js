import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { executeSql } from '../database/db';
import {
    getNotifications,
    getNotificationByType,
    updateNotification,
} from '../database/notifications';

// ── Configure how notifications appear when app is foregrounded ──
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
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
        return fakeIdentifier; // ← removed updateNotification here
    }

    // Cancel previous if exists
    const existing = await executeSql(
        `SELECT notification_identifier FROM notifications WHERE id = ? LIMIT 1`, [id]
    );
    if (existing.rows.length > 0) {
        const identifier = existing.rows.item(0).notification_identifier;
        if (identifier) {
            try { await Notifications.cancelScheduledNotificationAsync(identifier); } catch (e) { }
        }
    }

    const identifier = await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: payload ? (typeof payload === 'string' ? JSON.parse(payload) : payload) : {},
            sound: true,
        },
        trigger: {
            hour,
            minute,
            repeats: true,
        },
    });

    // Only save identifier, NOT hour/minute — caller owns those
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
        console.warn('Cancel notification failed', e);
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
    if (Platform.OS === 'web') return; // no-op on web
    const notifications = await getNotifications();
    for (const n of notifications) {
        if (n.enabled) {
            await scheduleNotification({
                id: n.id,
                title: n.title,
                body: n.body,
                hour: n.hour,
                minute: n.minute,
                payload: n.payload,
            });
        } else {
            if (n.notification_identifier) {
                await cancelNotification(n.notification_identifier);
            }
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
         AND deleted_at IS NULL
         AND date(due_date) <= date(?, '+' || IFNULL(reminder_days_before, 2) || ' days')
         AND date(due_date) >= date(?)`,
        [today, today]
    );

    const rows = [];
    for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
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

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
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
            default:
                break;
        }
    } catch (e) {
        console.warn('Notification tap navigation failed', e);
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
};