import React from 'react';
import { Text } from 'react-native';
import { formatCurrency } from '../services/billUtils';

export default function CurrencyText({
  amount,
  style,
  minimumFractionDigits,
  maximumFractionDigits = 2,
}) {
  const value = Number(amount || 0);
  let formatted;

  if (minimumFractionDigits != null) {
    formatted = `₹${value.toLocaleString('en-IN', { minimumFractionDigits })}`;
  } else if (maximumFractionDigits === 2 && Number.isInteger(value * 100)) {
    formatted = formatCurrency(value);
  } else {
    formatted = `₹${value.toFixed(maximumFractionDigits)}`;
  }

  return <Text style={style}>{formatted}</Text>;
}
