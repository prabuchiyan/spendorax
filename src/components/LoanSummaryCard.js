import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const THEMES = {
  Outstanding: {
    color: '#DC2626',
    bg: '#FEE2E2',
    subtitle: 'Remaining Balance',
  },
  'Monthly EMI': {
    color: '#2563EB',
    bg: '#DBEAFE',
    subtitle: 'Every Month',
  },
  'Principal Paid': {
    color: '#16A34A',
    bg: '#DCFCE7',
    subtitle: 'Paid Back',
  },
  'Interest Paid': {
    color: '#D97706',
    bg: '#FEF3C7',
    subtitle: 'Total Interest',
  },
};

export default function LoanSummaryCard({ title, amount, icon }) {
  const theme = THEMES[title] || {
    color: '#6366F1',
    bg: '#EEF2FF',
    subtitle: '',
  };

  return (
    <Card style={styles.card}>
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: theme.bg,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={26}
          color={theme.color}
        />
      </View>

      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      <Text numberOfLines={1} style={styles.amount}>
        ₹{Number(amount || 0).toLocaleString('en-IN')}
      </Text>

      <Text numberOfLines={1} style={[styles.subtitle, { color: theme.color }]}>
        {theme.subtitle}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    borderRadius: 18,
    minHeight: 112,
  },

  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  title: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
  },

  amount: {
    marginTop: 4,
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '600',
  },
});