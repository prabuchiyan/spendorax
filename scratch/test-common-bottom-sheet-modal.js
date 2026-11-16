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
