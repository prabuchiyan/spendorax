import React, {
  useEffect,
  useState,
  useLayoutEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { getTransactions } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import {
  Colors,
  Spacing,
} from '../components/Theme';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import {
  useFocusEffect,
} from '@react-navigation/native';
import {
  useBalanceVisibility,
} from '../context/BalanceVisibilityContext';

function PageLoader({
  message = 'Loading transactions...',
}) {
  const rotation =
    React.useRef(
      new Animated.Value(0)
    ).current;

  const pulse =
    React.useRef(
      new Animated.Value(0)
    ).current;

  React.useEffect(() => {
    const rotateAnimation =
      Animated.loop(
        Animated.timing(
          rotation,
          {
            toValue: 1,
            duration: 900,
            easing:
              Easing.linear,
            useNativeDriver: true,
          }
        )
      );

    const pulseAnimation =
      Animated.loop(
        Animated.sequence([
          Animated.timing(
            pulse,
            {
              toValue: 1,
              duration: 700,
              easing:
                Easing.inOut(
                  Easing.ease
                ),
              useNativeDriver: true,
            }
          ),

          Animated.timing(
            pulse,
            {
              toValue: 0,
              duration: 700,
              easing:
                Easing.inOut(
                  Easing.ease
                ),
              useNativeDriver: true,
            }
          ),
        ])
      );

    rotateAnimation.start();
    pulseAnimation.start();

    return () => {
      rotateAnimation.stop();
      pulseAnimation.stop();
    };
  }, []);

  const spin =
    rotation.interpolate({
      inputRange: [0, 1],
      outputRange: [
        '0deg',
        '360deg',
      ],
    });

  const scale =
    pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [
        0.94,
        1.06,
      ],
    });

  const opacity =
    pulse.interpolate({
      inputRange: [0, 1],
      outputRange: [
        0.65,
        1,
      ],
    });

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor:
          Colors.background,
      }}
    >
      {/* OUTER LOADER */}
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,

          alignItems: 'center',
          justifyContent: 'center',

          backgroundColor:
            '#FFFFFF',

          borderWidth: 1,
          borderColor:
            '#ECEEF1',

          shadowColor: '#000',

          shadowOffset: {
            width: 0,
            height: 4,
          },

          shadowOpacity: 0.08,
          shadowRadius: 10,

          elevation: 4,
        }}
      >
        {/* ROTATING RING */}
        <Animated.View
          style={{
            position: 'absolute',

            width: 58,
            height: 58,

            borderRadius: 29,

            borderWidth: 3,

            borderColor:
              '#E5E7EB',

            borderTopColor:
              '#5B67F1',

            transform: [
              {
                rotate: spin,
              },
            ],
          }}
        />

        {/* CENTER ICON */}
        <Animated.View
          style={{
            transform: [
              {
                scale,
              },
            ],

            opacity,
          }}
        >
          <MaterialCommunityIcons
            name="wallet-outline"
            size={25}
            color="#5B67F1"
          />
        </Animated.View>
      </View>

      {/* TEXT */}
      <Text
        style={{
          marginTop: 18,

          fontSize: 14,

          fontWeight: '800',

          color:
            Colors.text,
        }}
      >
        {message}
      </Text>

      <Text
        style={{
          marginTop: 5,

          fontSize: 11,

          color:
            Colors.muted,
        }}
      >
        Please wait...
      </Text>
    </View>
  );
}

