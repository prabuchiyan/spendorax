import { executeSql } from './db';

export async function createNotificationsTable() {
    await executeSql(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            reference_id INTEGER,
            title TEXT,
            body TEXT,
            enabled INTEGER DEFAULT 1,
            hour INTEGER DEFAULT 9,
            minute INTEGER DEFAULT 0,
            notification_identifier TEXT,
            payload TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
    `);

    // Seed default notification rows if not present
    const defaults = [
        {
            type: 'DAILY_SPEND',
            title: 'Daily Expense Reminder',
            body: "Don't forget to record today's expenses!",
            hour: 21,
            minute: 0,
            payload: JSON.stringify({ screen: 'TransactionAdd', type: 'DAILY_SPEND' }),
        },
        {
            type: 'YESTERDAY_SPEND',
            title: 'Yesterday Spend Check',
            body: "Did you forget to log yesterday's expenses?",
            hour: 9,
            minute: 0,
            payload: JSON.stringify({ screen: 'Transactions', type: 'YESTERDAY_SPEND' }),
        },
        {
            type: 'BILL_DUE',
            title: 'Bill Due Reminder',
            body: 'You have bills due soon. Tap to review.',
            hour: 9,
            minute: 0,
            payload: JSON.stringify({ screen: 'Bills', type: 'BILL_DUE' }),
        },
        {
            type: 'LOAN_EMI',
            title: 'Loan EMI Reminder',
            body: 'Your EMI payment is due. Tap to review.',
            hour: 9,
            minute: 0,
            payload: JSON.stringify({ screen: 'Loans', type: 'LOAN_EMI' }),
        },
    ];

    for (const n of defaults) {
        const existing = await executeSql(
            `SELECT id FROM notifications WHERE type = ? AND reference_id IS NULL LIMIT 1`,
            [n.type]
        );
        if (existing.rows.length === 0) {
            await executeSql(
                `INSERT INTO notifications (type, title, body, enabled, hour, minute, payload)
                VALUES (?, ?, ?, 1, ?, ?, ?)`,
                [n.type, n.title, n.body, n.hour, n.minute, n.payload]
            );
        }
    }
}

export async function getNotifications() {
    const res = await executeSql(`SELECT * FROM notifications ORDER BY id ASC`);
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
    return rows;
}

export async function getNotificationByType(type) {
    const res = await executeSql(
        `SELECT * FROM notifications WHERE type = ? AND reference_id IS NULL LIMIT 1`,
        [type]
    );
    if (res.rows.length === 0) return null;
    return res.rows.item(0);
}

export async function updateNotification(id, fields) {
    const sets = [];
    const vals = [];
    for (const k of Object.keys(fields)) {
        sets.push(`${k} = ?`);
        vals.push(fields[k]);
    }
    if (sets.length === 0) return;
    vals.push(id);
    await executeSql(
        `UPDATE notifications SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
        vals
    );
}

export default { createNotificationsTable, getNotifications, getNotificationByType, updateNotification };