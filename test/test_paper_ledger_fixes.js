// test/test_paper_ledger_fixes.js
const assert = require('assert');
const {
  formatLedgerAmount,
  formatWhatsAppLedgerText
} = require('../src/utils/paperLedgerUtils');

console.log('Running Review Fixes Tests...');

// 1. Fractional formatting: 45000.50 should have two decimals, 100 should have 0
const formattedFraction = formatLedgerAmount(45000.5);
assert.strictEqual(formattedFraction, '₹45,000.50', 'Should format 45000.5 as ₹45,000.50');

const formattedInt = formatLedgerAmount(100);
assert.strictEqual(formattedInt, '₹100', 'Should format 100 as ₹100');

// 2. Zero net total should not have a plus sign
const emptyText = formatWhatsAppLedgerText([], 0);
assert.ok(!emptyText.includes('+₹0'), 'Zero net total should not have a plus sign');
assert.ok(emptyText.includes('*Total (Net):*  *₹0*'), 'Zero net total should be ₹0');

// 3. Multiline title sanitization in WhatsApp
const multilineItem = [
  { id: '1', title: 'Groceries\nMilk & Bread', type: 'expense', amount: 300 }
];
const multilineText = formatWhatsAppLedgerText(multilineItem, -300);
assert.ok(!multilineText.includes('Groceries\nMilk & Bread'), 'Should replace newlines with space in title');
assert.ok(multilineText.includes('Groceries Milk & Bread'), 'Should have flattened title on one line');

console.log('All Review Fixes Tests Passed!');

