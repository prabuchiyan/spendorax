/**
 * test_smart_notepad_backup_restore.js
 * Comprehensive tests for Smart Notepad backup and restore lifecycle.
 */

const assert = require('assert');

console.log('=== Running Smart Notepad Backup & Restore Tests ===\n');

// 1. Mock DB store for smart_notepads
const mockDb = {
  smart_notepads: [
    {
      id: 1,
      title: 'Monthly Budget & Calculation',
      data: JSON.stringify({
        raw_text: 'Salary 50000\nHouse Rent -12000',
        items: [
          { id: '1', title: 'Salary', amount: 50000, type: 'income' },
          { id: '2', title: 'House Rent', amount: 12000, type: 'expense' },
        ],
      }),
      total_income: 50000,
      total_expense: 12000,
      net_total: 38000,
      is_pinned: 1,
      created_at: '2026-11-19T10:00:00.000Z',
      updated_at: '2026-11-20T12:00:00.000Z',
    },
    {
      id: 2,
      title: 'Trip to Ooty',
      data: JSON.stringify({
        raw_text: 'Petrol 2500\nHotel -4000',
        items: [
          { id: '3', title: 'Petrol', amount: 2500, type: 'income' },
          { id: '4', title: 'Hotel', amount: 4000, type: 'expense' },
        ],
      }),
      total_income: 2500,
      total_expense: 4000,
      net_total: -1500,
      is_pinned: 0,
      created_at: '2026-11-18T08:00:00.000Z',
      updated_at: '2026-11-18T09:30:00.000Z',
    },
  ],
};

// 2. Test Backup Data Generation logic
console.log('1. Testing Backup Data Generation...');
function generateMockBackupData(db) {
  const smartNotepads = [...db.smart_notepads];
  return {
    version: 4,
    timestamp: new Date().toISOString(),
    data: {
      transactions: [],
      categories: [],
      sources: [],
      budgets: [],
      bills: [],
      smart_notepads: smartNotepads,
    },
  };
}

const backup = generateMockBackupData(mockDb);
assert.strictEqual(backup.version, 4, 'Backup version should be 4');
assert.ok(Array.isArray(backup.data.smart_notepads), 'smart_notepads must be an array');
assert.strictEqual(backup.data.smart_notepads.length, 2, 'Should backup 2 smart notepad sheets');
assert.strictEqual(backup.data.smart_notepads[0].title, 'Monthly Budget & Calculation');
assert.strictEqual(backup.data.smart_notepads[0].net_total, 38000);
assert.strictEqual(backup.data.paper_ledgers, undefined, 'paper_ledgers should not exist in new backup');
console.log('   ✓ Backup data contains only smart_notepads');

// 3. Test Backward Compatibility: Legacy backup without smart_notepads or with legacy paper_ledgers
console.log('\n2. Testing Backward Compatibility with Legacy Backups...');
function normalizeBackupData(fileContent) {
  const backupData = JSON.parse(fileContent);
  if (backupData.version >= 2) {
    backupData.data.smart_notepads ??= backupData.data.paper_ledgers ?? [];
  }
  return backupData;
}

const legacyV3Json = JSON.stringify({
  version: 3,
  timestamp: '2026-09-08T08:30:42.278Z',
  data: {
    transactions: [{ id: 1, amount: 500 }],
    categories: [],
    sources: [],
    budgets: [],
  },
});

const parsedLegacy = normalizeBackupData(legacyV3Json);
assert.ok(Array.isArray(parsedLegacy.data.smart_notepads), 'Legacy backup should normalize smart_notepads to array');
assert.strictEqual(parsedLegacy.data.smart_notepads.length, 0, 'Legacy backup should have empty smart_notepads');

// Legacy backup with old paper_ledgers name
const legacyWithOldNameJson = JSON.stringify({
  version: 3,
  timestamp: '2026-09-08T08:30:42.278Z',
  data: {
    paper_ledgers: [{ id: 5, title: 'Old Sheet', data: '[]' }],
  },
});
const parsedOldName = normalizeBackupData(legacyWithOldNameJson);
assert.strictEqual(parsedOldName.data.smart_notepads.length, 1, 'Should map legacy paper_ledgers into smart_notepads');
assert.strictEqual(parsedOldName.data.smart_notepads[0].title, 'Old Sheet');
console.log('   ✓ Legacy backups normalized gracefully into smart_notepads');

