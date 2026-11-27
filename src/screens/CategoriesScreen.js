import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { getCategories, softDeleteCategory } from '../services/categories';
import { getCategoryAndSourceUsage } from '../services/transactions';
import CommonBottomSheetModal from '../components/CommonBottomSheetModal';
import ResponsiveBottomSheet from '../components/ResponsiveBottomSheet';
import ContextualFAB from '../components/ContextualFAB';
import { useTheme } from '../context/ThemeContext';
import { useCategories, useAppDispatch } from '../redux/hooks';
import { setCategories, setCategoriesMap } from '../redux/slices/categorySlice';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
];

const SORT_MODES = [
  { key: 'default', label: 'Default', icon: 'sort' },
  { key: 'most_used', label: 'Most Used', icon: 'sort-descending' },
  { key: 'name_desc', label: 'Name Z–A', icon: 'sort-alphabetical-descending' },
];

export default function CategoriesScreen({ route, navigation }) {
  const { isDarkMode, theme } = useTheme();
  const dispatch = useAppDispatch();
  const reduxItems = useCategories();
  const items = reduxItems || [];

  const [usageMap, setUsageMap] = useState({});
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTargetItem, setConfirmTargetItem] = useState(null);
  const [actionSheetItem, setActionSheetItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'expense' | 'income'
  const [sortMode, setSortMode] = useState('default'); // 'default' | 'most_used' | 'name_desc'
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

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
        income: '#34D399',
        incomeBg: 'rgba(16, 185, 129, 0.14)',
        incomeBorder: 'rgba(52, 211, 153, 0.28)',
        expense: '#F87171',
        expenseBg: 'rgba(239, 68, 68, 0.14)',
        expenseBorder: 'rgba(248, 113, 113, 0.28)',
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
      income: '#059669',
      incomeBg: '#ECFDF5',
      incomeBorder: '#A7F3D0',
      expense: '#DC2626',
      expenseBg: '#FEF2F2',
      expenseBorder: '#FECACA',
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

  const load = useCallback(async () => {
    try {
      const [rows, usage] = await Promise.all([
        getCategories(true),
        getCategoryAndSourceUsage(1).catch(() => ({ categoryCount: {} })),
      ]);

      const safeRows = rows || [];
      dispatch(setCategories(safeRows));

      const catMap = {};
      safeRows.forEach((c) => {
        catMap[c.id] = c;
      });
      dispatch(setCategoriesMap(catMap));
      setUsageMap(usage?.categoryCount || {});
    } catch (e) {
      console.warn('CategoriesScreen load error:', e);
    }
  }, [dispatch]);

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

  // Support deep-link / param editId by opening CategoryCreate directly
  useEffect(() => {
    const editId = route?.params?.editId;
    if (!editId || items.length === 0) return;

    const match = items.find((i) => String(i.id) === String(editId));
    if (match) {
      navigation.setParams?.({ editId: undefined });
      navigation.navigate('CategoryCreate', {
        editData: match,
        currentType: match.type || 'expense',
      });
    }
  }, [route?.params?.editId, items, navigation]);

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const uses = Number(usageMap[String(item.id)] || 0);
        acc.totalUses += uses;
        if (String(item.type || '').toLowerCase() === 'income') {
          acc.incomeCount += 1;
          acc.incomeUses += uses;
        } else {
          acc.expenseCount += 1;
          acc.expenseUses += uses;
        }
        return acc;
      },
      {
        expenseCount: 0,
        incomeCount: 0,
        expenseUses: 0,
        incomeUses: 0,
        totalUses: 0,
      }
    );
  }, [items, usageMap]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = items.filter((item) => {
      const itemType = String(item.type || 'expense').toLowerCase() === 'income' ? 'income' : 'expense';
      if (typeFilter === 'expense' && itemType !== 'expense') return false;
      if (typeFilter === 'income' && itemType !== 'income') return false;
      if (q && !(item.name || '').toLowerCase().includes(q)) return false;
      return true;
    });

    if (sortMode === 'most_used') {
      return [...matched].sort((a, b) => {
        const diff = Number(usageMap[String(b.id)] || 0) - Number(usageMap[String(a.id)] || 0);
        if (diff !== 0) return diff;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
    }
    if (sortMode === 'name_desc') {
      return [...matched].sort((a, b) =>
        String(b.name || '').localeCompare(String(a.name || ''))
      );
    }
    return matched;
  }, [items, searchQuery, typeFilter, sortMode, usageMap]);

  const activeSort = SORT_MODES.find((m) => m.key === sortMode) || SORT_MODES[0];

  const cycleSortMode = () => {
    const idx = SORT_MODES.findIndex((m) => m.key === sortMode);
    const next = SORT_MODES[(idx + 1) % SORT_MODES.length];
    setSortMode(next.key);
  };

  async function remove(id) {
    await softDeleteCategory(id);
    await load();
  }

  const toggleTypeFilter = (target) => {
    setTypeFilter((prev) => (prev === target ? 'all' : target));
  };

  const expenseShare = items.length > 0 ? Math.round((summary.expenseCount / items.length) * 100) : 0;
  const incomeShare = items.length > 0 ? Math.round((summary.incomeCount / items.length) * 100) : 0;

  const renderStatTile = ({
    filterKey,
    count,
    label,
    metaText,
    icon,
    tintColor,
    bgColor,
  }) => {
    const isActive = typeFilter === filterKey;
    return (
      <TouchableOpacity
        key={filterKey}
        activeOpacity={0.8}
        onPress={() => toggleTypeFilter(filterKey)}
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
              {count}
            </Text>
          </View>
        </View>

        <Text style={[styles.heroStatLabel, { color: palette.textSecondary }]}>
          {label}
        </Text>
        <Text numberOfLines={1} style={[styles.heroStatValue, { color: tintColor }]}>
          {metaText}
        </Text>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      {/* Adaptive Light / Dark Categories Overview Hero Card */}
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
                name="shape-outline"
                size={18}
                color={palette.primary}
              />
            </View>
            <View style={styles.heroTitleTextCol}>
              <Text style={[styles.heroEyebrow, { color: palette.textSecondary }]}>
                CATEGORIES OVERVIEW
              </Text>
              <Text style={[styles.heroSubMeta, { color: palette.textMuted }]}>
                Organize income & expenses
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => navigateTarget('CategoryBudgetsDashboard')}
            activeOpacity={0.75}
            style={[
              styles.budgetsPillBtn,
              {
                backgroundColor: palette.primarySoft,
                borderColor: palette.primaryBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="chart-arc"
              size={14}
              color={palette.primaryText}
            />
            <Text style={[styles.budgetsPillText, { color: palette.primaryText }]}>
              Budgets
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroHeadlineRow}>
          <Text style={[styles.heroTotalValue, { color: palette.textPrimary }]}>
            {items.length}
          </Text>
          <View style={styles.heroHeadlineMetaCol}>
            <Text style={[styles.heroHeadlineUnit, { color: palette.textPrimary }]}>
              {items.length === 1 ? 'Category' : 'Categories'}
            </Text>
            <Text style={[styles.heroHeadlineSub, { color: palette.textSecondary }]}>
              {summary.totalUses} {summary.totalUses === 1 ? 'entry' : 'entries'} in past year
            </Text>
          </View>
        </View>

        {/* Interactive Expense & Income Filter Tiles */}
        <View style={styles.heroStatsRow}>
          {renderStatTile({
            filterKey: 'expense',
            count: summary.expenseCount,
            label: 'Expenses',
            metaText: `${expenseShare}% · ${summary.expenseUses} txns`,
            icon: 'arrow-down',
            tintColor: palette.expense,
            bgColor: palette.expenseBg,
          })}
          {renderStatTile({
            filterKey: 'income',
            count: summary.incomeCount,
            label: 'Income',
            metaText: `${incomeShare}% · ${summary.incomeUses} txns`,
            icon: 'arrow-up',
            tintColor: palette.income,
            bgColor: palette.incomeBg,
          })}
        </View>
      </View>

      {/* Search Bar */}
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
          placeholder="Search categories by name..."
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

      {/* Filter Pills + Sort Row */}
      <View style={styles.controlsRow}>
        <View style={styles.filterPillsWrap}>
          {FILTER_OPTIONS.map((opt) => {
            const count =
              opt.key === 'all'
                ? items.length
                : opt.key === 'expense'
                  ? summary.expenseCount
                  : summary.incomeCount;
            const active = typeFilter === opt.key;
            const activeBg =
              opt.key === 'expense'
                ? palette.expense
                : opt.key === 'income'
                  ? palette.income
                  : palette.primary;

            return (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.8}
                onPress={() => setTypeFilter(opt.key)}
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

      {/* Section Title */}
      {filteredItems.length > 0 && (
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: palette.textPrimary }]}>
            {typeFilter === 'expense'
              ? 'Expense Categories'
              : typeFilter === 'income'
                ? 'Income Categories'
                : 'All Categories'}
          </Text>
          <View style={[styles.listCountBadge, { backgroundColor: palette.badgeBg }]}>
            <Text style={[styles.listCountText, { color: palette.badgeText }]}>
              {filteredItems.length}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderCategoryCard = ({ item }) => {
    const isIncome = String(item.type || 'expense').toLowerCase() === 'income';
    const itemColor = item.color || palette.primary;
    const typeColor = isIncome ? palette.income : palette.expense;
    const typeSoftBg = isIncome ? palette.incomeBg : palette.expenseBg;
    const avatarTint = isDarkMode ? `${itemColor}2E` : `${itemColor}18`;
    const txCount = Number(usageMap[String(item.id)] || 0);

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => {
          navigateTarget('CategoriesDetails', {
            categoryId: item.id,
            categoryName: item.name,
          });
        }}
        onLongPress={() => setActionSheetItem(item)}
        delayLongPress={260}
        style={[
          styles.categoryCard,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
            borderLeftColor: itemColor,
          },
          !isDarkMode && styles.cardShadowLight,
        ]}
      >
        <View style={styles.categoryTopRow}>
          <View style={[styles.categoryIconBox, { backgroundColor: avatarTint }]}>
            <MaterialCommunityIcons
              name={item.icon || 'tag'}
              size={22}
              color={itemColor}
            />
          </View>

          <View style={styles.categoryInfoCol}>
            <Text
              numberOfLines={2}
              style={[styles.categoryName, { color: palette.textPrimary }]}
            >
              {item.name}
            </Text>

            <View style={styles.categoryStatusRow}>
              <View style={[styles.statusBadge, { backgroundColor: typeSoftBg }]}>
                <View style={[styles.statusDot, { backgroundColor: typeColor }]} />
                <Text numberOfLines={1} style={[styles.statusBadgeText, { color: typeColor }]}>
                  {isIncome ? 'Income' : 'Expense'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.categoryUsageCol}>
            <Text
              numberOfLines={1}
              style={[
                styles.categoryUsageValue,
                { color: txCount > 0 ? palette.textPrimary : palette.textMuted },
              ]}
            >
              {txCount}
            </Text>
            <View style={styles.usageCaptionRow}>
              <Text style={[styles.usageCaption, { color: palette.textMuted }]}>
                USES (1Y)
              </Text>
              {txCount > 0 && (
                <MaterialCommunityIcons
                  name="arrow-top-right"
                  size={11}
                  color={typeColor}
                />
              )}
            </View>
          </View>
        </View>

        <View style={[styles.categoryFooter, { borderTopColor: palette.divider }]}>
          <View style={styles.footerMetaRow}>
            <MaterialCommunityIcons
              name="chart-timeline-variant"
              size={14}
              color={palette.textMuted}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.footerMetaText,
                { color: txCount > 0 ? palette.textSecondary : palette.textMuted },
              ]}
            >
              {txCount > 0
                ? 'Tap for analytics & history'
                : 'No entries in past year'}
            </Text>
          </View>

          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={(e) => {
                e?.stopPropagation?.();
                setActionSheetItem(item);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`More actions for ${item.name}`}
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
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          filteredItems.length === 0 && styles.emptyListContent,
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
            <View style={[styles.emptyIconCircle, { backgroundColor: palette.surfaceSubtle }]}>
              <MaterialCommunityIcons
                name="tag-multiple-outline"
                size={34}
                color={palette.textMuted}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
              No categories found
            </Text>
            <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
              {searchQuery
                ? `No category matches "${searchQuery}"`
                : typeFilter !== 'all'
                  ? `No ${typeFilter} categories found`
                  : 'Tap + to add your first expense or income category'}
            </Text>
            {(searchQuery.length > 0 || typeFilter !== 'all') && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
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
                  Show all categories
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        initialNumToRender={15}
        windowSize={10}
        renderItem={renderCategoryCard}
      />

      {/* CATEGORY ACTION SHEET (Hidden Edit / Delete / Breakdown Hub) */}
      <ResponsiveBottomSheet
        visible={!!actionSheetItem}
        animationType="slide"
        maxHeightRatio={0.75}
        backdropColor={isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)'}
        onRequestClose={() => setActionSheetItem(null)}
        sheetStyle={[
          styles.actionSheetContainer,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
        ]}
      >
        {({ maxHeight }) =>
          actionSheetItem
            ? (() => {
                const sheetItem = actionSheetItem;
                const sheetColor = sheetItem.color || palette.primary;
                const sheetIsIncome =
                  String(sheetItem.type || 'expense').toLowerCase() === 'income';
                const sheetTypeColor = sheetIsIncome ? palette.income : palette.expense;
                const sheetAvatarBg = isDarkMode ? `${sheetColor}2E` : `${sheetColor}18`;
                const sheetUses = Number(usageMap[String(sheetItem.id)] || 0);

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
                            Category Actions
                          </Text>
                          <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
                            Manage category details or remove item
                          </Text>
                        </View>

                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => setActionSheetItem(null)}
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

                      {/* Selected Category Preview Card */}
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
                            name={sheetItem.icon || 'tag'}
                            size={22}
                            color={sheetColor}
                          />
                        </View>

                        <View style={styles.sheetPreviewInfo}>
                          <Text
                            numberOfLines={2}
                            style={[styles.sheetPreviewName, { color: palette.textPrimary }]}
                          >
                            {sheetItem.name}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[styles.sheetPreviewMeta, { color: sheetTypeColor }]}
                          >
                            {sheetIsIncome ? 'Income category' : 'Expense category'}
                          </Text>
                        </View>

                        <View style={styles.sheetPreviewRight}>
                          <Text
                            numberOfLines={1}
                            style={[styles.sheetPreviewCount, { color: palette.textPrimary }]}
                          >
                            {sheetUses}
                          </Text>
                          <Text style={[styles.sheetPreviewTag, { color: palette.textMuted }]}>
                            USES (1Y)
                          </Text>
                        </View>
                      </View>

                      {/* Two-Column Edit & Delete Tiles */}
                      <View style={styles.actionTilesRow}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            const target = sheetItem;
                            setActionSheetItem(null);
                            navigation.navigate('CategoryCreate', {
                              editData: target,
                              currentType: target.type || 'expense',
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
                            Edit Category
                          </Text>
                          <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                            Name, icon & color
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            const target = sheetItem;
                            setActionSheetItem(null);
                            setConfirmTargetItem(target);
                            setConfirmVisible(true);
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
                            Delete Category
                          </Text>
                          <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                            Remove from active list
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* View Category Analytics Strip */}
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          const target = sheetItem;
                          setActionSheetItem(null);
                          navigateTarget('CategoriesDetails', {
                            categoryId: target.id,
                            categoryName: target.name,
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
                            View Transactions & Breakdown
                          </Text>
                          <Text style={[styles.sheetHistorySub, { color: palette.textSecondary }]}>
                            See monthly charts & category entries
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

      {/* DELETE CONFIRMATION */}
      <CommonBottomSheetModal
        visible={confirmVisible}
        type="danger"
        title="Delete Category?"
        subtitle={
          confirmTargetItem?.name
            ? `Are you sure you want to permanently delete "${confirmTargetItem.name}"?`
            : 'Are you sure you want to permanently delete this category?'
        }
        confirmLabel="Delete Category"
        cancelLabel="Keep Category"
        loading={isDeletingCategory}
        warnings={[
          {
            title: 'Category Removed',
            text: 'Category will be permanently deleted from your active list.',
          },
          {
            title: 'Transactions Preserved',
            text: 'Associated transactions will retain their historical records.',
          },
          {
            title: 'Cannot Be Undone',
            text: 'Once deleted, this category cannot be recovered.',
          },
        ]}
        onCancel={() => {
          if (isDeletingCategory) return;
          setConfirmVisible(false);
          setConfirmTargetItem(null);
        }}
        onConfirm={async () => {
          if (confirmTargetItem?.id && !isDeletingCategory) {
            try {
              setIsDeletingCategory(true);
              await remove(confirmTargetItem.id);
              setConfirmVisible(false);
              setConfirmTargetItem(null);
            } finally {
              setIsDeletingCategory(false);
            }
          }
        }}
      />

      {/* ADD CATEGORY FAB */}
      <ContextualFAB
        icon="plus"
        actions={[
          {
            icon: 'arrow-down',
            label: 'Expense',
            subtitle: 'New spending category',
            color: '#E35D6A',
            style: { backgroundColor: palette.cardBg },
            onPress: () => {
              navigation.navigate('CategoryCreate', {
                currentType: 'expense',
              });
            },
          },
          {
            icon: 'arrow-up',
            label: 'Income',
            subtitle: 'New earnings category',
            color: '#3F8F6B',
            style: { backgroundColor: palette.cardBg },
            onPress: () => {
              navigation.navigate('CategoryCreate', {
                currentType: 'income',
              });
            },
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  budgetsPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
    gap: 5,
    marginLeft: 8,
  },
  budgetsPillText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  heroHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  heroTotalValue: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 34,
  },
  heroHeadlineMetaCol: {
    flex: 1,
    minWidth: 0,
  },
  heroHeadlineUnit: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  heroHeadlineSub: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
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
    fontSize: 11,
    fontWeight: '800',
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroStatValue: {
    fontSize: 13.5,
    fontWeight: '800',
    marginTop: 2,
  },

  /* Search & Controls */
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
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  listTitle: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  listCountBadge: {
    marginLeft: 8,
    minWidth: 24,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCountText: {
    fontSize: 11,
    fontWeight: '800',
  },

  /* Category Cards */
  categoryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
    marginBottom: 11,
  },
  categoryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  categoryInfoCol: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 10,
  },
  categoryName: {
    fontSize: 15.5,
    fontWeight: '800',
    lineHeight: 20,
  },
  categoryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categoryUsageCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: '30%',
  },
  categoryUsageValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  usageCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 2,
  },
  usageCaption: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  categoryFooter: {
    marginTop: 11,
    paddingTop: 9,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  footerMetaText: {
    fontSize: 11.5,
    fontWeight: '600',
    marginLeft: 6,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
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

  /* Hidden Category Action Sheet */
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
    maxWidth: '34%',
  },
  sheetPreviewCount: {
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
