import { Platform } from "react-native";
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

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const spentByCategory = {};
    
    if (Platform.OS === 'web') {
        const txRes = await executeSql(`SELECT * FROM transactions WHERE type = 'expense'`);
        for (let i = 0; i < txRes.rows.length; i++) {
            const tx = txRes.rows.item(i);
            if (tx.transfer_group_id) continue;
            if (tx.direction === 'transfer') continue;
            if (tx.is_counted !== null && tx.is_counted !== undefined && Number(tx.is_counted) === 0) continue;
            const txDateStr = String(tx.date || '').replace(' ', 'T');
            if (!txDateStr.startsWith(monthStr)) continue;
            
            if (tx.category_id !== null && tx.category_id !== undefined) {
                const catId = String(tx.category_id);
                spentByCategory[catId] = (spentByCategory[catId] || 0) + (parseFloat(tx.amount) || 0);
            }
        }
    } else {
        // Optimize: Fetch exactly the aggregated spent amounts for this month directly from SQLite on mobile
        const txRes = await executeSql(
            `SELECT category_id, SUM(amount) as spent 
             FROM transactions 
             WHERE type = 'expense' 
               AND transfer_group_id IS NULL 
               AND (direction IS NULL OR direction != 'transfer')
               AND (is_counted IS NULL OR is_counted != 0)
               AND REPLACE(date, ' ', 'T') LIKE ?
             GROUP BY category_id`,
            [`${monthStr}%`]
        );

        for (let i = 0; i < txRes.rows.length; i++) {
            const row = txRes.rows.item(i);
            if (row.category_id !== null && row.category_id !== undefined) {
                spentByCategory[String(row.category_id)] = parseFloat(row.spent) || 0;
            }
        }
    }

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

export async function copyCategoryBudgets({
    fromMonth,
    fromYear,
    toMonth,
    toYear,
    overwrite = false,
}) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    /*
     * Copying budgets is ONLY allowed into the current month.
     *
     * This prevents:
     * - Copying into future months
     * - Copying into old months
     * - Accidental creation of future category budgets
     */
    if (
        Number(toMonth) !== currentMonth ||
        Number(toYear) !== currentYear
    ) {
        throw new Error(
            'Category budgets can only be copied into the current month.'
        );
    }

    /*
     * We allow copying from any month into the current month.
     */
    const sourceBudgets = await getCategoryBudgets(
        fromMonth,
        fromYear
    );
    const targetBudgets = await getCategoryBudgets(
        toMonth,
        toYear
    );
    const targetMap = {};
    targetBudgets.forEach((budget) => {
        targetMap[String(budget.category_id)] = budget;
    });
    const copied = [];
    for (const budget of sourceBudgets) {
        const categoryId = Number(
            budget.category_id
        );
        const amount = Number(
            budget.amount || 0
        );
        if (!categoryId || amount <= 0) {
            continue;
        }
        const hasTarget =
            !!targetMap[String(categoryId)];

        /*
         * Never overwrite an existing current-month
         * category budget unless explicitly requested.
         */
        if (hasTarget && !overwrite) {
            continue;
        }
        await saveCategoryBudget(
            categoryId,
            amount,
            toMonth,
            toYear
        );
        copied.push({
            categoryId,
            amount,
        });
    }
    return copied;
}

export async function getCategoryBudgetsForMonth(month, year) {
    try {
        const res = await executeSql(
            `SELECT *
                FROM category_budgets
                WHERE month = ? AND year = ?
                ORDER BY category_id`,
            [month, year]
        );

        const rows = [];

        if (!res?.rows || !Number.isFinite(res.rows.length)) {
            return rows;
        }

        for (let i = 0; i < res.rows.length; i++) {
            rows.push(res.rows.item(i));
        }

        return rows;
    } catch (error) {
        console.error('getCategoryBudgetsForMonth error:', error);
        return [];
    }
}

export async function getHomeCategoryBudgets(
    month,
    year,
    categoriesMap = {}
) {
    try {
        const budgets =
            await getCategoryBudgetsForMonth(
                month,
                year
            );

        if (!budgets.length) {
            return [];
        }

        const {
            getHomeExpenseTransactions,
        } = await import("./transactions");

        const transactions =
            await getHomeExpenseTransactions(
                new Date(year, month - 1, 1)
            );

        const spentMap = {};

        transactions.forEach((tx) => {
            if (
                tx.category_id === null ||
                tx.category_id === undefined
            ) {
                return;
            }

            const categoryId =
                String(tx.category_id);

            spentMap[categoryId] =
                Number(spentMap[categoryId] || 0) +
                Number(tx.amount || 0);
        });

        return budgets.map((budget) => {
            const categoryId =
                budget.category_id;

            const category =
                categoriesMap?.[String(categoryId)] ||
                categoriesMap?.[Number(categoryId)] ||
                {};

            const budgetAmount =
                Number(budget.amount || 0);

            const spent =
                Number(
                    spentMap[String(categoryId)] || 0
                );

            const remaining =
                budgetAmount - spent;

            const percentage =
                budgetAmount > 0
                    ? (spent / budgetAmount) * 100
                    : 0;

            return {
                id: budget.id,
                categoryId,
                categoryName:
                    category.name || "Uncategorized",
                icon:
                    category.icon || "tag",
                color:
                    category.color || "#ccc",
                budget: budgetAmount,
                spent,
                remaining,
                percentage,
                exceeded:
                    spent > budgetAmount,
            };
        });
    } catch (error) {
        console.error(
            "getHomeCategoryBudgets error:",
            error
        );

        return [];
    }
}

export async function getAvailableBudgetMonths() {
    const res = await executeSql(
        `SELECT DISTINCT month, year FROM category_budgets ORDER BY year DESC, month DESC`
    );
    const rows = [];
    for (let i = 0; i < res.rows.length; i++) {
        rows.push(res.rows.item(i));
    }
    return rows;
}

export default {
    getCategoryBudgets,
    saveCategoryBudget,
    deleteCategoryBudget,
    getCategoryBudgetSummary,
    copyCategoryBudgets,
    getCategoryBudgetsForMonth,
    getHomeCategoryBudgets,
    getAvailableBudgetMonths
};
