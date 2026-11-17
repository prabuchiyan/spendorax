/**
 * Utility functions for Paper Ledger screen
 * Calculations, WhatsApp formatting, and data mapping
 */

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
  const formatted = absNum.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
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
      const cleanTitle = (item.title || (isIncome ? 'Income' : 'Expense')).trim();
      const amtStr = `${isIncome ? '+' : '-'}${formatLedgerAmount(item.amount)}`;
      
      lines.push(`${serial}${cleanTitle} ${typeLabel}`);
      lines.push(`     └─► Amount: *${amtStr}*`);
    });
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━');
  const netSign = netTotal >= 0 ? '+' : '';
  lines.push(`*Total (Net):*  *${netSign}${formatLedgerAmount(netTotal)}*`);
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('Shared via SpendoraX Paper Ledger');

  return lines.join('\n');
}

/**
 * Maps raw database transactions to paper ledger items
 * @param {Array<Object>} transactions
 * @param {Object} [categoriesMap]
 * @returns {Array<{ id: string, title: string, type: 'income' | 'expense', amount: number, originalId?: number, date?: string }>}
 */
function mapDbTransactionsToPaperItems(transactions = [], categoriesMap = {}) {
  return (transactions || []).map((tx, idx) => {
    const isIncome = String(tx.type || '').toLowerCase() === 'income';
    const catName = tx.category_name || (tx.category_id && categoriesMap[tx.category_id]?.name) || '';
    const note = (tx.notes || '').trim();
    const title = note || catName || (isIncome ? 'Income' : 'Expense');
    const amount = Math.abs(Number(tx.amount) || 0);

    return {
      id: `db_${tx.id || idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      type: isIncome ? 'income' : 'expense',
      amount,
      originalId: tx.id,
      date: tx.date || null
    };
  });
}

module.exports = {
  calculateLedgerTotals,
  formatLedgerAmount,
  formatWhatsAppLedgerText,
  mapDbTransactionsToPaperItems
};
