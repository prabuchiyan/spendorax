import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Platform,
  InteractionManager,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { getTransactions } from '../services/transactions';
import { getCategories } from '../services/categories';
import { groupTransactions } from '../services/reports';
import { getLabelForDate } from '../utils/dateUtils';
import { useTheme } from '../context/ThemeContext';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext';
import events from '../services/events';
import CurrencyText from '../components/CurrencyText';
import { formatCompactAmount } from '../utils/numberUtils';

const REPORT_MODES = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];

const FLOW_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expenses' },
  { key: 'income', label: 'Income' },
];

const SORT_MODES = [
  { key: 'amount_desc', label: 'Top Spend', icon: 'sort-descending' },
  { key: 'name_asc', label: 'Name A–Z', icon: 'sort-alphabetical-ascending' },
];

const pad2 = (n) => String(n).padStart(2, '0');

const getCurrentPeriodLabel = (m) => {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  if (m === 'daily') return dateStr;
  if (m === 'weekly') {
    const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
    return `${weekStart.getFullYear()}-${pad2(weekStart.getMonth() + 1)}-${pad2(weekStart.getDate())}`;
  }
  if (m === 'monthly') return dateStr.substring(0, 7);
  if (m === 'yearly') return dateStr.substring(0, 4);
  return null;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parsePeriodLabelDate = (label, mode) => {
  if (!label) return null;
  const parts = String(label).split('-').map((p) => Number(p));
  if (mode === 'yearly' && parts[0]) {
    return new Date(parts[0], 0, 1);
  }
  if (mode === 'monthly' && parts.length >= 2) {
    return new Date(parts[0], parts[1] - 1, 1);
  }
  if (parts.length >= 3) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const d = new Date(label);
  return isNaN(d.getTime()) ? null : d;
};

const getReadablePeriodLabel = (label, mode) => {
  const d = parsePeriodLabelDate(label, mode);
  if (!d) return label;

  if (mode === 'daily') {
    return `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }
  if (mode === 'weekly') {
    const startOfWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
    const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6);
    const startMonth = MONTH_NAMES[startOfWeek.getMonth()];
    const endMonth = MONTH_NAMES[endOfWeek.getMonth()];
    if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
      return `${startOfWeek.getDate()}–${endOfWeek.getDate()} ${startMonth}`;
    }
    return `${startOfWeek.getDate()} ${startMonth}–${endOfWeek.getDate()} ${endMonth}`;
  }
  if (mode === 'monthly') {
    return `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
  }
  if (mode === 'yearly') {
    return String(d.getFullYear());
  }
  return getLabelForDate(d, mode) || label;
};

const getChartAxisParts = (label, mode) => {
  const d = parsePeriodLabelDate(label, mode);
  if (!d) return { primary: String(label || ''), secondary: '' };

  if (mode === 'daily') {
    return {
      primary: String(d.getDate()).padStart(2, '0'),
      secondary: MONTH_NAMES[d.getMonth()],
    };
  }
  if (mode === 'weekly') {
    const startOfWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
    const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6);
    const startMonth = MONTH_NAMES[startOfWeek.getMonth()];
    const endMonth = MONTH_NAMES[endOfWeek.getMonth()];
    return {
      primary: `${startOfWeek.getDate()}–${endOfWeek.getDate()}`,
      secondary: startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`,
    };
  }
  if (mode === 'monthly') {
    return {
      primary: MONTH_NAMES[d.getMonth()],
      secondary: `'${String(d.getFullYear()).slice(2)}`,
    };
  }
  if (mode === 'yearly') {
    return {
      primary: String(d.getFullYear()),
      secondary: '',
    };
  }
  return { primary: String(label || ''), secondary: '' };
};

