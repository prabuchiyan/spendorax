const assert = require('assert');
const {
  calculateLedgerTotals,
  formatLedgerAmount,
  formatWhatsAppLedgerText,
} = require('../src/utils/smartNotepadUtils');

console.log('Testing Paper Ledger Math & Formula End-to-End...');

const sampleItems = [
  {
    id: '1',
    title: 'Department Store',
    type: 'expense',
    amount: 125,
    formula: '100 + 25',
  },
  {
    id: '2',
    title: 'Freelance Design',
    type: 'income',
    amount: 500,
    formula: '100 * 5',
  },
  {
    id: '3',
    title: 'Service Tip',
    type: 'expense',
    amount: 25,
    formula: '100 % 25',
  },
  {
    id: '4',
    title: 'Electricity Bill',
    type: 'expense',
    amount: 1200,
    formula: null,
  },
];

// 1. Calculations
const totals = calculateLedgerTotals(sampleItems);
assert.strictEqual(totals.totalIncome, 500);
assert.strictEqual(totals.totalExpense, 1350);
assert.strictEqual(totals.netTotal, -850);
console.log('✓ Totals calculated correctly: Income 500, Expense 1350, Net -850');

// 2. WhatsApp Export with Formulas
const waText = formatWhatsAppLedgerText(sampleItems, totals.netTotal, '18 Nov 2026');
assert.ok(waText.includes('1) Department Store [100 + 25] [-]'), 'WhatsApp output should include formula for row 1');
assert.ok(waText.includes('2) Freelance Design [100 * 5] [+]'), 'WhatsApp output should include formula for row 2');
assert.ok(waText.includes('3) Service Tip [100 % 25] [-]'), 'WhatsApp output should include formula for row 3');
assert.ok(waText.includes('4) Electricity Bill [-]'), 'WhatsApp output without formula should format normally');
assert.ok(!waText.includes('4) Electricity Bill [ ]'), 'No empty formula bracket');

console.log('✓ WhatsApp Export with Formulas verified:\n' + waText);

console.log('\nAll Paper Ledger Math End-to-End Tests Passed Successfully!');
