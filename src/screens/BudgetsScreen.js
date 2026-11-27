import React, { useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  InteractionManager,
  Platform,
} from 'react-native';
import { Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { createBudget, getBudgetsForMonth, updateBudget } from '../services/budgets';
import {
  deleteCategoryBudget,
  getCategoryBudgetSummary,
  copyCategoryBudgets,
  getAvailableBudgetMonths,
} from '../services/categoryBudgets';
import { getCategories } from '../services/categories';
import events from '../services/events';
import CommonBottomSheetModal from '../components/CommonBottomSheetModal';
import ResponsiveBottomSheet from '../components/ResponsiveBottomSheet';
import ContextualFAB from '../components/ContextualFAB';
import CopyBudgetModal from '../components/CopyBudgetModal';
import CurrencyText from '../components/CurrencyText';
import { useTheme } from '../context/ThemeContext';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext';
import { usePageLoader } from '../context/PageLoaderContext';
import { setCategoryBudgets } from '../redux/slices/budgetSlice';
import { setCategoriesMap } from '../redux/slices/categorySlice';
import { useCategoryBudgets, useAppDispatch } from '../redux/hooks';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'over', label: 'Over' },
  { key: 'near', label: 'Near Limit' },
  { key: 'track', label: 'On Track' },
];

const SORT_MODES = [
  { key: 'default', label: 'Default', icon: 'sort' },
  { key: 'pct_desc', label: 'Highest %', icon: 'trending-up' },
  { key: 'budget_desc', label: 'Highest Limit', icon: 'sort-descending' },
  { key: 'name_asc', label: 'Name A–Z', icon: 'sort-alphabetical-ascending' },
];

const OVERALL_PRESETS = [
  { label: '₹25K', value: '25000' },
  { label: '₹50K', value: '50000' },
  { label: '₹75K', value: '75000' },
  { label: '₹1L', value: '100000' },
];

