import { configureStore } from '@reduxjs/toolkit';
import homeReducer from './slices/homeSlice';
import budgetReducer from './slices/budgetSlice';
import billReducer from './slices/billSlice';
import categoryReducer from './slices/categorySlice';
import transactionReducer from './slices/transactionSlice';
import sourceReducer from './slices/sourceSlice';

export const store = configureStore({
  reducer: {
    home: homeReducer,
    budget: budgetReducer,
    bill: billReducer,
    category: categoryReducer,
    transaction: transactionReducer,
    source: sourceReducer,
  },
});

export default store;
