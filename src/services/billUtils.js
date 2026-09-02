export const BILL_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  OVERDUE: "overdue",
  SKIPPED: "skipped",
};

export const RECURRENCE_TYPES = ["daily", "weekly", "monthly", "yearly"];

export const STATUS_COLORS = {
  overdue: "#E46A6A",
  due_soon: "#FFB020",
  paid: "#36B37E",
  skipped: "#7B8794",
  future: "#7B8794",
  pending: "#4B7CF3",
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

  const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
  const n = Math.max(1, Number(interval) || 1);

  let y = year;
  let m = month;
  let d = day;

  switch (type) {
    case "daily": {
      const dt = new Date(year, month - 1, day + n);
      return [
        dt.getFullYear(),
        String(dt.getMonth() + 1).padStart(2, "0"),
        String(dt.getDate()).padStart(2, "0"),
      ].join("-");
    }

    case "weekly": {
      const dt = new Date(year, month - 1, day + n * 7);
      return [
        dt.getFullYear(),
        String(dt.getMonth() + 1).padStart(2, "0"),
        String(dt.getDate()).padStart(2, "0"),
      ].join("-");
    }

    case "monthly": {
      let totalMonths = month - 1 + n;
      y += Math.floor(totalMonths / 12);
      m = (totalMonths % 12) + 1;

      // Last day of target month
      const lastDay = new Date(y, m, 0).getDate();
      d = Math.min(day, lastDay);

      return [y, String(m).padStart(2, "0"), String(d).padStart(2, "0")].join(
        "-",
      );
    }

    case "yearly": {
      y += n;

      // Handle Feb 29 on non-leap years
      const lastDay = new Date(y, month, 0).getDate();
      d = Math.min(day, lastDay);

      return [
        y,
        String(month).padStart(2, "0"),
        String(d).padStart(2, "0"),
      ].join("-");
    }

    default:
      return null;
  }
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
export function generateOccurrenceDates(bill, upToDate = todayStr()) {
  if (!bill.is_recurring || !bill.recurrence_type || !bill.due_date) return [];

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
      bill.recurrence_type,
      bill.recurrence_interval || 1,
    );
    if (!next || next === cursor) break;
    cursor = next;
  }

  return dates;
}

/**
 * Generate future occurrence dates from today+1 up to a horizon (default +13 months).
 * Used to pre-create upcoming bills on creation.
 */
export function generateFutureOccurrenceDates(
  bill,
  fromDate = todayStr(),
  monthsAhead = 13,
) {
  if (!bill.is_recurring || !bill.recurrence_type || !bill.due_date) return [];

  const horizon = new Date(fromDate);
  horizon.setMonth(horizon.getMonth() + monthsAhead);
  const upTo = horizon.toISOString().slice(0, 10);

  const all = generateOccurrenceDates(bill, upTo);
  // Return only dates strictly after fromDate
  return all.filter((d) => d > fromDate);
}

export function getMissingOccurrenceDates(occurrenceDates, existingBills) {
  const existingDates = new Set(
    existingBills.map((b) => b.due_date?.slice(0, 10)).filter(Boolean),
  );
  return occurrenceDates.filter((d) => !existingDates.has(d));
}
