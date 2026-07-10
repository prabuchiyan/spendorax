import calc from './loanCalculations';

export function generateSchedule(loan) {
  const principal = Number(loan.principal_amount || 0);
  const rate = Number(loan.interest_rate || 0);
  const tenure = Number(loan.tenure_months || 0);
  const start = loan.loan_start_date || new Date().toISOString();
  return calc.generateAmortizationSchedule(principal, rate, tenure, start);
}

export default { generateSchedule };
