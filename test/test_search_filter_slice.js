const assert = require('assert');
const fs = require('fs');
const babel = require('@babel/core');

const sliceCode = fs.readFileSync('src/redux/slices/transactionSlice.js', 'utf8');
const transformed = babel.transformSync(sliceCode, {
  presets: ['babel-preset-expo'],
  filename: 'src/redux/slices/transactionSlice.js'
});

const moduleObj = { exports: {} };
const fn = new Function('require', 'module', 'exports', transformed.code);
fn(require, moduleObj, moduleObj.exports);

const {
  default: transactionReducer,
  setSearchFilter,
  resetSearchFilter,
  setSearchQueryText
} = moduleObj.exports;

const initial = transactionReducer(undefined, { type: '@@INIT' });

assert.ok(initial.searchFilter, 'Initial state must contain searchFilter');
assert.strictEqual(initial.searchFilter.advType, 'all');
assert.strictEqual(initial.searchFilter.advCategoryId, null);
assert.strictEqual(initial.searchFilter.advSourceId, null);
assert.strictEqual(initial.searchFilter.isFilterActive, false);

// Test setSearchFilter
const updated = transactionReducer(initial, setSearchFilter({
  advType: 'expense',
  advCategoryId: 5,
  advSourceId: 2,
  advAmount: '150',
  isFilterActive: true
}));
assert.strictEqual(updated.searchFilter.advType, 'expense');
assert.strictEqual(updated.searchFilter.advCategoryId, 5);
assert.strictEqual(updated.searchFilter.advSourceId, 2);
assert.strictEqual(updated.searchFilter.advAmount, '150');
assert.strictEqual(updated.searchFilter.isFilterActive, true);

// Test setSearchQueryText
const updatedQuery = transactionReducer(updated, setSearchQueryText('Groceries'));
assert.strictEqual(updatedQuery.searchFilter.searchQuery, 'Groceries');

// Test resetSearchFilter
const reset = transactionReducer(updatedQuery, resetSearchFilter());
assert.strictEqual(reset.searchFilter.advType, 'all');
assert.strictEqual(reset.searchFilter.advCategoryId, null);
assert.strictEqual(reset.searchFilter.advSourceId, null);
assert.strictEqual(reset.searchFilter.isFilterActive, false);
assert.strictEqual(reset.searchFilter.searchQuery, '');

console.log('Task 1 tests passed!');
