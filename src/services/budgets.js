import { executeSql } from '../database/db';
import {
  getTransactions,
  getHomeExpenseTransactions,
} from "./transactions";

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

export async function getHomeBudgets(month = null) {
  try {
    const monthKey =
      month ||
      new Date().toISOString().slice(0, 7);

    const budgets =
      await getBudgetsForMonth(monthKey);

    if (!budgets.length) {
      return [];
    }

    const transactions =
      await getHomeExpenseTransactions(
        new Date()
      );

    const spendingMap = {};
    let totalSpent = 0;

    transactions.forEach((tx) => {
      const amount = Number(tx.amount || 0);

      if (amount <= 0) {
        return;
      }

      const categoryId =
        tx.category_id !== null &&
          tx.category_id !== undefined
          ? String(tx.category_id)
          : "uncategorized";

      spendingMap[categoryId] =
        Number(spendingMap[categoryId] || 0) +
        amount;

      totalSpent += amount;
    });

    return budgets.map((budget) => {
      const limit =
        Number(budget.monthly_limit || 0);

      let spent = 0;

      if (
        budget.category_id !== null &&
        budget.category_id !== undefined
      ) {
        spent =
          Number(
            spendingMap[
            String(budget.category_id)
            ] || 0
          );
      } else {
        spent = totalSpent;
      }

      return {
        budget,
        spent,
        remaining: limit - spent,
      };
    });
  } catch (error) {
    console.error(
      "getHomeBudgets error:",
      error
    );

    return [];
  }
}

export async function getBudgetRemaining(budgetId) {
  // fetch budget
  const res = await executeSql(`SELECT * FROM budgets WHERE id = ?`, [budgetId]);
  if (!res.rows.length) return null;
  const b = res.rows.item(0);
  const month = b.month || new Date().toISOString().slice(0, 7);

  // onlyCounted = true — excluded transactions don't count against budget
  const all = await getTransactions(1000000, 'No', null, null, null, new Date(), true);
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

export default { createBudget, getBudgetsForMonth, getHomeBudgets, updateBudget, deleteBudget, getBudgets };

