import { executeSql } from '../database/db';

/**
 * Service for managing Paper Ledger persistence in SQLite / Web Storage.
 */

/**
 * Saves a new paper ledger sheet or updates an existing one.
 * @param {Object} params
 * @param {number|null} [params.id] - Existing ID to update, or null to create new
 * @param {string} params.title - Name/title of the calculation sheet
 * @param {Array} params.items - Full array of calculation row objects
 * @param {number} [params.totalIncome]
 * @param {number} [params.totalExpense]
 * @param {number} [params.netTotal]
 * @param {number} [params.isPinned]
 * @returns {Promise<number>} - Saved sheet ID
 */
export async function savePaperLedger({
  id = null,
  title,
  items = [],
  raw_text = null,
  totalIncome = 0,
  totalExpense = 0,
  netTotal = 0,
  isPinned = 0,
}) {
  const trimmedTitle = (title || '').trim();
  if (!trimmedTitle) {
    throw new Error('Title is required to save paper ledger');
  }

  const payload = raw_text !== null ? { raw_text, items } : items;
  const dataJson = JSON.stringify(payload);

  if (id) {
    await executeSql(
      `UPDATE paper_ledgers SET title = ?, data = ?, total_income = ?, total_expense = ?, net_total = ?, updated_at = datetime('now') WHERE id = ?`,
      [trimmedTitle, dataJson, totalIncome, totalExpense, netTotal, id]
    );
    return id;
  } else {
    const res = await executeSql(
      `INSERT INTO paper_ledgers (title, data, total_income, total_expense, net_total, is_pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [trimmedTitle, dataJson, totalIncome, totalExpense, netTotal, isPinned ? 1 : 0]
    );
    return res.insertId;
  }
}

/**
 * Retrieves all saved paper ledgers sorted with pinned sheets first, then by last updated.
 * @returns {Promise<Array>}
 */
export async function getPaperLedgers() {
  const res = await executeSql(
    `SELECT * FROM paper_ledgers ORDER BY is_pinned DESC, updated_at DESC`,
    []
  );
  const rows = [];
  for (let i = 0; i < res.rows.length; i++) {
    const r = res.rows.item(i);
    let parsedData = [];
    try {
      parsedData = JSON.parse(r.data || '[]');
    } catch (e) {
      console.warn('Failed to parse paper ledger items JSON for sheet', r.id, e);
    }
    const rawText = Array.isArray(parsedData) ? null : (parsedData?.raw_text || null);
    const items = Array.isArray(parsedData) ? parsedData : (parsedData?.items || []);
    rows.push({
      ...r,
      raw_text: rawText,
      items,
    });
  }
  return rows;
}

/**
 * Retrieves a single paper ledger by ID.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getPaperLedgerById(id) {
  const res = await executeSql(
    `SELECT * FROM paper_ledgers WHERE id = ?`,
    [id]
  );
  if (!res.rows || res.rows.length === 0) {
    return null;
  }
  const r = res.rows.item(0);
  let parsedItems = [];
  try {
    parsedItems = JSON.parse(r.data || '[]');
  } catch (e) {
    console.warn('Failed to parse paper ledger items JSON for sheet', r.id, e);
  }
  return {
    ...r,
    items: parsedItems,
  };
}

/**
 * Toggles or sets the pinned state of a paper ledger.
 * @param {number} id
 * @param {boolean|null} [forcedState] - Optional explicit pin state
 * @returns {Promise<number>} - New is_pinned value (0 or 1)
 */
export async function togglePinPaperLedger(id, forcedState = null) {
  const current = await getPaperLedgerById(id);
  if (!current) throw new Error('Ledger not found');

  const newState = forcedState !== null
    ? (forcedState ? 1 : 0)
    : (Number(current.is_pinned) === 1 ? 0 : 1);

  await executeSql(
    `UPDATE paper_ledgers SET is_pinned = ?, updated_at = datetime('now') WHERE id = ?`,
    [newState, id]
  );
  return newState;
}

/**
 * Deletes a paper ledger by ID.
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function deletePaperLedger(id) {
  await executeSql(
    `DELETE FROM paper_ledgers WHERE id = ?`,
    [id]
  );
  return true;
}

/**
 * Renames a paper ledger sheet.
 * @param {number} id
 * @param {string} newTitle
 * @returns {Promise<boolean>}
 */
export async function renamePaperLedger(id, newTitle) {
  const trimmed = (newTitle || '').trim();
  if (!trimmed) throw new Error('Title cannot be empty');

  await executeSql(
    `UPDATE paper_ledgers SET title = ?, updated_at = datetime('now') WHERE id = ?`,
    [trimmed, id]
  );
  return true;
}

export default {
  savePaperLedger,
  getPaperLedgers,
  getPaperLedgerById,
  togglePinPaperLedger,
  deletePaperLedger,
  renamePaperLedger,
};
