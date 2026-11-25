import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Snackbar } from "react-native-paper";
import { getLoans, getLoanPayments } from "../services/loans";
import events from "../services/events";
import ContextualFAB from "../components/ContextualFAB";
import LoanQuickActions from "../components/LoanQuickActions";
import { useTheme } from "../context/ThemeContext";
import { Spacing } from "../components/Theme";
import { useAppDispatch, useLoans } from "../redux/hooks";
import { setLoans } from "../redux/slices/loanSlice";
import CurrencyText from "../components/CurrencyText";
import {
  buildLoanActionNavigation,
  computeDirectionSummary,
  computeUpcomingDueInfo,
  getDashboardQuickActions,
  getLoanDirection,
  getRecentActivityMeta,
  isLoanActive,
  isLoanOverdue,
  resolveQuickActionTarget,
} from "../utils/loanDashboardUtils";

/* =========================================================
   HELPERS
========================================================= */

function money(value, digits = 0) {
  return (
    <CurrencyText
      amount={value}
      minimumFractionDigits={digits}
      maximumFractionDigits={digits}
    />
  );
}

function number(value) {
  return Number(value || 0);
}

function formatDate(date) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (e) {
    return "-";
  }
}

function getProgressColor(percent, fallbackAccent = "#2563EB") {
  if (percent >= 100) return "#16A34A";
  if (percent >= 75) return "#10B981";
  return fallbackAccent;
}

/* =========================================================
   SMALL ICON & STATUS BADGE
========================================================= */

function IconBox({
  icon,
  color,
  size = 42,
  iconSize = 21,
  radius = 13,
  isDarkMode = false,
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: isDarkMode ? `${color}24` : `${color}16`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MaterialCommunityIcons name={icon} size={iconSize} color={color} />
    </View>
  );
}

function StatusBadge({ status, color, isDarkMode = false }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        height: 22,
        borderRadius: 11,
        backgroundColor: isDarkMode ? `${color}26` : `${color}16`,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
          marginRight: 5,
        }}
      />

      <Text
        style={{
          fontSize: 9,
          fontWeight: "900",
          letterSpacing: 0.35,
          color,
        }}
      >
        {status}
      </Text>
    </View>
  );
}

/* =========================================================
   DIRECTION TABS
========================================================= */

