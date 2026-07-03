import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { getSources } from '../services/sources';
import { getTransactions } from '../services/transactions'; // ✅ added
import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SourcesDashboard({ navigation }) {
  const [sources, setSources] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);

  async function load() {
    const availableSources = await getSources(true);
    const transactions = await getTransactions(1000000, 'Yes');

    // Build balance map using reduce
    const balanceMap = transactions.reduce((acc, txn) => {
      const amt = Number(txn.amount || 0);
      const id = txn.source_id;

      if (!id) return acc;

      if (!acc[id]) acc[id] = 0;

      if (txn.type === 'income') {
        acc[id] += amt;
      } else if (txn.type === 'expense') {
        acc[id] -= amt;
      }

      return acc;
    }, {});

    // Merge with initial balance
    const updatedSources = availableSources.map(s => {
      const initial = Number(s.initial_balance || 0);
      const txnBalance = balanceMap[s.id] || 0;

      return {
        ...s,
        balance: initial + txnBalance
      };
    });

    setSources(updatedSources);

    const total = updatedSources.reduce((sum, s) => sum + s.balance, 0);
    setTotalBalance(total);
  }

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { load(); });
    return unsub;
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Total Balance */}
        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>Net Worth</Text>
          <Text style={styles.heroAmount}>
            ₹ {totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Your Accounts</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Sources')} style={styles.manageButton}>
            <Text style={styles.manageButtonText}>Manage</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {sources.length ? sources.map(item => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('SourcesDetails', {
                sourceId: item.id,
                sourceName: item.name
              })}
            >
              <Card style={styles.sourceCard}>
                <View style={styles.sourceContent}>
                  
                  <View style={[styles.iconWrapper, { backgroundColor: (item.color || Colors.primary) + '15' }]}>
                    <MaterialCommunityIcons 
                      name={item.icon || 'bank'} 
                      size={24} 
                      color={item.color || Colors.primary} 
                    />
                  </View>

                  <View style={styles.infoWrapper}>
                    <Text style={styles.sourceName}>{item.name}</Text>
                    <Text style={styles.sourceType}>Account</Text>
                  </View>

                  <View style={styles.amountWrapper}>
                    <Text style={styles.sourceAmount}>
                      ₹{Number(item.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.muted} />
                  </View>

                </View>
              </Card>
            </TouchableOpacity>
          )) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="wallet-outline" size={48} color={Colors.muted} />
              <Text style={styles.emptyText}>No sources found</Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Sources')} style={styles.addButton}>
          <MaterialCommunityIcons name="plus" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Add New Source</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.s,
  },
  heroSection: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroAmount: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  manageButton: {
    padding: 4,
  },
  manageButtonText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  listContainer: {
    marginBottom: 24,
  },
  sourceCard: {
    marginBottom: 12,
    padding: 0,
    borderRadius: 16,
  },
  sourceContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoWrapper: {
    flex: 1,
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  sourceType: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  amountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginRight: 8,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.muted,
    marginTop: 12,
    fontSize: 16,
  },
});
