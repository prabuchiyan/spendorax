const assert = require('assert');

console.log('Testing Paper Confirm Modal & New Sheet Logic...');

// Mock state simulation
let items = [{ id: '1', title: 'Test Row', amount: 100, type: 'expense' }];
let activeSheetId = 42;
let activeSheetTitle = 'Calculation - 18 Nov 2026';
let activeSheetLastUpdated = '2026-11-18T14:00:00.000Z';
let confirmModalConfig = null;

const handleNewSheet = () => {
  items = [];
  activeSheetId = null;
  activeSheetTitle = null;
  activeSheetLastUpdated = null;
};

const handlePromptNewSheet = () => {
  if (items.length > 0) {
    confirmModalConfig = {
      visible: true,
      title: 'Start New Sheet?',
      message: 'This will clear the current calculation entries and start a fresh sheet. Make sure your changes are saved.',
      confirmLabel: 'New Sheet',
      confirmIcon: 'plus-circle-outline',
      onConfirm: () => {
        handleNewSheet();
        confirmModalConfig = null;
      },
      onCancel: () => {
        confirmModalConfig = null;
      },
    };
  } else {
    handleNewSheet();
  }
};

// 1. Test clicking + New when sheet has items
handlePromptNewSheet();
assert(confirmModalConfig !== null, 'Confirm modal should open when items exist');
assert.strictEqual(confirmModalConfig.title, 'Start New Sheet?');
assert.strictEqual(confirmModalConfig.confirmLabel, 'New Sheet');
assert.strictEqual(items.length, 1, 'Items should not be cleared before confirmation');

// 2. Test cancel
confirmModalConfig.onCancel();
assert.strictEqual(confirmModalConfig, null, 'Modal should close on cancel');
assert.strictEqual(items.length, 1, 'Items should remain intact after cancel');
assert.strictEqual(activeSheetId, 42, 'Active sheet should remain intact');

// 3. Test confirm
handlePromptNewSheet();
assert(confirmModalConfig !== null, 'Modal should open again');
confirmModalConfig.onConfirm();
assert.strictEqual(confirmModalConfig, null, 'Modal should close on confirm');
assert.strictEqual(items.length, 0, 'Items should be empty after confirm');
assert.strictEqual(activeSheetId, null, 'Active sheet ID should be null');
assert.strictEqual(activeSheetTitle, null, 'Active sheet title should be null');
assert.strictEqual(activeSheetLastUpdated, null, 'Active sheet last updated should be null');

// 4. Test clicking + New when sheet is empty
handlePromptNewSheet();
assert.strictEqual(confirmModalConfig, null, 'Modal should NOT open when sheet is already empty');
assert.strictEqual(items.length, 0);

console.log('✓ New Sheet confirmation logic verified successfully!');
