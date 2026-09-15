export const getTransactionType = (item) => {
  const type = String(item.type || '').toLowerCase();

  if (
    type === 'transfer' ||
    item.transfer_group_id ||
    item.is_transfer
  ) {
    return 'transfer';
  }

  if (type === 'income') {
    return 'income';
  }

  return 'expense';
};

export const getAmountColor = (type) => {
  if (type === 'income') {
    return '#20A56A';
  }

  if (type === 'transfer') {
    return '#6B7280';
  }

  return '#E35D6A';
};

export const getAmountPrefix = (type) => {
  if (type === 'income') {
    return '+';
  }

  if (type === 'expense') {
    return '-';
  }

  return '';
};

export const getTypeIcon = (type) => {
  if (type === 'income') {
    return 'arrow-down-circle-outline';
  }

  if (type === 'transfer') {
    return 'swap-horizontal';
  }

  return 'arrow-up-circle-outline';
};
