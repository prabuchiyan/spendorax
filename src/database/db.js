import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
let db = null;

function makeRows(arr) {
  return {
    length: arr.length,
    item(i) { return arr[i]; }
  };
}

function executeCustomSelect(sql, lowerSql, params, readTable) {
  // Credit Card by ID
  if (
    lowerSql.includes('from credit_cards') &&
    lowerSql.includes('left join sources') &&
    lowerSql.includes('where cc.id = ?')
  ) {
    const id = params[0];

    const cards = readTable('credit_cards');
    const sources = readTable('sources');

    const card = cards.find(c => String(c.id) === String(id));
    if (!card) {
      return makeRows([]);
    }

    const source = sources.find(s => String(s.id) === String(card.source_id));

    return makeRows([{
      ...card,
      source_name: source?.name,
      source_type: source?.type,
      source_active: source?.is_active,
    }]);
  }

  // Bills JOIN
  if (
    lowerSql.includes('from bill_linked_transactions') &&
    lowerSql.includes('join bills')
  ) {
    const transactionId = params[0];

    const links = readTable('bill_linked_transactions')
      .filter(link => String(link.transaction_id) === String(transactionId));

    const bills = readTable('bills');

    const result = links
      .map(link => bills.find(bill => String(bill.id) === String(link.bill_id)))
      .filter(Boolean)
      .filter(bill => !bill.deleted_at);

    return makeRows(result);
  }

  return null;
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

  // ── UPDATE parser ──────────────────────────────────────────────────────────
  //
  // Splits  "UPDATE table SET a=?, b=COALESCE(x,0)+?, c=datetime('now') WHERE col1=? AND col2=?"
  // into:
  //   table      → "table"
  //   assignments → [{col, valueExpr}]   (raw text after the `=`)
  //   conditions  → [{col, isParam}]
  //
  // Rules for valueExpr consumption of params (in order):
  //   "?"                      → consume 1 param
  //   contains "?" somewhere   → consume 1 param  (handles COALESCE(x,0)+? etc.)
  //   datetime(...)            → use new Date().toISOString(), no param
  //   literal null/true/false  → use JS value, no param
  //   bare number literal      → use Number(), no param
  //   anything else            → strip quotes, no param
  //
  function parseUpdate(normalized, params) {
    // Split on WHERE (case-insensitive, surrounded by spaces)
    const whereIndex = normalized.search(/\s+where\s+/i);
    if (whereIndex === -1) throw new Error('UPDATE missing WHERE: ' + normalized);

    const beforeWhere = normalized.slice(0, whereIndex);
    const afterWhere = normalized.slice(whereIndex).replace(/^\s+where\s+/i, '').trim();

    // Extract table and SET clause
    const prefixMatch = beforeWhere.match(/^update\s+([a-zA-Z0-9_]+)\s+set\s+([\s\S]+)$/i);
    if (!prefixMatch) throw new Error('Unsupported UPDATE SQL: ' + normalized);

    const table = prefixMatch[1];
    const setClause = prefixMatch[2].trim();

    // Split SET clause on commas that are NOT inside parentheses
    const assignmentTokens = setClause.match(/(?:[^,(]|\([^)]*\))+/g).map(t => t.trim());

    let pIndex = 0;
    const updates = {};

    for (const token of assignmentTokens) {
      // Split on first '=' only
      const eqIdx = token.indexOf('=');
      if (eqIdx === -1) continue;

      const col = token.slice(0, eqIdx).trim();
      const valueExpr = token.slice(eqIdx + 1).trim();
      const valLower = valueExpr.toLowerCase();

      if (valueExpr === '?') {
        // Plain placeholder
        updates[col] = params[pIndex++];
      } else if (valueExpr.includes('?')) {
        // Complex expression containing a placeholder (e.g. COALESCE(x,0)+?)
        // Evaluate against current row value at apply time — store a thunk
        updates[col] = { __expr: valueExpr, __paramIndex: pIndex++ };
      } else if (valLower.startsWith('datetime(')) {
        updates[col] = new Date().toISOString();
      } else if (valLower === 'null') {
        updates[col] = null;
      } else if (valLower === 'true') {
        updates[col] = true;
      } else if (valLower === 'false') {
        updates[col] = false;
      } else if (!isNaN(Number(valueExpr)) && valueExpr !== '') {
        updates[col] = Number(valueExpr);
      } else {
        updates[col] = valueExpr.replace(/^['"]|['"]$/g, '');
      }
    }

    // Parse WHERE conditions:  col = ?  or  col = 'literal'
    const condTokens = afterWhere.split(/\s+and\s+/i).map(t => t.trim());
    const conditions = condTokens.map(cond => {
      const paramCond = cond.match(/^([a-zA-Z0-9_]+)\s*=\s*\?$/i);
      if (paramCond) return { col: paramCond[1], isParam: true };

      const litCond = cond.match(/^([a-zA-Z0-9_]+)\s*=\s*['"]?([^'"]+)['"]?$/i);
      if (litCond) return { col: litCond[1], isParam: false, value: litCond[2] };

      // IS NULL / IS NOT NULL
      const nullCond = cond.match(/^([a-zA-Z0-9_]+)\s+is\s+(not\s+)?null$/i);
      if (nullCond) return { col: nullCond[1], isParam: false, isNull: true, isNotNull: !!nullCond[2] };

      throw new Error('Unsupported UPDATE WHERE condition: ' + cond);
    });

    // Collect WHERE param values
    const whereValues = conditions
      .filter(c => c.isParam)
      .map(() => params[pIndex++]);

    return { table, updates, conditions, whereValues };
  }

  // Apply a parsed update to a single row; returns true if row matches WHERE
  function applyUpdate(row, updates, conditions, whereValues, params) {
    // Check WHERE
    let wIdx = 0;
    for (const cond of conditions) {
      if (cond.isNull) {
        if (cond.isNotNull ? row[cond.col] == null : row[cond.col] != null) return false;
      } else if (cond.isParam) {
        if (String(row[cond.col]) !== String(whereValues[wIdx++])) return false;
      } else {
        if (String(row[cond.col]) !== String(cond.value)) return false;
      }
    }

    // Apply SET
    for (const [col, val] of Object.entries(updates)) {
      if (val && typeof val === 'object' && val.__expr !== undefined) {
        // Resolve expression: only COALESCE(col,0)+? and similar patterns
        const paramVal = params[val.__paramIndex];
        const current = Number(row[col] || 0);
        // Try to evaluate simple arithmetic: expr is like "COALESCE(col,0) + ?"
        const arithMatch = val.__expr.match(/coalesce\s*\(\s*[^,]+,\s*(\d+)\s*\)\s*([+\-*\/])\s*\?/i);
        if (arithMatch) {
          const fallback = Number(arithMatch[1]);
          const op = arithMatch[2];
          const base = row[col] != null ? Number(row[col]) : fallback;
          const operand = Number(paramVal);
          switch (op) {
            case '+': row[col] = base + operand; break;
            case '-': row[col] = base - operand; break;
            case '*': row[col] = base * operand; break;
            case '/': row[col] = base / operand; break;
            default: row[col] = paramVal;
          }
        } else {
          // Fallback: just set the param value
          row[col] = paramVal;
        }
      } else {
        row[col] = val;
      }
    }

    return true;
  }

  return async function executeSql(sql, params = []) {
    const s = sql.trim();
    const l = s.toLowerCase();

    // ── CREATE TABLE ─────────────────────────────────────────────────────────
    if (l.startsWith('create table')) {
      const m = s.match(/create table if not exists\s+([a-zA-Z0-9_]+)/i);
      if (m) ensureTable(m[1]);
      return { rows: makeRows([]) };
    }

    // ── INSERT ────────────────────────────────────────────────────────────────
    if (l.startsWith('insert')) {
      const m = s.match(/^insert(?:\s+or\s+(?:ignore|replace|abort|fail|rollback))?\s+into\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
      if (!m) throw new Error('Unsupported INSERT SQL: ' + sql);

      const table = m[1];
      const cols = m[2].split(',').map(c => c.trim());
      const rows = readTable(table);
      const metaKey = prefix + table + '_meta';
      const meta = JSON.parse(localStorage.getItem(metaKey) || '{"nextId":1}');
      const isIgnore = /insert\s+or\s+ignore/i.test(s);
      const obj = {};

      for (let i = 0; i < cols.length; i++) {
        obj[cols[i]] = params[i] !== undefined ? params[i] : null;
      }

      if (obj.id !== undefined && obj.id !== null) {
        obj.id = Number(obj.id);
        meta.nextId = Math.max(meta.nextId, obj.id + 1);
      } else {
        obj.id = meta.nextId++;
      }

      // Handle INSERT OR IGNORE — check UNIQUE constraints we care about
      if (isIgnore) {
        // bill_linked_transactions has UNIQUE(bill_id, transaction_id)
        if (table === 'bill_linked_transactions') {
          const exists = rows.some(
            r => String(r.bill_id) === String(obj.bill_id) &&
              String(r.transaction_id) === String(obj.transaction_id)
          );
          if (exists) return { insertId: null, rows: makeRows([]) };
        }
      }

      rows.push(obj);
      writeTable(table, rows);
      localStorage.setItem(metaKey, JSON.stringify(meta));
      return { insertId: obj.id, rows: makeRows([]) };
    }

    // ── SELECT ────────────────────────────────────────────────────────────────
    // ── SELECT ────────────────────────────────────────────────────────────────
    if (l.startsWith('select')) {
      const customRows = executeCustomSelect(
        s,
        l,
        [...params],
        readTable
      );

      if (customRows) {
        return {
          rows: customRows,
          rowsAffected: 0,
          insertId: undefined,
        };
      }

      // ---------------------------------------------------------
      // Parse SELECT
      //
      // Supported:
      //   SELECT * FROM table
      //   SELECT id, name FROM table
      //   SELECT id, name FROM table WHERE id = ?
      //   SELECT ... WHERE col = ? LIMIT 1
      //   SELECT ... WHERE col >= ? AND col <= ?
      //   SELECT ... WHERE col IN (?, ?, ?)
      // ---------------------------------------------------------

      const selectMatch = s.match(
        /^select\s+(.+?)\s+from\s+([a-zA-Z0-9_]+)([\s\S]*)$/i
      );

      if (!selectMatch) {
        throw new Error(
          'Unsupported SELECT SQL: ' + sql
        );
      }

      const colsStr = selectMatch[1].trim();
      const table = selectMatch[2].trim();
      const remainder = selectMatch[3] || '';

      let rows = readTable(table);

      // ---------------------------------------------------------
      // Parse WHERE
      // ---------------------------------------------------------

      let paramIndex = 0;

      const whereMatch = remainder.match(
        /\bwhere\b([\s\S]*?)(?=\border\s+by\b|\blimit\b|$)/i
      );

      if (whereMatch) {
        const whereClause = whereMatch[1].trim();

        if (whereClause) {
          const parts = whereClause
            .split(/\s+and\s+/i)
            .map(p => p.trim())
            .filter(Boolean);

          for (const part of parts) {

            // ---------------------------------------------------
            // col = ?
            // ---------------------------------------------------

            const eqParamMatch = part.match(
              /^([a-zA-Z0-9_]+)\s*=\s*\?\s*$/i
            );

            if (eqParamMatch) {
              const col = eqParamMatch[1];
              const value = params[paramIndex++];

              rows = rows.filter(
                row =>
                  String(row[col]) === String(value)
              );

              continue;
            }

            // ---------------------------------------------------
            // col >= ?
            // ---------------------------------------------------

            const geMatch = part.match(
              /^([a-zA-Z0-9_]+)\s*>=\s*\?\s*$/i
            );

            if (geMatch) {
              const col = geMatch[1];
              const value = params[paramIndex++];

              rows = rows.filter(
                row =>
                  String(row[col]) >= String(value)
              );

              continue;
            }

            // ---------------------------------------------------
            // col <= ?
            // ---------------------------------------------------

            const leMatch = part.match(
              /^([a-zA-Z0-9_]+)\s*<=\s*\?\s*$/i
            );

            if (leMatch) {
              const col = leMatch[1];
              const value = params[paramIndex++];

              rows = rows.filter(
                row =>
                  String(row[col]) <= String(value)
              );

              continue;
            }

            // ---------------------------------------------------
            // col IN (?, ?, ?)
            // ---------------------------------------------------

            const inMatch = part.match(
              /^([a-zA-Z0-9_]+)\s+in\s*\(([^)]+)\)\s*$/i
            );

            if (inMatch) {
              const col = inMatch[1];

              const slots = inMatch[2]
                .split(',')
                .map(x => x.trim());

              const values = slots.map(
                () => params[paramIndex++]
              );

              rows = rows.filter(
                row =>
                  values.some(
                    value =>
                      String(row[col]) === String(value)
                  )
              );

              continue;
            }

            // ---------------------------------------------------
            // col IS NULL
            // ---------------------------------------------------

            const isNullMatch = part.match(
              /^([a-zA-Z0-9_]+)\s+is\s+null\s*$/i
            );

            if (isNullMatch) {
              const col = isNullMatch[1];

              rows = rows.filter(
                row => row[col] == null
              );

              continue;
            }

            // ---------------------------------------------------
            // col IS NOT NULL
            // ---------------------------------------------------

            const isNotNullMatch = part.match(
              /^([a-zA-Z0-9_]+)\s+is\s+not\s+null\s*$/i
            );

            if (isNotNullMatch) {
              const col = isNotNullMatch[1];

              rows = rows.filter(
                row => row[col] != null
              );

              continue;
            }

            console.warn(
              '[WebSQLite] Unsupported WHERE condition:',
              part,
              'SQL:',
              sql
            );
          }
        }
      }

      // ---------------------------------------------------------
      // ORDER BY
      // ---------------------------------------------------------

      const orderMatch = remainder.match(
        /\border\s+by\s+([a-zA-Z0-9_\.\s,]+?)(?=\blimit\b|$)/i
      );

      if (orderMatch) {
        const orderParts = orderMatch[1]
          .trim()
          .split(',')
          .map(p => p.trim());

        rows.sort((a, b) => {
          for (const orderPart of orderParts) {
            const segments = orderPart.split(/\s+/);

            const rawCol = segments[0];
            const direction =
              (segments[1] || '').toLowerCase();

            const col = rawCol.includes('.')
              ? rawCol.split('.').pop()
              : rawCol;

            const A = a[col];
            const B = b[col];

            if (A == null && B != null) return 1;
            if (A != null && B == null) return -1;
            if (A == null && B == null) continue;

            if (A < B) {
              return direction === 'desc' ? 1 : -1;
            }

            if (A > B) {
              return direction === 'desc' ? -1 : 1;
            }
          }

          return 0;
        });
      }

      // ---------------------------------------------------------
      // LIMIT
      // ---------------------------------------------------------

      const limitParamMatch = remainder.match(
        /\blimit\s+\?\s*$/i
      );

      if (limitParamMatch) {
        const limit = Number(params[paramIndex++]);

        if (!Number.isNaN(limit)) {
          rows = rows.slice(0, limit);
        }
      } else {
        const limitLiteralMatch = remainder.match(
          /\blimit\s+(\d+)\s*$/i
        );

        if (limitLiteralMatch) {
          rows = rows.slice(
            0,
            Number(limitLiteralMatch[1])
          );
        }
      }

      // ---------------------------------------------------------
      // Projection
      // ---------------------------------------------------------

      if (colsStr !== '*') {
        const cols = colsStr
          .split(',')
          .map(c => c.trim());

        rows = rows.map(row => {
          const projected = {};

          for (const col of cols) {

            // table.*
            if (/\.\*$/.test(col)) {
              Object.assign(projected, row);
              continue;
            }

            // alias:
            // column AS alias
            const aliasMatch = col.match(
              /^(.+?)\s+as\s+([a-zA-Z0-9_]+)$/i
            );

            if (aliasMatch) {
              const source = aliasMatch[1].trim();
              const alias = aliasMatch[2];

              const sourceCol = source.includes('.')
                ? source.split('.').pop()
                : source;

              projected[alias] = row[sourceCol];

              continue;
            }

            const sourceCol = col.includes('.')
              ? col.split('.').pop()
              : col;

            projected[sourceCol] = row[sourceCol];
          }

          return projected;
        });
      }

      console.log(
        '[WebSQLite SELECT]',
        {
          sql,
          params,
          table,
          resultCount: rows.length,
          firstRow: rows[0] || null,
        }
      );

      return {
        rows: makeRows(rows),
        rowsAffected: 0,
        insertId: undefined,
      };
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────
    if (l.startsWith('update')) {
      const normalized = s.replace(/\s+/g, ' ').trim();

      let parsed;
      try {
        parsed = parseUpdate(normalized, params);
      } catch (e) {
        throw new Error('UPDATE parse error: ' + e.message + '\nSQL: ' + normalized);
      }

      const { table, updates, conditions, whereValues } = parsed;
      const rows = readTable(table);
      let changed = 0;

      for (const row of rows) {
        const matched = applyUpdate(row, updates, conditions, whereValues, params);
        if (matched) changed++;
      }

      writeTable(table, rows);
      return { rowsAffected: changed, rows: makeRows([]) };
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (l.startsWith('delete')) {
      const m = s.match(/delete from\s+([a-zA-Z0-9_]+)(\s+where\s+(.+))?/i);
      if (!m) throw new Error('Unsupported DELETE SQL: ' + sql);

      const table = m[1];
      const where = m[3];
      let rows = readTable(table);

      if (!where) {
        writeTable(table, []);
        return { rowsAffected: rows.length, rows: makeRows([]) };
      }

      const conditions = where.split(/\s+and\s+/i).map(c => c.trim());
      let paramIndex = 0;

      const filtered = rows.filter(row => {
        const localParamStart = paramIndex;
        for (const cond of conditions) {
          const match = cond.match(/([a-zA-Z0-9_]+)\s*=\s*\?/i);
          if (!match) throw new Error('Unsupported DELETE WHERE: ' + cond);
          const column = match[1];
          const value = params[paramIndex++];
          if (String(row[column]) !== String(value)) {
            paramIndex = localParamStart;
            return true; // keep row (does NOT match all conditions)
          }
        }
        paramIndex = localParamStart;
        return false; // remove row (matches all conditions)
      });

      writeTable(table, filtered);
      return { rowsAffected: rows.length - filtered.length, rows: makeRows([]) };
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
