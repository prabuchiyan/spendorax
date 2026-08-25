import { getTransactions } from '../../services/transactions';
import { getCategories } from '../../services/categories';

export const getTopExpensesTool = {
  name: 'get_top_expenses',
  description: 'Get the top expenses for a specified period.',
  parameters: {
    period: 'string',
    limit: 'number'
  },
  permission: 'READ',
  execute: async (params) => {
    try {
      const transactions = await getTransactions(10000, 'No', null, null, params.period);
      const categories = await getCategories(true);

      const expenses = transactions.filter(t => t.type === 'expense');
      
      // Group by description/notes
      const grouped = {};
      for (const tx of expenses) {
        const desc = tx.notes ? tx.notes.trim() : 'Unknown';
        if (!grouped[desc]) {
          grouped[desc] = {
            description: desc,
            amount: 0,
            category_id: tx.category_id
          };
        }
        grouped[desc].amount += Number(tx.amount || 0);
      }

      // Map category ID to name
      const results = Object.values(grouped).map(item => {
        const cat = categories.find(c => String(c.id) === String(item.category_id));
        return {
          description: item.description,
          amount: item.amount,
          category: cat ? cat.name : 'Uncategorized'
        };
      });

      // Sort by amount descending
      results.sort((a, b) => b.amount - a.amount);

      return results.slice(0, params.limit || 5);
    } catch (e) {
      console.error('Failed to get_top_expenses:', e);
      throw new Error('Could not fetch top expenses from database');
    }
  }
};
