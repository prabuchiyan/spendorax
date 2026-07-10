import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from './Theme';

export default function RecentActivityItem({ item }) {
  const icon = item.payment_type === 'EMI' ? 'check-circle' : (item.payment_type === 'PREPAYMENT' ? 'cash-fast' : 'bank-transfer');
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <MaterialCommunityIcons name={icon} size={22} color={Colors.primary} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>{item.payment_type} • {item.loan_name || ''}</Text>
          <Text style={styles.meta}>₹{Number(item.payment_amount||0).toLocaleString('en-IN')} • {new Date(item.payment_date).toLocaleDateString()}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: 14, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontWeight: '700' },
  meta: { color: Colors.muted, fontSize: 12, marginTop: 4 }
});
