export const getTopExpensesTool = {
  name: 'get_top_expenses',
  description: 'Get the top expenses for a specified period.',
  parameters: {
    period: 'string',
    limit: 'number'
  },
  permission: 'READ',
  execute: async (params) => {
    // Mock database call for Phase 1
    console.log(`[Mock] Executing get_top_expenses`);
    return [
      { description: 'Amazon', amount: 4500, category: 'Shopping' },
      { description: 'Groceries', amount: 3200, category: 'Food' },
      { description: 'Electric Bill', amount: 1500, category: 'Bills' }
    ];
  }
};
