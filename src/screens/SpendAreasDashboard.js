import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getCategories } from '../services/categories';
import { getTransactions } from '../services/transactions';
import { getSources } from '../services/sources';
import { Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';
import { usePageLoader } from '../context/PageLoaderContext';

function CategoryDonut({ data = [], categoriesMap = {} }) {
  const size = 160;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  let cumulative = 0;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        {data.map((d, i) => {
          const value = Number(d.amount || 0);
          const percent = total > 0 ? value / total : 0;
          const cat = categoriesMap[d.category_id] || {};
          const color = cat.color || '#eee';
          const strokeDasharray = `${circumference * percent} ${circumference}`;
          const rotation = (cumulative / total) * 360;
          cumulative += value;
          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={strokeDasharray}
              rotation={rotation - 90}
              originX={size / 2}
              originY={size / 2}
              strokeLinecap="butt"
            />
          );
        })}
      </Svg>

      {/* CENTER TEXT */}
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', fontSize: 14 }}>Total Spend</Text>
        <Text style={{ fontSize: 18, fontWeight: '800' }}>
          ₹{total.toLocaleString('en-IN')}
        </Text>
      </View>
    </View>
  );
}

export default function SpendAreasDashboard({ route, navigation }) {
  const params = route?.params || {};
  const {
    show: showPageLoader,
    hide: hidePageLoader,
  } = usePageLoader();
  const periodScrollRef = useRef(null);
  const periodChipPositions = useRef({});
  const periodScrollWidth = useRef(0);
  const [transactions, setTransactions] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [sourcesMap, setSourcesMap] = useState({});
  const [filterMode, setFilterMode] = useState(params.mode || 'monthly');
  const [selectedPeriod, setSelectedPeriod] = useState(params.periodLabel || null);

  async function loadInitialData() {
    showPageLoader();
    try {
      const [
        catsAll,
        sourcesAll,
        tx,
      ] = await Promise.all([
        getCategories(true),
        getSources(true),
        getTransactions(1000000, 'Yes'),
      ]);
      // CATEGORIES
      const cmap = {};
      (catsAll || []).forEach(c => {
        cmap[String(c.id)] = c;
      });
      setCategoriesMap(cmap);
      // SOURCES
      const smap = {};
      (sourcesAll || []).forEach(source => {
        smap[String(source.id)] = source;
      });
      setSourcesMap(smap);
      // TRANSACTIONS
      setTransactions(tx || []);
    } catch (e) {
      console.error('Error loading dashboard data:', e);
      setCategoriesMap({});
      setSourcesMap({});
      setTransactions([]);
    } finally {
      hidePageLoader();
    }
  }

  useEffect(() => {
    loadInitialData();
    const unsubscribe = navigation.addListener(
      'focus',
      () => {
        loadInitialData();
      }
    );
    return unsubscribe;
  }, [navigation]);

  // Sync state if parameters change
  useEffect(() => {
    if (params.mode) {
      setFilterMode(params.mode);
    }
    if (params.periodLabel) {
      setSelectedPeriod(params.periodLabel);
    }
  }, [params.mode, params.periodLabel]);

  // Compute all unique periods available in transactions for the selected filterMode
  const allPeriods = useMemo(() => {
    if (transactions.length === 0) return [];
    const periods = new Set();
    transactions.forEach(t => {
      if (!t.date) return;
      const dateStr = String(t.date).replace(' ', 'T');
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return;
      let key = '';
      if (filterMode === 'daily') {
        key = dateStr.split('T')[0];
      } else if (filterMode === 'weekly') {
        const day = dateObj.getDay();
        const diff = dateObj.getDate() - day;
        const weekStart = new Date(dateObj);
        weekStart.setDate(diff);
        key = weekStart.toISOString().split('T')[0];
      } else if (filterMode === 'monthly') {
        key = dateStr.substring(0, 7);
      } else if (filterMode === 'yearly') {
        key = dateStr.substring(0, 4);
      }
      if (key) {
        periods.add(key);
      }
    });

    return Array.from(periods).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [transactions, filterMode]);

  // Fallback selectedPeriod to the latest period if none is selected or matches the mode
  useEffect(() => {
    if (allPeriods.length === 0) return;
    // Keep the selected period if it is still valid.
    if (
      selectedPeriod &&
      allPeriods.includes(selectedPeriod)
    ) {
      return;
    }
    // Default to the MOST RECENT period.
    setSelectedPeriod(
      allPeriods[allPeriods.length - 1]
    );
  }, [allPeriods, selectedPeriod]);

  // Format period label for presentation
  const formatPeriodLabel = useCallback((label) => {
    if (!label) return '';
    if (filterMode === 'daily') return label.substring(5);
    if (filterMode === 'monthly') {
      const parts = label.split('-');
      if (parts.length < 2) return label;
      const year = parts[0].substring(2);
      const month = parts[1];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const index = parseInt(month, 10) - 1;
      const monthName = months[index] || month;
      return `${monthName} '${year}`;
    }
    if (filterMode === 'weekly') return `Wk ${label.substring(8, 10)}`;
    return label;
  }, [filterMode]);

  // Aggregate category spending on client-side
  const topCategories = useMemo(() => {
    if (transactions.length === 0 || !selectedPeriod) return [];
    const byId = {};
    let filterFn;
    if (filterMode === 'daily' || filterMode === 'monthly' || filterMode === 'yearly') {
      filterFn = (dateStr) => dateStr.startsWith(selectedPeriod);
    } else if (filterMode === 'weekly') {
      const weekStart = new Date(selectedPeriod);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      filterFn = (dateStr) => {
        const d = new Date(dateStr);
        return d >= weekStart && d < weekEnd;
      };
    } else {
      filterFn = () => true;
    }
    transactions.forEach(t => {
      if (t.type !== 'expense') return;
      if (!t.date) return;
      // Uncategorized expenses must NOT be included
      // in Spend Areas or Total Spend calculations.
      if (
        t.category_id === null ||
        t.category_id === undefined ||
        String(t.category_id).trim() === '' ||
        String(t.category_id).toLowerCase() === 'uncategorized'
      ) {
        return;
      }
      const dateStr = String(t.date).replace(' ', 'T');
      if (!filterFn(dateStr)) return;
      const cid = String(t.category_id);
      byId[cid] =
        (byId[cid] || 0) +
        (parseFloat(t.amount) || 0);
    });
    return Object.keys(byId).map(k => {
      const cat = categoriesMap[k] || { name: 'Uncategorized' };
      return { category_id: k, category_name: cat.name, amount: byId[k] };
    }).sort((a, b) => b.amount - a.amount);
  }, [transactions, selectedPeriod, filterMode, categoriesMap]);

  const selectedPeriodTransactions = useMemo(() => {
    if (!transactions.length || !selectedPeriod) return [];
    let filterFn;
    if (
      filterMode === 'daily' ||
      filterMode === 'monthly' ||
      filterMode === 'yearly'
    ) {
      filterFn = (dateStr) =>
        dateStr.startsWith(selectedPeriod);
    } else if (filterMode === 'weekly') {
      const weekStart = new Date(`${selectedPeriod}T00:00:00`);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      filterFn = (dateStr) => {
        const date = new Date(dateStr);
        return date >= weekStart && date < weekEnd;
      };
    } else {
      filterFn = () => true;
    }
    return transactions
      .filter(transaction => {
        if (transaction.type !== 'expense') return false;
        if (!transaction.date) return false;
        const dateStr = String(transaction.date).replace(' ', 'T');
        return filterFn(dateStr);
      })
      .sort(
        (a, b) =>
          new Date(String(b.date).replace(' ', 'T')) -
          new Date(String(a.date).replace(' ', 'T'))
      );
  }, [
    transactions,
    selectedPeriod,
    filterMode,
  ]);

  const totalSpend = useMemo(() => {
    return topCategories.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  }, [topCategories]);

  const focusSelectedPeriod = useCallback((period) => {
    if (!period) return;
    const position = periodChipPositions.current[period];
    if (!position) return;
    const chipCenter = position.x + position.width / 2;
    const targetX = chipCenter - periodScrollWidth.current / 2;
    periodScrollRef.current?.scrollTo({
      x: Math.max(0, targetX),
      animated: true,
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.xs, paddingBottom: 120 }}>
        {/* MODE SELECTOR */}
        <View style={styles.tabContainer}>
          {['daily', 'weekly', 'monthly', 'yearly'].map((m) => {
            const isSelected = filterMode === m;
            return (
              <Chip
                key={m}
                mode="outlined"
                selected={false}
                onPress={() => {
                  setFilterMode(m);
                  setSelectedPeriod(null);
                }}
                style={[
                  styles.chip,
                  isSelected && {
                    borderColor: Colors.primary,
                    backgroundColor: '#e6f7ff',
                  },
                ]}
                textStyle={[
                  styles.chipText,
                  isSelected && {
                    color: Colors.primary,
                    fontWeight: '600',
                  },
                ]}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Chip>
            );
          })}
        </View>

        {/* PERIOD SELECTOR */}
        {allPeriods.length > 0 && (
          <View style={styles.periodSelectorWrapper}>
            <ScrollView
              ref={periodScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.periodSelectorContainer}
              contentContainerStyle={styles.periodSelectorContent}
              onLayout={(event) => {
                periodScrollWidth.current = event.nativeEvent.layout.width;
                // Focus selected month after the ScrollView has received its actual width.
                if (selectedPeriod) {
                  requestAnimationFrame(() => {
                    focusSelectedPeriod(selectedPeriod);
                  });
                }
              }}
            >
              {allPeriods.map((p) => {
                const isSelected = selectedPeriod === p;
                return (
                  <TouchableOpacity
                    key={p}
                    activeOpacity={0.75}
                    onLayout={(event) => {
                      const {
                        x,
                        width,
                      } = event.nativeEvent.layout;

                      periodChipPositions.current[p] = {
                        x,
                        width,
                      };

                      // If this is the selected month, focus it after its position is known.
                      if (isSelected) {
                        requestAnimationFrame(() => {
                          focusSelectedPeriod(p);
                        });
                      }
                    }}
                    onPress={() => {
                      setSelectedPeriod(p);
                      // Immediately focus the tapped month.
                      requestAnimationFrame(() => {
                        focusSelectedPeriod(p);
                      });
                    }}
                    style={[
                      styles.periodChip,
                      isSelected &&
                      styles.periodChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodChipText,
                        isSelected &&
                        styles.periodChipTextSelected,
                      ]}
                    >
                      {formatPeriodLabel(p)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* SPEND SUMMARY CARD */}
        <Card>
          <Text
            style={{
              fontWeight: '800',
              marginBottom: 8,
              fontSize: 16,
              color: '#2F7355',
            }}
          >
            Spend Areas {selectedPeriod ? `(${formatPeriodLabel(selectedPeriod)})` : ''}
          </Text>

          {topCategories.length ? (
            <View style={{ alignItems: 'center', marginBottom: 20, marginTop: 10 }}>
              <CategoryDonut data={topCategories} categoriesMap={categoriesMap} />
            </View>
          ) : (
            <Text style={{ color: Colors.muted, marginVertical: 20, textAlign: 'center' }}>No spend data for this period</Text>
          )}

          {topCategories.map(c => {
            const cat = categoriesMap[c.category_id] || {};
            const color = cat.color || '#4B7CF3';
            const icon = cat.icon || 'tag';
            const amount = Number(c.amount || 0);
            const percent = totalSpend > 0 ? (amount / totalSpend) * 100 : 0;
            const isTargetCategory = String(params.categoryId) === String(c.category_id);
            return (
              <TouchableOpacity
                key={c.category_id}
                activeOpacity={0.88}
                onPress={() =>
                  navigation.navigate('CategoriesDetails', {
                    categoryId: c.category_id,
                    categoryName: c.category_name,
                    mode: filterMode,
                    periodLabel: selectedPeriod,
                  })
                }
              >
                <View
                  style={[
                    styles.categoryRowContainer,
                    isTargetCategory && styles.highlightCategoryRow,
                  ]}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      width: '100%',
                    }}
                  >

                    {/* LEFT — 15% Category Icon */}
                    <View
                      style={{
                        width: '15%',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          backgroundColor: color,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MaterialCommunityIcons
                          name={icon}
                          size={21}
                          color="#FFFFFF"
                        />
                      </View>
                    </View>

                    {/*  MIDDLE — 60%  */}
                    <View
                      style={{
                        width: '60%',
                        paddingHorizontal: 5,
                        minWidth: 0,
                      }}
                    >
                      {/* Category */}
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{
                          fontSize: 14,
                          fontWeight: '800',
                          color: '#2F7355',
                          marginBottom: 3,
                        }}
                      >
                        {c.category_name}
                      </Text>

                      {/* Amount */}
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: '#718078',
                          marginBottom: 7,
                        }}
                      >
                        ₹{amount.toLocaleString('en-IN')}
                      </Text>
                      {/* Progress */}
                      <View
                        style={{
                          width: '100%',
                          height: 7,
                          backgroundColor: '#DCEDE4',
                          borderRadius: 10,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, percent)
                            )}%`,
                            height: '100%',
                            backgroundColor: '#3F8F6B',
                            borderRadius: 10,
                          }}
                        />
                      </View>
                    </View>

                    {/* RIGHT — 25% Percentage */}
                    <View
                      style={{
                        width: '25%',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        paddingLeft: 5,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: '900',
                          color: '#3F8F6B',
                          letterSpacing: -0.4,
                        }}
                      >
                        {Math.round(percent)}%
                      </Text>

                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: '#718078',
                          marginTop: 3,
                          textAlign: 'right',
                        }}
                      >
                        of total spend
                      </Text>
                    </View>

                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* SELECTED PERIOD TRANSACTIONS */}
        <View style={styles.transactionsSection}>

          {/* SECTION HEADER */}
          <View style={styles.transactionsHeader}>
            <View>
              <Text style={styles.transactionsTitle}>
                Transactions
              </Text>

              <Text style={styles.transactionsSubtitle}>
                {selectedPeriod
                  ? `${formatPeriodLabel(selectedPeriod)} • ${selectedPeriodTransactions.length
                  } ${selectedPeriodTransactions.length === 1
                    ? 'transaction'
                    : 'transactions'
                  }`
                  : 'Selected period'}
              </Text>
            </View>

            <View style={styles.transactionCountBadge}>
              <Text style={styles.transactionCountText}>
                {selectedPeriodTransactions.length}
              </Text>
            </View>
          </View>

          {selectedPeriodTransactions.length === 0 ? (

            /* EMPTY */
            <View style={styles.emptyTransactions}>
              <View style={styles.emptyTransactionsIcon}>
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={36}
                  color="#AEB4BC"
                />
              </View>

              <Text style={styles.emptyTransactionsTitle}>
                No transactions yet
              </Text>

              <Text style={styles.emptyTransactionsText}>
                No expenses found for this period
              </Text>
            </View>

          ) : (

            /* TRANSACTION CARDS */
            selectedPeriodTransactions.map((item, index) => {
              const category = categoriesMap[item.category_id] || {};
              const type = 'expense';
              const amountColor = '#E35D6A';
              const prefix = '-';
              const accentColor = '#E35D6A';
              const iconColor = category.color || accentColor;
              const rawTransactionDate = String(item.date || '').trim();
              const normalizedTransactionDate =
                rawTransactionDate.includes('T')
                  ? rawTransactionDate
                  : rawTransactionDate.replace(' ', 'T');
              const transactionDate = new Date(normalizedTransactionDate);
              const dateText = !isNaN(transactionDate.getTime())
                ? transactionDate.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
                : rawTransactionDate;
              const timeText = !isNaN(transactionDate.getTime())
                ? transactionDate.toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })
                : '';
              const isLast = index === selectedPeriodTransactions.length - 1;
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  activeOpacity={0.88}
                  onPress={() =>
                    navigation.navigate('TransactionAdd', {
                      isEdit: true,
                      transaction: item,
                    })
                  }
                  style={{
                    marginBottom: isLast ? 12 : 8,
                  }}
                >

                  {/* EXACT TRANSACTION CARD */}
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

                      {/* CATEGORY ICON */}
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
                            category.icon ||
                            'arrow-up-circle-outline'
                          }
                          size={23}
                          color="#FFFFFF"
                        />
                      </View>

                      {/* MIDDLE DETAILS */}
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
                          {item.notes || 'No notes'}
                        </Text>
                        {/* SOURCE */}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginTop: 6,
                            minWidth: 0,
                          }}
                        >
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
                            {sourcesMap[String(item.source_id)]?.name ||
                              item.source_name ||
                              item.source?.name ||
                              'No source'}
                          </Text>
                        </View>
                      </View>

                      {/* RIGHT AMOUNT COLUMN */}
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
                            color:
                              item.is_counted === 0
                                ? '#9CA3AF'
                                : amountColor,
                            letterSpacing: -0.35,
                            textDecorationLine:
                              item.is_counted === 0
                                ? 'line-through'
                                : 'none',
                          }}
                        >
                          {prefix}₹
                          {Number(
                            item.amount || 0
                          ).toFixed(2)}
                        </Text>
                        {/* NOT COUNTED */}
                        {item.is_counted === 0 && (
                          <View
                            style={{
                              backgroundColor: '#F3F4F6',
                              borderRadius: 4,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              marginTop: 3,
                              alignSelf: 'flex-end',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 9,
                                color: '#9CA3AF',
                                fontWeight: '700',
                                letterSpacing: 0.3,
                              }}
                            >
                              NOT SPEND
                            </Text>
                          </View>
                        )}
                        {/* TRANSACTION DATE + TIME */}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            marginTop: 6,
                            minHeight: 15,
                          }}
                        >
                          <Text
                            style={{
                              color: '#A3A9B2',
                              fontSize: 10,
                              fontWeight: '600',
                              marginLeft: 3,
                            }}
                            numberOfLines={1}
                          >
                            {dateText}{timeText ? ` • ${timeText}` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  chip: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 0,
    justifyContent: 'center',
  },
  chipText: {
    textAlign: 'center',
    fontSize: 13,
  },
  periodSelectorWrapper: {
    marginTop: 10,
    marginBottom: 14,
  },
  periodSelectorContainer: {
    width: '100%',
  },
  periodSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 8,
  },
  periodChip: {
    height: 36,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E1EA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodChipSelected: {
    backgroundColor: '#3F8F6B',
    borderColor: '#3F8F6B',
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  periodChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  periodSelectorContainer: {
    width: '100%',
  },
  periodSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 8,
  },
  periodChip: {
    height: 36,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E1EA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  periodChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryRowContainer: {
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#F8FCFA',
    borderWidth: 1,
    borderColor: '#E5F1EB',
  },
  highlightCategoryRow: {
    backgroundColor: '#F8FCFA',
    borderWidth: 1,
    borderColor: '#BFDCCD',
  },
  transactionsSection: {
    marginTop: 4,
  },
  transactionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  transactionsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2F7355',
  },
  transactionsSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#718078',
    marginTop: 3,
  },
  transactionCountBadge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: '#E6F2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2F7355',
  },
  emptyTransactions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 35,
  },
  emptyTransactionsIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EEF0F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTransactionsTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
  },
  emptyTransactionsText: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
});
