import React, { memo } from 'react';
import { View, Text } from 'react-native';
import Card from './Card';
import { Colors, Spacing } from './Theme';
import { formatCurrency } from '../services/billUtils';
import CurrencyText from './CurrencyText';

function StatBox({ label, value, color, sub }) {
  return (
    <View style={{ flex: 1, minWidth: '45%', marginBottom: Spacing.s }}>
      <Text style={{ fontSize: 12, color: Colors.muted, marginBottom: 4 }}>{label}</Text>
      <CurrencyText style={{ fontSize: 18, fontWeight: '800', color: color || Colors.text }} amount={value} />
      {sub ? <Text style={{ fontSize: 11, color: Colors.muted, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

function BillSummaryBar({ summary }) {
  if (!summary) return null;

  return (
    <Card style={{ marginBottom: Spacing.xs }}>
      <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: Spacing.s, color: Colors.text }}>
        Bills Overview
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <StatBox
          label="This Month"
          value={summary.totalThisMonth}
          color={Colors.primary}
        />
        <StatBox
          label="Paid"
          value={summary.totalPaid}
          color="#36B37E"
        />
        <StatBox
          label="Overdue"
          value={summary.overdueAmount}
          color="#E46A6A"
          sub={summary.overdueCount ? `${summary.overdueCount} bill(s)` : 'None'}
        />
        <StatBox
          label="Next 7 Days"
          value={summary.upcoming7}
          color="#FFB020"
          sub={summary.upcoming3Count ? `${summary.upcoming3Count} due soon` : null}
        />
      </View>
    </Card>
  );
}

export default memo(BillSummaryBar);
