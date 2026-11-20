/**
 * Utility functions for Smart Notepad screen
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
    '📓 *SpendoraX - Smart Notepad*',
    `📅 *Date:* ${formattedDate}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━'
  ];

  if (!items || items.length === 0) {
    lines.push('_No transactions in ledger_');
  } else {
    let sumIncome = 0;
    let sumExpense = 0;

    items.forEach((item, index) => {
      const serial = `${index + 1}) `;
      const isIncome = String(item.type || '').toLowerCase() === 'income';
      const typeLabel = isIncome ? '[+]' : '[-]';
      const numAmount = Math.abs(Number(item.amount) || 0);
      if (isIncome) {
        sumIncome += numAmount;
      } else {
        sumExpense += numAmount;
      }

      const rawTitle = (item.title || (isIncome ? 'Income' : 'Expense')).trim();
      const cleanTitle = rawTitle.replace(/\r?\n+/g, ' ');
      const formulaStr = item.formula ? ` [${item.formula}]` : '';
      const amtStr = `${isIncome ? '+' : '-'}${formatLedgerAmount(numAmount)}`;
      const tag = isIncome ? '(Money In)' : '(Money Out)';

      // Single, easily understandable line without complex tree branches
      lines.push(`${serial}${cleanTitle}${formulaStr} ${typeLabel} : *${amtStr}* ${tag}`);
    });

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`🟢 *Money In:* +${formatLedgerAmount(sumIncome)}`);
    lines.push(`🔴 *Money Out:* -${formatLedgerAmount(sumExpense)}`);
    const balanceSign = netTotal > 0 ? '+' : (netTotal < 0 ? '-' : '');
    const balanceLabel = netTotal >= 0 ? 'Remaining Balance' : 'Overspent';
    lines.push(`⚖️ *${balanceLabel}:* ${balanceSign}${formatLedgerAmount(Math.abs(netTotal))}`);
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━');
  const netSign = netTotal > 0 ? '+' : '';
  lines.push(`*Total (Net):*  *${netSign}${formatLedgerAmount(netTotal)}*`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('Shared via SpendoraX Smart Notepad');

  return lines.join('\n');
}

/**
 * Generates a numbered copy title like "test 1 (1)", "test 1 (2)".
 * If baseTitle already ends with " (N)", strips the existing "(N)" to find the root "test 1"
 * and increments to the next available number.
 * @param {string} baseTitle
 * @param {Array<{ title?: string }>} existingSheets
 * @returns {string}
 */
function getNextCopyTitle(baseTitle = '', existingSheets = []) {
  const raw = (baseTitle || '').trim();
  if (!raw) return 'Smart Notepad (1)';

  // Check if title already ends with " (N)" e.g. "test 1 (1)"
  const match = raw.match(/^(.*?)\s*\((\d+)\)$/);
  const rootTitle = match ? match[1].trim() : raw;

  const existingTitles = new Set(
    (existingSheets || []).map((s) => (s && s.title ? s.title.trim() : ''))
  );

  // Find the next available (N) starting from 1
  let num = 1;
  while (existingTitles.has(`${rootTitle} (${num})`)) {
    num++;
  }
  return `${rootTitle} (${num})`;
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
  )
    .replace(/[\r\n]+/g, ' ')
    .trim();
  const note = (tx.notes || '').replace(/[\r\n]+/g, ' ').trim();

  if (note && note.toLowerCase() !== cat.toLowerCase()) {
    return `${dateStr}: ${cat}: ${note}`;
  }
  return `${dateStr}: ${cat}`;
}

/**
 * Parses a freeform typed line into a paper ledger transaction item.
 * Supports:
 * - "Dinner 450" -> title: "Dinner", amount: 450, type: "income", resultText: "+ ₹450"
 * - "Dinner - 450" or "Dinner -450" -> title: "Dinner", amount: 450, type: "expense", resultText: "− ₹450"
 * - "100*5" -> title: "Calculation", amount: 500, type: "income", formula: "100*5", resultText: "+ ₹500"
 * - "-100*5" -> title: "Calculation", amount: 500, type: "expense", formula: "-100*5", resultText: "− ₹500"
 * - "Gold 400g 700" -> title: "Gold 400g", amount: 700, type: "income"
 * - "Milk 5L -700" -> title: "Milk 5L", amount: 700, type: "expense"
 *
 * @param {string} rawText
 * @param {'income'|'expense'} [defaultType='income']
 * @returns {{ title: string, amount: number, formula: string|null, type: 'income'|'expense', resultText: string, isValid: boolean, error?: string }}
 */
