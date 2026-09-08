import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  loans: [],
  isLoading: false,
  error: null,
};

const loanSlice = createSlice({
  name: 'loan',
  initialState,
  reducers: {
    setLoans: (state, action) => {
      state.loans = action.payload;
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
    resetLoans: (state) => {
      return initialState;
    },
  },
});

export const {
  setLoans,
  setLoading,
  setError,
  clearError,
  resetLoans,
} = loanSlice.actions;

export default loanSlice.reducer;
