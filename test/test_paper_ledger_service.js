const assert = require('assert');

// Simulate paper ledger service operations
function createInMemoryPaperLedgerService() {
  let records = [];
  let nextId = 1;

  async function savePaperLedger({ id = null, title, items = [], totalIncome = 0, totalExpense = 0, netTotal = 0, isPinned = 0 }) {
    const trimmedTitle = (title || '').trim();
    if (!trimmedTitle) {
      throw new Error('Title is required to save paper ledger');
    }

    const dataJson = JSON.stringify(items);
    const now = new Date().toISOString();

    if (id) {
      const idx = records.findIndex(r => r.id === id);
      if (idx === -1) throw new Error('Ledger not found');
      records[idx] = {
        ...records[idx],
        title: trimmedTitle,
        data: dataJson,
        total_income: totalIncome,
        total_expense: totalExpense,
        net_total: netTotal,
        updated_at: now,
      };
      return id;
    } else {
      const newRecord = {
        id: nextId++,
        title: trimmedTitle,
        data: dataJson,
        total_income: totalIncome,
        total_expense: totalExpense,
        net_total: netTotal,
        is_pinned: isPinned ? 1 : 0,
        created_at: now,
        updated_at: now,
      };
      records.push(newRecord);
      return newRecord.id;
    }
  }

  async function getPaperLedgers() {
    // Sort by is_pinned DESC, then updated_at DESC
    return [...records].sort((a, b) => {
      if (b.is_pinned !== a.is_pinned) {
        return b.is_pinned - a.is_pinned;
      }
      return new Date(b.updated_at) - new Date(a.updated_at);
    }).map(r => ({
      ...r,
      items: JSON.parse(r.data || '[]'),
    }));
  }

  async function getPaperLedgerById(id) {
    const r = records.find(rec => rec.id === id);
    if (!r) return null;
    return {
      ...r,
      items: JSON.parse(r.data || '[]'),
    };
  }

  async function togglePinPaperLedger(id, forcedPinnedState = null) {
    const r = records.find(rec => rec.id === id);
    if (!r) throw new Error('Ledger not found');
    const newState = forcedPinnedState !== null ? (forcedPinnedState ? 1 : 0) : (r.is_pinned === 1 ? 0 : 1);
    r.is_pinned = newState;
    r.updated_at = new Date().toISOString();
    return r.is_pinned;
  }

  async function deletePaperLedger(id) {
    const initialLen = records.length;
    records = records.filter(r => r.id !== id);
    return records.length < initialLen;
  }

  async function renamePaperLedger(id, newTitle) {
    const trimmed = (newTitle || '').trim();
    if (!trimmed) throw new Error('Title cannot be empty');
    const r = records.find(rec => rec.id === id);
    if (!r) throw new Error('Ledger not found');
    r.title = trimmed;
    r.updated_at = new Date().toISOString();
    return r;
  }

  return {
    savePaperLedger,
    getPaperLedgers,
    getPaperLedgerById,
    togglePinPaperLedger,
    deletePaperLedger,
    renamePaperLedger,
    _getRawRecords: () => records,
  };
}

(async () => {
  console.log('Testing Paper Ledger Service Logic...');
  const service = createInMemoryPaperLedgerService();

  // 1. Create a new paper ledger
  const items1 = [
    { id: 'item_1', title: 'Groceries', type: 'expense', amount: 150, formula: '100 + 50' },
    { id: 'item_2', title: 'Freelance', type: 'income', amount: 1000, formula: null },
  ];
  const id1 = await service.savePaperLedger({
    title: 'November Home Budget',
    items: items1,
    totalIncome: 1000,
    totalExpense: 150,
    netTotal: 850,
  });
  assert.strictEqual(id1, 1, 'First sheet should have ID 1');
  console.log('✓ Created paper ledger sheet 1');

  // 2. Create second sheet
  const id2 = await service.savePaperLedger({
    title: 'Trip to Goa',
    items: [{ id: 'item_3', title: 'Hotel', type: 'expense', amount: 4500 }],
    totalIncome: 0,
    totalExpense: 4500,
    netTotal: -4500,
  });
  assert.strictEqual(id2, 2, 'Second sheet should have ID 2');
  console.log('✓ Created paper ledger sheet 2');

  // 3. Fetch all sheets (unpinned, sorted by updated_at)
  let all = await service.getPaperLedgers();
  assert.strictEqual(all.length, 2);
  assert.strictEqual(all[0].id, 2, 'Most recently updated sheet should be first');

  // 4. Pin sheet 1
  const pinnedState = await service.togglePinPaperLedger(id1);
  assert.strictEqual(pinnedState, 1, 'Sheet 1 should now be pinned (1)');

  // 5. Fetch after pin -> Sheet 1 must be FIRST despite sheet 2 having later initial creation
  all = await service.getPaperLedgers();
  assert.strictEqual(all[0].id, id1, 'Pinned sheet must appear first in list');
  assert.strictEqual(all[0].is_pinned, 1);
  assert.strictEqual(all[1].id, id2);
  console.log('✓ Pinned sheets sort first');

  // 6. Unpin sheet 1
  const unpinnedState = await service.togglePinPaperLedger(id1);
  assert.strictEqual(unpinnedState, 0, 'Sheet 1 should now be unpinned (0)');
  console.log('✓ Unpin toggle verified');

  // 7. Update existing sheet (editing rows & totals)
  const updatedItems1 = [
    ...items1,
    { id: 'item_4', title: 'Dinner', type: 'expense', amount: 200 },
  ];
  const savedId = await service.savePaperLedger({
    id: id1,
    title: 'November Home Budget Updated',
    items: updatedItems1,
    totalIncome: 1000,
    totalExpense: 350,
    netTotal: 650,
  });
  assert.strictEqual(savedId, id1, 'Updating should retain existing ID');

  const fetched = await service.getPaperLedgerById(id1);
  assert.strictEqual(fetched.title, 'November Home Budget Updated');
  assert.strictEqual(fetched.items.length, 3);
  assert.strictEqual(fetched.net_total, 650);
  console.log('✓ Sheet edit and JSON data persistence verified');

  // 8. Rename sheet
  await service.renamePaperLedger(id1, 'Final Nov Budget');
  const renamed = await service.getPaperLedgerById(id1);
  assert.strictEqual(renamed.title, 'Final Nov Budget');
  console.log('✓ Rename sheet verified');

  // 9. Delete sheet
  const deleted = await service.deletePaperLedger(id2);
  assert.strictEqual(deleted, true);
  all = await service.getPaperLedgers();
  assert.strictEqual(all.length, 1);
  assert.strictEqual(all[0].id, id1);
  console.log('✓ Delete sheet verified');

  console.log('\nAll Paper Ledger Service Tests Passed Successfully!');
})();
