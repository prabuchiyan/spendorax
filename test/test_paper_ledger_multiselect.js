// test/test_paper_ledger_multiselect.js
const assert = require('assert');
const { calculateLedgerTotals } = require('../src/utils/paperLedgerUtils');

console.log('Testing Multi-Record Selection & Deletion Logic...');

const initialItems = [
  { id: '1', title: 'Salary', type: 'income', amount: 50000 },
  { id: '2', title: 'Rent', type: 'expense', amount: 15000 },
  { id: '3', title: 'Groceries', type: 'expense', amount: 4000 },
  { id: '4', title: 'Electricity', type: 'expense', amount: 1200 },
  { id: '5', title: 'Bonus', type: 'income', amount: 8000 },
];

// Initial totals
const initialTotals = calculateLedgerTotals(initialItems);
assert.strictEqual(initialTotals.netTotal, 37800, 'Initial net total must be 37800');

// Scenario 1: Select multiple expense items (Rent, Groceries, Electricity) to delete
const selectedIds = new Set(['2', '3', '4']);
assert.strictEqual(selectedIds.size, 3, 'Should have 3 selected items');

// Filter out selected items
const remainingItems = initialItems.filter(item => !selectedIds.has(item.id));
assert.strictEqual(remainingItems.length, 2, 'Should remain 2 items after batch deletion');
assert.strictEqual(remainingItems[0].title, 'Salary');
assert.strictEqual(remainingItems[1].title, 'Bonus');

// Recalculate totals
const remainingTotals = calculateLedgerTotals(remainingItems);
assert.strictEqual(remainingTotals.totalIncome, 58000, 'Total income should be 58000');
assert.strictEqual(remainingTotals.totalExpense, 0, 'Total expense should be 0');
assert.strictEqual(remainingTotals.netTotal, 58000, 'Net total should be 58000');

// Scenario 2: Select all items to delete
const allIds = new Set(initialItems.map(it => it.id));
const emptyAfterDeleteAll = initialItems.filter(item => !allIds.has(item.id));
assert.strictEqual(emptyAfterDeleteAll.length, 0, 'All items should be removed');
assert.strictEqual(calculateLedgerTotals(emptyAfterDeleteAll).netTotal, 0, 'Empty net total is 0');

console.log('Multi-Record Selection & Deletion Tests Passed Successfully!');

