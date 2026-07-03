import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
let db = null;

function makeRows(arr) {
  return {
    length: arr.length,
    item(i) { return arr[i]; }
  };
}

// Minimal localStorage-backed shim for web to emulate executeSql result shape
function createWebExecuteSql() {
  const prefix = 'mm_db_';

  function ensureTable(name) {
    const key = prefix + name;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify([]));
      localStorage.setItem(prefix + name + '_meta', JSON.stringify({ nextId: 1 }));
    }
  }

  function readTable(name) {
    ensureTable(name);
    return JSON.parse(localStorage.getItem(prefix + name) || '[]');
  }

  function writeTable(name, rows) {
    localStorage.setItem(prefix + name, JSON.stringify(rows));
  }

  return async function executeSql(sql, params = []) {
    const s = sql.trim();
    const l = s.toLowerCase();

    // CREATE TABLE -> ensure table exists (extract table name)
    if (l.startsWith('create table')) {
      const m = s.match(/create table if not exists\s+([a-zA-Z0-9_]+)/i);
      if (m) ensureTable(m[1]);
      return { rows: makeRows([]) };
    }

    // INSERT
    if (l.startsWith('insert into')) {
      const m = s.match(/insert into\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
      if (!m) throw new Error('Unsupported INSERT SQL: ' + sql);
      const table = m[1];
      const cols = m[2].split(',').map(c => c.trim());
      const rows = readTable(table);
      const metaKey = prefix + table + '_meta';
      const meta = JSON.parse(localStorage.getItem(metaKey) || '{"nextId":1}');
      const obj = {};
      for (let i = 0; i < cols.length; i++) obj[cols[i]] = params[i] !== undefined ? params[i] : null;
      if (obj.id !== undefined && obj.id !== null) {
        obj.id = Number(obj.id);
        meta.nextId = Math.max(meta.nextId, obj.id + 1);
      } else {
        obj.id = meta.nextId++;
      }
      rows.push(obj);
      writeTable(table, rows);
      localStorage.setItem(metaKey, JSON.stringify(meta));
      return { insertId: obj.id, rows: makeRows([]) };
    }

    // SELECT [cols] FROM table [WHERE ...] [ORDER BY ...] [LIMIT ?]
    if (l.startsWith('select')) {
      const m = s.match(/select\s+(.+?)\s+from\s+([a-zA-Z0-9_]+)/i);
      if (!m) throw new Error('Unsupported SELECT SQL: ' + sql);
      const colsStr = m[1].trim();
      const table = m[2];
      let rows = readTable(table);

      // WHERE id = ? or other simple equality conditions chained with AND
      const whereMatch = s.match(/where\s+(.+?)(order by|limit|$)/i);
      if (whereMatch) {
        const cond = whereMatch[1].trim();
        const parts = cond.split(/\s+and\s+/i);

        for (const p of parts) {
          const eqMatch = p.match(/([a-zA-Z0-9_]+)\s*=\s*\?/);
          if (eqMatch) {
            const col = eqMatch[1];
            const val = params.shift();
            rows = rows.filter(r => String(r[col]) === String(val));
          } else {
            const litMatch = p.match(/([a-zA-Z0-9_]+)\s*=\s*['"]?([^'"\s]+)['"]?/);
            if (litMatch) {
              const col = litMatch[1];
              const val = litMatch[2];
              rows = rows.filter(r => String(r[col]) === String(val));
            }
          }
        }
      }

      // Projection (selecting specific columns)
      if (colsStr !== '*') {
        const cols = colsStr.split(',').map(c => c.trim().split(/\s+/).pop()); // handle table.col or col as alias
        rows = rows.map(r => {
          const projected = {};
          cols.forEach(c => projected[c] = r[c]);
          return projected;
        });
      }

      // ORDER BY date DESC or name
      const orderMatch = s.match(/order by\s+([a-zA-Z0-9_\.\s,]+)(limit|$)/i);
      if (orderMatch) {
        const ord = orderMatch[1].trim();
        // simple support: 'date desc' or 'name'
        const parts = ord.split(',').map(p => p.trim());
        rows.sort((a, b) => {
          for (const p of parts) {
            const seg = p.split(/\s+/);
            const col = seg[0];
            const dir = (seg[1] || '').toLowerCase();
            const A = a[col]; const B = b[col];
            if (A == null && B != null) return 1;
            if (A != null && B == null) return -1;
            if (A == null && B == null) continue;
            if (A < B) return dir === 'desc' ? 1 : -1;
            if (A > B) return dir === 'desc' ? -1 : 1;
          }
          return 0;
        });
      }

      // LIMIT
      const limitMatch = s.match(/limit\s+\?/i);
      if (limitMatch) {
        const lim = params[0];
        rows = rows.slice(0, lim);
      }

      return { rows: makeRows(rows) };
    }

    // UPDATE table SET col = ?,... WHERE id = ?
    if (l.startsWith('update')) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      let m = s.match(/update\s+([a-zA-Z0-9_]+)\s+set\s+(.+)\s+where\s+(.+)/i);
      if (normalized.toUpperCase().startsWith("UPDATE BILLS SET")) {
        m = normalized.match(/update\s+([a-zA-Z0-9_]+)\s+set\s+(.+?)\s+where\s+(.+)/i);
      }
      if (!m) throw new Error('Unsupported UPDATE SQL: ' + normalized);
      const table = m[1];
      const setClause = m[2];
      const where = m[3];
      const rows = readTable(table);
      const assignments = setClause.split(',').map(p => p.trim());
      // assume params are in order
      let pIndex = 0;
      const updates = {};
      for (const a of assignments) {
        const col = a.split('=')[0].trim();
        updates[col] = params[pIndex++];
      }
      // support where id = ?
      const whereMatch = where.match(/id\s*=\s*\?/i);
      if (whereMatch) {
        const id = params[pIndex++];
        let changed = 0;
        for (let r of rows) {
          if (String(r.id) === String(id)) {
            Object.assign(r, updates);
            changed++;
          }
        }
        writeTable(table, rows);
        return { rowsAffected: changed, rows: makeRows([]) };
      }
      writeTable(table, rows);
      return { rows: makeRows([]) };
    }

    // DELETE FROM table WHERE id = ?
    if (l.startsWith('delete')) {
      const m = s.match(/delete from\s+([a-zA-Z0-9_]+)(\s+where\s+(.+))?/i);
      if (!m) throw new Error('Unsupported DELETE SQL: ' + sql);

      const table = m[1];
      const where = m[3]; // optional
      let rows = readTable(table);

      // ✅ Case 1: DELETE FROM table (clear all)
      if (!where) {
        writeTable(table, []);
        return { rowsAffected: rows.length, rows: makeRows([]) };
      }

      // ✅ Case 2: DELETE WHERE id = ?
      const idMatch = where.match(/id\s*=\s*\?/i);
      if (idMatch) {
        const id = params[0];
        const filtered = rows.filter(r => String(r.id) !== String(id));
        writeTable(table, filtered);
        return {
          rowsAffected: rows.length - filtered.length,
          rows: makeRows([])
        };
      }

      // fallback
      writeTable(table, rows);
      return { rows: makeRows([]) };
    }

    // fallback: no-op
    return { rows: makeRows([]) };
  };
}

function isSelectQuery(sql) {
  return /^\s*(SELECT|PRAGMA|WITH)\b/i.test(sql);
}

function getNativeDb() {
  if (!db) {
    db = SQLite.openDatabaseSync('spendorax.db');
  }
  return db;
}

export function executeSql(sql, params = []) {
  if (Platform.OS === 'web') {
    if (!db) db = createWebExecuteSql();
    return db(sql, Array.from(params));
  }

  try {
    const nativeDb = getNativeDb();

    // SELECT-like queries
    if (isSelectQuery(sql)) {
      const rows = nativeDb.getAllSync(sql, params);

      return Promise.resolve({
        rows: {
          _array: rows,
          length: rows.length,
          item: (index) => rows[index],
        },
        rowsAffected: 0,
        insertId: undefined,
      });
    }

    // INSERT / UPDATE / DELETE / CREATE / DROP
    const result = nativeDb.runSync(sql, params);

    return Promise.resolve({
      rows: {
        _array: [],
        length: 0,
        item: () => undefined,
      },
      rowsAffected: result.changes ?? 0,
      insertId: result.lastInsertRowId ?? undefined,
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

export default null;
