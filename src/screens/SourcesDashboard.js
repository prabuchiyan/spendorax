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
          const initial = Number(source.initial_balance || 0);
          const txnBalance = balanceMap[source.id] || 0;
          return {
            ...source,
            balance:
              initial + txnBalance,
          };
        }
      );
      setSources(updatedSources);
    } catch (error) {
      console.error('SourcesDashboard load error:', error);
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
      return sources.filter(source => String(source.type || '').toLowerCase() === 'credit_card');
    }
    return sources.filter(
      source => String(source.type || '').toLowerCase() !== 'credit_card');
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
        <ActivityIndicator
          size="large"
          color={Colors.primary}
        />
        <Text style={styles.loaderText}>
          Loading your balances...
        </Text>
      </View>
    );
  }
  const sourceCount = filteredSources.length;

  return (
    <View style={styles.container}>

      {/* ACCOUNT TYPE SWITCHER */}
      <View style={styles.tabArea}>
        <View style={styles.tabContainer}>

          {/* BANKS & OTHERS */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setTab('banks')}
            style={[
              styles.tab,
              tab === 'banks' && styles.activeTab,
            ]}
          >
            <View
              style={[
                styles.tabIcon,
                tab === 'banks' && styles.activeTabIcon,
              ]}
            >
              <MaterialCommunityIcons
                name="bank-outline"
                size={17}
                color={
                  tab === 'banks'
                    ? Colors.primary
                    : Colors.muted
                }
              />
            </View>

            <Text
              style={[
                styles.tabText,
                tab === 'banks' && styles.activeTabText,
              ]}
            >
              Banks & Others
            </Text>
          </TouchableOpacity>

          {/* CREDIT CARDS */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setTab('creditCards')}
            style={[
              styles.tab,
              tab === 'creditCards' && styles.activeTab,
            ]}
          >
            <View
              style={[
                styles.tabIcon,
                tab === 'creditCards' &&
                styles.activeTabIcon,
              ]}
            >
              <MaterialCommunityIcons
                name="credit-card-outline"
                size={17}
                color={
                  tab === 'creditCards'
                    ? Colors.primary
                    : Colors.muted
                }
              />
            </View>

            <Text
              style={[
                styles.tabText,
                tab === 'creditCards' &&
                styles.activeTabText,
              ]}
            >
              Credit Cards
            </Text>
          </TouchableOpacity>

        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* AVAILABLE BALANCE */}
        <View style={styles.balanceCard}>

          <View style={styles.balanceTopRow}>

            <View style={styles.balanceTitleRow}>
              <View style={styles.balanceIcon}>
                <MaterialCommunityIcons
                  name={
                    tab === 'creditCards'
                      ? 'credit-card-check-outline'
                      : 'wallet-outline'
                  }
                  size={19}
                  color={Colors.primary}
                />
              </View>

              <View>
                <Text style={styles.balanceLabel}>
                  Available Balance
                </Text>

                <Text style={styles.balanceSubLabel}>
                  {sourceCount === 1
                    ? '1 account'
                    : `${sourceCount} accounts`}
                </Text>
              </View>
            </View>

            <View style={styles.balanceBadge}>
              <MaterialCommunityIcons
                name="chart-line"
                size={13}
                color={Colors.primary}
              />

              <Text style={styles.balanceBadgeText}>
                {tab === 'creditCards'
                  ? 'Cards'
                  : 'Sources'}
              </Text>
            </View>

          </View>

          <Text style={styles.summaryAmount}>
            {balanceVisible
              ? `₹ ${tabTotal.toLocaleString(
                'en-IN',
                {
                  maximumFractionDigits: 2,
                }
              )}`
              : '••••••'}
          </Text>

          <View style={styles.balanceFooter}>
            <View style={styles.footerDot} />

            <Text style={styles.footerText}>
              {tab === 'creditCards'
                ? 'Total across your credit cards'
                : 'Total money available across sources'}
            </Text>
          </View>

        </View>

        {/* SECTION HEADER */}
        {filteredSources.length > 0 && (
          <View style={styles.sectionHeader}>

            <View>
              <Text style={styles.sectionTitle}>
                {tab === 'creditCards'
                  ? 'Your Credit Cards'
                  : 'Your Sources'}
              </Text>

              <Text style={styles.sectionSubtitle}>
                Tap an account to view details
              </Text>
            </View>

            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {sourceCount}
              </Text>
            </View>

          </View>
        )}

        {/* EMPTY STATE */}
        {filteredSources.length === 0 ? (
          <View style={styles.emptyState}>

            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons
                name={
                  tab === 'creditCards'
                    ? 'credit-card-plus-outline'
                    : 'wallet-plus-outline'
                }
                size={32}
                color={Colors.primary}
              />
            </View>

            <Text style={styles.emptyTitle}>
              No {tab === 'creditCards'
                ? 'credit cards'
                : 'sources'} yet
            </Text>

            <Text style={styles.emptyText}>
              Add a {tab === 'creditCards'
                ? 'credit card'
                : 'source'} to start tracking
              your balance.
            </Text>

          </View>
        ) : (

          /* SOURCE LIST */
          filteredSources.map((sourceItem) => {

            const sourceColor =
              sourceItem.color || Colors.primary;

            const sourceBalance =
              Number(sourceItem.balance || 0);

            return (
              <TouchableOpacity
                key={sourceItem.id}
                activeOpacity={0.88}
                onPress={() =>
                  navigation.navigate(
                    'SourcesDetails',
                    {
                      sourceId: sourceItem.id,
                      sourceName: sourceItem.name,
                    }
                  )
                }
                style={styles.sourceCard}
              >

                {/* LEFT ACCENT */}
                <View
                  style={[
                    styles.sourceAccent,
                    {
                      backgroundColor: sourceColor,
                    },
                  ]}
                />

                <View style={styles.sourceCardContent}>

                  {/* ICON */}
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor:
                          `${sourceColor}18`,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        sourceItem.icon ||
                        'wallet-outline'
                      }
                      size={22}
                      color={sourceColor}
                    />
                  </View>

                  {/* INFO */}
                  <View style={styles.sourceInfo}>

                    <Text
                      style={styles.sourceName}
                      numberOfLines={1}
                    >
                      {sourceItem.name}
                    </Text>

                    <View style={styles.sourceMeta}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor:
                              sourceBalance < 0
                                ? '#DC2626'
                                : '#22C55E',
                          },
                        ]}
                      />

                      <Text style={styles.sourceStatus}>
                        {sourceBalance < 0
                          ? 'Needs attention'
                          : 'Available'}
                      </Text>
                    </View>

                  </View>

                  {/* BALANCE + ARROW */}
                  <View style={styles.sourceRight}>

                    <Text
                      style={[
                        styles.balanceText,
                        {
                          color:
                            sourceBalance < 0
                              ? '#DC2626'
                              : Colors.text,
                        },
                      ]}
                    >
                      {balanceVisible
                        ? `₹ ${sourceBalance.toLocaleString(
                          'en-IN',
                          {
                            maximumFractionDigits: 2,
                          }
                        )}`
                        : '••••••'}
                    </Text>

                    <View style={styles.chevronWrap}>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={18}
                        color="#A8B0BB"
                      />
                    </View>

                  </View>

                </View>

              </TouchableOpacity>
            );
          })
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 34,
  },
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
  tabArea: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: Colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#EEF1F5',
    borderRadius: 15,
    padding: 4,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 2,
  },
  tabIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  activeTabIcon: {
    backgroundColor: '#EEF3FF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '800',
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 3,
  },
  balanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  balanceIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  balanceSubLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
    color: Colors.muted,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  balanceBadgeText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.muted,
  },
  summaryAmount: {
    marginTop: 17,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: Colors.text,
  },
  balanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  footerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 7,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.muted,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.text,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: Colors.muted,
    fontWeight: '500',
  },
  countBadge: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#EEF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  sourceCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.035,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },
  sourceAccent: {
    position: 'absolute',
    left: 0,
    top: 13,
    bottom: 13,
    width: 3,
    borderRadius: 3,
  },
  sourceCardContent: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingLeft: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sourceInfo: {
    flex: 1,
    minWidth: 0,
  },
  sourceName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  sourceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  sourceTypeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#AAB2BD',
    marginRight: 6,
  },
  sourceType: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.muted,
    textTransform: 'capitalize',
  },
  sourceRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  balanceText: {
    fontSize: 15,
    fontWeight: '900',
  },
  chevronWrap: {
    marginTop: 3,
    width: 20,
    height: 18,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 70,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: '#EEF3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  emptyText: {
    marginTop: 7,
    maxWidth: 260,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: Colors.muted,
  },
});