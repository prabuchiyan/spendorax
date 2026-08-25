import { getBudgetsWithRemaining } from '../../services/budgets';

export const getBudgetStatusTool = {
  name: 'get_budget_status',
  description: 'Get the current overall budget status.',
  parameters: {},
  permission: 'READ',
  execute: async () => {
    try {
      const monthStr = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
      const budgets = await getBudgetsWithRemaining(monthStr);

      let totalBudget = 0;
      let totalSpent = 0;

      for (const b of budgets) {
        totalBudget += Number(b.budget.monthly_limit || 0);
        totalSpent += Number(b.spent || 0);
      }

      const remaining = totalBudget - totalSpent;
      const percentageUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

      return {
        totalBudget,
        totalSpent,
        remaining,
        percentageUsed: Number(percentageUsed.toFixed(1))
      };
    } catch (e) {
      console.error('Failed to get_budget_status:', e);
      throw new Error('Could not fetch budget status from database');
    }
  }
};
