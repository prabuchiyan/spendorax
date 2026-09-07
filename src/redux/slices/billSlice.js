import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  bills: [],
  billsSummary: null,
  isLoading: false,
  error: null,
};

const billSlice = createSlice({
  name: 'bill',
  initialState,
  reducers: {
    setBills: (state, action) => {
      state.bills = action.payload;
    },
    setBillsSummary: (state, action) => {
      state.billsSummary = action.payload;
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
    resetBills: (state) => {
      return initialState;
    },
  },
});

export const {
  setBills,
  setBillsSummary,
  setLoading,
  setError,
  clearError,
  resetBills,
} = billSlice.actions;

export default billSlice.reducer;
