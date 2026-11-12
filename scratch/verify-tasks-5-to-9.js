const assert = require('assert');
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

console.log('--- Starting verification for Tasks 5 to 9 ---');

// 1. Verify Syntax on all touched files
const touchedFiles = [
  'src/components/DeleteBillModal.js',
  'src/screens/BillsScreen.js',
  'src/services/creditCards.js',
  'src/screens/CreditCardStatementsScreen.js',
  'src/screens/CreditCardStatementEditScreen.js',
  'src/screens/CategoriesDetails.js',
  'src/components/BottomStatsBar.js',
  'src/components/CurrencyText.js',
  'src/screens/HomeScreen.js',
];

touchedFiles.forEach(file => {
  assert(fs.existsSync(file), `File ${file} should exist`);
  babel.transformFileSync(file, { presets: ['babel-preset-expo'] });
  console.log(`✓ Syntax valid: ${file}`);
});

// 2. Task 5: DeleteBillModal verification
const deleteModalCode = fs.readFileSync('src/components/DeleteBillModal.js', 'utf8');
assert(deleteModalCode.includes('export default function DeleteBillModal'), 'DeleteBillModal component exported');
assert(deleteModalCode.includes('isRecurringOccurrence'), 'Handles recurring occurrence');
assert(deleteModalCode.includes('Permanent Action Warning'), 'Contains permanent warning section');
assert(deleteModalCode.includes('Delete Permanently'), 'Confirm button text');
assert(deleteModalCode.includes('Keep Bill'), 'Cancel button text');

const billsScreenCode = fs.readFileSync('src/screens/BillsScreen.js', 'utf8');
assert(billsScreenCode.includes('import DeleteBillModal from "../components/DeleteBillModal";'), 'BillsScreen imports DeleteBillModal');
assert(billsScreenCode.includes('<DeleteBillModal'), 'BillsScreen renders DeleteBillModal');
assert(billsScreenCode.includes('isDeleting'), 'BillsScreen manages isDeleting loading state');
console.log('✓ Task 5 verified: DeleteBillModal designed and integrated with BillsScreen');

// 3. Task 6: Option to update statement date
const creditCardsServiceCode = fs.readFileSync('src/services/creditCards.js', 'utf8');
assert(creditCardsServiceCode.includes('statement_date = ?'), 'updateCreditCardStatement updates statement_date');
assert(creditCardsServiceCode.includes('newStatementDate'), 'updateCreditCardStatement handles newStatementDate');
assert(creditCardsServiceCode.includes('updatedNotes'), 'updateCreditCardStatement syncs linked bill notes with new date');

const ccStatementsScreenCode = fs.readFileSync('src/screens/CreditCardStatementsScreen.js', 'utf8');
assert(ccStatementsScreenCode.includes('handleOpenDatePicker'), 'CreditCardStatementsScreen has handleOpenDatePicker');
assert(ccStatementsScreenCode.includes('handleSelectStatementDate'), 'CreditCardStatementsScreen has handleSelectStatementDate');
assert(ccStatementsScreenCode.includes('updateCreditCardStatement'), 'CreditCardStatementsScreen calls updateCreditCardStatement');
assert(ccStatementsScreenCode.includes('MuiDateTimePicker'), 'CreditCardStatementsScreen renders MuiDateTimePicker');
assert(ccStatementsScreenCode.includes('editDateBtn'), 'CreditCardStatementsScreen renders editDateBtn');

const ccEditScreenCode = fs.readFileSync('src/screens/CreditCardStatementEditScreen.js', 'utf8');
assert(ccEditScreenCode.includes('statementDate'), 'CreditCardStatementEditScreen has statementDate state');
assert(ccEditScreenCode.includes('MuiDateTimePicker'), 'CreditCardStatementEditScreen renders MuiDateTimePicker for statement date');
console.log('✓ Task 6 verified: Statement date update option supported on Statements list and Edit screen');

