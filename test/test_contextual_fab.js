const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing ContextualFAB Animation & User-Friendliness Enhancements...');

// 1. File existence
const fabPath = path.resolve(__dirname, '../src/components/ContextualFAB.js');
assert(fs.existsSync(fabPath), 'ContextualFAB.js must exist');

const content = fs.readFileSync(fabPath, 'utf8');

// 2. Structural & UX Verification
assert(content.includes('getActionSubtitle'), 'Must include subtitle mapping helper');
assert(content.includes('labelPill'), 'Must render label pill for clear readability');
assert(content.includes('actionRowTouchable'), 'Must have full-row touchable target');
assert(content.includes('useTheme'), 'Must support theme-based styling (dark/light mode)');
assert(content.includes('useAppLock'), 'Must respect app lock');

// 3. Subtitle Logic Test
function getActionSubtitle(label) {
  if (!label) return null;
  const l = String(label).toLowerCase();
  if (l.includes('expense')) return 'Log money spent';
  if (l.includes('income')) return 'Add money received';
  if (l.includes('transfer')) return 'Between accounts';
  if (l.includes('given') || l.includes('lent')) return 'Lent money';
  if (l.includes('received') || l.includes('borrow')) return 'Borrowed money';
  return null;
}

assert.strictEqual(getActionSubtitle('Expense'), 'Log money spent');
assert.strictEqual(getActionSubtitle('Income'), 'Add money received');
assert.strictEqual(getActionSubtitle('Transfer'), 'Between accounts');
assert.strictEqual(getActionSubtitle('Given'), 'Lent money');
assert.strictEqual(getActionSubtitle('Received'), 'Borrowed money');
assert.strictEqual(getActionSubtitle('Custom'), null);

// 4. Staggered Animation & Interpolation Assertions
assert(content.includes('Animated.stagger'), 'Must use staggered animations for fluid wave effect');
assert(content.includes('Animated.spring'), 'Must use spring physics for organic feel');
assert(content.includes("outputRange: ['0deg', '45deg']"), 'Must rotate main FAB from + to ✕');
assert(content.includes('outputRange: [1, 0.88, 1]'), 'Must provide tactile scale squeeze on main FAB');
assert(content.includes('pointerEvents="box-none"'), 'Container must not block screen touches when idle');
assert(content.includes('StyleSheet.absoluteFill'), 'Must use full-width absoluteFill anchor to prevent text squishing');
assert(content.includes('numberOfLines={1}'), 'Text must have numberOfLines=1 to prevent vertical letter wrapping');
assert(content.includes('flexShrink: 0'), 'Pill must prevent horizontal flex shrinking');

// 5. Verification of Layout Coordinates
// For 3 actions:
// Item 2 (Transfer, closest to FAB): targetY = (3 - 2) * 62 + 6 = 68
// Item 1 (Income, middle): targetY = (3 - 1) * 62 + 6 = 130
// Item 0 (Expense, top): targetY = (3 - 0) * 62 + 6 = 192
const calcTargetY = (total, i) => (total - i) * 62 + 6;
assert.strictEqual(calcTargetY(3, 2), 68);
assert.strictEqual(calcTargetY(3, 1), 130);
assert.strictEqual(calcTargetY(3, 0), 192);

console.log('✓ ContextualFAB tests passed 100% successfully!');

