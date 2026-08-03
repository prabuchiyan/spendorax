import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllCreditCardStatements } from '../services/creditCards';
import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).slice(0, 10));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN');
}

function formatAmount(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function CreditCardStatementsScreen({ navigation }) {
  const [statements, setStatements] = useState([]);

  const load = async () => {
    const items = await getAllCreditCardStatements();
    setStatements(items);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const totalDue = statements.reduce((sum, statement) => sum + Number(statement.closing_balance || 0), 0);
  const totalMinimum = statements.reduce((sum, statement) => sum + Number(statement.minimum_due || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Statements</Text>
          <Text style={styles.summaryValue}>{statements.length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Due</Text>
          <Text style={styles.summaryValue}>{formatAmount(totalDue)}</Text>
        </View>
      </View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Minimum Due</Text>
          <Text style={styles.summaryValue}>{formatAmount(totalMinimum)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Cards Covered</Text>
          <Text style={styles.summaryValue}>{new Set(statements.map(s => s.card_name || 'Credit Card')).size}</Text>
        </View>
      </View>

      <FlatList
        data={statements}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: Spacing.s, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="file-document-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No generated statements yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const rowContent = (
            <View style={styles.statementRow}>
              <View style={styles.statementLeft}>
                <Text style={styles.cardName}>{item.card_name || 'Credit Card'}</Text>
                <Text style={styles.statementDate}>Statement: {formatDate(item.statement_date)}</Text>
                <Text style={styles.statementPeriod}>Period {formatDate(item.statement_start)} – {formatDate(item.statement_end)}</Text>
                <Text style={styles.statementMeta}>Due {formatDate(item.due_date)} · Balance {formatAmount(item.closing_balance)} · Min {formatAmount(item.minimum_due)}</Text>
                <View style={styles.rowFooter}>
                  <Text style={styles.statusPill}>{(item.status || 'generated').toString().toUpperCase()}</Text>
                  {item.bill_id ? <Text style={styles.billLink}>Bill available</Text> : <Text style={styles.billLink}>No bill created</Text>}
                </View>
              </View>
              <MaterialCommunityIcons name="credit-card-outline" size={28} color={item.card_color || Colors.primary} />
            </View>
          );

          if (item.bill_id) {
            return (
              <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('BillDetail', { id: item.bill_id })}>
                <Card style={styles.statementCard}>{rowContent}</Card>
              </TouchableOpacity>
            );
          }

          return <Card style={styles.statementCard}>{rowContent}</Card>;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  summaryRow: {
    flexDirection: 'row',
    padding: Spacing.s,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginRight: 10,
    elevation: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  statementCard: {
    marginBottom: Spacing.s,
  },
  statementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statementLeft: {
    flex: 1,
    paddingRight: 12,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  statementDate: {
    color: Colors.muted,
    fontSize: 13,
    marginBottom: 2,
  },
  statementPeriod: {
    color: Colors.muted,
    fontSize: 13,
    marginBottom: 4,
  },
  statementMeta: {
    color: Colors.text,
    fontSize: 13,
    marginBottom: 8,
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusPill: {
    backgroundColor: '#EFF6FF',
    color: Colors.primary,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: '700',
    marginRight: 10,
  },
  billLink: {
    color: Colors.muted,
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: Colors.muted,
    marginTop: 10,
    fontSize: 14,
  },
});
