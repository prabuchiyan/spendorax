export const BILL_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  OVERDUE: "overdue",
  SKIPPED: "skipped",
};

export const RECURRENCE_TYPES = ["MONTHLY", "BI_MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"];



export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(fromStr, toStr) {
  if (!fromStr || !toStr) return null;
  const a = new Date(fromStr.slice(0, 10));
  const b = new Date(toStr.slice(0, 10));
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function addRecurrence(dateStr, type) {
  if (!dateStr || !type) return null;

  const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
  
  let y = year;
  let m = month;
  let d = day;
  let interval = 1;

  switch (type) {
    case "MONTHLY": interval = 1; break;
    case "BI_MONTHLY": interval = 2; break;
    case "QUARTERLY": interval = 3; break;
    case "HALF_YEARLY": interval = 6; break;
    case "YEARLY": interval = 12; break;
    default: return null; // Unrecognized or legacy types (daily/weekly) are skipped
  }

  let totalMonths = month - 1 + interval;
  y += Math.floor(totalMonths / 12);
  m = (totalMonths % 12) + 1;

  // Last day of target month
  const lastDay = new Date(y, m, 0).getDate();
  d = Math.min(day, lastDay);

  return [y, String(m).padStart(2, "0"), String(d).padStart(2, "0")].join("-");
}

export function getOccurrenceDateConstraints({ recurrenceType, occurrenceDate, startDate, endDate }) {
  if (!recurrenceType || !occurrenceDate || !startDate) {
    return { minDate: null, maxDate: null };
  }

  const oDate = new Date(occurrenceDate.slice(0, 10));
  const year = oDate.getFullYear();
  const month = oDate.getMonth(); // 0-indexed

  let min = new Date(year, month, 1);
  let max = new Date(year, month + 1, 0);

  let interval = 1;
  const type = String(recurrenceType).toUpperCase();
  switch (type) {
    case "MONTHLY": interval = 1; break;
    case "BI_MONTHLY": interval = 2; break;
    case "QUARTERLY": interval = 3; break;
    case "HALF_YEARLY": interval = 6; break;
    case "YEARLY": interval = 12; break;
    default: return { minDate: null, maxDate: null };
  }

  // To ensure the occurrence stays within its logical period and doesn't overlap previous/next occurrences
  // we bound it to the calendar bounds of that recurrence step.
  if (interval === 12) {
    // Yearly: stays within the same year
    min = new Date(year, 0, 1);
    max = new Date(year, 11, 31);
  } else if (interval > 1) {
    // For Multi-month periods (Bi-Monthly, Quarterly, Half-Yearly)
    // We anchor based on the start date to find the period boundaries
    const sDate = new Date(startDate.slice(0, 10));
    const sYear = sDate.getFullYear();
    const sMonth = sDate.getMonth();
    
    // Total months since start
    const monthsSinceStart = (year - sYear) * 12 + (month - sMonth);
    // Find the period index
    const periodIndex = Math.floor(monthsSinceStart / interval);
    
    // Calculate the exact start and end month of this period
    const periodStartMonthTotal = sYear * 12 + sMonth + (periodIndex * interval);
    const periodEndMonthTotal = periodStartMonthTotal + interval - 1;
    
    const pStartYear = Math.floor(periodStartMonthTotal / 12);
    const pStartMonth = periodStartMonthTotal % 12;
    const pEndYear = Math.floor(periodEndMonthTotal / 12);
    const pEndMonth = periodEndMonthTotal % 12;
    
    min = new Date(pStartYear, pStartMonth, 1);
    max = new Date(pEndYear, pEndMonth + 1, 0);
  }

  // Respect global bill start and end dates
  const billStart = new Date(startDate.slice(0, 10));
  if (min < billStart) min = billStart;
  
  if (endDate) {
    const billEnd = new Date(endDate.slice(0, 10));
    if (max > billEnd) max = billEnd;
  }

  return { minDate: min, maxDate: max };
}

export function computeBillStatus(bill, today = todayStr()) {
  if (!bill) return BILL_STATUS.PENDING;
  if (bill.deleted_at) return null;
  if (bill.status === BILL_STATUS.SKIPPED) return BILL_STATUS.SKIPPED;
  if (bill.status === BILL_STATUS.PAID || Number(bill.is_paid) === 1)
    return BILL_STATUS.PAID;
  if (bill.due_date && bill.due_date.slice(0, 10) < today)
    return BILL_STATUS.OVERDUE;
  return BILL_STATUS.PENDING;
}

export function getBillDisplayStatus(bill) {
  if (!bill) {
    return {
      label: "Due Soon",
      color: "#FFB020",
    };
  }
  const status = String(bill.status || bill.payment_status || "").toLowerCase();
  // PAID
  if (status === "paid") {
    return {
      label: "Paid",
      color: "#3F8F6B",
    };
  }
  // SKIPPED
  if (status === "skipped") {
    return {
      label: "Skipped",
      color: "#718078",
    };
  }
  if (!bill.due_date) {
    return {
      label: "Due Soon",
      color: "#FFB020",
    };
  }
  const dueDate = new Date(bill.due_date);
  if (isNaN(dueDate.getTime())) {
    return {
      label: "Due Soon",
      color: "#FFB020",
    };
  }
  // DATE-ONLY comparison.
  // Ignore the time portion completely.
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const dueDateOnly = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
    0,
    0,
    0,
    0,
  );
  // OVERDUE
  if (dueDateOnly < todayStart) {
    return {
      label: "Overdue",
      color: "#E46A6A",
    };
  }
  // DUE TODAY
  if (dueDateOnly.getTime() === todayStart.getTime()) {
    return {
      label: "Due Today",
      color: "#D89510",
    };
  }
  // DUE SOON
  return {
    label: "Due Soon",
    color: "#FFB020",
  };
}

export function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatDueDate(dateStr) {
  if (!dateStr) return "No due date";
  return new Date(dateStr.slice(0, 10)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isSameMonth(dateStr, year, month) {
  if (!dateStr) return false;
  const d = new Date(dateStr.slice(0, 10));
  return d.getFullYear() === year && d.getMonth() === month;
}

export function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * Generate every expected due date for a recurring bill.
 * Respects recurrence_end_date. Goes from bill.due_date up to upToDate (inclusive).
 * FIX: end-date check happens BEFORE push so no extra date leaks past recurrence_end_date.
 */
export function generateOccurrenceDates(bill, upToDate) {
  if (!bill.is_recurring || !bill.recurrence_type || !bill.due_date) return [];

  // Default to current month end if not specified
  if (!upToDate) {
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    upToDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`;
  }

  const dates = [];
  let cursor = bill.due_date.slice(0, 10);
  const endDate = bill.recurrence_end_date
    ? bill.recurrence_end_date.slice(0, 10)
    : null;
  const maxIter = 500;
  let iter = 0;

  while (cursor <= upToDate && iter < maxIter) {
    iter++;
    // Check end date BEFORE pushing so nothing past it is ever included
    if (endDate && cursor > endDate) break;
    dates.push(cursor);
    const next = addRecurrence(
      cursor,
      bill.recurrence_type
    );
    if (!next || next === cursor) break;
    cursor = next;
  }

  return dates;
}