function parseNotepadLine(rawText, defaultType = 'income') {
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
      const type = forcedType || (wholeEval.result < 0 ? 'expense' : defaultType);
      const isIncome = type === 'income';
      const absAmount = Math.abs(wholeEval.result);
      const resultText = (isIncome ? '+ ' : '− ') + formatLedgerAmount(absAmount);
      return {
        title: 'Calculation',
        amount: absAmount,
        formula: wholeEval.hasOperator ? text : null,
        type,
        resultText,
        isValid: true,
      };
    }
  }

  // 2. Line contains letters: separate description (including units like 400g, 5L, 3rd) and math amount
  let title = '';
  let exprPart = '';

  // Find the index of the last letter
  let lastLetterIdx = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (/[a-zA-Z]/.test(text[i])) {
      lastLetterIdx = i;
      break;
    }
  }

  if (lastLetterIdx < text.length - 1) {
    const afterLetters = text.substring(lastLetterIdx + 1).trim();
    let cleanAfter = afterLetters;
    let localForced = null;
    if (cleanAfter.startsWith('+')) {
      localForced = 'income';
    } else if (cleanAfter.startsWith('-') || cleanAfter.startsWith('−')) {
      localForced = 'expense';
    }

    const testEval = evaluateMathExpression(cleanAfter);
    if (testEval.isValid) {
      title = text.substring(0, lastLetterIdx + 1).trim();
      exprPart = cleanAfter;
      if (localForced) forcedType = localForced;
      else if (testEval.result < 0) forcedType = 'expense';
    } else {
      // If afterLetters has multiple numbers like '1 450' in 'Day 1 450',
      // scan backwards from spaces to find the trailing math expression
      const spaceIndices = [];
      for (let i = 0; i < afterLetters.length; i++) {
        if (afterLetters[i] === ' ') spaceIndices.push(i);
      }
      for (let i = spaceIndices.length - 1; i >= 0; i--) {
        const splitIdx = spaceIndices[i];
        let cand = afterLetters.substring(splitIdx + 1).trim();
        let candForced = null;
        if (cand.startsWith('+')) {
          candForced = 'income';
        } else if (cand.startsWith('-') || cand.startsWith('−')) {
          candForced = 'expense';
        }
        const candEval = evaluateMathExpression(cand);
        if (candEval.isValid) {
          title = (text.substring(0, lastLetterIdx + 1) + ' ' + afterLetters.substring(0, splitIdx)).trim();
          exprPart = cand;
          if (candForced) forcedType = candForced;
          else if (candEval.result < 0) forcedType = 'expense';
          break;
        }
      }
    }
  } else {
    // Line ends with a letter: check if leading part is math (e.g. '450 Dinner' or '+50000 Salary')
    const matchLeading = text.match(/^([+\-−]?\s*[\d(][\d+\-*\/%().\s]*?)\s+([a-zA-Z].*)$/);
    if (matchLeading) {
      let cand = matchLeading[1].trim();
      let candForced = null;
      if (cand.startsWith('+')) {
        candForced = 'income';
      } else if (cand.startsWith('-') || cand.startsWith('−')) {
        candForced = 'expense';
      }
      const leadEval = evaluateMathExpression(cand);
      if (leadEval.isValid) {
        title = matchLeading[2].trim();
        exprPart = cand;
        if (candForced) forcedType = candForced;
        else if (leadEval.result < 0) forcedType = 'expense';
      }
    }
  }

  if (!exprPart) {
    return { isValid: false, error: 'No amount or formula found' };
  }

  const evalRes = evaluateMathExpression(exprPart);
  if (!evalRes.isValid || evalRes.result === null) {
    return { isValid: false, error: evalRes.error || 'Invalid amount/expression' };
  }

  const type = forcedType || (evalRes.result < 0 ? 'expense' : defaultType);
  const isIncome = type === 'income';
  const absAmount = Math.abs(evalRes.result);
  const resultText = (isIncome ? '+ ' : '− ') + formatLedgerAmount(absAmount);

  return {
    title: title || 'Calculation',
    amount: absAmount,
    formula: evalRes.hasOperator ? exprPart : null,
    type,
    resultText,
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
    return title ? `${title} ${val}`.trim() : val;
  }

  // Expense: format with '-' prefix
  if (val.startsWith('-') || val.startsWith('−')) {
    return title ? `${title} ${val}`.trim() : val;
  }
  return title ? `${title} -${val}`.trim() : `-${val}`;
}

