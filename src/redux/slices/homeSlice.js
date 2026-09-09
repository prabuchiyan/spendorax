import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  topCategories: [],
  sources: [],
  sourceBalances: [],
  recentTransactions: [],
  isLoading: false,
  error: null,
  selectedBudgetId: '',
};

const homeSlice = createSlice({
  name: 'home',
  initialState,
  reducers: {
    setTopCategories: (state, action) => {
      state.topCategories = action.payload;
    },
    setSources: (state, action) => {
      state.sources = action.payload;
    },
    setSourceBalances: (state, action) => {
      state.sourceBalances = action.payload;
    },
    setRecentTransactions: (state, action) => {
      state.recentTransactions = action.payload;
    },
    setSelectedBudgetId: (state, action) => {
      state.selectedBudgetId = action.payload;
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
    resetHome: (state) => {
      return initialState;
    },
  },
});

export const {
  setTopCategories,
  setSources,
  setSourceBalances,
  setRecentTransactions,
  setSelectedBudgetId,
  setLoading,
  setError,
  clearError,
  resetHome,
} = homeSlice.actions;

export default homeSlice.reducer;
