const assert = require('assert');

// Simulate the complete database persistence and interaction flow for Paper Ledger
function createPaperLedgerDbMock() {
  const store = new Map();
  let nextId = 1;

  return {
    async insertSheet({ title, items, totalIncome, totalExpense, netTotal, isPinned = 0 }) {
      const now = new Date().toISOString();
      const id = nextId++;
      const record = {
        id,
        title,
        data: JSON.stringify(items),
        total_income: totalIncome,
        total_expense: totalExpense,
        net_total: netTotal,
        is_pinned: isPinned ? 1 : 0,
        created_at: now,
        updated_at: now,
      };
      store.set(id, record);
      return id;
    },

    async updateSheet(id, { title, items, totalIncome, totalExpense, netTotal }) {
      if (!store.has(id)) throw new Error('Sheet not found');
      const existing = store.get(id);
      const record = {
        ...existing,
        title: title !== undefined ? title : existing.title,
        data: items !== undefined ? JSON.stringify(items) : existing.data,
        total_income: totalIncome !== undefined ? totalIncome : existing.total_income,
        total_expense: totalExpense !== undefined ? totalExpense : existing.total_expense,
        net_total: netTotal !== undefined ? netTotal : existing.net_total,
        updated_at: new Date().toISOString(),
      };
      store.set(id, record);
      return id;
    },

    async getSheets() {
      return Array.from(store.values())
        .sort((a, b) => {
          if (b.is_pinned !== a.is_pinned) return b.is_pinned - a.is_pinned;
          return new Date(b.updated_at) - new Date(a.updated_at);
        })
        .map(r => ({
          ...r,
          items: JSON.parse(r.data || '[]'),
        }));
    },

    async getSheetById(id) {
      if (!store.has(id)) return null;
      const r = store.get(id);
      return {
        ...r,
        items: JSON.parse(r.data || '[]'),
      };
    },

    async togglePin(id) {
      if (!store.has(id)) throw new Error('Sheet not found');
      const r = store.get(id);
      r.is_pinned = r.is_pinned === 1 ? 0 : 1;
      r.updated_at = new Date().toISOString();
      return r.is_pinned;
    },

    async deleteSheet(id) {
      return store.delete(id);
    },
  };
}

(async () => {
  console.log('=== Running Paper Ledger DB Persistence & Pinning End-to-End Tests ===\n');
  const db = createPaperLedgerDbMock();

  // Test 1: Save a new sheet with JSON object and calculations
  console.log('1. Testing Save New Paper Ledger Sheet...');
  const sheet1Items = [
    { id: 'tx_1', title: 'Office Stationery', amount: 500, formula: '250 * 2', type: 'expense' },
    { id: 'tx_2', title: 'Client Retainer', amount: 15000, formula: null, type: 'income' },
  ];
  const sheet1Id = await db.insertSheet({
    title: 'Q4 Office Expenses',
    items: sheet1Items,
    totalIncome: 15000,
    totalExpense: 500,
    netTotal: 14500,
  });
  assert.strictEqual(sheet1Id, 1);
  const loaded1 = await db.getSheetById(sheet1Id);
  assert.strictEqual(loaded1.title, 'Q4 Office Expenses');
  assert.strictEqual(loaded1.items.length, 2);
  assert.strictEqual(loaded1.items[0].formula, '250 * 2');
  assert.strictEqual(loaded1.is_pinned, 0);
  console.log('   ✓ Sheet saved with full item array in single JSON column');

  // Test 2: Save a second sheet
  console.log('\n2. Testing Multiple Sheets...');
  const sheet2Id = await db.insertSheet({
    title: 'Personal Trip to Manali',
    items: [{ id: 'tx_3', title: 'Cab to Airport', amount: 1200, formula: null, type: 'expense' }],
    totalIncome: 0,
    totalExpense: 1200,
    netTotal: -1200,
  });
  assert.strictEqual(sheet2Id, 2);
  let allSheets = await db.getSheets();
  assert.strictEqual(allSheets.length, 2);
  console.log('   ✓ Multiple sheets saved independently');

  // Test 3: Pinning
  console.log('\n3. Testing Pin / Bookmark functionality...');
  // Sheet 1 is older than Sheet 2. Without pinning, Sheet 2 is first.
  assert.strictEqual(allSheets[0].id, sheet2Id);

  // Pin Sheet 1
  const pinRes = await db.togglePin(sheet1Id);
  assert.strictEqual(pinRes, 1);

  // Now Sheet 1 must be FIRST in list
  allSheets = await db.getSheets();
  assert.strictEqual(allSheets[0].id, sheet1Id, 'Pinned sheet must appear first in list');
  assert.strictEqual(allSheets[0].is_pinned, 1);
  console.log('   ✓ Pinned sheet jumps to top of list');

  // Test 4: Unpin
  console.log('\n4. Testing Unpin...');
  const unpinRes = await db.togglePin(sheet1Id);
  assert.strictEqual(unpinRes, 0);
  allSheets = await db.getSheets();
  assert.strictEqual(allSheets[0].is_pinned, 0);
  console.log('   ✓ Unpinned cleanly');

  // Test 5: Edit saved sheet with updated_at timestamp
  console.log('\n5. Testing Update Saved Sheet...');
  const prevUpdatedAt = (await db.getSheetById(sheet1Id)).updated_at;
  // Sleep 10ms to ensure timestamp difference
  await new Promise(r => setTimeout(r, 15));

  const updatedItems = [
    ...sheet1Items,
    { id: 'tx_4', title: 'Internet Dongle', amount: 999, formula: null, type: 'expense' },
  ];
  await db.updateSheet(sheet1Id, {
    title: 'Q4 Office Expenses - Final',
    items: updatedItems,
    totalIncome: 15000,
    totalExpense: 1499,
    netTotal: 13501,
  });

  const updatedSheet = await db.getSheetById(sheet1Id);
  assert.strictEqual(updatedSheet.title, 'Q4 Office Expenses - Final');
  assert.strictEqual(updatedSheet.items.length, 3);
  assert.strictEqual(updatedSheet.net_total, 13501);
  assert.ok(new Date(updatedSheet.updated_at) > new Date(prevUpdatedAt), 'updated_at timestamp should advance');
  console.log('   ✓ Updated sheet reflects new title, items, totals, and bumped updated_at');

  // Test 6: Delete Sheet
  console.log('\n6. Testing Delete Sheet...');
  const delRes = await db.deleteSheet(sheet2Id);
  assert.strictEqual(delRes, true);
  allSheets = await db.getSheets();
  assert.strictEqual(allSheets.length, 1);
  assert.strictEqual(allSheets[0].id, sheet1Id);
  console.log('   ✓ Deleted sheet removed from list');

  console.log('\n=== All Paper Ledger DB End-to-End Tests Passed Successfully! ===');
})();
