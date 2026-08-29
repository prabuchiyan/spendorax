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
import { getCreditCards } from '../services/creditCards';
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
  const [creditCards, setCreditCards] = useState([]);

  // LOAD
  async function load() {
    setLoading(true);
    showPageLoader();
    try {
      const availableSources = await getSources(true);
      const availableCreditCards = await getCreditCards(true);
      setCreditCards(availableCreditCards);
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
          const initial = Number(
            source.initial_balance || 0
          );

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
          String(source.type || '').toLowerCase() ===
          'credit_card'
      );
    }
    return sources.filter(
      source =>
        String(source.type || '').toLowerCase() !==
        'credit_card'
    );
  }, [sources, tab]);

  // TAB TOTAL
  const tabTotal = useMemo(() => {
    if (tab === 'creditCards') {
      return filteredSources.reduce(
        (sum, source) => {

          const card =
            creditCards.find(
              item =>
                Number(item.source_id) ===
                Number(source.id)
            );
          return (
            sum +
            Number(
              card?.available_limit || 0
            )
          );
        },
        0
      );
    }

    return filteredSources.reduce(
      (sum, source) =>
        sum + Number(source.balance || 0),
      0
    );
  }, [filteredSources, creditCards, tab]);

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
              tab === 'banks' &&
              styles.activeTab,
            ]}
          >
            <View
              style={[
                styles.tabIcon,
                tab === 'banks' &&
                styles.activeTabIcon,
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
                tab === 'banks' &&
                styles.activeTabText,
              ]}
            >
              Banks & Others
            </Text>
          </TouchableOpacity>

          {/* CREDIT CARDS */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              setTab('creditCards')
            }
            style={[
              styles.tab,
              tab === 'creditCards' &&
              styles.activeTab,
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
                  {tab === 'creditCards'
                    ? 'Available Credit'
                    : 'Available Balance'}
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
                ? 'Credit available across your cards'
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
              No{' '}
              {tab === 'creditCards'
                ? 'credit cards'
                : 'sources'}{' '}
              yet
            </Text>

            <Text style={styles.emptyText}>
              Add a{' '}
              {tab === 'creditCards'
                ? 'credit card'
                : 'source'}{' '}
              to start tracking your balance.
            </Text>

          </View>
        ) : (

          /* SOURCE LIST */
          filteredSources.map(
            sourceItem => {

              const sourceColor =
                sourceItem.color || Colors.primary;

              const sourceBalance =
                Number(sourceItem.balance || 0);

              const isCreditCard =
                tab === 'creditCards';
              // Get the actual credit-card record FIRST
              const creditCard =
                isCreditCard
                  ? creditCards.find(
                    card =>
                      Number(card.source_id) ===
                      Number(sourceItem.id)
                  )
                  : null;
              // Credit-card values come from credit_cards table
              const creditLimit =
                Number(
                  creditCard?.credit_limit || 0
                );
              const outstanding =
                Number(
                  creditCard?.outstanding || 0
                );
              const availableCredit =
                Number(
                  creditCard?.available_limit ??
                  Math.max(
                    0,
                    creditLimit - outstanding
                  )
                );
              return (
                <TouchableOpacity
                  key={sourceItem.id}
                  activeOpacity={0.92}
                  onPress={() =>
                    navigation.navigate(
                      'SourcesDetails',
                      {
                        sourceId:
                          sourceItem.id,
                        sourceName:
                          sourceItem.name,
                      }
                    )
                  }
                  style={
                    isCreditCard
                      ? styles.creditCardBoard
                      : styles.sourceCard
                  }
                >

                  {isCreditCard ? (

                    /* CREDIT CARD BOARD */
                    <View
                      style={[
                        styles.creditCardGradient,
                        {
                          backgroundColor:
                            sourceColor,
                        },
                      ]}
                    >
                      {/* DECORATIVE CIRCLES */}
                      <View
                        style={
                          styles.cardDecorCircleOne
                        }
                      />

                      <View
                        style={
                          styles.cardDecorCircleTwo
                        }
                      />
                      {/* TOP */}
                      <View
                        style={
                          styles.creditCardTop
                        }
                      >
                        <View
                          style={
                            styles.creditCardBrandRow
                          }
                        >
                          {/* CHIP */}
                          <View
                            style={
                              styles.creditCardChip
                            }
                          >
                            <View
                              style={
                                styles.chipLineOne
                              }
                            />
                            <View
                              style={
                                styles.chipLineTwo
                              }
                            />
                            <View
                              style={
                                styles.chipLineThree
                              }
                            />
                          </View>
                          <Text
                            numberOfLines={1}
                            style={
                              styles.creditCardType
                            }
                          >
                            CREDIT CARD
                          </Text>
                        </View>

                        {/* CONTACTLESS */}
                        <MaterialCommunityIcons
                          name="contactless-payment"
                          size={23}
                          color="rgba(255,255,255,0.86)"
                        />

                      </View>

                      {/* CARD INFORMATION */}
                      <View
                        style={
                          styles.creditCardMiddle
                        }
                      >
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={
                            styles.creditCardName
                          }
                        >
                          {sourceItem.name}
                        </Text>

                        <Text style={styles.creditCardNumber}>
                          ••••  ••••  ••••  {creditCard?.last4 || '••••'}
                        </Text>
                      </View>

                      {/* BOTTOM */}
                      <View
                        style={
                          styles.creditCardBottom
                        }
                      >
                        <View
                          style={{
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <Text style={styles.creditCardLabel}>
                            AVAILABLE CREDIT
                          </Text>
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.72}
                            style={styles.creditCardAmount}
                          >
                            {balanceVisible
                              ? `₹ ${availableCredit.toLocaleString('en-IN', {
                                maximumFractionDigits: 2,
                              })}`
                              : '••••••'}
                          </Text>

                          <Text style={styles.creditCardUsedText}>
                            {balanceVisible
                              ? `₹ ${outstanding.toLocaleString('en-IN', {
                                maximumFractionDigits: 2,
                              })} used of ₹ ${creditLimit.toLocaleString('en-IN', {
                                maximumFractionDigits: 2,
                              })}`
                              : '••••••'}
                          </Text>
                        </View>

                        {/* STATUS */}
                        <View
                          style={
                            styles.creditCardStatus
                          }
                        >
                          <View
                            style={[
                              styles.creditStatusDot,
                              {
                                backgroundColor:
                                  sourceBalance < 0
                                    ? '#FFD1D1'
                                    : '#BFF5D6',
                              },
                            ]}
                          />
                          <Text
                            style={
                              styles.creditCardStatusText
                            }
                          >
                            {sourceBalance < 0
                              ? 'ATTENTION'
                              : 'ACTIVE'}
                          </Text>

                        </View>

                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={22}
                          color="rgba(255,255,255,0.82)"
                        />

                      </View>

                    </View>

                  ) : (

                    /* EXISTING BANK / OTHER DESIGN */
                    <>
                      {/* LEFT ACCENT */}
                      <View
                        style={[
                          styles.sourceAccent,
                          {
                            backgroundColor:
                              sourceColor,
                          },
                        ]}
                      />

                      <View
                        style={
                          styles.sourceCardContent
                        }
                      >

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
                        <View
                          style={
                            styles.sourceInfo
                          }
                        >

                          <Text
                            style={
                              styles.sourceName
                            }
                            numberOfLines={1}
                          >
                            {sourceItem.name}
                          </Text>

                          <View
                            style={
                              styles.sourceMeta
                            }
                          >
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

                            <Text
                              style={
                                styles.sourceStatus
                              }
                            >
                              {sourceBalance < 0
                                ? 'Needs attention'
                                : 'Available'}
                            </Text>
                          </View>

                        </View>

                        {/* BALANCE + ARROW */}
                        <View
                          style={
                            styles.sourceRight
                          }
                        >

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

                          <View
                            style={
                              styles.chevronWrap
                            }
                          >
                            <MaterialCommunityIcons
                              name="chevron-right"
                              size={18}
                              color="#A8B0BB"
                            />
                          </View>

                        </View>

                      </View>
                    </>
                  )}

                </TouchableOpacity>
              );
            }
          )
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
  creditCardBoard: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    elevation: 5,
  },
  creditCardGradient: {
    minHeight: 205,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  cardDecorCircleOne: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -65,
    top: -75,
    backgroundColor:
      'rgba(255,255,255,0.10)',
  },
  cardDecorCircleTwo: {
    position: 'absolute',
    width: 125,
    height: 125,
    borderRadius: 63,
    right: -30,
    bottom: -65,
    backgroundColor:
      'rgba(0,0,0,0.08)',
  },
  creditCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditCardBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  creditCardChip: {
    width: 39,
    height: 29,
    borderRadius: 6,
    backgroundColor: '#D8C889',
    marginRight: 10,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  chipLineOne: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 9,
    height: 1,
    backgroundColor:
      'rgba(90,70,20,0.35)',
  },
  chipLineTwo: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor:
      'rgba(90,70,20,0.35)',
  },
  chipLineThree: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor:
      'rgba(90,70,20,0.35)',
  },
  creditCardType: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color:
      'rgba(255,255,255,0.88)',
  },
  creditCardMiddle: {
    marginTop: 20,
  },
  creditCardName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  creditCardNumber: {
    marginTop: 13,
    fontSize: 15,
    fontWeight: '800',
    color:
      'rgba(255,255,255,0.82)',
    letterSpacing: 2.2,
  },
  creditCardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 18,
  },
  creditCardLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    color:
      'rgba(255,255,255,0.68)',
    marginBottom: 3,
  },
  creditCardAmount: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  creditCardStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 7,
    marginBottom: 3,
  },
  creditStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  creditCardStatusText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
    color:
      'rgba(255,255,255,0.82)',
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
  creditCardUsedText: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.68)',
  },
});