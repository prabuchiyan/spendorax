import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getBillsForTransaction } from '../services/bills';
import { Colors } from './Theme';
import { formatCurrency, formatDueDate, getBillDisplayStatus } from '../services/billUtils';

export default function LinkedBillCard({ transactionId, onPressBill }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!transactionId) { setLoading(false); return; }
    getBillsForTransaction(transactionId)
      .then(setBills)
      .catch(() => setBills([]))
      .finally(() => setLoading(false));
  }, [transactionId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (!bills.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="file-document-outline" size={16} color={Colors.primary} />
        <Text style={styles.headerText}>Linked Bill{bills.length > 1 ? 's' : ''}</Text>
      </View>

      {bills.map(bill => {
        const display = getBillDisplayStatus(bill);
        return (
          <TouchableOpacity
            key={bill.id}
            activeOpacity={onPressBill ? 0.7 : 1}
            onPress={() => onPressBill && onPressBill(bill)}
            style={[styles.billRow, { borderLeftColor: display.color }]}
          >
            {/* Status dot */}
            <View style={[styles.dot, { backgroundColor: display.color }]} />

            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text style={styles.billName} numberOfLines={1}>{bill.name}</Text>
              <Text style={styles.billSub}>
                Due {formatDueDate(bill.due_date)}
                {bill.is_recurring ? `  ·  ${bill.recurrence_type}` : ''}
              </Text>
            </View>

            {/* Amount + status */}
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.billAmount, { color: display.color }]}>
                {formatCurrency(bill.amount)}
              </Text>
              <View style={[styles.badge, { backgroundColor: `${display.color}20` }]}>
                <Text style={[styles.badgeText, { color: display.color }]}>{display.label}</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = {
  container: {
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D6E0FF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    marginLeft: 6,
    fontWeight: '700',
    fontSize: 13,
    color: Colors.primary,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  dot: {
    width: 8, height: 8, borderRadius: 4, marginRight: 10,
  },
  billName: {
    fontWeight: '700', fontSize: 14, color: '#111',
  },
  billSub: {
    fontSize: 12, color: '#777', marginTop: 2,
  },
  billAmount: {
    fontWeight: '800', fontSize: 14,
  },
  badge: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8, marginTop: 3,
  },
  badgeText: {
    fontSize: 11, fontWeight: '600',
  },
};