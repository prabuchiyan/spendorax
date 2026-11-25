/**
 * Pure analytics and series builders for single-loan reports.
 * Kept framework-agnostic (CommonJS) so both Metro/Expo and Node unit tests can run it directly.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isAdditionPaymentType(paymentType) {
  const normalized = String(paymentType || '').trim().toUpperCase();
  return normalized === 'TOP_UP' || normalized === 'ADVANCE';
}

function parseSafeDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  const normalized = String(value).trim().replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toMonthKey(dateInput) {
  const d = parseSafeDate(dateInput);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key) {
  if (!key || typeof key !== 'string' || !key.includes('-')) return '';
  const [y, m] = key.split('-');
  const idx = Number(m) - 1;
  return `${MONTHS_SHORT[idx] || m} '${String(y).slice(2)}`;
}

function formatFullMonthLabel(key) {
  if (!key || typeof key !== 'string' || !key.includes('-')) return '';
  const [y, m] = key.split('-');
  const idx = Number(m) - 1;
  return `${MONTHS_SHORT[idx] || m} ${y}`;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function calculateEMI(principal, annualRatePercent, tenureMonths) {
  const P = Number(principal || 0);
  const r = Number(annualRatePercent || 0) / 12 / 100;
  const n = Number(tenureMonths || 0);
  if (n <= 0 || P <= 0) return 0;
  if (r === 0) return round2(P / n);
  const factor = Math.pow(1 + r, n);
  return round2((P * r * factor) / (factor - 1));
}

function computeAmortizationSchedule(principal, annualRatePercent, tenureMonths, startDate) {
  const schedule = [];
  const n = Math.max(0, Math.floor(Number(tenureMonths || 0)));
  let balance = Number(principal || 0);
  if (n <= 0 || balance <= 0) return schedule;

  const emi = calculateEMI(balance, annualRatePercent, n);
  const r = Number(annualRatePercent || 0) / 12 / 100;
  const start = parseSafeDate(startDate) || new Date();
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  for (let i = 0; i < n && balance > 0; i++) {
    const interest = round2(balance * r);
    let principalComp = i === n - 1 ? round2(balance) : round2(emi - interest);
    if (principalComp < 0) principalComp = 0;
    if (principalComp > balance) principalComp = round2(balance);
    balance = Math.max(0, round2(balance - principalComp));

    schedule.push({
      installment: i + 1,
      date: new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString(),
      monthKey: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      emi: round2(principalComp + interest),
      principal: principalComp,
      interest,
      balance,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }
  return schedule;
}

function filterPaymentsForLoan(loan, payments = []) {
  if (!loan || !Array.isArray(payments)) return [];
  const targetId = Number(loan.id);
  return payments.filter((p) => {
    if (!p) return false;
    if (p.loan_id == null) return true;
    return Number(p.loan_id) === targetId;
  });
}

function buildMonthKeysBetween(startKey, endKey, maxMonths = 120) {
  if (!startKey || !endKey) return [];
  const [sy, sm] = startKey.split('-').map(Number);
  const [ey, em] = endKey.split('-').map(Number);
  if (!sy || !sm || !ey || !em) return [];

  const totalMonths = (ey - sy) * 12 + (em - sm) + 1;
  if (totalMonths <= 0) return [endKey];

  let startYear = sy;
  let startMonth = sm;
  if (totalMonths > maxMonths) {
    const skip = totalMonths - maxMonths;
    const totalStartIdx = sy * 12 + (sm - 1) + skip;
    startYear = Math.floor(totalStartIdx / 12);
    startMonth = (totalStartIdx % 12) + 1;
  }

  const keys = [];
  let y = startYear;
  let m = startMonth;
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

function buildSingleLoanSummary(loan, payments = []) {
  if (!loan) return null;

  const loanPayments = filterPaymentsForLoan(loan, payments);
  const direction = String(loan.loan_direction || 'BORROWED').trim().toUpperCase() === 'LENT'
    ? 'LENT'
    : 'BORROWED';
  const isLent = direction === 'LENT';
  const status = loan.status || 'Active';
  const isClosed = status === 'Closed';

  const paymentMix = {
    emi: { count: 0, amount: 0 },
    prepayment: { count: 0, amount: 0 },
    foreclosure: { count: 0, amount: 0 },
    addition: { count: 0, amount: 0 },
  };

  let repaymentPrincipalFromRows = 0;
  let repaymentInterestFromRows = 0;
  let repaymentTotalFromRows = 0;
  let additionsTotal = 0;

  for (const p of loanPayments) {
    const amt = Number(p.payment_amount || 0);
    const pt = String(p.payment_type || '').trim().toUpperCase();

    if (isAdditionPaymentType(pt)) {
      additionsTotal = round2(additionsTotal + amt);
      paymentMix.addition.count += 1;
      paymentMix.addition.amount = round2(paymentMix.addition.amount + amt);
      continue;
    }

    repaymentPrincipalFromRows = round2(repaymentPrincipalFromRows + Number(p.principal_component || 0));
    repaymentInterestFromRows = round2(repaymentInterestFromRows + Number(p.interest_component || 0));
    repaymentTotalFromRows = round2(repaymentTotalFromRows + amt);

    if (pt === 'PREPAYMENT') {
      paymentMix.prepayment.count += 1;
      paymentMix.prepayment.amount = round2(paymentMix.prepayment.amount + amt);
    } else if (pt === 'FORECLOSURE') {
      paymentMix.foreclosure.count += 1;
      paymentMix.foreclosure.amount = round2(paymentMix.foreclosure.amount + amt);
    } else {
      paymentMix.emi.count += 1;
      paymentMix.emi.amount = round2(paymentMix.emi.amount + amt);
    }
  }

  const currentPrincipal = round2(loan.principal_amount || 0);
  const originalPrincipal = loan.original_principal_amount != null
    ? round2(loan.original_principal_amount)
    : Math.max(0, round2(currentPrincipal - additionsTotal));

  const outstandingAmount = isClosed ? 0 : Math.max(0, round2(loan.outstanding_amount || 0));
  const principalPaid = loan.principal_paid != null
    ? round2(loan.principal_paid)
    : repaymentPrincipalFromRows;
  const interestPaid = loan.interest_paid != null
    ? round2(loan.interest_paid)
    : repaymentInterestFromRows;
  const totalPaid = loan.total_paid != null
    ? round2(loan.total_paid)
    : repaymentTotalFromRows;

  const prepaymentTotal = loanPayments.length > 0
    ? paymentMix.prepayment.amount
    : round2(loan.total_prepayment || 0);

  const emiAmount = round2(loan.emi_amount || 0);
  const interestRate = Number(loan.interest_rate || 0);
  const rawRemaining = Number(loan.remaining_months || 0);
  const remainingMonths = isClosed || !Number.isFinite(rawRemaining) || rawRemaining === Infinity
    ? 0
    : Math.max(0, Math.round(rawRemaining));

  const interestRemaining =
    !isClosed && outstandingAmount > 0 && remainingMonths > 0 && emiAmount > 0
      ? round2(
          computeAmortizationSchedule(outstandingAmount, interestRate, remainingMonths).reduce(
            (sum, item) => sum + Number(item.interest || 0),
            0
          )
        )
      : 0;

  let repaymentProgressPct = 0;
  if (isClosed && currentPrincipal > 0) {
    repaymentProgressPct = 100;
  } else if (currentPrincipal > 0) {
    repaymentProgressPct = Math.max(
      0,
      Math.min(100, Math.round(((currentPrincipal - outstandingAmount) / currentPrincipal) * 100))
    );
  }

  let estimatedPayoffLabel = null;
  if (isClosed) {
    estimatedPayoffLabel = 'Closed';
  } else if (outstandingAmount > 0 && remainingMonths > 0) {
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + remainingMonths);
    estimatedPayoffLabel = `${MONTHS_SHORT[payoffDate.getMonth()]} '${String(payoffDate.getFullYear()).slice(2)}`;
  }

  const donutSegments = [
    {
      key: 'principalPaid',
      label: isLent ? 'Principal Recovered' : 'Principal Paid',
      amount: principalPaid,
      color: '#10B981',
    },
    {
      key: 'interestPaid',
      label: isLent ? 'Interest Earned' : 'Interest Paid',
      amount: interestPaid,
      color: '#F59E0B',
    },
    {
      key: 'remaining',
      label: isLent ? 'Pending Recovery' : 'Remaining Balance',
      amount: outstandingAmount,
      color: '#3B82F6',
    },
  ];

  const donutTotal = round2(donutSegments.reduce((s, seg) => s + seg.amount, 0));
  donutSegments.forEach((seg) => {
    seg.percentage = donutTotal > 0 ? Math.round((seg.amount / donutTotal) * 100) : 0;
  });

  return {
    loanId: loan.id,
    loanName: loan.loan_name || 'Loan',
    lender: loan.lender || '',
    loanType: loan.loan_type || '',
    direction,
    isLent,
    status,
    isClosed,
    originalPrincipal,
    currentPrincipal,
    additionsTotal,
    outstandingAmount,
    principalPaid,
    interestPaid,
    totalPaid,
    prepaymentTotal,
    emiAmount,
    interestRate,
    tenureMonths: Number(loan.tenure_months || 0),
    remainingMonths,
    interestRemaining,
    totalEstimatedInterest: round2(interestPaid + interestRemaining),
    repaymentProgressPct,
    estimatedPayoffLabel,
    repaymentCount: loanPayments.filter((p) => !isAdditionPaymentType(p.payment_type)).length,
    paymentMix,
    donutTotal,
    donutSegments,
  };
}

function buildSingleLoanMonthlySeries(loan, payments = [], options = {}) {
  const empty = {
    actualMonths: [],
    activeMonths: [],
    projectedMonths: [],
    combinedBalanceSeries: [],
  };
  if (!loan) return empty;

  const summary = buildSingleLoanSummary(loan, payments);
  const now = parseSafeDate(options.now) || new Date();
  const nowKey = toMonthKey(now);

  const loanPayments = filterPaymentsForLoan(loan, payments)
    .slice()
    .sort((a, b) => {
      const da = parseSafeDate(a.payment_date || a.created_at)?.getTime() || 0;
      const db = parseSafeDate(b.payment_date || b.created_at)?.getTime() || 0;
      if (da !== db) return da - db;
      return Number(a.id || 0) - Number(b.id || 0);
    });

  let minDate = parseSafeDate(loan.loan_start_date) || now;
  let maxDate = now;
  for (const p of loanPayments) {
    const pd = parseSafeDate(p.payment_date || p.created_at);
    if (!pd) continue;
    if (pd < minDate) minDate = pd;
    if (pd > maxDate) maxDate = pd;
  }

  const startKey = toMonthKey(minDate) || nowKey;
  const endKey = toMonthKey(maxDate) || nowKey;
  const monthKeys = buildMonthKeysBetween(startKey, endKey, options.maxActualMonths || 120);

  const buckets = {};
  monthKeys.forEach((k) => {
    buckets[k] = {
      key: k,
      label: formatMonthLabel(k),
      fullLabel: formatFullMonthLabel(k),
      principalPaid: 0,
      interestPaid: 0,
      repaymentAmount: 0,
      additionAmount: 0,
      prepaymentAmount: 0,
      foreclosureAmount: 0,
      paymentCount: 0,
      additionCount: 0,
      lastRemainingBalance: null,
    };
  });

  for (const p of loanPayments) {
    const k = toMonthKey(p.payment_date || p.created_at);
    if (!k || !buckets[k]) continue;

    const bucket = buckets[k];
    const amt = Number(p.payment_amount || 0);
    const pt = String(p.payment_type || '').trim().toUpperCase();

    if (isAdditionPaymentType(pt)) {
      bucket.additionAmount = round2(bucket.additionAmount + amt);
      bucket.additionCount += 1;
    } else {
      bucket.principalPaid = round2(bucket.principalPaid + Number(p.principal_component || 0));
      bucket.interestPaid = round2(bucket.interestPaid + Number(p.interest_component || 0));
      bucket.repaymentAmount = round2(bucket.repaymentAmount + amt);
      bucket.paymentCount += 1;
      if (pt === 'PREPAYMENT') {
        bucket.prepaymentAmount = round2(bucket.prepaymentAmount + amt);
      } else if (pt === 'FORECLOSURE') {
        bucket.foreclosureAmount = round2(bucket.foreclosureAmount + amt);
      }
    }

    if (p.remaining_balance != null && Number.isFinite(Number(p.remaining_balance))) {
      bucket.lastRemainingBalance = Math.max(0, round2(p.remaining_balance));
    }
  }

  let runningBalance = summary.originalPrincipal;
  const actualMonths = monthKeys.map((k, index) => {
    const b = buckets[k];
    if (b.lastRemainingBalance != null) {
      runningBalance = b.lastRemainingBalance;
    } else if (b.paymentCount > 0 || b.additionCount > 0) {
      runningBalance = Math.max(0, round2(runningBalance + b.additionAmount - b.principalPaid));
    }

    const totalOutflow = round2(b.principalPaid + b.interestPaid);
    return {
      key: k,
      label: b.label,
      fullLabel: b.fullLabel,
      principalPaid: b.principalPaid,
      interestPaid: b.interestPaid,
      totalPaid: totalOutflow > 0 ? totalOutflow : b.repaymentAmount,
      repaymentAmount: b.repaymentAmount,
      additionAmount: b.additionAmount,
      prepaymentAmount: b.prepaymentAmount,
      foreclosureAmount: b.foreclosureAmount,
      paymentCount: b.paymentCount,
      additionCount: b.additionCount,
      balance: runningBalance,
      isProjected: false,
      isCurrentPivot: index === monthKeys.length - 1,
    };
  });

  if (actualMonths.length > 0) {
    actualMonths[actualMonths.length - 1].balance = summary.outstandingAmount;
  }

  const activeMonths = actualMonths.filter(
    (m) => m.principalPaid > 0 || m.interestPaid > 0 || m.repaymentAmount > 0 || m.additionAmount > 0
  );

  let projectedMonths = [];
  if (!summary.isClosed && summary.outstandingAmount > 0 && summary.emiAmount > 0 && summary.remainingMonths > 0) {
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const projSchedule = computeAmortizationSchedule(
      summary.outstandingAmount,
      summary.interestRate,
      Math.min(summary.remainingMonths, 360),
      nextMonthStart
    );
    projectedMonths = projSchedule.map((item) => ({
      key: item.monthKey,
      label: formatMonthLabel(item.monthKey),
      fullLabel: formatFullMonthLabel(item.monthKey),
      principalPaid: item.principal,
      interestPaid: item.interest,
      totalPaid: item.emi,
      repaymentAmount: item.emi,
      additionAmount: 0,
      prepaymentAmount: 0,
      foreclosureAmount: 0,
      paymentCount: 1,
      additionCount: 0,
      balance: item.balance,
      isProjected: true,
      isCurrentPivot: false,
    }));
  }

  const combinedBalanceSeries = actualMonths.concat(projectedMonths);

  return {
    actualMonths,
    activeMonths,
    projectedMonths,
    combinedBalanceSeries,
  };
}

function sampleSeriesPoints(points = [], maxPoints = 14, pivotIndex = -1) {
  if (!Array.isArray(points) || points.length <= maxPoints) {
    return points ? points.slice() : [];
  }
  if (maxPoints <= 2) {
    return [points[0], points[points.length - 1]];
  }

  const indices = new Set([0, points.length - 1]);
  if (pivotIndex >= 0 && pivotIndex < points.length) {
    indices.add(pivotIndex);
  }

  const slotsRemaining = maxPoints - indices.size;
  if (slotsRemaining > 0) {
    const step = (points.length - 1) / (slotsRemaining + 1);
    for (let i = 1; i <= slotsRemaining; i++) {
      const idx = Math.round(i * step);
      if (idx > 0 && idx < points.length - 1) {
        indices.add(idx);
      }
    }
  }

  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((idx) => points[idx]);
}

module.exports = {
  isAdditionPaymentType,
  parseSafeDate,
  toMonthKey,
  formatMonthLabel,
  formatFullMonthLabel,
  calculateEMI,
  computeAmortizationSchedule,
  filterPaymentsForLoan,
  buildSingleLoanSummary,
  buildSingleLoanMonthlySeries,
  sampleSeriesPoints,
};
