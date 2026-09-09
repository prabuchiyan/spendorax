// Home Selectors
export const selectTopCategories = (state) => state.home.topCategories;
export const selectSources = (state) => state.home.sources;
export const selectSourceBalances = (state) => state.home.sourceBalances;
export const selectRecentTransactions = (state) => state.home.recentTransactions;
export const selectSelectedBudgetId = (state) => state.home.selectedBudgetId;
export const selectHomeLoading = (state) => state.home.isLoading;
export const selectHomeError = (state) => state.home.error;

// Budget Selectors
export const selectBudgets = (state) => state.budget.budgets;
export const selectCategoryBudgets = (state) => state.budget.categoryBudgets;
export const selectOtherCategorySpending = (state) => state.budget.otherCategorySpending;
export const selectOthersExpanded = (state) => state.budget.othersExpanded;
export const selectBudgetLoading = (state) => state.budget.isLoading;
export const selectBudgetError = (state) => state.budget.error;

// Bill Selectors
export const selectBills = (state) => state.bill.bills;
export const selectBillsSummary = (state) => state.bill.billsSummary;
export const selectBillLoading = (state) => state.bill.isLoading;
export const selectBillError = (state) => state.bill.error;

// Category Selectors
export const selectCategoriesMap = (state) => state.category.categoriesMap;
export const selectCategoryLoading = (state) => state.category.isLoading;
export const selectCategoryError = (state) => state.category.error;

// Computed Selectors
export const selectTotalBalance = (state) => {
  const sourceBalances = state?.home?.sourceBalances || [];
  if (!Array.isArray(sourceBalances) || sourceBalances.length === 0) {
    return 0;
  }
  return sourceBalances
    .filter(
      (source) => String(source.type || '').toLowerCase() !== 'credit_card',
    )
    .reduce((sum, source) => sum + Number(source.balance || 0), 0);
};

export const selectTotalMonthlySpend = (state) => {
  const topCategories = state?.home?.topCategories || [];
  if (!Array.isArray(topCategories) || topCategories.length === 0) {
    return 0;
  }
  return topCategories.reduce(
    (sum, c) => sum + Number(c.amount || 0),
    0,
  );
};

export const selectUpcomingBillsCount = (state) => {
  const bills = state?.bill?.bills || [];
  if (!Array.isArray(bills) || bills.length === 0) {
    return 0;
  }
  return bills.filter((bill) => {
    const status = String(bill.status || bill.payment_status || '').toLowerCase();
    return status !== 'paid' && status !== 'skipped';
  }).length;
};

export const selectUpcomingBillsTotal = (state) => {
  const bills = state?.bill?.bills || [];
  if (!Array.isArray(bills) || bills.length === 0) {
    return 0;
  }
  return bills
    .filter((bill) => {
      const status = String(bill.status || bill.payment_status || '').toLowerCase();
      return status !== 'paid' && status !== 'skipped';
    })
    .reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
};

// Transaction Selectors
export const selectTransactions = (state) => state.transaction.transactions;
export const selectFilteredTransactions = (state) => state.transaction.filteredTransactions;
export const selectTransactionLoading = (state) => state.transaction.isLoading;
export const selectTransactionError = (state) => state.transaction.error;

// Source Selectors
export const selectSourcesList = (state) => state.source.sources;
export const selectSourceDetails = (state) => state.source.sourceDetails;
export const selectSourceLoading = (state) => state.source.isLoading;
export const selectSourceError = (state) => state.source.error;
