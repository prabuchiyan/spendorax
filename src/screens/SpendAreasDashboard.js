import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getCategorySpending } from '../services/reports';
import { getCategories } from '../services/categories';
import { getTransactions } from '../services/transactions';
import { Avatar, Chip } from 'react-native-paper';
import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';

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
  const periodScrollRef = useRef(null);
  const periodChipPositions = useRef({});
  const periodScrollWidth = useRef(0);
  const [transactions, setTransactions] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [filterMode, setFilterMode] = useState(params.mode || 'monthly');
  const [selectedPeriod, setSelectedPeriod] = useState(params.periodLabel || null);

  async function loadInitialData() {
    try {
      const catsAll = await getCategories(true);
      const cmap = {};
      catsAll.forEach(c => { cmap[c.id] = c; });
      setCategoriesMap(cmap);

      const tx = await getTransactions(1000000);
      setTransactions(tx);
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

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

    // Oldest → newest
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
      const dateStr = String(t.date).replace(' ', 'T');
      if (!filterFn(dateStr)) return;
      const cid = t.category_id || 'uncategorized';
      byId[cid] = (byId[cid] || 0) + (parseFloat(t.amount) || 0);
    });

    return Object.keys(byId).map(k => {
      const cat = categoriesMap[k] || { name: 'Uncategorized' };
      return { category_id: k, category_name: cat.name, amount: byId[k] };
    }).sort((a, b) => b.amount - a.amount);
  }, [transactions, selectedPeriod, filterMode, categoriesMap]);

  const totalSpend = useMemo(() => {
    return topCategories.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  }, [topCategories]);

  const focusSelectedPeriod = useCallback((period) => {
    if (!period) return;

    const position =
      periodChipPositions.current[period];

    if (!position) return;

    const chipCenter =
      position.x + position.width / 2;

    const targetX =
      chipCenter -
      periodScrollWidth.current / 2;

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
                periodScrollWidth.current =
                  event.nativeEvent.layout.width;

                // Focus selected month after the ScrollView
                // has received its actual width.
                if (selectedPeriod) {
                  requestAnimationFrame(() => {
                    focusSelectedPeriod(selectedPeriod);
                  });
                }
              }}
            >
              {allPeriods.map((p) => {
                const isSelected =
                  selectedPeriod === p;

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

                      // If this is the selected month,
                      // focus it after its position is known.
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
          <Text style={{ fontWeight: '700', marginBottom: 8, fontSize: 16, color: Colors.text }}>
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
                onPress={() => navigation.navigate('CategoriesDetails', {
                  categoryId: c.category_id,
                  categoryName: c.category_name,
                  mode: filterMode,
                  periodLabel: selectedPeriod
                })}
              >
                <View
                  style={[
                    styles.categoryRowContainer,
                    isTargetCategory && styles.highlightCategoryRow
                  ]}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Avatar.Icon
                        size={34}
                        icon={icon}
                        style={{
                          backgroundColor: color,
                          marginRight: 10
                        }}
                        color="#fff"
                      />

                      <Text style={{ color: Colors.text, fontWeight: '500' }}>
                        {c.category_name}
                      </Text>
                    </View>
                    <Text style={{ color: '#E46A6A', fontWeight: '600' }}>
                      ₹{amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: '#eee',
                      borderRadius: 4,
                      overflow: 'hidden'
                    }}
                  >
                    <View
                      style={{
                        width: `${percent}%`,
                        height: '100%',
                        backgroundColor: color
                      }}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </Card>
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
    marginBottom: 12,
    padding: 8,
    borderRadius: 8,
  },
  highlightCategoryRow: {
    backgroundColor: '#fffbe6',
    borderWidth: 1,
    borderColor: '#ffe58f',
  },
});
