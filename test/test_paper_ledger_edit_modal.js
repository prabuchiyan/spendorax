const assert = require('assert');

// Simulate PaperAddRowModal logic
function prepareModalState(initialItem) {
  if (initialItem) {
    return {
      title: initialItem.title || '',
      type: initialItem.type || 'expense',
      amount: initialItem.amount ? String(initialItem.amount) : '',
      isEditing: true,
      modalTitle: 'Edit Paper Entry',
      submitButtonText: 'Save Changes',
    };
  }
  return {
    title: '',
    type: 'expense',
    amount: '',
    isEditing: false,
    modalTitle: 'Add Paper Entry',
    submitButtonText: 'Add Line',
  };
}

function validateAndSubmit({ title, type, amount, initialItem }) {
  const trimmedTitle = (title || '').trim();
  const parsedAmount = parseFloat(amount);

  if (!trimmedTitle) {
    return { error: 'Please enter a description or note' };
  }
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return { error: 'Please enter a valid amount greater than 0' };
  }

  const result = {
    title: trimmedTitle,
    type,
    amount: parsedAmount,
  };

  if (initialItem && initialItem.id) {
    result.id = initialItem.id;
  }

  return { success: true, item: result };
}

console.log('Testing Paper Add/Edit Row Modal Logic...');

// 1. Initial State in Add Mode
const addState = prepareModalState(null);
assert.strictEqual(addState.isEditing, false);
assert.strictEqual(addState.modalTitle, 'Add Paper Entry');
assert.strictEqual(addState.submitButtonText, 'Add Line');
assert.strictEqual(addState.title, '');
assert.strictEqual(addState.amount, '');
console.log('✓ Add Mode initial state verified');

// 2. Initial State in Edit Mode
const sampleItem = {
  id: 'item_123',
  title: 'Consulting Fee',
  type: 'income',
  amount: 2500.5,
};
const editState = prepareModalState(sampleItem);
assert.strictEqual(editState.isEditing, true);
assert.strictEqual(editState.modalTitle, 'Edit Paper Entry');
assert.strictEqual(editState.submitButtonText, 'Save Changes');
assert.strictEqual(editState.title, 'Consulting Fee');
assert.strictEqual(editState.type, 'income');
assert.strictEqual(editState.amount, '2500.5');
console.log('✓ Edit Mode initial state populated correctly');

// 3. Submit in Edit Mode preserves ID and updates values
const submission = validateAndSubmit({
  title: 'Updated Consulting Fee',
  type: 'income',
  amount: '3000',
  initialItem: sampleItem,
});
assert.strictEqual(submission.success, true);
assert.strictEqual(submission.item.id, 'item_123');
assert.strictEqual(submission.item.title, 'Updated Consulting Fee');
assert.strictEqual(submission.item.amount, 3000);
console.log('✓ Edit Mode submission preserves ID and updates fields');

// 4. Validation errors
const badSubmit = validateAndSubmit({
  title: '',
  type: 'expense',
  amount: '50',
  initialItem: null,
});
assert.strictEqual(badSubmit.error, 'Please enter a description or note');

const badAmount = validateAndSubmit({
  title: 'Rent',
  type: 'expense',
  amount: '-10',
  initialItem: null,
});
assert.strictEqual(badAmount.error, 'Please enter a valid amount greater than 0');
console.log('✓ Validation errors verified');

console.log('All Paper Add/Edit Row Modal Tests Passed Successfully!');

