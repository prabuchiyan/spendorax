import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import { Colors } from './Theme';

export default function UpcomingEMICard({ loan }) {
  const due = loan.nextEmiDate || loan.loan_start_date || '';
  const isOverdue = loan.isOverdue;

  return (
    <Card style={[styles.card, isOverdue && { borderColor: Colors.danger || '#E46A6A', borderWidth: 1 }]}>
      <Text style={styles.type}>{loan.loan_type || 'Loan'}</Text>
      <Text style={styles.name}>{loan.loan_name}</Text>
      <View style={{ height: 8 }} />
      <Text style={styles.dueLabel}>{isOverdue ? 'Overdue' : 'Due'}</Text>
      <Text style={styles.dueDate}>{due ? new Date(due).toLocaleDateString() : '-'}</Text>
      <Text style={styles.amount}>₹{Number(loan.emi_amount || 0).toLocaleString('en-IN')}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: 200, padding: 14, borderRadius: 14, marginRight: 12 },
  type: { fontSize: 12, color: Colors.muted, fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '800', marginTop: 6 },
  dueLabel: { fontSize: 12, color: Colors.muted, marginTop: 8 },
  dueDate: { fontSize: 14, fontWeight: '800' },
  amount: { fontSize: 16, fontWeight: '900', marginTop: 8 }
});
