const assert = require('assert');
const { evaluateMathExpression } = require('../src/utils/mathExpressionParser');

// Simulate modal submission logic with math expression support
function prepareModalAmount(initialItem) {
  if (!initialItem) return '';
  if (initialItem.formula) return String(initialItem.formula);
  if (initialItem.amount !== undefined && initialItem.amount !== null) return String(initialItem.amount);
  return '';
}

function handleInsertOperator(currentText, op) {
  if (op === 'C') {
    return '';
  }
  const trimmed = (currentText || '').trim();
  if (!trimmed) {
    if (op === '-' || op === '−') return '-';
    return '';
  }
  // If ending with an operator, replace it
  const endsWithOp = /[+\-*/%]$/.test(trimmed);
  if (endsWithOp) {
    return trimmed.slice(0, -1).trim() + ` ${op} `;
  }
  return `${trimmed} ${op} `;
}

function processModalSubmission({ title, type, amountInput, initialItem }) {
  const trimmedTitle = (title || '').trim();
  if (!trimmedTitle) {
    return { error: 'Please enter a description or note' };
  }

  const evalResult = evaluateMathExpression(amountInput);
  if (!evalResult.isValid || evalResult.result === null || evalResult.result <= 0) {
    return { error: 'Please enter a valid amount or formula greater than 0' };
  }

  const result = {
    title: trimmedTitle,
    type,
    amount: evalResult.result,
    formula: evalResult.hasOperator ? amountInput.trim() : null,
  };

  if (initialItem && initialItem.id) {
    result.id = initialItem.id;
  }

  return { success: true, item: result };
}

console.log('Testing Paper Add Row Modal Math Logic...');

// 1. Math formula input submission
const sub1 = processModalSubmission({
  title: 'Dinner with friends',
  type: 'expense',
  amountInput: '100 + 25',
  initialItem: null,
});
assert.strictEqual(sub1.success, true);
assert.strictEqual(sub1.item.amount, 125);
assert.strictEqual(sub1.item.formula, '100 + 25');
console.log('✓ Formula "100 + 25" evaluates to 125 and stores formula');

// 2. Percentage formula
const sub2 = processModalSubmission({
  title: 'Tip & Tax',
  type: 'expense',
  amountInput: '100 % 25',
  initialItem: null,
});
assert.strictEqual(sub2.success, true);
assert.strictEqual(sub2.item.amount, 25);
assert.strictEqual(sub2.item.formula, '100 % 25');
console.log('✓ Percentage "100 % 25" evaluates to 25 and stores formula');

// 3. Plain number without formula
const sub3 = processModalSubmission({
  title: 'Bus Ticket',
  type: 'expense',
  amountInput: '50',
  initialItem: null,
});
assert.strictEqual(sub3.success, true);
assert.strictEqual(sub3.item.amount, 50);
assert.strictEqual(sub3.item.formula, null);
console.log('✓ Plain number stores amount and null formula');

// 4. Initial state for editing
const existingItemWithFormula = {
  id: 'row_1',
  title: 'Groceries',
  amount: 500,
  formula: '100 * 5',
};
assert.strictEqual(prepareModalAmount(existingItemWithFormula), '100 * 5');

const existingItemPlain = {
  id: 'row_2',
  title: 'Rent',
  amount: 15000,
};
assert.strictEqual(prepareModalAmount(existingItemPlain), '15000');
console.log('✓ Editing item restores formula if present');

// 5. Operator insertion
let expr = '100';
expr = handleInsertOperator(expr, '+');
assert.strictEqual(expr, '100 + ');
expr += '25';
assert.strictEqual(expr, '100 + 25');
expr = handleInsertOperator(expr, 'C');
assert.strictEqual(expr, '');
console.log('✓ Operator insertion and Clear work as expected');

console.log('All Modal Math Logic Tests Passed Successfully!');

