import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoanCard({ loan }) {

  const outstanding = Number(loan.outstanding_amount || 0);
  const principal = Number(
    loan.loan_amount ||
    loan.principal_amount ||
    outstanding
  );

  const emi = Number(loan.emi_amount || 0);

  const progress =
    principal > 0
      ? Math.min(
          100,
          Math.round(
            ((principal - outstanding) / principal) * 100
          )
        )
      : 0;

  const status = loan.status || 'Active';

  const statusColor =
    status === 'Closed'
      ? '#16A34A'
      : '#2563EB';

  const isLent = (loan.loan_direction || 'BORROWED') === 'LENT';

  const details = [
    { label: 'Principal', value: `₹${principal.toLocaleString('en-IN')}`, show: true, bg: '#F3E8FF', labelColor: '#9333EA', valColor: '#7E22CE' },
    { label: 'Paid', value: `₹${(principal - outstanding).toLocaleString('en-IN')}`, show: true, bg: '#DCFCE7', labelColor: '#16A34A', valColor: '#15803D' },
    { label: 'Tenure', value: `${loan.tenure_months} mo`, show: !!loan.tenure_months, bg: '#FFEDD5', labelColor: '#EA580C', valColor: '#C2410C' },
    { label: isLent ? 'Recovery' : 'EMI', value: `₹${emi.toLocaleString('en-IN')}`, show: emi > 0, bg: '#FCE7F3', labelColor: '#DB2777', valColor: '#BE185D' },
    { label: 'Interest', value: `${loan.interest_rate}%`, show: !!loan.interest_rate, bg: '#DBEAFE', labelColor: '#2563EB', valColor: '#1D4ED8' },
    { label: isLent ? 'Next Date' : 'EMI Date', value: `Day ${loan.emi_day}`, show: !!loan.emi_day, bg: '#FEF9C3', labelColor: '#CA8A04', valColor: '#A16207' },
  ].filter((d) => d.show);

  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.leftHeader}>
          <View style={[styles.iconBox, { backgroundColor: isLent ? '#FEF3C7' : '#DBEAFE' }]}>
            <MaterialCommunityIcons
              name={isLent ? 'hand-coin' : 'bank-outline'}
              size={20}
              color={isLent ? '#D97706' : '#2563EB'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.loanName} numberOfLines={1}>{loan.loan_name}</Text>
            <Text style={styles.lender}>{loan.lender || (isLent ? 'Borrower' : 'Lender')}</Text>
          </View>
        </View>
        <View style={[styles.statusChip, { backgroundColor: status === 'Closed' ? '#DCFCE7' : '#DBEAFE' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
        </View>
      </View>

      {/* Outstanding & Progress */}
      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <Text style={styles.label}>Outstanding Balance</Text>
          <Text style={styles.amount}>₹{outstanding.toLocaleString('en-IN')}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.progressText}>{progress}% Repaid</Text>
        </View>
      </View>

      <View style={styles.progressBg}>
        <View style={[styles.progress, { width: `${progress}%`, backgroundColor: status === 'Closed' ? '#16A34A' : '#3B82F6' }]} />
      </View>

      {/* Colorful Details Pills */}
      <View style={styles.pillsContainer}>
        {details.map((detail) => (
          <View key={detail.label} style={[styles.pill, { backgroundColor: detail.bg }]}>
            <Text style={[styles.pillLabel, { color: detail.labelColor }]}>{detail.label}:</Text>
            <Text style={[styles.pillValue, { color: detail.valColor }]}>{detail.value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({

  card: {
    borderRadius: 22,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  leftHeader: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },

  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  loanName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },

  lender: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
  },

  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },

  statusText: {
    fontWeight: '800',
    fontSize: 10,
    textTransform: 'uppercase',
  },

  label: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },

  amount: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },

  progressBg: {
    marginTop: 8,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
  },

  progress: {
    height: 4,
    borderRadius: 10,
  },

  progressText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },

  pillsContainer: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },

  pillLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginRight: 4,
  },

  pillValue: {
    fontSize: 11,
    fontWeight: '800',
  },

});