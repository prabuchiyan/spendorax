// test/test_paper_ledger_utils.js
const assert = require('assert');
const {
  calculateLedgerTotals,
  formatWhatsAppLedgerText,
  mapDbTransactionsToPaperItems
} = require('../src/utils/paperLedgerUtils');

console.log('Running Task 1 tests...');

// 1. Test calculation
const sampleItems = [
  { id: '1', title: 'Salary', type: 'income', amount: 5000 },
  { id: '2', title: 'Rent', type: 'expense', amount: 1500 },
  { id: '3', title: 'Groceries', type: 'expense', amount: 500 },
];

const totals = calculateLedgerTotals(sampleItems);
assert.strictEqual(totals.totalIncome, 5000, 'Total income should be 5000');
assert.strictEqual(totals.totalExpense, 2000, 'Total expense should be 2000');
assert.strictEqual(totals.netTotal, 3000, 'Net total should be 3000');

// 2. Test empty items
const emptyTotals = calculateLedgerTotals([]);
assert.strictEqual(emptyTotals.totalIncome, 0, 'Empty total income should be 0');
assert.strictEqual(emptyTotals.totalExpense, 0, 'Empty total expense should be 0');
assert.strictEqual(emptyTotals.netTotal, 0, 'Empty net total should be 0');

// 3. Test negative net total
const deficitItems = [
  { id: '1', title: 'Bill', type: 'expense', amount: 800 }
];
assert.strictEqual(calculateLedgerTotals(deficitItems).netTotal, -800, 'Net total should be -800');

// 4. Test WhatsApp formatting
const shareText = formatWhatsAppLedgerText(sampleItems, 3000);
assert.ok(shareText.includes('Paper Ledger'), 'Should include Paper Ledger header');
assert.ok(shareText.includes('1) Salary'), 'Should include 1) Salary');
assert.ok(shareText.includes('3) Groceries'), 'Should include 3) Groceries');
assert.ok(shareText.includes('3,000') || shareText.includes('3000'), 'Should include net total');

// 5. Test DB transaction mapping
const dbTxs = [
  { id: 101, type: 'income', amount: 1200, notes: 'Freelance' },
  { id: 102, type: 'expense', amount: 300, category_name: 'Food', notes: null }
];
const mapped = mapDbTransactionsToPaperItems(dbTxs);
assert.strictEqual(mapped.length, 2, 'Should map 2 transactions');
assert.strictEqual(mapped[0].title, 'Freelance', 'Should use notes as title');
assert.strictEqual(mapped[0].type, 'income', 'Should retain income type');
assert.strictEqual(mapped[0].amount, 1200, 'Should retain amount');
assert.strictEqual(mapped[1].title, 'Food', 'Should fall back to category_name');

console.log('Task 1 tests passed successfully!');
