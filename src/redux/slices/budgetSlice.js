import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  budgets: [],
  categoryBudgets: [],
  otherCategorySpending: [],
  othersExpanded: false,
  isLoading: false,
  error: null,
};

const budgetSlice = createSlice({
  name: 'budget',
  initialState,
  reducers: {
    setBudgets: (state, action) => {
      state.budgets = action.payload;
    },
    setCategoryBudgets: (state, action) => {
      state.categoryBudgets = action.payload;
    },
    setOtherCategorySpending: (state, action) => {
      state.otherCategorySpending = action.payload;
    },
    toggleOthersExpanded: (state) => {
      state.othersExpanded = !state.othersExpanded;
    },
    setOthersExpanded: (state, action) => {
      state.othersExpanded = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    resetBudget: (state) => {
      return initialState;
    },
  },
});

export const {
  setBudgets,
  setCategoryBudgets,
  setOtherCategorySpending,
  toggleOthersExpanded,
  setOthersExpanded,
  setLoading,
  setError,
  clearError,
  resetBudget,
} = budgetSlice.actions;

export default budgetSlice.reducer;