const hexToRgba = (hex, alpha = 0.15) => {
  if (!hex || typeof hex !== 'string') return `rgba(75,124,243,${alpha})`;
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map((c) => c + c).join('');
  if (cleanHex.length !== 6) return `rgba(75,124,243,${alpha})`;
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const ReportItemCard = React.memo(
  ({
    data,
    displayLabel,
    categoriesMap,
    palette,
    isDarkMode,
    balanceVisible,
    flowFilter,
    sortMode,
    onCategoryPress,
  }) => {
    const netBalance = Number(data.income || 0) - Number(data.expense || 0);
    const isSurplus = netBalance >= 0;
    const netColor = isSurplus ? palette.positive : palette.negative;
    const netBg = isSurplus ? palette.positiveBg : palette.negativeBg;

    const categoryRows = useMemo(() => {
      const rows = [];
      Object.entries(data.categories || {}).forEach(([cid, totals]) => {
        const exp = Number(totals?.expense || 0);
        const inc = Number(totals?.income || 0);
        if (exp > 0 && flowFilter !== 'income') {
          rows.push({
            key: `${cid}-expense`,
            cid,
            type: 'expense',
            amount: exp,
            count: Number(totals?.expenseCount || 0),
          });
        }
        if (inc > 0 && flowFilter !== 'expense') {
          rows.push({
            key: `${cid}-income`,
            cid,
            type: 'income',
            amount: inc,
            count: Number(totals?.incomeCount || 0),
          });
        }
      });

      if (sortMode === 'name_asc') {
        rows.sort((a, b) => {
          const nameA = String(categoriesMap[a.cid]?.name || 'Uncategorized');
          const nameB = String(categoriesMap[b.cid]?.name || 'Uncategorized');
          return nameA.localeCompare(nameB);
        });
      } else {
        rows.sort((a, b) => b.amount - a.amount);
      }

      return rows;
    }, [data.categories, flowFilter, sortMode, categoriesMap]);

    return (
      <View
        style={[
          styles.periodCard,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
          !isDarkMode && styles.cardShadowLight,
        ]}
      >
        {/* Period Header Row */}
        <View style={[styles.periodCardHeader, { borderBottomColor: palette.divider }]}>
          <View style={styles.periodHeaderLeft}>
            <Text style={[styles.periodCardTitle, { color: palette.textPrimary }]}>
              {displayLabel || data.label}
            </Text>
            <Text style={[styles.periodCardMeta, { color: palette.textMuted }]}>
              {data.label}
              {Number(data.txCount || 0) > 0
                ? ` · ${data.txCount} ${data.txCount === 1 ? 'entry' : 'entries'}`
                : ''}
            </Text>
          </View>

          <View style={[styles.netPill, { backgroundColor: netBg }]}>
            <Text style={[styles.netPillText, { color: netColor }]}>
              {netBalance < 0 ? '-' : '+'}
              <CurrencyText
                amount={Math.abs(netBalance)}
                minimumFractionDigits={0}
                maximumFractionDigits={0}
              />
            </Text>
          </View>
        </View>

        {/* Income & Expense Mini Summary Pills */}
        <View style={styles.periodSummaryRow}>
          <View
            style={[
              styles.periodFlowChip,
              {
                backgroundColor: palette.positiveBg,
                borderColor: palette.positiveBorder,
              },
            ]}
          >
            <MaterialCommunityIcons name="arrow-up" size={14} color={palette.positive} />
            <Text numberOfLines={1} style={[styles.periodFlowLabel, { color: palette.positive }]}>
              +<CurrencyText amount={data.income} minimumFractionDigits={0} maximumFractionDigits={0} />
            </Text>
          </View>

          <View
            style={[
              styles.periodFlowChip,
              {
                backgroundColor: palette.negativeBg,
                borderColor: palette.negativeBorder,
              },
            ]}
          >
            <MaterialCommunityIcons name="arrow-down" size={14} color={palette.negative} />
            <Text numberOfLines={1} style={[styles.periodFlowLabel, { color: palette.negative }]}>
              -<CurrencyText amount={data.expense} minimumFractionDigits={0} maximumFractionDigits={0} />
            </Text>
          </View>
        </View>

        {/* Category Breakdown List */}
        {categoryRows.length > 0 ? (
          <View style={styles.categoryBreakdown}>
            {categoryRows.map((entry) => {
              const cat = categoriesMap[entry.cid] || {
                name: 'Uncategorized',
                icon: 'tag',
                color: palette.primary,
              };
              const catColor = cat.color || palette.primary;
              const isExpense = entry.type === 'expense';
              const totalBase = Math.max(isExpense ? data.expense : data.income, 1);
              const pct = (entry.amount / totalBase) * 100;
              const roundedPct = Math.round(pct);
              const avatarBg = hexToRgba(catColor, isDarkMode ? 0.2 : 0.12);

              return (
                <TouchableOpacity
                  key={entry.key}
                  activeOpacity={0.78}
                  onPress={() => onCategoryPress(entry.cid, cat.name, data.label)}
                  style={[
                    styles.catRow,
                    {
                      backgroundColor: palette.surfaceSubtle,
                      borderColor: palette.cardBorder,
                    },
                  ]}
                >
                  <View style={[styles.catIconBox, { backgroundColor: avatarBg }]}>
                    <MaterialCommunityIcons
                      name={cat.icon || 'tag'}
                      size={20}
                      color={catColor}
                    />
                  </View>

                  <View style={styles.catBody}>
                    <View style={styles.catTopLine}>
                      <View style={styles.catNameWrap}>
                        <Text
                          numberOfLines={1}
                          style={[styles.catName, { color: palette.textPrimary }]}
                        >
                          {cat.name}
                        </Text>
                        <View style={[styles.catSharePill, { backgroundColor: palette.cardBg }]}>
                          <Text style={[styles.catShareText, { color: palette.textSecondary }]}>
                            {roundedPct}%
                          </Text>
                        </View>
                      </View>

                      <View style={styles.catRightGroup}>
                        <Text
                          style={[
                            styles.catAmount,
                            { color: isExpense ? palette.negative : palette.positive },
                          ]}
                        >
                          {isExpense ? '-' : '+'}
                          <CurrencyText
                            amount={entry.amount}
                            minimumFractionDigits={0}
                            maximumFractionDigits={0}
                          />
                        </Text>
                        <Feather name="chevron-right" size={14} color={palette.textMuted} />
                      </View>
                    </View>

                    <View
                      style={[
                        styles.progressBarTrack,
                        { backgroundColor: isDarkMode ? '#0F172A' : '#E2E8F0' },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(2, pct))}%`,
                            backgroundColor: catColor,
                          },
                        ]}
                      />
                    </View>

                    {entry.count > 0 && (
                      <Text style={[styles.catEntryMeta, { color: palette.textMuted }]}>
                        {entry.count} {entry.count === 1 ? 'transaction' : 'transactions'}
                        {balanceVisible ? '' : ' · hidden'}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.emptyCatFilterText, { color: palette.textMuted }]}>
            No {flowFilter} entries for this period.
          </Text>
        )}
      </View>
    );
  }
);

export default function ReportsScreen() {
  const { isDarkMode, theme } = useTheme();
  const { balanceVisible, toggleBalance } = useBalanceVisibility();
  const navigation = useNavigation();

  const [transactions, setTransactions] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [mode, setMode] = useState('monthly');
  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentPeriodLabel('monthly'));
  const [chartOffset, setChartOffset] = useState(0);
  const [flowFilter, setFlowFilter] = useState('all'); // 'all' | 'expense' | 'income'
  const [sortMode, setSortMode] = useState('amount_desc'); // 'amount_desc' | 'name_asc'
  const [loading, setLoading] = useState(true);

  const palette = useMemo(() => {
    const primary = theme?.primary || '#4B7CF3';
    if (isDarkMode) {
      return {
        bg: theme?.bg || '#0B0F17',
        cardBg: theme?.cardBg || '#182234',
        cardBorder: theme?.cardBorder || '#334155',
        surfaceSubtle: '#1E293B',
        textPrimary: theme?.textPrimary || '#F3F4F6',
        textSecondary: theme?.textSecondary || '#9CA3AF',
        textMuted: '#64748B',
        divider: '#253248',
        primary,
        primarySoft: 'rgba(75, 124, 243, 0.16)',
        primaryBorder: 'rgba(96, 165, 250, 0.35)',
        primaryText: '#93C5FD',
        positive: '#34D399',
        positiveBg: 'rgba(16, 185, 129, 0.14)',
        positiveBorder: 'rgba(52, 211, 153, 0.28)',
        negative: '#F87171',
        negativeBg: 'rgba(239, 68, 68, 0.14)',
        negativeBorder: 'rgba(248, 113, 113, 0.28)',
        badgeBg: '#1E293B',
        badgeText: '#CBD5E1',
      };
    }

    return {
      bg: theme?.bg || '#F8F9FF',
      cardBg: theme?.cardBg || '#FFFFFF',
      cardBorder: theme?.cardBorder || '#E2E8F0',
      surfaceSubtle: '#F1F5F9',
      textPrimary: theme?.textPrimary || '#0B1C30',
      textSecondary: theme?.textSecondary || '#64748B',
      textMuted: '#94A3B8',
      divider: '#F1F5F9',
      primary,
      primarySoft: '#EFF4FF',
      primaryBorder: '#BFDBFE',
      primaryText: '#2563EB',
      positive: '#059669',
      positiveBg: '#ECFDF5',
      positiveBorder: '#A7F3D0',
      negative: '#DC2626',
      negativeBg: '#FEF2F2',
      negativeBorder: '#FECACA',
      badgeBg: '#E2E8F0',
      badgeText: '#475569',
    };
  }, [isDarkMode, theme]);

  const loadData = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const [tx, cats] = await Promise.all([
        getTransactions(1000000),
        getCategories(true),
      ]);
      const cmap = {};
      (cats || []).forEach((c) => {
        cmap[c.id] = c;
      });
      setCategoriesMap(cmap);
      setTransactions(tx || []);
    } catch (e) {
      console.error('ReportsScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      InteractionManager.runAfterInteractions(() => {
        if (active) {
          loadData(transactions.length === 0);
        }
      });
      return () => {
        active = false;
      };
    }, [loadData, transactions.length])
  );

  useEffect(() => {
    const refresh = () => loadData(false);
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

  const handleCategoryPress = useCallback(
    (categoryId, categoryName, periodLabel) => {
      navigation.navigate('CategoriesDetails', {
        categoryId,
        categoryName,
        periodLabel,
        mode,
      });
    },
    [navigation, mode]
  );

  const reportData = useMemo(() => {
    return groupTransactions(transactions, mode);
  }, [transactions, mode]);

  const effectiveSelectedPeriod = useMemo(() => {
    if (!selectedPeriod) return null;
    if (reportData.length === 0) return null;
    return reportData.some((d) => d.label === selectedPeriod)
      ? selectedPeriod
      : reportData[0].label;
  }, [selectedPeriod, reportData]);

  const filteredReportData = useMemo(() => {
    if (!effectiveSelectedPeriod) return reportData;
    return reportData.filter((d) => d.label === effectiveSelectedPeriod);
  }, [reportData, effectiveSelectedPeriod]);

  const scopeTotals = useMemo(() => {
    const source = filteredReportData;
    const totals = source.reduce(
      (acc, d) => {
        acc.income += Number(d.income || 0);
        acc.expense += Number(d.expense || 0);
        acc.txCount += Number(d.txCount || 0);
        return acc;
      },
      { income: 0, expense: 0, txCount: 0 }
    );
    const balance = totals.income - totals.expense;
    const totalVolume = totals.income + totals.expense;
    const incomeShare = totalVolume > 0 ? Math.round((totals.income / totalVolume) * 100) : 0;
    const savingsRate =
      totals.income > 0 ? Math.round(((totals.income - totals.expense) / totals.income) * 100) : null;
    return { ...totals, balance, incomeShare, savingsRate };
  }, [filteredReportData]);

  const displayReportData = useMemo(() => {
    return reportData.slice(chartOffset, chartOffset + 5);
  }, [reportData, chartOffset]);

  const maxAmount = useMemo(() => {
    if (!displayReportData || displayReportData.length === 0) return 100;
    const points = displayReportData.map((d) => Math.max(d.income || 0, d.expense || 0));
    const max = Math.max(...points);
    return max > 0 ? max : 100;
  }, [displayReportData]);

  const formatLabel = useCallback(
    (label) => {
      return getReadablePeriodLabel(label, mode) || label;
    },
    [mode]
  );

  const selectedPeriodData = useMemo(() => {
    if (!effectiveSelectedPeriod) return null;
    return reportData.find((d) => d.label === effectiveSelectedPeriod) || null;
  }, [reportData, effectiveSelectedPeriod]);

  const toggleSortMode = () => {
    const idx = SORT_MODES.findIndex((m) => m.key === sortMode);
    const next = SORT_MODES[(idx + 1) % SORT_MODES.length];
    setSortMode(next.key);
  };

  const activeSort = SORT_MODES.find((m) => m.key === sortMode) || SORT_MODES[0];
  const isSurplus = scopeTotals.balance >= 0;

  const listHeader = (
    <View style={styles.headerBlock}>
      {/* Adaptive Cashflow Hero Overview Card */}
      {!loading && reportData.length > 0 && (
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.cardBorder,
            },
            !isDarkMode && styles.cardShadowLight,
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleGroup}>
              <View style={[styles.heroBadgeIcon, { backgroundColor: palette.primarySoft }]}>
                <MaterialCommunityIcons
                  name="chart-areaspline"
                  size={18}
                  color={palette.primary}
                />
              </View>
              <View style={styles.heroTitleTextCol}>
                <Text style={[styles.heroEyebrow, { color: palette.textSecondary }]}>
                  {effectiveSelectedPeriod ? 'SELECTED PERIOD CASHFLOW' : 'ALL PERIODS CASHFLOW'}
                </Text>
                <Text style={[styles.heroSubMeta, { color: palette.textMuted }]}>
                  {effectiveSelectedPeriod
                    ? formatLabel(effectiveSelectedPeriod)
                    : `${reportData.length} periods`}{' '}
                  · {scopeTotals.txCount} {scopeTotals.txCount === 1 ? 'entry' : 'entries'}
                </Text>
              </View>
            </View>

            <View style={styles.heroRightControls}>
              <View
                style={[
                  styles.healthPill,
                  { backgroundColor: isSurplus ? palette.positiveBg : palette.negativeBg },
                ]}
              >
                <Text
                  style={[
                    styles.healthPillText,
                    { color: isSurplus ? palette.positive : palette.negative },
                  ]}
                >
                  {isSurplus ? 'Surplus' : 'Deficit'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={toggleBalance}
                activeOpacity={0.75}
                accessibilityLabel={balanceVisible ? 'Hide report amounts' : 'Show report amounts'}
                style={[
                  styles.eyeToggleBtn,
                  {
                    backgroundColor: palette.surfaceSubtle,
                    borderColor: palette.cardBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color={palette.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <Text
            numberOfLines={1}
            style={[
              styles.heroNetAmount,
              { color: isSurplus ? palette.positive : palette.negative },
            ]}
          >
            {scopeTotals.balance < 0 ? '-' : '+'}
            <CurrencyText
              amount={Math.abs(scopeTotals.balance)}
              minimumFractionDigits={2}
              maximumFractionDigits={2}
            />
          </Text>

          {/* Dual Income vs Expense Ratio Track */}
          <View style={styles.heroRatioBlock}>
            <View style={styles.heroRatioLabels}>
              <Text style={[styles.heroRatioText, { color: palette.textSecondary }]}>
                Cashflow Split
              </Text>
              <Text style={[styles.heroRatioText, { color: palette.textSecondary }]}>
                {scopeTotals.savingsRate !== null
                  ? `Savings Rate: ${scopeTotals.savingsRate}%`
                  : `${scopeTotals.incomeShare}% In · ${100 - scopeTotals.incomeShare}% Out`}
              </Text>
            </View>
            <View style={[styles.ratioTrack, { backgroundColor: palette.negative }]}>
              <View
                style={[
                  styles.ratioIncomeFill,
                  {
                    width: `${scopeTotals.incomeShare}%`,
                    backgroundColor: palette.positive,
                  },
                ]}
              />
            </View>
          </View>

          {/* Interactive Income & Expense Breakdown Tiles */}
          <View style={styles.heroStatsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setFlowFilter((prev) => (prev === 'income' ? 'all' : 'income'))}
              style={[
                styles.heroStatTile,
                {
                  backgroundColor:
                    flowFilter === 'income' ? palette.positiveBg : palette.surfaceSubtle,
                  borderColor:
                    flowFilter === 'income' ? palette.positive : palette.cardBorder,
                  borderWidth: flowFilter === 'income' ? 1.5 : 1,
                },
              ]}
            >
              <View style={styles.heroStatTop}>
                <View style={[styles.heroStatIcon, { backgroundColor: palette.positiveBg }]}>
                  <MaterialCommunityIcons name="arrow-up" size={16} color={palette.positive} />
                </View>
                <View
                  style={[
                    styles.heroStatSharePill,
                    {
                      backgroundColor:
                        flowFilter === 'income' ? palette.positive : palette.badgeBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.heroStatShareText,
                      { color: flowFilter === 'income' ? '#FFFFFF' : palette.badgeText },
                    ]}
                  >
                    {scopeTotals.incomeShare}%
                  </Text>
                </View>
              </View>
              <Text style={[styles.heroStatLabel, { color: palette.textSecondary }]}>Income</Text>
              <CurrencyText
                amount={scopeTotals.income}
                minimumFractionDigits={0}
                maximumFractionDigits={0}
                numberOfLines={1}
                style={[styles.heroStatAmount, { color: palette.positive }]}
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setFlowFilter((prev) => (prev === 'expense' ? 'all' : 'expense'))}
              style={[
                styles.heroStatTile,
                {
                  backgroundColor:
                    flowFilter === 'expense' ? palette.negativeBg : palette.surfaceSubtle,
                  borderColor:
                    flowFilter === 'expense' ? palette.negative : palette.cardBorder,
                  borderWidth: flowFilter === 'expense' ? 1.5 : 1,
                },
              ]}
            >
              <View style={styles.heroStatTop}>
                <View style={[styles.heroStatIcon, { backgroundColor: palette.negativeBg }]}>
                  <MaterialCommunityIcons name="arrow-down" size={16} color={palette.negative} />
                </View>
                <View
                  style={[
                    styles.heroStatSharePill,
                    {
                      backgroundColor:
                        flowFilter === 'expense' ? palette.negative : palette.badgeBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.heroStatShareText,
                      { color: flowFilter === 'expense' ? '#FFFFFF' : palette.badgeText },
                    ]}
                  >
                    {100 - scopeTotals.incomeShare}%
                  </Text>
                </View>
              </View>
              <Text style={[styles.heroStatLabel, { color: palette.textSecondary }]}>Expense</Text>
              <CurrencyText
                amount={scopeTotals.expense}
                minimumFractionDigits={0}
                maximumFractionDigits={0}
                numberOfLines={1}
                style={[styles.heroStatAmount, { color: palette.negative }]}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Upgraded Interactive Income vs Expense Trend Chart Card */}
      <View
        style={[
          styles.chartCard,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
          !isDarkMode && styles.cardShadowLight,
        ]}
      >
        <View style={styles.chartCardHeader}>
          <View style={styles.chartHeaderTextCol}>
            <Text style={[styles.chartTitle, { color: palette.textPrimary }]}>
              Income vs Expense Trend
            </Text>
            <Text style={[styles.chartSubtitle, { color: palette.textMuted }]}>
              Tap any period column to filter breakdown
            </Text>
          </View>

          {!loading && reportData.length > 0 && (
            <View style={styles.chartNavGroup}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setChartOffset((prev) => Math.max(0, prev - 1))}
                disabled={chartOffset === 0}
                accessibilityLabel="Newer periods"
                style={[
                  styles.chartNavBtn,
                  {
                    backgroundColor: palette.surfaceSubtle,
                    borderColor: palette.cardBorder,
                    opacity: chartOffset === 0 ? 0.35 : 1,
                  },
                ]}
              >
                <Feather name="chevron-left" size={16} color={palette.textPrimary} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setChartOffset((prev) => prev + 1)}
                disabled={chartOffset >= reportData.length - 5}
                accessibilityLabel="Older periods"
                style={[
                  styles.chartNavBtn,
                  {
                    backgroundColor: palette.surfaceSubtle,
                    borderColor: palette.cardBorder,
                    opacity: chartOffset >= reportData.length - 5 ? 0.35 : 1,
                  },
                ]}
              >
                <Feather name="chevron-right" size={16} color={palette.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
              Loading report...
            </Text>
          </View>
        ) : reportData.length === 0 ? (
          <View style={styles.chartEmptyState}>
            <MaterialCommunityIcons
              name="chart-bar"
              size={34}
              color={palette.textMuted}
            />
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              No data available for this period
            </Text>
          </View>
        ) : (
          <View>
            {/* Scale Indicator + Horizontal Guide Lines */}
            <View style={styles.chartPlotWrap}>
              <View style={styles.chartGridLines} pointerEvents="none">
                <View style={[styles.gridLineRow, { borderTopColor: palette.divider }]}>
                  <Text style={[styles.gridScaleText, { color: palette.textMuted }]}>
                    {balanceVisible ? formatCompactAmount(maxAmount) : '••••'}
                  </Text>
                </View>
                <View style={[styles.gridLineRow, { borderTopColor: palette.divider }]}>
                  <Text style={[styles.gridScaleText, { color: palette.textMuted }]}>
                    {balanceVisible ? formatCompactAmount(maxAmount / 2) : '••••'}
                  </Text>
                </View>
                <View style={[styles.gridBaseLine, { backgroundColor: palette.cardBorder }]} />
              </View>

              {/* Grouped Bar Columns */}
              <View style={styles.chartOuterRow}>
                {displayReportData.map((data) => {
                  const isSelected = effectiveSelectedPeriod === data.label;
                  const dimmed = effectiveSelectedPeriod && !isSelected;
                  const incVal = Number(data.income || 0);
                  const expVal = Number(data.expense || 0);
                  const incHeight = incVal > 0 ? Math.max(Math.round((incVal / maxAmount) * 110), 6) : 2;
                  const expHeight = expVal > 0 ? Math.max(Math.round((expVal / maxAmount) * 110), 6) : 2;
                  const axisParts = getChartAxisParts(data.label, mode);

                  return (
                    <TouchableOpacity
                      key={data.label}
                      activeOpacity={0.8}
                      onPress={() =>
                        setSelectedPeriod((prev) =>
                          prev === data.label ? null : data.label
                        )
                      }
                      style={[
                        styles.chartColumn,
                        isSelected && {
                          backgroundColor: palette.primarySoft,
                          borderColor: palette.primaryBorder,
                        },
                        dimmed && { opacity: 0.45 },
                      ]}
                    >
                      <View style={styles.barContainer}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: incHeight,
                              backgroundColor: incVal > 0 ? palette.positive : palette.divider,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.bar,
                            {
                              height: expHeight,
                              backgroundColor: expVal > 0 ? palette.negative : palette.divider,
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.axisLabelWrap}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.axisPrimaryLabel,
                            {
                              color: isSelected ? palette.primaryText : palette.textPrimary,
                              fontWeight: isSelected ? '800' : '700',
                            },
                          ]}
                        >
                          {axisParts.primary}
                        </Text>
                        {axisParts.secondary ? (
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.axisSecondaryLabel,
                              { color: isSelected ? palette.primaryText : palette.textMuted },
                            ]}
                          >
                            {axisParts.secondary}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Clean Active Period Filter Pill */}
            {effectiveSelectedPeriod && (
              <View
                style={[
                  styles.filterBanner,
                  {
                    backgroundColor: palette.primarySoft,
                    borderColor: palette.primaryBorder,
                  },
                ]}
              >
                <View style={styles.filterBannerLeft}>
                  <MaterialCommunityIcons
                    name="filter-variant"
                    size={16}
                    color={palette.primaryText}
                  />
                  <View style={styles.filterBannerTextCol}>
                    <Text numberOfLines={1} style={[styles.filterText, { color: palette.primaryText }]}>
                      {formatLabel(effectiveSelectedPeriod)}
                    </Text>
                    {selectedPeriodData && (
                      <Text numberOfLines={1} style={[styles.filterSubMeta, { color: palette.textSecondary }]}>
                        {balanceVisible
                          ? `+${formatCompactAmount(selectedPeriodData.income)} · -${formatCompactAmount(selectedPeriodData.expense)}`
                          : 'Amounts hidden'}
                      </Text>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setSelectedPeriod(null)}
                  style={[styles.clearFilterPill, { backgroundColor: palette.cardBg }]}
                >
                  <Text style={[styles.clearFilterText, { color: palette.primaryText }]}>
                    All Periods
                  </Text>
                  <MaterialCommunityIcons
                    name="close"
                    size={13}
                    color={palette.primaryText}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: palette.positive }]} />
                <Text style={[styles.legendText, { color: palette.textSecondary }]}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: palette.negative }]} />
                <Text style={[styles.legendText, { color: palette.textSecondary }]}>Expense</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Breakdown Controls Row */}
      {!loading && filteredReportData.length > 0 && (
        <View style={styles.controlsRow}>
          <View style={styles.filterPillsWrap}>
            {FLOW_FILTERS.map((opt) => {
              const active = flowFilter === opt.key;
              const activeBg =
                opt.key === 'expense'
                  ? palette.negative
                  : opt.key === 'income'
                    ? palette.positive
                    : palette.primary;

              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.8}
                  onPress={() => setFlowFilter(opt.key)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: active ? activeBg : palette.cardBg,
                      borderColor: active ? activeBg : palette.cardBorder,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.filterPillText,
                      { color: active ? '#FFFFFF' : palette.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={toggleSortMode}
            style={[
              styles.sortPill,
              {
                backgroundColor: palette.cardBg,
                borderColor: palette.cardBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={activeSort.icon}
              size={15}
              color={palette.textSecondary}
            />
            <Text style={[styles.sortPillText, { color: palette.textSecondary }]}>
              {activeSort.label}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderItem = useCallback(
    ({ item }) => (
      <ReportItemCard
        data={item}
        displayLabel={formatLabel(item.label)}
        categoriesMap={categoriesMap}
        palette={palette}
        isDarkMode={isDarkMode}
        balanceVisible={balanceVisible}
        flowFilter={flowFilter}
        sortMode={sortMode}
        onCategoryPress={handleCategoryPress}
      />
    ),
    [
      formatLabel,
      categoriesMap,
      palette,
      isDarkMode,
      balanceVisible,
      flowFilter,
      sortMode,
      handleCategoryPress,
    ]
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Non-Truncating Segmented Period Mode Bar */}
      <View
        style={[
          styles.tabOuterBar,
          {
            backgroundColor: palette.cardBg,
            borderBottomColor: palette.cardBorder,
          },
        ]}
      >
        <View
          style={[
            styles.tabTrack,
            {
              backgroundColor: palette.surfaceSubtle,
              borderColor: palette.cardBorder,
            },
          ]}
        >
          {REPORT_MODES.map((m) => {
            const active = mode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                activeOpacity={0.85}
                onPress={() => handleModeChange(m.key)}
                style={[
                  styles.tabItem,
                  active && [
                    styles.tabItemActive,
                    {
                      backgroundColor: isDarkMode ? '#243247' : palette.cardBg,
                      borderColor: isDarkMode ? palette.primaryBorder : palette.cardBorder,
                    },
                    !isDarkMode && styles.cardShadowLight,
                  ],
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabLabel,
                    {
                      color: active ? palette.primaryText : palette.textSecondary,
                      fontWeight: active ? '800' : '600',
                    },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading && reportData.length === 0 ? (
        <View style={styles.fullLoader}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
            Loading financial reports...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredReportData}
          keyExtractor={(item) => item.label}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
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
  },
  cardShadowLight: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    android: {
      elevation: 2,
    },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
    },
  }),

  /* Segmented Period Mode Switcher */
  tabOuterBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tabTrack: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  tabItemActive: {
    borderWidth: 1,
  },
  tabLabel: {
    fontSize: 12.5,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 44,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  headerBlock: {
    marginBottom: 4,
  },
  fullLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Hero Cashflow Overview */
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  heroBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  heroTitleTextCol: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroSubMeta: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  heroRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  healthPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  healthPillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  eyeToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNetAmount: {
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  heroRatioBlock: {
    marginBottom: 14,
  },
  heroRatioLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroRatioText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  ratioTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratioIncomeFill: {
    height: '100%',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStatTile: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroStatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatSharePill: {
    minWidth: 32,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatShareText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroStatAmount: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },

  /* Trend Chart Card */
  chartCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  chartCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chartHeaderTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  chartTitle: {
    fontSize: 15.5,
    fontWeight: '800',
  },
  chartSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  chartNavGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  chartNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  chartEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  chartPlotWrap: {
    position: 'relative',
    paddingTop: 14,
  },
  chartGridLines: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    height: 112,
    justifyContent: 'space-between',
  },
  gridLineRow: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    paddingTop: 2,
  },
  gridScaleText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  gridBaseLine: {
    height: 1,
    width: '100%',
  },
  chartOuterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: 44,
    minHeight: 162,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 2,
    marginHorizontal: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 112,
    width: '100%',
    gap: 4,
  },
  bar: {
    width: 11,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  axisLabelWrap: {
    marginTop: 7,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  axisPrimaryLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  axisSecondaryLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
  },
  filterBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 12,
    gap: 10,
  },
  filterBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  filterBannerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  filterText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  filterSubMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  clearFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    gap: 4,
  },
  clearFilterText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Breakdown Filter & Sort Controls */
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  filterPillsWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    flexShrink: 0,
  },
  sortPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  /* Period Breakdown Card */
  periodCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
    marginBottom: 12,
  },
  periodCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 11,
    borderBottomWidth: 1,
    marginBottom: 11,
  },
  periodHeaderLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  periodCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  periodCardMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  netPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    flexShrink: 0,
  },
  netPillText: {
    fontSize: 13,
    fontWeight: '900',
  },
  periodSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  periodFlowChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
    gap: 4,
  },
  periodFlowLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  categoryBreakdown: {
    gap: 8,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  catIconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    flexShrink: 0,
  },
  catBody: {
    flex: 1,
    minWidth: 0,
  },
  catTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  catNameWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catName: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  catSharePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catShareText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  catRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  catAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  catEntryMeta: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 5,
  },
  emptyCatFilterText: {
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 14,
  },
});
