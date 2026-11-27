import { getTransactions } from './transactions';
import { getSources } from './sources';
import { getCategories } from './categories';

function monthOf(dateStr) {
  if (!dateStr) return null;
  return dateStr.slice(0, 7);
}

export async function getTotalBalance() {
  const sources = await getSources(true);
  const initial = sources.reduce((s, src) => s + (parseFloat(src.initial_balance) || 0), 0);

  // onlyCounted = true — excluded transactions don't affect balance
  const tx = await getTransactions(1000000, 'No', null, null, null, new Date(), true);
  const income = tx.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const expense = tx.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  return { initial, income, expense, balance: initial + income - expense };
}

export async function getCategorySpending(period = null, mode = 'monthly') {
  // onlyCounted = true — excluded transactions don't show in spending breakdown
  const tx = await getTransactions(1000000, 'No', null, null, null, new Date(), true);
  const cats = await getCategories(true);
  const byId = {};

  let filterFn;
  if (!period) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    filterFn = (dateStr) => dateStr.startsWith(currentMonth);
  } else if (mode === 'daily' || mode === 'monthly' || mode === 'yearly') {
    filterFn = (dateStr) => dateStr.startsWith(period);
  } else if (mode === 'weekly') {
    const weekStart = new Date(period);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    filterFn = (dateStr) => {
      const d = new Date(dateStr);
      return d >= weekStart && d < weekEnd;
    };
  } else {
    filterFn = () => true;
  }

  tx.forEach(t => {
    if (t.type !== 'expense') return;
    if (!t.date) return;
    const dateStr = String(t.date).replace(' ', 'T');
    if (!filterFn(dateStr)) return;
    const cid = t.category_id || 'uncategorized';
    byId[cid] = (byId[cid] || 0) + (parseFloat(t.amount) || 0);
  });

  const result = Object.keys(byId).map(k => {
    const cat = cats.find(c => String(c.id) === String(k));
    return {
      category_id: k,
      category_name: cat ? cat.name : 'Uncategorized',
      amount: byId[k]
    };
  }).sort((a, b) => b.amount - a.amount);

  return result;
}

export async function getMonthlyTrends(months = 6) {
  // onlyCounted = true — excluded transactions don't skew trend charts
  const tx = await getTransactions(1000000, 'No', null, null, null, new Date(), true);
  const trends = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.toISOString().slice(0, 7);
    const monthTx = tx.filter(t => t.date && String(t.date).startsWith(m));
    const income = monthTx
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const expense = monthTx
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    trends.push({ month: m, income, expense });
  }

  return trends;
}

export async function getSourceBalances() {
  const sources = await getSources(true);
  // onlyCounted = true — excluded transactions don't affect source balances
  const tx = await getTransactions(1000000, 'No', null, null, null, new Date(), true);

  const result = sources.map(s => {
    const initial = parseFloat(s.initial_balance) || 0;
    const income = tx
      .filter(t => String(t.source_id) === String(s.id) && t.type === 'income')
      .reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
    const expense = tx
      .filter(t => String(t.source_id) === String(s.id) && t.type === 'expense')
      .reduce((a, b) => a + (parseFloat(b.amount) || 0), 0);
    return {
      source_id: s.id,
      name: s.name,
      balance: initial + income - expense
    };
  });

  return result;
}

function parseLocalDateForReport(rawDate) {
  if (!rawDate) return null;
  const trimmed = String(rawDate).trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    return new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]));
  }
  const d = new Date(trimmed.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

export function groupTransactions(transactions, mode) {
  if (!transactions) return [];
  const groups = {};
  const pad = (n) => String(n).padStart(2, '0');

  transactions.forEach(tx => {
    // Skip uncounted transactions in all grouped views
    if (tx.is_counted === 0 || tx.is_counted === '0' || tx.is_counted === false) return;
    if (tx.transfer_group_id) return;
    if (tx.type !== 'income' && tx.type !== 'expense') return;

    const amount = Number(tx.amount) || 0;
    const dateObj = parseLocalDateForReport(tx.date);
    if (!dateObj) return;

    let key = '';
    if (mode === 'daily') {
      key = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
    } else if (mode === 'weekly') {
      const weekStart = new Date(
        dateObj.getFullYear(),
        dateObj.getMonth(),
        dateObj.getDate() - dateObj.getDay()
      );
      key = `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`;
    } else if (mode === 'monthly') {
      key = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}`;
    } else if (mode === 'yearly') {
      key = String(dateObj.getFullYear());
    }

    if (!key) return;

    if (!groups[key]) {
      groups[key] = { label: key, income: 0, expense: 0, balance: 0, txCount: 0, categories: {} };
    }

    const cid = tx.category_id || 'uncategorized';
    if (!groups[key].categories[cid]) {
      groups[key].categories[cid] = {
        income: 0,
        expense: 0,
        incomeCount: 0,
        expenseCount: 0,
      };
    }

    if (tx.type === 'income') {
      groups[key].income += amount;
      groups[key].categories[cid].income += amount;
      groups[key].categories[cid].incomeCount += 1;
      groups[key].txCount += 1;
    } else if (tx.type === 'expense') {
      groups[key].expense += amount;
      groups[key].categories[cid].expense += amount;
      groups[key].categories[cid].expenseCount += 1;
      groups[key].txCount += 1;
    }

    groups[key].balance = groups[key].income - groups[key].expense;
  });

  const result = Object.values(groups);
  result.sort((a, b) => b.label.localeCompare(a.label));
  return result;
}

export default { getTotalBalance, getCategorySpending, getMonthlyTrends };