import { getTransactions } from '../../services/transactions';
import { getCategories } from '../../services/categories';

export const getCategorySpendingTool = {
  name: 'get_category_spending',
  description: 'Get total spending for a category during a specified period.',
  parameters: {
    category: 'string',
    period: 'string'
  },
  permission: 'READ',
  execute: async (params) => {
    try {
      const categories = await getCategories(true);
      const targetCategory = categories.find(
        c => c.name.toLowerCase() === params.category.toLowerCase()
      );

      // We resolve to categoryId if found, otherwise keep as null to search by notes maybe
      const categoryId = targetCategory ? targetCategory.id : null;

      // Note: getTransactions takes (limit, isTransferInclude, sourceId, categoryId, period)
      // Limit to 10000 to basically get all for the period
      const transactions = await getTransactions(10000, 'No', null, categoryId, params.period);

      // Aggregate
      let total = 0;
      let count = 0;

      for (const tx of transactions) {
        // If category matched by ID, or if we are falling back to text search in notes for uncategorized
        if (categoryId || (!categoryId && tx.notes && tx.notes.toLowerCase().includes(params.category.toLowerCase()))) {
           if (tx.type === 'expense') {
             total += Number(tx.amount);
             count++;
           }
        }
      }

      return {
        category: params.category,
        total,
        transactionCount: count,
        period: params.period
      };
    } catch (e) {
      console.error('Failed to get_category_spending:', e);
      throw new Error('Could not fetch category spending from database');
    }
  }
};
