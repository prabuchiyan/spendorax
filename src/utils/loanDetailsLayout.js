/**
 * Responsive layout and action configuration helpers for LoanDetailsScreen.
 * Kept framework-agnostic (CommonJS) so Node unit tests and Metro/Expo can both import it.
 */

function computeActionGridLayout(availableWidth, itemCount = 6) {
  const safeWidth =
    Number.isFinite(Number(availableWidth)) && Number(availableWidth) > 0
      ? Math.floor(Number(availableWidth))
      : 280;

  const count = Math.max(1, Number(itemCount) || 1);
  const gap = safeWidth < 300 ? 8 : 10;

  let columns = 3;
  if (count === 4) {
    columns = safeWidth >= 420 ? 4 : 2;
  } else if (count === 6) {
    if (safeWidth >= 560) {
      columns = 6;
    } else if (safeWidth >= 230) {
      columns = 3;
    } else {
      columns = 2;
    }
  } else {
    columns = safeWidth >= 420 ? Math.min(4, count) : safeWidth >= 240 ? Math.min(3, count) : 2;
  }

  const totalGap = gap * (columns - 1);
  const tileWidth = Math.max(1, Math.floor((safeWidth - totalGap) / columns));

  return {
    columns,
    gap,
    tileWidth,
  };
}

function getLoanActionsConfig(loan) {
  if (!loan) {
    return { primary: null, secondary: [] };
  }

  const isLent = String(loan.loan_direction || 'BORROWED').trim().toUpperCase() === 'LENT';
  const id = loan.id;

  if (isLent) {
    return {
      primary: {
        key: 'receive',
        title: 'Receive Payment',
        subtitle: 'Record repayment received from borrower',
        icon: 'cash-plus',
        color: '#16A34A',
        lightBg: '#DCFCE7',
        route: 'LoanPayment',
        params: { id, mode: 'receive' },
      },
      secondary: [
        {
          key: 'lendMore',
          title: 'Lend More',
          icon: 'hand-coin-outline',
          color: '#7C3AED',
          lightBg: '#EDE9FE',
          route: 'LendMore',
          params: { id },
        },
        {
          key: 'history',
          title: 'History',
          icon: 'history',
          color: '#2563EB',
          lightBg: '#DBEAFE',
          route: 'LoanHistory',
          params: { id },
        },
        {
          key: 'reports',
          title: 'Reports',
          icon: 'file-chart',
          color: '#0284C7',
          lightBg: '#E0F2FE',
          route: 'LoanReports',
          params: { id },
        },
        {
          key: 'edit',
          title: 'Edit',
          icon: 'pencil',
          color: '#0F766E',
          lightBg: '#CCFBF1',
          route: 'LoanForm',
          params: { id },
        },
      ],
    };
  }

  return {
    primary: {
      key: 'pay',
      title: 'Pay EMI',
      subtitle: 'Record EMI or regular loan payment',
      icon: 'cash-fast',
      color: '#2563EB',
      lightBg: '#DBEAFE',
      route: 'LoanPayment',
      params: { id },
    },
    secondary: [
      {
        key: 'topUp',
        title: 'Top Up',
        icon: 'cash-plus',
        color: '#2563EB',
        lightBg: '#DBEAFE',
        route: 'TopUp',
        params: { id, loanName: loan.loan_name },
      },
      {
        key: 'prepay',
        title: 'Prepay',
        icon: 'trending-up',
        color: '#EA580C',
        lightBg: '#FFEDD5',
        route: 'LoanPayment',
        params: { id, mode: 'prepayment' },
      },
      {
        key: 'close',
        title: 'Close',
        icon: 'bank-remove',
        color: '#DC2626',
        lightBg: '#FEE2E2',
        route: 'LoanForeclose',
        params: { id },
      },
      {
        key: 'history',
        title: 'History',
        icon: 'history',
        color: '#7C3AED',
        lightBg: '#EDE9FE',
        route: 'LoanHistory',
        params: { id },
      },
      {
        key: 'reports',
        title: 'Reports',
        icon: 'file-chart',
        color: '#0284C7',
        lightBg: '#E0F2FE',
        route: 'LoanReports',
        params: { id },
      },
      {
        key: 'edit',
        title: 'Edit',
        icon: 'pencil',
        color: '#0F766E',
        lightBg: '#CCFBF1',
        route: 'LoanForm',
        params: { id },
      },
    ],
  };
}

module.exports = {
  computeActionGridLayout,
  getLoanActionsConfig,
};
