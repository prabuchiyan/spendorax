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
    if (l.startsWith('insert')) {
      // const m = s.match(/insert(?:\s+or\s+ignore)?\s+into\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
      const m = s.match(/^insert(?:\s+or\s+(?:ignore|replace|abort|fail|rollback))?\s+into\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
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

    // UPDATE table SET col = ?, ... WHERE id = ?
    if (l.startsWith('update')) {
      const normalized = s.replace(/\s+/g, ' ').trim();

      const m = normalized.match(
        /^update\s+([a-zA-Z0-9_]+)\s+set\s+([\s\S]+?)\s+where\s+([\s\S]+)$/i
      );

      if (!m) { throw new Error('Unsupported UPDATE SQL: ' + normalized); }
      const table = m[1];
      const setClause = m[2];
      const where = m[3];
      const rows = readTable(table);
      // Split only on commas that are NOT inside parentheses
      const assignments = setClause.match(/(?:[^,(]|\([^)]*\))+/g).map(x => x.trim());

      let pIndex = 0;
      const updates = {};
      for (const assignment of assignments) {
        const parts = assignment.split('=');
        const col = parts[0].trim();
        const valueExpr = parts.slice(1).join('=').trim().toLowerCase();
        if (valueExpr === '?') {
          updates[col] = params[pIndex++];
        } else if (valueExpr === 'null') {
          updates[col] = null;
        } else if (valueExpr === 'true') {
          updates[col] = true;
        } else if (valueExpr === 'false') {
          updates[col] = false;
        } else if (valueExpr.startsWith('datetime(')) {
          updates[col] = new Date().toISOString();
        } else if (!isNaN(Number(valueExpr))) {
          updates[col] = Number(valueExpr);
        } else {
          updates[col] = valueExpr.replace(/^['"]|['"]$/g, '');
        }
      }
      // support where id = ?
      const whereMatch = where.match(/id\s*=\s*\?/i);
      if (!whereMatch) {
        throw new Error('Unsupported UPDATE WHERE: ' + where);
      }
      const id = params[pIndex];
      let changed = 0;
      for (const row of rows) {
        if (String(row.id) === String(id)) {
          Object.assign(row, updates);
          changed++;
        }
      }
      writeTable(table, rows);
      return {
        rowsAffected: changed,
        rows: makeRows([]),
      };
    }

    // DELETE FROM table WHERE column = ?
    // DELETE FROM table WHERE ...
    if (l.startsWith('delete')) {
      const m = s.match(/delete from\s+([a-zA-Z0-9_]+)(\s+where\s+(.+))?/i);
      if (!m) throw new Error('Unsupported DELETE SQL: ' + sql);

      const table = m[1];
      const where = m[3];
      let rows = readTable(table);

      // DELETE FROM table
      if (!where) {
        writeTable(table, []);
        return {
          rowsAffected: rows.length,
          rows: makeRows([]),
        };
      }

      // Support multiple WHERE conditions joined by AND
      const conditions = where
        .split(/\s+and\s+/i)
        .map(c => c.trim());

      let paramIndex = 0;

      const filtered = rows.filter(row => {
        for (const cond of conditions) {
          const match = cond.match(/([a-zA-Z0-9_]+)\s*=\s*\?/i);

          if (!match) {
            throw new Error('Unsupported DELETE WHERE: ' + cond);
          }

          const column = match[1];
          const value = params[paramIndex++];

          if (String(row[column]) !== String(value)) {
            paramIndex = 0;
            return true;
          }
        }

        paramIndex = 0;
        return false;
      });

      writeTable(table, filtered);

      return {
        rowsAffected: rows.length - filtered.length,
        rows: makeRows([]),
      };
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
