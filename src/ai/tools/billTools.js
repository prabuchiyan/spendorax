import { getBillsForCurrentMonth } from '../../services/bills';

export const getUpcomingBillsTool = {
  name: 'get_upcoming_bills',
  description: 'Get upcoming and pending bills for the current month.',
  parameters: {},
  permission: 'READ',
  execute: async () => {
    try {
      // getBillsForCurrentMonth returns all bills for the current month.
      const bills = await getBillsForCurrentMonth();
      
      // Filter out bills that are already paid or deleted
      const pendingBills = bills.filter(b => b.status !== 'Paid' && !b.deleted_at);

      // Sort by due date ascending
      pendingBills.sort((a, b) => {
        const da = a.due_date || '9999-99-99';
        const db = b.due_date || '9999-99-99';
        return da.localeCompare(db);
      });

      // Map to a summary to avoid passing too much irrelevant data to the LLM
      const summary = pendingBills.map(b => ({
        id: b.id,
        name: b.name,
        amount: b.amount,
        due_date: b.due_date,
        status: b.status
      }));

      return summary;
    } catch (e) {
      console.error('Failed to get_upcoming_bills:', e);
      throw new Error('Could not fetch upcoming bills from database');
    }
  }
};
