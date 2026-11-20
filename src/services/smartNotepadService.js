import { executeSql } from '../database/db';

/**
 * Service for managing Smart Notepad persistence in SQLite / Web Storage.
 */

/**
 * Saves a new smart notepad sheet or updates an existing one.
 * @param {Object} params
 * @param {number|null} [params.id] - Existing ID to update, or null to create new
 * @param {string} params.title - Name/title of the calculation sheet
 * @param {Array} params.items - Full array of calculation row objects
 * @param {string|null} [params.raw_text]
 * @param {number} [params.totalIncome]
 * @param {number} [params.totalExpense]
 * @param {number} [params.netTotal]
 * @param {number} [params.isPinned]
 * @returns {Promise<number>} - Saved sheet ID
 */
export async function saveSmartNotepad({
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
    throw new Error('Title is required to save smart notepad');
  }

  const payload = raw_text !== null ? { raw_text, items } : items;
  const dataJson = JSON.stringify(payload);

  if (id) {
    await executeSql(
      `UPDATE smart_notepads SET title = ?, data = ?, total_income = ?, total_expense = ?, net_total = ?, updated_at = datetime('now') WHERE id = ?`,
      [trimmedTitle, dataJson, totalIncome, totalExpense, netTotal, id]
    );
    return id;
  } else {
    const res = await executeSql(
      `INSERT INTO smart_notepads (title, data, total_income, total_expense, net_total, is_pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [trimmedTitle, dataJson, totalIncome, totalExpense, netTotal, isPinned ? 1 : 0]
    );
    return res.insertId;
  }
}

/**
 * Retrieves all saved smart notepads sorted with pinned sheets first, then by last updated.
 * @returns {Promise<Array>}
 */
export async function getSmartNotepads() {
  const res = await executeSql(
    `SELECT * FROM smart_notepads ORDER BY is_pinned DESC, updated_at DESC`,
    []
  );
  const rows = [];
  for (let i = 0; i < res.rows.length; i++) {
    const r = res.rows.item(i);
    let parsedData = [];
    try {
      parsedData = JSON.parse(r.data || '[]');
    } catch (e) {
      console.warn('Failed to parse smart notepad items JSON for sheet', r.id, e);
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
 * Retrieves a single smart notepad by ID.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getSmartNotepadById(id) {
  const res = await executeSql(
    `SELECT * FROM smart_notepads WHERE id = ?`,
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
    console.warn('Failed to parse smart notepad items JSON for sheet', r.id, e);
  }
  return {
    ...r,
    items: parsedItems,
  };
}

/**
 * Toggles or sets the pinned state of a smart notepad.
 * @param {number} id
 * @param {boolean|null} [forcedState] - Optional explicit pin state
 * @returns {Promise<number>} - New is_pinned value (0 or 1)
 */
export async function togglePinSmartNotepad(id, forcedState = null) {
  const current = await getSmartNotepadById(id);
  if (!current) throw new Error('Notepad not found');

  const newState = forcedState !== null
    ? (forcedState ? 1 : 0)
    : (Number(current.is_pinned) === 1 ? 0 : 1);

  await executeSql(
    `UPDATE smart_notepads SET is_pinned = ?, updated_at = datetime('now') WHERE id = ?`,
    [newState, id]
  );
  return newState;
}

/**
 * Deletes a smart notepad by ID.
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function deleteSmartNotepad(id) {
  await executeSql(
    `DELETE FROM smart_notepads WHERE id = ?`,
    [id]
  );
  return true;
}

/**
 * Renames a smart notepad sheet.
 * @param {number} id
 * @param {string} newTitle
 * @returns {Promise<boolean>}
 */
export async function renameSmartNotepad(id, newTitle) {
  const trimmed = (newTitle || '').trim();
  if (!trimmed) throw new Error('Title cannot be empty');

  await executeSql(
    `UPDATE smart_notepads SET title = ?, updated_at = datetime('now') WHERE id = ?`,
    [trimmed, id]
  );
  return true;
}

// Backward compatibility aliases
export const savePaperLedger = saveSmartNotepad;
export const getPaperLedgers = getSmartNotepads;
export const getPaperLedgerById = getSmartNotepadById;
export const togglePinPaperLedger = togglePinSmartNotepad;
export const deletePaperLedger = deleteSmartNotepad;
export const renamePaperLedger = renameSmartNotepad;

export default {
  saveSmartNotepad,
  getSmartNotepads,
  getSmartNotepadById,
  togglePinSmartNotepad,
  deleteSmartNotepad,
  renameSmartNotepad,
  savePaperLedger,
  getPaperLedgers,
  getPaperLedgerById,
  togglePinPaperLedger,
  deletePaperLedger,
  renamePaperLedger,
};
