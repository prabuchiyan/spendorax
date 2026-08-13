import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { getTransactions } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing } from '../components/Theme';
import FAB from '../components/FAB';
import { useFocusEffect } from '@react-navigation/native';

export default function TransactionsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  async function load() {
    const t = await getTransactions(1000000, 'Yes');
    setItems(t);

    const cats = await getCategories(true);
    setCategories(cats);

    const src = await getSources(true);
    setSources(src);
  }

  useEffect(() => {
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const handleEdit = (item) => {
    navigation.navigate('TransactionAdd', {
      isEdit: true,
      transaction: item,
    });
  };

  // ---------------------------------------------------------
  // FILTER TRANSACTIONS
  // ---------------------------------------------------------

  const filteredItems = useMemo(() => {
    let result = items;

    // Type filter
    if (activeFilter !== 'all') {
      result = result.filter(item => {
        const type = String(item.type || '').toLowerCase();

        if (activeFilter === 'expense') {
          return type === 'expense';
        }

        if (activeFilter === 'income') {
          return type === 'income';
        }

        if (activeFilter === 'transfer') {
          return (
            type === 'transfer' ||
            item.transfer_group_id ||
            item.is_transfer
          );
        }

        return true;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();

      result = result.filter(item => {
        const category =
          categories.find(x => x.id === item.category_id)?.name || '';

        const source =
          sources.find(x => x.id === item.source_id)?.name || '';

        return (
          (item.notes || '').toLowerCase().includes(q) ||
          String(item.amount || '').includes(q) ||
          category.toLowerCase().includes(q) ||
          source.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [
    items,
    searchQuery,
    activeFilter,
    categories,
    sources,
  ]);

  // ---------------------------------------------------------
  // GROUP BY DATE
  // ---------------------------------------------------------

  const groupedTransactions = useMemo(() => {
    const groups = {};

    const getDateKey = (dateValue) => {
      const date = new Date(dateValue);

      return `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    filteredItems.forEach(item => {
      const key = getDateKey(item.date);

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(item);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(dateKey => {
        const [year, month, day] = dateKey
          .split('-')
          .map(Number);

        const date = new Date(year, month - 1, day);
        date.setHours(0, 0, 0, 0);

        let title;

        if (date.getTime() === today.getTime()) {
          title = 'Today';
        } else if (date.getTime() === yesterday.getTime()) {
          title = 'Yesterday';
        } else {
          title = date.toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        }

        const dailyExpense = groups[dateKey].reduce(
          (sum, item) => {
            return String(item.type || '').toLowerCase() === 'expense'
              ? sum + Number(item.amount || 0)
              : sum;
          },
          0
        );

        const dailyIncome = groups[dateKey].reduce(
          (sum, item) => {
            return String(item.type || '').toLowerCase() === 'income'
              ? sum + Number(item.amount || 0)
              : sum;
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
  }, [filteredItems]);

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------

  const getTransactionType = (item) => {
    const type = String(item.type || '').toLowerCase();

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

  const getAmountColor = (type) => {
    if (type === 'income') {
      return '#20A56A';
    }

    if (type === 'transfer') {
      return '#6B7280';
    }

    return '#E35D6A';
  };

  const getAmountPrefix = (type) => {
    if (type === 'income') {
      return '+';
    }

    if (type === 'expense') {
      return '-';
    }

    return '';
  };

  const getTypeIcon = (type) => {
    if (type === 'income') {
      return 'arrow-down-circle-outline';
    }

    if (type === 'transfer') {
      return 'swap-horizontal';
    }

    return 'arrow-up-circle-outline';
  };

  // ---------------------------------------------------------
  // FILTER CHIP
  // ---------------------------------------------------------

  const FilterChip = ({
    label,
    value,
    icon,
  }) => {
    const active = activeFilter === value;

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setActiveFilter(value)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          height: 34,
          borderRadius: 17,
          marginRight: 8,
          backgroundColor: active ? Colors.text : '#F3F4F6',
          borderWidth: 1,
          borderColor: active ? Colors.text : '#E5E7EB',
        }}
      >
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={15}
            color={active ? '#fff' : '#6B7280'}
            style={{ marginRight: 5 }}
          />
        )}

        <Text
          style={{
            fontSize: 12,
            fontWeight: active ? '800' : '600',
            color: active ? '#fff' : '#6B7280',
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  // ---------------------------------------------------------
  // SCREEN
  // ---------------------------------------------------------

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#F8F9FB',
      }}
    >

      {/* HEADER */}
      <View
        style={{
          paddingHorizontal: Spacing.s,
          paddingTop: 12,
          paddingBottom: 4,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 24,
                fontWeight: '800',
                color: Colors.text,
                letterSpacing: -0.5,
              }}
            >
              Transactions
            </Text>

            <Text
              style={{
                fontSize: 12,
                color: Colors.muted,
                marginTop: 2,
              }}
            >
              {items.length} transaction
              {items.length === 1 ? '' : 's'}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.navigate('TransactionAdd')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: Colors.text,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <MaterialCommunityIcons
              name="plus"
              size={23}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* SEARCH */}
      <View
        style={{
          paddingHorizontal: Spacing.s,
          paddingTop: 10,
        }}
      >
        <View
          style={{
            height: 44,
            borderRadius: 12,
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#E9EBEF',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 13,
          }}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={21}
            color="#9CA3AF"
          />

          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search transactions..."
            placeholderTextColor="#9CA3AF"
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 14,
              color: Colors.text,
              paddingVertical: 0,
            }}
          />

          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FILTERS */}
      <View
        style={{
          paddingTop: 10,
          paddingBottom: 7,
        }}
      >
        <SectionList
          horizontal
          sections={[
            {
              title: 'filters',
              data: ['filters'],
            },
          ]}
          renderItem={() => (
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: Spacing.s,
              }}
            >
              <FilterChip
                label="All"
                value="all"
                icon="format-list-bulleted"
              />

              <FilterChip
                label="Expense"
                value="expense"
                icon="arrow-up"
              />

              <FilterChip
                label="Income"
                value="income"
                icon="arrow-down"
              />

              <FilterChip
                label="Transfer"
                value="transfer"
                icon="swap-horizontal"
              />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
          keyExtractor={() => 'filters'}
          renderSectionHeader={() => null}
        />
      </View>

      {/* TRANSACTIONS */}
      <SectionList
        sections={groupedTransactions}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}

        contentContainerStyle={{
          paddingHorizontal: Spacing.s,
          paddingBottom: 90,
          flexGrow: 1,
        }}

        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 80,
            }}
          >
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                backgroundColor: '#EEF0F3',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <MaterialCommunityIcons
                name={
                  searchQuery
                    ? 'magnify-close'
                    : 'clipboard-text-outline'
                }
                size={36}
                color="#AEB4BC"
              />
            </View>

            <Text
              style={{
                color: Colors.text,
                fontSize: 15,
                fontWeight: '700',
                marginTop: 14,
              }}
            >
              {searchQuery
                ? 'No matching transactions'
                : 'No transactions yet'}
            </Text>

            <Text
              style={{
                color: Colors.muted,
                fontSize: 12,
                marginTop: 5,
                textAlign: 'center',
              }}
            >
              {searchQuery
                ? 'Try a different search or filter'
                : 'Your transactions will appear here'}
            </Text>
          </View>
        }

        renderSectionHeader={({ section }) => (
          <View
            style={{
              paddingTop: 9,
              paddingBottom: 7,
              backgroundColor: '#F8F9FB',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '900',
                    color: Colors.text,
                    textTransform: 'uppercase',
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
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#20A56A',
                      marginRight: 8,
                    }}
                  >
                    +₹{section.dailyIncome.toFixed(0)}
                  </Text>
                )}

                {section.dailyExpense > 0 && (
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#E35D6A',
                    }}
                  >
                    -₹{section.dailyExpense.toFixed(0)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        renderItem={({ item, index, section }) => {
          const category = categories.find(
            x => x.id === item.category_id
          );

          const source = sources.find(
            x => x.id === item.source_id
          );

          const type = getTransactionType(item);

          const amountColor = getAmountColor(type);
          const prefix = getAmountPrefix(type);

          const transactionDate = new Date(item.date);

          const timeText = transactionDate.toLocaleTimeString(
            undefined,
            {
              hour: '2-digit',
              minute: '2-digit',
            }
          );

          const accentColor =
            type === 'income'
              ? '#20A56A'
              : type === 'transfer'
                ? '#718096'
                : '#E35D6A';

          const iconColor =
            category?.color || accentColor;

          const isLast =
            index === section.data.length - 1;

          return (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => handleEdit(item)}
              style={{
                marginBottom: isLast ? 12 : 8,
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
                    backgroundColor: accentColor,
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

                  {/* ================================================= */}
                  {/* CATEGORY ICON */}
                  {/* ================================================= */}

                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 16,
                      backgroundColor: iconColor,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,

                      shadowColor: iconColor,
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
                        category?.icon ||
                        getTypeIcon(type)
                      }
                      size={23}
                      color="#FFFFFF"
                    />
                  </View>

                  {/* ================================================= */}
                  {/* MIDDLE DETAILS */}
                  {/* ================================================= */}

                  <View
                    style={{
                      flex: 1,
                      minWidth: 0,
                      justifyContent: 'center',
                      paddingRight: 8,
                    }}
                  >

                    {/* TRANSACTION NOTES */}

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
                      {item.notes || 'No notes'}
                    </Text>

                    {/* CATEGORY + SOURCE */}

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 6,
                        minWidth: 0,
                      }}
                    >

                      {/* CATEGORY */}

                      <View
                        style={{
                          flexShrink: 1,
                          maxWidth: '58%',
                          backgroundColor: iconColor + '12',
                          borderRadius: 6,
                          paddingHorizontal: 7,
                          paddingVertical: 4,
                          borderWidth: 1,
                          borderColor: iconColor + '18',
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
                          {category?.name ||
                            'Uncategorized'}
                        </Text>
                      </View>

                      {/* DOT */}

                      <View
                        style={{
                          width: 3,
                          height: 3,
                          borderRadius: 2,
                          backgroundColor: '#C7CBD1',
                          marginHorizontal: 6,
                          flexShrink: 0,
                        }}
                      />

                      {/* SOURCE */}

                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          color: '#9299A3',
                          fontSize: 11,
                          lineHeight: 14,
                          fontWeight: '600',
                        }}
                      >
                        {source?.name || 'No source'}
                      </Text>

                    </View>
                  </View>

                  {/* ================================================= */}
                  {/* RIGHT AMOUNT COLUMN */}
                  {/* ================================================= */}

                  <View
                    style={{
                      width: 90,
                      flexShrink: 0,
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                    }}
                  >

                    {/* AMOUNT */}

                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                      style={{
                        width: '100%',
                        textAlign: 'right',
                        fontSize: 15,
                        fontWeight: '900',
                        color: amountColor,
                        letterSpacing: -0.35,
                      }}
                    >
                      {prefix}₹
                      {Number(item.amount || 0).toFixed(2)}
                    </Text>

                    {/* TIME / TRANSFER */}

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        marginTop: 6,
                        minHeight: 15,
                      }}
                    >
                      {type === 'transfer' ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: '#F1F3F5',
                            paddingHorizontal: 6,
                            paddingVertical: 3,
                            borderRadius: 6,
                          }}
                        >
                          <MaterialCommunityIcons
                            name="swap-horizontal"
                            size={11}
                            color="#718096"
                          />

                          <Text
                            style={{
                              fontSize: 8,
                              fontWeight: '900',
                              color: '#718096',
                              marginLeft: 3,
                              letterSpacing: 0.25,
                            }}
                          >
                            TRANSFER
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                        >
                          <MaterialCommunityIcons
                            name="clock-outline"
                            size={11}
                            color="#A3A9B2"
                          />

                          <Text
                            style={{
                              color: '#A3A9B2',
                              fontSize: 10,
                              fontWeight: '600',
                              marginLeft: 3,
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
        }}
      />

      {/* FAB */}
      <FAB
        onPress={() =>
          navigation.navigate('TransactionAdd')
        }
      />
    </View>
  );
}