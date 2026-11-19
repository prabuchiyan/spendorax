/**
 * Utility functions for Paper Ledger screen
 * Calculations, WhatsApp formatting, and data mapping
 */
const { evaluateMathExpression } = require('./mathExpressionParser');

/**
 * Calculates total income, total expense, and net balance (Income - Expense)
 * @param {Array<{ type: string, amount: number | string }>} items
 * @returns {{ totalIncome: number, totalExpense: number, netTotal: number }}
 */
function calculateLedgerTotals(items = []) {
  let totalIncome = 0;
  let totalExpense = 0;

  for (const item of items) {
    const rawAmt = Number(item.amount) || 0;
    const absAmt = Math.abs(rawAmt);
    const type = String(item.type || '').toLowerCase();

    if (type === 'income') {
      totalIncome += absAmt;
    } else {
      totalExpense += absAmt;
    }
  }

  // Round to 2 decimal places to avoid float precision issues
  totalIncome = Math.round(totalIncome * 100) / 100;
  totalExpense = Math.round(totalExpense * 100) / 100;
  const netTotal = Math.round((totalIncome - totalExpense) * 100) / 100;

  return {
    totalIncome,
    totalExpense,
    netTotal
  };
}

/**
 * Formats a currency number with Indian commas or standard formatting
 * @param {number} amount
 * @param {string} symbol
 * @returns {string}
 */
function formatLedgerAmount(amount, symbol = '₹') {
  const num = Number(amount) || 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const isInteger = Number.isInteger(absNum);
  const formatted = absNum.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: isInteger ? 0 : 2
  });
  return `${isNegative ? '-' : ''}${symbol}${formatted}`;
}

/**
 * Formats paper ledger entries for sharing via WhatsApp text
 * @param {Array<{ title: string, type: string, amount: number | string }>} items
 * @param {number} netTotal
 * @param {string} [dateStr]
 * @returns {string}
 */