function DirectionTabs({
  direction,
  setDirection,
  borrowedCount,
  lentCount,
  theme,
  isDarkMode,
}) {
  const tabs = [
    {
      key: "BORROWED",
      label: "Loans",
      count: borrowedCount,
      icon: "bank-outline",
      color: "#2563EB",
    },
    {
      key: "LENT",
      label: "Money Lent",
      count: lentCount,
      icon: "hand-coin-outline",
      color: "#7C3AED",
    },
  ];

  return (
    <View
      style={[
        styles.directionTabsWrap,
        {
          backgroundColor: isDarkMode ? theme.cardBgSecondary : "#EEF2F7",
          borderColor: theme.border,
        },
      ]}
    >
      {tabs.map((tab) => {
        const active = direction === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.82}
            onPress={() => setDirection(tab.key)}
            style={[
              styles.directionTab,
              active && [
                styles.directionTabActive,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: `${tab.color}35`,
                },
              ],
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={17}
              color={active ? tab.color : theme.textSecondary}
              style={{ marginRight: 7 }}
            />
            <Text
              style={[
                styles.directionTabLabel,
                { color: active ? theme.textPrimary : theme.textSecondary },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            <View
              style={[
                styles.directionTabCount,
                {
                  backgroundColor: active
                    ? `${tab.color}1C`
                    : isDarkMode
                      ? "#334155"
                      : "#DCE3EC",
                },
              ]}
            >
              <Text
                style={[
                  styles.directionTabCountText,
                  { color: active ? tab.color : theme.textSecondary },
                ]}
              >
                {tab.count}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* =========================================================
   HERO DASHBOARD CARD
========================================================= */

function HeroDashboardCard({
  summary,
  accent,
  isBorrowed,
  navigation,
  direction,
  onSelectFilter,
  theme,
  isDarkMode,
}) {
  const {
    outstanding,
    paid,
    percentage,
    emi,
    interest,
    total,
    activeCount,
    closedCount,
    overdue,
  } = summary;
  const safePercentage = Math.max(0, Math.min(100, Number(percentage || 0)));
  const progressColor = getProgressColor(safePercentage, accent);

  return (
    <View
      style={[
        styles.heroCard,
        {
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.heroTopRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.heroOverline, { color: theme.textSecondary }]}>
            {isBorrowed ? "Still to Repay" : "Pending Recovery"}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            style={[styles.heroAmount, { color: theme.textPrimary }]}
          >
            <CurrencyText amount={outstanding} minimumFractionDigits={2} />
          </Text>
        </View>

        <View style={styles.heroBadgesCol}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate("LoanList", { status: "Active", direction })
            }
            style={[
              styles.heroStatusPill,
              {
                backgroundColor: isDarkMode ? `${accent}26` : `${accent}16`,
              },
            ]}
          >
            <Text style={[styles.heroStatusPillText, { color: accent }]}>
              {activeCount} Active
            </Text>
          </TouchableOpacity>

          {closedCount > 0 && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onSelectFilter("Closed")}
              style={[
                styles.heroStatusPill,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(22, 163, 74, 0.22)"
                    : "#DCFCE7",
                },
              ]}
            >
              <Text style={[styles.heroStatusPillText, { color: "#16A34A" }]}>
                {closedCount} Closed
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress */}
      <View style={{ marginBottom: 16 }}>
        <View style={styles.heroProgressHeader}>
          <Text style={[styles.heroProgressLabel, { color: theme.textSecondary }]}>
            {isBorrowed ? "Repayment Progress" : "Recovery Progress"}
          </Text>
          <Text style={[styles.heroProgressPct, { color: progressColor }]}>
            {Math.round(safePercentage)}%
          </Text>
        </View>

        <View
          style={[
            styles.heroProgressTrack,
            { backgroundColor: isDarkMode ? "#334155" : "#E8EDF4" },
          ]}
        >
          <View
            style={[
              styles.heroProgressFill,
              {
                width: `${safePercentage}%`,
                backgroundColor: progressColor,
              },
            ]}
          />
        </View>

        <View style={styles.heroProgressMeta}>
          <Text style={[styles.heroProgressSub, { color: theme.textSecondary }]}>
            {isBorrowed ? "Paid: " : "Recovered: "}
            <Text style={{ fontWeight: "800", color: theme.textPrimary }}>
              {money(paid)}
            </Text>
          </Text>
          <Text style={[styles.heroProgressSub, { color: theme.textSecondary }]}>
            Total:{" "}
            <Text style={{ fontWeight: "800", color: theme.textPrimary }}>
              {money(total)}
            </Text>
          </Text>
        </View>
      </View>

      {/* 3 Compact KPIs */}
      <View
        style={[
          styles.heroKpiStrip,
          {
            backgroundColor: theme.cardBgSecondary,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.heroKpiItem}>
          <Text style={[styles.heroKpiLabel, { color: theme.textSecondary }]} numberOfLines={1}>
            {isBorrowed ? "Monthly EMI" : "Interest Earned"}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            style={[styles.heroKpiVal, { color: theme.textPrimary }]}
          >
            {money(isBorrowed ? emi : interest)}
          </Text>
        </View>

        <View style={[styles.heroKpiDivider, { backgroundColor: theme.border }]} />

        <View style={styles.heroKpiItem}>
          <Text style={[styles.heroKpiLabel, { color: theme.textSecondary }]} numberOfLines={1}>
            {isBorrowed ? "Interest Paid" : "Total Lent"}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            style={[styles.heroKpiVal, { color: theme.textPrimary }]}
          >
            {money(isBorrowed ? interest : total)}
          </Text>
        </View>

        <View style={[styles.heroKpiDivider, { backgroundColor: theme.border }]} />

        <TouchableOpacity
          activeOpacity={overdue > 0 ? 0.75 : 1}
          onPress={() => {
            if (overdue > 0) onSelectFilter("Overdue");
          }}
          style={styles.heroKpiItem}
        >
          <Text style={[styles.heroKpiLabel, { color: theme.textSecondary }]} numberOfLines={1}>
            Health
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[
              styles.heroKpiVal,
              { color: overdue > 0 ? "#EF4444" : "#16A34A" },
            ]}
          >
            {overdue > 0 ? `${overdue} Overdue` : "On Track"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* =========================================================
   SECTION HEADER
========================================================= */

function SectionHeader({ title, subtitle, count, onViewAll, theme, isDarkMode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          {title}
        </Text>
        {!!subtitle && (
          <Text
            numberOfLines={1}
            style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
          >
            {subtitle}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {count !== undefined && (
          <View
            style={[
              styles.sectionCountBadge,
              {
                backgroundColor: isDarkMode ? theme.cardBgSecondary : "#EEF2F7",
              },
            ]}
          >
            <Text style={[styles.sectionCountText, { color: theme.textSecondary }]}>
              {count}
            </Text>
          </View>
        )}

        {onViewAll && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onViewAll}
            style={styles.viewAllBtn}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* =========================================================
   UPCOMING CARD
========================================================= */

function UpcomingCard({ loan, direction, cardWidth, navigation, theme, isDarkMode }) {
  const accent = direction === "BORROWED" ? "#2563EB" : "#7C3AED";
  const isBorrowed = direction === "BORROWED";
  const dueInfo = loan.dueInfo || computeUpcomingDueInfo(loan);
  const urgencyColor =
    dueInfo.urgencyTone === "danger"
      ? "#DC2626"
      : dueInfo.urgencyTone === "warning"
        ? "#D97706"
        : accent;

  const quickNav = buildLoanActionNavigation(isBorrowed ? "pay" : "receive", loan);

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={() => navigation.navigate("LoanDetails", { id: loan.id })}
      style={[
        styles.upcomingCard,
        {
          width: cardWidth,
          backgroundColor: theme.cardBg,
          borderColor: dueInfo.isOverdue ? "#FCA5A5" : theme.border,
        },
      ]}
    >
      <View style={styles.upcomingTopRow}>
        <IconBox
          icon={isBorrowed ? "calendar-arrow-right" : "calendar-check"}
          color={urgencyColor}
          size={36}
          iconSize={18}
          radius={11}
          isDarkMode={isDarkMode}
        />

        <View
          style={[
            styles.urgencyBadge,
            {
              backgroundColor: isDarkMode
                ? `${urgencyColor}26`
                : `${urgencyColor}16`,
            },
          ]}
        >
          <Text style={[styles.urgencyBadgeText, { color: urgencyColor }]}>
            {dueInfo.urgencyLabel}
          </Text>
        </View>
      </View>

      <Text
        numberOfLines={1}
        style={[styles.upcomingTitle, { color: theme.textPrimary }]}
      >
        {loan.loan_name || "Loan"}
      </Text>

      <Text style={[styles.upcomingDate, { color: theme.textSecondary }]}>
        {formatDate(dueInfo.nextDueDate)}
      </Text>

      <View style={styles.upcomingBottomRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[styles.upcomingAmount, { color: urgencyColor }]}
          >
            {money(number(loan.emi_amount) || number(loan.outstanding_amount))}
          </Text>
          <Text style={[styles.upcomingAmountSub, { color: theme.textMuted }]}>
            {isBorrowed ? "Next EMI" : "Expected"}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={(e) => {
            e?.stopPropagation?.();
            navigation.navigate(quickNav.route, quickNav.params);
          }}
          style={[
            styles.upcomingPayBtn,
            {
              backgroundColor: isDarkMode ? `${accent}26` : `${accent}16`,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${isBorrowed ? "Pay" : "Receive"} ${loan.loan_name}`}
        >
          <Text style={[styles.upcomingPayBtnText, { color: accent }]}>
            {isBorrowed ? "Pay" : "Receive"}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

/* =========================================================
   LOAN CARD
========================================================= */

function DirectionLoanCard({ loan, direction, navigation, theme, isDarkMode }) {
  const isBorrowed = direction === "BORROWED";
  const outstanding = Math.max(0, number(loan.outstanding_amount));
  const paid = Math.max(0, number(loan.principal_paid));
  const total = paid + outstanding;
  const completed = !isLoanActive(loan) || outstanding <= 0;
  const percentage = total > 0 ? Math.min(100, (paid / total) * 100) : completed ? 100 : 0;
  const overdue = isLoanOverdue(loan);
  const accent = overdue ? "#DC2626" : isBorrowed ? "#2563EB" : "#7C3AED";
  const progressColor = getProgressColor(percentage, accent);
  const status = overdue ? "OVERDUE" : completed ? "CLOSED" : "ACTIVE";
  const statusColor = overdue ? "#DC2626" : completed ? "#16A34A" : accent;
  const quickNav = buildLoanActionNavigation(isBorrowed ? "pay" : "receive", loan);

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={() => navigation.navigate("LoanDetails", { id: loan.id })}
      style={[
        styles.loanCard,
        {
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
        },
      ]}
    >
      <View
        style={[
          styles.loanCardAccentBar,
          { backgroundColor: statusColor },
        ]}
      />

      <View style={styles.loanCardInner}>
        <View style={styles.loanCardHeader}>
          <IconBox
            icon={isBorrowed ? "bank-outline" : "hand-coin-outline"}
            color={statusColor}
            size={40}
            iconSize={20}
            radius={12}
            isDarkMode={isDarkMode}
          />

          <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
            <Text
              numberOfLines={1}
              style={[styles.loanCardTitle, { color: theme.textPrimary }]}
            >
              {loan.loan_name || "Loan"}
            </Text>

            <Text
              numberOfLines={1}
              style={[styles.loanCardSub, { color: theme.textSecondary }]}
            >
              {isBorrowed ? "Remaining" : "Pending"} • {money(outstanding)}
              {loan.lender ? ` • ${loan.lender}` : ""}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end", marginLeft: 8, gap: 4 }}>
            <Text style={[styles.loanCardPct, { color: progressColor }]}>
              {Math.round(percentage)}%
            </Text>
            <StatusBadge
              status={status}
              color={statusColor}
              isDarkMode={isDarkMode}
            />
          </View>
        </View>

        {/* Progress Bar */}
        <View
          style={[
            styles.loanCardProgressTrack,
            { backgroundColor: isDarkMode ? "#334155" : "#E8EDF4" },
          ]}
        >
          <View
            style={[
              styles.loanCardProgressFill,
              {
                width: `${Math.min(100, percentage)}%`,
                backgroundColor: progressColor,
              },
            ]}
          />
        </View>

        {/* Footer & One-Tap Actions */}
        <View style={styles.loanCardFooter}>
          <View style={styles.loanCardFooterStats}>
            <Text style={[styles.loanCardFooterText, { color: theme.textSecondary }]}>
              {isBorrowed ? "Paid " : "Recovered "}
              <Text style={{ fontWeight: "700", color: theme.textPrimary }}>
                {money(paid)}
              </Text>
            </Text>

            {number(loan.emi_amount) > 0 && !completed && (
              <Text style={[styles.loanCardFooterText, { color: theme.textSecondary }]}>
                {" • "}EMI {money(loan.emi_amount)}
              </Text>
            )}
          </View>

          <View style={styles.loanCardQuickRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={(e) => {
                e?.stopPropagation?.();
                navigation.navigate("LoanReports", { id: loan.id });
              }}
              style={[
                styles.cardIconPill,
                {
                  backgroundColor: theme.cardBgSecondary,
                  borderColor: theme.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Reports for ${loan.loan_name}`}
            >
              <MaterialCommunityIcons
                name="file-chart-outline"
                size={15}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            {!completed && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  navigation.navigate(quickNav.route, quickNav.params);
                }}
                style={[
                  styles.cardActionPill,
                  {
                    backgroundColor: isDarkMode ? `${accent}26` : `${accent}16`,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${isBorrowed ? "Pay EMI" : "Receive"} for ${loan.loan_name}`}
              >
                <Text style={[styles.cardActionPillText, { color: accent }]}>
                  {isBorrowed ? "Pay" : "Receive"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* =========================================================
   RECENT ACTIVITY CARD
========================================================= */

function RecentPaymentCard({ item, direction, navigation, theme, isDarkMode }) {
  const meta = getRecentActivityMeta(item, direction);
  const amount = item.amount ?? item.payment_amount ?? item.paid_amount ?? 0;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => {
        if (item.loan_id) {
          navigation.navigate("LoanDetails", { id: item.loan_id });
        }
      }}
      style={[
        styles.recentCard,
        {
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <IconBox
          icon={meta.icon}
          color={meta.color}
          size={38}
          iconSize={18}
          radius={11}
          isDarkMode={isDarkMode}
        />

        <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
          <Text
            numberOfLines={1}
            style={[styles.recentTitle, { color: theme.textPrimary }]}
          >
            {item.loan_name || "Loan activity"}
          </Text>

          <Text style={[styles.recentDate, { color: theme.textSecondary }]}>
            {formatDate(item.payment_date)}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
          <Text style={[styles.recentAmount, { color: meta.color }]}>
            {meta.sign} {money(amount)}
          </Text>

          <Text style={[styles.recentTypeLabel, { color: theme.textMuted }]}>
            {meta.label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyCard({
  icon,
  title,
  subtitle,
  color = "#2563EB",
  compact = false,
  actionLabel,
  onAction,
  theme,
  isDarkMode,
}) {
  return (
    <View
      style={[
        styles.emptyCard,
        {
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
          paddingVertical: compact ? 18 : 24,
        },
      ]}
    >
      <IconBox
        icon={icon}
        color={color}
        size={compact ? 42 : 48}
        iconSize={compact ? 21 : 24}
        radius={compact ? 12 : 14}
        isDarkMode={isDarkMode}
      />

      <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
        {title}
      </Text>

      <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
        {subtitle}
      </Text>

      {!!actionLabel && onAction && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onAction}
          style={[styles.emptyCta, { backgroundColor: color }]}
        >
          <Text style={styles.emptyCtaText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* =========================================================
   QUICK LOAN PICKER MODAL (FOR MULTI-LOAN SHORTCUTS)
========================================================= */

function QuickLoanPickerModal({
  visible,
  actionKey,
  loans,
  direction,
  onClose,
  onSelectLoan,
  theme,
  isDarkMode,
}) {
  if (!visible) return null;

  const titleMap = {
    pay: "Select Loan to Pay EMI",
    prepay: "Select Loan to Prepay",
    receive: "Select Loan to Receive Payment",
    lendMore: "Select Loan to Lend More",
  };

  const isBorrowed = direction === "BORROWED";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.modalOverlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: theme.modalBg,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              {titleMap[actionKey] || "Choose a Loan"}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: 340 }}
            showsVerticalScrollIndicator={false}
          >
            {loans.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.8}
                onPress={() => onSelectLoan(item)}
                style={[
                  styles.pickerRow,
                  {
                    backgroundColor: theme.cardBgSecondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[styles.pickerLoanName, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {item.loan_name}
                  </Text>
                  <Text
                    style={[styles.pickerLoanMeta, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {isBorrowed ? "Balance: " : "Pending: "}
                    {money(item.outstanding_amount)}
                    {number(item.emi_amount) > 0
                      ? ` • EMI ${money(item.emi_amount)}`
                      : ""}
                  </Text>
                </View>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={theme.textMuted}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* =========================================================
   MAIN DASHBOARD
========================================================= */

function LoanDirectionDashboard({ navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const dispatch = useAppDispatch();
  const reduxLoans = useLoans();

  const [allLoans, setAllLoans] = useState(() => reduxLoans || []);
  const [allPayments, setAllPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [direction, setDirection] = useState("BORROWED");
  const [loanFilter, setLoanFilter] = useState("Active"); // 'Active' | 'Overdue' | 'Closed'
  const [pickerState, setPickerState] = useState({
    visible: false,
    actionKey: null,
    loans: [],
  });
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent && !hasLoadedOnceRef.current) {
          setLoading(true);
        }

        const data = await getLoans();
        const safeLoans = Array.isArray(data) ? data : [];
        setAllLoans(safeLoans);
        dispatch(setLoans(safeLoans));

        const paymentChunks = await Promise.all(
          safeLoans.map(async (loan) => {
            const rows = await getLoanPayments(loan.id, 6, 0);
            const dir = getLoanDirection(loan);
            return (rows || []).map((payment) => ({
              ...payment,
              loan_id: payment.loan_id ?? loan.id,
              loan_name: loan.loan_name,
              loan_direction: dir,
            }));
          }),
        );

        const merged = paymentChunks
          .flat()
          .sort(
            (a, b) =>
              new Date(b.payment_date || 0) - new Date(a.payment_date || 0),
          );

        setAllPayments(merged);
      } catch (error) {
        console.error("Loan dashboard load error:", error);
      } finally {
        hasLoadedOnceRef.current = true;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dispatch],
  );

  useEffect(() => {
    load();

    const unsubscribe = navigation.addListener("focus", () =>
      load({ silent: true }),
    );
    const offLoans = events.on("loansChanged", () => load({ silent: true }));
    const offPayments = events.on("loanPaymentsChanged", () =>
      load({ silent: true }),
    );

    return () => {
      unsubscribe?.();
      offLoans?.();
      offPayments?.();
    };
  }, [navigation, load]);

  useEffect(() => {
    setLoanFilter("Active");
  }, [direction]);

  const borrowedCount = useMemo(
    () => allLoans.filter((l) => getLoanDirection(l) === "BORROWED").length,
    [allLoans],
  );
  const lentCount = useMemo(
    () => allLoans.filter((l) => getLoanDirection(l) === "LENT").length,
    [allLoans],
  );

  const directionLoans = useMemo(
    () => allLoans.filter((l) => getLoanDirection(l) === direction),
    [allLoans, direction],
  );

  const summary = useMemo(
    () => computeDirectionSummary(directionLoans),
    [directionLoans],
  );

  const activeLoans = useMemo(() => {
    return directionLoans
      .filter((loan) => isLoanActive(loan) && number(loan.outstanding_amount) > 0)
      .sort(
        (a, b) => number(b.outstanding_amount) - number(a.outstanding_amount),
      );
  }, [directionLoans]);

  const overdueLoans = useMemo(
    () => directionLoans.filter((loan) => isLoanOverdue(loan)),
    [directionLoans],
  );

  const closedLoans = useMemo(
    () =>
      directionLoans.filter(
        (loan) => !isLoanActive(loan) || number(loan.outstanding_amount) <= 0,
      ),
    [directionLoans],
  );

  const displayedLoans = useMemo(() => {
    if (loanFilter === "Overdue") return overdueLoans;
    if (loanFilter === "Closed") return closedLoans;
    return activeLoans;
  }, [loanFilter, activeLoans, overdueLoans, closedLoans]);

  const upcoming = useMemo(() => {
    return directionLoans
      .filter(
        (loan) =>
          isLoanActive(loan) &&
          number(loan.outstanding_amount) > 0 &&
          number(loan.emi_amount) > 0,
      )
      .map((loan) => ({
        ...loan,
        dueInfo: computeUpcomingDueInfo(loan),
      }))
      .sort((a, b) => {
        if (a.dueInfo.isOverdue !== b.dueInfo.isOverdue) {
          return a.dueInfo.isOverdue ? -1 : 1;
        }
        return (
          new Date(a.dueInfo.nextDueDate) - new Date(b.dueInfo.nextDueDate)
        );
      })
      .slice(0, 8);
  }, [directionLoans]);

  const recentPayments = useMemo(() => {
    return allPayments
      .filter((p) => p.loan_direction === direction)
      .slice(0, 6);
  }, [allPayments, direction]);

  const isBorrowed = direction === "BORROWED";
  const accent = isBorrowed ? "#2563EB" : "#7C3AED";
  const title = isBorrowed ? "Loans" : "Money Lent";
  const subtitle = isBorrowed
    ? "Track what you still need to repay"
    : "Track what others still owe you";
  const primaryIcon = isBorrowed ? "bank-outline" : "hand-coin-outline";

  const quickActions = useMemo(
    () => getDashboardQuickActions(direction),
    [direction],
  );

  const handleQuickAction = useCallback(
    (actionKey) => {
      const target = resolveQuickActionTarget({
        actionKey,
        direction,
        activeLoans,
      });

      if (target.type === "navigate") {
        navigation.navigate(target.route, target.params);
        return;
      }

      if (target.type === "pickLoan") {
        setPickerState({
          visible: true,
          actionKey: target.actionKey,
          loans: target.loans,
        });
        return;
      }

      setSnackbarMsg(
        isBorrowed
          ? "No active borrowed loans yet. Tap Add Loan to create one."
          : "No active money-lent records yet. Tap Lend Money to create one.",
      );
      setSnackbarVisible(true);
    },
    [direction, activeLoans, navigation, isBorrowed],
  );

  const upcomingCardWidth = Math.min(
    220,
    Math.max(168, Math.round(screenWidth * 0.48)),
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            backgroundColor: isDarkMode ? `${accent}24` : `${accent}14`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="small" color={accent} />
        </View>

        <Text
          style={{
            marginTop: 10,
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          Loading {isBorrowed ? "loans" : "money lent"}...
        </Text>
      </View>
    );
  }

  const filterChips = [
    { key: "Active", label: `Active (${activeLoans.length})` },
    ...(overdueLoans.length > 0
      ? [{ key: "Overdue", label: `Overdue (${overdueLoans.length})` }]
      : []),
    ...(closedLoans.length > 0
      ? [{ key: "Closed", label: `Closed (${closedLoans.length})` }]
      : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load({ silent: true });
            }}
            tintColor={accent}
            colors={[accent]}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: Spacing.s + 4,
          paddingTop: 8,
          paddingBottom: 108,
        }}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <IconBox
              icon={primaryIcon}
              color={accent}
              size={42}
              iconSize={22}
              radius={13}
              isDarkMode={isDarkMode}
            />

            <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                {title}
              </Text>

              <Text
                numberOfLines={1}
                style={[styles.headerSubtitle, { color: theme.textSecondary }]}
              >
                {subtitle}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate("LoanList", { direction })}
            style={[
              styles.headerAllBtn,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.border,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="format-list-bulleted"
              size={15}
              color={accent}
            />
            <Text style={[styles.headerAllBtnText, { color: theme.textPrimary }]}>
              All ({allLoans.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* TABS */}
        <DirectionTabs
          direction={direction}
          setDirection={setDirection}
          borrowedCount={borrowedCount}
          lentCount={lentCount}
          theme={theme}
          isDarkMode={isDarkMode}
        />

        {/* HERO SUMMARY */}
        <HeroDashboardCard
          summary={summary}
          accent={accent}
          isBorrowed={isBorrowed}
          navigation={navigation}
          direction={direction}
          onSelectFilter={(nextFilter) => setLoanFilter(nextFilter)}
          theme={theme}
          isDarkMode={isDarkMode}
        />

        {/* QUICK ACTIONS */}
        <View style={{ marginBottom: 8 }}>
          <LoanQuickActions
            actions={quickActions}
            actionLabels={{
              add: isBorrowed ? "Add Loan" : "Lend Money",
              all: isBorrowed ? "All Loans" : "All Lent",
            }}
            onActionPress={handleQuickAction}
          />
        </View>

        {/* UPCOMING PAYMENTS / EXPECTED RECOVERY */}
        <SectionHeader
          title={isBorrowed ? "Upcoming Payments" : "Expected Recovery"}
          subtitle={
            isBorrowed
              ? "Your next scheduled installments"
              : "Amounts expected back soon"
          }
          count={upcoming.length}
          theme={theme}
          isDarkMode={isDarkMode}
        />

        {upcoming.length === 0 ? (
          <EmptyCard
            compact
            color={accent}
            icon={isBorrowed ? "calendar-check-outline" : "cash-check"}
            title={
              isBorrowed ? "No upcoming payments" : "No pending recoveries"
            }
            subtitle={
              isBorrowed
                ? "Active loans with an EMI schedule will appear here."
                : "Active money-lent records with a schedule will appear here."
            }
            theme={theme}
            isDarkMode={isDarkMode}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 4 }}
          >
            {upcoming.map((loan) => (
              <UpcomingCard
                key={loan.id}
                loan={loan}
                direction={direction}
                cardWidth={upcomingCardWidth}
                navigation={navigation}
                theme={theme}
                isDarkMode={isDarkMode}
              />
            ))}
          </ScrollView>
        )}

        {/* LOANS LIST WITH INLINE STATUS CHIPS */}
        <SectionHeader
          title={isBorrowed ? "Your Loans" : "Money Lent"}
          subtitle={
            isBorrowed
              ? "Tap any loan for details or pay directly"
              : "Tap any entry for details or record recovery"
          }
          count={displayedLoans.length}
          onViewAll={() => navigation.navigate("LoanList", { direction })}
          theme={theme}
          isDarkMode={isDarkMode}
        />

        {filterChips.length > 1 && (
          <View style={styles.filterChipsRow}>
            {filterChips.map((chip) => {
              const selected = loanFilter === chip.key;
              const chipAccent = chip.key === "Overdue" ? "#DC2626" : chip.key === "Closed" ? "#16A34A" : accent;
              return (
                <TouchableOpacity
                  key={chip.key}
                  activeOpacity={0.8}
                  onPress={() => setLoanFilter(chip.key)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selected
                        ? isDarkMode
                          ? `${chipAccent}28`
                          : `${chipAccent}16`
                        : theme.cardBg,
                      borderColor: selected ? chipAccent : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: selected ? chipAccent : theme.textSecondary },
                    ]}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {displayedLoans.length === 0 ? (
          <EmptyCard
            color={accent}
            icon={isBorrowed ? "bank-off-outline" : "account-cash-outline"}
            title={
              loanFilter === "Closed"
                ? "No closed loans"
                : loanFilter === "Overdue"
                  ? "No overdue loans"
                  : isBorrowed
                    ? "No active loans"
                    : "No active lending"
            }
            subtitle={
              isBorrowed
                ? "Add a borrowed loan to start tracking repayments."
                : "Add money lent to someone to track recovery."
            }
            actionLabel={
              loanFilter === "Active"
                ? isBorrowed
                  ? "Add Loan"
                  : "Lend Money"
                : undefined
            }
            onAction={
              loanFilter === "Active"
                ? () =>
                    navigation.navigate("LoanForm", {
                      initialDirection: direction,
                    })
                : undefined
            }
            theme={theme}
            isDarkMode={isDarkMode}
          />
        ) : (
          displayedLoans.map((loan) => (
            <DirectionLoanCard
              key={loan.id}
              loan={loan}
              direction={direction}
              navigation={navigation}
              theme={theme}
              isDarkMode={isDarkMode}
            />
          ))
        )}

        {/* RECENT ACTIVITY */}
        <SectionHeader
          title={isBorrowed ? "Recent Activity" : "Recent Recoveries"}
          subtitle={
            isBorrowed
              ? "Tap an entry to view that loan"
              : "Latest repayments & advances"
          }
          count={recentPayments.length}
          theme={theme}
          isDarkMode={isDarkMode}
        />

        {recentPayments.length === 0 ? (
          <EmptyCard
            compact
            color={accent}
            icon="history"
            title="No recent activity"
            subtitle={
              isBorrowed
                ? "Loan payments and top-ups will appear here."
                : "Recovered payments and advances will appear here."
            }
            theme={theme}
            isDarkMode={isDarkMode}
          />
        ) : (
          recentPayments.map((payment) => (
            <RecentPaymentCard
              key={payment.id}
              item={payment}
              direction={direction}
              navigation={navigation}
              theme={theme}
              isDarkMode={isDarkMode}
            />
          ))
        )}
      </ScrollView>

      {/* QUICK LOAN PICKER MODAL */}
      <QuickLoanPickerModal
        visible={pickerState.visible}
        actionKey={pickerState.actionKey}
        loans={pickerState.loans}
        direction={direction}
        onClose={() => setPickerState((prev) => ({ ...prev, visible: false }))}
        onSelectLoan={(chosen) => {
          const target = buildLoanActionNavigation(pickerState.actionKey, chosen);
          setPickerState((prev) => ({ ...prev, visible: false }));
          navigation.navigate(target.route, target.params);
        }}
        theme={theme}
        isDarkMode={isDarkMode}
      />

      {/* FAB */}
      <ContextualFAB
        icon="plus"
        actions={[
          {
            icon: "account-arrow-right-outline",
            label: "Given",
            color: "#7C3AED",
            style: { backgroundColor: "#fff" },
            onPress: () =>
              navigation.navigate("LoanForm", { initialDirection: "LENT" }),
          },
          {
            icon: "account-arrow-left-outline",
            label: "Received",
            color: "#2563EB",
            style: { backgroundColor: "#fff" },
            onPress: () =>
              navigation.navigate("LoanForm", { initialDirection: "BORROWED" }),
          },
        ]}
      />

      {/* SNACKBAR */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2600}
        action={{
          label: "OK",
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMsg}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
  },
  headerSubtitle: {
    marginTop: 1,
    fontSize: 11,
  },
  headerAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  headerAllBtnText: {
    fontSize: 11,
    fontWeight: "800",
  },

  /* Direction Tabs */
  directionTabsWrap: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  directionTab: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  directionTabActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  directionTabLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  directionTabCount: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9,
    minWidth: 20,
    alignItems: "center",
  },
  directionTabCountText: {
    fontSize: 10,
    fontWeight: "900",
  },

  /* Hero Card */
  heroCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 10,
  },
  heroOverline: {
    fontSize: 12,
    fontWeight: "700",
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 3,
  },
  heroBadgesCol: {
    alignItems: "flex-end",
    gap: 6,
  },
  heroStatusPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 18,
  },
  heroStatusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  heroProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  heroProgressLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  heroProgressPct: {
    fontSize: 13,
    fontWeight: "900",
  },
  heroProgressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  heroProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  heroProgressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
  },
  heroProgressSub: {
    fontSize: 11,
    fontWeight: "600",
  },
  heroKpiStrip: {
    flexDirection: "row",
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  heroKpiItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  heroKpiLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 3,
  },
  heroKpiVal: {
    fontSize: 14,
    fontWeight: "900",
  },
  heroKpiDivider: {
    width: 1,
    marginHorizontal: 6,
  },

  /* Section Header */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 11,
  },
  sectionCountBadge: {
    minWidth: 26,
    height: 23,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: "900",
  },
  viewAllBtn: {
    marginLeft: 10,
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },

  /* Filter Chips */
  filterChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "800",
  },

  /* Upcoming Card */
  upcomingCard: {
    marginRight: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  upcomingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  urgencyBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  upcomingTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  upcomingDate: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
  },
  upcomingBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
  },
  upcomingAmount: {
    fontSize: 17,
    fontWeight: "900",
  },
  upcomingAmountSub: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
  upcomingPayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  upcomingPayBtnText: {
    fontSize: 11,
    fontWeight: "800",
  },

  /* Loan Card */
  loanCard: {
    marginBottom: 10,
    borderRadius: 17,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  loanCardAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  loanCardInner: {
    paddingVertical: 13,
    paddingLeft: 14,
    paddingRight: 12,
  },
  loanCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  loanCardTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  loanCardSub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
  },
  loanCardPct: {
    fontSize: 15,
    fontWeight: "900",
  },
  loanCardProgressTrack: {
    marginTop: 11,
    height: 6,
    borderRadius: 4,
    overflow: "hidden",
  },
  loanCardProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  loanCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 8,
  },
  loanCardFooterStats: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    flex: 1,
    minWidth: 0,
  },
  loanCardFooterText: {
    fontSize: 11,
    fontWeight: "600",
  },
  loanCardQuickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardIconPill: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardActionPill: {
    paddingHorizontal: 11,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cardActionPillText: {
    fontSize: 11,
    fontWeight: "800",
  },

  /* Recent Activity */
  recentCard: {
    borderRadius: 15,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  recentDate: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "600",
  },
  recentAmount: {
    fontSize: 14,
    fontWeight: "900",
  },
  recentTypeLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "800",
  },

  /* Empty */
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "900",
  },
  emptySub: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    maxWidth: 290,
  },
  emptyCta: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  emptyCtaText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  /* Modal Picker */
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 18,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  pickerLoanName: {
    fontSize: 14,
    fontWeight: "800",
  },
  pickerLoanMeta: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
});

/* =========================================================
   EXPORT
========================================================= */

export function LoanDashboardScreen({ navigation }) {
  return <LoanDirectionDashboard navigation={navigation} />;
}

export default LoanDashboardScreen;
