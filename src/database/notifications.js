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
            title: '📝 Daily Expense Check-in',
            body: "Spent anything today? Take 15 seconds to log your expenses and keep your budget in check 🎯",
            hour: 21,
            minute: 0,
            payload: JSON.stringify({ screen: 'TransactionAdd', type: 'DAILY_SPEND' }),
        },
        {
            type: 'YESTERDAY_SPEND',
            title: '⚠️ Missed Expense Alert',
            body: "No expenses logged for yesterday. Forgot to record a spend or had a zero-spend day? Tap to review 📊",
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
        {
            type: 'STATEMENT_GENERATED',
            title: 'Statement Generated Alert',
            body: 'Notifies when a credit card statement is ready',
            hour: 9,
            minute: 0,
            payload: JSON.stringify({ screen: 'CreditCardStatements', type: 'STATEMENT_GENERATED' }),
        },
        {
            type: 'BILL_GENERATED',
            title: 'New Bill Generated Alert',
            body: 'Notifies when a recurring bill occurrence is scheduled',
            hour: 9,
            minute: 0,
            payload: JSON.stringify({ screen: 'Bills', type: 'BILL_GENERATED' }),
        }
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
    const res = await executeSql(
        `SELECT id, type, title, body, enabled, hour, minute, payload 
            FROM notifications 
            WHERE reference_id IS NULL
            ORDER BY id ASC`
    );
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) {
        const row = res.rows.item(i);

        // Detect and fix column swap corruption:
        // On web localStorage shim, columns may have been stored in wrong order
        // causing payload JSON to land in 'minute' and actual minute in 'hour'
        const isCorrupted =
            typeof row.minute === 'string' && row.minute.startsWith('{');

        if (isCorrupted) {
            rows.push({
                ...row,
                // hour and minute were swapped with payload
                hour: typeof row.enabled === 'number' && row.enabled <= 23 ? row.enabled : 0,
                minute: typeof row.hour === 'number' && row.hour <= 59 ? row.hour : 0,
                enabled: 0,
                payload: row.minute, // the JSON string that landed in minute
            });
        } else {
            rows.push(row);
        }
    }
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

export async function isNotificationEnabled(type) {
    const row = await getNotificationByType(type);
    return row ? Boolean(row.enabled) : false;
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

export default { createNotificationsTable, getNotifications, getNotificationByType, isNotificationEnabled, updateNotification };