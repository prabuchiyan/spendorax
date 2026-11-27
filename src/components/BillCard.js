import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  formatDueDate,
  formatCurrency,
} from '../services/billUtils';
import CurrencyText from './CurrencyText';
import { useTheme } from '../context/ThemeContext';

function BillCard({
  bill,
  category,
  onPress,
  onMarkPaid,
  onOpenActions,
  onToggleExpand,
  isDarkMode: propIsDark,
}) {
  const { isDarkMode: globalIsDark, theme } = useTheme();
  const isDarkMode = propIsDark !== undefined ? propIsDark : globalIsDark;

  const palette = isDarkMode
    ? {
        cardBg: theme?.cardBg || '#182234',
        cardBorder: theme?.cardBorder || '#334155',
        surfaceSubtle: '#1E293B',
        divider: '#253248',
        textPrimary: theme?.textPrimary || '#F3F4F6',
        textSecondary: theme?.textSecondary || '#9CA3AF',
        textMuted: '#64748B',
        primary: theme?.primary || '#4B7CF3',

        overdueAccent: '#F87171',
        overdueBg: 'rgba(239, 68, 68, 0.14)',
        overdueText: '#FCA5A5',
        overdueBtnBg: '#E11D48',

        paidAccent: '#34D399',
        paidBg: 'rgba(16, 185, 129, 0.14)',
        paidText: '#34D399',

        partialAccent: '#60A5FA',
        partialBg: 'rgba(59, 130, 246, 0.16)',
        partialText: '#93C5FD',

        pendingAccent: '#FBBF24',
        pendingBg: 'rgba(245, 158, 11, 0.14)',
        pendingText: '#FCD34D',
        pendingBtnBg: '#059669',

        skippedAccent: '#64748B',
        skippedBg: '#1E293B',
        skippedText: '#94A3B8',
      }
    : {
        cardBg: theme?.cardBg || '#FFFFFF',
        cardBorder: theme?.cardBorder || '#E2E8F0',
        surfaceSubtle: '#F1F5F9',
        divider: '#F1F5F9',
        textPrimary: theme?.textPrimary || '#0B1C30',
        textSecondary: theme?.textSecondary || '#64748B',
        textMuted: '#94A3B8',
        primary: theme?.primary || '#4B7CF3',

        overdueAccent: '#DC2626',
        overdueBg: '#FEF2F2',
        overdueText: '#DC2626',
        overdueBtnBg: '#DC2626',

        paidAccent: '#059669',
        paidBg: '#ECFDF5',
        paidText: '#059669',

        partialAccent: '#2563EB',
        partialBg: '#EFF6FF',
        partialText: '#2563EB',

        pendingAccent: '#D97706',
        pendingBg: '#FFFBEB',
        pendingText: '#B45309',
        pendingBtnBg: '#059669',

        skippedAccent: '#94A3B8',
        skippedBg: '#F1F5F9',
        skippedText: '#64748B',
      };

  const roundedPaid = Math.round(Number(bill.paid_amount || bill.total_paid || 0) * 100);
  const roundedAmount = Math.round(Number(bill.amount || 0) * 100);
  const remainingAmount = Math.max(0, Math.round(roundedAmount - roundedPaid) / 100);

  const status = bill.status || 'pending';
  const isPaid =
    status === 'paid' ||
    Number(bill.is_paid) === 1 ||
    Boolean(bill.is_completely_paid) ||
    (roundedAmount > 0 && roundedPaid >= roundedAmount);
  const isPartiallyPaid =
    !isPaid &&
    (status === 'partially_paid' ||
      Boolean(bill.is_partially_paid) ||
      (roundedPaid > 0 && roundedPaid < roundedAmount));
  const isSkipped = status === 'skipped';

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const isDueDatePast = Boolean(bill.due_date && String(bill.due_date).slice(0, 10) < today);
  const isOverdue = !isPaid && !isPartiallyPaid && !isSkipped && (status === 'overdue' || isDueDatePast);

  let statusConfig = {
    leftBorder: palette.pendingAccent,
    badgeBg: palette.pendingBg,
    badgeText: palette.pendingText,
    label: 'Pending',
    icon: 'clock-outline',
  };

  if (isOverdue) {
    statusConfig = {
      leftBorder: palette.overdueAccent,
      badgeBg: palette.overdueBg,
      badgeText: palette.overdueText,
      label: 'Overdue',
      icon: 'alert-circle-outline',
    };
  } else if (isPaid) {
    statusConfig = {
      leftBorder: palette.paidAccent,
      badgeBg: palette.paidBg,
      badgeText: palette.paidText,
      label: 'Paid',
      icon: 'check-circle',
    };
  } else if (isPartiallyPaid) {
    statusConfig = {
      leftBorder: palette.partialAccent,
      badgeBg: palette.partialBg,
      badgeText: palette.partialText,
      label: 'Partial',
      icon: 'progress-clock',
    };
  } else if (isSkipped) {
    statusConfig = {
      leftBorder: palette.skippedAccent,
      badgeBg: palette.skippedBg,
      badgeText: palette.skippedText,
      label: 'Skipped',
      icon: 'skip-next-circle-outline',
    };
  }

  const iconColor = category?.color || (bill._isCreditCardParent ? palette.paidAccent : palette.primary);
  const avatarBg = isDarkMode ? `${iconColor}2E` : `${iconColor}18`;

  const displayAmount =
    isPartiallyPaid && bill.remaining_amount != null
      ? bill.remaining_amount
      : isPartiallyPaid
        ? remainingAmount
        : bill.amount;

  const amountVal = Number(displayAmount || 0);
  const amountDecimals = amountVal % 1 !== 0 ? 2 : 0;

  const dueDateText =
    bill._noDueDate || !bill.due_date
      ? 'No due date'
      : `Due ${formatDueDate(bill.due_date)}`;

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={() => typeof onPress === 'function' && onPress(bill)}
      onLongPress={() => typeof onOpenActions === 'function' && onOpenActions(bill)}
      delayLongPress={260}
      style={[
        styles.billCard,
        {
          backgroundColor: palette.cardBg,
          borderColor: palette.cardBorder,
          borderLeftColor: statusConfig.leftBorder,
        },
        !isDarkMode && styles.cardShadowLight,
      ]}
    >
      {/* Top Row: Icon + 2-line Name & Badges + Right Amount (No inline menu icon crowding) */}
      <View style={styles.cardTopRow}>
        <View style={[styles.iconBox, { backgroundColor: avatarBg }]}>
          <MaterialCommunityIcons
            name={category?.icon || (bill._isCreditCardParent ? 'credit-card' : 'receipt')}
            size={22}
            color={iconColor}
          />
        </View>

        <View style={styles.infoCol}>
          <Text
            numberOfLines={2}
            style={[
              styles.billName,
              { color: isPaid ? palette.textSecondary : palette.textPrimary },
            ]}
          >
            {bill.name}
          </Text>

          <View style={styles.badgesRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.badgeBg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusConfig.badgeText }]} />
              <Text style={[styles.statusBadgeText, { color: statusConfig.badgeText }]}>
                {statusConfig.label}
              </Text>
            </View>

            {category?.name ? (
              <View style={[styles.catBadge, { backgroundColor: palette.surfaceSubtle }]}>
                <Text numberOfLines={1} style={[styles.catBadgeText, { color: palette.textSecondary }]}>
                  {category.name}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.amountCol}>
          <CurrencyText
            amount={displayAmount}
            minimumFractionDigits={amountDecimals}
            maximumFractionDigits={amountDecimals}
            numberOfLines={1}
            style={[
              styles.amountText,
              {
                color: isOverdue
                  ? palette.overdueText
                  : isPaid
                    ? palette.paidText
                    : palette.textPrimary,
              },
            ]}
          />
          {isPartiallyPaid ? (
            <Text style={[styles.partialSub, { color: palette.textMuted }]}>
              of {formatCurrency(bill.amount)}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Footer: Full Readable Due Date + Primary CTA / Hidden Actions Pill */}
      <View style={[styles.cardFooter, { borderTopColor: palette.divider }]}>
        <View style={styles.dueDateRow}>
          <MaterialCommunityIcons
            name={statusConfig.icon}
            size={14}
            color={isOverdue ? palette.overdueText : palette.textMuted}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.dueDateText,
              {
                color: isOverdue ? palette.overdueText : palette.textSecondary,
                fontWeight: isOverdue ? '700' : '600',
              },
            ]}
          >
            {dueDateText}
          </Text>
        </View>

        <View style={styles.footerActionsRow}>
          {bill._isCreditCardParent && typeof onToggleExpand === 'function' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={(e) => {
                e?.stopPropagation?.();
                onToggleExpand();
              }}
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: palette.surfaceSubtle,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: palette.textPrimary }]}>
                Statements
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={15}
                color={palette.textSecondary}
              />
            </TouchableOpacity>
          ) : isOverdue && typeof onMarkPaid === 'function' ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={(e) => {
                e?.stopPropagation?.();
                onMarkPaid(bill);
              }}
              style={[styles.payNowBtn, { backgroundColor: palette.overdueBtnBg }]}
            >
              <Text style={styles.payNowBtnText}>Pay Now</Text>
              <MaterialCommunityIcons name="arrow-right" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          ) : !isPaid && !isSkipped && typeof onMarkPaid === 'function' ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={(e) => {
                e?.stopPropagation?.();
                onMarkPaid(bill);
              }}
              style={[styles.payNowBtn, { backgroundColor: palette.pendingBtnBg }]}
            >
              <Text style={styles.payNowBtnText}>Pay</Text>
              <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}

          {typeof onOpenActions === 'function' && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={(e) => {
                e?.stopPropagation?.();
                onOpenActions(bill);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`More actions for ${bill.name}`}
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
          )}
        </View>
      </View>
    </TouchableOpacity>
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
  billCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
    marginBottom: 11,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 10,
  },
  billName: {
    fontSize: 15.5,
    fontWeight: '800',
    lineHeight: 20,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
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
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 140,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  amountCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: '34%',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '900',
  },
  partialSub: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 2,
  },
  cardFooter: {
    marginTop: 11,
    paddingTop: 9,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  dueDateText: {
    fontSize: 12,
  },
  footerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 10,
    gap: 4,
  },
  payNowBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  secondaryBtnText: {
    fontSize: 11.5,
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
});

export default memo(BillCard);
