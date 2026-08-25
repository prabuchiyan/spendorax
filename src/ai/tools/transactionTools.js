export const getCategorySpendingTool = {
  name: 'get_category_spending',
  description: 'Get total spending for a category during a specified period.',
  parameters: {
    category: 'string',
    period: 'string'
  },
  permission: 'READ',
  execute: async (params) => {
    // Mock database call for Phase 1
    console.log(`[Mock] Executing get_category_spending for ${params.category} in ${params.period}`);
    return {
      category: params.category,
      total: 8420,
      transactionCount: 23,
      period: params.period
    };
  }
};