/**
 * Evaluates an entire multiline Qlate notepad document line-by-line in real time.
 * @param {string} text
 * @returns {{
 *   lines: Array<{
 *     text: string,
 *     lineNum: number,
 *     title: string | null,
 *     amount: number | null,
 *     type: 'income' | 'expense' | null,
 *     formula: string | null,
 *     resultText: string
 *   }>,
 *   items: Array<Object>,
 *   totalIncome: number,
 *   totalExpense: number,
 *   netTotal: number,
 *   validCount: number
 * }}
 */
function parseNotepadDocument(text = '') {
  const rawText = typeof text === 'string' ? text : '';
  const lines = rawText.split('\n');

  let totalIncome = 0;
  let totalExpense = 0;
  let validCount = 0;
  const evaluatedLines = [];
  const validItems = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const lineNum = idx + 1;
    const trimmed = line.trim();

    if (!trimmed) {
      evaluatedLines.push({
        text: line,
        lineNum,
        title: null,
        amount: null,
        type: null,
        formula: null,
        resultText: '',
      });
      continue;
    }

    const parsed = parseNotepadLine(trimmed, 'income');
    if (!parsed || !parsed.isValid) {
      // Commentary or text note with no math
      evaluatedLines.push({
        text: line,
        lineNum,
        title: trimmed,
        amount: null,
        type: null,
        formula: null,
        resultText: '',
      });
      continue;
    }

    const isIncome = parsed.type === 'income';
    const absAmount = Math.abs(parsed.amount);

    if (isIncome) {
      totalIncome += absAmount;
    } else {
      totalExpense += absAmount;
    }
    validCount++;

    const formattedAmt = formatLedgerAmount(absAmount);
    const sign = isIncome ? '+ ' : '− ';
    const resultText = `${sign}${formattedAmt}`;

    const lineEval = {
      text: line,
      lineNum,
      title: parsed.title,
      amount: absAmount,
      type: parsed.type,
      formula: parsed.formula || null,
      resultText,
    };

    evaluatedLines.push(lineEval);

    validItems.push({
      id: `line_${lineNum}_${absAmount}`,
      title: parsed.title,
      amount: absAmount,
      type: parsed.type,
      formula: parsed.formula || null,
      date: new Date().toISOString(),
    });
  }

  totalIncome = Math.round(totalIncome * 100) / 100;
  totalExpense = Math.round(totalExpense * 100) / 100;
  const netTotal = Math.round((totalIncome - totalExpense) * 100) / 100;

  return {
    lines: evaluatedLines,
    items: validItems,
    totalIncome,
    totalExpense,
    netTotal,
    validCount,
  };
}

const SAMPLE_SMART_NOTEPAD_TEXT = `--- Monthly Budget & Calculation ---
Salary 50000
Freelance Bonus 100*5
House Rent -12000
Grocery Mart -125
Electricity Bill -1200
Room Rent split -2000
Restaurant Tip -50
Apples -240
Shopping Discount -350`;

const SAMPLE_PAPER_LEDGER_TEXT = SAMPLE_SMART_NOTEPAD_TEXT;
const calculateNotepadTotals = calculateLedgerTotals;
const formatNotepadAmount = formatLedgerAmount;
const formatWhatsAppNotepadText = formatWhatsAppLedgerText;
const mapDbTransactionsToNotepadItems = mapDbTransactionsToPaperItems;

module.exports = {
  calculateLedgerTotals,
  calculateNotepadTotals,
  formatLedgerAmount,
  formatNotepadAmount,
  formatWhatsAppLedgerText,
  formatWhatsAppNotepadText,
  mapDbTransactionsToPaperItems,
  mapDbTransactionsToNotepadItems,
  isTransferTransaction,
  formatTxDate,
  formatImportTransactionTitle,
  parseNotepadLine,
  formatItemToFreeformLine,
  parseNotepadDocument,
  selectAllCandidates,
  deselectAllCandidates,
  toggleCandidateSelection,
  filterSelectedCandidates,
  filterCandidatesBySearch,
  getNextCopyTitle,
  SAMPLE_PAPER_LEDGER_TEXT,
  SAMPLE_SMART_NOTEPAD_TEXT,
};


