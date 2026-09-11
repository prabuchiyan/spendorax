import React, { useEffect, useState, useLayoutEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { getTransactions, deleteTransaction, getTransactionsByDateRange } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import { Colors, Spacing } from '../components/Theme';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import FAB from '../components/FAB';
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
  const [chartOffset, setChartOffset] = useState(0);

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

  const getLabelForDate = useCallback((d, periodType) => {
    if (periodType === 'day') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(d.getDate()).padStart(2, '0');
      return `${day} ${months[d.getMonth()]}`;
    }
    if (periodType === 'week') {
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const startDay = String(startOfWeek.getDate()).padStart(2, '0');
      const startMonth = months[startOfWeek.getMonth()].charAt(0).toLowerCase();
      const endDay = String(endOfWeek.getDate());
      const endMonth = months[endOfWeek.getMonth()].charAt(0).toLowerCase();
      
      return `${startDay}${startMonth}-${endDay}${endMonth}`;
    }
    if (periodType === 'month') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    }
    if (periodType === 'year') {
      return String(d.getFullYear());
    }
    return '';
  }, []);

  const initialSelectedBar = useMemo(() => {
    const now = new Date();
    if (periodLabel) {
      // Just fallback to computing the label for the provided date string to ensure format is identical
      const d = new Date(periodLabel);
      if (!isNaN(d.getTime())) {
        return { label: getLabelForDate(d, initialPeriod) };
      }
    }
    return { label: getLabelForDate(now, initialPeriod) };
  }, [periodLabel, initialPeriod, getLabelForDate]);

  const [selectedBar, setSelectedBar] = useState(initialSelectedBar);

  useLayoutEffect(() => {
    navigation.setOptions({ title: categoryName });
  }, [categoryName, navigation]);

  const getPeriodKey = (dateString, p) => {
    if (!dateString) return '';
    const dateStr = String(dateString).replace(' ', 'T');
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    
    const periodType = p || period;
    return getLabelForDate(d, periodType);
  };

  const generateContinuousPeriods = (periodType, offset) => {
    const periods = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let i = 4; i >= 0; i--) {
      const d = new Date(now);
      const shiftAmount = offset + i;

      if (periodType === 'day') {
        d.setDate(d.getDate() - shiftAmount);
      } else if (periodType === 'week') {
        d.setDate(d.getDate() - shiftAmount * 7);
      } else if (periodType === 'month') {
        d.setMonth(d.getMonth() - shiftAmount);
      } else if (periodType === 'year') {
        d.setFullYear(d.getFullYear() - shiftAmount);
      }
      periods.push(d);
    }
    return periods;
  };

  const groupData = (data, currentPeriod, offset) => {
    const map = {};

    data.forEach(tx => {
      const key = getPeriodKey(tx.date, currentPeriod);
      if (key) {
        map[key] = (map[key] || 0) + Number(tx.amount || 0);
      }
    });

    const continuousPeriods = generateContinuousPeriods(currentPeriod, offset);
    // Reverse the periods so newest is on the left, oldest on the right
    const displayPeriods = [...continuousPeriods].reverse();
    
    const continuousLabels = displayPeriods.map(d => getLabelForDate(d, currentPeriod));
    const values = continuousLabels.map(k => map[k] || 0);

    setChartData({
      labels: continuousLabels,
      datasets: [
        {
          data: values
        }
      ]
    });
  };

  const getBoundsForPeriods = (periods, periodType) => {
    if (!periods || periods.length === 0) return { start: null, end: null };
    
    const firstDate = new Date(periods[0]);
    const lastDate = new Date(periods[periods.length - 1]);
    
    let start = new Date(firstDate);
    let end = new Date(lastDate);
    
    if (periodType === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (periodType === 'week') {
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      
      end.setDate(end.getDate() + (6 - end.getDay()));
      end.setHours(23, 59, 59, 999);
    } else if (periodType === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      
      end = new Date(end.getFullYear(), end.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (periodType === 'year') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
    }
    
    const pad = (n) => String(n).padStart(2, '0');
    const formatSqlite = (d) => {
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    return {
      start: formatSqlite(start),
      end: formatSqlite(end)
    };
  };

  const loadTransactions = async (currentPeriod = period, offset = chartOffset) => {
    try {
      setLoading(true);

      const continuousPeriods = generateContinuousPeriods(currentPeriod, offset);
      const bounds = getBoundsForPeriods(continuousPeriods, currentPeriod);

      const [txData, catData, sourceData] =
        await Promise.all([
          getTransactionsByDateRange(
            categoryId,
            bounds.start,
            bounds.end
          ),
          getCategories(true),
          getSources(true)
        ]);

      const cmap = {};
      catData.forEach(c => { cmap[c.id] = c; });

      const smap = {};
      sourceData.forEach(s => { smap[s.id] = s; });

      setCategoriesMap(cmap);
      setSourcesMap(smap);
      setTransactions(txData);
      
      groupData(txData, currentPeriod, offset);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions(period, chartOffset);
  }, [period, chartOffset]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions(period, chartOffset);
    }, [period, chartOffset])
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
  
  const THEME_COLOR = '#3F8F6B';

  const chartValues = useMemo(
    () => chartData?.datasets?.[0]?.data || [],
    [chartData]
  );

  const hasChartData = true; // We always show the 5 periods, even if empty

  const filteredTransactions = useMemo(() => {
    if (!selectedBar?.label) return transactions;
    return transactions.filter(tx => getPeriodKey(tx.date, period) === selectedBar.label);
  }, [transactions, selectedBar, period]);

  const groupedTransactions = useMemo(() => {
    const groups = {};

    filteredTransactions.forEach(item => {
      const dateStr = String(item.date).replace(' ', 'T');
      const date = new Date(dateStr);
      let key = '';
      let title = '';
      let sortVal = 0;

      if (period === 'year') {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        title = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        sortVal = date.getFullYear() * 100 + date.getMonth();
      } else if (period === 'month') {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        key = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`;
        title = `${startOfWeek.getDate()} ${monthNamesShort[startOfWeek.getMonth()]} - ${endOfWeek.getDate()} ${monthNamesShort[endOfWeek.getMonth()]}`;
        sortVal = startOfWeek.getTime();
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const dMidnight = new Date(date);
        dMidnight.setHours(0, 0, 0, 0);
        
        if (dMidnight.getTime() === today.getTime()) {
          title = 'Today';
        } else if (dMidnight.getTime() === yesterday.getTime()) {
          title = 'Yesterday';
        } else {
          title = date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
        }
        sortVal = dMidnight.getTime();
      }

      if (!groups[key]) {
        groups[key] = {
          title,
          sortVal,
          data: []
        };
      }
      groups[key].data.push(item);
    });

    return Object.values(groups)
      .sort((a, b) => b.sortVal - a.sortVal)
      .map(group => {
        const dailyTotal = group.data.reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );
        return {
          title: group.title,
          data: group.data,
          dailyTotal
        };
      });
  }, [filteredTransactions, period]);

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
                ₹
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
          { borderColor: rgbaFromColor(THEME_COLOR, 0.14) }
        ]}
      >

        <View style={{ alignItems: 'center', marginBottom: 8, marginTop: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {period === 'day' ? 'Days' : period === 'week' ? 'Weeks' : period === 'month' ? 'Months' : 'Years'}
          </Text>
        </View>

        <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
          
          <TouchableOpacity 
            onPress={() => setChartOffset(prev => Math.max(0, prev - 1))} 
            style={{ 
              position: 'absolute', left: -4, zIndex: 10,
              width: 34, height: 34, borderRadius: 17, 
              backgroundColor: 'rgba(255,255,255,0.85)', 
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
              opacity: chartOffset === 0 ? 0.3 : 1
            }} 
            disabled={chartOffset === 0}
          >
            <Feather name="chevron-left" size={20} color={Colors.text} />
          </TouchableOpacity>

          <PremiumRoundedBarChart
            labels={chartData.labels}
            values={chartValues}
            width={screenWidth - 48}
            height={220}
            baseColor={THEME_COLOR}
            isEmpty={!hasChartData}
            selectedLabel={selectedBar?.label}
            onBarPress={(data) => {
              setSelectedBar({
                label: data.label,
                value: data.value
              });
            }}
          />

          <TouchableOpacity 
            onPress={() => setChartOffset(prev => prev + 1)} 
            style={{ 
              position: 'absolute', right: -4, zIndex: 10,
              width: 34, height: 34, borderRadius: 17, 
              backgroundColor: 'rgba(255,255,255,0.85)', 
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
            }}
          >
            <Feather name="chevron-right" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {selectedBar?.label && (
          <View style={styles.filterBanner}>
            <Text style={styles.filterText}>Filtering: {selectedBar.label}</Text>
            <TouchableOpacity onPress={() => setSelectedBar(null)}>
              <Text style={styles.clearFilterText}>Clear Filter</Text>
            </TouchableOpacity>
          </View>
        )}

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
                setChartOffset(0);
                setPeriod(p);
              }}
              mode="flat"
              style={[
                styles.chip,
                {
                  backgroundColor: active
                    ? THEME_COLOR
                    : rgbaFromColor(THEME_COLOR, 0.08),
                  borderColor: active
                    ? THEME_COLOR
                    : rgbaFromColor(THEME_COLOR, 0.22)
                }
              ]}
              textStyle={[
                styles.chipText,
                {
                  color: active ? '#FFFFFF' : THEME_COLOR
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
                    color: Colors.text,
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

      {loading && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 10 }]}>
          <ActivityIndicator size="large" color={THEME_COLOR} />
        </View>
      )}
      
      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Transaction"
        message="Are you sure?"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={handleDeleteConfirm}
      />

      <FAB
        onPress={() =>
          navigation.navigate('TransactionAdd', {
            categoryId: Number(categoryId),
          })
        }
        style={{
          position: 'absolute',
          bottom: 70,
          right: 20,
          zIndex: 20,
          elevation: 20,
        }}
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

  filterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e6f7ff',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    marginHorizontal: 8,
  },
  filterText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  clearFilterText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
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
