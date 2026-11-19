/**
 * test_qlate_document_parser.js
 * Unit tests for continuous multiline Qlate notepad document parsing.
 */

const assert = require('assert');
const { parseNotepadDocument } = require('../src/utils/paperLedgerUtils');

console.log('Testing Qlate Continuous Notepad Document Parser...');

// Test 1: Mixed multiline text document
const sampleDoc = `Dinner -450
Salary 50000
Grocery -125
This is just a note with no numbers
Electricity Bill -1200
Freelance Design 100*5`;

const docResult = parseNotepadDocument(sampleDoc);

assert.strictEqual(docResult.lines.length, 6, 'Should have 6 lines evaluated');

// Line 1: Dinner -450
assert.strictEqual(docResult.lines[0].text, 'Dinner -450');
assert.strictEqual(docResult.lines[0].amount, 450);
assert.strictEqual(docResult.lines[0].type, 'expense');
assert.strictEqual(docResult.lines[0].resultText, '− ₹450');

// Line 2: Salary 50000
assert.strictEqual(docResult.lines[1].text, 'Salary 50000');
assert.strictEqual(docResult.lines[1].amount, 50000);
assert.strictEqual(docResult.lines[1].type, 'income');
assert.strictEqual(docResult.lines[1].resultText, '+ ₹50,000');

// Line 3: Grocery -125
assert.strictEqual(docResult.lines[2].amount, 125);
assert.strictEqual(docResult.lines[2].type, 'expense');
assert.strictEqual(docResult.lines[2].resultText, '− ₹125');

// Line 4: Plain note
assert.strictEqual(docResult.lines[3].amount, null);
assert.strictEqual(docResult.lines[3].resultText, '');

// Line 5: Electricity Bill -1200
assert.strictEqual(docResult.lines[4].amount, 1200);
assert.strictEqual(docResult.lines[4].type, 'expense');

// Line 6: Freelance Design 100*5 (Income formula = 500)
assert.strictEqual(docResult.lines[5].amount, 500);
assert.strictEqual(docResult.lines[5].type, 'income');
assert.strictEqual(docResult.lines[5].formula, '100*5');
assert.strictEqual(docResult.lines[5].resultText, '+ ₹500');

// Totals:
// Income: 50000 + 500 = 50500
// Expense: 450 + 125 + 1200 = 1775
// Net: 50500 - 1775 = 48725
assert.strictEqual(docResult.totalIncome, 50500);
assert.strictEqual(docResult.totalExpense, 1775);
assert.strictEqual(docResult.netTotal, 48725);
assert.strictEqual(docResult.validCount, 5);

console.log('✓ Multi-line document evaluation and totals match expected values');

// Test 2: Empty document
const emptyResult = parseNotepadDocument('');
assert.strictEqual(emptyResult.lines.length, 1);
assert.strictEqual(emptyResult.totalIncome, 0);
assert.strictEqual(emptyResult.totalExpense, 0);
assert.strictEqual(emptyResult.netTotal, 0);
assert.strictEqual(emptyResult.validCount, 0);
console.log('✓ Empty document handled cleanly');

console.log('All Qlate Document Parser Tests Passed Successfully!');