function formatWhatsAppLedgerText(items = [], netTotal = 0, dateStr = '') {
  const formattedDate = dateStr || new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const lines = [
    '📓 *SpendoraX - Paper Ledger*',
    `📅 *Date:* ${formattedDate}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━'
  ];

  if (items.length === 0) {
    lines.push('_No transactions in ledger_');
  } else {
    items.forEach((item, index) => {
      const serial = `${index + 1}) `;
      const isIncome = String(item.type || '').toLowerCase() === 'income';
      const typeLabel = isIncome ? '[+]' : '[-]';
      const rawTitle = (item.title || (isIncome ? 'Income' : 'Expense')).trim();
      const cleanTitle = rawTitle.replace(/\r?\n+/g, ' ');
      const amtStr = `${isIncome ? '+' : '-'}${formatLedgerAmount(item.amount)}`;
      
      const formulaStr = item.formula ? ` [${item.formula}]` : '';
      lines.push(`${serial}${cleanTitle}${formulaStr} ${typeLabel}`);
      lines.push(`     └─► Amount: *${amtStr}*`);
    });
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━');
  const netSign = netTotal > 0 ? '+' : '';
  lines.push(`*Total (Net):*  *${netSign}${formatLedgerAmount(netTotal)}*`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('Shared via SpendoraX Paper Ledger');

  return lines.join('\n');
}

/**
 * Checks whether a database transaction is a transfer
 * @param {Object} tx
 * @returns {boolean}
 */
function isTransferTransaction(tx) {
  if (!tx) return false;
  return Boolean(
    (tx.transfer_group_id && String(tx.transfer_group_id).trim() !== '') ||
    tx.is_transfer === 1 ||
    tx.is_transfer === true ||
    String(tx.is_transfer).trim() === '1' ||
    String(tx.type || '').toLowerCase() === 'transfer'
  );
}

/**
 * Formats a transaction date to DD-MM-YYYY
 * @param {string|Date} dateVal
 * @returns {string}
 */
function formatTxDate(dateVal) {
  if (!dateVal) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  const cleanStr = String(dateVal).split('T')[0].split(' ')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD -> DD-MM-YYYY
      return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
    }
    return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
  }
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  return String(dateVal);
}

/**
 * Formats import transaction title as: DD-MM-YYYY: Category: Notes
 * If no notes, formats as: DD-MM-YYYY: Category
 * @param {Object} tx
 * @param {Object} [categoriesMap]
 * @returns {string}
 */
function formatImportTransactionTitle(tx, categoriesMap = {}) {
  if (!tx) return '';
  const dateStr = formatTxDate(tx.date);
  const isIncome = String(tx.type || '').toLowerCase() === 'income';
  const cat = (
    tx.category_name ||
    (tx.category_id && categoriesMap[tx.category_id]?.name) ||
    (isIncome ? 'Income' : 'Expense')
  ).trim();
  const note = (tx.notes || '').trim();

  if (note && note.toLowerCase() !== cat.toLowerCase()) {
    return `${dateStr}: ${cat}: ${note}`;
  }
  return `${dateStr}: ${cat}`;
}

/**
 * Parses a freeform typed line into a paper ledger transaction item.
 * Supports:
 * - "Dinner 450" -> title: "Dinner", amount: 450, type: "expense", formula: null
 * - "Salary +50000" or "+ Salary 50000" -> title: "Salary", amount: 50000, type: "income", formula: null
 * - "Grocery Mart 100 + 25" -> title: "Grocery Mart", amount: 125, formula: "100 + 25", type: "expense"
 * - "Freelance Design +100*5" -> title: "Freelance Design", amount: 500, formula: "100*5", type: "income"
 * - "100 + 25" -> title: "Calculation", amount: 125, formula: "100 + 25", type: "expense"
 *
 * @param {string} rawText
 * @param {'income'|'expense'} [defaultType='expense']
 * @returns {{ title: string, amount: number, formula: string|null, type: 'income'|'expense', isValid: boolean, error?: string }}
 */
function parseNotepadLine(rawText, defaultType = 'expense') {
  if (!rawText || typeof rawText !== 'string') {
    return { isValid: false, error: 'Empty line' };
  }
  let text = rawText.trim();
  if (!text) {
    return { isValid: false, error: 'Empty line' };
  }

  let forcedType = null;
  // Check leading sign
  if (text.startsWith('+')) {
    forcedType = 'income';
    text = text.substring(1).trim();
  } else if (text.startsWith('-') || text.startsWith('−')) {
    forcedType = 'expense';
    text = text.substring(1).trim();
  }

  // Check trailing sign
  if (text.endsWith('+')) {
    forcedType = 'income';
    text = text.slice(0, -1).trim();
  } else if (text.endsWith('-') || text.endsWith('−')) {
    forcedType = 'expense';
    text = text.slice(0, -1).trim();
  }

  if (!text) {
    return { isValid: false, error: 'Incomplete line' };
  }

  // 1. Check if the entire string is a math expression or number (no words)
  if (!/[a-zA-Z]/.test(text)) {
    const wholeEval = evaluateMathExpression(text);
    if (wholeEval.isValid) {
      return {
        title: 'Calculation',
        amount: Math.abs(wholeEval.result),
        formula: wholeEval.hasOperator ? text : null,
        type: forcedType || (wholeEval.result < 0 ? 'expense' : defaultType),
        isValid: true,
      };
    }
  }

  // 2. Split into title and trailing amount/expression
  let match = text.match(/^(.*?)(?:\s+([+\-−]?\s*[\d(].*))$/);
  if (!match) {
    // Also try matching without whitespace if sign is present, e.g. "Store+100"
    match = text.match(/^(.*?)([+\-−]\s*[\d(].*)$/);
  }

  if (!match) {
    return { isValid: false, error: 'No amount or formula found' };
  }

  let title = match[1].trim();
  let exprPart = match[2].trim();

  // Check if expression part starts with sign
  if (exprPart.startsWith('+')) {
    forcedType = 'income';
    exprPart = exprPart.substring(1).trim();
  } else if (exprPart.startsWith('-') || exprPart.startsWith('−')) {
    forcedType = 'expense';
    exprPart = exprPart.substring(1).trim();
  }

  const evalRes = evaluateMathExpression(exprPart);
  if (!evalRes.isValid || evalRes.result === null) {
    return { isValid: false, error: evalRes.error || 'Invalid amount/expression' };
  }

  return {
    title: title || 'Calculation',
    amount: Math.abs(evalRes.result),
    formula: evalRes.hasOperator ? exprPart : null,
    type: forcedType || defaultType,
    isValid: true,
  };
}

/**
 * Maps raw database transactions to paper ledger items, excluding transfers
 * @param {Array<Object>} transactions
 * @param {Object} [categoriesMap]
 * @returns {Array<{ id: string, title: string, type: 'income' | 'expense', amount: number, originalId?: number, date?: string }>}
 */
function mapDbTransactionsToPaperItems(transactions = [], categoriesMap = {}) {
  return (transactions || [])
    .filter((tx) => !isTransferTransaction(tx))
    .map((tx, idx) => {
      const isIncome = String(tx.type || '').toLowerCase() === 'income';
      const formattedTitle = formatImportTransactionTitle(tx, categoriesMap);
      const amount = Math.abs(Number(tx.amount) || 0);

      return {
        id: `db_${tx.id || idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: formattedTitle,
        type: isIncome ? 'income' : 'expense',
        amount,
        originalId: tx.id,
        date: tx.date || null
      };
    });
}

