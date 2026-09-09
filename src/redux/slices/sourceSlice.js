import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sources: [],
  sourceDetails: null,
  isLoading: false,
  error: null,
};

const sourceSlice = createSlice({
  name: 'source',
  initialState,
  reducers: {
    setSources: (state, action) => {
      state.sources = action.payload;
    },
    setSourceDetails: (state, action) => {
      state.sourceDetails = action.payload;
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
    resetSource: (state) => {
      return initialState;
    },
  },
});

export const {
  setSources,
  setSourceDetails,
  setLoading,
  setError,
  clearError,
  resetSource,
} = sourceSlice.actions;

export default sourceSlice.reducer;
