const assert = require('assert');

// Simulate PanResponder release logic for PaperSwipeableRow
function resolveSwipeAction(gestureState, isSelectionMode) {
  if (isSelectionMode) {
    return { action: 'none', reason: 'selection_mode' };
  }

  const absDx = Math.abs(gestureState.dx);
  const absVx = Math.abs(gestureState.vx);

  // Threshold: dx > 40 or velocity > 0.3
  if (absDx > 40 || absVx > 0.3) {
    if (gestureState.dx > 0) {
      // Swiping to the right (dx > 0) -> Delete
      return {
        action: 'delete',
        snapTo: 80,
      };
    } else {
      // Swiping to the left (dx < 0) -> Edit
      return {
        action: 'edit',
        snapTo: -80,
      };
    }
  }

  return { action: 'reset', snapTo: 0 };
}

console.log('Testing PaperSwipeableRow Swipe Actions Logic...');

// 1. Swipe Right triggers Delete
const swipeRightDistance = resolveSwipeAction({ dx: 65, vx: 0.1 }, false);
assert.strictEqual(swipeRightDistance.action, 'delete', 'Swipe right dx > 40 should trigger delete');
assert.strictEqual(swipeRightDistance.snapTo, 80, 'Swipe right should snap open right (+80)');

const swipeRightVelocity = resolveSwipeAction({ dx: 25, vx: 0.4 }, false);
assert.strictEqual(swipeRightVelocity.action, 'delete', 'Swipe right vx > 0.3 should trigger delete');
console.log('✓ Swipe Right -> Delete verified');

// 2. Swipe Left triggers Edit
const swipeLeftDistance = resolveSwipeAction({ dx: -55, vx: -0.1 }, false);
assert.strictEqual(swipeLeftDistance.action, 'edit', 'Swipe left dx < -40 should trigger edit');
assert.strictEqual(swipeLeftDistance.snapTo, -80, 'Swipe left should snap open left (-80)');

const swipeLeftVelocity = resolveSwipeAction({ dx: -20, vx: -0.45 }, false);
assert.strictEqual(swipeLeftVelocity.action, 'edit', 'Swipe left vx < -0.3 should trigger edit');
console.log('✓ Swipe Left -> Edit verified');

// 3. Small jitter resets row
const jitter = resolveSwipeAction({ dx: 15, vx: 0.05 }, false);
assert.strictEqual(jitter.action, 'reset');
assert.strictEqual(jitter.snapTo, 0);
console.log('✓ Small jitter resets position verified');

// 4. In selection mode, gestures are completely ignored
const inSelectionMode = resolveSwipeAction({ dx: 120, vx: 1.0 }, true);
assert.strictEqual(inSelectionMode.action, 'none');
console.log('✓ Selection mode gesture isolation verified');

console.log('All Swipe Action Tests Passed Successfully!');

