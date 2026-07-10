// Basic loan calculation utilities isolated from UI
export function calculateEMI(principal, annualRatePercent, tenureMonths) {
  const P = Number(principal || 0);
  const r = Number(annualRatePercent || 0) / 12 / 100;
  const n = Number(tenureMonths || 0);
  if (n <= 0) return 0;
  if (r === 0) return +(P / n).toFixed(2);
  const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  return +emi.toFixed(2);
}

export function calculateInterestComponent(balance, annualRatePercent) {
  const r = Number(annualRatePercent || 0) / 12 / 100;
  return +(Number(balance || 0) * r).toFixed(2);
}

export function calculatePrincipalComponent(emiAmount, interestComponent) {
  return +(Number(emiAmount || 0) - Number(interestComponent || 0)).toFixed(2);
}

export function calculateRemainingMonths(balance, emi, annualRatePercent) {
  // rough estimate: iterate until balance <= 0
  let months = 0;
  let b = Number(balance || 0);
  const r = Number(annualRatePercent || 0) / 12 / 100;
  const e = Number(emi || 0);
  if (e <= 0) return Infinity;
  while (b > 0 && months < 1000) {
    const interest = b * r;
    const principal = e - interest;
    if (principal <= 0) return Infinity;
    b = b - principal;
    months += 1;
  }
  return months;
}

export function generateAmortizationSchedule(principal, annualRatePercent, tenureMonths, startDate) {
  const schedule = [];
  const emi = calculateEMI(principal, annualRatePercent, tenureMonths);
  let balance = Number(principal || 0);
  const r = Number(annualRatePercent || 0) / 12 / 100;
  let date = startDate ? new Date(startDate) : new Date();
  for (let i = 0; i < tenureMonths; i++) {
    const interest = +(balance * r).toFixed(2);
    const principalComp = +(emi - interest).toFixed(2);
    balance = +(balance - principalComp).toFixed(2);
    schedule.push({
      installment: i + 1,
      date: new Date(date).toISOString(),
      emi,
      principal: principalComp,
      interest,
      balance: balance < 0 ? 0 : balance
    });
    date.setMonth(date.getMonth() + 1);
  }
  return schedule;
}

export default {
  calculateEMI,
  calculateInterestComponent,
  calculatePrincipalComponent,
  calculateRemainingMonths,
  generateAmortizationSchedule
};
