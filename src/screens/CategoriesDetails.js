import React, { useEffect, useState, useLayoutEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView
} from 'react-native';
import { getTransactions, deleteTransaction } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ConfirmDialog from '../components/ConfirmDialog';
import { Chip } from 'react-native-paper';

const screenWidth = Dimensions.get('window').width;
import PremiumRoundedBarChart from '../components/PremiumRoundedBarChart';

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('');
  }
  if (cleanHex.length !== 6) return null;
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
};

const rgbaFromColor = (color, opacity = 1) => {
  if (!color) return `rgba(76, 110, 245, ${opacity})`;
  if (color.startsWith('#')) {
    const rgb = hexToRgb(color);
    if (!rgb) return `rgba(76, 110, 245, ${opacity})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
  }
  if (color.startsWith('rgb(')) {
    const values = color.replace('rgb(', '').replace(')', '').split(',').map(v => v.trim());
    if (values.length === 3) {
      return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${opacity})`;
    }
  }
  if (color.startsWith('rgba(')) {
    return color;
  }
  return `rgba(76, 110, 245, ${opacity})`;
};

export default function CategoriesDetails({ route, navigation }) {
  const { categoryId, categoryName, mode, periodLabel } = route.params || {};

  const [transactions, setTransactions] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [sourcesMap, setSourcesMap] = useState({});
  const [loading, setLoading] = useState(true);

  const initialPeriod = useMemo(() => {
    if (mode === 'daily') return 'day';
    if (mode === 'weekly') return 'week';
    if (mode === 'monthly') return 'month';
    if (mode === 'yearly') return 'year';
    return 'month';
  }, [mode]);

  const [period, setPeriod] = useState(initialPeriod);
  const [chartData, setChartData] = useState({ labels: [], datasets: [{ data: [] }] });

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);

  const initialSelectedBar = useMemo(() => {
    const now = new Date();
    if (periodLabel) {
      if (initialPeriod === 'year') {
        return { label: String(periodLabel) };
      }
      if (initialPeriod === 'month') {
        const parts = String(periodLabel).split('-');
        if (parts.length === 2) {
          const year = parts[0].substring(2);
          const monthIndex = parseInt(parts[1], 10) - 1;
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthName = months[monthIndex] || parts[1];
          return { label: `${monthName} '${year}` };
        }
      }
    } else {
      if (initialPeriod === 'month') {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return { label: `${months[now.getMonth()]} '${String(now.getFullYear()).slice(2)}` };
      }
      if (initialPeriod === 'year') {
        return { label: String(now.getFullYear()) };
      }
    }
    return null;
  }, [periodLabel, initialPeriod]);

  const [selectedBar, setSelectedBar] = useState(initialSelectedBar);

  useLayoutEffect(() => {
    navigation.setOptions({ title: categoryName });
  }, [categoryName, navigation]);

  const getPeriodKey = (dateString) => {
    if (!dateString) return '';
    const dateStr = String(dateString).replace(' ', 'T');
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';

    if (period === 'day') return `${d.getHours()}:00`;
    if (period === 'week') return d.toLocaleDateString('en-IN', { weekday: 'short' });
    if (period === 'month') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    }
    if (period === 'year') return String(d.getFullYear());

    return '';
  };

  const groupData = (data) => {
    const map = {};

    data.forEach(tx => {
      const key = getPeriodKey(tx.date);
      map[key] = (map[key] || 0) + Number(tx.amount || 0);
    });

    const labels = Object.keys(map);
    const values = labels.map(k => map[k]);

    setChartData({
      labels,
      datasets: [
        {
          data: values
        }
      ]
    });
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);

      const [txData, catData, sourceData] =
        await Promise.all([
          getTransactions(
            1000000,
            null,
            null,
            categoryId,
            null
          ),
          getCategories(true),
          getSources(true)
        ]);

      const cmap = {};
      catData.forEach(c => { cmap[c.id] = c; });

      const smap = {};
      sourceData.forEach(s => { smap[s.id] = s; });

      const filtered = txData.filter(tx => tx.category_id === Number(categoryId));

      setCategoriesMap(cmap);
      setSourcesMap(smap);
      setTransactions(filtered);

      groupData(filtered);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [period])
  );

  const handleDeleteConfirm = async () => {
    if (!confirmTargetId) return;

    try {
      await deleteTransaction(confirmTargetId);
      await loadTransactions();
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setConfirmVisible(false);
      setConfirmTargetId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const activeCategory = categoriesMap[Number(categoryId)] || {};
  const activeCategoryColor = activeCategory.color || Colors.primary;

  const chartValues = useMemo(
    () => chartData?.datasets?.[0]?.data || [],
    [chartData]
  );

  const hasChartData = chartData.labels.length > 0 && chartValues.length > 0;

  const filteredTransactions = useMemo(() => {
    if (!selectedBar?.label) return transactions;
    return transactions.filter(tx => getPeriodKey(tx.date) === selectedBar.label);
  }, [transactions, selectedBar, period]);

  const groupedTransactions = useMemo(() => {
    const groups = {};

    const getDateKey = (dateValue) => {
      const date = new Date(dateValue);

      return `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;
    };

    filteredTransactions.forEach(item => {
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

        const dailyTotal =
          groups[dateKey].reduce(
            (sum, item) =>
              sum + Number(item.amount || 0),
            0
          );

        return {
          title,
          dateKey,
          data: groups[dateKey],
          dailyTotal,
        };
      });
  }, [filteredTransactions]);

  const renderItem = ({
    item,
    index,
    section,
  }) => {
    const category =
      categoriesMap[item.category_id] || {};

    const source =
      sourcesMap[item.source_id] || {};

    const isExpense =
      String(item.type || '').toLowerCase() ===
      'expense';

    const isTransfer =
      String(item.type || '').toLowerCase() ===
      'transfer' ||
      item.transfer_group_id ||
      item.is_transfer;

    const type =
      isTransfer
        ? 'transfer'
        : isExpense
          ? 'expense'
          : 'income';

    const amountColor =
      type === 'income'
        ? '#20A56A'
        : type === 'transfer'
          ? '#718096'
          : '#D14343';

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
          : '#D14343';

    const iconColor =
      category.color ||
      activeCategoryColor ||
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
      index === section.data.length - 1;

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() =>
          navigation.navigate(
            'TransactionAdd',
            {
              isEdit: true,
              transaction: item,
            }
          )
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

            {/* ============================================ */}
            {/* CATEGORY ICON */}
            {/* ============================================ */}

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
                  'tag'
                }
                size={23}
                color="#FFFFFF"
              />
            </View>

            {/* ============================================ */}
            {/* DETAILS */}
            {/* ============================================ */}

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
                    maxWidth: '54%',

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
                      categoryName ||
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
                  {source.name || 'No source'}
                </Text>
              </View>
            </View>

            {/* ============================================ */}
            {/* RIGHT COLUMN */}
            {/* ============================================ */}

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
                {amountPrefix}₹
                {Number(
                  item.amount || 0
                ).toLocaleString(
                  'en-IN',
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
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

              {/* TIME / TRANSFER */}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 3,
                  minHeight: 14,
                }}
              >
                {type === 'transfer' ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#F1F3F5',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 5,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="swap-horizontal"
                      size={10}
                      color="#718096"
                    />

                    <Text
                      style={{
                        fontSize: 7.5,
                        fontWeight: '900',
                        color: '#718096',
                        marginLeft: 3,
                        letterSpacing: 0.2,
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
                )}
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <>
      <View
        style={[
          styles.chartCard,
          { borderColor: rgbaFromColor(activeCategoryColor, 0.14) }
        ]}
      >

        <PremiumRoundedBarChart
          labels={chartData.labels}
          values={chartValues}
          width={screenWidth - 56}
          height={250}
          baseColor={activeCategoryColor}
          isEmpty={!hasChartData}
          onBarPress={(data) => {
            setSelectedBar({
              label: data.label,
              value: data.value
            });
          }}
        />

      </View>

      <View style={styles.chipsWrap}>
        {['day', 'week', 'month', 'year'].map(p => {
          const active = period === p;
          return (
            <Chip
              key={p}
              selected={active}
              onPress={() => {
                setSelectedBar(null);
                setPeriod(p);
              }}
              mode="flat"
              style={[
                styles.chip,
                {
                  backgroundColor: active
                    ? activeCategoryColor
                    : rgbaFromColor(activeCategoryColor, 0.08),
                  borderColor: active
                    ? activeCategoryColor
                    : rgbaFromColor(activeCategoryColor, 0.22)
                }
              ]}
              textStyle={[
                styles.chipText,
                {
                  color: active ? '#FFFFFF' : activeCategoryColor
                }
              ]}
            >
              {p.toUpperCase()}
            </Chip>
          );
        })}
      </View>
    </>
  );

  const ListEmpty = () => (
    <View style={styles.emptyListWrap}>
      <Text style={styles.emptyListText}>
        {selectedBar?.label ? `No transactions for ${selectedBar.label}` : 'No transactions yet'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <SectionList
          sections={groupedTransactions}
          keyExtractor={(item) =>
            item.id.toString()
          }
          renderItem={renderItem}

          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}

          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}

          contentContainerStyle={
            styles.listContent
          }

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

                <Text
                  style={{
                    color:
                      activeCategoryColor,
                    fontSize: 12,
                    fontWeight: '900',
                  }}
                >
                  ₹
                  {section.dailyTotal.toLocaleString(
                    'en-IN',
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Transaction"
        message="Are you sure?"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={handleDeleteConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.xs
  },

  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },

  sectionSubtext: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '600'
  },

  chipsWrap: {
    flexDirection: 'row',
    marginBottom: 14,
    flexWrap: 'wrap'
  },

  chip: {
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 14
  },

  chipText: {
    fontSize: 12,
    fontWeight: '700'
  },

  listContent: {
    paddingBottom: 10
  },

  emptyListWrap: {
    paddingTop: 6,
    paddingBottom: 18,
    alignItems: 'center'
  },

  emptyListText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted
  },

  txCard: {
    marginBottom: Spacing.s,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,20,20,0.05)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },

  txContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },

  txTextBlock: {
    flex: 1,
    paddingRight: 10
  },

  title: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text
  },

  date: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 4,
    fontWeight: '500'
  },

  rightBlock: {
    alignItems: 'flex-end'
  },

  amount: {
    fontSize: 15,
    fontWeight: '900'
  },

  actions: {
    flexDirection: 'row',
    marginTop: 8
  },

  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 110, 245, 0.08)',
    marginLeft: 8
  },

  deleteBtn: {
    backgroundColor: 'rgba(211, 47, 47, 0.08)'
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },

  loadingText: {
    fontSize: 14,
    color: Colors.muted,
    fontWeight: '600'
  }
});
