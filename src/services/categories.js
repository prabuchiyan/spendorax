import { executeSql } from '../database/db';

export async function createCategory({ name, type = 'expense', icon = null, color = null }) {
  const res = await executeSql(
    `INSERT INTO categories (name, type, icon, color) VALUES (?,?,?,?)`,
    [name, type, icon, color]
  );
  return res.insertId;
}

export async function getCategories(activeOnly = true) {
  const res = await executeSql(`SELECT * FROM categories ORDER BY name`, []);
  const rows = [];
  for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
  if (activeOnly) {
    return rows.filter(r => r.is_active === undefined || Number(r.is_active) === 1);
  }
  return rows;
}

export async function updateCategory(id, { name, type, icon, color = null, is_active = 1 }) {
  await executeSql(
    `UPDATE categories SET name = ?, type = ?, icon = ?, color = ?, is_active = ? WHERE id = ?`,
    [name, type, icon, color, is_active ? 1 : 0, id]
  );
}

export async function softDeleteCategory(id) {
  await executeSql(`UPDATE categories SET is_active = ? WHERE id = ?`, [0, id]);
}

export default { createCategory, getCategories, updateCategory, softDeleteCategory };
