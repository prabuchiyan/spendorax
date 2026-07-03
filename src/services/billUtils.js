export const BILL_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  OVERDUE: 'overdue',
  SKIPPED: 'skipped',
};

export const RECURRENCE_TYPES = ['daily', 'weekly', 'monthly', 'yearly'];

export const STATUS_COLORS = {
  overdue: '#E46A6A',
  due_soon: '#FFB020',
  paid: '#36B37E',
  skipped: '#7B8794',
  future: '#7B8794',
  pending: '#4B7CF3',
};

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(fromStr, toStr) {
  if (!fromStr || !toStr) return null;
  const a = new Date(fromStr.slice(0, 10));
  const b = new Date(toStr.slice(0, 10));
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function addRecurrence(dateStr, type, interval = 1) {
  if (!dateStr || !type) return null;
  const d = new Date(dateStr.slice(0, 10));
  const n = Math.max(1, Number(interval) || 1);
  switch (type) {
    case 'daily':
      d.setDate(d.getDate() + n);
      break;
    case 'weekly':
      d.setDate(d.getDate() + n * 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + n);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + n);
      break;
    default:
      return null;
  }
  return d.toISOString().slice(0, 10);
}

export function computeBillStatus(bill, today = todayStr()) {
  if (!bill) return BILL_STATUS.PENDING;
  if (bill.deleted_at) return null;
  if (bill.status === BILL_STATUS.SKIPPED) return BILL_STATUS.SKIPPED;
  if (bill.status === BILL_STATUS.PAID || Number(bill.is_paid) === 1) return BILL_STATUS.PAID;
  if (bill.due_date && bill.due_date.slice(0, 10) < today) return BILL_STATUS.OVERDUE;
  return BILL_STATUS.PENDING;
}

export function getBillDisplayStatus(bill, today = todayStr()) {
  const status = computeBillStatus(bill, today);
  if (status === BILL_STATUS.PAID) return { key: 'paid', label: 'Paid', color: STATUS_COLORS.paid };
  if (status === BILL_STATUS.SKIPPED) return { key: 'skipped', label: 'Skipped', color: STATUS_COLORS.skipped };
  if (status === BILL_STATUS.OVERDUE) return { key: 'overdue', label: 'Overdue', color: STATUS_COLORS.overdue };
  const days = daysBetween(today, bill.due_date);
  if (days !== null && days >= 0 && days <= 3) {
    return { key: 'due_soon', label: 'Due Soon', color: STATUS_COLORS.due_soon };
  }
  if (days !== null && days > 3) {
    return { key: 'future', label: 'Upcoming', color: STATUS_COLORS.future };
  }
  return { key: 'pending', label: 'Pending', color: STATUS_COLORS.pending };
}

export function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatDueDate(dateStr) {
  if (!dateStr) return 'No due date';
  return new Date(dateStr.slice(0, 10)).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function isSameMonth(dateStr, year, month) {
  if (!dateStr) return false;
  const d = new Date(dateStr.slice(0, 10));
  return d.getFullYear() === year && d.getMonth() === month;
}

export function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}
