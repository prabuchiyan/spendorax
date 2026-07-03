import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, FlatList, Platform, Pressable } from 'react-native';
import { Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { getTransactions } from '../services/transactions';
import { getCategories } from '../services/categories';
import { groupTransactions } from '../services/reports';
import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
        {Object.entries(data.categories).map(([cid, totals]) => {
          const cat = categoriesMap[cid] || { name: 'Uncategorized', icon: 'help-circle', color: '#999' };
          const isExpense = totals.expense > 0;
          return (
            <Pressable
              key={cid}
              style={({ pressed }) => [
                styles.catRow,
                pressed && { backgroundColor: '#f0f0f0', borderRadius: 4 }
              ]}
              onPress={() => onCategoryPress(cid, cat.name, data.label)}
            >
              <View style={styles.catInfo}>
                <MaterialCommunityIcons
                  name={cat.icon || 'tag'}
                  size={16}
                  color={cat.color}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.catName}>{cat.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.catAmount, { color: isExpense ? '#E46A6A' : '#36B37E' }]}>
                  {isExpense ? '-' : '+'}₹{(isExpense ? totals.expense : totals.income).toLocaleString('en-IN')}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color="#ccc" style={{ marginLeft: 4 }} />
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
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        setLoading(true);
        const [tx, cats] = await Promise.all([
          getTransactions(1000000),
          getCategories(true)
        ]);
        if (active) {
          const cmap = {};
          cats.forEach(c => { cmap[c.id] = c; });
          setCategoriesMap(cmap);
          setTransactions(tx);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { active = false; };
  }, []);

  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    setSelectedPeriod(null);
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

  const maxAmount = useMemo(() => {
    if (!reportData || reportData.length === 0) return 100;
    const points = reportData.map(d => Math.max(d.income || 0, d.expense || 0));
    const max = Math.max(...points);
    return max > 0 ? max : 100;
  }, [reportData]);

  const formatLabel = useCallback((label) => {
    if (mode === 'daily') return label.substring(5);
    if (mode === 'monthly') {
      const parts = label.split('-');
      if (parts.length < 2) return label;
      const year = parts[0].substring(2);
      const month = parts[1];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const index = parseInt(month, 10) - 1;
      const monthName = months[index] || month;
      return `${monthName} '${year}`;
    }
    if (mode === 'weekly') return `Wk ${label.substring(8, 10)}`;
    return label;
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
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartScrollContainer}>
                <View style={styles.chartOuterRow}>
                  {reportData.map((data, idx) => {
                    const isSelected = selectedPeriod === data.label;
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => setSelectedPeriod(prev => prev === data.label ? null : data.label)}
                        style={[
                          styles.chartColumn,
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
              </ScrollView>
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
  }, [loading, reportData, maxAmount, formatLabel, selectedPeriod]);

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
    padding: Spacing.m,
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
    padding: 16,
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
    padding: 16,
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
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f9f9f9',
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catName: {
    fontSize: 12,
    color: Colors.text,
  },
  catAmount: {
    fontSize: 12,
    fontWeight: '600',
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
