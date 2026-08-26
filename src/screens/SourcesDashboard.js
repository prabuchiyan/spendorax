import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { getSources } from '../services/sources';
import { getTransactions } from '../services/transactions';

import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useBalanceVisibility } from '../context/BalanceVisibilityContext';
import { usePageLoader } from '../context/PageLoaderContext';

export default function SourcesDashboard({ navigation }) {
  const [sources, setSources] = useState([]);
  const [tab, setTab] = useState('banks');
  const [loading, setLoading] = useState(true);
  const { show: showPageLoader, hide: hidePageLoader } = usePageLoader();

  const { balanceVisible } = useBalanceVisibility();

  // LOAD
  async function load() {
    setLoading(true);
    showPageLoader();

    try {
      const availableSources = await getSources(true);

      const transactions = await getTransactions(
        1000000,
        'Yes'
      );

      // Calculate transaction balance per source
      const balanceMap = transactions.reduce(
        (acc, txn) => {
          const amount = Number(txn.amount || 0);
          const id = txn.source_id;

          if (!id) {
            return acc;
          }

          if (!acc[id]) {
            acc[id] = 0;
          }

          if (txn.type === 'income') {
            acc[id] += amount;
          } else if (txn.type === 'expense') {
            acc[id] -= amount;
          }

          return acc;
        },
        {}
      );

      // Add initial balance
      const updatedSources = availableSources.map(
        source => {
          const initial =
            Number(source.initial_balance || 0);

          const txnBalance =
            balanceMap[source.id] || 0;

          return {
            ...source,
            balance:
              initial + txnBalance,
          };
        }
      );

      setSources(updatedSources);
    } catch (error) {
      console.error(
        'SourcesDashboard load error:',
        error
      );

      setSources([]);
    } finally {
      setLoading(false);
      hidePageLoader();
    }
  }

  // LOAD ON FOCUS
  useEffect(() => {
    load();

    const unsub =
      navigation.addListener(
        'focus',
        () => {
          load();
        }
      );

    return unsub;
  }, [navigation]);

  // FILTER SOURCES BY TAB
  const filteredSources = useMemo(() => {
    if (tab === 'creditCards') {
      return sources.filter(
        source =>
          String(source.type || '')
            .toLowerCase() === 'credit_card'
      );
    }

    return sources.filter(
      source =>
        String(source.type || '')
          .toLowerCase() !== 'credit_card'
    );
  }, [sources, tab]);

  // TAB TOTAL
  const tabTotal = useMemo(() => {
    return filteredSources.reduce(
      (sum, source) =>
        sum + Number(source.balance || 0),
      0
    );
  }, [filteredSources]);

  // UI
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loaderText}>Loading source balances...</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.background,
      }}
    >

      {/* TAB NAVIGATION */}
      <View
        style={styles.tabContainer}
      >
        {/* BANKS & CASH */}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            setTab('banks')
          }
          style={[
            styles.tab,
            {
              borderBottomWidth:
                tab === 'banks'
                  ? 3
                  : 0,

              borderBottomColor:
                Colors.primary,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="bank-outline"
            size={18}
            color={
              tab === 'banks'
                ? Colors.primary
                : '#666'
            }
            style={{
              marginRight: 6,
            }}
          />

          <Text
            style={[
              styles.tabText,
              {
                color:
                  tab === 'banks'
                    ? Colors.primary
                    : '#666',

                fontWeight:
                  tab === 'banks'
                    ? '700'
                    : '500',
              },
            ]}
          >
            Banks & Others
          </Text>
        </TouchableOpacity>

        {/* CREDIT CARDS */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            setTab('creditCards')
          }
          style={[
            styles.tab,
            {
              borderBottomWidth:
                tab === 'creditCards'
                  ? 3
                  : 0,

              borderBottomColor:
                Colors.primary,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="credit-card-outline"
            size={18}
            color={
              tab === 'creditCards'
                ? Colors.primary
                : '#666'
            }
            style={{
              marginRight: 6,
            }}
          />

          <Text
            style={[
              styles.tabText,
              {
                color:
                  tab === 'creditCards'
                    ? Colors.primary
                    : '#666',

                fontWeight:
                  tab === 'creditCards'
                    ? '700'
                    : '500',
              },
            ]}
          >
            Credit Cards
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryAmount}>
            {balanceVisible ? `₹ ${tabTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '••••••'}
          </Text>
        </Card>

        {filteredSources.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="wallet-outline" size={42} color="#B6BEC8" />
            <Text style={styles.emptyTitle}>No sources found</Text>
            <Text style={styles.emptyText}>Add a source to start tracking balances.</Text>
          </View>
        ) : (
          filteredSources.map((sourceItem) => (
            <TouchableOpacity
              key={sourceItem.id}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('SourcesDetails', {
                sourceId: sourceItem.id,
                sourceName: sourceItem.name,
              })}
              style={styles.sourceCard}
            >
              <View style={styles.sourceHeader}>
                <View style={styles.iconWrap}>
                  <MaterialCommunityIcons
                    name={sourceItem.icon || 'wallet-outline'}
                    size={22}
                    color={sourceItem.color || Colors.primary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.sourceName}>{sourceItem.name}</Text>
                  <Text style={styles.sourceType}>{sourceItem.type || 'Bank'}</Text>
                </View>

                <Text style={styles.balanceText}>
                  {balanceVisible ? `₹ ${Number(sourceItem.balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '••••••'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.md,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.muted,
  },
  content: {
    padding: Spacing.xs,
    paddingBottom: 32,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E6EAF0',
    paddingHorizontal: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
  },
  tabText: {
    fontSize: 14,
  },
  summaryCard: {
    marginTop: 12,
    marginBottom: 12,
    padding: 16,
  },
  summaryLabel: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 6,
  },
  sourceCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EEF3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  sourceType: {
    marginTop: 3,
    fontSize: 12,
    color: Colors.muted,
    textTransform: 'capitalize',
  },
  balanceText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.muted,
  },
});