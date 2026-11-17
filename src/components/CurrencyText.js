import React from 'react';
import { Text } from 'react-native';
import { formatCurrency } from '../services/billUtils';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext';

export default function CurrencyText({
  amount,
  style,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
  ...props
}) {
  const { balanceVisible } = useBalanceVisibility();
  const value = Number(amount || 0);
  const formatted = `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits,
    maximumFractionDigits,
  })}`;

  return <Text style={style} {...props}>{balanceVisible ? formatted : '••••••'}</Text>;
}
