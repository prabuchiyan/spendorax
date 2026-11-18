const assert = require('assert');
const { evaluateMathExpression } = require('../src/utils/mathExpressionParser');

console.log('Testing Math Expression Parser Utility...');

// 1. Addition
const r1 = evaluateMathExpression('100 + 25');
assert.strictEqual(r1.isValid, true);
assert.strictEqual(r1.result, 125);
assert.strictEqual(r1.hasOperator, true);
console.log('✓ 100 + 25 = 125');

// 2. Subtraction
const r2 = evaluateMathExpression('100 - 25');
assert.strictEqual(r2.isValid, true);
assert.strictEqual(r2.result, 75);
console.log('✓ 100 - 25 = 75');

// 3. Division
const r3 = evaluateMathExpression('100 / 25');
assert.strictEqual(r3.isValid, true);
assert.strictEqual(r3.result, 4);
console.log('✓ 100 / 25 = 4');

// 4. Multiplication
const r4 = evaluateMathExpression('100 * 5');
assert.strictEqual(r4.isValid, true);
assert.strictEqual(r4.result, 500);
console.log('✓ 100 * 5 = 500');

// 5. Percentage (A % B = A * (B / 100))
const r5 = evaluateMathExpression('100 % 25');
assert.strictEqual(r5.isValid, true);
assert.strictEqual(r5.result, 25);
console.log('✓ 100 % 25 = 25 (25% of 100)');

const r5b = evaluateMathExpression('250 % 10');
assert.strictEqual(r5b.isValid, true);
assert.strictEqual(r5b.result, 25);
console.log('✓ 250 % 10 = 25 (10% of 250)');

// 6. Parentheses
const r6 = evaluateMathExpression('(100 + 25) * 2');
assert.strictEqual(r6.isValid, true);
assert.strictEqual(r6.result, 250);
console.log('✓ (100 + 25) * 2 = 250');

// 7. Unicode Operators (×, ÷, −)
const r7 = evaluateMathExpression('100 × 5 + 50 ÷ 2 − 10');
assert.strictEqual(r7.isValid, true);
assert.strictEqual(r7.result, 515);
console.log('✓ Unicode operators (×, ÷, −) supported');

// 8. Plain Number without Operator
const r8 = evaluateMathExpression('350.75');
assert.strictEqual(r8.isValid, true);
assert.strictEqual(r8.result, 350.75);
assert.strictEqual(r8.hasOperator, false);
console.log('✓ Plain number 350.75 handled with hasOperator=false');

// 9. Division by Zero
const r9 = evaluateMathExpression('100 / 0');
assert.strictEqual(r9.isValid, false);
assert.ok(r9.error.includes('zero'));
console.log('✓ Division by zero safely caught');

// 10. Incomplete expression while typing
const r10 = evaluateMathExpression('100 + ');
assert.strictEqual(r10.isValid, false);
assert.strictEqual(r10.result, null);
console.log('✓ Incomplete expression while typing safely returned as invalid');

// 11. Empty or whitespace
const r11 = evaluateMathExpression('   ');
assert.strictEqual(r11.isValid, false);
assert.strictEqual(r11.result, null);
console.log('✓ Empty string handled gracefully');

console.log('\nAll Math Expression Parser Tests Passed Successfully!');

