import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  creditCards: [],
  statements: [],
  isLoading: false,
  error: null,
};

const creditCardSlice = createSlice({
  name: 'creditCard',
  initialState,
  reducers: {
    setCreditCards: (state, action) => {
      state.creditCards = action.payload;
    },
    setStatements: (state, action) => {
      state.statements = action.payload;
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
    resetCreditCards: (state) => {
      return initialState;
    },
  },
});

export const {
  setCreditCards,
  setStatements,
  setLoading,
  setError,
  clearError,
  resetCreditCards,
} = creditCardSlice.actions;

export default creditCardSlice.reducer;
