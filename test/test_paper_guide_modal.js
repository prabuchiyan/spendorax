/**
 * test_paper_guide_modal.js
 * Tests for PaperGuideModal sample template calculations.
 */

const assert = require('assert');
const { parseNotepadDocument, SAMPLE_PAPER_LEDGER_TEXT } = require('../src/utils/paperLedgerUtils');

console.log('Testing Paper Guide Modal Sample Calculations...');

assert.ok(SAMPLE_PAPER_LEDGER_TEXT, 'Sample template string must be defined');

const evaluated = parseNotepadDocument(SAMPLE_PAPER_LEDGER_TEXT);

// Verify lines count
assert.strictEqual(evaluated.lines.length, 10, 'Should have exactly 10 lines');

// Line 1: Heading note
assert.strictEqual(evaluated.lines[0].amount, null, 'Header should have null amount');
assert.strictEqual(evaluated.lines[0].text, '--- Monthly Budget & Calculation ---');

// Line 2: Salary 50000 (Income)
assert.strictEqual(evaluated.lines[1].amount, 50000);
assert.strictEqual(evaluated.lines[1].type, 'income');
assert.strictEqual(evaluated.lines[1].resultText, '+ ₹50,000');

// Line 3: Freelance Bonus 100*5 (Income formula)
assert.strictEqual(evaluated.lines[2].amount, 500);
assert.strictEqual(evaluated.lines[2].type, 'income');
assert.strictEqual(evaluated.lines[2].formula, '100*5');
assert.strictEqual(evaluated.lines[2].resultText, '+ ₹500');

// Line 4: House Rent -12000 (Expense)
assert.strictEqual(evaluated.lines[3].amount, 12000);
assert.strictEqual(evaluated.lines[3].type, 'expense');
assert.strictEqual(evaluated.lines[3].resultText, '− ₹12,000');

// Line 5: Grocery Mart -125 (Expense)
assert.strictEqual(evaluated.lines[4].amount, 125);
assert.strictEqual(evaluated.lines[4].type, 'expense');
assert.strictEqual(evaluated.lines[4].resultText, '− ₹125');

// Line 6: Electricity Bill -1200 (Expense)
assert.strictEqual(evaluated.lines[5].amount, 1200);
assert.strictEqual(evaluated.lines[5].type, 'expense');
assert.strictEqual(evaluated.lines[5].resultText, '− ₹1,200');

// Line 7: Room Rent split -2000 (Expense)
assert.strictEqual(evaluated.lines[6].amount, 2000);
assert.strictEqual(evaluated.lines[6].type, 'expense');
assert.strictEqual(evaluated.lines[6].resultText, '− ₹2,000');

// Line 8: Restaurant Tip -50 (Expense)
assert.strictEqual(evaluated.lines[7].amount, 50);
assert.strictEqual(evaluated.lines[7].type, 'expense');
assert.strictEqual(evaluated.lines[7].resultText, '− ₹50');

// Line 9: Apples -240 (Expense)
assert.strictEqual(evaluated.lines[8].amount, 240);
assert.strictEqual(evaluated.lines[8].type, 'expense');
assert.strictEqual(evaluated.lines[8].resultText, '− ₹240');

// Line 10: Shopping Discount -350 (Expense)
assert.strictEqual(evaluated.lines[9].amount, 350);
assert.strictEqual(evaluated.lines[9].type, 'expense');
assert.strictEqual(evaluated.lines[9].resultText, '− ₹350');

// Totals:
// Income: 50000 + 500 = 50500
// Expense: 12000 + 125 + 1200 + 2000 + 50 + 240 + 350 = 15965
// Net: 50500 - 15965 = 34535
assert.strictEqual(evaluated.totalIncome, 50500);
assert.strictEqual(evaluated.totalExpense, 15965);
assert.strictEqual(evaluated.netTotal, 34535);
assert.strictEqual(evaluated.validCount, 9);

console.log('✓ All 10 sample calculation lines verified and evaluated accurately');
console.log('All Paper Guide Modal Tests Passed Successfully!');
