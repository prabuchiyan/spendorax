export const formatAmount = (amount) => {
  return Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatCurrency = (amount, symbol = '₹') => {
  return `${symbol}${formatAmount(amount)}`;
};


export const formatCompactAmount = (amount) => {
  const num = Number(amount || 0);
  const abs = Math.abs(num);
  if (abs >= 10000000) return `₹${(num / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (abs >= 100000) return `₹${(num / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1000) return `₹${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `₹${num.toLocaleString('en-IN')}`;
};
