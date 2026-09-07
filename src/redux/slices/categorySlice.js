import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  categoriesMap: {},
  isLoading: false,
  error: null,
};

const categorySlice = createSlice({
  name: 'category',
  initialState,
  reducers: {
    setCategoriesMap: (state, action) => {
      state.categoriesMap = action.payload;
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
    resetCategories: (state) => {
      return initialState;
    },
  },
});

export const {
  setCategoriesMap,
  setLoading,
  setError,
  clearError,
  resetCategories,
} = categorySlice.actions;

export default categorySlice.reducer;
