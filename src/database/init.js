import { executeSql } from './db';
import { Platform } from 'react-native';

export async function initDB() {
  try {
    // Categories
    await executeSql(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );`);

    // Sources
    await executeSql(`CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      initial_balance REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      icon TEXT,
      color TEXT
    );`);

    // Transactions
    await executeSql(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id INTEGER,
      source_id INTEGER,
      date TEXT,
      notes TEXT,
      bill_id INTEGER,
      transfer_group_id TEXT,
      direction TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(category_id) REFERENCES categories(id),
      FOREIGN KEY(source_id) REFERENCES sources(id)
    );`);

    // Budgets
    await executeSql(`CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      monthly_limit REAL NOT NULL,
      month TEXT NOT NULL
    );`);

    // Category Budgets
    await executeSql(`CREATE TABLE IF NOT EXISTS category_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(category_id, month, year)
    );`);

    // Bills
    await executeSql(`CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT,
      status TEXT DEFAULT 'pending',
      is_recurring INTEGER DEFAULT 0,
      recurrence_type TEXT,
      recurrence_interval INTEGER DEFAULT 1,
      recurrence_end_date TEXT,
      category_id INTEGER,
      source_id INTEGER,
      reminder_days_before INTEGER DEFAULT 2,
      last_reminded_at TEXT,
      auto_pay INTEGER DEFAULT 0,
      notes TEXT,
      attachment_url TEXT,
      linked_transaction_id INTEGER,
      paid_at TEXT,
      is_paid INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );`);

    // Migrate legacy is_paid rows to status column
    try {
      await executeSql(
        `UPDATE bills SET status = 'paid', paid_at = datetime('now') WHERE is_paid = 1 AND (status IS NULL OR status = 'pending')`,
        []
      );
      const today = new Date().toISOString().slice(0, 10);
      await executeSql(
        `UPDATE bills SET status = 'overdue' WHERE is_paid = 0 AND due_date < ? AND (status IS NULL OR status = 'pending')`,
        [today]
      );
      await executeSql(
        `UPDATE bills SET status = 'pending' WHERE is_paid = 0 AND (status IS NULL OR status = '')`,
        []
      );
    } catch (e) {
      // web shim may not support complex UPDATE; handled in service layer
    }

    console.log('Database initialized');
    // Seed defaults if empty (helpful for web/local dev)
    try {
      const cats = await executeSql('SELECT * FROM categories', []);
      if (cats.rows.length === 0) {
        const defaultCats = [
          // 💰 Income
          ['Salary', 'income', 'cash-multiple', '#16A34A'],
          ['Interest', 'income', 'percent', '#22C55E'],
          ['Money Received', 'income', 'arrow-down-bold-circle', '#10B981'],

          // 🔁 Transfers / Lending
          ['Money Given', 'expense', 'arrow-up-bold-circle', '#EF4444'],
          ['Wallet Transfer', 'expense', 'swap-horizontal', '#6366F1'],

          // 🍔 Food
          ['Food & Dining', 'expense', 'silverware-fork-knife', '#F59E0B'],
          ['Snacks', 'expense', 'food-variant', '#FBBF24'],

          // 🏠 Living
          ['Rent', 'expense', 'home-account', '#3B82F6'],
          ['Groceries', 'expense', 'cart', '#F97316'],
          ['Utilities', 'expense', 'lightning-bolt', '#64748B'],
          ['Home Improvement', 'expense', 'hammer-wrench', '#A16207'],

          // 📱 Bills & Services
          ['Mobile Recharge', 'expense', 'cellphone', '#0EA5E9'],
          ['DTH', 'expense', 'television-play', '#8B5CF6'],
          ['Printing & Stationery', 'expense', 'printer', '#6B7280'],

          // 🚗 Transport
          ['Transport', 'expense', 'bus', '#14B8A6'],
          ['Bike / Vehicle', 'expense', 'motorbike', '#DC2626'],

          // 🎁 Social
          ['Gifts', 'expense', 'gift', '#EC4899'],
          ['Family', 'expense', 'account-group', '#F43F5E'],
          ['Donations', 'expense', 'hand-heart', '#22C55E'],

          // 🎉 Lifestyle
          ['Entertainment', 'expense', 'movie-open', '#7C3AED'],
          ['Savings', 'expense', 'piggy-bank', '#059669'],
          ['Loan / EMI', 'expense', 'bank-transfer', '#B91C1C'],
          ['Bank Charges', 'expense', 'bank', '#374151'],
          ['Misc', 'expense', 'dots-horizontal', '#9CA3AF'],
        ];

        for (const c of defaultCats) {
          await executeSql(
            'INSERT INTO categories (name, type, icon, color) VALUES (?,?,?,?)',
            c
          );
        }
      }
    } catch (e) {
      console.warn('Seeding categories failed', e);
    }

    try {
      const src = await executeSql('SELECT * FROM sources', []);
      if (src.rows.length === 0) {
        const defaults = [['Cash', null, 0], ['Bank', null, 0]];
        for (const s of defaults) {
          await executeSql('INSERT INTO sources (name, type, initial_balance) VALUES (?,?,?)', s);
        }
      }
    } catch (e) {
      console.warn('Seeding sources failed', e);
    }
  } catch (err) {
    console.error('DB init error', err);
  }
}

export async function clearAllTables() {
  const tables = ['transactions', 'bills', 'budgets', 'category_budgets', 'categories', 'sources'];

  try {
    for (const table of tables) {
      await executeSql(`DELETE FROM ${table}`);

      if (Platform.OS !== 'web') {
        try {
          await executeSql(`DELETE FROM sqlite_sequence WHERE name = ?`, [table]);
        } catch (seqError) {
          console.warn(`Failed to reset SQLite sequence for ${table}:`, seqError);
        }
      } else {
        const prefix = 'mm_db_';
        localStorage.setItem(`${prefix}${table}`, JSON.stringify([]));
        localStorage.setItem(`${prefix}${table}_meta`, JSON.stringify({ nextId: 1 }));
      }
    }
  } catch (e) {
    console.error('Clear DB failed', e);
    throw e;
  }
}

