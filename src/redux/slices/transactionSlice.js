import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  transactions: [],
  filteredTransactions: [],
  isLoading: false,
  error: null,
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
  resetTransactions,
} = transactionSlice.actions;

export default transactionSlice.reducer;
