import { executeSql } from '../database/db';

export async function createBudget({ category_id = null, monthly_limit = 0, month = null }) {
  const m = month || new Date().toISOString().slice(0, 7);
  const res = await executeSql(
    `INSERT INTO budgets (category_id, monthly_limit, month) VALUES (?,?,?)`,
    [category_id, monthly_limit, m]
  );
  return res.insertId;
}

export async function getBudgetsForMonth(month = null) {
  const m = month || new Date().toISOString().slice(0, 7);
  const res = await executeSql(`SELECT * FROM budgets WHERE month = ?`, [m]);
  const rows = [];
  for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
  return rows;
}

import { getTransactions } from './transactions';

export async function getBudgetRemaining(budgetId) {
  // fetch budget
  const res = await executeSql(`SELECT * FROM budgets WHERE id = ?`, [budgetId]);
  if (!res.rows.length) return null;
  const b = res.rows.item(0);
  const month = b.month || new Date().toISOString().slice(0, 7);

  // sum expenses for the budget's category in that month
  const all = await getTransactions(1000000);
  const spent = all.filter(t => {
    if (t.type !== 'expense') return false;
    if (!t.date || !t.date.startsWith(month)) return false;
    // If budget has a category_id, match only that category.
    // If budget.category_id is null, include all expense transactions (general budget).
    if (b.category_id) {
      return String(t.category_id) === String(b.category_id);
    }
    return true;
  }).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  return { budget: b, spent, remaining: (parseFloat(b.monthly_limit) || 0) - spent };
}

export async function getBudgetsWithRemaining(month = null) {
  const m = month || new Date().toISOString().slice(0, 7);
  const budgets = await getBudgetsForMonth(m);
  const results = [];
  for (const b of budgets) {
    const info = await getBudgetRemaining(b.id);
    results.push(info);
  }
  return results;
}

export async function updateBudget(id, { category_id = null, monthly_limit = 0, month = null }) {
  const m = month || new Date().toISOString().slice(0, 7);
  await executeSql(`UPDATE budgets SET category_id = ?, monthly_limit = ?, month = ? WHERE id = ?`, [category_id, monthly_limit, m, id]);
}

export async function deleteBudget(id) {
  await executeSql(`DELETE FROM budgets WHERE id = ?`, [id]);
}

export async function getBudgets() {
  const res = await executeSql(`SELECT * FROM budgets`, []);
  const rows = [];
  for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
  return rows;
}

export default { createBudget, getBudgetsForMonth, updateBudget, deleteBudget, getBudgets };

