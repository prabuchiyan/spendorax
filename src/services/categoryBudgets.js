import { executeSql } from '../database/db';
import { getTransactions } from './transactions';
import { getCategories } from './categories';

export async function getCategoryBudgets(month, year) {
    const res = await executeSql(
        `SELECT * FROM category_budgets WHERE month = ? AND year = ? ORDER BY category_id`,
        [month, year]
    );
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) {
        rows.push(res.rows.item(i));
    }
    return rows;
}

export async function saveCategoryBudget(categoryId, amount, month, year) {
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    // Check if exists
    const existing = await executeSql(
        `SELECT * FROM category_budgets WHERE category_id = ? AND month = ? AND year = ?`,
        [categoryId, month, year]
    );

    if (existing.rows.length > 0) {
        // Update
        const id = existing.rows.item(0).id;
        await executeSql(
            `UPDATE category_budgets SET amount = ?, updated_at = ? WHERE id = ?`,
            [amount, now, id]
        );
        return id;
    } else {
        // Insert
        const res = await executeSql(
            `INSERT INTO category_budgets (category_id, amount, month, year, created_at, updated_at) VALUES (?,?,?,?,?,?)`,
            [categoryId, amount, month, year, now, now]
        );
        return res.insertId;
    }
}

export async function deleteCategoryBudget(id) {
    await executeSql(`DELETE FROM category_budgets WHERE id = ?`, [id]);
}

export async function getCategoryBudgetSummary(month, year) {
    const budgets = await getCategoryBudgets(month, year);
    const categories = await getCategories(true);
    const transactions = await getTransactions(1000000);

    // Calculate spent for each category
    const spentByCategory = {};
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    transactions.forEach(tx => {
        // Only expenses, exclude transfers
        if (tx.type !== 'expense') return;
        if (!tx.date) return;

        // Check if date matches month
        const txDateStr = String(tx.date).replace(' ', 'T');
        if (!txDateStr.startsWith(monthStr)) return;

        // Exclude transfer transactions
        if (tx.direction === 'transfer' || tx.transfer_group_id) return;

        const catId = String(tx.category_id);
        spentByCategory[catId] = (spentByCategory[catId] || 0) + (parseFloat(tx.amount) || 0);
    });

    // Build summary
    const summary = budgets.map(budget => {
        const category = categories.find(c => c.id === budget.category_id);
        const spent = spentByCategory[String(budget.category_id)] || 0;
        const budget_amount = parseFloat(budget.amount) || 0;
        const remaining = budget_amount - spent;
        const percentage = budget_amount > 0 ? (spent / budget_amount) * 100 : 0;
        const exceeded = spent > budget_amount;

        return {
            id: budget.id,
            categoryId: budget.category_id,
            categoryName: category ? category.name : 'Uncategorized',
            icon: category ? category.icon : 'tag',
            color: category ? category.color : '#ccc',
            budget: budget_amount,
            spent,
            remaining,
            percentage,
            exceeded
        };
    });

    return summary;
}

export default {
    getCategoryBudgets,
    saveCategoryBudget,
    deleteCategoryBudget,
    getCategoryBudgetSummary
};
