import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Platform, Pressable } from 'react-native';
import { Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { getTransactions } from '../services/transactions';
import { getCategories } from '../services/categories';
import { groupTransactions } from '../services/reports';
import { formatCurrency, formatCompactAmount } from '../utils/numberUtils';
import { getLabelForDate } from '../utils/dateUtils';
import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import events from '../services/events';

const getCurrentPeriodLabel = (m) => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  
  if (m === 'daily') {
    return dateStr;
  }
  if (m === 'weekly') {
    const day = d.getDay();
    const diff = d.getDate() - day;
    const weekStart = new Date(d.setDate(diff));
    return `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`;
  }
  if (m === 'monthly') {
    return dateStr.substring(0, 7);
  }
  if (m === 'yearly') {
    return dateStr.substring(0, 4);
  }
  return null;
};

const hexToRgba = (hex, alpha = 0.15) => {
  if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(char => char + char).join('');
  if (cleanHex.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const ReportItemCard = React.memo(({ data, categoriesMap, onCategoryPress }) => {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.periodLabel}>{data.label}</Text>
        <Text style={[styles.netBalance, { color: data.balance >= 0 ? '#36B37E' : '#E46A6A' }]}>
          Net: ₹{data.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      </View>
      <View style={styles.detailsRow}>
        <Text style={styles.incomeText}>+ ₹{data.income.toLocaleString('en-IN')}</Text>
        <Text style={styles.expenseText}>- ₹{data.expense.toLocaleString('en-IN')}</Text>
      </View>

      <View style={styles.categoryBreakdown}>
        {Object.entries(data.categories)
          .sort((a, b) => Math.max(b[1].income, b[1].expense) - Math.max(a[1].income, a[1].expense))
          .map(([cid, totals]) => {
          const cat = categoriesMap[cid] || { name: 'Uncategorized', icon: 'help-circle', color: '#999' };
          const isExpense = totals.expense > 0;
          const amount = isExpense ? totals.expense : totals.income;
          const totalAmount = Math.max(isExpense ? data.expense : data.income, 1);
          const percentage = (amount / totalAmount) * 100;

          return (
            <Pressable
              key={cid}
              style={({ pressed }) => [
                styles.catRow,
                pressed && { backgroundColor: hexToRgba(cat.color, 0.05), borderColor: hexToRgba(cat.color, 0.2) }
              ]}
              onPress={() => onCategoryPress(cid, cat.name, data.label)}
            >
              <View style={styles.catInfo}>
                <View style={[styles.catIconContainer, { backgroundColor: hexToRgba(cat.color, 0.12) }]}>
                  <MaterialCommunityIcons
                    name={cat.icon || 'tag'}
                    size={22}
                    color={cat.color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
                    <Text style={styles.catName}>{cat.name}</Text>
                    <Text style={[styles.catAmount, { color: isExpense ? '#E46A6A' : '#36B37E' }]}>
                      {isExpense ? '-' : '+'}₹{amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.progressBarBackground}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(100, percentage)}%`, backgroundColor: cat.color }]} />
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
});

export default function ReportsScreen() {
  const [transactions, setTransactions] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [mode, setMode] = useState('monthly');
  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentPeriodLabel('monthly'));
  const [chartOffset, setChartOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tx, cats] = await Promise.all([
        getTransactions(1000000),
        getCategories(true)
      ]);
      const cmap = {};
      cats.forEach(c => {
        cmap[c.id] = c;
      });
      setCategoriesMap(cmap);
      setTransactions(tx);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const refresh = () => {
      loadData();
    };
    events.on('transactionsChanged', refresh);
    return () => {
      events.off('transactionsChanged', refresh);
    };
  }, [loadData]);

  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    setSelectedPeriod(getCurrentPeriodLabel(newMode));
    setChartOffset(0);
  }, []);

  const handleCategoryPress = useCallback((categoryId, categoryName, periodLabel) => {
    navigation.navigate('CategoriesDetails', {
      categoryId,
      categoryName,
      periodLabel,
      mode
    });
  }, [navigation, mode]);

  const reportData = useMemo(() => {
    return groupTransactions(transactions, mode);
  }, [transactions, mode]);

  const filteredReportData = useMemo(() => {
    if (!selectedPeriod) return reportData;
    return reportData.filter(d => d.label === selectedPeriod);
  }, [reportData, selectedPeriod]);

  const displayReportData = useMemo(() => {
    return reportData.slice(chartOffset, chartOffset + 5);
  }, [reportData, chartOffset]);

  const maxAmount = useMemo(() => {
    if (!displayReportData || displayReportData.length === 0) return 100;
    const points = displayReportData.map(d => Math.max(d.income || 0, d.expense || 0));
    const max = Math.max(...points);
    return max > 0 ? max : 100;
  }, [displayReportData]);

  const formatLabel = useCallback((label) => {
    let dateStr = label;
    if (mode === 'monthly' && label.length === 7) {
      dateStr += '-01'; // ensure correct parsing
    }
    const d = new Date(dateStr);
    const result = getLabelForDate(d, mode);
    return result || label;
  }, [mode]);

  const renderHeader = useMemo(() => {
    return (
      <View>
        <Card style={styles.chartCard}>
          <Text style={styles.chartTitle}>Income vs Expense Chart</Text>
          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading report...</Text>
            </View>
          ) : reportData.length === 0 ? (
            <Text style={styles.emptyText}>No data available for the selected period</Text>
          ) : (
            <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
              
              <TouchableOpacity 
                onPress={() => setChartOffset(prev => Math.max(0, prev - 1))} 
                style={{ 
                  position: 'absolute', left: 4, zIndex: 10,
                  width: 34, height: 34, borderRadius: 17, 
                  backgroundColor: 'rgba(255,255,255,0.85)', 
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
                  opacity: chartOffset === 0 ? 0.3 : 1
                }} 
                disabled={chartOffset === 0}
              >
                <MaterialCommunityIcons name="chevron-left" size={20} color={Colors.text} />
              </TouchableOpacity>

              <View style={[styles.chartOuterRow, { width: '100%', justifyContent: 'space-evenly', paddingHorizontal: 24 }]}>
                {displayReportData.map((data, idx) => {
                  const isSelected = selectedPeriod === data.label;
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => setSelectedPeriod(prev => prev === data.label ? null : data.label)}
                      style={[
                        styles.chartColumn,
                        { marginHorizontal: 0, width: '18%' },
                        selectedPeriod && !isSelected && { opacity: 0.4 }
                      ]}
                    >
                        <View style={[
                          styles.barContainer,
                          isSelected && styles.selectedBarContainer
                        ]}>
                          <View
                            style={[
                              styles.bar,
                              styles.incomeBar,
                              { height: `${Math.max((data.income / maxAmount) * 100, 2)}%` }
                            ]}
                          />
                          <View
                            style={[
                              styles.bar,
                              styles.expenseBar,
                              { height: `${Math.max((data.expense / maxAmount) * 100, 2)}%` }
                            ]}
                          />
                        </View>
                        <Text style={[styles.axisLabel, isSelected && styles.selectedAxisLabel]} numberOfLines={1}>
                          {formatLabel(data.label)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

              <TouchableOpacity 
                onPress={() => setChartOffset(prev => prev + 1)} 
                style={{ 
                  position: 'absolute', right: 4, zIndex: 10,
                  width: 34, height: 34, borderRadius: 17, 
                  backgroundColor: 'rgba(255,255,255,0.85)', 
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
                  opacity: chartOffset >= reportData.length - 5 ? 0.3 : 1
                }}
                disabled={chartOffset >= reportData.length - 5}
              >
                <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.text} />
              </TouchableOpacity>

              {selectedPeriod && (
                <View style={styles.filterBanner}>
                  <Text style={styles.filterText}>Filtering: {formatLabel(selectedPeriod)}</Text>
                  <Pressable onPress={() => setSelectedPeriod(null)}>
                    <Text style={styles.clearFilterText}>Clear Filter</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {!loading && reportData.length > 0 && (
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: '#36B37E' }]} />
                <Text style={styles.legendText}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: '#E46A6A' }]} />
                <Text style={styles.legendText}>Expense</Text>
              </View>
            </View>
          )}
        </Card>
      </View>
    );
  }, [loading, reportData, displayReportData, maxAmount, formatLabel, selectedPeriod, chartOffset]);

  const renderItem = useCallback(({ item }) => {
    return <ReportItemCard data={item} categoriesMap={categoriesMap} onCategoryPress={handleCategoryPress} />;
  }, [categoriesMap, handleCategoryPress]);

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        {['daily', 'weekly', 'monthly', 'yearly'].map((m) => (
          <Chip
            key={m}
            mode="outlined"
            selected={mode === m}
            onPress={() => handleModeChange(m)}
            style={[styles.chip, mode === m && { borderColor: Colors.primary, backgroundColor: '#e6f7ff' }]}
            selectedColor={Colors.primary}
            showSelectedCheck={false}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </Chip>
        ))}
      </View>

      {loading && reportData.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading report...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReportData}
          keyExtractor={item => item.label}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 40 }}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== 'web'}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.xs,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 600,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  chartCard: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    color: Colors.muted,
  },
  chartScrollContainer: {
    paddingHorizontal: 8,
  },
  chartOuterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
  },
  chartColumn: {
    width: 50,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    justifyContent: 'center',
    width: '100%',
  },
  bar: {
    width: 10,
    borderRadius: 5,
    marginHorizontal: 2,
  },
  incomeBar: {
    backgroundColor: '#36B37E',
  },
  expenseBar: {
    backgroundColor: '#E46A6A',
  },
  axisLabel: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 8,
    textAlign: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
  },
  emptyText: {
    color: Colors.muted,
    marginVertical: 40,
    textAlign: 'center',
  },
  itemCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#f5f5f5',
    paddingBottom: 10,
  },
  periodLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  netBalance: {
    fontSize: 14,
    fontWeight: '800',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  incomeText: {
    fontSize: 13,
    color: '#36B37E',
    fontWeight: '600',
  },
  expenseText: {
    fontSize: 13,
    color: '#E46A6A',
    fontWeight: '600',
  },
  categoryBreakdown: {
    marginTop: 12,
  },
  catRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  catIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  catInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  catName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressBarBackground: {
    width: '100%',
    height: 5,
    backgroundColor: '#EAEAEA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  selectedBarContainer: {
    borderBottomWidth: 3,
    borderColor: Colors.primary,
    paddingBottom: 2,
  },
  selectedAxisLabel: {
    color: Colors.primary,
    fontWeight: '700',
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
});
