/**
 * Pure helper utilities for LoanDashboardScreen.
 * Framework-agnostic CommonJS so Node tests and Metro/Expo can both use it directly.
 */

function toNum(v) {
  return Number(v || 0);
}

function getLoanDirection(loan) {
  const value = String(loan?.loan_direction ?? loan?.direction ?? '')
    .trim()
    .toUpperCase();
  return value === 'LENT' ? 'LENT' : 'BORROWED';
}

function isLoanActive(loan) {
  return (loan?.status || 'Active') === 'Active';
}

function parseLocalDayMidnight(dateValue) {
  if (!dateValue) return null;
  const normalized =
    dateValue instanceof Date
      ? dateValue
      : new Date(String(dateValue).trim().replace(' ', 'T'));
  if (Number.isNaN(normalized.getTime())) return null;
  return new Date(
    normalized.getFullYear(),
    normalized.getMonth(),
    normalized.getDate()
  );
}

function isLoanOverdue(loan, now = new Date()) {
  const outstanding = toNum(loan?.outstanding_amount);
  if (outstanding <= 0 || !isLoanActive(loan)) return false;
  if (!loan?.loan_end_date) return false;

  const endMidnight = parseLocalDayMidnight(loan.loan_end_date);
  const todayMidnight = parseLocalDayMidnight(now);
  if (!endMidnight || !todayMidnight) return false;
  return endMidnight < todayMidnight;
}

function computeDirectionSummary(directionLoans = [], now = new Date()) {
  let outstanding = 0;
  let paid = 0;
  let emi = 0;
  let interest = 0;
  let overdue = 0;
  let activeCount = 0;
  let closedCount = 0;

  for (const loan of directionLoans) {
    const out = Math.max(0, toNum(loan?.outstanding_amount));
    const pPaid = Math.max(0, toNum(loan?.principal_paid));
    const intPaid = Math.max(0, toNum(loan?.interest_paid));
    const active = isLoanActive(loan) && out > 0;

    outstanding += out;
    paid += pPaid;
    interest += intPaid;

    if (active) {
      activeCount += 1;
      emi += Math.max(0, toNum(loan?.emi_amount));
    } else {
      closedCount += 1;
    }

    if (isLoanOverdue(loan, now)) {
      overdue += 1;
    }
  }

  const total = paid + outstanding;
  const percentage =
    total > 0
      ? Math.min(100, (paid / total) * 100)
      : directionLoans.length > 0 && closedCount === directionLoans.length
        ? 100
        : 0;

  return {
    outstanding,
    paid,
    total,
    percentage,
    emi,
    interest,
    overdue,
    activeCount,
    closedCount,
    totalCount: directionLoans.length,
  };
}

function buildClampedDate(year, month, desiredDay) {
  const maxDayInMonth = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.max(1, Math.min(desiredDay, maxDayInMonth));
  return new Date(year, month, safeDay);
}

function computeUpcomingDueInfo(loan, now = new Date()) {
  const todayMidnight = parseLocalDayMidnight(now) || new Date();
  const startParsed = loan?.loan_start_date
    ? new Date(String(loan.loan_start_date).trim().replace(' ', 'T'))
    : null;
  const startDay =
    startParsed && !Number.isNaN(startParsed.getTime())
      ? startParsed.getDate()
      : todayMidnight.getDate();

  const desiredDay = toNum(loan?.emi_day) > 0 ? toNum(loan.emi_day) : startDay;

  let candidate = buildClampedDate(
    todayMidnight.getFullYear(),
    todayMidnight.getMonth(),
    desiredDay
  );

  if (candidate < todayMidnight) {
    const nextMonthYear =
      todayMidnight.getMonth() === 11
        ? todayMidnight.getFullYear() + 1
        : todayMidnight.getFullYear();
    const nextMonthIndex = (todayMidnight.getMonth() + 1) % 12;
    candidate = buildClampedDate(nextMonthYear, nextMonthIndex, desiredDay);
  }

  const daysUntilDue = Math.round(
    (candidate.getTime() - todayMidnight.getTime()) / 86400000
  );
  const overdue = isLoanOverdue(loan, now);

  let urgencyLabel = `In ${daysUntilDue}d`;
  let urgencyTone = 'normal';

  if (overdue) {
    urgencyLabel = 'Overdue';
    urgencyTone = 'danger';
  } else if (daysUntilDue <= 0) {
    urgencyLabel = 'Due Today';
    urgencyTone = 'warning';
  } else if (daysUntilDue === 1) {
    urgencyLabel = 'Tomorrow';
    urgencyTone = 'warning';
  } else if (daysUntilDue <= 5) {
    urgencyLabel = `In ${daysUntilDue}d`;
    urgencyTone = 'warning';
  }

  return {
    nextDueDate: candidate.toISOString(),
    daysUntilDue,
    isOverdue: overdue,
    urgencyLabel,
    urgencyTone,
  };
}

