export const getBudgetStatusTool = {
  name: 'get_budget_status',
  description: 'Get the current overall budget status.',
  parameters: {},
  permission: 'READ',
  execute: async () => {
    // Mock database call for Phase 1
    console.log(`[Mock] Executing get_budget_status`);
    return {
      totalBudget: 25000,
      totalSpent: 18450,
      remaining: 6550,
      percentageUsed: 73.8
    };
  }
};