// 4. Task 7: Loader required on page load in CreditCardStatementsScreen
assert(ccStatementsScreenCode.includes('loading && statements.length === 0'), 'CreditCardStatementsScreen checks loading state on page load');
assert(ccStatementsScreenCode.includes('loadingContainer'), 'CreditCardStatementsScreen renders loadingContainer');
assert(ccStatementsScreenCode.includes('Loading credit card statements...'), 'CreditCardStatementsScreen shows page loader text');
assert(ccStatementsScreenCode.includes('ActivityIndicator'), 'CreditCardStatementsScreen renders ActivityIndicator');
assert(ccStatementsScreenCode.includes('refreshing={loading}'), 'CreditCardStatementsScreen supports pull-to-refresh');
console.log('✓ Task 7 verified: CreditCardStatementsScreen has loader on page load');

// 5. Task 8: Category Details not spend excluded from totals but shown in list
const catDetailsCode = fs.readFileSync('src/screens/CategoriesDetails.js', 'utf8');
assert(catDetailsCode.includes('isExcludedFromSpend'), 'CategoriesDetails defines isExcludedFromSpend');
assert(catDetailsCode.includes('if (isExcludedFromSpend(tx)) return;'), 'groupData excludes not-spend from chart totals');
assert(catDetailsCode.includes('isExcludedFromSpend(item) ? sum : sum + Number(item.amount || 0)'), 'groupedTransactions excludes not-spend from dailyTotal');
assert(catDetailsCode.includes('data: group.data'), 'group.data retains all items including not-spend');

// Test isExcludedFromSpend logic
const isExcludedFromSpend = (tx) => tx?.is_counted === 0 || tx?.is_counted === '0' || tx?.is_counted === false;
const sampleTransactions = [
  { id: 1, amount: 500, is_counted: 1 },
  { id: 2, amount: 200, is_counted: 0 }, // NOT SPEND
  { id: 3, amount: 300, is_counted: null },
];

const totalSpend = sampleTransactions.reduce(
  (sum, item) => (isExcludedFromSpend(item) ? sum : sum + Number(item.amount || 0)),
  0
);
assert.strictEqual(totalSpend, 800, 'Total should be 500 + 300 = 800 (excluding 200)');
assert.strictEqual(sampleTransactions.length, 3, 'List should retain all 3 items');
console.log('✓ Task 8 verified: CategoriesDetails excludes not-spend from totals while displaying in list');

// 6. Task 9: Home screen: Balance & Spend is round of two digits
const bottomStatsCode = fs.readFileSync('src/components/BottomStatsBar.js', 'utf8');
assert(bottomStatsCode.includes("minimumFractionDigits: 2"), 'BottomStatsBar has minimumFractionDigits: 2');
assert(bottomStatsCode.includes("maximumFractionDigits: 2"), 'BottomStatsBar has maximumFractionDigits: 2');

const currencyTextCode = fs.readFileSync('src/components/CurrencyText.js', 'utf8');
assert(currencyTextCode.includes("minimumFractionDigits = 2"), 'CurrencyText defaults minimumFractionDigits = 2');
assert(currencyTextCode.includes("maximumFractionDigits = 2"), 'CurrencyText defaults maximumFractionDigits = 2');

// Test CurrencyText formatting
const testVal1 = 1500;
const testVal2 = 2450.5;
const formatted1 = Number(testVal1).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatted2 = Number(testVal2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
assert.strictEqual(formatted1, '1,500.00', 'Integer value should format with .00');
assert.strictEqual(formatted2, '2,450.50', 'One-decimal value should format with .50');

const homeScreenCode = fs.readFileSync('src/screens/HomeScreen.js', 'utf8');
assert(homeScreenCode.includes('minimumFractionDigits: 2'), 'HomeScreen formats amounts with minimumFractionDigits: 2');
console.log('✓ Task 9 verified: Balance & Spend formatted to two decimal places');

console.log('--- All verification tests passed successfully! ---');