function getMonthLabel(date) {
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function formatRupees(value, maximumFractionDigits = 0) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits })}`;
}

function getBudgetStatusKey(budget) {
  if (budget?.exceeded) return 'over';
  if (Number(budget?.percentage || 0) >= 80) return 'near';
  return 'track';
}

export default function BudgetsScreen({ navigation }) {
  const { isDarkMode, theme } = useTheme();
  const { balanceVisible, toggleBalance } = useBalanceVisibility();
  const dispatch = useAppDispatch();
  const { show, hide } = usePageLoader();

  const reduxCategoryBudgets = useCategoryBudgets();
  const categoryBudgets = reduxCategoryBudgets || [];

  const [tab, setTab] = useState('overall'); // 'overall' | 'category'
  const [limit, setLimit] = useState('');
  const [currentBudgetId, setCurrentBudgetId] = useState(null);
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());
  const [availableMonths, setAvailableMonths] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'over' | 'near' | 'track'
  const [sortMode, setSortMode] = useState('default'); // 'default' | 'pct_desc' | 'budget_desc' | 'name_asc'

  const [actionSheetBudget, setActionSheetBudget] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deletingBudgetId, setDeletingBudgetId] = useState(null);
  const [deletingBudgetName, setDeletingBudgetName] = useState('');
  const [isDeletingBudget, setIsDeletingBudget] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const selectedMonth = selectedMonthDate.getMonth() + 1;
  const selectedYear = selectedMonthDate.getFullYear();
  const isCurrentMonthSelected =
    selectedMonth === currentMonth && selectedYear === currentYear;
  const hasCurrentMonthCategoryBudgets =
    isCurrentMonthSelected && categoryBudgets.length > 0;
  const shouldShowCopyOption =
    isCurrentMonthSelected && categoryBudgets.length === 0;

  const palette = useMemo(() => {
    const primary = theme?.primary || '#4B7CF3';
    if (isDarkMode) {
      return {
        bg: theme?.bg || '#0B0F17',
        cardBg: theme?.cardBg || '#182234',
        cardBorder: theme?.cardBorder || '#334155',
        surfaceSubtle: '#1E293B',
        inputBg: '#131C2E',
        textPrimary: theme?.textPrimary || '#F3F4F6',
        textSecondary: theme?.textSecondary || '#9CA3AF',
        textMuted: '#64748B',
        divider: '#253248',
        primary,
        primarySoft: 'rgba(75, 124, 243, 0.16)',
        primaryBorder: 'rgba(96, 165, 250, 0.32)',
        primaryText: '#93C5FD',
        positive: '#34D399',
        positiveBg: 'rgba(16, 185, 129, 0.14)',
        positiveBorder: 'rgba(52, 211, 153, 0.28)',
        warning: '#FBBF24',
        warningBg: 'rgba(245, 158, 11, 0.15)',
        warningBorder: 'rgba(251, 191, 36, 0.28)',
        negative: '#F87171',
        negativeBg: 'rgba(239, 68, 68, 0.14)',
        negativeBorder: 'rgba(248, 113, 113, 0.28)',
        editBg: 'rgba(59, 130, 246, 0.15)',
        editBorder: 'rgba(96, 165, 250, 0.28)',
        editIcon: '#60A5FA',
        deleteBg: 'rgba(239, 68, 68, 0.14)',
        deleteBorder: 'rgba(248, 113, 113, 0.28)',
        deleteIcon: '#F87171',
        badgeBg: '#1E293B',
        badgeText: '#CBD5E1',
      };
    }

    return {
      bg: theme?.bg || '#F8F9FF',
      cardBg: theme?.cardBg || '#FFFFFF',
      cardBorder: theme?.cardBorder || '#E2E8F0',
      surfaceSubtle: '#F1F5F9',
      inputBg: '#FFFFFF',
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
      warning: '#D97706',
      warningBg: '#FFFBEB',
      warningBorder: '#FDE68A',
      negative: '#DC2626',
      negativeBg: '#FEF2F2',
      negativeBorder: '#FECACA',
      editBg: '#EFF6FF',
      editBorder: '#DBEAFE',
      editIcon: '#2563EB',
      deleteBg: '#FEF2F2',
      deleteBorder: '#FEE2E2',
      deleteIcon: '#EF4444',
      badgeBg: '#E2E8F0',
      badgeText: '#475569',
    };
  }, [isDarkMode, theme]);

  const monthCarousel = useMemo(() => {
    const current = new Date(currentYear, currentMonth - 1, 1);
    const selected = new Date(selectedYear, selectedMonth - 1, 1);

    let previousAvailable = null;
    const sortedAvailable = [...availableMonths].sort((a, b) => b.getTime() - a.getTime());
    for (const d of sortedAvailable) {
      if (d.getTime() < current.getTime()) {
        previousAvailable = d;
        break;
      }
    }

    if (!previousAvailable) {
      previousAvailable = new Date(currentYear, currentMonth - 2, 1);
    }

    const list = [previousAvailable, current];
    if (!list.some((d) => d.getTime() === selected.getTime())) {
      list.push(selected);
    }

    list.sort((a, b) => a.getTime() - b.getTime());
    return list;
  }, [availableMonths, currentYear, currentMonth, selectedMonth, selectedYear]);

  const loadCategoryBudgetsForMonth = useCallback(
    async (month = selectedMonth, year = selectedYear) => {
      const budgets = await getCategoryBudgetSummary(month, year);
      dispatch(setCategoryBudgets(budgets || []));
    },
    [dispatch, selectedMonth, selectedYear]
  );

  const load = useCallback(async () => {
    try {
      const [rows, cats, budgets, availMonths] = await Promise.all([
        getBudgetsForMonth(),
        getCategories(true),
        getCategoryBudgetSummary(selectedMonth, selectedYear),
        getAvailableBudgetMonths(),
      ]);

      const general = (rows || []).find((r) => r.category_id == null) || rows?.[0];
      if (general) {
        setCurrentBudgetId(general.id);
        setLimit(String(general.monthly_limit || ''));
      } else {
        setCurrentBudgetId(null);
        setLimit('');
      }

      const safeCategories = Array.isArray(cats) ? cats : [];
      const cmap = {};
      safeCategories.forEach((c) => {
        cmap[c.id] = c;
      });
      dispatch(setCategoriesMap(cmap));

      dispatch(setCategoryBudgets(budgets || []));

      const dateList = (availMonths || [])
        .map((m) => {
          const y = Number(m.year);
          const mn = Number(m.month);
          if (!Number.isNaN(y) && !Number.isNaN(mn) && y > 2000 && mn >= 1 && mn <= 12) {
            return new Date(y, mn - 1, 1);
          }
          return null;
        })
        .filter((d) => d !== null);
      setAvailableMonths(dateList);
    } catch (error) {
      console.error('BudgetsScreen load error:', error);
    }
  }, [dispatch, selectedMonth, selectedYear]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      InteractionManager.runAfterInteractions(() => {
        if (active) {
          load();
        }
      });
      return () => {
        active = false;
      };
    }, [load])
  );

  const navigateTarget = useCallback(
    (screenName, params) => {
      const parent = navigation.getParent?.();
      if (parent && typeof parent.navigate === 'function') {
        parent.navigate(screenName, params);
      } else {
        navigation.navigate(screenName, params);
      }
    },
    [navigation]
  );

  async function syncOverallBudget() {
    const budgets = await getCategoryBudgetSummary(currentMonth, currentYear);
    const totalCategoryBudgets = (budgets || []).reduce(
      (sum, item) => sum + (Number(item.budget) || 0),
      0
    );

    const rows = await getBudgetsForMonth();
    const general = (rows || []).find((r) => r.category_id == null);

    if (general) {
      await updateBudget(general.id, {
        category_id: null,
        monthly_limit: totalCategoryBudgets,
        month: null,
      });
    } else if (totalCategoryBudgets > 0) {
      const id = await createBudget({
        monthly_limit: totalCategoryBudgets,
        category_id: null,
        month: null,
      });
      setCurrentBudgetId(id);
    }
  }

  async function setNow() {
    const value = parseFloat(limit) || 0;
    if (currentBudgetId) {
      await updateBudget(currentBudgetId, {
        category_id: null,
        monthly_limit: value,
        month: null,
      });
      events.emit('budgetsChanged', currentBudgetId);
    } else {
      const id = await createBudget({
        monthly_limit: value,
        category_id: null,
        month: null,
      });
      events.emit('budgetsChanged', id);
    }
    await load();
    if (typeof navigation !== 'undefined' && navigation) {
      navigation.navigate('Dashboard');
    }
  }

  function handleDeleteCategoryBudget(budgetItemOrId) {
    if (typeof budgetItemOrId === 'object' && budgetItemOrId !== null) {
      setDeletingBudgetId(budgetItemOrId.id);
      setDeletingBudgetName(budgetItemOrId.categoryName || '');
    } else {
      setDeletingBudgetId(budgetItemOrId);
      setDeletingBudgetName('');
    }
    setConfirmVisible(true);
  }

  async function confirmDeleteCategoryBudget() {
    if (deletingBudgetId && !isDeletingBudget) {
      setIsDeletingBudget(true);
      show({ message: 'Deleting budget...' });
      try {
        await deleteCategoryBudget(deletingBudgetId);
        await syncOverallBudget();
        events.emit('budgetsChanged', null);
        await load();
        setConfirmVisible(false);
        setDeletingBudgetId(null);
        setDeletingBudgetName('');
      } finally {
        setIsDeletingBudget(false);
        hide();
      }
    }
  }

  async function handleCopyPreviousMonth(fromMonth, fromYear) {
    if (!isCurrentMonthSelected) {
      setToastMsg('Copying category budgets is only available for the current month.');
      setToastVisible(true);
      return;
    }
    if (categoryBudgets.length > 0) {
      setToastMsg('Category budgets are already set for this month.');
      setToastVisible(true);
      return;
    }

    const sourceDate = new Date(fromYear, fromMonth - 1, 1);
    const targetDate = new Date(currentYear, currentMonth - 1, 1);

    try {
      const copied = await copyCategoryBudgets({
        fromMonth,
        fromYear,
        toMonth: currentMonth,
        toYear: currentYear,
        overwrite: false,
      });
      if (!copied || copied.length === 0) {
        setToastMsg(`No category budgets were found in ${getMonthLabel(sourceDate)} to copy.`);
        setToastVisible(true);
        return;
      }
      await syncOverallBudget();
      events.emit('budgetsChanged');
      await load();
      setShowCopyModal(false);

      setToastMsg(`Copied budgets from ${getMonthLabel(sourceDate)} to ${getMonthLabel(targetDate)}.`);
      setToastVisible(true);
    } catch (error) {
      console.error('Copy category budgets failed:', error);
      setToastMsg(error?.message || 'Unable to copy category budgets.');
      setToastVisible(true);
    }
  }

  function moveMonthBy(offset) {
    const next = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + offset, 1);
    const maxDate = new Date(currentYear, currentMonth - 1, 1);
    if (next > maxDate) return;
    setSelectedMonthDate(next);
  }

  const budgetSummary = useMemo(() => {
    return categoryBudgets.reduce(
      (acc, b) => {
        const bLimit = Number(b.budget || 0);
        const bSpent = Number(b.spent || 0);
        acc.totalBudget += bLimit;
        acc.totalSpent += bSpent;
        const st = getBudgetStatusKey(b);
        if (st === 'over') acc.overCount += 1;
        else if (st === 'near') acc.nearCount += 1;
        else acc.onTrackCount += 1;
        return acc;
      },
      { totalBudget: 0, totalSpent: 0, overCount: 0, nearCount: 0, onTrackCount: 0 }
    );
  }, [categoryBudgets]);

  const totalRemaining = budgetSummary.totalBudget - budgetSummary.totalSpent;
  const overallUtilization =
    budgetSummary.totalBudget > 0
      ? (budgetSummary.totalSpent / budgetSummary.totalBudget) * 100
      : 0;

  const overallHealth = useMemo(() => {
    if (overallUtilization > 100 || totalRemaining < 0) {
      return { label: 'Over Limit', color: palette.negative, bg: palette.negativeBg };
    }
    if (overallUtilization >= 80) {
      return { label: 'Near Limit', color: palette.warning, bg: palette.warningBg };
    }
    return { label: 'On Track', color: palette.positive, bg: palette.positiveBg };
  }, [overallUtilization, totalRemaining, palette]);

  const filteredBudgets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = categoryBudgets.filter((b) => {
      const st = getBudgetStatusKey(b);
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (q && !(b.categoryName || '').toLowerCase().includes(q)) return false;
      return true;
    });

    if (sortMode === 'pct_desc') {
      return [...matched].sort((a, b) => Number(b.percentage || 0) - Number(a.percentage || 0));
    }
    if (sortMode === 'budget_desc') {
      return [...matched].sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0));
    }
    if (sortMode === 'name_asc') {
      return [...matched].sort((a, b) =>
        String(a.categoryName || '').localeCompare(String(b.categoryName || ''))
      );
    }
    return matched;
  }, [categoryBudgets, searchQuery, statusFilter, sortMode]);

  const activeSort = SORT_MODES.find((m) => m.key === sortMode) || SORT_MODES[0];

  const cycleSortMode = () => {
    const idx = SORT_MODES.findIndex((m) => m.key === sortMode);
    const next = SORT_MODES[(idx + 1) % SORT_MODES.length];
    setSortMode(next.key);
  };

  const toggleStatusFilter = (target) => {
    setStatusFilter((prev) => (prev === target ? 'all' : target));
  };

  const isNextMonthDisabled =
    selectedMonthDate.getFullYear() > currentYear ||
    (selectedMonthDate.getFullYear() === currentYear &&
      selectedMonthDate.getMonth() >= currentMonth - 1);

  const renderHeroStatTile = ({
    keyProp,
    filterKey,
    countText,
    label,
    amountText,
    icon,
    tintColor,
    bgColor,
  }) => {
    const isActive = filterKey ? statusFilter === filterKey : false;
    return (
      <TouchableOpacity
        key={keyProp}
        activeOpacity={filterKey ? 0.8 : 1}
        disabled={!filterKey}
        onPress={filterKey ? () => toggleStatusFilter(filterKey) : undefined}
        style={[
          styles.heroStatTile,
          {
            backgroundColor: isActive ? bgColor : palette.surfaceSubtle,
            borderColor: isActive ? tintColor : palette.cardBorder,
            borderWidth: isActive ? 1.5 : 1,
          },
        ]}
      >
        <View style={styles.heroStatTop}>
          <View style={[styles.heroStatIcon, { backgroundColor: bgColor }]}>
            <MaterialCommunityIcons name={icon} size={16} color={tintColor} />
          </View>
          {countText ? (
            <View
              style={[
                styles.heroStatCountPill,
                { backgroundColor: isActive ? tintColor : palette.badgeBg },
              ]}
            >
              <Text
                style={[
                  styles.heroStatCountText,
                  { color: isActive ? '#FFFFFF' : palette.badgeText },
                ]}
              >
                {countText}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.heroStatLabel, { color: palette.textSecondary }]}>
          {label}
        </Text>
        <Text numberOfLines={1} style={[styles.heroStatAmount, { color: tintColor }]}>
          {amountText}
        </Text>
      </TouchableOpacity>
    );
  };

  const categoryListHeader = (
    <View style={styles.headerBlock}>
      {/* Compact Month Selector Card */}
      <View
        style={[
          styles.monthCard,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
          !isDarkMode && styles.cardShadowLight,
        ]}
      >
        <View style={styles.monthTopRow}>
          <TouchableOpacity
            onPress={() => moveMonthBy(-1)}
            activeOpacity={0.75}
            accessibilityLabel="Previous month"
            style={[
              styles.monthArrowBtn,
              {
                backgroundColor: palette.surfaceSubtle,
                borderColor: palette.cardBorder,
              },
            ]}
          >
            <Feather name="chevron-left" size={18} color={palette.textPrimary} />
          </TouchableOpacity>

          <View style={styles.monthCenterCol}>
            <Text style={[styles.monthTitle, { color: palette.textPrimary }]}>
              {getMonthLabel(selectedMonthDate)}
            </Text>
            <View style={styles.monthBadgesRow}>
              {isCurrentMonthSelected ? (
                <View style={[styles.monthBadgePill, { backgroundColor: palette.positiveBg }]}>
                  <Text style={[styles.monthBadgeText, { color: palette.positive }]}>
                    CURRENT MONTH
                  </Text>
                </View>
              ) : (
                <View style={[styles.monthBadgePill, { backgroundColor: palette.surfaceSubtle }]}>
                  <Text style={[styles.monthBadgeText, { color: palette.textSecondary }]}>
                    PAST MONTH · VIEW ONLY
                  </Text>
                </View>
              )}
              {hasCurrentMonthCategoryBudgets && (
                <View style={[styles.monthBadgePill, { backgroundColor: palette.primarySoft }]}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={11}
                    color={palette.primaryText}
                  />
                  <Text style={[styles.monthBadgeText, { color: palette.primaryText, marginLeft: 3 }]}>
                    ACTIVE
                  </Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            onPress={() => moveMonthBy(1)}
            disabled={isNextMonthDisabled}
            activeOpacity={0.75}
            accessibilityLabel="Next month"
            style={[
              styles.monthArrowBtn,
              {
                backgroundColor: palette.surfaceSubtle,
                borderColor: palette.cardBorder,
                opacity: isNextMonthDisabled ? 0.4 : 1,
              },
            ]}
          >
            <Feather name="chevron-right" size={18} color={palette.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Compact Horizontal Month Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthPillsScroll}
        >
          {monthCarousel.map((monthDate) => {
            const isActive =
              monthDate.getMonth() === selectedMonthDate.getMonth() &&
              monthDate.getFullYear() === selectedMonthDate.getFullYear();
            return (
              <TouchableOpacity
                key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
                activeOpacity={0.8}
                onPress={() =>
                  setSelectedMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1))
                }
                style={[
                  styles.monthChipPill,
                  {
                    backgroundColor: isActive ? palette.positiveBg : palette.surfaceSubtle,
                    borderColor: isActive ? palette.positive : palette.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.monthChipText,
                    { color: isActive ? palette.positive : palette.textSecondary },
                  ]}
                >
                  {getMonthLabel(monthDate)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Actionable Copy Prompt ONLY when current month has 0 budgets */}
        {shouldShowCopyOption && (
          <View
            style={[
              styles.copyPromptBox,
              {
                backgroundColor: palette.primarySoft,
                borderColor: palette.primaryBorder,
              },
            ]}
          >
            <View style={styles.copyPromptTopRow}>
              <View style={[styles.copyPromptIcon, { backgroundColor: palette.cardBg }]}>
                <MaterialCommunityIcons
                  name="content-copy"
                  size={18}
                  color={palette.primaryText}
                />
              </View>
              <View style={styles.copyPromptTextWrap}>
                <Text style={[styles.copyPromptTitle, { color: palette.textPrimary }]}>
                  Start with previous month's budgets
                </Text>
                <Text style={[styles.copyPromptSub, { color: palette.textSecondary }]}>
                  Copy existing category limits into {getMonthLabel(selectedMonthDate)} in one tap.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowCopyModal(true)}
              style={[styles.copyPromptBtn, { backgroundColor: palette.primary }]}
            >
              <MaterialCommunityIcons name="content-copy" size={16} color="#FFFFFF" />
              <Text style={styles.copyPromptBtnText}>Copy from Past Month</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Adaptive Light / Dark Total Category Budget Hero Card */}
      {categoryBudgets.length > 0 && (
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
              <View style={[styles.heroBadgeIcon, { backgroundColor: palette.positiveBg }]}>
                <MaterialCommunityIcons
                  name="chart-donut"
                  size={18}
                  color={palette.positive}
                />
              </View>
              <View style={styles.heroTitleTextCol}>
                <Text style={[styles.heroEyebrow, { color: palette.textSecondary }]}>
                  TOTAL CATEGORY BUDGET
                </Text>
                <Text style={[styles.heroSubMeta, { color: palette.textMuted }]}>
                  {getMonthLabel(selectedMonthDate)} · {categoryBudgets.length}{' '}
                  {categoryBudgets.length === 1 ? 'category' : 'categories'}
                </Text>
              </View>
            </View>

            <View style={styles.heroRightControls}>
              <View style={[styles.healthPill, { backgroundColor: overallHealth.bg }]}>
                <Text style={[styles.healthPillText, { color: overallHealth.color }]}>
                  {overallHealth.label}
                </Text>
              </View>
              <TouchableOpacity
                onPress={toggleBalance}
                activeOpacity={0.75}
                accessibilityLabel={balanceVisible ? 'Hide amounts' : 'Show amounts'}
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

          <CurrencyText
            amount={budgetSummary.totalBudget}
            numberOfLines={1}
            style={[styles.heroTotalAmount, { color: palette.textPrimary }]}
          />

          {/* Overall Utilization Bar */}
          <View style={styles.heroUtilBlock}>
            <View style={styles.heroUtilHeader}>
              <Text style={[styles.heroUtilLabel, { color: palette.textSecondary }]}>
                Overall Usage
              </Text>
              <Text style={[styles.heroUtilPct, { color: overallHealth.color }]}>
                {Math.round(overallUtilization)}% used
              </Text>
            </View>
            <View style={[styles.heroUtilTrack, { backgroundColor: palette.surfaceSubtle }]}>
              <View
                style={[
                  styles.heroUtilFill,
                  {
                    width: `${Math.min(100, Math.max(0, overallUtilization))}%`,
                    backgroundColor: overallHealth.color,
                  },
                ]}
              />
            </View>
          </View>

          {/* Spent & Remaining Tiles */}
          <View style={styles.heroStatsRow}>
            {renderHeroStatTile({
              keyProp: 'spent',
              filterKey: budgetSummary.overCount > 0 ? 'over' : null,
              countText:
                budgetSummary.overCount > 0 ? `${budgetSummary.overCount} over` : undefined,
              label: 'Total Spent',
              amountText: balanceVisible ? formatRupees(budgetSummary.totalSpent) : '••••',
              icon: 'cash-minus',
              tintColor: budgetSummary.overCount > 0 ? palette.negative : palette.textPrimary,
              bgColor:
                budgetSummary.overCount > 0 ? palette.negativeBg : palette.primarySoft,
            })}
            {renderHeroStatTile({
              keyProp: 'remaining',
              filterKey: budgetSummary.onTrackCount > 0 ? 'track' : null,
              countText: `${budgetSummary.onTrackCount} ok`,
              label: totalRemaining < 0 ? 'Exceeded By' : 'Remaining',
              amountText: balanceVisible
                ? formatRupees(Math.abs(totalRemaining))
                : '••••',
              icon: totalRemaining < 0 ? 'alert-circle-outline' : 'shield-check-outline',
              tintColor: totalRemaining < 0 ? palette.negative : palette.positive,
              bgColor: totalRemaining < 0 ? palette.negativeBg : palette.positiveBg,
            })}
          </View>
        </View>
      )}

      {/* Search Bar */}
      {categoryBudgets.length > 0 && (
        <View
          style={[
            styles.searchBarBox,
            {
              backgroundColor: palette.inputBg,
              borderColor: palette.cardBorder,
            },
            !isDarkMode && styles.cardShadowLight,
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={palette.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search budgeted categories..."
            placeholderTextColor={palette.textMuted}
            style={[styles.searchInput, { color: palette.textPrimary }]}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close-circle" size={18} color={palette.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter Pills + Sort Row */}
      {categoryBudgets.length > 0 && (
        <View style={styles.controlsRow}>
          <View style={styles.filterPillsWrap}>
            {STATUS_FILTERS.map((opt) => {
              const count =
                opt.key === 'all'
                  ? categoryBudgets.length
                  : opt.key === 'over'
                    ? budgetSummary.overCount
                    : opt.key === 'near'
                      ? budgetSummary.nearCount
                      : budgetSummary.onTrackCount;
              const active = statusFilter === opt.key;
              const activeBg =
                opt.key === 'over'
                  ? palette.negative
                  : opt.key === 'near'
                    ? palette.warning
                    : opt.key === 'track'
                      ? palette.positive
                      : palette.primary;

              return (
                <TouchableOpacity
                  key={opt.key}
                  activeOpacity={0.8}
                  onPress={() => setStatusFilter(opt.key)}
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
                    {opt.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={cycleSortMode}
            style={[
              styles.sortPill,
              {
                backgroundColor: sortMode !== 'default' ? palette.primarySoft : palette.cardBg,
                borderColor: sortMode !== 'default' ? palette.primaryBorder : palette.cardBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={activeSort.icon}
              size={15}
              color={sortMode !== 'default' ? palette.primaryText : palette.textSecondary}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.sortPillText,
                { color: sortMode !== 'default' ? palette.primaryText : palette.textSecondary },
              ]}
            >
              {sortMode === 'default' ? 'Sort' : activeSort.label}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Section Title */}
      {filteredBudgets.length > 0 && (
        <View style={styles.listHeader}>
          <View>
            <Text style={[styles.listTitle, { color: palette.textPrimary }]}>
              {statusFilter === 'over'
                ? 'Over Budget Categories'
                : statusFilter === 'near'
                  ? 'Near Limit Categories'
                  : statusFilter === 'track'
                    ? 'On Track Categories'
                    : 'Category Budgets'}
            </Text>
            <Text style={[styles.listSubtitle, { color: palette.textSecondary }]}>
              Track your spending limits
            </Text>
          </View>

          <View style={[styles.listCountBadge, { backgroundColor: palette.badgeBg }]}>
            <Text style={[styles.listCountText, { color: palette.badgeText }]}>
              {filteredBudgets.length}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderBudgetCard = ({ item: budget }) => {
    const percentage = Number(budget.percentage || 0);
    const stKey = getBudgetStatusKey(budget);
    const isExceeded = stKey === 'over';
    const isWarning = stKey === 'near';

    const statusColor = isExceeded
      ? palette.negative
      : isWarning
        ? palette.warning
        : palette.positive;
    const statusSoftBg = isExceeded
      ? palette.negativeBg
      : isWarning
        ? palette.warningBg
        : palette.positiveBg;
    const itemColor = budget.color || palette.positive;
    const avatarTint = isDarkMode ? `${itemColor}2E` : `${itemColor}18`;
    const progressWidth = Math.min(100, Math.max(0, percentage));
    const remainingVal = Number(budget.remaining || 0);

    return (
      <TouchableOpacity
        activeOpacity={0.84}
        onPress={() =>
          navigateTarget('CategoriesDetails', {
            categoryId: budget.categoryId,
            categoryName: budget.categoryName,
          })
        }
        onLongPress={() => setActionSheetBudget(budget)}
        delayLongPress={260}
        style={[
          styles.budgetCard,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
            borderLeftColor: itemColor,
          },
          !isDarkMode && styles.cardShadowLight,
        ]}
      >
        {/* Top Row: Icon + Category Info + Usage Percentage */}
        <View style={styles.budgetTopRow}>
          <View style={[styles.budgetIconBox, { backgroundColor: avatarTint }]}>
            <MaterialCommunityIcons
              name={budget.icon || 'tag'}
              size={22}
              color={itemColor}
            />
          </View>

          <View style={styles.budgetInfoCol}>
            <Text
              numberOfLines={2}
              style={[styles.budgetName, { color: palette.textPrimary }]}
            >
              {budget.categoryName}
            </Text>
            <Text numberOfLines={1} style={[styles.budgetAmounts, { color: palette.textSecondary }]}>
              {balanceVisible
                ? `${formatRupees(budget.spent)} of ${formatRupees(budget.budget)}`
                : '•••• / ••••'}
            </Text>
          </View>

          <View style={styles.budgetStatusCol}>
            <Text style={[styles.budgetPctText, { color: statusColor }]}>
              {Math.round(percentage)}%
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusSoftBg }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {isExceeded ? 'OVER' : isWarning ? 'NEAR LIMIT' : 'ON TRACK'}
              </Text>
            </View>
          </View>
        </View>

        {/* Full-Width Progress Bar */}
        <View style={[styles.progressTrack, { backgroundColor: palette.surfaceSubtle }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressWidth}%`,
                backgroundColor: statusColor,
              },
            ]}
          />
        </View>

        {/* Footer: Remaining Status + Hidden Actions Trigger */}
        <View style={[styles.budgetFooter, { borderTopColor: palette.divider }]}>
          <View style={styles.footerRemainingRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text
              numberOfLines={1}
              style={[
                styles.footerRemainingText,
                { color: isExceeded ? palette.negative : palette.textSecondary },
              ]}
            >
              {!balanceVisible
                ? isExceeded
                  ? '•••• over limit'
                  : '•••• remaining'
                : isExceeded
                  ? `${formatRupees(Math.abs(remainingVal))} over limit`
                  : `${formatRupees(remainingVal)} left`}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={(e) => {
              e?.stopPropagation?.();
              setActionSheetBudget(budget);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`More actions for ${budget.categoryName}`}
            style={[
              styles.moreActionsPill,
              {
                backgroundColor: palette.surfaceSubtle,
                borderColor: palette.cardBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="dots-horizontal"
              size={18}
              color={palette.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Segmented Light / Dark Top Tab Switcher */}
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
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setTab('overall')}
            style={[
              styles.tabItem,
              tab === 'overall' && [
                styles.tabItemActive,
                {
                  backgroundColor: isDarkMode ? '#243247' : palette.cardBg,
                  borderColor: isDarkMode ? palette.primaryBorder : palette.cardBorder,
                },
                !isDarkMode && styles.cardShadowLight,
              ],
            ]}
          >
            <MaterialCommunityIcons
              name="wallet-outline"
              size={16}
              color={tab === 'overall' ? palette.positive : palette.textSecondary}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: tab === 'overall' ? palette.textPrimary : palette.textSecondary,
                  fontWeight: tab === 'overall' ? '800' : '600',
                },
              ]}
            >
              Overall Budget
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setTab('category')}
            style={[
              styles.tabItem,
              tab === 'category' && [
                styles.tabItemActive,
                {
                  backgroundColor: isDarkMode ? '#243247' : palette.cardBg,
                  borderColor: isDarkMode ? palette.primaryBorder : palette.cardBorder,
                },
                !isDarkMode && styles.cardShadowLight,
              ],
            ]}
          >
            <MaterialCommunityIcons
              name="shape-outline"
              size={16}
              color={tab === 'category' ? palette.positive : palette.textSecondary}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color: tab === 'category' ? palette.textPrimary : palette.textSecondary,
                  fontWeight: tab === 'category' ? '800' : '600',
                },
              ]}
            >
              Category Budget
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === 'overall' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.overallScrollContent}
        >
          {/* Overall Monthly Budget Hero Card */}
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
                <View style={[styles.heroBadgeIcon, { backgroundColor: palette.positiveBg }]}>
                  <MaterialCommunityIcons name="cash-check" size={18} color={palette.positive} />
                </View>
                <View style={styles.heroTitleTextCol}>
                  <Text style={[styles.heroEyebrow, { color: palette.textSecondary }]}>
                    MONTHLY OVERALL BUDGET
                  </Text>
                  <Text style={[styles.heroSubMeta, { color: palette.textMuted }]}>
                    Global cap across all expenses
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={toggleBalance}
                activeOpacity={0.75}
                accessibilityLabel={balanceVisible ? 'Hide budget limit' : 'Show budget limit'}
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

            <CurrencyText
              amount={parseFloat(limit) || 0}
              numberOfLines={1}
              style={[styles.heroTotalAmount, { color: palette.positive }]}
            />

            <View
              style={[
                styles.overallInfoBanner,
                {
                  backgroundColor: palette.surfaceSubtle,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={16}
                color={palette.textSecondary}
              />
              <Text style={[styles.overallInfoText, { color: palette.textSecondary }]}>
                {categoryBudgets.length > 0
                  ? `Combined across ${categoryBudgets.length} category limits (${balanceVisible ? formatRupees(budgetSummary.totalBudget) : '••••'})`
                  : 'Set one target limit below or add per-category limits.'}
              </Text>
            </View>
          </View>

          {/* Limit Input & Presets Card */}
          <View
            style={[
              styles.overallFormCard,
              {
                backgroundColor: palette.cardBg,
                borderColor: palette.cardBorder,
              },
              !isDarkMode && styles.cardShadowLight,
            ]}
          >
            <Text style={[styles.formLabel, { color: palette.textPrimary }]}>
              Monthly Spending Limit
            </Text>
            <Text style={[styles.formHint, { color: palette.textSecondary }]}>
              Enter an amount or pick a preset to update your monthly limit
            </Text>

            <View
              style={[
                styles.limitInputBox,
                {
                  backgroundColor: palette.inputBg,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <View style={[styles.currencyTag, { backgroundColor: palette.positiveBg }]}>
                <Text style={[styles.currencyTagText, { color: palette.positive }]}>₹</Text>
              </View>
              <TextInput
                value={limit}
                onChangeText={setLimit}
                keyboardType="numeric"
                placeholder="e.g. 50000"
                placeholderTextColor={palette.textMuted}
                style={[styles.limitInput, { color: palette.textPrimary }]}
              />
              {String(limit).length > 0 && (
                <TouchableOpacity
                  onPress={() => setLimit('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color={palette.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.presetsRow}>
              {OVERALL_PRESETS.map((preset) => {
                const selected = String(parseFloat(limit) || 0) === preset.value;
                return (
                  <TouchableOpacity
                    key={preset.value}
                    activeOpacity={0.8}
                    onPress={() => setLimit(preset.value)}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: selected ? palette.positiveBg : palette.surfaceSubtle,
                        borderColor: selected ? palette.positive : palette.cardBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        { color: selected ? palette.positive : palette.textSecondary },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={setNow}
              style={[styles.primaryActionBtn, { backgroundColor: palette.positive }]}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>Set Now</Text>
            </TouchableOpacity>

            <Text style={[styles.formFooterNote, { color: palette.textMuted }]}>
              This creates or updates your general monthly budget and returns to the Dashboard.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredBudgets}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={categoryListHeader}
          contentContainerStyle={[
            styles.listContent,
            filteredBudgets.length === 0 && styles.emptyListContent,
          ]}
          ListEmptyComponent={
            <View
              style={[
                styles.emptyStateCard,
                {
                  backgroundColor: palette.cardBg,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <View style={[styles.emptyIconCircle, { backgroundColor: palette.positiveBg }]}>
                <MaterialCommunityIcons
                  name="target"
                  size={34}
                  color={palette.positive}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
                {categoryBudgets.length === 0 ? 'No category budgets yet' : 'No matching budgets'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
                {searchQuery
                  ? `No budgeted category matches "${searchQuery}"`
                  : statusFilter !== 'all'
                    ? 'No category budgets match the selected status filter.'
                    : 'Create spending limits for individual categories to track where your money goes.'}
              </Text>
              {(searchQuery.length > 0 || statusFilter !== 'all') && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  style={[
                    styles.resetFilterBtn,
                    {
                      backgroundColor: palette.primarySoft,
                      borderColor: palette.primaryBorder,
                    },
                  ]}
                >
                  <Text style={[styles.resetFilterText, { color: palette.primaryText }]}>
                    Show all budgets
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
          initialNumToRender={12}
          windowSize={10}
          renderItem={renderBudgetCard}
        />
      )}

      {/* ADD CATEGORY BUDGET FAB */}
      {tab === 'category' && isCurrentMonthSelected && (
        <ContextualFAB
          onPress={() => {
            navigation.navigate('BudgetCreate', { selectedMonth, selectedYear });
          }}
        />
      )}

      {/* BUDGET ACTION SHEET (Hidden Edit / Delete / Breakdown Hub) */}
      <ResponsiveBottomSheet
        visible={!!actionSheetBudget}
        animationType="slide"
        maxHeightRatio={0.75}
        backdropColor={isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)'}
        onRequestClose={() => setActionSheetBudget(null)}
        sheetStyle={[
          styles.actionSheetContainer,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
        ]}
      >
        {({ maxHeight }) =>
          actionSheetBudget
            ? (() => {
              const target = actionSheetBudget;
              const sheetColor = target.color || palette.positive;
              const sheetPct = Number(target.percentage || 0);
              const sheetKey = getBudgetStatusKey(target);
              const sheetStatusColor =
                sheetKey === 'over'
                  ? palette.negative
                  : sheetKey === 'near'
                    ? palette.warning
                    : palette.positive;
              const sheetAvatarBg = isDarkMode ? `${sheetColor}2E` : `${sheetColor}18`;

              return (
                <View style={{ maxHeight }}>
                  <View
                    style={[
                      styles.sheetHandle,
                      { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' },
                    ]}
                  />

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    style={{
                      flexGrow: 0,
                      flexShrink: 1,
                      maxHeight: Math.max(200, maxHeight - 36),
                    }}
                  >
                    <View style={styles.sheetHeaderRow}>
                      <View style={styles.sheetHeaderTextWrap}>
                        <Text style={[styles.sheetTitle, { color: palette.textPrimary }]}>
                          Budget Actions
                        </Text>
                        <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
                          {isCurrentMonthSelected
                            ? `Manage ${getMonthLabel(selectedMonthDate)} spending limit`
                            : `Viewing ${getMonthLabel(selectedMonthDate)} budget`}
                        </Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => setActionSheetBudget(null)}
                        accessibilityLabel="Close actions"
                        style={[
                          styles.sheetCloseBtn,
                          { backgroundColor: palette.surfaceSubtle },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="close"
                          size={18}
                          color={palette.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Selected Budget Preview Card */}
                    <View
                      style={[
                        styles.sheetPreviewCard,
                        {
                          backgroundColor: palette.surfaceSubtle,
                          borderColor: palette.cardBorder,
                          borderLeftColor: sheetColor,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.sheetPreviewAvatar,
                          { backgroundColor: sheetAvatarBg },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={target.icon || 'tag'}
                          size={22}
                          color={sheetColor}
                        />
                      </View>

                      <View style={styles.sheetPreviewInfo}>
                        <Text
                          numberOfLines={2}
                          style={[styles.sheetPreviewName, { color: palette.textPrimary }]}
                        >
                          {target.categoryName}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.sheetPreviewMeta, { color: palette.textSecondary }]}
                        >
                          {balanceVisible
                            ? `${formatRupees(target.spent)} of ${formatRupees(target.budget)}`
                            : '•••• / ••••'}
                        </Text>
                      </View>

                      <View style={styles.sheetPreviewRight}>
                        <Text
                          numberOfLines={1}
                          style={[styles.sheetPreviewPct, { color: sheetStatusColor }]}
                        >
                          {Math.round(sheetPct)}%
                        </Text>
                        <Text style={[styles.sheetPreviewTag, { color: sheetStatusColor }]}>
                          {sheetKey === 'over'
                            ? 'OVER'
                            : sheetKey === 'near'
                              ? 'NEAR LIMIT'
                              : 'ON TRACK'}
                        </Text>
                      </View>
                    </View>

                    {isCurrentMonthSelected ? (
                      <View style={styles.actionTilesRow}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            setActionSheetBudget(null);
                            navigation.navigate('BudgetCreate', {
                              editData: {
                                categoryId: target.categoryId,
                                budget: target.budget,
                                categoryName: target.categoryName,
                                icon: target.icon,
                                color: target.color,
                              },
                              selectedMonth,
                              selectedYear,
                            });
                          }}
                          style={[
                            styles.actionTile,
                            {
                              backgroundColor: palette.editBg,
                              borderColor: palette.editBorder,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.actionTileIconCircle,
                              { backgroundColor: palette.cardBg },
                            ]}
                          >
                            <Feather name="edit-2" size={18} color={palette.editIcon} />
                          </View>
                          <Text style={[styles.actionTileTitle, { color: palette.textPrimary }]}>
                            Edit Limit
                          </Text>
                          <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                            Adjust monthly cap
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            setActionSheetBudget(null);
                            handleDeleteCategoryBudget(target);
                          }}
                          style={[
                            styles.actionTile,
                            {
                              backgroundColor: palette.deleteBg,
                              borderColor: palette.deleteBorder,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.actionTileIconCircle,
                              { backgroundColor: palette.cardBg },
                            ]}
                          >
                            <Feather name="trash-2" size={18} color={palette.deleteIcon} />
                          </View>
                          <Text style={[styles.actionTileTitle, { color: palette.deleteIcon }]}>
                            Delete Budget
                          </Text>
                          <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                            Remove month limit
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.readOnlySheetNotice,
                          {
                            backgroundColor: palette.surfaceSubtle,
                            borderColor: palette.cardBorder,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="lock-outline"
                          size={16}
                          color={palette.textSecondary}
                        />
                        <Text style={[styles.readOnlySheetText, { color: palette.textSecondary }]}>
                          Past month budget limits are view-only and cannot be modified.
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setActionSheetBudget(null);
                        navigateTarget('CategoriesDetails', {
                          categoryId: target.categoryId,
                          categoryName: target.categoryName,
                        });
                      }}
                      style={[
                        styles.sheetHistoryRow,
                        {
                          backgroundColor: palette.surfaceSubtle,
                          borderColor: palette.cardBorder,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.sheetHistoryIcon,
                          { backgroundColor: palette.primarySoft },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="chart-timeline-variant"
                          size={18}
                          color={palette.primary}
                        />
                      </View>
                      <View style={styles.sheetHistoryTextWrap}>
                        <Text style={[styles.sheetHistoryTitle, { color: palette.textPrimary }]}>
                          View Category Transactions
                        </Text>
                        <Text style={[styles.sheetHistorySub, { color: palette.textSecondary }]}>
                          Inspect monthly spending & entries
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={palette.textMuted} />
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              );
            })()
            : null
        }
      </ResponsiveBottomSheet>

      <CommonBottomSheetModal
        visible={confirmVisible}
        type="danger"
        title="Delete Budget?"
        subtitle={
          deletingBudgetName
            ? `Are you sure you want to delete the monthly limit for "${deletingBudgetName}"?`
            : 'Are you sure you want to delete this monthly category budget?'
        }
        confirmLabel="Delete Budget"
        cancelLabel="Keep Budget"
        loading={isDeletingBudget}
        warnings={[
          { title: 'Budget Removed', text: 'Category spending limit will be removed for this month.' },
          { title: 'Expenses Safe', text: 'All recorded transactions and expenses remain intact.' },
          { title: 'Cannot Be Undone', text: 'This action cannot be reversed.' },
        ]}
        onCancel={() => {
          if (isDeletingBudget) return;
          setConfirmVisible(false);
          setDeletingBudgetId(null);
          setDeletingBudgetName('');
        }}
        onConfirm={confirmDeleteCategoryBudget}
      />

      <CopyBudgetModal
        visible={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        onCopy={(m, y) => handleCopyPreviousMonth(m, y)}
      />

      <Snackbar
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setToastVisible(false),
        }}
      >
        {toastMsg}
      </Snackbar>
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

  /* Segmented Tab Bar */
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 11,
    gap: 6,
  },
  tabItemActive: {
    borderWidth: 1,
  },
  tabLabel: {
    fontSize: 13.5,
  },

  /* List Containers */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 112,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  headerBlock: {
    marginBottom: 4,
  },
  overallScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 60,
  },

  /* Compact Month Card */
  monthCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 13,
    marginBottom: 12,
  },
  monthTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenterCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  monthBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  monthBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  monthBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  monthPillsScroll: {
    gap: 8,
    paddingBottom: 2,
  },
  monthChipPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  monthChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  copyPromptBox: {
    marginTop: 12,
    borderRadius: 15,
    borderWidth: 1,
    padding: 13,
  },
  copyPromptTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyPromptIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  copyPromptTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  copyPromptTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  copyPromptSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  copyPromptBtn: {
    marginTop: 12,
    height: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  copyPromptBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },

  /* Hero Overview Card */
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
  heroTotalAmount: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  heroUtilBlock: {
    marginBottom: 14,
  },
  heroUtilHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroUtilLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroUtilPct: {
    fontSize: 12,
    fontWeight: '800',
  },
  heroUtilTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  heroUtilFill: {
    height: '100%',
    borderRadius: 4,
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
  heroStatCountPill: {
    minWidth: 24,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatCountText: {
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

  /* Search & Filter Controls */
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 13,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 9,
    paddingVertical: 0,
  },
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
    paddingHorizontal: 10,
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
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  listSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  listCountBadge: {
    minWidth: 28,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCountText: {
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* Budget Cards */
  budgetCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
    marginBottom: 11,
  },
  budgetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  budgetInfoCol: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 10,
  },
  budgetName: {
    fontSize: 15.5,
    fontWeight: '800',
    lineHeight: 20,
  },
  budgetAmounts: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  budgetStatusCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  budgetPctText: {
    fontSize: 17,
    fontWeight: '900',
  },
  statusBadge: {
    marginTop: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 7,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetFooter: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerRemainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  footerRemainingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  moreActionsPill: {
    height: 28,
    minWidth: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Overall Tab Form */
  overallInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 8,
  },
  overallInfoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  overallFormCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  formHint: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
    marginBottom: 14,
  },
  limitInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  currencyTag: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  currencyTagText: {
    fontSize: 16,
    fontWeight: '900',
  },
  limitInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: '800',
    paddingVertical: 0,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  primaryActionBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  formFooterNote: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },

  /* Hidden Action Sheet */
  actionSheetContainer: {
    width: '100%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sheetPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 14,
  },
  sheetPreviewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sheetPreviewInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 8,
  },
  sheetPreviewName: {
    fontSize: 15,
    fontWeight: '800',
  },
  sheetPreviewMeta: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  sheetPreviewRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  sheetPreviewPct: {
    fontSize: 16,
    fontWeight: '900',
  },
  sheetPreviewTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  actionTilesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  actionTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'flex-start',
  },
  actionTileIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTileTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionTileSub: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  readOnlySheetNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    gap: 8,
  },
  readOnlySheetText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  sheetHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  sheetHistoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sheetHistoryTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  sheetHistoryTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  sheetHistorySub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },

  /* Empty State */
  emptyStateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 36,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  resetFilterBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  resetFilterText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
});
