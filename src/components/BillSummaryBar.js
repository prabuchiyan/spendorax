import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import CurrencyText from './CurrencyText';
import { useTheme } from '../context/ThemeContext';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext';

function BillSummaryBar({
  summary,
  monthLabel,
  activeStatusFilter = 'all',
  onFilterPress,
  isDarkMode: propIsDark,
}) {
  const { isDarkMode: globalIsDark, theme } = useTheme();
  const { balanceVisible, toggleBalance } = useBalanceVisibility();
  const isDarkMode = propIsDark !== undefined ? propIsDark : globalIsDark;

  if (!summary) return null;

  const palette = isDarkMode
    ? {
        cardBg: theme?.cardBg || '#182234',
        cardBorder: theme?.cardBorder || '#334155',
        surfaceSubtle: '#1E293B',
        textPrimary: theme?.textPrimary || '#F3F4F6',
        textSecondary: theme?.textSecondary || '#9CA3AF',
        textMuted: '#64748B',
        primary: theme?.primary || '#4B7CF3',
        primarySoft: 'rgba(75, 124, 243, 0.16)',
        positive: '#34D399',
        positiveBg: 'rgba(16, 185, 129, 0.14)',
        positiveBorder: 'rgba(52, 211, 153, 0.28)',
        negative: '#F87171',
        negativeBg: 'rgba(239, 68, 68, 0.14)',
        negativeBorder: 'rgba(248, 113, 113, 0.30)',
        warning: '#FBBF24',
        warningBg: 'rgba(245, 158, 11, 0.15)',
        warningBorder: 'rgba(251, 191, 36, 0.28)',
        badgeBg: '#1E293B',
        badgeText: '#CBD5E1',
      }
    : {
        cardBg: theme?.cardBg || '#FFFFFF',
        cardBorder: theme?.cardBorder || '#E2E8F0',
        surfaceSubtle: '#F1F5F9',
        textPrimary: theme?.textPrimary || '#0B1C30',
        textSecondary: theme?.textSecondary || '#64748B',
        textMuted: '#94A3B8',
        primary: theme?.primary || '#4B7CF3',
        primarySoft: '#EFF4FF',
        positive: '#059669',
        positiveBg: '#ECFDF5',
        positiveBorder: '#A7F3D0',
        negative: '#DC2626',
        negativeBg: '#FEF2F2',
        negativeBorder: '#FECACA',
        warning: '#D97706',
        warningBg: '#FFFBEB',
        warningBorder: '#FDE68A',
        badgeBg: '#E2E8F0',
        badgeText: '#475569',
      };

  const total = Number(summary.totalThisMonth || 0);
  const paid = Number(summary.totalPaid || 0);
  const overdue = Number(summary.overdueAmount || 0);
  const overdueCount = Number(summary.overdueCount || 0);
  const paidCount = Number(summary.paidCount || 0);
  const upcoming7 = Number(summary.upcoming7 || 0);
  const dueThisMonthCount = Number(summary.dueThisMonthCount || 0);

  const paidPct = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0;

  let statusPill = {
    label: '100% Settled',
    color: palette.positive,
    bg: palette.positiveBg,
  };
  if (overdueCount > 0 || overdue > 0) {
    statusPill = {
      label: `${overdueCount || 1} Overdue`,
      color: palette.negative,
      bg: palette.negativeBg,
    };
  } else if (dueThisMonthCount > 0) {
    statusPill = {
      label: `${Math.round(paidPct)}% Settled`,
      color: paidPct >= 70 ? palette.positive : palette.warning,
      bg: paidPct >= 70 ? palette.positiveBg : palette.warningBg,
    };
  } else if (upcoming7 > 0) {
    statusPill = {
      label: 'Month Clear',
      color: palette.positive,
      bg: palette.positiveBg,
    };
  }

  const paidDecimals = paid % 1 !== 0 ? 2 : 0;
  const overdueDecimals = overdue % 1 !== 0 ? 2 : 0;
  const upcomingDecimals = upcoming7 % 1 !== 0 ? 2 : 0;

  const isPaidFilterActive = activeStatusFilter === 'paid';
  const secondTileIsOverdue = overdueCount > 0 || overdue > 0;
  const secondTileFilterKey = secondTileIsOverdue ? 'overdue' : 'pending';
  const isSecondTileActive = activeStatusFilter === secondTileFilterKey;

  const handleTileTap = (key) => {
    if (typeof onFilterPress === 'function') {
      onFilterPress(activeStatusFilter === key ? 'all' : key);
    }
  };

  return (
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
      {/* Top Header Row */}
      <View style={styles.heroTopRow}>
        <View style={styles.heroTitleGroup}>
          <View style={[styles.heroBadgeIcon, { backgroundColor: palette.primarySoft }]}>
            <MaterialCommunityIcons
              name="receipt"
              size={18}
              color={palette.primary}
            />
          </View>
          <View style={styles.heroTitleTextCol}>
            <Text style={[styles.heroEyebrow, { color: palette.textSecondary }]}>
              THIS MONTH BILLS
            </Text>
            <Text numberOfLines={1} style={[styles.heroSubMeta, { color: palette.textMuted }]}>
              {monthLabel ? `${monthLabel} · ` : ''}
              {paidCount} {paidCount === 1 ? 'bill' : 'bills'} paid
            </Text>
          </View>
        </View>

        <View style={styles.heroRightControls}>
          <View style={[styles.statusBadge, { backgroundColor: statusPill.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusPill.color }]} />
            <Text style={[styles.statusBadgeText, { color: statusPill.color }]}>
              {statusPill.label}
            </Text>
          </View>

          <TouchableOpacity
            onPress={toggleBalance}
            activeOpacity={0.75}
            accessibilityLabel={balanceVisible ? 'Hide bill totals' : 'Show bill totals'}
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

      {/* Hero Total */}
      <CurrencyText
        amount={total}
        numberOfLines={1}
        style={[styles.heroTotalAmount, { color: palette.textPrimary }]}
      />

      {/* Settlement Progress Track */}
      <View style={styles.progressBlock}>
        <View style={styles.progressLabelsRow}>
          <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
            Monthly Settlement
          </Text>
          <Text
            style={[
              styles.progressPctText,
              { color: overdueCount > 0 ? palette.negative : palette.positive },
            ]}
          >
            {Math.round(paidPct)}% paid
            {overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
          </Text>
        </View>
        <View
          style={[
            styles.progressTrack,
            {
              backgroundColor:
                overdue > 0 ? palette.negativeBg : palette.surfaceSubtle,
            },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${paidPct}%`,
                backgroundColor: palette.positive,
              },
            ]}
          />
        </View>
      </View>

      {/* Two Spacious Interactive Breakdown Tiles (Prevents ₹10,000.... truncation) */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleTileTap('paid')}
          style={[
            styles.statTile,
            {
              backgroundColor: isPaidFilterActive ? palette.positiveBg : palette.surfaceSubtle,
              borderColor: isPaidFilterActive ? palette.positive : palette.cardBorder,
              borderWidth: isPaidFilterActive ? 1.5 : 1,
            },
          ]}
        >
          <View style={styles.statTileTop}>
            <View style={[styles.statIconBox, { backgroundColor: palette.positiveBg }]}>
              <MaterialCommunityIcons name="check-circle" size={16} color={palette.positive} />
            </View>
            <View
              style={[
                styles.statCountPill,
                { backgroundColor: isPaidFilterActive ? palette.positive : palette.badgeBg },
              ]}
            >
              <Text
                style={[
                  styles.statCountText,
                  { color: isPaidFilterActive ? '#FFFFFF' : palette.badgeText },
                ]}
              >
                {paidCount}
              </Text>
            </View>
          </View>
          <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Paid</Text>
          <CurrencyText
            amount={paid}
            minimumFractionDigits={paidDecimals}
            maximumFractionDigits={paidDecimals}
            numberOfLines={1}
            style={[styles.statValue, { color: palette.positive }]}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleTileTap(secondTileFilterKey)}
          style={[
            styles.statTile,
            {
              backgroundColor: isSecondTileActive
                ? secondTileIsOverdue
                  ? palette.negativeBg
                  : palette.warningBg
                : secondTileIsOverdue
                  ? palette.negativeBg
                  : palette.surfaceSubtle,
              borderColor: isSecondTileActive
                ? secondTileIsOverdue
                  ? palette.negative
                  : palette.warning
                : secondTileIsOverdue
                  ? palette.negativeBorder
                  : palette.cardBorder,
              borderWidth: isSecondTileActive ? 1.5 : 1,
            },
          ]}
        >
          <View style={styles.statTileTop}>
            <View
              style={[
                styles.statIconBox,
                {
                  backgroundColor: secondTileIsOverdue
                    ? isDarkMode
                      ? 'rgba(239, 68, 68, 0.24)'
                      : '#FEE2E2'
                    : palette.warningBg,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={secondTileIsOverdue ? 'alert-circle' : 'clock-outline'}
                size={16}
                color={secondTileIsOverdue ? palette.negative : palette.warning}
              />
            </View>
            {secondTileIsOverdue ? (
              <View
                style={[
                  styles.statCountPill,
                  { backgroundColor: isSecondTileActive ? palette.negative : palette.badgeBg },
                ]}
              >
                <Text
                  style={[
                    styles.statCountText,
                    { color: isSecondTileActive ? '#FFFFFF' : palette.negative },
                  ]}
                >
                  {overdueCount}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={[
              styles.statLabel,
              {
                color: secondTileIsOverdue ? palette.negative : palette.textSecondary,
                fontWeight: secondTileIsOverdue ? '700' : '700',
              },
            ]}
          >
            {secondTileIsOverdue ? 'Overdue' : 'Next 7 Days'}
          </Text>
          <CurrencyText
            amount={secondTileIsOverdue ? overdue : upcoming7}
            minimumFractionDigits={secondTileIsOverdue ? overdueDecimals : upcomingDecimals}
            maximumFractionDigits={secondTileIsOverdue ? overdueDecimals : upcomingDecimals}
            numberOfLines={1}
            style={[
              styles.statValue,
              { color: secondTileIsOverdue ? palette.negative : palette.textPrimary },
            ]}
          />
        </TouchableOpacity>
      </View>

      {/* Dedicated Full-Width Next 7 Days Bar when Overdue also exists */}
      {secondTileIsOverdue && upcoming7 > 0 && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleTileTap('pending')}
          style={[
            styles.upcomingStrip,
            {
              backgroundColor:
                activeStatusFilter === 'pending' ? palette.warningBg : palette.surfaceSubtle,
              borderColor:
                activeStatusFilter === 'pending' ? palette.warning : palette.cardBorder,
            },
          ]}
        >
          <View style={styles.upcomingLeft}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={15}
              color={palette.warning}
            />
            <Text style={[styles.upcomingLabel, { color: palette.textSecondary }]}>
              Upcoming in next 7 days
            </Text>
          </View>
          <View style={styles.upcomingRight}>
            <CurrencyText
              amount={upcoming7}
              minimumFractionDigits={upcomingDecimals}
              maximumFractionDigits={upcomingDecimals}
              style={[styles.upcomingAmount, { color: palette.textPrimary }]}
            />
            <Feather name="chevron-right" size={14} color={palette.textMuted} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusBadgeText: {
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
  progressBlock: {
    marginBottom: 14,
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  progressPctText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statTile: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statIconBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCountPill: {
    minWidth: 24,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  upcomingStrip: {
    marginTop: 10,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upcomingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    minWidth: 0,
  },
  upcomingLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  upcomingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  upcomingAmount: {
    fontSize: 13.5,
    fontWeight: '900',
  },
});

export default memo(BillSummaryBar);
