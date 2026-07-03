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

  const tx = await getTransactions(1000000);
  const income = tx.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const expense = tx.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  return { initial, income, expense, balance: initial + income - expense };
}

export async function getCategorySpending(period = null, mode = 'monthly') {
  const tx = await getTransactions(1000000);
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
    return { category_id: k, category_name: cat ? cat.name : 'Uncategorized', amount: byId[k] };
  }).sort((a,b) => b.amount - a.amount);

  return result;
}

export async function getMonthlyTrends(months = 6) {
  const tx = await getTransactions(1000000);
  const trends = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.toISOString().slice(0, 7);
    const monthTx = tx.filter(t => t.date && String(t.date).startsWith(m));
    const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    trends.push({ month: m, income, expense });
  }
  return trends;
}

export async function getSourceBalances() {
  const sources = await getSources(true);
  const tx = await getTransactions(1000000);
  const result = sources.map(s => {
    const initial = parseFloat(s.initial_balance) || 0;
    const income = tx.filter(t => String(t.source_id) === String(s.id) && t.type === 'income').reduce((a,b)=>a + (parseFloat(b.amount)||0), 0);
    const expense = tx.filter(t => String(t.source_id) === String(s.id) && t.type === 'expense').reduce((a,b)=>a + (parseFloat(b.amount)||0), 0);
    return { source_id: s.id, name: s.name, balance: initial + income - expense };
  });
  return result;
}

export function groupTransactions(transactions, mode) {
  if (!transactions) return [];
  const groups = {};

  transactions.forEach(tx => {
    const amount = Number(tx.amount) || 0;
    const rawDate = tx.date ? String(tx.date) : '';
    const dateStr = rawDate.replace(' ', 'T');
    const dateObj = new Date(dateStr || rawDate);
    if (isNaN(dateObj.getTime())) return;

    let key = '';
    if (mode === 'daily') {
      key = dateStr.split('T')[0];
    } else if (mode === 'weekly') {
      const day = dateObj.getDay();
      const diff = dateObj.getDate() - day;
      const weekStart = new Date(dateObj.setDate(diff));
      key = weekStart.toISOString().split('T')[0];
    } else if (mode === 'monthly') {
      key = dateStr.substring(0, 7);
    } else if (mode === 'yearly') {
      key = dateStr.substring(0, 4);
    }

    if (!groups[key]) {
      groups[key] = { label: key, income: 0, expense: 0, balance: 0, categories: {} };
    }

    const cid = tx.category_id || 'uncategorized';
    if (!groups[key].categories[cid]) {
      groups[key].categories[cid] = { income: 0, expense: 0 };
    }

    if (tx.type === 'income') {
      groups[key].income += amount;
      groups[key].categories[cid].income += amount;
    } else if (tx.type === 'expense') {
      groups[key].expense += amount;
      groups[key].categories[cid].expense += amount;
    }
  });

  const result = Object.values(groups);
  result.sort((a, b) => b.label.localeCompare(a.label));
  
  return result;
}

export default { getTotalBalance, getCategorySpending, getMonthlyTrends };