function getRecentActivityMeta(item, direction = 'BORROWED') {
  const pt = String(item?.payment_type || '').trim().toUpperCase();
  const isLent = direction === 'LENT';

  switch (pt) {
    case 'TOP_UP':
      return {
        label: 'TOP UP',
        icon: 'cash-plus',
        color: '#7C3AED',
        sign: '+',
      };
    case 'ADVANCE':
      return {
        label: 'LENT MORE',
        icon: 'hand-coin-outline',
        color: '#7C3AED',
        sign: '+',
      };
    case 'PREPAYMENT':
      return {
        label: 'PREPAYMENT',
        icon: 'trending-up',
        color: '#EA580C',
        sign: '−',
      };
    case 'FORECLOSURE':
      return {
        label: 'FORECLOSURE',
        icon: 'bank-remove',
        color: '#DC2626',
        sign: '−',
      };
    default:
      return isLent
        ? {
            label: 'RECOVERY',
            icon: 'cash-plus',
            color: '#16A34A',
            sign: '+',
          }
        : {
            label: 'PAYMENT',
            icon: 'cash-check',
            color: '#16A34A',
            sign: '−',
          };
  }
}

function getDashboardQuickActions(direction = 'BORROWED') {
  return direction === 'LENT'
    ? ['add', 'receive', 'lendMore', 'all']
    : ['add', 'pay', 'prepay', 'all'];
}

function buildLoanActionNavigation(actionKey, loan) {
  const id = loan.id;
  switch (actionKey) {
    case 'prepay':
      return { route: 'LoanPayment', params: { id, mode: 'prepayment' } };
    case 'receive':
      return { route: 'LoanPayment', params: { id, mode: 'receive' } };
    case 'lendMore':
      return { route: 'LendMore', params: { id } };
    case 'pay':
    default:
      return { route: 'LoanPayment', params: { id } };
  }
}

function resolveQuickActionTarget({
  actionKey,
  direction = 'BORROWED',
  activeLoans = [],
}) {
  if (actionKey === 'add') {
    return {
      type: 'navigate',
      route: 'LoanForm',
      params: { initialDirection: direction },
    };
  }

  if (actionKey === 'all') {
    return {
      type: 'navigate',
      route: 'LoanList',
      params: { direction },
    };
  }

  if (!Array.isArray(activeLoans) || activeLoans.length === 0) {
    return {
      type: 'empty',
      actionKey,
    };
  }

  if (activeLoans.length === 1) {
    const nav = buildLoanActionNavigation(actionKey, activeLoans[0]);
    return {
      type: 'navigate',
      route: nav.route,
      params: nav.params,
    };
  }

  return {
    type: 'pickLoan',
    actionKey,
    loans: activeLoans,
  };
}

module.exports = {
  getLoanDirection,
  isLoanActive,
  isLoanOverdue,
  computeDirectionSummary,
  computeUpcomingDueInfo,
  getRecentActivityMeta,
  getDashboardQuickActions,
  buildLoanActionNavigation,
  resolveQuickActionTarget,
};
