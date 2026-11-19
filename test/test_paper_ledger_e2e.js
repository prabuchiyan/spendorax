// test/test_paper_ledger_e2e.js
const assert = require('assert');
const {
  calculateLedgerTotals,
  formatLedgerAmount,
  formatWhatsAppLedgerText,
  mapDbTransactionsToPaperItems
} = require('../src/utils/paperLedgerUtils');

console.log('=== Running Paper Ledger End-to-End & Edge Cases Tests ===\n');

// Test 1: Mixed Calculations & Floating Point Precisions
console.log('1. Testing Mixed Incomes and Expenses Calculation...');
const items = [
  { id: '1', title: 'Monthly Salary', type: 'income', amount: 45000.50 },
  { id: '2', title: 'Consulting Bonus', type: 'income', amount: 12500.25 },
  { id: '3', title: 'House Rent', type: 'expense', amount: 15000.00 },
  { id: '4', title: 'Grocery Mart', type: 'expense', amount: 4250.75 },
  { id: '5', title: 'Internet & Mobile', type: 'expense', amount: 1499.00 },
];

const totals = calculateLedgerTotals(items);
assert.strictEqual(totals.totalIncome, 57500.75, 'Income total must be 57500.75');
assert.strictEqual(totals.totalExpense, 20749.75, 'Expense total must be 20749.75');
assert.strictEqual(totals.netTotal, 36751.00, 'Net total must be 36751.00 (Income - Expense)');
console.log('   ✓ Income:', totals.totalIncome, '| Expense:', totals.totalExpense, '| Net:', totals.netTotal);

// Test 2: Row Deletion Recalculation
console.log('\n2. Testing Row Deletion and Real-time Recalculation...');
const itemsAfterDelete = items.filter(it => it.id !== '3'); // delete House Rent (15000)
const totalsAfterDelete = calculateLedgerTotals(itemsAfterDelete);
assert.strictEqual(totalsAfterDelete.totalExpense, 5749.75, 'Expense after deletion must drop by 15000');
assert.strictEqual(totalsAfterDelete.netTotal, 51751.00, 'Net total must reflect removed expense');
console.log('   ✓ Net after deleting rent:', totalsAfterDelete.netTotal);

// Test 3: Deficit / Negative Net Total
console.log('\n3. Testing Deficit / Negative Balance...');
const deficitItems = [
  { id: '1', title: 'Part-time Gig', type: 'income', amount: 2000 },
  { id: '2', title: 'Bike Repair', type: 'expense', amount: 3500 },
];
const deficitTotals = calculateLedgerTotals(deficitItems);
assert.strictEqual(deficitTotals.netTotal, -1500, 'Net total should be negative 1500');
console.log('   ✓ Negative Net:', deficitTotals.netTotal);

// Test 4: WhatsApp Formatting and URL Safety
console.log('\n4. Testing WhatsApp Sharing Output and URL Encoding...');
const waText = formatWhatsAppLedgerText(items, totals.netTotal, '17 Nov 2026');
assert.ok(waText.includes('SpendoraX - Smart Notepad'), 'Must have notepad header');
assert.ok(waText.includes('1) Monthly Salary [+]'), 'Must format row 1 with serial and type');
assert.ok(waText.includes('3) House Rent [-]'), 'Must format row 3');
assert.ok(waText.includes('*Total (Net):*  *+₹36,751*'), 'Must format final net total with plus sign');

const encoded = encodeURIComponent(waText);
assert.ok(encoded.length > 50, 'Encoded URI must be valid string');
assert.ok(!encoded.includes('\n'), 'Encoded URI should escape newlines');
console.log('   ✓ WhatsApp formatted output sample:\n' + waText.split('\n').slice(0, 8).join('\n') + '\n   ...');

// Test 5: DB Transactions Mapping
console.log('\n5. Testing DB Transactions Mapping & Category Resolution...');
const dbTxs = [
  { id: 201, type: 'income', amount: 3000, notes: 'Freelance Design', category_id: 1 },
  { id: 202, type: 'expense', amount: 450, notes: '', category_id: 2 },
  { id: 203, type: 'transfer', amount: 1000, notes: 'Self Transfer', category_id: null },
];
const catsMap = {
  1: { id: 1, name: 'Salary' },
  2: { id: 2, name: 'Dining Out' },
};
// Filter out transfers as per spec
const validTxs = dbTxs.filter(t => t.type === 'income' || t.type === 'expense');
const mapped = mapDbTransactionsToPaperItems(validTxs, catsMap);

assert.strictEqual(mapped.length, 2, 'Should map 2 valid items (no transfers)');
assert.ok(mapped[0].title.includes('Salary: Freelance Design'), 'Should format title as DD-MM-YYYY: Category: Notes');
assert.ok(mapped[1].title.includes('Dining Out'), 'Should format title with category name');
console.log('   ✓ Mapped items:', mapped.map(m => `${m.title} (${m.type}: ₹${m.amount})`).join(', '));

// Test 6: Empty State
console.log('\n6. Testing Empty State Handling...');
const emptyTotals = calculateLedgerTotals([]);
assert.strictEqual(emptyTotals.netTotal, 0);
const emptyWaText = formatWhatsAppLedgerText([], 0);
assert.ok(emptyWaText.includes('_No transactions in ledger_'));
console.log('   ✓ Empty state handled gracefully');

// Test 7: Row Editing and In-Place Recalculation
console.log('\n7. Testing Row In-Place Editing and Real-time Recalculation...');
const initialItems = [
  { id: '1', title: 'Monthly Salary', type: 'income', amount: 50000 },
  { id: '2', title: 'Grocery Mart', type: 'expense', amount: 4000 },
];
assert.strictEqual(calculateLedgerTotals(initialItems).netTotal, 46000);

// Edit item 2: Update Grocery Mart from 4000 to 4500 and title to 'Supermarket'
const editedItems = initialItems.map(it =>
  it.id === '2' ? { ...it, title: 'Supermarket', amount: 4500 } : it
);
const editedTotals = calculateLedgerTotals(editedItems);
assert.strictEqual(editedItems[1].title, 'Supermarket');
assert.strictEqual(editedItems[1].amount, 4500);
assert.strictEqual(editedTotals.totalExpense, 4500);
assert.strictEqual(editedTotals.netTotal, 45500, 'Net total should decrease by 500');

// Edit item 2: Change type from expense to income (e.g. Cashback refund)
const refundItems = editedItems.map(it =>
  it.id === '2' ? { ...it, title: 'Cashback Refund', type: 'income', amount: 500 } : it
);
const refundTotals = calculateLedgerTotals(refundItems);
assert.strictEqual(refundTotals.totalIncome, 50500);
assert.strictEqual(refundTotals.totalExpense, 0);
assert.strictEqual(refundTotals.netTotal, 50500);
console.log('   ✓ In-place edit and reactive recalculation verified');

console.log('\n=== All End-to-End Tests Passed Successfully! ===');

