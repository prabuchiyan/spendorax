import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from './Card';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from './Theme';

export default function LoanSummaryCard({ title, amount, icon }) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={icon} size={20} color="#fff" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.amount}>₹{Number(amount || 0).toLocaleString('en-IN')}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: '48%', borderRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 12, color: Colors.muted, fontWeight: '600' },
  amount: { fontSize: 18, fontWeight: '800', marginTop: 6 }
});
