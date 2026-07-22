import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from './Theme';

const typeIcon = (t) => {
  switch ((t||'').toLowerCase()) {
    case 'home loan': return 'home';
    case 'vehicle loan': return 'car';
    case 'education loan': return 'school';
    case 'business loan': return 'briefcase';
    case 'credit card emi': return 'credit-card';
    default: return 'bank-outline';
  }
};

export default function ActiveLoanCard({ loan }) {
  const pct = useMemo(() => {
    const paid = Number(loan.principal_paid || 0) + Number(loan.interest_paid || 0);
    const total = Number(loan.total_paid || 0) + Number(loan.outstanding_amount || 0);
    if (total <= 0) return 0;
    return Math.min(100, Math.round((paid / total) * 100));
  }, [loan]);

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <MaterialCommunityIcons name={typeIcon(loan.loan_type)} size={36} color={Colors.primary} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{loan.loan_name}</Text>
          <Text style={styles.lender}>{loan.lender}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.outstanding}>₹{Number(loan.outstanding_amount||0).toLocaleString('en-IN')}</Text>
          <Text style={styles.emi}>EMI ₹{Number(loan.emi_amount||0).toLocaleString('en-IN')}</Text>
        </View>
      </View>

      <View style={{ height: 10 }} />
      <View style={styles.progressRow}>
        <View style={styles.progressText}><Text style={{ fontWeight: '800' }}>{pct}%</Text><Text style={{ color: Colors.muted, fontSize: 11, marginLeft: 8 }}>Paid</Text></View>
        <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${pct}%` }]} /></View>
      </View>
      <View style={{ height: 8 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: Colors.muted, fontSize: 12 }}>{loan.remaining_months || 0} months</Text>
        <Text style={{ color: Colors.muted, fontSize: 12 }}>Next EMI {loan.nextEmiDate ? new Date(loan.nextEmiDate).toLocaleDateString() : '-'}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { fontWeight: '800', fontSize: 14 },
  lender: { color: Colors.muted, fontSize: 12, marginTop: 4 },
  outstanding: { fontWeight: '900', fontSize: 16 },
  emi: { color: Colors.muted, fontSize: 12, marginTop: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressText: { flexDirection: 'row', alignItems: 'center' },
  progressBarBg: { flex: 1, height: 8, backgroundColor: '#f1f5f9', borderRadius: 8, marginLeft: 12, overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: '#36B37E', borderRadius: 8 }
});
