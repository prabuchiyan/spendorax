import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from './Theme';

export default function BottomStatsBar({
  navigation,
  totalBalance = 0,
  billsSummary = {},
  totalMonthlySpend = 0
}) {

  return (
    <View style={styles.container}>

      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate('SourcesDashboard')}
      >
        <Text style={styles.label}>Balance</Text>
        <Text style={styles.value}>
          ₹{Number(totalBalance).toLocaleString('en-IN')}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate('Bills')}
      >
        <Text style={[styles.value, { color: '#FF9800' }]}>
          ₹{Number(billsSummary?.totalAmount || 0).toLocaleString('en-IN')}
        </Text>
        <Text style={styles.subLabel}>
          {billsSummary?.count || 0} Bill Due
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate('Reports')}
      >
        <Text style={styles.label}>Spend</Text>
        <Text style={[styles.value, { color: '#E46A6A' }]}>
          ₹{Number(totalMonthlySpend).toLocaleString('en-IN')}
        </Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#eee',
    paddingVertical: 10,
    elevation: 10,

    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: '#eee',
  },
  label: {
    fontSize: 12,
    color: Colors.muted,
  },
  subLabel: {
    fontSize: 11,
    color: Colors.muted,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
});