import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { getTotalBalance, getCategorySpending, getMonthlyTrends, getSourceBalances } from '../services/reports';
import { getBudgetsWithRemaining } from '../services/budgets';
import { getCategoryBudgetSummary } from '../services/categoryBudgets';
import { getTransactions, deleteTransaction } from '../services/transactions';
import { getBills, getBillsSummary } from '../services/bills';
import { getBillDisplayStatus, formatCurrency } from '../services/billUtils';
import { getSources } from '../services/sources';
import ConfirmDialog from '../components/ConfirmDialog';
import { getCategories } from '../services/categories';
import { Avatar, Button as PaperButton } from 'react-native-paper';
import events from '../services/events';
import Card from '../components/Card';
import FAB from '../components/FAB';
import { Colors, Spacing } from '../components/Theme';
import BottomStatsBar from '../components/BottomStatsBar';

function daysRemainingInMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  return last - now.getDate();
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function BudgetDonut({ limit = 0, spent = 0, remaining = 0, daysLeft = 0 }) {
  const percentRaw = limit > 0 ? (spent / limit) : 0;
  const percent = Math.max(0, percentRaw);
  const pct = limit > 0 ? Math.min(100, Math.round(percent * 100)) : 0;
  const color = percent <= 1 ? (percent < 0.7 ? '#36B37E' : '#FFB020') : '#E46A6A';
  const innerColor = remaining >= 0 ? '#36B37E' : '#E46A6A';

  const size = 180;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(1, percent));

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
        <Text style={{ fontWeight: '700', color: innerColor, textAlign: 'center' }}> {remaining >= 0 ? `Safe to Spend: ${fmt(remaining)}` : `Overspent: ${fmt(Math.abs(remaining))}`} </Text>
        <Text style={{ fontSize: 13, color: '#666', marginTop: 6, textAlign: 'center' }}>{daysLeft} day(s) left</Text>
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
  const [balance, setBalance] = useState(null);
  const [topCategories, setTopCategories] = useState([]);
  const [trends, setTrends] = useState([]);
  const [sources, setSources] = useState([]);
  const [sourceBalances, setSourceBalances] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [recentTx, setRecentTx] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [categories, setCategories] = useState([]);
  const [confirmVisibleTx, setConfirmVisibleTx] = useState(false);
  const [confirmTxId, setConfirmTxId] = useState(null);
  const [confirmTxMessage, setConfirmTxMessage] = useState('Are you sure you want to delete this transaction?');
  const [bills, setBills] = useState([]);
  const [billsSummary, setBillsSummary] = useState(null);
  const [categoryBudgets, setCategoryBudgets] = useState([]);

  async function load() {
    // Load categories first to ensure we have colors/icons for reports
    try {
      const catsAll = await getCategories(true);
      const cmap = {};
      catsAll.forEach(c => { cmap[c.id] = c; });
      setCategoriesMap(cmap);
      setCategories(catsAll);
    } catch (e) {
      console.error('Error loading categories:', e);
    }

    const b = await getTotalBalance();
    setBalance(b);
    const t = await getMonthlyTrends(6);
    setTrends(t);
    const bl = await getBills({ sortBy: 'due_date' });
    setBills(bl);
    const bsum = await getBillsSummary();
    setBillsSummary(bsum);
    const availableSources = await getSources(true);
    setSources(availableSources);
    const sb = await getSourceBalances();
    setSourceBalances(sb);
    const bs = await getBudgetsWithRemaining();
    console.debug && console.debug('Home.load budgets:', bs);

    const cats = await getCategorySpending();
    setTopCategories(cats);

    setBudgets(bs);
    if (bs && bs.length && !selectedBudgetId) {
      const firstId = String(bs[0].budget.id);
      console.debug && console.debug('Home.load setSelectedBudgetId ->', firstId);
      setSelectedBudgetId(firstId);
    }

    // Load category budgets
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const catBudgets = await getCategoryBudgetSummary(month, year);
      setCategoryBudgets(catBudgets);
    } catch (e) {
      console.error('Error loading category budgets:', e);
    }

    // recent transactions
    try {
      const tx = await getTransactions(3, 'Yes');
      setRecentTx(tx);
    } catch (e) {
      // ignore
    }
    return bs;
  }

  useEffect(() => {
    (async () => {
      const bs = await load();
      if (bs && bs.length) setSelectedBudgetId(String(bs[0].budget.id));
    })();
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { load(); });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    const off = events.on('transactionsChanged', () => { load(); });
    return () => off();
  }, []);

  useEffect(() => {
    const offBills = events.on('billsChanged', () => { load(); });
    return () => offBills();
  }, []);

  useEffect(() => {
    const off2 = events.on('budgetsChanged', async (id) => {
      console.debug && console.debug('Home.budgetsChanged received id:', id);
      if (id) {
        console.debug && console.debug('Home.budgetsChanged setSelectedBudgetId ->', String(id));
        setSelectedBudgetId(String(id));
      }
      const bs = await load();
      if (!id && bs && bs.length) {
        console.debug && console.debug('Home.budgetsChanged setSelectedBudgetId after load ->', String(bs[0].budget.id));
        setSelectedBudgetId(String(bs[0].budget.id));
      }
    });
    return () => off2();
  }, []);

  const totalSpend = topCategories.reduce(
    (sum, c) => sum + Number(c.amount || 0),
    0
  );

  const sortedBills = [...bills].sort(
    (a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0)
  );

  const totalBalance = sourceBalances.reduce(
    (sum, s) => sum + Number(s.balance || 0),
    0
  );

  const totalMonthlySpend = topCategories.reduce(
    (sum, c) => sum + Number(c.amount || 0),
    0
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        contentContainerStyle={{
          padding: Spacing.m,
          paddingBottom: 120
        }}
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
                      <BudgetDonut limit={limit} spent={spent} remaining={remaining} daysLeft={daysLeft} />
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
                <BudgetDonut
                  limit={0}
                  spent={0}
                  remaining={0}
                  daysLeft={daysRemainingInMonth()}
                />
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
            <Text style={{ fontWeight: '700', marginBottom: 12 }}>Category Budgets</Text>
            {[...categoryBudgets].sort((a, b) => b.percentage - a.percentage).map(budget => {
              let barColor = '#36B37E'; // Green <80%
              if (budget.percentage >= 80 && budget.percentage <= 100) {
                barColor = '#FFB020'; // Orange 80-100%
              } else if (budget.percentage > 100) {
                barColor = '#E46A6A'; // Red >100%
              }

              return (
                <TouchableOpacity
                  key={budget.id}
                  onPress={() =>
                    navigation.navigate('CategoriesDetails', {
                      categoryId: budget.categoryId,
                      categoryName: budget.categoryName,
                    })
                  }
                  style={{ marginBottom: 16 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Avatar.Icon
                        size={36}
                        icon={budget.icon}
                        style={{ backgroundColor: budget.color, marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '600', fontSize: 14 }}>{budget.categoryName}</Text>
                        <Text style={{ fontSize: 12, color: Colors.muted }}>
                          ₹{budget.spent.toLocaleString('en-IN')} / ₹{budget.budget.toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                      <Text style={{ fontWeight: '700', color: barColor, fontSize: 16 }}>
                        {Math.round(budget.percentage)}%
                      </Text>
                      <Text style={{ fontSize: 11, color: budget.exceeded ? '#E46A6A' : '#36B37E' }}>
                        {budget.exceeded ? `+₹${Math.abs(budget.remaining).toLocaleString('en-IN')}` : `₹${budget.remaining.toLocaleString('en-IN')}`}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      height: 8,
                      backgroundColor: '#eee',
                      borderRadius: 4,
                      overflow: 'hidden'
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.min(100, budget.percentage)}%`,
                        height: '100%',
                        backgroundColor: barColor
                      }}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </Card>
        )}

        <Card>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Latest transactions</Text>
          {recentTx.length ? recentTx.slice(0, 3).map(r => {
            const cat = categoriesMap[r.category_id] || {};
            return (
              <View
                key={r.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 8
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Avatar.Icon
                    size={40}
                    icon={cat.icon || 'currency-usd'}
                    style={{
                      backgroundColor: cat.color || Colors.card,
                      marginRight: 12
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: Colors.text, fontWeight: '600' }}
                      numberOfLines={1}
                    >
                      {cat.name || 'Uncategorized'}
                    </Text>
                    <Text
                      style={{ color: Colors.muted, fontSize: 12 }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {r.notes || ''}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                  <Text
                    style={{
                      color: r.type === 'expense' ? '#E46A6A' : '#4CAF50',
                      fontWeight: '700'
                    }}
                  >
                    {r.type === 'expense'
                      ? `- ${Number(r.amount).toFixed(2)}`
                      : `+ ${Number(r.amount).toFixed(2)}`}
                  </Text>
                  <Text style={{ color: Colors.muted, fontSize: 12 }}>
                    {new Date(r.date).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            );
          }) : <Text style={{ color: Colors.muted }}>No recent transactions</Text>}
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
                <Text style={{ fontWeight: '700', color: Colors.text }}>{formatCurrency(billsSummary.totalThisMonth)}</Text>
              </View>
              <View style={{ width: '50%', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: Colors.muted }}>Paid</Text>
                <Text style={{ fontWeight: '700', color: '#36B37E' }}>{formatCurrency(billsSummary.totalPaid)}</Text>
              </View>
              <View style={{ width: '50%' }}>
                <Text style={{ fontSize: 11, color: Colors.muted }}>Overdue</Text>
                <Text style={{ fontWeight: '700', color: '#E46A6A' }}>{formatCurrency(billsSummary.overdueAmount)}</Text>
              </View>
              <View style={{ width: '50%' }}>
                <Text style={{ fontSize: 11, color: Colors.muted }}>Next 7 days</Text>
                <Text style={{ fontWeight: '700', color: '#FFB020' }}>{formatCurrency(billsSummary.upcoming7)}</Text>
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
                    {formatCurrency(b.amount)}
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

        <Card>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Top spends (this month)</Text>
          {topCategories.length ? topCategories.map(c => (
            <View key={c.category_id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ color: Colors.text }}>{c.category_name}</Text>
              <Text style={{ color: '#E46A6A' }}>-{Number(c.amount).toFixed(2)}</Text>
            </View>
          )) : <Text style={{ color: Colors.muted }}>No data</Text>}
        </Card>

        <Card>
          <Text style={{ fontWeight: '600', marginBottom: 8 }}>Monthly trends</Text>
          {trends.length ? trends.map(ti => (
            <View key={ti.month} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ color: Colors.text }}>{ti.month}</Text>
              <Text style={{ color: Colors.muted }}>+{ti.income.toFixed(0)} / -{ti.expense.toFixed(0)}</Text>
            </View>
          )) : <Text style={{ color: Colors.muted }}>No trend data</Text>}
        </Card>
      </ScrollView>
      <BottomStatsBar
        navigation={navigation}
        totalBalance={totalBalance}
        billsSummary={billsSummary?.upcomingAndPendingDueAmt}
        totalMonthlySpend={totalMonthlySpend}
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
      <ConfirmDialog visible={confirmVisibleTx} title="Delete Transaction" message={confirmTxMessage} onCancel={() => { setConfirmVisibleTx(false); setConfirmTxId(null); }} onConfirm={async () => { if (confirmTxId) { await deleteTransaction(confirmTxId); } setConfirmVisibleTx(false); setConfirmTxId(null); load(); }} />
    </View>
  );
}
