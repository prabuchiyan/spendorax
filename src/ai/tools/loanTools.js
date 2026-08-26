import { getLoans } from '../../services/loans';

export const getLoanSummaryTool = {
  name: 'get_loan_summary',
  description: 'Get a summary of active loans and outstanding balances.',
  parameters: {},
  permission: 'READ',
  execute: async () => {
    try {
      const allLoans = await getLoans();
      
      const activeLoans = allLoans.filter(loan => loan.status === 'Active');

      let totalOutstanding = 0;
      const summaries = activeLoans.map(loan => {
        totalOutstanding += Number(loan.outstanding_amount || 0);
        return {
          id: loan.id,
          loan_name: loan.loan_name,
          loan_type: loan.loan_type,
          lender: loan.lender,
          outstanding_amount: loan.outstanding_amount,
          direction: loan.loan_direction,
          emi_amount: loan.emi_amount
        };
      });

      return {
        totalOutstanding,
        activeLoansCount: activeLoans.length,
        loans: summaries
      };
    } catch (e) {
      console.error('Failed to get_loan_summary:', e);
      throw new Error('Could not fetch loan summary from database');
    }
  }
};
