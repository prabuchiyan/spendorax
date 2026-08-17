import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { getSources } from '../services/sources';
import { getTransactions } from '../services/transactions';

import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useBalanceVisibility } from '../context/BalanceVisibilityContext';

export default function SourcesDashboard({ navigation }) {
  const [sources, setSources] = useState([]);
  const [tab, setTab] = useState('banks');

  const { balanceVisible } = useBalanceVisibility();

  // =========================================================
  // LOAD
  // =========================================================

  async function load() {
    try {
      const availableSources = await getSources(true);

      const transactions = await getTransactions(
        1000000,
        'Yes'
      );

      // -----------------------------------------------------
      // Calculate transaction balance per source
      // -----------------------------------------------------

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

      // -----------------------------------------------------
      // Add initial balance
      // -----------------------------------------------------

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
    }
  }

  // =========================================================
  // LOAD ON FOCUS
  // =========================================================

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

  // =========================================================
  // FILTER SOURCES BY TAB
  // =========================================================

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

  // =========================================================
  // TAB TOTAL
  // =========================================================

  const tabTotal = useMemo(() => {
    return filteredSources.reduce(
      (sum, source) =>
        sum + Number(source.balance || 0),
      0
    );
  }, [filteredSources]);

  // =========================================================
  // UI
  // =========================================================

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.background,
      }}
    >

      {/* =====================================================
          TAB NAVIGATION
         ===================================================== */}

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

      {/* =====================================================
          CONTENT
         ===================================================== */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.container
        }
      >

        {/* ===================================================
            TOTAL
           =================================================== */}

        <View
          style={[
            styles.heroSection,
            {
              backgroundColor:
                tab === 'creditCards'
                  ? '#5965D8'
                  : Colors.primary,
            },
          ]}
        >
          <Text
            style={styles.heroLabel}
          >
            {tab === 'creditCards'
              ? 'Credit Card Outstanding'
              : 'Total Balance'}
          </Text>

          <Text
            style={styles.heroAmount}
          >
            {balanceVisible
              ? `₹ ${tabTotal.toLocaleString(
                'en-IN',
                {
                  minimumFractionDigits: 2,
                }
              )}`
              : '••••••'}
          </Text>

          <Text
            style={styles.heroSubtext}
          >
            {filteredSources.length}{' '}
            {filteredSources.length === 1
              ? 'account'
              : 'accounts'}
          </Text>
        </View>

        {/* ===================================================
            HEADER
           =================================================== */}

        <View
          style={styles.headerRow}
        >
          <Text
            style={styles.sectionTitle}
          >
            {tab === 'creditCards'
              ? 'Your Credit Cards'
              : 'Your Accounts'}
          </Text>

          <TouchableOpacity
            onPress={() =>
              navigation.navigate(
                'Sources'
              )
            }
            style={
              styles.manageButton
            }
          >
            <Text
              style={
                styles.manageButtonText
              }
            >
              Manage
            </Text>
          </TouchableOpacity>
        </View>

        {/* ===================================================
            SOURCE LIST
           =================================================== */}

        <View
          style={styles.listContainer}
        >
          {filteredSources.length > 0 ? (
            filteredSources.map(
              item => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate(
                      'SourcesDetails',
                      {
                        sourceId:
                          item.id,

                        sourceName:
                          item.name,
                      }
                    )
                  }
                >
                  <Card
                    style={
                      styles.sourceCard
                    }
                  >
                    <View
                      style={
                        styles.sourceContent
                      }
                    >

                      {/* ICON */}

                      <View
                        style={[
                          styles.iconWrapper,
                          {
                            backgroundColor:
                              (
                                item.color ||
                                Colors.primary
                              ) + '15',
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={
                            item.icon ||
                            (
                              tab ===
                                'creditCards'
                                ? 'credit-card-outline'
                                : 'bank'
                            )
                          }
                          size={24}
                          color={
                            item.color ||
                            Colors.primary
                          }
                        />
                      </View>

                      {/* NAME */}

                      <View
                        style={
                          styles.infoWrapper
                        }
                      >
                        <Text
                          numberOfLines={1}
                          style={
                            styles.sourceName
                          }
                        >
                          {item.name}
                        </Text>

                        <Text
                          style={
                            styles.sourceType
                          }
                        >
                          {tab ===
                            'creditCards'
                            ? 'Credit Card'
                            : 'Account'}
                        </Text>
                      </View>

                      {/* BALANCE */}

                      <View
                        style={
                          styles.amountWrapper
                        }
                      >
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                          style={[
                            styles.sourceAmount,
                            {
                              color:
                                tab ===
                                  'creditCards'
                                  ? '#D95D6A'
                                  : Colors.text,
                            },
                          ]}
                        >
                          {balanceVisible
                            ? `₹${Number(
                              item.balance ||
                              0
                            ).toLocaleString(
                              'en-IN',
                              {
                                minimumFractionDigits: 2,
                              }
                            )}`
                            : '••••••'}
                        </Text>

                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={20}
                          color={
                            Colors.muted
                          }
                        />
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              )
            )
          ) : (
            <View
              style={
                styles.emptyState
              }
            >
              <MaterialCommunityIcons
                name={
                  tab ===
                    'creditCards'
                    ? 'credit-card-off-outline'
                    : 'wallet-outline'
                }
                size={48}
                color={
                  Colors.muted
                }
              />

              <Text
                style={
                  styles.emptyText
                }
              >
                {tab ===
                  'creditCards'
                  ? 'No credit cards found'
                  : 'No banks or cash accounts found'}
              </Text>

              <Text
                style={
                  styles.emptySubtext
                }
              >
                Add an account from
                Manage
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({

    container: {
      padding:
        Spacing.s,

      paddingBottom:
        30,
    },

    // --------------------------------------------------------
    // TABS
    // --------------------------------------------------------

    tabContainer: {
      flexDirection:
        'row',

      backgroundColor:
        '#F5F5F5',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#E5E5E5',
    },

    tab: {
      flex: 1,

      paddingVertical:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',

      flexDirection:
        'row',
    },

    tabText: {
      fontSize:
        14,
    },

    // --------------------------------------------------------
    // HERO
    // --------------------------------------------------------

    heroSection: {
      borderRadius:
        20,

      padding:
        14,

      marginBottom:
        14,

      alignItems:
        'center',

      elevation:
        4,

      shadowOffset: {
        width: 0,
        height: 4,
      },

      shadowOpacity:
        0.25,

      shadowRadius:
        8,
    },

    heroLabel: {
      color:
        'rgba(255,255,255,0.82)',

      fontSize:
        14,

      fontWeight:
        '600',

      textTransform:
        'uppercase',

      letterSpacing:
        1,
    },

    heroAmount: {
      color:
        '#fff',

      fontSize:
        24,

      fontWeight:
        '800',

      marginTop:
        8,
    },

    heroSubtext: {
      color:
        'rgba(255,255,255,0.7)',

      fontSize:
        12,

      marginTop:
        5,

      fontWeight:
        '600',
    },

    // --------------------------------------------------------
    // HEADER
    // --------------------------------------------------------

    headerRow: {
      flexDirection:
        'row',

      justifyContent:
        'space-between',

      alignItems:
        'center',

      marginBottom:
        16,

      paddingHorizontal:
        4,
    },

    sectionTitle: {
      fontSize:
        18,

      fontWeight:
        '700',

      color:
        Colors.text,
    },

    manageButton: {
      padding:
        4,
    },

    manageButtonText: {
      color:
        Colors.primary,

      fontWeight:
        '600',
    },

    // --------------------------------------------------------
    // LIST
    // --------------------------------------------------------

    listContainer: {
      marginBottom:
        24,
    },

    sourceCard: {
      marginBottom:
        12,

      padding:
        0,

      borderRadius:
        16,
    },

    sourceContent: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    iconWrapper: {
      width:
        48,

      height:
        48,

      borderRadius:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        16,
    },

    infoWrapper: {
      flex:
        1,

      minWidth:
        0,
    },

    sourceName: {
      fontSize:
        16,

      fontWeight:
        '700',

      color:
        Colors.text,
    },

    sourceType: {
      fontSize:
        12,

      color:
        Colors.muted,

      marginTop:
        2,
    },

    amountWrapper: {
      flexDirection:
        'row',

      alignItems:
        'center',

      maxWidth:
        '45%',
    },

    sourceAmount: {
      fontSize:
        16,

      fontWeight:
        '700',

      marginRight:
        8,

      flexShrink:
        1,
    },

    // --------------------------------------------------------
    // EMPTY
    // --------------------------------------------------------

    emptyState: {
      alignItems:
        'center',

      justifyContent:
        'center',

      paddingVertical:
        50,
    },

    emptyText: {
      color:
        Colors.muted,

      marginTop:
        12,

      fontSize:
        16,

      fontWeight:
        '600',

      textAlign:
        'center',
    },

    emptySubtext: {
      color:
        '#AAA',

      marginTop:
        5,

      fontSize:
        12,

      textAlign:
        'center',
    },
  });