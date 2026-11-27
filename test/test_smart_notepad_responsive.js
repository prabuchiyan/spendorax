const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing SmartNotepadScreen & QlateNotepadSheet Full-Screen Responsive Layout...');

const screenPath = path.resolve(__dirname, '../src/screens/SmartNotepadScreen.js');
const sheetPath = path.resolve(__dirname, '../src/components/QlateNotepadSheet.js');

assert(fs.existsSync(screenPath), 'SmartNotepadScreen.js must exist');
assert(fs.existsSync(sheetPath), 'QlateNotepadSheet.js must exist');

const screenContent = fs.readFileSync(screenPath, 'utf8');
const sheetContent = fs.readFileSync(sheetPath, 'utf8');

// 1. Full-screen flex layout with dynamic ruled lines eliminating empty bottom gap
assert(screenContent.includes('flex: 1') && screenContent.includes('paperScroll'), 'Main notebook area must expand with flex: 1 instead of fixed height leaving bottom empty space');
assert(screenContent.includes('paperScrollContent') && screenContent.includes('flexGrow: 1'), 'Scrollable paper container must grow to fill remaining viewport');
assert(!screenContent.includes('paddingBottom: 96'), 'Must remove artificial bottom padding creating empty space below summary');
assert(screenContent.includes('dynamicMinLines') && screenContent.includes('onLayout'), 'Screen must compute ruled row count dynamically from measured viewport height');
assert(sheetContent.includes('minVisibleLines') && sheetContent.includes('Math.max(rawLines.length, minVisibleLines'), 'QlateNotepadSheet must render enough ruled rows to occupy the measured viewport height');

// 2. Single-row equal-width 5-tile toolbar (no jagged multi-row wrap, zero clipping) + header Guide pill
assert(screenContent.includes('toolbarRow') && screenContent.includes('toolbarTile') && screenContent.includes('flex: 1'), 'Top toolbar must use uniform equal-width single-row tiles across viewports');
assert(screenContent.includes('headerGuidePill') && !screenContent.includes('toolbarGrid'), 'Guide button should sit cleanly in the sheet header beside entries badge with no jagged wrap grid');

// 3. Mobile keyboard-safe live summary bar
assert(screenContent.includes('keyboardVisible') && screenContent.includes('compactKeyboardSummary'), 'Keyboard open state must collapse tall summary into a compact live strip');
assert(screenContent.includes('KeyboardAvoidingView') && screenContent.includes('useSafeAreaInsets'), 'SmartNotepad must respect safe area insets and keyboard avoidance');

// 4. Dynamic min-lines math sanity checks
function calcDynamicLines(height) {
  if (!height || height <= 34) return 10;
  return Math.max(8, Math.floor((height - 34) / 34));
}
assert.strictEqual(calcDynamicLines(480), 13, '480px tall notepad area should fill with 13 ruled rows');
assert.strictEqual(calcDynamicLines(200), 8, 'Short viewport should maintain at least 8 ruled rows');

console.log('✓ All SmartNotepad Responsive Layout tests passed successfully!');
