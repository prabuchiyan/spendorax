import { createSlice } from '@reduxjs/toolkit';

export const initialSearchFilter = {
  searchQuery: '',
  advAmount: '',
  advNote: '',
  advType: 'all',          // 'all' | 'expense' | 'income' | 'transfer'
  advDateType: 'none',     // 'none' | 'exact' | 'month' | 'year' | 'duration'
  advExactDate: '',
  advMonth: '',
  advYear: '',
  advStartDate: '',
  advEndDate: '',
  advCategoryId: null,     // null means 'All Categories'
  advSourceId: null,       // null means 'All Accounts'
  groupByOption: 'day',    // 'day' | 'month' | 'year'
  isFilterActive: false
};

const initialState = {
  transactions: [],
  filteredTransactions: [],
  isLoading: false,
  error: null,
  searchFilter: { ...initialSearchFilter },
};

const transactionSlice = createSlice({
  name: 'transaction',
  initialState,
  reducers: {
    setTransactions: (state, action) => {
      state.transactions = action.payload;
    },
    setFilteredTransactions: (state, action) => {
      state.filteredTransactions = action.payload;
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
    setSearchFilter: (state, action) => {
      state.searchFilter = {
        ...state.searchFilter,
        ...action.payload
      };
    },
    resetSearchFilter: (state) => {
      state.searchFilter = { ...initialSearchFilter };
    },
    setSearchQueryText: (state, action) => {
      state.searchFilter.searchQuery = action.payload;
    },
    resetTransactions: (state) => {
      return initialState;
    },
  },
});

export const {
  setTransactions,
  setFilteredTransactions,
  setLoading,
  setError,
  clearError,
  setSearchFilter,
  resetSearchFilter,
  setSearchQueryText,
  resetTransactions,
} = transactionSlice.actions;

export default transactionSlice.reducer;
