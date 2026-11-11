import React, { memo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Menu, Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  formatDueDate,
} from '../services/billUtils';
import CurrencyText from './CurrencyText';
import { useTheme } from '../context/ThemeContext';

function BillCard({
  bill,
  category,
  onPress,
  onMarkPaid,
  onSkip,
  onEdit,
  onDelete,
  isDarkMode: propIsDark,

  // CREDIT CARD EXPAND / COLLAPSE
  showExpandButton = false,
  expanded = false,
  onToggleExpand,
}) {
  const [menuVisible, setMenuVisible] = useState(false);

  const { isDarkMode: globalIsDark } = useTheme();
  const isDarkMode = propIsDark !== undefined ? propIsDark : globalIsDark;
  const theme = isDarkMode
    ? {
      cardBg: "#182234",
      cardBorder: "#334155",
      textPrimary: "#F3F4F6",
      textSecondary: "#9CA3AF",
      textMuted: "#64748b",
      iconContainerBg: "#1e293b",
      iconContainerBorder: "#334155",
      iconColor: "#cbd5e1",
      menuBg: "#1e293b",

      // Overdue
      overdueLeftBorder: "#f43f5e",
      overdueBadgeBg: "rgba(159, 18, 57, 0.4)",
      overdueBadgeBorder: "rgba(244, 63, 94, 0.3)",
      overdueBadgeText: "#fda4af",
      overdueActionBg: "#e11d48",
      overdueActionText: "#ffffff",

      // Paid
      paidLeftBorder: "#2dd4bf",
      paidBadgeBg: "rgba(13, 148, 136, 0.15)",
      paidBadgeBorder: "rgba(45, 212, 191, 0.3)",
      paidBadgeText: "#5eead4",

      // Pending
      pendingLeftBorder: "#fbbf24",
      pendingBadgeBg: "rgba(69, 26, 3, 0.4)",
      pendingBadgeBorder: "rgba(245, 158, 11, 0.3)",
      pendingBadgeText: "#fcd34d",
      pendingActionBg: "#006a61",
      pendingActionText: "#ffffff",

      // Skipped / Inactive
      skippedLeftBorder: "#64748b",
      skippedBadgeBg: "#1e293b",
      skippedBadgeBorder: "#334155",
      skippedBadgeText: "#cbd5e1",
    }
    : {
      cardBg: "#ffffff",
      cardBorder: "#e2ebf8",
      textPrimary: "#0b1c30",
      textSecondary: "#45464d",
      textMuted: "#94a3b8",
      iconContainerBg: "#f8faff",
      iconContainerBorder: "#edf3fc",
      iconColor: "#45464d",
      menuBg: "#ffffff",

      // Overdue
      overdueLeftBorder: "#ba1a1a",
      overdueBadgeBg: "#fee2e2",
      overdueBadgeBorder: "#fecdd3",
      overdueBadgeText: "#ba1a1a",
      overdueActionBg: "#ba1a1a",
      overdueActionText: "#ffffff",

      // Paid
      paidLeftBorder: "#006a61",
      paidBadgeBg: "#e6f7f3",
      paidBadgeBorder: "#a7f3d0",
      paidBadgeText: "#006a61",

      // Pending
      pendingLeftBorder: "#c76c00",
      pendingBadgeBg: "#ffedd5",
      pendingBadgeBorder: "#fed7aa",
      pendingBadgeText: "#c76c00",
      pendingActionBg: "#006a61",
      pendingActionText: "#ffffff",

      // Skipped / Inactive
      skippedLeftBorder: "#94a3b8",
      skippedBadgeBg: "#f1f5f9",
      skippedBadgeBorder: "#e2e8f0",
      skippedBadgeText: "#64748b",
    };

  const status = bill.status || 'pending';
  const isPaid = status === 'paid';
  const isOverdue = status === 'overdue';
  const isSkipped = status === 'skipped';

  let statusConfig = {
    leftBorder: theme.pendingLeftBorder,
    badgeBg: theme.pendingBadgeBg,
    badgeBorder: theme.pendingBadgeBorder,
    badgeText: theme.pendingBadgeText,
    label: "• PENDING",
    icon: "clock-outline",
    iconColor: theme.pendingBadgeText,
  };

  if (isOverdue) {
    statusConfig = {
      leftBorder: theme.overdueLeftBorder,
      badgeBg: theme.overdueBadgeBg,
      badgeBorder: theme.overdueBadgeBorder,
      badgeText: theme.overdueBadgeText,
      label: "• OVERDUE",
      icon: "history",
      iconColor: theme.overdueBadgeText,
    };
  } else if (isPaid) {
    statusConfig = {
      leftBorder: theme.paidLeftBorder,
      badgeBg: theme.badgeBg || theme.paidBadgeBg,
      badgeBorder: theme.paidBadgeBorder,
      badgeText: theme.paidBadgeText,
      label: "• PAID",
      icon: "check-circle",
      iconColor: theme.paidBadgeText,
    };
  } else if (isSkipped) {
    statusConfig = {
      leftBorder: theme.skippedLeftBorder,
      badgeBg: theme.skippedBadgeBg,
      badgeBorder: theme.skippedBadgeBorder,
      badgeText: theme.skippedBadgeText,
      label: "• SKIPPED",
      icon: "skip-next-circle-outline",
      iconColor: theme.skippedBadgeText,
    };
  }

  const handleDelete = () => {
    setMenuVisible(false);
    if (typeof onDelete === 'function') {
      onDelete(bill);
    }
  };

  const handleEdit = () => {
    setMenuVisible(false);
    if (typeof onEdit === 'function') {
      onEdit(bill);
    }
  };

  const handleSkip = () => {
    setMenuVisible(false);
    if (typeof onSkip === 'function') {
      onSkip(bill);
    }
  };

  const handleCardPress = () => {
    if (typeof onPress === 'function') {
      onPress(bill);
    }
  };

  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
          borderLeftColor: statusConfig.leftBorder,
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.88} onPress={handleCardPress}>
        {/* Top Section: Avatar, Title & Due Date, Amount & More */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            {/* Category / Source Avatar */}
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: category?.color ? `${category.color}15` : theme.iconContainerBg,
                  borderColor: category?.color ? `${category.color}30` : theme.iconContainerBorder,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={category?.icon || (bill._isCreditCardParent ? "credit-card" : "receipt")}
                size={22}
                color={category?.color || (bill._isCreditCardParent ? "#006a61" : theme.iconColor)}
              />
            </View>

            {/* Bill Name & Subtitle */}
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text
                style={[
                  styles.billName,
                  { color: isPaid ? theme.textSecondary : theme.textPrimary },
                ]}
                numberOfLines={1}
              >
                {bill.name}
              </Text>

              <View style={styles.subMetaRow}>
                <MaterialCommunityIcons
                  name={statusConfig.icon}
                  size={13}
                  color={statusConfig.iconColor}
                  style={{ marginRight: 3 }}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.subDueDate,
                    {
                      color: isOverdue ? theme.overdueBadgeText : theme.textSecondary,
                      fontWeight: isOverdue ? "700" : "500",
                    },
                  ]}
                >
                  {bill._noDueDate || !bill.due_date ? 'No due date' : `Due ${formatDueDate(bill.due_date)}`}
                </Text>

                {category?.name ? (
                  <>
                    <Text style={[styles.subBullet, { color: theme.textMuted }]}>·</Text>
                    <Text numberOfLines={1} style={[styles.subCategory, { color: theme.textSecondary }]}>
                      {category.name}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          </View>

          {/* Amount & More Options Menu */}
          <View style={styles.cardHeaderRight}>
            <Text
              style={[
                styles.amountText,
                {
                  color: isPaid ? theme.textMuted : theme.textPrimary,
                  textDecorationLine: isPaid ? 'line-through' : 'none',
                },
              ]}
            >
              <CurrencyText amount={bill.amount} />
            </Text>

            <View style={{ position: 'relative', zIndex: 10, marginLeft: 2 }}>
              {menuVisible && (
                <Portal>
                  <View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      backgroundColor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(230,230,240,0.3)',
                    }}
                    pointerEvents="none"
                  />
                </Portal>
              )}
              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <TouchableOpacity
                    onPress={() => setMenuVisible(true)}
                    activeOpacity={0.6}
                    style={styles.moreOptionsBtn}
                  >
                    <MaterialCommunityIcons
                      name="dots-vertical"
                      size={20}
                      color={theme.textMuted}
                    />
                  </TouchableOpacity>
                }
                contentStyle={{
                  backgroundColor: theme.menuBg,
                  borderRadius: 14,
                  elevation: 6,
                }}
              >
                {typeof onEdit === 'function' && (
                  <Menu.Item
                    onPress={handleEdit}
                    title="Edit Bill"
                    leadingIcon="pencil-outline"
                    titleStyle={{ fontSize: 13, color: theme.textPrimary }}
                  />
                )}
                {!isPaid && typeof onSkip === 'function' && (
                  <Menu.Item
                    onPress={handleSkip}
                    title="Skip This Period"
                    leadingIcon="skip-next"
                    titleStyle={{ fontSize: 13, color: theme.textPrimary }}
                  />
                )}
                {typeof onDelete === 'function' && (
                  <Menu.Item
                    onPress={handleDelete}
                    title="Delete Bill"
                    leadingIcon="trash-can-outline"
                    titleStyle={{ fontSize: 13, color: "#dc2626" }}
                  />
                )}
              </Menu>
            </View>
          </View>
        </View>

        {/* Bottom Card Controls */}
        <View style={[styles.bottomControlRow, { borderTopColor: theme.cardBorder }]}>
          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusConfig.badgeBg,
                borderColor: statusConfig.badgeBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                { color: statusConfig.badgeText },
              ]}
            >
              {statusConfig.label}
            </Text>
          </View>

          {/* Action Button: Pay Now / Statements / Review */}
          {bill._isCreditCardParent && typeof onToggleExpand === 'function' ? (
            <TouchableOpacity
              onPress={onToggleExpand}
              activeOpacity={0.8}
              style={[
                styles.secondaryCardBtn,
                {
                  backgroundColor: isDarkMode ? "#1e293b" : "#f1f5f9",
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.secondaryCardBtnText, { color: theme.textPrimary }]}>
                Statements
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={16}
                color={theme.textPrimary}
              />
            </TouchableOpacity>
          ) : isOverdue && typeof onMarkPaid === 'function' ? (
            <TouchableOpacity
              onPress={() => onMarkPaid(bill)}
              activeOpacity={0.8}
              style={[styles.payNowBtn, { backgroundColor: theme.overdueActionBg }]}
            >
              <Text style={styles.payNowBtnText}>Pay Now</Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={15}
                color="#ffffff"
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>
          ) : !isPaid && typeof onMarkPaid === 'function' ? (
            <TouchableOpacity
              onPress={() => onMarkPaid(bill)}
              activeOpacity={0.8}
              style={[styles.payNowBtn, { backgroundColor: theme.pendingActionBg }]}
            >
              <Text style={styles.payNowBtnText}>Pay</Text>
              <MaterialCommunityIcons
                name="check"
                size={15}
                color="#ffffff"
                style={{ marginLeft: 3 }}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 13,
    shadowColor: "#0b1c30",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  billName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Plus Jakarta Sans',
    lineHeight: 20,
  },
  subMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  subDueDate: {
    fontSize: 12,
    fontFamily: 'Inter',
  },
  subBullet: {
    marginHorizontal: 4,
    fontSize: 12,
  },
  subCategory: {
    fontSize: 12,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  cardHeaderRight: {
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: 6,
  },
  amountText: {
    fontWeight: '800',
    fontSize: 15.5,
    fontFamily: 'Plus Jakarta Sans',
  },
  moreOptionsBtn: {
    padding: 4,
    marginLeft: 2,
  },
  bottomControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    fontFamily: 'Inter',
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  payNowBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
    fontFamily: "Inter",
  },
  secondaryCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryCardBtnText: {
    fontWeight: "700",
    fontSize: 11.5,
    fontFamily: "Inter",
    marginRight: 2,
  },
});

export default memo(BillCard);
