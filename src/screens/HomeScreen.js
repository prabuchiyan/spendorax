import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCategorySpending } from '../services/reports';
import { getBudgetsWithRemaining } from '../services/budgets';
import { getCategoryBudgetSummary } from '../services/categoryBudgets';
import { getTransactions } from '../services/transactions';
import { getBillsForCurrentMonth } from '../services/bills';
import { getBillDisplayStatus, formatCurrency } from '../services/billUtils';
import { getSources } from '../services/sources';
import { getCategories } from '../services/categories';
import { Avatar, Button as PaperButton } from 'react-native-paper';
import events from '../services/events';
import Card from '../components/Card';
import FAB from '../components/FAB';
import { Colors, Spacing } from '../components/Theme';
import BottomStatsBar from '../components/BottomStatsBar';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext';
import { usePageLoader } from '../context/PageLoaderContext';

function daysRemainingInMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  return last - now.getDate();
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function BudgetDonut({ limit = 0, spent = 0, remaining = 0, daysLeft = 0, balanceVisible = true }) {
  const percentRaw = limit > 0 ? (spent / limit) : 0;
  const percent = Math.max(0, percentRaw);
  const pct = limit > 0 ? Math.min(100, Math.round(percent * 100)) : 0;
  const color = percent <= 1 ? (percent < 0.7 ? '#14B8A6' : '#FFB020') : '#E46A6A';
  const innerColor = remaining >= 0 ? '#14B8A6' : '#E46A6A';
  const size = 180;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Animated progress
  const safePercent = isNaN(percent) ? 0 : percent;

  const anim = React.useRef(new Animated.Value(Math.min(1, safePercent))).current;
  React.useEffect(() => {
    Animated.timing(anim, { toValue: Math.min(1, percent), duration: 700, useNativeDriver: false }).start();
  }, [percent]);

  const dashAnim = anim.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });

  function fmt(v) {
    return `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#eee" strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashAnim}
          rotation="-90"
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={{ position: 'absolute', width: size * 0.7, alignItems: 'center', justifyContent: 'center', padding: 6 }}>
        <Text style={{ fontWeight: '700', color: innerColor, textAlign: 'center' }}>
          {remaining >= 0
            ? `Safe to Spend: ${balanceVisible ? fmt(remaining) : '••••••'}`
            : `Overspent: ${balanceVisible ? fmt(Math.abs(remaining)) : '••••••'}`}
        </Text>
        <Text style={{ fontSize: 13, color: '#667085', marginTop: 6, textAlign: 'center' }}>{daysLeft} day(s) left</Text>
        {limit > 0 ? <Text style={{ fontSize: 11, color: '#999', marginTop: 6 }}>Used: {pct}%</Text> : null}
      </View>
    </View>
  );
}

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

export default function HomeScreen({ navigation }) {
  const { balanceVisible } = useBalanceVisibility();
  const { show: showPageLoader, hide: hidePageLoader } = usePageLoader();
  const [topCategories, setTopCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [sourceBalances, setSourceBalances] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [recentTx, setRecentTx] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [bills, setBills] = useState([]);
  const [billsSummary, setBillsSummary] = useState(null);
  const [categoryBudgets, setCategoryBudgets] = useState([]);

  /* Prevent multiple Home loads from running at the same time. */
  const loadingRef = React.useRef(false);
  /* Track whether Home has already loaded once. */
  const hasLoadedRef = React.useRef(false);
  /* Used to request a lightweight refresh when returning to Home after another screen. */
  const refreshPendingRef = React.useRef(false);

  async function load({
    showLoader = true,
    force = false,
  } = {}) {
    /* Don't allow multiple database loads at the same time. */
    if (loadingRef.current) {
      return [];
    }
    /* If Home is already loaded and this isn't an explicit refresh, don't perform another complete reload.  */
    if (hasLoadedRef.current && !force) {
      return [];
    }
    loadingRef.current = true;

    if (showLoader) {
      showPageLoader();
    }
    try {
      // CATEGORIES
      try {
        const catsAll = await getCategories(true);
        const cmap = {};
        catsAll.forEach(c => {
          cmap[c.id] = c;
        });
        setCategoriesMap(cmap);
      } catch (e) {
        console.error(
          'Error loading categories:',
          e
        );
      }

      // BILLS
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const bl = await getBillsForCurrentMonth({
          sortBy: 'due_date',
        });
        // Only bills belonging to the CURRENT month.
        const currentMonthBills = (
          Array.isArray(bl) ? bl : []
        ).filter(bill => {
          if (!bill?.due_date) return false;
          const dueDate = new Date(bill.due_date);
          if (isNaN(dueDate.getTime())) return false;
          return (
            dueDate.getFullYear() === currentYear &&
            dueDate.getMonth() === currentMonth
          );
        });

        // Current month bills sorted by due date.
        currentMonthBills.sort(
          (a, b) =>
            new Date(a.due_date).getTime() -
            new Date(b.due_date).getTime()
        );

        setBills(currentMonthBills);
        /*
         * Calculate summary ONLY from current-month bills.
         */
        const currentMonthSummary = currentMonthBills.reduce(
          (summary, bill) => {
            const amount = Number(bill.amount || 0);
            const dueDate = new Date(bill.due_date);
            if (isNaN(dueDate.getTime())) {
              return summary;
            }
            const isPaid =
              String(
                bill.status ||
                bill.payment_status ||
                ''
              ).toLowerCase() === 'paid';

            /*
             * Total current-month bills
             */
            summary.totalThisMonth += amount;
            /*
             * Paid current-month bills
             */
            if (isPaid) {
              summary.totalPaid += amount;
              return summary;
            }
            /*
             * Unpaid bill:
             *
             * Due date before today = OVERDUE
             * Due date today/future = upcoming
             */
            const dueStart = new Date(
              dueDate.getFullYear(),
              dueDate.getMonth(),
              dueDate.getDate()
            );
            const todayStart = new Date(
              currentYear,
              currentMonth,
              now.getDate()
            );
            if (dueStart < todayStart) {
              summary.overdueAmount += amount;
            }
            /*
             * Next 7 days
             */
            const sevenDaysFromNow = new Date(now);
            sevenDaysFromNow.setHours(23, 59, 59, 999);
            sevenDaysFromNow.setDate(
              sevenDaysFromNow.getDate() + 7
            );
            if (
              dueDate >= now &&
              dueDate <= sevenDaysFromNow
            ) {
              summary.upcoming7 += amount;
            }
            return summary;
          },
          {
            totalThisMonth: 0,
            totalPaid: 0,
            overdueAmount: 0,
            upcoming7: 0,
          }
        );
        setBillsSummary(currentMonthSummary);
      } catch (e) {
        console.error(
          'Error loading bills:',
          e
        );
        setBills([]);
        setBillsSummary(null);
      }

      // SOURCES
      // Same calculation as SourcesDashboard:
      // Initial Balance
      // + Income
      // - Expense
      // Credit cards are NOT removed here because the
      // source list itself is needed by the dashboard.
      let availableSources = [];

      try {
        availableSources = await getSources(true);
        setSources(
          availableSources
        );
      } catch (e) {
        console.error(
          'Error loading sources:',
          e
        );
        setSources([]);
      }

      // SOURCE TRANSACTIONS / BALANCES
      try {
        const allTransactions = await getTransactions(1000000, 'Yes');
        const balanceMap = allTransactions.reduce(
          (acc, txn) => {
            const amount = Number(txn.amount || 0);
            const sourceId = txn.source_id;
            if (!sourceId) { return acc; }
            if (!acc[sourceId]) { acc[sourceId] = 0; }
            if (txn.type === 'income') { acc[sourceId] += amount; }
            else if (txn.type === 'expense') { acc[sourceId] -= amount; }
            return acc;
          },
          {}
        );

        const calculatedSourceBalances = availableSources.map(
          source => ({
            ...source,
            balance: Number(source.initial_balance || 0) + Number(balanceMap[source.id] || 0),
          })
        );
        setSourceBalances(calculatedSourceBalances);
      } catch (e) {
        console.error(
          'Error calculating source balances:',
          e
        );
        setSourceBalances([]);
      }

      // BUDGETS
      let bs = [];
      try {
        bs = await getBudgetsWithRemaining();
        console.debug && console.debug('Home.load budgets:', bs);
        setBudgets(bs);
        if (bs && bs.length && !selectedBudgetId) {
          const firstId = String(bs[0].budget.id);
          console.debug && console.debug('Home.load setSelectedBudgetId ->', firstId);
          setSelectedBudgetId(firstId);
        }
      } catch (e) {
        console.error('Error loading budgets:', e);
        setBudgets([]);
      }

      // TOP CATEGORY SPENDING
      try {
        const cats = await getCategorySpending();
        setTopCategories(cats);
      } catch (e) {
        console.error('Error loading category spending:', e);
        setTopCategories([]);
      }

      // CATEGORY BUDGETS
      try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const catBudgets = await getCategoryBudgetSummary(month, year);
        setCategoryBudgets(catBudgets);
      } catch (e) {
        console.error('Error loading category budgets:', e);
        setCategoryBudgets([]);
      }

      // RECENT TRANSACTIONS
      // This now executes because there is NO leftover
      // getSourceBalances() call crashing load().
      try {
        const tx = await getTransactions(3, 'Yes');
        setRecentTx(Array.isArray(tx) ? tx : []);
      } catch (e) {
        console.error('Error loading recent transactions:', e);
        setRecentTx([]);
      }
      return bs;
    } catch (e) {
      console.error('Home.load failed:', e);
      return [];
    } finally {
      loadingRef.current = false;
      hasLoadedRef.current = true;
      if (showLoader) {
        hidePageLoader();
      }
    }
  }

  /*
   * =========================================
   * INITIAL HOME LOAD
   * =========================================
   *
   * Only the first Home mount performs the
   * complete database load.
   */
  useEffect(() => {
    let mounted = true;
    (async () => {
      const bs = await load({
        showLoader: true,
        force: true,
      });
      if (mounted && bs && bs.length) {
        setSelectedBudgetId(String(bs[0].budget.id));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* HOME FOCUS */
  useEffect(() => {
    const unsubscribe =
      navigation.addListener('focus', () => {
        /* Only refresh if another part of the app explicitly marked Home as needing refresh. */
        if (!refreshPendingRef.current) {
          return;
        }
        refreshPendingRef.current = false;
        load({
          showLoader: false,
          force: true,
        });
      });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { load(); });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    const off = events.on(
      'transactionsChanged',
      () => {
        /* Mark Home dirty.
         * The actual refresh happens when Home is focused, 
         * avoiding unnecessary work while the user is still on another page. */
        refreshPendingRef.current = true;
        /* If Home is already visible, refresh immediately but WITHOUT the page loader. */
        if (hasLoadedRef.current) {
          refreshPendingRef.current = false;
          load({
            showLoader: false,
            force: true,
          });
        }
      }
    );
    return () => off();
  }, []);

  useEffect(() => {
    const offBills = events.on(
      'billsChanged',
      () => {
        refreshPendingRef.current = true;
        /* If Home is currently visible, update immediately without blocking UI. */
        if (hasLoadedRef.current) {
          refreshPendingRef.current = false;
          load({
            showLoader: false,
            force: true,
          });
        }
      }
    );
    return () => offBills();
  }, []);

  useEffect(() => {
    const off2 = events.on('budgetsChanged',
      async (id) => {
        console.debug && console.debug('Home.budgetsChanged received id:', id);
        if (id) {
          setSelectedBudgetId(
            String(id)
          );
        }
        refreshPendingRef.current = true;
        /* Home is already loaded, so refresh silently in the background.  */
        if (hasLoadedRef.current) {
          refreshPendingRef.current = false;
          const bs = await load({
            showLoader: false,
            force: true,
          });
          if (!id && bs && bs.length) {
            setSelectedBudgetId(String(bs[0].budget.id));
          }
        }
      }
    );
    return () => off2();
  }, []);

  const totalSpend = topCategories.reduce(
    (sum, c) => sum + Number(c.amount || 0),
    0
  );

  const sortedBills = [...bills].sort(
    (a, b) =>
      new Date(a.due_date || 0).getTime() -
      new Date(b.due_date || 0).getTime()
  );

  const totalBalance = sourceBalances
    .filter(
      source =>
        String(source.type || '').toLowerCase() !==
        'credit_card'
    )
    .reduce(
      (sum, source) =>
        sum + Number(source.balance || 0),
      0
    );

  const totalMonthlySpend = topCategories.reduce(
    (sum, c) => sum + Number(c.amount || 0),
    0
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        style={{
          flex: 1,
        }}
        contentContainerStyle={{
          paddingHorizontal: Spacing.xs,
          paddingTop: Spacing.xs,
          paddingBottom: 82,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          {budgets.length ? (
            <>
              {(() => {
                const sel = budgets.find(x => x?.budget?.id === selectedBudgetId) || budgets[0];
                if (!sel || !sel.budget) return null;
                const limit = Number(sel.budget?.monthly_limit ?? 0);
                const spent = Number(sel?.spent ?? 0);
                const remaining = Number(sel?.remaining ?? 0);
                const daysLeft = daysRemainingInMonth();
                return (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
                    <TouchableOpacity onPress={() => navigation.navigate('Budgets', { editId: sel.budget.id })}>
                      <BudgetDonut limit={limit} spent={spent} remaining={remaining} daysLeft={daysLeft} balanceVisible={balanceVisible} />
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </>
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingVertical: 16,
                width: '100%',
              }}
            >
              <TouchableOpacity onPress={() => navigation.navigate('Budgets')}>
                <BudgetDonut limit={0} spent={0} remaining={0} daysLeft={daysRemainingInMonth()} balanceVisible={balanceVisible} />
              </TouchableOpacity>

              <View
                style={{
                  marginTop: 12,
                  width: '100%',
                  maxWidth: 360,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontWeight: '700', fontSize: 16, textAlign: 'center' }}>
                  No budgets set
                </Text>

                <Text
                  style={{
                    color: Colors.muted,
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  Create a budget to track monthly spending and see safe/overspent amounts
                  here.
                </Text>

                <PaperButton
                  mode="contained"
                  onPress={() => navigation.navigate('Budgets')}
                  style={{ marginTop: 12 }}
                >
                  Create Budget
                </PaperButton>
              </View>
            </View>
          )}
        </Card>

        {categoryBudgets.length > 0 && (
          <Card>
            <Text
              style={{
                fontWeight: '700',
                marginBottom: 12,
              }}
            >
              Category Budgets
            </Text>

            {[...categoryBudgets]
              .sort((a, b) => b.percentage - a.percentage)
              .map(budget => {
                // Use the category's own color everywhere.
                const categoryColor =
                  budget.color || '#4B7CF3';

                return (
                  <TouchableOpacity
                    key={budget.id}
                    onPress={() =>
                      navigation.navigate(
                        'CategoriesDetails',
                        {
                          categoryId: budget.categoryId,
                          categoryName: budget.categoryName,
                        }
                      )
                    }
                    style={{
                      marginBottom: 16,
                    }}
                  >
                    {/* CATEGORY HEADER */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          flex: 1,
                        }}
                      >
                        <Avatar.Icon
                          size={36}
                          icon={budget.icon}
                          style={{
                            backgroundColor: categoryColor,
                            marginRight: 10,
                          }}
                        />

                        <View
                          style={{
                            flex: 1,
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: '600',
                              fontSize: 14,
                            }}
                          >
                            {budget.categoryName}
                          </Text>

                          <Text
                            style={{
                              fontSize: 12,
                              color: Colors.muted,
                            }}
                          >
                            {balanceVisible
                              ? `₹${Number(
                                budget.spent || 0
                              ).toLocaleString('en-IN')} / ₹${Number(
                                budget.budget || 0
                              ).toLocaleString('en-IN')}`
                              : '•••••• / ••••••'}
                          </Text>
                        </View>
                      </View>

                      {/* PERCENTAGE + REMAINING */}
                      <View
                        style={{
                          alignItems: 'flex-end',
                          marginLeft: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontWeight: '700',
                            color: categoryColor,
                            fontSize: 16,
                          }}
                        >
                          {Math.round(
                            Number(budget.percentage || 0)
                          )}
                          %
                        </Text>

                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: budget.exceeded
                              ? '#E46A6A'
                              : categoryColor,
                          }}
                        >
                          {balanceVisible
                            ? budget.exceeded
                              ? `+₹${Math.abs(
                                Number(
                                  budget.remaining || 0
                                )
                              ).toLocaleString('en-IN')}`
                              : `₹${Number(
                                budget.remaining || 0
                              ).toLocaleString('en-IN')}`
                            : '••••••'}
                        </Text>
                      </View>
                    </View>

                    {/* CATEGORY PROGRESS BAR */}
                    <View
                      style={{
                        height: 8,
                        backgroundColor: '#E8EDF3',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Number(
                                budget.percentage || 0
                              )
                            )
                          )}%`,
                          height: '100%',
                          backgroundColor: categoryColor,
                          borderRadius: 4,
                        }}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
          </Card>
        )}

        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <View>
              <Text
                style={{
                  fontWeight: '800',
                  fontSize: 16,
                  color: Colors.text,
                }}
              >
                Latest transactions
              </Text>

              <Text
                style={{
                  fontSize: 11,
                  color: Colors.muted,
                  marginTop: 2,
                }}
              >
                Your most recent activity
              </Text>
            </View>
          </View>
          {recentTx.length ? (
            recentTx.slice(0, 3).map((r, index) => {
              const cat = categoriesMap[r.category_id] || {};

              const source = sources.find(
                s => s.id === r.source_id
              );

              const type =
                String(r.type || '').toLowerCase();

              const isTransfer =
                type === 'transfer' ||
                r.transfer_group_id ||
                r.is_transfer;

              const transactionType =
                isTransfer
                  ? 'transfer'
                  : type === 'income'
                    ? 'income'
                    : 'expense';

              const amountColor =
                transactionType === 'income'
                  ? '#20A56A'
                  : transactionType === 'transfer'
                    ? '#718096'
                    : '#E35D6A';

              const amountPrefix =
                transactionType === 'income'
                  ? '+'
                  : transactionType === 'expense'
                    ? '-'
                    : '';

              const accentColor =
                transactionType === 'income'
                  ? '#20A56A'
                  : transactionType === 'transfer'
                    ? '#718096'
                    : '#E35D6A';

              const iconColor =
                cat.color || accentColor;

              const transactionDate =
                new Date(r.date);

              const dateText =
                transactionDate.toLocaleDateString(
                  undefined,
                  {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  }
                );

              const timeText =
                transactionDate.toLocaleTimeString(
                  undefined,
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                );

              return (
                <TouchableOpacity
                  key={r.id}
                  activeOpacity={0.88}
                  onPress={() => {
                    navigation.navigate(
                      'TransactionAdd',
                      {
                        isEdit: true,
                        transaction: r,
                      }
                    );
                  }}
                  style={{
                    marginBottom:
                      index ===
                        recentTx.slice(0, 3).length - 1
                        ? 4
                        : 8,
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

                      {/* CATEGORY ICON */}
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
                            cat.icon ||
                            (
                              transactionType ===
                                'income'
                                ? 'arrow-down-circle-outline'
                                : transactionType ===
                                  'transfer'
                                  ? 'swap-horizontal'
                                  : 'arrow-up-circle-outline'
                            )
                          }
                          size={23}
                          color="#FFFFFF"
                        />
                      </View>

                      {/* TRANSACTION DETAILS */}

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
                          {r.notes || 'No notes'}
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
                              {cat.name ||
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
                            {source?.name ||
                              'No source'}
                          </Text>
                        </View>
                      </View>

                      {/* RIGHT COLUMN */}
                      {/* AMOUNT + DATE */}
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
                          {balanceVisible
                            ? `${amountPrefix}₹${Number(
                              r.amount || 0
                            ).toFixed(2)}`
                            : '••••••'}
                        </Text>

                        {/* DATE */}

                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
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
                            justifyContent: 'flex-end',
                            marginTop: 3,
                            minHeight: 14,
                          }}
                        >
                          {transactionType ===
                            'transfer' ? (
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor:
                                  '#F1F3F5',
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
            })
          ) : (
            <Text
              style={{
                color: Colors.muted,
                paddingVertical: 8,
              }}
            >
              No recent transactions
            </Text>
          )}
          {recentTx.length > 2 && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Transactions')}
              style={{ alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ color: Colors.primary, fontWeight: '600' }}>
                See all ↓
              </Text>
            </TouchableOpacity>
          )}
        </Card>

        <Card>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>
            Spend Areas
          </Text>

          {topCategories.length ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('SpendAreasDashboard')}
            >
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <CategoryDonut data={topCategories} categoriesMap={categoriesMap} />
              </View>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: Colors.muted }}>No data</Text>
          )}

          {topCategories.slice(0, 3).map(c => {
            const cat = categoriesMap[c.category_id] || {};
            const color = cat.color || '#4B7CF3';
            const icon = cat.icon || 'tag';

            const amount = Number(c.amount || 0);
            const percent = totalSpend > 0 ? (amount / totalSpend) * 100 : 0;

            return (
              <TouchableOpacity
                onPress={() => navigation.navigate('CategoriesDetails', {
                  categoryId: c.category_id,
                  categoryName: c.category_name
                })}
              >
                <View key={c.category_id}
                  style={{ marginBottom: 12 }}
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
          {topCategories.length > 2 && (
            <TouchableOpacity
              onPress={() => navigation.navigate('SpendAreasDashboard')}
              style={{ alignItems: 'center', marginTop: 8 }}
            >
              <Text style={{ color: Colors.primary, fontWeight: '600' }}>
                See all ↓
              </Text>
            </TouchableOpacity>
          )}
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontWeight: '600' }}>Bills</Text>
            <Text
              style={{ color: Colors.primary, fontWeight: '600', fontSize: 13 }}
              onPress={() => navigation.navigate('Bills')}
            >
              View all ›
            </Text>
          </View>

          {billsSummary ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
              <View style={{ width: '50%', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: Colors.muted }}>This month</Text>
                <Text style={{ fontWeight: '700', color: Colors.text }}>{balanceVisible ? formatCurrency(billsSummary.totalThisMonth) : '••••••'}</Text>
              </View>
              <View style={{ width: '50%', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: Colors.muted }}>Paid</Text>
                <Text style={{ fontWeight: '700', color: '#36B37E' }}>{balanceVisible ? formatCurrency(billsSummary.totalPaid) : '••••••'}</Text>
              </View>
              <View style={{ width: '50%' }}>
                <Text style={{ fontSize: 11, color: Colors.muted }}>Overdue</Text>
                <Text style={{ fontWeight: '700', color: '#E46A6A' }}>{balanceVisible ? formatCurrency(billsSummary.overdueAmount) : '••••••'}</Text>
              </View>
              <View style={{ width: '50%' }}>
                <Text style={{ fontSize: 11, color: Colors.muted }}>Next 7 days</Text>
                <Text style={{ fontWeight: '700', color: '#FFB020' }}>{balanceVisible ? formatCurrency(billsSummary.upcoming7) : '••••••'}</Text>
              </View>
            </View>
          ) : null}

          {sortedBills.length ? sortedBills.slice(0, 5).map(b => {
            const display = getBillDisplayStatus(b);
            const catColor = categoriesMap[b.category_id]?.color || '#ccc';

            return (
              <View
                key={b.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 8
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: catColor,
                      marginRight: 8
                    }}
                  />
                  <View>
                    <Text style={{ color: Colors.text, fontWeight: '600' }}>
                      {b.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.muted }}>
                      Due: {b.due_date ? new Date(b.due_date).toLocaleDateString() : '—'}
                    </Text>
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '700', color: display.color }}>
                    {balanceVisible ? formatCurrency(b.amount) : '••••••'}
                  </Text>
                  <Text style={{ fontSize: 12, color: display.color }}>
                    {display.label}
                  </Text>
                </View>
              </View>
            );
          }) : (
            <Text style={{ color: Colors.muted }}>
              No bills added
            </Text>
          )}
        </Card>
      </ScrollView>
      <BottomStatsBar
        navigation={navigation}
        totalBalance={totalBalance}
        billsSummary={{
          count: bills.filter(bill => {
            const status = String(bill.status || '').toLowerCase();

            return (
              status !== 'paid' &&
              status !== 'skipped'
            );
          }).length,
          totalAmount: bills
            .filter(bill => {
              const status = String(bill.status || '').toLowerCase();

              return (
                status !== 'paid' &&
                status !== 'skipped'
              );
            })
            .reduce(
              (sum, bill) =>
                sum + Number(bill.amount || 0),
              0
            ),
        }}
        totalMonthlySpend={totalMonthlySpend}
        balanceVisible={balanceVisible}
      />
      <FAB
        onPress={() => navigation.navigate('TransactionAdd')}
        style={{
          position: 'absolute',
          bottom: 70,
          right: 20,
          zIndex: 20,
          elevation: 20
        }}
      />
    </View>
  );
}
