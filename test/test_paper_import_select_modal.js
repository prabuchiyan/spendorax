/**
 * test_paper_import_select_modal.js
 * Unit tests for selective import checklist logic in Paper Ledger.
 */

const assert = require('assert');
const {
  selectAllCandidates,
  deselectAllCandidates,
  toggleCandidateSelection,
  filterSelectedCandidates,
  filterCandidatesBySearch,
} = require('../src/utils/paperLedgerUtils');

console.log('Testing Paper Import Selective Checklist Logic...');

const mockCandidates = [
  { id: '1', title: '14-12-2026: Groceries: Supermarket', amount: 1500, type: 'expense', category: 'Groceries' },
  { id: '2', title: '15-12-2026: Salary: Monthly Payout', amount: 80000, type: 'income', category: 'Salary' },
  { id: '3', title: '16-12-2026: Utilities: Electricity Bill', amount: 1200, type: 'expense', category: 'Utilities' },
];

// Test 1: selectAllCandidates
const allSelected = selectAllCandidates(mockCandidates);
assert.strictEqual(allSelected.size, 3, 'All candidates should be selected initially');
assert.ok(allSelected.has('1') && allSelected.has('2') && allSelected.has('3'), 'Contains all IDs');
console.log('✓ selectAllCandidates works');

// Test 2: toggleCandidateSelection
const afterToggle = toggleCandidateSelection(allSelected, '2');
assert.strictEqual(afterToggle.size, 2, 'One item should be deselected');
assert.ok(!afterToggle.has('2'), 'Item 2 should be deselected');
assert.ok(afterToggle.has('1') && afterToggle.has('3'), 'Items 1 and 3 should remain selected');
console.log('✓ toggleCandidateSelection deselects correctly');

const afterToggleBack = toggleCandidateSelection(afterToggle, '2');
assert.strictEqual(afterToggleBack.size, 3, 'Item 2 should be re-selected');
assert.ok(afterToggleBack.has('2'), 'Item 2 should be present');
console.log('✓ toggleCandidateSelection re-selects correctly');

// Test 3: deselectAllCandidates
const noneSelected = deselectAllCandidates();
assert.strictEqual(noneSelected.size, 0, 'No candidates should be selected');
console.log('✓ deselectAllCandidates works');

// Test 4: filterSelectedCandidates
const selectedItems = filterSelectedCandidates(mockCandidates, afterToggle);
assert.strictEqual(selectedItems.length, 2, 'Should filter out unselected candidate');
assert.strictEqual(selectedItems[0].id, '1');
assert.strictEqual(selectedItems[1].id, '3');
console.log('✓ filterSelectedCandidates works');

// Test 5: filterCandidatesBySearch
const searchFiltered = filterCandidatesBySearch(mockCandidates, 'Electric');
assert.strictEqual(searchFiltered.length, 1, 'Should find 1 matching item');
assert.strictEqual(searchFiltered[0].id, '3');

const searchCategory = filterCandidatesBySearch(mockCandidates, 'Groceries');
assert.strictEqual(searchCategory.length, 1);
assert.strictEqual(searchCategory[0].id, '1');

const searchEmpty = filterCandidatesBySearch(mockCandidates, '');
assert.strictEqual(searchEmpty.length, 3, 'Empty query returns all candidates');
console.log('✓ filterCandidatesBySearch works');

console.log('All Selective Import Tests Passed Successfully!');