export default function SourcesDetails({
  route,
  navigation,
}) {
  const {
    sourceId,
    sourceName,
  } = route.params || {};

  const {
    balanceVisible,
  } = useBalanceVisibility();

  const [
    transactions,
    setTransactions,
  ] = useState([]);

  const [
    categoriesMap,
    setCategoriesMap,
  ] = useState({});

  const [
    sourcesMap,
    setSourcesMap,
  ] = useState({});

  const [
    source,
    setSource,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    groupMode,
    setGroupMode,
  ] = useState('daily');

  const groupOptions = [
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
    { key: 'monthly', label: 'Monthly' },
  ];

  // HEADER
  useLayoutEffect(() => {
    navigation.setOptions({
      title:
        sourceName || 'Source',
    });
  }, [
    navigation,
    sourceName,
  ]);

  // SAFE DATE
  const parseDate = useCallback(
    (value) => {
      if (!value) {
        return null;
      }

      const date =
        new Date(value);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return null;
      }

      return date;
    },
    []
  );

  // LOAD DATA
  const loadData = useCallback(
    async () => {
      if (
        sourceId === null ||
        sourceId === undefined
      ) {
        setTransactions([]);
        setSource(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Load all required data
        const [
          txData,
          catData,
          sourceData,
        ] = await Promise.all([
          getTransactions(
            1000000,
            'Yes'
          ),

          getCategories(true),

          getSources(true),
        ]);

        // CATEGORY MAP
        const categoryMap = {};

        if (
          Array.isArray(catData)
        ) {
          catData.forEach(
            (category) => {
              categoryMap[
                category.id
              ] = category;
            }
          );
        }

        // SOURCE MAP
        const sourceMap = {};

        if (
          Array.isArray(sourceData)
        ) {
          sourceData.forEach(
            (src) => {
              sourceMap[
                src.id
              ] = src;
            }
          );
        }

        // SOURCE ID
        const selectedSourceId =
          Number(sourceId);

        // FILTER TRANSACTIONS
        const filteredTransactions =
          (
            Array.isArray(txData)
              ? txData
              : []
          ).filter(
            (transaction) =>
              Number(
                transaction.source_id
              ) ===
              selectedSourceId
          );

        // CURRENT SOURCE
        const currentSource =
          (
            Array.isArray(
              sourceData
            )
              ? sourceData
              : []
          ).find(
            (src) =>
              Number(src.id) ===
              selectedSourceId
          ) || null;

        // UPDATE STATE
        setCategoriesMap(
          categoryMap
        );

        setSourcesMap(
          sourceMap
        );

        setSource(
          currentSource
        );

        setTransactions(
          filteredTransactions
        );
      } catch (error) {
        console.error(
          'SourcesDetails load error:',
          error
        );

        setTransactions([]);
      } finally {
        setLoading(false);
      }
    },
    [sourceId]
  );

  // INITIAL LOAD
  useEffect(() => {
    loadData();
  }, [loadData]);

  // REFRESH WHEN SCREEN FOCUSED
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // EDIT TRANSACTION
  const handleEdit =
    useCallback(
      (item) => {
        navigation.navigate(
          'TransactionAdd',
          {
            isEdit: true,
            transaction: item,
          }
        );
      },
      [navigation]
    );

  // BALANCE
  const totalBalance =
    useMemo(() => {
      const initialBalance =
        Number(
          source?.initial_balance ||
          0
        );

      const transactionBalance =
        transactions.reduce(
          (sum, tx) => {
            const amount =
              Number(
                tx.amount
              ) || 0;

            const type =
              String(
                tx.type || ''
              ).toLowerCase();

            if (
              type === 'expense' ||
              type === 'debit'
            ) {
              return (
                sum - amount
              );
            }

            return (
              sum + amount
            );
          },
          0
        );

      return (
        initialBalance +
        transactionBalance
      );
    }, [
      source,
      transactions,
    ]);

  // GROUP TRANSACTIONS
  const groupedTransactions =
    useMemo(() => {
      const groups = {};

      const getGroupDate = (date) => {
        if (groupMode === 'weekly') {
          const startOfWeek = new Date(date);
          const day = startOfWeek.getDay();
          const diff = (day + 6) % 7;
          startOfWeek.setDate(startOfWeek.getDate() - diff);
          startOfWeek.setHours(0, 0, 0, 0);
          return startOfWeek;
        }

        if (groupMode === 'monthly') {
          const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
          monthStart.setHours(0, 0, 0, 0);
          return monthStart;
        }

        const dayOnly = new Date(date);
        dayOnly.setHours(0, 0, 0, 0);
        return dayOnly;
      };

      const getGroupKey = (date) => {
        const groupDate = getGroupDate(date);

        if (groupMode === 'weekly') {
          return `${groupDate.getFullYear()}-${String(groupDate.getMonth() + 1).padStart(2, '0')}-${String(groupDate.getDate()).padStart(2, '0')}`;
        }

        if (groupMode === 'monthly') {
          return `${groupDate.getFullYear()}-${String(groupDate.getMonth() + 1).padStart(2, '0')}`;
        }

        return `${groupDate.getFullYear()}-${String(groupDate.getMonth() + 1).padStart(2, '0')}-${String(groupDate.getDate()).padStart(2, '0')}`;
      };

      transactions.forEach((item) => {
        const date = parseDate(item.date);

        if (!date) {
          return;
        }

        const key = getGroupKey(date);

        if (!groups[key]) {
          groups[key] = {
            date: getGroupDate(date),
            items: [],
          };
        }

        groups[key].items.push(item);
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      return Object.keys(groups)
        .sort((a, b) => b.localeCompare(a))
        .map((groupKey) => {
          const groupDate = groups[groupKey].date;
          const items = groups[groupKey].items;

          let title;

          if (groupMode === 'daily') {
            if (groupDate.getTime() === today.getTime()) {
              title = 'Today';
            } else if (groupDate.getTime() === yesterday.getTime()) {
              title = 'Yesterday';
            } else {
              title = groupDate.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });
            }
          } else if (groupMode === 'weekly') {
            const weekEnd = new Date(groupDate);
            weekEnd.setDate(weekEnd.getDate() + 6);
            title = `Week of ${groupDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${weekEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
          } else {
            title = groupDate.toLocaleDateString('en-IN', {
              month: 'short',
              year: 'numeric',
            });
          }

          const income = items.reduce((sum, item) => {
            const type = String(item.type || '').toLowerCase();
            if (type === 'income' || type === 'credit') {
              return sum + Number(item.amount || 0);
            }
            return sum;
          }, 0);

          const expense = items.reduce((sum, item) => {
            const type = String(item.type || '').toLowerCase();
            if (type === 'expense' || type === 'debit') {
              return sum + Number(item.amount || 0);
            }
            return sum;
          }, 0);

          return {
            title,
            dateKey: groupKey,
            data: items,
            dailyIncome: income,
            dailyExpense: expense,
          };
        });
    }, [
      transactions,
      parseDate,
      groupMode,
    ]);

  // TRANSACTION CARD
  const renderItem =
    useCallback(
      ({
        item,
        index,
        section,
      }) => {
        const category =
          categoriesMap[
          item.category_id
          ] || {};

        const rawType =
          String(
            item.type || ''
          ).toLowerCase();

        const isTransfer =
          rawType ===
          'transfer' ||
          !!item.transfer_group_id ||
          !!item.is_transfer;

        const isIncome =
          !isTransfer &&
          (
            rawType ===
            'income' ||
            rawType ===
            'credit'
          );

        const type =
          isTransfer
            ? 'transfer'
            : isIncome
              ? 'income'
              : 'expense';

        // COLORS
        const accentColor =
          type === 'income'
            ? '#20A56A'
            : type ===
              'transfer'
              ? '#718096'
              : '#E35D6A';

        const amountColor =
          accentColor;

        const amountPrefix =
          type === 'income'
            ? '+'
            : type ===
              'expense'
              ? '-'
              : '';

        const iconColor =
          typeof category.color ===
            'string' &&
            category.color.length >
            0
            ? category.color
            : accentColor;

        // DATE
        const date =
          parseDate(
            item.date
          );

        const dateText =
          date
            ? date.toLocaleDateString(
              'en-IN',
              {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }
            )
            : 'No date';

        const timeText =
          date
            ? date.toLocaleTimeString(
              'en-IN',
              {
                hour: '2-digit',
                minute: '2-digit',
              }
            )
            : '--:--';

        const isLast =
          index ===
          section.data.length -
          1;

        // CARD
        return (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() =>
              handleEdit(item)
            }
            style={{
              marginBottom:
                isLast
                  ? 12
                  : 8,
            }}
          >
            <View
              style={{
                backgroundColor:
                  '#FFFFFF',

                borderRadius:
                  17,

                overflow:
                  'hidden',

                shadowColor:
                  '#000',

                shadowOffset: {
                  width: 0,
                  height: 3,
                },

                shadowOpacity:
                  0.06,

                shadowRadius:
                  8,

                elevation: 2,
              }}
            >

              {/* LEFT ACCENT */}
              <View
                style={{
                  position:
                    'absolute',

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
                  flexDirection:
                    'row',

                  alignItems:
                    'center',

                  minHeight:
                    82,

                  paddingLeft:
                    15,

                  paddingRight:
                    12,

                  paddingVertical:
                    12,
                }}
              >

                {/* CATEGORY ICON */}
                <View
                  style={{
                    width: 50,
                    height: 50,

                    borderRadius:
                      16,

                    backgroundColor:
                      iconColor,

                    justifyContent:
                      'center',

                    alignItems:
                      'center',

                    marginRight:
                      12,

                    shadowColor:
                      iconColor,

                    shadowOffset: {
                      width: 0,
                      height: 3,
                    },

                    shadowOpacity:
                      0.22,

                    shadowRadius:
                      6,

                    elevation: 3,
                  }}
                >
                  <MaterialCommunityIcons
                    name={
                      category.icon ||
                      (
                        type ===
                          'income'
                          ? 'arrow-down-circle-outline'
                          : type ===
                            'transfer'
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

                    justifyContent:
                      'center',

                    paddingRight:
                      8,
                  }}
                >

                  {/* NOTES */}

                  <Text
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    style={{
                      fontSize:
                        15,

                      lineHeight:
                        19,

                      fontWeight:
                        '800',

                      color:
                        Colors.text,

                      letterSpacing:
                        -0.15,
                    }}
                  >
                    {item.notes ||
                      category.name ||
                      'Untitled'}
                  </Text>

                  {/* CATEGORY */}
                  <View
                    style={{
                      alignSelf: 'flex-start',

                      backgroundColor:
                        `${iconColor}12`,

                      borderRadius: 6,

                      paddingHorizontal: 7,

                      paddingVertical: 4,

                      borderWidth: 1,

                      borderColor:
                        `${iconColor}18`,
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
                </View>

                {/* RIGHT */}
                <View
                  style={{
                    width: 96,

                    flexShrink: 0,

                    alignItems:
                      'flex-end',

                    justifyContent:
                      'center',
                  }}
                >

                  {/* AMOUNT */}
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={
                      0.72
                    }
                    style={{
                      width:
                        '100%',

                      textAlign:
                        'right',

                      fontSize:
                        15,

                      fontWeight:
                        '900',

                      color:
                        amountColor,

                      letterSpacing:
                        -0.35,
                    }}
                  >
                    {balanceVisible
                      ? `${amountPrefix}₹${Number(
                        item.amount ||
                        0
                      ).toLocaleString(
                        'en-IN',
                        {
                          minimumFractionDigits:
                            2,

                          maximumFractionDigits:
                            2,
                        }
                      )}`
                      : '••••••'}
                  </Text>

                  {/* DATE */}
                  <View
                    style={{
                      flexDirection:
                        'row',

                      alignItems:
                        'center',

                      marginTop:
                        5,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="calendar-month-outline"
                      size={11}
                      color="#A3A9B2"
                    />

                    <Text
                      style={{
                        color:
                          '#9299A3',

                        fontSize:
                          10,

                        fontWeight:
                          '700',

                        marginLeft:
                          3,
                      }}
                    >
                      {dateText}
                    </Text>
                  </View>

                  {/* TIME */}
                  <View
                    style={{
                      flexDirection:
                        'row',

                      alignItems:
                        'center',

                      marginTop:
                        3,

                      minHeight:
                        14,
                    }}
                  >
                    {type ===
                      'transfer' ? (
                      <View
                        style={{
                          flexDirection:
                            'row',

                          alignItems:
                            'center',

                          backgroundColor:
                            '#F1F3F5',

                          paddingHorizontal:
                            6,

                          paddingVertical:
                            2,

                          borderRadius:
                            5,
                        }}
                      >
                        <MaterialCommunityIcons
                          name="swap-horizontal"
                          size={10}
                          color="#718096"
                        />

                        <Text
                          style={{
                            fontSize:
                              7.5,

                            fontWeight:
                              '900',

                            color:
                              '#718096',

                            marginLeft:
                              3,

                            letterSpacing:
                              0.2,
                          }}
                        >
                          TRANSFER
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={{
                          flexDirection:
                            'row',

                          alignItems:
                            'center',
                        }}
                      >
                        <MaterialCommunityIcons
                          name="clock-outline"
                          size={10}
                          color="#A3A9B2"
                        />

                        <Text
                          style={{
                            color:
                              '#A3A9B2',

                            fontSize:
                              9,

                            fontWeight:
                              '600',

                            marginLeft:
                              3,
                          }}
                        >
                          {timeText}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      },
      [
        categoriesMap,
        sourcesMap,
        balanceVisible,
        sourceName,
        handleEdit,
        parseDate,
      ]
    );

  // SCREEN
  return (
    <View
      style={
        styles.container
      }
    >

      {/* BALANCE */}
      <View
        style={styles.hero}
      >
        <Text
          style={
            styles.heroLabel
          }
        >
          Available Balance
        </Text>

        <Text
          style={
            styles.heroAmount
          }
        >
          {balanceVisible
            ? `₹ ${totalBalance.toLocaleString(
              'en-IN',
              {
                minimumFractionDigits:
                  2,

                maximumFractionDigits:
                  2,
              }
            )}`
            : '••••••'}
        </Text>
      </View>

      {/* HEADER */}
      <View
        style={
          styles.headerRow
        }
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

      {/* GROUPING MODE CHIPS */}
      <View
        style={
          styles.chipContainer
        }
      >
        {groupOptions.map((option) => (
          <TouchableOpacity
            key={
              option.key
            }
            onPress={() =>
              setGroupMode(option.key)
            }
            style={{
              ...styles.chip,

              backgroundColor:
                groupMode ===
                  option.key
                  ? '#5B67F1'
                  : '#F0F1F3',
            }}
          >
            <Text
              style={{
                ...styles.chipText,

                color:
                  groupMode ===
                    option.key
                    ? '#FFFFFF'
                    : '#6B7280',
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CONTENT */}

      {loading ? (
        <PageLoader
          message="Loading transactions..."
        />
      ) : transactions.length === 0 ? (
        <View
          style={
            styles.center
          }
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
            Transactions for this
            source will appear
            here
          </Text>
        </View>
      ) : (
        <SectionList
          sections={
            groupedTransactions
          }

          keyExtractor={
            (item) =>
              String(item.id)
          }

          renderItem={
            renderItem
          }

          showsVerticalScrollIndicator={
            false
          }

          stickySectionHeadersEnabled={
            false
          }

          contentContainerStyle={{
            paddingBottom:
              40,

            paddingHorizontal:
              1,
          }}

          renderSectionHeader={({
            section,
          }) => (
            <View
              style={{
                paddingTop:
                  9,

                paddingBottom:
                  7,

                backgroundColor:
                  Colors.background,
              }}
            >
              <View
                style={{
                  flexDirection:
                    'row',

                  alignItems:
                    'center',

                  justifyContent:
                    'space-between',
                }}
              >

                {/* DATE */}

                <View>
                  <Text
                    style={{
                      fontSize:
                        13,

                      fontWeight:
                        '900',

                      color:
                        Colors.text,

                      textTransform:
                        'uppercase',

                      letterSpacing:
                        0.4,
                    }}
                  >
                    {
                      section.title
                    }
                  </Text>

                  <Text
                    style={{
                      fontSize:
                        11,

                      color:
                        Colors.muted,

                      marginTop:
                        2,
                    }}
                  >
                    {
                      section
                        .data
                        .length
                    }{' '}
                    {section
                      .data
                      .length ===
                      1
                      ? 'transaction'
                      : 'transactions'}
                  </Text>
                </View>

                {/* DAILY TOTAL */}
                <View
                  style={{
                    flexDirection:
                      'row',

                    alignItems:
                      'center',
                  }}
                >
                  {section.dailyIncome >
                    0 && (
                      <Text
                        style={{
                          color:
                            '#20A56A',

                          fontSize:
                            11,

                          fontWeight:
                            '800',

                          marginRight:
                            8,
                        }}
                      >
                        +₹
                        {section.dailyIncome.toLocaleString(
                          'en-IN',
                          {
                            maximumFractionDigits:
                              0,
                          }
                        )}
                      </Text>
                    )}

                  {section.dailyExpense >
                    0 && (
                      <Text
                        style={{
                          color:
                            '#E35D6A',

                          fontSize:
                            11,

                          fontWeight:
                            '800',
                        }}
                      >
                        -₹
                        {section.dailyExpense.toLocaleString(
                          'en-IN',
                          {
                            maximumFractionDigits:
                              0,
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

// STYLES
const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
      padding: Spacing.xs,
    },
    hero: {
      backgroundColor: '#FFFFFF',
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
      color: Colors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    heroAmount: {
      fontSize: 25,
      fontWeight: '900',
      color: Colors.text,
      marginTop: 7,
      letterSpacing: -0.5,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: Colors.text,
    },
    headerSubtitle: {
      fontSize: 11,
      color: Colors.muted,
      marginTop: 2,
    },
    countBadge: {
      minWidth: 30,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#EEF0F3',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    countText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#6B7280',
    },
    emptyIcon: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: '#EEF0F3',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      color: Colors.text,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 14,
    },
    emptySubtitle: {
      color: Colors.muted,
      fontSize: 12,
      marginTop: 5,
      textAlign: 'center',
      maxWidth: 260,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    chipContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    chip: {
      flex: 1,
      borderRadius: 16,
      paddingVertical: 8,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
      borderWidth: 1,
      borderColor: '#D1D5DB',
    },
    chipText: {
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 18,
    },
  });