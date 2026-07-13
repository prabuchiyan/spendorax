import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const THEMES = {
  EMI: {
    icon: 'calendar-check',
    color: '#2563EB',
    bg: '#DBEAFE',
    label: 'EMI Payment',
  },
  PREPAYMENT: {
    icon: 'cash-fast',
    color: '#16A34A',
    bg: '#DCFCE7',
    label: 'Prepayment',
  },
  FORECLOSURE: {
    icon: 'bank-check',
    color: '#EA580C',
    bg: '#FED7AA',
    label: 'Foreclosure',
  },
};

export default function RecentActivityItem({ item }) {
  const theme = THEMES[item.payment_type] || {
    icon: 'bank-transfer',
    color: '#6366F1',
    bg: '#EEF2FF',
    label: item.payment_type,
  };

  const amount = Number(item.payment_amount || 0).toLocaleString('en-IN');

  const date = new Date(item.payment_date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: theme.bg,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={theme.icon}
            size={22}
            color={theme.color}
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.loanName} numberOfLines={1}>
            {item.loan_name || 'Loan'}
          </Text>

          <Text
            style={[
              styles.type,
              {
                color: theme.color,
              },
            ]}
          >
            {theme.label}
          </Text>
        </View>

        <View style={styles.right}>
          <Text style={styles.amount}>
            ₹{amount}
          </Text>

          <Text style={styles.date}>
            {date}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    marginBottom: 10,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    flex: 1,
    marginLeft: 14,
  },

  loanName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },

  type: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },

  right: {
    alignItems: 'flex-end',
  },

  amount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },

  date: {
    marginTop: 4,
    fontSize: 11,
    color: '#6B7280',
  },
});