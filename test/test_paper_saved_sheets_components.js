const assert = require('assert');

// Simulate PaperSaveSheetModal validation & default naming
function getDefaultSheetTitle(currentDate = new Date()) {
  const dateStr = currentDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  return `Calculation - ${dateStr}`;
}

function validateSaveSheetTitle(title) {
  const trimmed = (title || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Please enter a sheet name' };
  }
  if (trimmed.length > 60) {
    return { isValid: false, error: 'Sheet name cannot exceed 60 characters' };
  }
  return { isValid: true, title: trimmed };
}

// Simulate PaperSavedSheetsModal search filtering and sorting
function filterAndSortSheets(sheets, searchQuery = '') {
  const q = (searchQuery || '').toLowerCase().trim();
  const filtered = (sheets || []).filter(s =>
    !q || (s.title && s.title.toLowerCase().includes(q))
  );

  return filtered.sort((a, b) => {
    // 1. Pinned first
    const aPinned = Number(a.is_pinned) === 1 ? 1 : 0;
    const bPinned = Number(b.is_pinned) === 1 ? 1 : 0;
    if (bPinned !== aPinned) {
      return bPinned - aPinned;
    }
    // 2. Most recently updated
    return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
  });
}

console.log('Testing Paper Saved Sheets Components Logic...');

// 1. Default Sheet Title
const defaultTitle = getDefaultSheetTitle(new Date('2026-11-18T10:00:00Z'));
assert.strictEqual(defaultTitle, 'Calculation - 18 Nov 2026');
console.log('✓ Default title generation verified');

// 2. Title Validation
const emptyVal = validateSaveSheetTitle('   ');
assert.strictEqual(emptyVal.isValid, false);
assert.strictEqual(emptyVal.error, 'Please enter a sheet name');

const validVal = validateSaveSheetTitle('  November Office Rent & Snacks  ');
assert.strictEqual(validVal.isValid, true);
assert.strictEqual(validVal.title, 'November Office Rent & Snacks');
console.log('✓ Sheet title validation verified');

// 3. Search and Pin Sorting
const sheets = [
  { id: 1, title: 'House Budget', is_pinned: 0, updated_at: '2026-11-18T12:00:00Z' },
  { id: 2, title: 'Trip Planning', is_pinned: 1, updated_at: '2026-11-17T10:00:00Z' },
  { id: 3, title: 'Groceries Checklist', is_pinned: 0, updated_at: '2026-11-18T14:00:00Z' },
  { id: 4, title: 'Monthly Salary Breakdown', is_pinned: 1, updated_at: '2026-11-18T09:00:00Z' },
];

const sorted = filterAndSortSheets(sheets);
// Pinned sheets (id: 4 then id: 2) must come before unpinned (id: 3 then id: 1)
assert.strictEqual(sorted[0].id, 4, 'Most recent pinned sheet first');
assert.strictEqual(sorted[1].id, 2, 'Second pinned sheet second');
assert.strictEqual(sorted[2].id, 3, 'Most recent unpinned sheet third');
assert.strictEqual(sorted[3].id, 1, 'Older unpinned sheet fourth');
console.log('✓ Pin sorting order verified');

// 4. Search filtering
const searched = filterAndSortSheets(sheets, 'groceries');
assert.strictEqual(searched.length, 1);
assert.strictEqual(searched[0].id, 3);
console.log('✓ Search query filtering verified');

console.log('All Component Logic Tests Passed Successfully!');
