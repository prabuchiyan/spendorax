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

  const status =
    loan.status || (outstanding > 0 ? 'Active' : 'Closed');

  const statusColor =
    status === 'Closed'
      ? '#16A34A'
      : '#2563EB';

  return (
    <Card style={styles.card}>

      {/* Header */}

      <View style={styles.header}>

        <View style={styles.leftHeader}>

          <View style={styles.iconBox}>
            <MaterialCommunityIcons
              name="bank-outline"
              size={24}
              color="#2563EB"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.loanName}>
              {loan.loan_name}
            </Text>

            <Text style={styles.lender}>
              {loan.lender || 'Lender'}
            </Text>
          </View>

        </View>

        <View
          style={[
            styles.statusChip,
            {
              backgroundColor:
                status === 'Closed'
                  ? '#DCFCE7'
                  : '#DBEAFE',
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color: statusColor,
              },
            ]}
          >
            {status}
          </Text>
        </View>

      </View>

      {/* Outstanding */}

      <View style={{ marginTop: 18 }}>

        <Text style={styles.label}>
          Outstanding
        </Text>

        <Text style={styles.amount}>
          ₹{outstanding.toLocaleString('en-IN')}
        </Text>

      </View>

      {/* Progress */}

      <View style={styles.progressBg}>

        <View
          style={[
            styles.progress,
            {
              width: `${progress}%`,
            },
          ]}
        />

      </View>

      <Text style={styles.progressText}>
        {progress}% Repaid
      </Text>

      {/* Bottom */}

      <View style={styles.bottomRow}>

        <View style={styles.infoBox}>
          <Text style={styles.smallLabel}>
            Monthly EMI
          </Text>

          <Text style={styles.value}>
            ₹{emi.toLocaleString('en-IN')}
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.smallLabel}>
            Interest
          </Text>

          <Text style={styles.value}>
            {loan.interest_rate || '-'}%
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.smallLabel}>
            EMI Day
          </Text>

          <Text style={styles.value}>
            {loan.emi_day || '--'}
          </Text>
        </View>

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
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  loanName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  lender: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },

  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusText: {
    fontWeight: '700',
    fontSize: 12,
  },

  label: {
    color: '#6B7280',
    fontSize: 12,
  },

  amount: {
    marginTop: 5,
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },

  progressBg: {
    marginTop: 14,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    overflow: 'hidden',
  },

  progress: {
    height: 8,
    backgroundColor: '#16A34A',
    borderRadius: 10,
  },

  progressText: {
    marginTop: 6,
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '700',
  },

  bottomRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  infoBox: {
    alignItems: 'center',
    flex: 1,
  },

  smallLabel: {
    fontSize: 11,
    color: '#6B7280',
  },

  value: {
    marginTop: 4,
    fontWeight: '800',
    fontSize: 14,
    color: '#111827',
  },

});