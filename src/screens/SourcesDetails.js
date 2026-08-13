import React, {
  useEffect,
  useState,
  useLayoutEffect,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { getTransactions } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import { Colors, Spacing } from '../components/Theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext';

export default function SourcesDetails({
  route,
  navigation,
}) {
  const { sourceId, sourceName } = route.params;

  const { balanceVisible } =
    useBalanceVisibility();

  const [transactions, setTransactions] =
    useState([]);

  const [categoriesMap, setCategoriesMap] =
    useState({});

  const [loading, setLoading] =
    useState(true);

  const [source, setSource] =
    useState(null);

  const flatListRef = useRef(null);
  const lastOffset = useRef(0);

  // ---------------------------------------------------------
  // HEADER
  // ---------------------------------------------------------

  useLayoutEffect(() => {
    navigation.setOptions({
      title: sourceName,
    });
  }, [sourceName]);

  // ---------------------------------------------------------
  // LOAD TRANSACTIONS
  // ---------------------------------------------------------

  const loadTransactions = async () => {
    try {
      setLoading(true);

      const [
        txData,
        catData,
      ] = await Promise.all([
        getTransactions(
          1000000,
          null,
          sourceId
        ),
        getCategories(true),
      ]);

      const cmap = {};

      catData.forEach(c => {
        cmap[c.id] = c;
      });

      setCategoriesMap(cmap);
      setTransactions(txData);

      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({
          offset: lastOffset.current,
          animated: false,
        });
      });
    } catch (error) {
      console.error(
        'Error loading transactions:',
        error
      );
    } finally {
      setLoading(false);
    }
  };

  async function load() {
    await loadTransactions();

    if (sourceId) {
      const src =
        await getSources(true);

      setSource(
        src.find(
          s => s.id === sourceId
        ) || null
      );
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ---------------------------------------------------------
  // REFRESH WHEN SCREEN FOCUSED
  // ---------------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [])
  );

  // ---------------------------------------------------------
  // EDIT
  // ---------------------------------------------------------

  const handleEdit = item => {
    navigation.navigate(
      'TransactionAdd',
      {
        isEdit: true,
        transaction: item,
      }
    );
  };

  // ---------------------------------------------------------
  // DATE
  // ---------------------------------------------------------

  const formatDate = dateString => {
    if (!dateString) {
      return 'No date';
    }

    const d = new Date(dateString);

    return d.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  };

  // ---------------------------------------------------------
  // BALANCE
  // ---------------------------------------------------------

  const totalBalance =
    Number(
      source?.initial_balance || 0
    ) +
    transactions.reduce(
      (sum, tx) => {
        const amount =
          Number(tx.amount) || 0;

        const type =
          String(
            tx.type || ''
          ).toLowerCase();

        if (
          type === 'expense' ||
          type === 'debit'
        ) {
          return sum - amount;
        }

        return sum + amount;
      },
      0
    );

  // =========================================================
  // GROUP TRANSACTIONS BY DATE
  // =========================================================

  const groupedTransactions = React.useMemo(() => {
    const groups = {};

    const getDateKey = (dateValue) => {
      const date = new Date(dateValue);

      return `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;
    };

    transactions.forEach(item => {
      const key = getDateKey(item.date);

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(item);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(
      yesterday.getDate() - 1
    );

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(dateKey => {
        const [year, month, day] =
          dateKey.split('-').map(Number);

        const date = new Date(
          year,
          month - 1,
          day
        );

        date.setHours(0, 0, 0, 0);

        let title;

        if (
          date.getTime() ===
          today.getTime()
        ) {
          title = 'Today';
        } else if (
          date.getTime() ===
          yesterday.getTime()
        ) {
          title = 'Yesterday';
        } else {
          title = date.toLocaleDateString(
            'en-IN',
            {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }
          );
        }

        const dailyExpense =
          groups[dateKey].reduce(
            (sum, item) => {
              const type =
                String(
                  item.type || ''
                ).toLowerCase();

              if (
                type === 'expense' ||
                type === 'debit'
              ) {
                return (
                  sum +
                  Number(item.amount || 0)
                );
              }

              return sum;
            },
            0
          );

        const dailyIncome =
          groups[dateKey].reduce(
            (sum, item) => {
              const type =
                String(
                  item.type || ''
                ).toLowerCase();

              if (
                type === 'income' ||
                type === 'credit'
              ) {
                return (
                  sum +
                  Number(item.amount || 0)
                );
              }

              return sum;
            },
            0
          );

        return {
          title,
          dateKey,
          data: groups[dateKey],
          dailyExpense,
          dailyIncome,
        };
      });
  }, [transactions]);

  // ---------------------------------------------------------
  // TRANSACTION TYPE
  // ---------------------------------------------------------

  const getTransactionType = item => {
    const type =
      String(
        item.type || ''
      ).toLowerCase();

    if (
      type === 'transfer' ||
      item.transfer_group_id ||
      item.is_transfer
    ) {
      return 'transfer';
    }

    if (type === 'income') {
      return 'income';
    }

    return 'expense';
  };

  // ---------------------------------------------------------
  // TRANSACTION CARD
  // ---------------------------------------------------------

  const renderItem = ({
    item,
    index,
    section,
  }) => {
    const category =
      categoriesMap[
      item.category_id
      ] || {};

    const type =
      getTransactionType(item);

    const amountColor =
      type === 'income'
        ? '#20A56A'
        : type === 'transfer'
          ? '#718096'
          : '#E35D6A';

    const amountPrefix =
      type === 'income'
        ? '+'
        : type === 'expense'
          ? '-'
          : '';

    const accentColor =
      type === 'income'
        ? '#20A56A'
        : type === 'transfer'
          ? '#718096'
          : '#E35D6A';

    const iconColor =
      category.color ||
      accentColor;

    const transactionDate =
      new Date(item.date);

    const dateText =
      transactionDate.toLocaleDateString(
        'en-IN',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }
      );

    const timeText =
      transactionDate.toLocaleTimeString(
        'en-IN',
        {
          hour: '2-digit',
          minute: '2-digit',
        }
      );

    const isLast =
      index ===
      section.data.length - 1;

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() =>
          handleEdit(item)
        }
        style={{
          marginBottom:
            isLast ? 12 : 8,
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 17,
            overflow: 'hidden',

            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 3,
            },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >

          {/* LEFT ACCENT */}

          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              backgroundColor:
                accentColor,
            }}
          />

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',

              minHeight: 82,

              paddingLeft: 15,
              paddingRight: 12,
              paddingVertical: 12,
            }}
          >

            {/* CATEGORY ICON */}

            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 16,

                backgroundColor:
                  iconColor,

                justifyContent: 'center',
                alignItems: 'center',

                marginRight: 12,

                shadowColor:
                  iconColor,

                shadowOffset: {
                  width: 0,
                  height: 3,
                },

                shadowOpacity: 0.22,
                shadowRadius: 6,
                elevation: 3,
              }}
            >
              <MaterialCommunityIcons
                name={
                  category.icon ||
                  (
                    type === 'income'
                      ? 'arrow-down-circle-outline'
                      : type === 'transfer'
                        ? 'swap-horizontal'
                        : 'arrow-up-circle-outline'
                  )
                }
                size={23}
                color="#FFFFFF"
              />
            </View>

            {/* DETAILS */}

            <View
              style={{
                flex: 1,
                minWidth: 0,
                justifyContent: 'center',
                paddingRight: 8,
              }}
            >

              {/* NOTES */}

              <Text
                numberOfLines={2}
                ellipsizeMode="tail"
                style={{
                  fontSize: 15,
                  lineHeight: 19,
                  fontWeight: '800',
                  color: Colors.text,
                  letterSpacing: -0.15,
                }}
              >
                {item.notes ||
                  category.name ||
                  'Untitled'}
              </Text>

              {/* CATEGORY */}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 6,
                  minWidth: 0,
                }}
              >
                <View
                  style={{
                    flexShrink: 1,
                    maxWidth: '75%',

                    backgroundColor:
                      iconColor + '12',

                    borderRadius: 6,

                    paddingHorizontal: 7,
                    paddingVertical: 4,

                    borderWidth: 1,
                    borderColor:
                      iconColor + '18',
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      color: iconColor,
                      fontSize: 11,
                      lineHeight: 13,
                      fontWeight: '800',
                    }}
                  >
                    {category.name ||
                      'Uncategorized'}
                  </Text>
                </View>

                {type === 'transfer' && (
                  <>
                    <View
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor:
                          '#C7CBD1',
                        marginHorizontal: 6,
                      }}
                    />

                    <Text
                      style={{
                        color: '#9299A3',
                        fontSize: 10,
                        fontWeight: '600',
                      }}
                    >
                      Transfer
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* RIGHT COLUMN */}

            <View
              style={{
                width: 96,
                flexShrink: 0,
                alignItems: 'flex-end',
                justifyContent: 'center',
              }}
            >

              {/* AMOUNT */}

              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                style={{
                  width: '100%',
                  textAlign: 'right',
                  fontSize: 15,
                  fontWeight: '900',
                  color: amountColor,
                  letterSpacing: -0.35,
                }}
              >
                {balanceVisible
                  ? `${amountPrefix}₹${Number(
                    item.amount || 0
                  ).toLocaleString(
                    'en-IN',
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}`
                  : '••••••'}
              </Text>

              {/* DATE */}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 5,
                }}
              >
                <MaterialCommunityIcons
                  name="calendar-month-outline"
                  size={11}
                  color="#A3A9B2"
                />

                <Text
                  style={{
                    color: '#9299A3',
                    fontSize: 10,
                    fontWeight: '700',
                    marginLeft: 3,
                  }}
                >
                  {dateText}
                </Text>
              </View>

              {/* TIME */}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 3,
                }}
              >
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={10}
                  color="#A3A9B2"
                />

                <Text
                  style={{
                    color: '#A3A9B2',
                    fontSize: 9,
                    fontWeight: '600',
                    marginLeft: 3,
                  }}
                >
                  {timeText}
                </Text>
              </View>

            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ---------------------------------------------------------
  // SCREEN
  // ---------------------------------------------------------

  return (
    <View
      style={styles.container}
    >

      {/* ================================================ */}
      {/* BALANCE HERO */}
      {/* ================================================ */}

      <View
        style={styles.hero}
      >
        <Text
          style={styles.heroLabel}
        >
          Available Balance
        </Text>

        <Text
          style={styles.heroAmount}
        >
          {balanceVisible
            ? `₹ ${totalBalance.toLocaleString(
              'en-IN',
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`
            : '••••••'}
        </Text>
      </View>

      {/* ================================================ */}
      {/* SECTION HEADER */}
      {/* ================================================ */}

      <View
        style={styles.headerRow}
      >
        <View>
          <Text
            style={
              styles.headerTitle
            }
          >
            Recent Activity
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            Transactions from this source
          </Text>
        </View>

        <View
          style={
            styles.countBadge
          }
        >
          <Text
            style={
              styles.countText
            }
          >
            {transactions.length}
          </Text>
        </View>
      </View>

      {/* ================================================ */}
      {/* CONTENT */}
      {/* ================================================ */}

      {loading ? (
        <View
          style={styles.center}
        >
          <Text
            style={{
              color:
                Colors.muted,
            }}
          >
            Loading...
          </Text>
        </View>
      ) : transactions.length === 0 ? (
        <View
          style={styles.center}
        >
          <View
            style={
              styles.emptyIcon
            }
          >
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={36}
              color="#AEB4BC"
            />
          </View>

          <Text
            style={
              styles.emptyTitle
            }
          >
            No transactions found
          </Text>

          <Text
            style={
              styles.emptySubtitle
            }
          >
            Transactions for this source
            will appear here
          </Text>
        </View>
      ) : (
        <SectionList
          ref={flatListRef}
          sections={groupedTransactions}
          keyExtractor={(item) =>
            item.id.toString()
          }
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}

          contentContainerStyle={{
            paddingBottom: 40,
            paddingHorizontal: 1,
            flexGrow: 1,
          }}

          onScroll={(e) => {
            lastOffset.current =
              e.nativeEvent.contentOffset.y;
          }}

          scrollEventThrottle={16}

          renderSectionHeader={({
            section,
          }) => (
            <View
              style={{
                paddingTop: 9,
                paddingBottom: 7,
                backgroundColor:
                  Colors.background,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent:
                    'space-between',
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '900',
                      color: Colors.text,
                      textTransform:
                        'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    {section.title}
                  </Text>

                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.muted,
                      marginTop: 2,
                    }}
                  >
                    {section.data.length}{' '}
                    {section.data.length === 1
                      ? 'transaction'
                      : 'transactions'}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  {section.dailyIncome > 0 && (
                    <Text
                      style={{
                        color: '#20A56A',
                        fontSize: 11,
                        fontWeight: '800',
                        marginRight: 8,
                      }}
                    >
                      +₹
                      {section.dailyIncome.toLocaleString(
                        'en-IN',
                        {
                          maximumFractionDigits: 0,
                        }
                      )}
                    </Text>
                  )}

                  {section.dailyExpense > 0 && (
                    <Text
                      style={{
                        color: '#E35D6A',
                        fontSize: 11,
                        fontWeight: '800',
                      }}
                    >
                      -₹
                      {section.dailyExpense.toLocaleString(
                        'en-IN',
                        {
                          maximumFractionDigits: 0,
                        }
                      )}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        Colors.background,
      padding: Spacing.xs,
    },

    hero: {
      backgroundColor:
        '#FFFFFF',

      borderRadius: 20,

      paddingVertical: 15,
      paddingHorizontal: 14,

      alignItems: 'center',

      marginBottom: 13,

      borderWidth: 1,
      borderColor: '#F0F1F3',

      shadowColor: '#000',

      shadowOffset: {
        width: 0,
        height: 3,
      },

      shadowOpacity: 0.05,

      shadowRadius: 8,

      elevation: 2,
    },

    heroLabel: {
      fontSize: 12,

      fontWeight: '800',

      color:
        Colors.muted,

      textTransform:
        'uppercase',

      letterSpacing: 0.5,
    },

    heroAmount: {
      fontSize: 25,

      fontWeight: '900',

      color:
        Colors.text,

      marginTop: 7,

      letterSpacing: -0.5,
    },

    headerRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom: 10,

      paddingHorizontal: 2,
    },

    headerTitle: {
      fontSize: 17,

      fontWeight: '800',

      color:
        Colors.text,
    },

    headerSubtitle: {
      fontSize: 11,

      color:
        Colors.muted,

      marginTop: 2,
    },

    countBadge: {
      minWidth: 30,

      height: 28,

      borderRadius: 14,

      backgroundColor:
        '#EEF0F3',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal: 8,
    },

    countText: {
      fontSize: 11,

      fontWeight: '800',

      color:
        '#6B7280',
    },

    emptyIcon: {
      width: 76,

      height: 76,

      borderRadius: 38,

      backgroundColor:
        '#EEF0F3',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyTitle: {
      color:
        Colors.text,

      fontSize: 15,

      fontWeight: '700',

      marginTop: 14,
    },

    emptySubtitle: {
      color:
        Colors.muted,

      fontSize: 12,

      marginTop: 5,

      textAlign:
        'center',
    },

    center: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingVertical: 60,
    },
  });