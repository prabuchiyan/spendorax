import { executeSql } from './db';

export async function createLoanTables() {
  // loans table
  await executeSql(`CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_name TEXT,
    loan_type TEXT,
    lender TEXT,
    principal_amount REAL DEFAULT 0,
    interest_rate REAL DEFAULT 0,
    loan_start_date TEXT,
    loan_end_date TEXT,
    tenure_months INTEGER DEFAULT 0,
    emi_amount REAL DEFAULT 0,
    emi_day INTEGER,
    outstanding_amount REAL DEFAULT 0,
    principal_paid REAL DEFAULT 0,
    interest_paid REAL DEFAULT 0,
    total_paid REAL DEFAULT 0,
    total_prepayment REAL DEFAULT 0,
    remaining_months INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );`);

  // loan payments table
  await executeSql(`CREATE TABLE IF NOT EXISTS loan_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER NOT NULL,
    payment_date TEXT,
    payment_amount REAL DEFAULT 0,
    principal_component REAL DEFAULT 0,
    interest_component REAL DEFAULT 0,
    remaining_balance REAL DEFAULT 0,
    payment_type TEXT,
    payment_source_id INTEGER,
    transaction_id INTEGER,
    remarks TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(loan_id) REFERENCES loans(id)
  );`);
}

export default createLoanTables;
