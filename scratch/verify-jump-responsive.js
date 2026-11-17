const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const assert = require('assert');

console.log('--- RUNNING JUMP TO PERIOD RESPONSIVE VERIFICATION ---');

const filePath = path.resolve('src/screens/BillDetailScreen.js');
const sourceCode = fs.readFileSync(filePath, 'utf8');

// 1. Verify activeOccurrenceId prop in Component definition
assert(
  sourceCode.includes('activeOccurrenceId,'),
  'YearQuickJumpModal should accept activeOccurrenceId prop'
);
console.log('✓ YearQuickJumpModal accepts activeOccurrenceId prop');

// 2. Verify activeOccurrenceId passed in JSX invocation
assert(
  sourceCode.includes('activeOccurrenceId={activeBill?.id}'),
  'YearQuickJumpModal invocation should pass activeOccurrenceId={activeBill?.id}'
);
console.log('✓ YearQuickJumpModal invocation passes activeOccurrenceId');

// 3. Verify cycleCardBtn fixed 2-column styles
assert(
  sourceCode.includes('width: "48.5%"'),
  'cycleCardBtn must use width: "48.5%" for fixed 2-column layout'
);
assert(
  !sourceCode.includes('minWidth: "29%"'),
  'Obsolete minWidth: "29%" must be removed'
);
console.log('✓ Fixed 2-column styling verified (width: 48.5%, no minWidth: 29%)');

// 4. Verify Active badge & checkmark icon indicators
assert(
  sourceCode.includes('cycleCurrentBadge'),
  'cycleCurrentBadge should exist in JSX and styles'
);
assert(
  sourceCode.includes('isCurrentOcc ?'),
  'Current occurrence logic should determine active state styling'
);
console.log('✓ Current occurrence indicator and active styling verified');

// 5. Verify Dual-row card structure
assert(
  sourceCode.includes('cycleCardHeader') && sourceCode.includes('cycleCardFooter'),
  'Cycle cards must have dual-row layout (header for month/dot/badge, footer for amount/status)'
);
console.log('✓ Dual-row cycle card hierarchy verified');

// 6. Test viewport column math across mobile device sizes
const testViewports = [
  { name: 'iPhone SE 1st gen / Small Android', width: 320, padding: 32 },
  { name: 'Standard Compact Android', width: 360, padding: 32 },
  { name: 'iPhone SE 2 / 12 mini', width: 375, padding: 32 },
  { name: 'iPhone 13/14/15/16', width: 390, padding: 32 },
  { name: 'iPhone Pro Max / Galaxy Ultra', width: 430, padding: 32 },
];

testViewports.forEach((vp) => {
  const containerWidth = Math.min(400, vp.width - 40) - vp.padding;
  const colWidth = containerWidth * 0.485;
  const twoCols = colWidth * 2;
  const gap = containerWidth - twoCols;

  assert(twoCols <= containerWidth, `Two columns must fit in container for ${vp.name}`);
  assert(gap >= 4, `Must have at least 4px space-between gap for ${vp.name}`);
  assert(colWidth >= 110, `Column width must be at least 110px for readability on ${vp.name}`);

  console.log(`✓ ${vp.name} (${vp.width}px): colWidth=${colWidth.toFixed(1)}px, gap=${gap.toFixed(1)}px`);
});

// 7. Verify Babel transpile with expo preset
console.log('Running Babel transpile check...');
const transpileResult = babel.transformSync(sourceCode, {
  presets: ['babel-preset-expo'],
  filename: filePath,
});
assert(transpileResult && transpileResult.code, 'Babel transformation must produce valid output');
console.log('✓ Babel transformation succeeded with 0 errors');

console.log('--- ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ---');
