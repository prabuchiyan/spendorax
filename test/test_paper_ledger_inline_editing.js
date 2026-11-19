/**
 * test_paper_ledger_inline_editing.js
 * Tests for formatting ledger items into freeform strings for inline on-paper editing.
 */

const assert = require('assert');
const {
  formatItemToFreeformLine,
  parseNotepadLine,
} = require('../src/utils/paperLedgerUtils');

console.log('Testing Paper Ledger Inline Editing Formatter & Parser Round-Trip...');

// Test 1: Plain expense item
const expenseItem = {
  id: '1',
  title: 'Dinner',
  amount: 450,
  type: 'expense',
  formula: null,
};
const expenseStr = formatItemToFreeformLine(expenseItem);
assert.strictEqual(expenseStr, 'Dinner 450');
const parsedExpense = parseNotepadLine(expenseStr);
assert.strictEqual(parsedExpense.title, 'Dinner');
assert.strictEqual(parsedExpense.amount, 450);
assert.strictEqual(parsedExpense.type, 'expense');
console.log('✓ Expense item formats to "Dinner 450" and round-trips correctly');

// Test 2: Income item
const incomeItem = {
  id: '2',
  title: 'Monthly Salary',
  amount: 50000,
  type: 'income',
  formula: null,
};
const incomeStr = formatItemToFreeformLine(incomeItem);
assert.strictEqual(incomeStr, 'Monthly Salary +50000');
const parsedIncome = parseNotepadLine(incomeStr);
assert.strictEqual(parsedIncome.title, 'Monthly Salary');
assert.strictEqual(parsedIncome.amount, 50000);
assert.strictEqual(parsedIncome.type, 'income');
console.log('✓ Income item formats to "Monthly Salary +50000" and round-trips correctly');

// Test 3: Formula item (Expense)
const formulaItem = {
  id: '3',
  title: 'Grocery Mart',
  amount: 125,
  type: 'expense',
  formula: '100+25',
};
const formulaStr = formatItemToFreeformLine(formulaItem);
assert.strictEqual(formulaStr, 'Grocery Mart 100+25');
const parsedFormula = parseNotepadLine(formulaStr);
assert.strictEqual(parsedFormula.title, 'Grocery Mart');
assert.strictEqual(parsedFormula.amount, 125);
assert.strictEqual(parsedFormula.formula, '100+25');
console.log('✓ Formula item formats to "Grocery Mart 100+25" and round-trips correctly');

// Test 4: Formula item (Income)
const incomeFormulaItem = {
  id: '4',
  title: 'Freelance Bonus',
  amount: 500,
  type: 'income',
  formula: '100*5',
};
const incomeFormulaStr = formatItemToFreeformLine(incomeFormulaItem);
assert.strictEqual(incomeFormulaStr, 'Freelance Bonus +100*5');
const parsedIncomeFormula = parseNotepadLine(incomeFormulaStr);
assert.strictEqual(parsedIncomeFormula.title, 'Freelance Bonus');
assert.strictEqual(parsedIncomeFormula.amount, 500);
assert.strictEqual(parsedIncomeFormula.type, 'income');
console.log('✓ Income formula item formats to "Freelance Bonus +100*5" and round-trips correctly');

// Test 5: Empty / edge inputs
assert.strictEqual(formatItemToFreeformLine(null), '');
assert.strictEqual(formatItemToFreeformLine({}), '');
console.log('✓ Edge cases handled gracefully');

console.log('All Inline Editing Formatter Tests Passed Successfully!');