/**
 * Returns a Set containing IDs of all candidates.
 * @param {Array<{ id: string }>} candidates
 * @returns {Set<string>}
 */
function selectAllCandidates(candidates = []) {
  return new Set((candidates || []).map((c) => String(c.id)));
}

/**
 * Returns an empty Set (none selected).
 * @returns {Set<string>}
 */
function deselectAllCandidates() {
  return new Set();
}

/**
 * Toggles an item ID in a Set, returning a new Set.
 * @param {Set<string>} selectedSet
 * @param {string} id
 * @returns {Set<string>}
 */
function toggleCandidateSelection(selectedSet, id) {
  const next = new Set(selectedSet || []);
  const idStr = String(id);
  if (next.has(idStr)) {
    next.delete(idStr);
  } else {
    next.add(idStr);
  }
  return next;
}

/**
 * Filters candidates to return only those whose id is in selectedSet.
 * @param {Array<{ id: string }>} candidates
 * @param {Set<string>} selectedSet
 * @returns {Array<Object>}
 */
function filterSelectedCandidates(candidates = [], selectedSet = new Set()) {
  const set = selectedSet instanceof Set ? selectedSet : new Set(selectedSet || []);
  return (candidates || []).filter((c) => set.has(String(c.id)));
}

/**
 * Filters candidates by case-insensitive search string matching title or category.
 * @param {Array<{ title?: string, category?: string }>} candidates
 * @param {string} searchQuery
 * @returns {Array<Object>}
 */
function filterCandidatesBySearch(candidates = [], searchQuery = '') {
  const query = (searchQuery || '').trim().toLowerCase();
  if (!query) return candidates;
  return (candidates || []).filter((c) => {
    const titleMatch = (c.title || '').toLowerCase().includes(query);
    const catMatch = (c.category || '').toLowerCase().includes(query);
    return titleMatch || catMatch;
  });
}

/**
 * Formats an existing paper ledger item into a freeform string for inline on-paper editing.
 * e.g. { title: 'Dinner', amount: 450, type: 'expense' } -> 'Dinner 450'
 *      { title: 'Salary', amount: 50000, type: 'income' } -> 'Salary +50000'
 *      { title: 'Groceries', formula: '100+25', type: 'expense' } -> 'Groceries 100+25'
 * @param {Object} item
 * @returns {string}
 */
function formatItemToFreeformLine(item) {
  if (!item || typeof item !== 'object') return '';
  const title = (item.title || '').trim();
  const isIncome = String(item.type || '').toLowerCase() === 'income';

  let val = '';
  if (item.formula) {
    val = String(item.formula).trim();
  } else if (item.amount !== undefined && item.amount !== null && !isNaN(item.amount)) {
    val = String(item.amount).trim();
  }

  if (!val) return title;

  if (isIncome) {
    if (val.startsWith('+')) {
      return title ? `${title} ${val}`.trim() : val;
    }
    return title ? `${title} +${val}`.trim() : `+${val}`;
  }

  // Expense
  if (val.startsWith('+')) {
    val = val.substring(1).trim();
  }
  return title ? `${title} ${val}`.trim() : val;
}

module.exports = {
  calculateLedgerTotals,
  formatLedgerAmount,
  formatWhatsAppLedgerText,
  mapDbTransactionsToPaperItems,
  isTransferTransaction,
  formatTxDate,
  formatImportTransactionTitle,
  parseNotepadLine,
  formatItemToFreeformLine,
  selectAllCandidates,
  deselectAllCandidates,
  toggleCandidateSelection,
  filterSelectedCandidates,
  filterCandidatesBySearch,
};


