import React, { useEffect, useState, useLayoutEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView
} from 'react-native';
import { getTransactions, deleteTransaction } from '../services/transactions';
import { getCategories } from '../services/categories';
import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ConfirmDialog from '../components/ConfirmDialog';
import { Chip } from 'react-native-paper';

const screenWidth = Dimensions.get('window').width;
const BAR_TRACK_HEIGHT = 170;

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return null;

  let cleanHex = hex.replace('#', '').trim();

  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map(char => char + char)
      .join('');
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

const getPremiumBarColor = (baseColor, index, total, opacity = 1) => {
  const safeColor = baseColor || Colors.primary;
  const rgb = hexToRgb(safeColor);

  if (!rgb) {
    return `rgba(76, 110, 245, ${Math.max(0.84, opacity)})`;
  }

  const spread = total > 1 ? index / (total - 1) : 0;
  const lightenAmount = 0.04 + spread * 0.16;

  const r = Math.round(rgb.r + (255 - rgb.r) * lightenAmount);
  const g = Math.round(rgb.g + (255 - rgb.g) * lightenAmount);
  const b = Math.round(rgb.b + (255 - rgb.b) * lightenAmount);

  const finalOpacity = Math.min(1, Math.max(0.84, opacity));

  return `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
};

const formatCompactAmount = (amount) => {
  const num = Number(amount || 0);
  const abs = Math.abs(num);

  if (abs >= 10000000) {
    return `₹${(num / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`;
  }

  if (abs >= 100000) {
    return `₹${(num / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  }

  if (abs >= 1000) {
    return `₹${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }

  return `₹${num.toLocaleString('en-IN')}`;
};

function PremiumRoundedBarChart({
  labels = [],
  values = [],
  width,
  height = 250,
  baseColor,
  onBarPress,
  isEmpty = false
}) {
  if (isEmpty) {
    return (
      <View style={[styles.emptyChartArea, { width, height }]}>
        <Text style={styles.emptyChartText}>No transactions yet</Text>
      </View>
    );
  }

  const maxValue = Math.max(...values, 1);
  const chartInnerWidth = Math.max(width, labels.length * 54);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingRight: 8 }}
    >
      <View style={[styles.customChartWrap, { width: chartInnerWidth, height }]}>
        <View style={styles.customChartBarsRow}>
          {values.map((value, index) => {
            const total = values.length || 1;
            const barColor = getPremiumBarColor(baseColor, index, total, 1);
            const barHeight = maxValue > 0 ? (value / maxValue) * BAR_TRACK_HEIGHT : 0;

            return (
              <TouchableOpacity
                key={`${labels[index]}-${index}`}
                activeOpacity={0.85}
                style={styles.customBarItem}
                onPress={() =>
                  onBarPress?.({
                    index,
                    value,
                    label: labels[index]
                  })
                }
              >
                <View style={styles.customBarTrack}>
                  <View
                    style={[
                      styles.customBarGroup,
                      {
                        height: barHeight + 22
                      }
                    ]}
                  >
                    <Text numberOfLines={1} style={styles.customBarValue}>
                      {formatCompactAmount(value)}
                    </Text>

                    <View
                      style={[
                        styles.customBar,
                        {
                          height: barHeight,
                          backgroundColor: barColor,
                          borderRadius: 18
                        }
                      ]}
                    />
                  </View>
                </View>

                <Text numberOfLines={1} style={styles.customBarLabel}>
                  {labels[index]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

export default function CategoriesDetails({ route, navigation }) {
  const { categoryId, categoryName, mode, periodLabel } = route.params || {};

  const [transactions, setTransactions] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
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

      const [txData, catData] = await Promise.all([
        getTransactions(1000000, null, null, categoryId, null),
        getCategories(true)
      ]);

      const cmap = {};
      catData.forEach(c => { cmap[c.id] = c; });

      const filtered = txData.filter(tx => tx.category_id === Number(categoryId));

      setCategoriesMap(cmap);
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

  const renderItem = ({ item }) => {
    const isExpense = item.type === 'expense';
    const category = categoriesMap[item.category_id] || {};

    return (
      <Card style={styles.txCard}>
        <View style={styles.txContent}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: rgbaFromColor(category.color || '#999999', 0.10) }
            ]}
          >
            <MaterialCommunityIcons
              name={category.icon || 'tag'}
              size={22}
              color={category.color || Colors.muted}
            />
          </View>

          <View style={styles.txTextBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {item.notes || category.name || 'Untitled'}
            </Text>
            <Text style={styles.date}>{formatDate(item.date)}</Text>
          </View>

          <View style={styles.rightBlock}>
            <Text style={[styles.amount, { color: isExpense ? '#D14343' : '#1E8E5A' }]}>
              ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('TransactionAdd', { isEdit: true, transaction: item })}
              >
                <Feather name="edit-2" size={14} color={Colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => {
                  setConfirmTargetId(item.id);
                  setConfirmVisible(true);
                }}
              >
                <Feather name="trash-2" size={14} color="#d32f2f" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Card>
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
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
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
    padding: Spacing.m
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

  customChartWrap: {
    justifyContent: 'flex-end'
  },

  customChartBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 2
  },

  customBarItem: {
    width: 42,
    marginRight: 10,
    alignItems: 'center'
  },

  customBarTrack: {
    width: 38,
    height: BAR_TRACK_HEIGHT + 22,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'transparent'
  },

  customBarGroup: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end'
  },

  customBarValue: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
    maxWidth: 56,
    textAlign: 'center'
  },

  customBarValueEmpty: {
    color: Colors.muted,
    fontWeight: '700'
  },

  customBar: {
    width: 28
  },

  customBarLabel: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted
  },

  emptyChartArea: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },

  emptyChartText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted
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
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
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
    paddingVertical: 2
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
