const assert = require('assert');
const {
  parseNotepadLine,
  formatImportTransactionTitle,
  mapDbTransactionsToPaperItems,
} = require('../src/utils/paperLedgerUtils');

console.log('Testing Paper Ledger Freeform Parser and Title Formatter...');

// 1. Basic Expense parsing
const res1 = parseNotepadLine('Dinner 450');
assert.strictEqual(res1.isValid, true);
assert.strictEqual(res1.title, 'Dinner');
assert.strictEqual(res1.amount, 450);
assert.strictEqual(res1.type, 'expense');
assert.strictEqual(res1.formula, null);
console.log('✓ "Dinner 450" parsed correctly');

// 2. Explicit Income with + prefix on amount
const res2 = parseNotepadLine('Salary +50000');
assert.strictEqual(res2.isValid, true);
assert.strictEqual(res2.title, 'Salary');
assert.strictEqual(res2.amount, 50000);
assert.strictEqual(res2.type, 'income');
assert.strictEqual(res2.formula, null);
console.log('✓ "Salary +50000" parsed correctly');

// 3. Explicit Income with + prefix at start
const res3 = parseNotepadLine('+ Freelance Bonus 15000');
assert.strictEqual(res3.isValid, true);
assert.strictEqual(res3.title, 'Freelance Bonus');
assert.strictEqual(res3.amount, 15000);
assert.strictEqual(res3.type, 'income');
console.log('✓ "+ Freelance Bonus 15000" parsed correctly');

// 4. Explicit Expense with - prefix
const res4 = parseNotepadLine('- Electricity Bill 1200');
assert.strictEqual(res4.isValid, true);
assert.strictEqual(res4.title, 'Electricity Bill');
assert.strictEqual(res4.amount, 1200);
assert.strictEqual(res4.type, 'expense');
console.log('✓ "- Electricity Bill 1200" parsed correctly');

// 5. Math expression at end
const res5 = parseNotepadLine('Grocery Mart 100 + 25');
assert.strictEqual(res5.isValid, true);
assert.strictEqual(res5.title, 'Grocery Mart');
assert.strictEqual(res5.amount, 125);
assert.strictEqual(res5.formula, '100 + 25');
assert.strictEqual(res5.type, 'expense');
console.log('✓ "Grocery Mart 100 + 25" parsed correctly with formula');

// 6. Math expression with Income +
const res6 = parseNotepadLine('Freelance Design +100*5');
assert.strictEqual(res6.isValid, true);
assert.strictEqual(res6.title, 'Freelance Design');
assert.strictEqual(res6.amount, 500);
assert.strictEqual(res6.formula, '100*5');
assert.strictEqual(res6.type, 'income');
console.log('✓ "Freelance Design +100*5" parsed correctly');

// 7. Math expression alone (no title)
const res7 = parseNotepadLine('100 + 25');
assert.strictEqual(res7.isValid, true);
assert.strictEqual(res7.title, 'Calculation');
assert.strictEqual(res7.amount, 125);
assert.strictEqual(res7.formula, '100 + 25');
console.log('✓ "100 + 25" without title parsed correctly');

// 8. Passing default type override
const res8 = parseNotepadLine('Direct Consulting 3500', 'income');
assert.strictEqual(res8.isValid, true);
assert.strictEqual(res8.title, 'Direct Consulting');
assert.strictEqual(res8.amount, 3500);
assert.strictEqual(res8.type, 'income');
console.log('✓ Type override "income" respected');

// 9. Invalid inputs
assert.strictEqual(parseNotepadLine('').isValid, false);
assert.strictEqual(parseNotepadLine('Random note without numbers').isValid, false);
console.log('✓ Invalid inputs rejected cleanly');

// 10. Title Formatter tests: DD-MM-YYYY: Category: Notes
const tx1 = {
  date: '2026-12-14',
  category_name: 'Salary',
  notes: 'December Paycheck',
};
assert.strictEqual(formatImportTransactionTitle(tx1), '14-12-2026: Salary: December Paycheck');

const tx2 = {
  date: '2026-05-03 14:30:00',
  category_id: 10,
  notes: '',
};
const catsMap = { 10: { name: 'Food & Dining' } };
assert.strictEqual(formatImportTransactionTitle(tx2, catsMap), '03-05-2026: Food & Dining');

const tx3 = {
  date: '2026-07-09T18:00:00Z',
  category_name: '',
  notes: 'Cash withdrawal',
  type: 'expense',
};
assert.strictEqual(formatImportTransactionTitle(tx3), '09-07-2026: Expense: Cash withdrawal');

console.log('✓ formatImportTransactionTitle verified (DD-MM-YYYY: Category: Notes)');

// Newline stripping in notes/categories
const txMultiline = {
  date: '2026-12-14',
  category_name: 'Supermarket\nStore',
  notes: 'Item 1\nItem 2',
};
assert.strictEqual(formatImportTransactionTitle(txMultiline), '14-12-2026: Supermarket Store: Item 1 Item 2');
console.log('✓ formatImportTransactionTitle strips newlines to keep transaction on one line');

// 11. mapDbTransactionsToPaperItems uses new title format
const mapped = mapDbTransactionsToPaperItems([tx1]);
assert.strictEqual(mapped[0].title, '14-12-2026: Salary: December Paycheck');
console.log('✓ mapDbTransactionsToPaperItems applies DD-MM-YYYY format');

console.log('\nAll Freeform Parser and Title Formatter Tests Passed Successfully!');

