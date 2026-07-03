import { executeSql } from '../database/db';

export async function createSource({ name, type = null, initial_balance = 0, icon = null, color = null }) {
  const res = await executeSql(
    `INSERT INTO sources (name, type, initial_balance, icon, color) VALUES (?,?,?,?,?)`,
    [name, type, initial_balance, icon, color]
  );
  return res.insertId;
}

export async function getSources(activeOnly = true) {
  const res = await executeSql(`SELECT * FROM sources ORDER BY name`, []);
  const rows = [];
  for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
  if (activeOnly) {
    return rows.filter(r => r.is_active === undefined || Number(r.is_active) === 1);
  }
  return rows;
}

export async function updateSource(id, { name, type, initial_balance = 0, icon = null, is_active = 1, color = null }) {
  await executeSql(
    `UPDATE sources SET name = ?, type = ?, initial_balance = ?, icon = ?, is_active = ?, color = ? WHERE id = ?`,
    [name, type, initial_balance, icon, is_active ? 1 : 0, color, id]
  );
}

export async function deleteSource(id) {
  await executeSql(`DELETE FROM sources WHERE id = ?`, [id]);
}

export default { createSource, getSources, updateSource, deleteSource };
