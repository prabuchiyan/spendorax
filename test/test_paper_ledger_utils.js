// test/test_paper_ledger_utils.js
const assert = require('assert');
const {
  calculateLedgerTotals,
  formatWhatsAppLedgerText,
  mapDbTransactionsToPaperItems,
  isTransferTransaction,
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
assert.ok(shareText.includes('Smart Notepad'), 'Should include Smart Notepad header');
assert.ok(shareText.includes('1) Salary'), 'Should include 1) Salary');
assert.ok(shareText.includes('3) Groceries'), 'Should include 3) Groceries');
assert.ok(shareText.includes('3,000') || shareText.includes('3000'), 'Should include net total');

// 5. Test DB transaction mapping with formatted title (DD-MM-YYYY: Category: Notes)
const dbTxs = [
  { id: 101, type: 'income', amount: 1200, notes: 'Freelance', date: '2026-11-19' },
  { id: 102, type: 'expense', amount: 300, category_name: 'Food', notes: null, date: '2026-11-19' }
];
const mapped = mapDbTransactionsToPaperItems(dbTxs);
assert.strictEqual(mapped.length, 2, 'Should map 2 transactions');
assert.strictEqual(mapped[0].title, '19-11-2026: Income: Freelance', 'Should format title as DD-MM-YYYY: Category: Notes');
assert.strictEqual(mapped[0].type, 'income', 'Should retain income type');
assert.strictEqual(mapped[0].amount, 1200, 'Should retain amount');
assert.strictEqual(mapped[1].title, '19-11-2026: Food', 'Should format title with Food category');

// 6. Test Transfer Transaction Detection & Exclusion
const transferTxs = [
  { id: 1, type: 'transfer', amount: 500, notes: 'Direct Transfer', date: '2026-11-19' },
  { id: 2, type: 'expense', amount: 500, transfer_group_id: 'grp_123', notes: 'Bank Transfer Debit', date: '2026-11-19' },
  { id: 3, type: 'income', amount: 500, transfer_group_id: 'grp_123', notes: 'Bank Transfer Credit', date: '2026-11-19' },
  { id: 4, type: 'expense', amount: 250, is_transfer: 1, notes: 'Flagged Transfer', date: '2026-11-19' },
  { id: 5, type: 'income', amount: 1500, notes: 'Real Salary', transfer_group_id: null, date: '2026-11-19' },
  { id: 6, type: 'expense', amount: 45, notes: 'Coffee', transfer_group_id: null, date: '2026-11-19' },
];

assert.strictEqual(isTransferTransaction(transferTxs[0]), true, 'type transfer should be true');
assert.strictEqual(isTransferTransaction(transferTxs[1]), true, 'transfer_group_id debit should be true');
assert.strictEqual(isTransferTransaction(transferTxs[2]), true, 'transfer_group_id credit should be true');
assert.strictEqual(isTransferTransaction(transferTxs[3]), true, 'is_transfer = 1 should be true');
assert.strictEqual(isTransferTransaction(transferTxs[4]), false, 'genuine income should be false');
assert.strictEqual(isTransferTransaction(transferTxs[5]), false, 'genuine expense should be false');

const mappedWithoutTransfers = mapDbTransactionsToPaperItems(transferTxs);
assert.strictEqual(mappedWithoutTransfers.length, 2, 'Should only map genuine non-transfer transactions');
assert.ok(mappedWithoutTransfers[0].title.includes('Real Salary'), 'Should include notes in title');
assert.ok(mappedWithoutTransfers[1].title.includes('Coffee'), 'Should include notes in title');
console.log('✓ Transfer transaction exclusion verified successfully!');

console.log('Task 1 tests passed successfully!');

