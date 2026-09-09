import { useDispatch, useSelector } from 'react-redux';

// Home Hooks
export const useHomeData = () => {
  return useSelector((state) => state.home);
};

export const useTopCategories = () => {
  return useSelector((state) => state.home.topCategories);
};

export const useSources = () => {
  return useSelector((state) => state.home.sources);
};

export const useSourceBalances = () => {
  return useSelector((state) => state.home.sourceBalances);
};

export const useRecentTransactions = () => {
  return useSelector((state) => state.home.recentTransactions);
};

export const useSelectedBudgetId = () => {
  return useSelector((state) => state.home.selectedBudgetId);
};

export const useHomeLoading = () => {
  return useSelector((state) => state.home.isLoading);
};

export const useHomeError = () => {
  return useSelector((state) => state.home.error);
};

// Budget Hooks
export const useBudgetData = () => {
  return useSelector((state) => state.budget);
};

export const useBudgets = () => {
  return useSelector((state) => state.budget.budgets);
};

export const useCategoryBudgets = () => {
  return useSelector((state) => state.budget.categoryBudgets);
};

export const useOtherCategorySpending = () => {
  return useSelector((state) => state.budget.otherCategorySpending);
};

export const useOthersExpanded = () => {
  return useSelector((state) => state.budget.othersExpanded);
};

export const useBudgetLoading = () => {
  return useSelector((state) => state.budget.isLoading);
};

export const useBudgetError = () => {
  return useSelector((state) => state.budget.error);
};

// Bill Hooks
export const useBillData = () => {
  return useSelector((state) => state.bill);
};

export const useBills = () => {
  return useSelector((state) => state.bill.bills);
};

export const useBillsSummary = () => {
  return useSelector((state) => state.bill.billsSummary);
};

export const useBillLoading = () => {
  return useSelector((state) => state.bill.isLoading);
};

export const useBillError = () => {
  return useSelector((state) => state.bill.error);
};

// Category Hooks
export const useCategoryData = () => {
  return useSelector((state) => state.category);
};

export const useCategories = () => {
  return useSelector((state) => state.category.categories);
};

export const useCategoriesMap = () => {
  return useSelector((state) => state.category.categoriesMap);
};

export const useCategoryLoading = () => {
  return useSelector((state) => state.category.isLoading);
};

export const useCategoryError = () => {
  return useSelector((state) => state.category.error);
};

// Transaction Hooks
export const useTransactionData = () => {
  return useSelector((state) => state.transaction);
};

export const useTransactions = () => {
  return useSelector((state) => state.transaction.transactions);
};

export const useFilteredTransactions = () => {
  return useSelector((state) => state.transaction.filteredTransactions);
};

export const useTransactionLoading = () => {
  return useSelector((state) => state.transaction.isLoading);
};

export const useTransactionError = () => {
  return useSelector((state) => state.transaction.error);
};

// Source Hooks
export const useSourceData = () => {
  return useSelector((state) => state.source);
};

export const useSourcesList = () => {
  return useSelector((state) => state.source.sources);
};

export const useSourceDetails = () => {
  return useSelector((state) => state.source.sourceDetails);
};

export const useSourceLoading = () => {
  return useSelector((state) => state.source.isLoading);
};

export const useSourceError = () => {
  return useSelector((state) => state.source.error);
};

// Loan Hooks
export const useLoanData = () => {
  return useSelector((state) => state.loan);
};

export const useLoans = () => {
  return useSelector((state) => state.loan.loans);
};

// Credit Card Hooks
export const useCreditCardData = () => {
  return useSelector((state) => state.creditCard);
};

export const useCreditCards = () => {
  return useSelector((state) => state.creditCard.creditCards);
};

export const useCreditCardStatements = () => {
  return useSelector((state) => state.creditCard.statements);
};

// Dispatch hook
export const useAppDispatch = () => useDispatch();