// 4. Test Restore in Replace Mode
console.log('\n3. Testing Restore in Replace Mode...');
function simulateRestore(backupData, mode, currentDb) {
  const targetDb = {
    smart_notepads: mode === 'replace' ? [] : [...currentDb.smart_notepads],
  };

  const restoredSmartNotepads =
    Array.isArray(backupData.data?.smart_notepads) && backupData.data.smart_notepads.length > 0
      ? backupData.data.smart_notepads
      : (Array.isArray(backupData.data?.paper_ledgers) ? backupData.data.paper_ledgers : []);

  for (const item of restoredSmartNotepads) {
    const trimmedTitle = (item.title || '').trim();
    if (!trimmedTitle) continue;

    if (mode === 'merge') {
      const exists = targetDb.smart_notepads.some((sn) => sn.title.toLowerCase() === trimmedTitle.toLowerCase());
      if (exists) continue; // Skip in merge mode if already exists
    }

    targetDb.smart_notepads.push({
      id: item.id || targetDb.smart_notepads.length + 1,
      title: trimmedTitle,
      data: typeof item.data === 'string' ? item.data : JSON.stringify(item.data || []),
      total_income: Number(item.total_income) || 0,
      total_expense: Number(item.total_expense) || 0,
      net_total: Number(item.net_total) || 0,
      is_pinned: item.is_pinned ? 1 : 0,
      created_at: item.created_at || new Date().toISOString(),
      updated_at: item.updated_at || new Date().toISOString(),
    });
  }

  return targetDb;
}

const emptyDb = { smart_notepads: [] };
const restoredReplace = simulateRestore(backup, 'replace', emptyDb);
assert.strictEqual(restoredReplace.smart_notepads.length, 2, 'Replace mode should restore all 2 sheets');
assert.strictEqual(restoredReplace.smart_notepads[0].title, 'Monthly Budget & Calculation');
assert.strictEqual(restoredReplace.smart_notepads[0].is_pinned, 1);
assert.strictEqual(restoredReplace.smart_notepads[1].title, 'Trip to Ooty');
assert.strictEqual(restoredReplace.smart_notepads[1].net_total, -1500);
console.log('   ✓ Replace mode successfully restored sheets with exact IDs, titles, totals, and pin flags');

// 5. Test Restore in Merge Mode
console.log('\n4. Testing Restore in Merge Mode (Deduplication)...');
const existingLocalDb = {
  smart_notepads: [
    {
      id: 99,
      title: 'Monthly Budget & Calculation', // Same title as in backup
      data: JSON.stringify({ raw_text: 'Existing local sheet' }),
      total_income: 1000,
      total_expense: 0,
      net_total: 1000,
      is_pinned: 0,
      created_at: '2026-11-20T00:00:00.000Z',
      updated_at: '2026-11-20T00:00:00.000Z',
    },
    {
      id: 100,
      title: 'Local Only Notes',
      data: JSON.stringify({ raw_text: 'Local unique sheet' }),
      total_income: 0,
      total_expense: 0,
      net_total: 0,
      is_pinned: 0,
      created_at: '2026-11-20T00:00:00.000Z',
      updated_at: '2026-11-20T00:00:00.000Z',
    },
  ],
};

const restoredMerge = simulateRestore(backup, 'merge', existingLocalDb);
// Expect 3 sheets:
// 1) "Monthly Budget & Calculation" (local preserved, backup duplicate skipped)
// 2) "Local Only Notes" (local preserved)
// 3) "Trip to Ooty" (new from backup added)
assert.strictEqual(restoredMerge.smart_notepads.length, 3, 'Merge mode should have 3 sheets total');
const titles = restoredMerge.smart_notepads.map((s) => s.title);
assert.ok(titles.includes('Monthly Budget & Calculation'));
assert.ok(titles.includes('Local Only Notes'));
assert.ok(titles.includes('Trip to Ooty'));
// Verify local sheet was not overwritten
const preservedSheet = restoredMerge.smart_notepads.find((s) => s.id === 99);
assert.strictEqual(preservedSheet.net_total, 1000, 'Existing local sheet should remain intact');
console.log('   ✓ Merge mode correctly preserved local sheets and imported non-duplicate backup sheets');

console.log('\n=== All Smart Notepad Backup & Restore Tests Passed Successfully! ===');
