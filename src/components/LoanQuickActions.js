import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from './Theme';

const QuickButton = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.iconWrap}><MaterialCommunityIcons name={icon} size={22} color="#fff" /></View>
    <Text style={styles.label}>{label}</Text>
  </TouchableOpacity>
);

export default function LoanQuickActions({ onAdd, onPay, onPrepay, onAll }) {
  return (
    <View style={styles.row}>
      <QuickButton icon="plus" label="+ Loan" onPress={onAdd} />
      <QuickButton icon="currency-inr" label="Pay EMI" onPress={onPay} />
      <QuickButton icon="trend-up" label="Prepay" onPress={onPrepay} />
      <QuickButton icon="format-list-bulleted" label="All Loans" onPress={onAll} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  btn: { flex: 1, height: 52, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 8, elevation: 2 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '700' }
});
