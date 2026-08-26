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
import { useFocusEffect } from '@react-navigation/native';

export default function SearchScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  async function load() {
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

  // ---------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------

  useEffect(() => {
    const search = async () => {
      const q = searchQuery.trim();

      if (q.length < 3) {
        setItems([]);
        return;
      }

      const transactions =
        await getTransactions(1000000, 'Yes');

      const lowerQuery = q.toLowerCase();

      const filtered = transactions.filter(item => {
        const category =
          categories.find(
            x => x.id === item.category_id
          )?.name || '';

        const source =
          sources.find(
            x => x.id === item.source_id
          )?.name || '';

        return (
          (item.notes || '')
            .toLowerCase()
            .includes(lowerQuery) ||

          String(item.amount || '')
            .includes(q) ||

          category
            .toLowerCase()
            .includes(lowerQuery) ||

          source
            .toLowerCase()
            .includes(lowerQuery)
        );
      });

      setItems(filtered);
    };

    search();
  }, [
    searchQuery,
    categories,
    sources,
  ]);

  // ---------------------------------------------------------
  // EDIT
  // ---------------------------------------------------------

  const handleEdit = (item) => {
    navigation.navigate('TransactionAdd', {
      isEdit: true,
      transaction: item,
    });
  };

  // ---------------------------------------------------------
  // TRANSACTION TYPE
  // ---------------------------------------------------------

  const getTransactionType = (item) => {
    const type =
      String(item.type || '').toLowerCase();

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
  // GROUP SEARCH RESULTS BY DATE
  // ---------------------------------------------------------

  const groupedResults = useMemo(() => {
    if (!items.length) {
      return [];
    }

    const groups = {};

    const getDateKey = (dateValue) => {
      const date = new Date(dateValue);

      return `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;
    };

    items.forEach(item => {
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
          title =
            date.toLocaleDateString(
              undefined,
              {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }
            );
        }

        return {
          title,
          dateKey,
          data: groups[dateKey],
        };
      });
  }, [items]);

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
        <Text
          style={{
            fontSize: 24,
            fontWeight: '800',
            color: Colors.text,
            letterSpacing: -0.5,
          }}
        >
          Search
        </Text>

        <Text
          style={{
            fontSize: 12,
            color: Colors.muted,
            marginTop: 2,
          }}
        >
          Find your transactions quickly
        </Text>
      </View>

      {/* SEARCH BAR */}

      <View
        style={{
          paddingHorizontal: Spacing.s,
          paddingTop: 10,
        }}
      >
        <View
          style={{
            height: 46,
            borderRadius: 13,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E7E9ED',

            flexDirection: 'row',
            alignItems: 'center',

            paddingHorizontal: 13,

            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.035,
            shadowRadius: 5,
            elevation: 1,
          }}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color="#8F96A1"
          />

          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search transactions..."
            placeholderTextColor="#9CA3AF"
            autoCorrect={false}
            returnKeyType="search"
            style={{
              flex: 1,
              marginLeft: 9,
              fontSize: 14,
              color: Colors.text,
              paddingVertical: 0,
            }}
          />

          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() =>
                setSearchQuery('')
              }
              activeOpacity={0.7}
              style={{
                padding: 3,
              }}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={19}
                color="#A3A9B2"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* RESULT COUNT */}

      {searchQuery.trim().length >= 3 &&
        items.length > 0 && (
          <View
            style={{
              paddingHorizontal: Spacing.s,
              paddingTop: 12,
              paddingBottom: 2,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: Colors.muted,
                fontWeight: '600',
              }}
            >
              {items.length}{' '}
              {items.length === 1
                ? 'transaction'
                : 'transactions'} found
            </Text>
          </View>
        )}

      {/* RESULTS */}

      <SectionList
        sections={groupedResults}
        keyExtractor={(item) =>
          String(item.id)
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}

        contentContainerStyle={{
          paddingHorizontal: Spacing.s,
          paddingBottom: 40,
          flexGrow: 1,
        }}

        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 70,
              paddingHorizontal: 25,
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
                  searchQuery.length < 3
                    ? 'magnify'
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
                textAlign: 'center',
              }}
            >
              {searchQuery.length < 3
                ? 'Search your transactions'
                : 'No transactions found'}
            </Text>

            <Text
              style={{
                color: Colors.muted,
                fontSize: 12,
                marginTop: 6,
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              {searchQuery.length < 3
                ? 'Type at least 3 characters to search by note, amount, category or source'
                : 'Try a different keyword, amount, category or source'}
            </Text>
          </View>
        }

        /* DATE HEADER */

        renderSectionHeader={({ section }) => (
          <View
            style={{
              paddingTop: 10,
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
            </View>
          </View>
        )}

        /* TRANSACTION CARD */

        renderItem={({
          item,
          index,
          section,
        }) => {
          const category =
            categories.find(
              x =>
                x.id ===
                item.category_id
            );

          const source =
            sources.find(
              x =>
                x.id ===
                item.source_id
            );

          const type =
            getTransactionType(item);

          const amountColor =
            getAmountColor(type);

          const prefix =
            getAmountPrefix(type);

          const transactionDate =
            new Date(item.date);

          const timeText =
            transactionDate.toLocaleTimeString(
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
            category?.color ||
            accentColor;

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
                  backgroundColor:
                    '#FFFFFF',
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

                      justifyContent:
                        'center',
                      alignItems:
                        'center',

                      marginRight: 12,

                      shadowColor:
                        iconColor,
                      shadowOffset: {
                        width: 0,
                        height: 3,
                      },
                      shadowOpacity:
                        0.22,
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

                  {/* DETAILS */}

                  <View
                    style={{
                      flex: 1,
                      minWidth: 0,
                      justifyContent:
                        'center',
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
                        color:
                          Colors.text,
                        letterSpacing:
                          -0.15,
                      }}
                    >
                      {item.notes ||
                        'No notes'}
                    </Text>

                    {/* CATEGORY + SOURCE */}

                    <View
                      style={{
                        flexDirection:
                          'row',
                        alignItems:
                          'center',
                        marginTop: 6,
                        minWidth: 0,
                      }}
                    >

                      {/* CATEGORY */}

                      <View
                        style={{
                          flexShrink: 1,
                          maxWidth:
                            '58%',

                          backgroundColor:
                            iconColor +
                            '12',

                          borderRadius: 6,

                          paddingHorizontal:
                            7,
                          paddingVertical:
                            4,

                          borderWidth: 1,
                          borderColor:
                            iconColor +
                            '18',
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={{
                            color:
                              iconColor,
                            fontSize: 11,
                            lineHeight: 13,
                            fontWeight:
                              '800',
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
                          backgroundColor:
                            '#C7CBD1',
                          marginHorizontal:
                            6,
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
                          color:
                            '#9299A3',
                          fontSize: 11,
                          lineHeight: 14,
                          fontWeight:
                            '600',
                        }}
                      >
                        {source?.name ||
                          'No source'}
                      </Text>
                    </View>
                  </View>

                  {/* AMOUNT */}

                  <View
                    style={{
                      width: 90,
                      flexShrink: 0,
                      alignItems:
                        'flex-end',
                      justifyContent:
                        'center',
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={
                        0.75
                      }
                      style={{
                        width: '100%',
                        textAlign:
                          'right',
                        fontSize: 15,
                        fontWeight:
                          '900',
                        color:
                          amountColor,
                        letterSpacing:
                          -0.35,
                      }}
                    >
                      {prefix}₹
                      {Number(
                        item.amount || 0
                      ).toFixed(2)}
                    </Text>

                    {/* TIME / TRANSFER */}

                    <View
                      style={{
                        flexDirection:
                          'row',
                        alignItems:
                          'center',
                        justifyContent:
                          'flex-end',
                        marginTop: 6,
                        minHeight: 15,
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
                              3,
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
                              fontWeight:
                                '900',
                              color:
                                '#718096',
                              marginLeft: 3,
                              letterSpacing:
                                0.25,
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
                            size={11}
                            color="#A3A9B2"
                          />

                          <Text
                            style={{
                              color:
                                '#A3A9B2',
                              fontSize: 10,
                              fontWeight:
                                '600',
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
    </View>
  );
}