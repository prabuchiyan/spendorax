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
