const assert = require('assert');
const fs = require('fs');
const babel = require('@babel/core');

console.log('Testing Task 1: CommonBottomSheetModal...');
const modalPath = 'src/components/CommonBottomSheetModal.js';
assert(fs.existsSync(modalPath), 'CommonBottomSheetModal.js must exist');
babel.transformFileSync(modalPath, { presets: ['babel-preset-expo'] });

const code = fs.readFileSync(modalPath, 'utf8');
assert(code.includes('export default function CommonBottomSheetModal'), 'Exports CommonBottomSheetModal');
assert(code.includes('ActivityIndicator'), 'Includes ActivityIndicator loader');
assert(code.includes('sheetHandle'), 'Includes sheetHandle for bottom sheet design');
assert(code.includes('disabled={loading}'), 'Disables buttons when loading');
console.log('✓ Task 1 test passed');

console.log('Testing Task 2: Budget & Category Screens...');
const task2Files = [
  'src/screens/BudgetsScreen.js',
  'src/screens/CategoriesScreen.js',
  'src/screens/CategoriesDetails.js',
];

task2Files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  assert(!code.includes("import ConfirmDialog from"), `${file} should not import ConfirmDialog`);
  assert(code.includes("import CommonBottomSheetModal from"), `${file} should import CommonBottomSheetModal`);
  assert(code.includes("<CommonBottomSheetModal"), `${file} should render CommonBottomSheetModal`);
  babel.transformFileSync(file, { presets: ['babel-preset-expo'] });
  console.log(`✓ Task 2 verified: ${file}`);
});

console.log('Testing Task 3: Credit Cards & Sources Screens...');
const task3Files = [
  'src/screens/CreditCardsScreen.js',
  'src/screens/CreditCardStatementsScreen.js',
  'src/screens/SourcesScreen.js',
];

task3Files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  assert(!code.includes("import ConfirmDialog from"), `${file} should not import ConfirmDialog`);
  assert(code.includes("import CommonBottomSheetModal from"), `${file} should import CommonBottomSheetModal`);
  assert(code.includes("<CommonBottomSheetModal"), `${file} should render CommonBottomSheetModal`);
  babel.transformFileSync(file, { presets: ['babel-preset-expo'] });
  console.log(`✓ Task 3 verified: ${file}`);
});

console.log('Testing Task 4: Loans & Transactions Screens...');
const task4Files = [
  'src/screens/LoanFormScreen.js',
  'src/components/TransactionForm.js',
];

task4Files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  assert(!code.includes("import ConfirmDialog from"), `${file} should not import ConfirmDialog`);
  assert(code.includes("import CommonBottomSheetModal from"), `${file} should import CommonBottomSheetModal`);
  assert(code.includes("<CommonBottomSheetModal"), `${file} should render CommonBottomSheetModal`);
  babel.transformFileSync(file, { presets: ['babel-preset-expo'] });
  console.log(`✓ Task 4 verified: ${file}`);
});

console.log('Testing Task 5: BillDetail, LinkedBillCard, ExitModal, and removal of ConfirmDialog...');
const task5Files = [
  'src/screens/BillDetailScreen.js',
  'src/components/LinkedBillCard.js',
  'src/components/ExitConfirmationModal.js',
  'src/screens/BillsScreen.js',
];

assert(!fs.existsSync('src/components/ConfirmDialog.js'), 'ConfirmDialog.js should be deleted');

task5Files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  assert(!code.includes("import ConfirmDialog from"), `${file} should not import ConfirmDialog`);
  babel.transformFileSync(file, { presets: ['babel-preset-expo'] });
  console.log(`✓ Task 5 verified syntax: ${file}`);
});
