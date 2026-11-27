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
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { getSources, deleteSource } from '../services/sources';
import { getSourceTransactionBalances } from '../services/transactions';
import CommonBottomSheetModal from '../components/CommonBottomSheetModal';
import ResponsiveBottomSheet from '../components/ResponsiveBottomSheet';
import CurrencyText from '../components/CurrencyText';
import ContextualFAB from '../components/ContextualFAB';
import { useTheme } from '../context/ThemeContext';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext';
import { useAppDispatch, useSourcesList } from '../redux/hooks';
import { setSources } from '../redux/slices/sourceSlice';
import { formatAmount, formatCompactAmount } from '../utils/numberUtils';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'positive', label: 'Positive' },
  { key: 'negative', label: 'Negative' },
];

const SORT_MODES = [
  { key: 'default', label: 'Default', icon: 'sort' },
  { key: 'balance_desc', label: 'Highest Balance', icon: 'sort-descending' },
  { key: 'name_asc', label: 'Name A–Z', icon: 'sort-alphabetical-ascending' },
];

export default function SourcesScreen({ navigation }) {
  const { isDarkMode, theme } = useTheme();
  const dispatch = useAppDispatch();
  const reduxItems = useSourcesList();
  const items = useMemo(
    () =>
      (reduxItems || []).filter(
        (s) => String(s?.type || '').toLowerCase() !== 'credit_card'
      ),
    [reduxItems]
  );

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);
  const [actionSheetItem, setActionSheetItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('all'); // 'all' | 'positive' | 'negative'
  const [sortMode, setSortMode] = useState('default'); // 'default' | 'balance_desc' | 'name_asc'
  const [isDeletingSource, setIsDeletingSource] = useState(false);

  const { balanceVisible, toggleBalance } = useBalanceVisibility();

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

  const load = useCallback(async () => {
    try {
      const [sources, balanceMap] = await Promise.all([
        getSources(true),
        getSourceTransactionBalances(),
      ]);

      const updated = (sources || []).map((s) => {
        const id = String(s.id);
        const balance = Number(s.initial_balance || 0) + Number(balanceMap[id] || 0);
        return {
          ...s,
          balance,
        };
      });

      dispatch(setSources(updated));
    } catch (e) {
      console.warn('SourcesScreen load error:', e);
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

  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const bal = Number(item.balance || 0);
        acc.net += bal;
        if (bal >= 0) {
          acc.positiveCount += 1;
          acc.positiveTotal += bal;
        } else {
          acc.negativeCount += 1;
          acc.negativeTotal += Math.abs(bal);
        }
        return acc;
      },
      { net: 0, positiveCount: 0, positiveTotal: 0, negativeCount: 0, negativeTotal: 0 }
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = items.filter((item) => {
      const bal = Number(item.balance || 0);
      if (balanceFilter === 'positive' && bal < 0) return false;
      if (balanceFilter === 'negative' && bal >= 0) return false;
      if (q && !(item.name || '').toLowerCase().includes(q)) return false;
      return true;
    });

    if (sortMode === 'balance_desc') {
      return [...matched].sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));
    }
    if (sortMode === 'name_asc') {
      return [...matched].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }
    return matched;
  }, [items, searchQuery, balanceFilter, sortMode]);

  const activeSort = SORT_MODES.find((m) => m.key === sortMode) || SORT_MODES[0];

  const cycleSortMode = () => {
    const idx = SORT_MODES.findIndex((m) => m.key === sortMode);
    const next = SORT_MODES[(idx + 1) % SORT_MODES.length];
    setSortMode(next.key);
  };

  async function remove(id) {
    await deleteSource(id);
    await load();
  }

  const toggleBalanceFilter = (target) => {
    setBalanceFilter((prev) => (prev === target ? 'all' : target));
  };

  const renderStatTile = ({
    filterKey,
    count,
    label,
    amountValue,
    icon,
    tintColor,
    bgColor,
    borderTint,
  }) => {
    const isActive = balanceFilter === filterKey;
    return (
      <TouchableOpacity
        key={filterKey}
        activeOpacity={0.8}
        onPress={() => toggleBalanceFilter(filterKey)}
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
          <View style={[styles.heroStatCountPill, { backgroundColor: isActive ? tintColor : palette.badgeBg }]}>
            <Text style={[styles.heroStatCountText, { color: isActive ? '#FFFFFF' : palette.badgeText }]}>
              {count}
            </Text>
          </View>
        </View>

        <Text style={[styles.heroStatLabel, { color: palette.textSecondary }]}>
          {label}
        </Text>
        <Text numberOfLines={1} style={[styles.heroStatAmount, { color: tintColor }]}>
          {balanceVisible ? formatCompactAmount(amountValue) : '••••'}
        </Text>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      {/* Adaptive Light / Dark Net Balance Hero Card */}
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
              <MaterialCommunityIcons name="bank-outline" size={18} color={palette.primary} />
            </View>
            <View style={styles.heroTitleTextCol}>
              <Text style={[styles.heroEyebrow, { color: palette.textSecondary }]}>
                NET ACCOUNTS BALANCE
              </Text>
              <Text style={[styles.heroSubMeta, { color: palette.textMuted }]}>
                {items.length} {items.length === 1 ? 'account' : 'accounts'} tracked
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={toggleBalance}
            activeOpacity={0.75}
            accessibilityLabel={balanceVisible ? 'Hide balances' : 'Show balances'}
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
          amount={summary.net}
          numberOfLines={1}
          style={[
            styles.heroNetAmount,
            { color: summary.net < 0 ? palette.negative : palette.textPrimary },
          ]}
        />

        {/* Interactive Positive & Negative Breakdown Tiles */}
        <View style={styles.heroStatsRow}>
          {renderStatTile({
            filterKey: 'positive',
            count: summary.positiveCount,
            label: 'Positive',
            amountValue: summary.positiveTotal,
            icon: 'trending-up',
            tintColor: palette.positive,
            bgColor: palette.positiveBg,
            borderTint: palette.positiveBorder,
          })}
          {renderStatTile({
            filterKey: 'negative',
            count: summary.negativeCount,
            label: 'Negative / Due',
            amountValue: summary.negativeTotal,
            icon: 'trending-down',
            tintColor: palette.negative,
            bgColor: palette.negativeBg,
            borderTint: palette.negativeBorder,
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
          placeholder="Search accounts by name..."
          placeholderTextColor={palette.textMuted}
          style={[styles.searchInput, { color: palette.textPrimary }]}
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                : opt.key === 'positive'
                  ? summary.positiveCount
                  : summary.negativeCount;
            const active = balanceFilter === opt.key;
            const activeBg =
              opt.key === 'positive'
                ? palette.positive
                : opt.key === 'negative'
                  ? palette.negative
                  : palette.primary;

            return (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.8}
                onPress={() => setBalanceFilter(opt.key)}
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
            {balanceFilter === 'positive'
              ? 'Positive Accounts'
              : balanceFilter === 'negative'
                ? 'Negative / Due Accounts'
                : 'All Accounts'}
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

  const renderAccountCard = ({ item }) => {
    const itemBalance = Number(item.balance || 0);
    const isNegative = itemBalance < 0;
    const itemColor = item.color || palette.primary;
    const statusColor = isNegative ? palette.negative : palette.positive;
    const statusSoftBg = isNegative ? palette.negativeBg : palette.positiveBg;
    const avatarTint = isDarkMode ? `${itemColor}2E` : `${itemColor}18`;

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => {
          const parent = navigation.getParent();
          parent?.navigate('SourcesDetails', {
            sourceId: item.id,
            sourceName: item.name,
          });
        }}
        onLongPress={() => setActionSheetItem(item)}
        delayLongPress={260}
        style={[
          styles.accountCard,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
            borderLeftColor: itemColor,
          },
          !isDarkMode && styles.cardShadowLight,
        ]}
      >
        <View style={styles.accountTopRow}>
          <View style={[styles.accountIconBox, { backgroundColor: avatarTint }]}>
            <MaterialCommunityIcons
              name={item.icon || 'cash'}
              size={22}
              color={itemColor}
            />
          </View>

          <View style={styles.accountInfoCol}>
            <Text
              numberOfLines={2}
              style={[styles.accountName, { color: palette.textPrimary }]}
            >
              {item.name}
            </Text>

            <View style={styles.accountStatusRow}>
              <View style={[styles.statusBadge, { backgroundColor: statusSoftBg }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text numberOfLines={1} style={[styles.statusBadgeText, { color: statusColor }]}>
                  {isNegative ? 'Overdrawn' : 'Available'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.accountBalanceCol}>
            <Text
              numberOfLines={1}
              style={[styles.accountBalanceValue, { color: statusColor }]}
            >
              {balanceVisible ? `₹${formatAmount(itemBalance)}` : '••••••'}
            </Text>
            <View style={styles.balanceDirectionRow}>
              <Text style={[styles.balanceCaption, { color: palette.textMuted }]}>
                BALANCE
              </Text>
              <MaterialCommunityIcons
                name={isNegative ? 'arrow-down' : 'arrow-up'}
                size={11}
                color={statusColor}
              />
            </View>
          </View>
        </View>

        <View style={[styles.accountFooter, { borderTopColor: palette.divider }]}>
          <View style={styles.initialBalanceRow}>
            <MaterialCommunityIcons
              name="bank-outline"
              size={14}
              color={palette.textMuted}
            />
            <Text numberOfLines={1} style={[styles.initialBalanceText, { color: palette.textSecondary }]}>
              Initial:{' '}
              {balanceVisible
                ? `₹${formatAmount(item.initial_balance || 0)}`
                : '••••'}
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
                name="wallet-outline"
                size={34}
                color={palette.textMuted}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
              No accounts found
            </Text>
            <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
              {searchQuery
                ? `No account matches "${searchQuery}"`
                : balanceFilter !== 'all'
                  ? `No ${balanceFilter} accounts right now`
                  : 'Tap + to add your first bank, cash, or wallet source'}
            </Text>
            {(searchQuery.length > 0 || balanceFilter !== 'all') && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSearchQuery('');
                  setBalanceFilter('all');
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
                  Show all accounts
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        initialNumToRender={12}
        windowSize={10}
        renderItem={renderAccountCard}
      />

      {/* ACCOUNT ACTION SHEET (Hidden Edit / Delete / History Hub) */}
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
          actionSheetItem ? (() => {
            const sheetItem = actionSheetItem;
            const sheetColor = sheetItem.color || palette.primary;
            const sheetBal = Number(sheetItem.balance || 0);
            const sheetNeg = sheetBal < 0;
            const sheetStatusColor = sheetNeg ? palette.negative : palette.positive;
            const sheetAvatarBg = isDarkMode ? `${sheetColor}2E` : `${sheetColor}18`;

            return (
              <View style={{ maxHeight }}>
                <View style={[styles.sheetHandle, { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' }]} />

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  style={{ flexGrow: 0, flexShrink: 1, maxHeight: Math.max(200, maxHeight - 36) }}
                >
                  <View style={styles.sheetHeaderRow}>
                    <View style={styles.sheetHeaderTextWrap}>
                      <Text style={[styles.sheetTitle, { color: palette.textPrimary }]}>
                        Account Actions
                      </Text>
                      <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
                        Manage account details or remove source
                      </Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => setActionSheetItem(null)}
                      accessibilityLabel="Close actions"
                      style={[styles.sheetCloseBtn, { backgroundColor: palette.surfaceSubtle }]}
                    >
                      <MaterialCommunityIcons name="close" size={18} color={palette.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {/* Selected Account Preview Card */}
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
                    <View style={[styles.sheetPreviewAvatar, { backgroundColor: sheetAvatarBg }]}>
                      <MaterialCommunityIcons
                        name={sheetItem.icon || 'cash'}
                        size={22}
                        color={sheetColor}
                      />
                    </View>

                    <View style={styles.sheetPreviewInfo}>
                      <Text numberOfLines={2} style={[styles.sheetPreviewName, { color: palette.textPrimary }]}>
                        {sheetItem.name}
                      </Text>
                      <Text numberOfLines={1} style={[styles.sheetPreviewMeta, { color: palette.textSecondary }]}>
                        Initial: {balanceVisible ? `₹${formatAmount(sheetItem.initial_balance || 0)}` : '••••'}
                      </Text>
                    </View>

                    <View style={styles.sheetPreviewRight}>
                      <Text numberOfLines={1} style={[styles.sheetPreviewBalance, { color: sheetStatusColor }]}>
                        {balanceVisible ? `₹${formatAmount(sheetBal)}` : '••••••'}
                      </Text>
                      <Text style={[styles.sheetPreviewTag, { color: sheetStatusColor }]}>
                        {sheetNeg ? 'OVERDRAWN' : 'AVAILABLE'}
                      </Text>
                    </View>
                  </View>

                  {/* Two-Column Unique Edit & Delete Tiles */}
                  <View style={styles.actionTilesRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        const target = sheetItem;
                        setActionSheetItem(null);
                        navigation.navigate('SourceCreate', { editData: target });
                      }}
                      style={[
                        styles.actionTile,
                        {
                          backgroundColor: palette.editBg,
                          borderColor: palette.editBorder,
                        },
                      ]}
                    >
                      <View style={[styles.actionTileIconCircle, { backgroundColor: palette.cardBg }]}>
                        <Feather name="edit-2" size={18} color={palette.editIcon} />
                      </View>
                      <Text style={[styles.actionTileTitle, { color: palette.textPrimary }]}>
                        Edit Account
                      </Text>
                      <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                        Name, icon & balance
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        const targetId = sheetItem.id;
                        setActionSheetItem(null);
                        setConfirmTargetId(targetId);
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
                      <View style={[styles.actionTileIconCircle, { backgroundColor: palette.cardBg }]}>
                        <Feather name="trash-2" size={18} color={palette.deleteIcon} />
                      </View>
                      <Text style={[styles.actionTileTitle, { color: palette.deleteIcon }]}>
                        Delete Account
                      </Text>
                      <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                        Remove this source
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* View Account Details Strip */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      const target = sheetItem;
                      setActionSheetItem(null);
                      const parent = navigation.getParent();
                      parent?.navigate('SourcesDetails', {
                        sourceId: target.id,
                        sourceName: target.name,
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
                    <View style={[styles.sheetHistoryIcon, { backgroundColor: palette.primarySoft }]}>
                      <MaterialCommunityIcons
                        name="chart-timeline-variant"
                        size={18}
                        color={palette.primary}
                      />
                    </View>
                    <View style={styles.sheetHistoryTextWrap}>
                      <Text style={[styles.sheetHistoryTitle, { color: palette.textPrimary }]}>
                        View Transactions & History
                      </Text>
                      <Text style={[styles.sheetHistorySub, { color: palette.textSecondary }]}>
                        See monthly activity & ledger
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={palette.textMuted} />
                  </TouchableOpacity>
                </ScrollView>
              </View>
            );
          })() : null
        }
      </ResponsiveBottomSheet>

      {/* DELETE CONFIRMATION */}
      <CommonBottomSheetModal
        visible={confirmVisible}
        type="danger"
        title="Delete Account?"
        subtitle="Are you sure you want to delete this payment account?"
        confirmLabel="Delete Account"
        cancelLabel="Keep Account"
        loading={isDeletingSource}
        warnings={[
          { title: 'Account Removed', text: 'This payment account will be permanently deleted.' },
          { title: 'Transactions Safe', text: 'Past transactions linked to this account remain in your history.' },
          { title: 'Cannot Be Undone', text: 'This account cannot be restored once deleted.' },
        ]}
        onCancel={() => {
          if (!isDeletingSource) {
            setConfirmVisible(false);
            setConfirmTargetId(null);
          }
        }}
        onConfirm={async () => {
          if (confirmTargetId && !isDeletingSource) {
            try {
              setIsDeletingSource(true);
              await remove(confirmTargetId);
              setConfirmVisible(false);
              setConfirmTargetId(null);
            } finally {
              setIsDeletingSource(false);
            }
          }
        }}
      />

      {/* ADD ACCOUNT FAB */}
      <ContextualFAB
        onPress={() => {
          navigation.navigate('SourceCreate');
        }}
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
  eyeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  heroNetAmount: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 14,
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
  heroStatAmount: {
    fontSize: 15,
    fontWeight: '900',
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

  /* Account Cards */
  accountCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
    marginBottom: 11,
  },
  accountTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  accountInfoCol: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 10,
  },
  accountName: {
    fontSize: 15.5,
    fontWeight: '800',
    lineHeight: 20,
  },
  accountStatusRow: {
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
  accountBalanceCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: '46%',
  },
  accountBalanceValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  balanceDirectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 3,
  },
  balanceCaption: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  accountFooter: {
    marginTop: 11,
    paddingTop: 9,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  initialBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  initialBalanceText: {
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

  /* Hidden Account Action Sheet */
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
    maxWidth: '42%',
  },
  sheetPreviewBalance: {
    fontSize: 15,
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
