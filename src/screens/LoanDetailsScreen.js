import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Snackbar } from "react-native-paper";
import { getLoanById, unlinkTransactionFromLoan } from "../services/loans";
import { getTransactions } from "../services/transactions";
import events from "../services/events";
import Card from "../components/Card";
import calc from "../services/loanCalculations";
import { useTheme } from "../context/ThemeContext";
import { useLoans } from "../redux/hooks";
import CurrencyText from "../components/CurrencyText";
import {
  computeActionGridLayout,
  getLoanActionsConfig,
} from "../utils/loanDetailsLayout";

function ActionTile({ action, width, onPress, theme, isDarkMode }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={[
        styles.actionTile,
        {
          width,
          backgroundColor: theme.cardBgSecondary,
          borderColor: theme.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={action.title}
    >
      <View
        style={[
          styles.actionIconBox,
          {
            backgroundColor: isDarkMode
              ? `${action.color}24`
              : action.lightBg || `${action.color}1C`,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={action.icon}
          size={21}
          color={action.color}
        />
      </View>

      <Text
        style={[styles.actionTileLabel, { color: theme.textPrimary }]}
        numberOfLines={2}
      >
        {action.title}
      </Text>
    </TouchableOpacity>
  );
}

export default function LoanDetailsScreen({ route, navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const isSmallPhone = screenWidth < 380;
  const isVerySmallPhone = screenWidth < 340;
  const isWideScreen = screenWidth >= 560;

  const horizontalPadding = isSmallPhone ? 10 : 14;
  const fallbackActionsWidth = Math.max(
    220,
    screenWidth - horizontalPadding * 2 - 32,
  );
  const [actionsWidth, setActionsWidth] = useState(null);

  const id = route?.params?.id;

  const reduxLoans = useLoans();
  const reduxLoan = reduxLoans?.find((l) => String(l.id) === String(id));

  const [localLoan, setLocalLoan] = useState(null);
  const loan = reduxLoan || localLoan;

  const [linkedTxs, setLinkedTxs] = useState([]);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [expandedActivityId, setExpandedActivityId] = useState(null);
  const [unlinkingTxId, setUnlinkingTxId] = useState(null);

  useEffect(() => {
    (async () => {
      if (!id) return;

      try {
        if (!reduxLoan) {
          const l = await getLoanById(id);
          setLocalLoan(l);
        }
      } catch (error) {
        console.error("Failed to load loan:", error);
      }
    })();
  }, [id]);

  useEffect(() => {
    loadLinkedTransactions();

    const offTx = events.on("transactionsChanged", (payload) => {
      if (payload?.action === "recalculate" || payload?.action === "unlink") {
        return;
      }

      loadLinkedTransactions();
    });

    const offLoans = events.on("loansChanged", (payload) => {
      if (payload?.action === "recalculate") return;

      refresh();
      loadLinkedTransactions();
    });

    const offPayments = events.on("loanPaymentsChanged", (payload) => {
      if (payload?.action === "recalculate") return;

      loadLinkedTransactions();
    });

    return () => {
      offTx && offTx();
      offLoans && offLoans();
      offPayments && offPayments();
    };
  }, [id]);

  async function loadLinkedTransactions() {
    if (!id) {
      setLinkedTxs([]);
      return;
    }

    try {
      const txs = await getTransactions(1000000, "Yes");

      const linked = txs.filter((t) => Number(t.loan_id) === Number(id));

      linked.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setLinkedTxs(linked);
    } catch (error) {
      console.error("Failed to load linked transactions:", error);
      setLinkedTxs([]);
    }
  }

  async function refresh() {
    if (!id) return;

    try {
      const l = await getLoanById(id);
      setLocalLoan(l);
    } catch (error) {
      console.error("Failed to refresh loan:", error);
    }
  }

  const actionsConfig = useMemo(() => getLoanActionsConfig(loan), [loan]);
  const actionGridLayout = useMemo(
    () =>
      computeActionGridLayout(
        actionsWidth || fallbackActionsWidth,
        actionsConfig.secondary.length,
      ),
    [actionsWidth, fallbackActionsWidth, actionsConfig.secondary.length],
  );

  if (!loan) return null;

  const isLent = (loan.loan_direction || "BORROWED") === "LENT";
  const isClosed = loan.status === "Closed";
  const heroAccent = isLent ? "#7C3AED" : "#2563EB";

  const totalPrincipal = Number(loan.principal_amount || 0);
  const originalPrincipal = Number(loan.principal_amount || 0);
  const paidSoFar = Number(loan.total_paid || 0);
  const remainingAmount = Number(loan.outstanding_amount || 0);

  const remainingMonths =
    Number(loan.remaining_months || 0) === Infinity
      ? 0
      : Number(loan.remaining_months || 0);

  const interestToPay =
    remainingAmount > 0 && remainingMonths > 0 && loan.emi_amount > 0
      ? calc
        .generateAmortizationSchedule(
          remainingAmount,
          loan.interest_rate,
          remainingMonths,
        )
        .reduce((sum, item) => sum + Number(item.interest || 0), 0)
      : 0;

  const repaymentPercentage =
    totalPrincipal > 0
      ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((totalPrincipal - remainingAmount) / totalPrincipal) * 100,
          ),
        ),
      )
      : 0;

  const progressColor = isClosed
    ? "#16A34A"
    : repaymentPercentage >= 75
      ? "#10B981"
      : heroAccent;

  const metrics = [
    {
      label: "Principal",
      value: <CurrencyText amount={originalPrincipal} />,
      icon: "cash-multiple",
      color: heroAccent,
    },
    {
      label: isLent ? "Recovered" : "Total Paid",
      value: <CurrencyText amount={paidSoFar} />,
      icon: "check-decagram-outline",
      color: "#16A34A",
    },
    {
      label: isLent ? "Expected EMI" : "Monthly EMI",
      value: <CurrencyText amount={Number(loan.emi_amount || 0)} />,
      icon: "calendar-sync",
      color: "#0284C7",
    },
    {
      label: "Interest Rate",
      value: `${loan.interest_rate || 0}%`,
      icon: "percent-outline",
      color: "#D97706",
    },
    {
      label: "Months Left",
      value: isClosed ? "0" : String(remainingMonths),
      icon: "clock-outline",
      color: "#7C3AED",
    },
    {
      label: "Interest Left",
      value: <CurrencyText amount={interestToPay} />,
      icon: "chart-bell-curve-cumulative",
      color: "#EA580C",
    },
  ];

  const metricContainerWidth = actionsWidth || fallbackActionsWidth;
  const metricCols = isVerySmallPhone ? 1 : isWideScreen ? 3 : 2;
  const metricTileWidth = Math.floor(
    (metricContainerWidth - 10 * (metricCols - 1)) / metricCols,
  );

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: theme.bg,
      }}
      contentContainerStyle={{
        paddingHorizontal: horizontalPadding,
        paddingTop: 12,
        paddingBottom: 34,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ================================================================ */}
      {/* LOAN SUMMARY HERO CARD                                           */}
      {/* ================================================================ */}

      <Card style={styles.heroCard}>
        <View
          style={[
            styles.heroBanner,
            {
              backgroundColor: heroAccent,
              padding: isSmallPhone ? 16 : 20,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.heroBadgeRow}>
                <View style={styles.directionPill}>
                  <MaterialCommunityIcons
                    name={isLent ? "hand-coin-outline" : "bank-outline"}
                    size={12}
                    color="#FFFFFF"
                  />
                  <Text style={styles.directionPillText}>
                    {isLent ? "Money Lent" : "Borrowed"}
                  </Text>
                </View>

                {!!loan.loan_type && (
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText} numberOfLines={1}>
                      {loan.loan_type}
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={[
                  styles.heroTitle,
                  {
                    fontSize: isSmallPhone ? 19 : 22,
                    lineHeight: isSmallPhone ? 24 : 28,
                  },
                ]}
                numberOfLines={3}
              >
                {loan.loan_name}
              </Text>

              {!!loan.lender && (
                <Text style={styles.heroSubtitle} numberOfLines={2}>
                  {isLent ? "Borrower: " : "Lender: "}
                  {loan.lender}
                </Text>
              )}
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isClosed ? "#DCFCE7" : "#DBEAFE",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: isClosed ? "#15803D" : "#1D4ED8" },
                ]}
              >
                {loan.status || "Active"}
              </Text>
            </View>
          </View>

          <View style={styles.balanceRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.balanceLabel}>
                {isLent ? "Pending Recovery" : "Outstanding Balance"}
              </Text>

              <Text
                style={[
                  styles.balanceValue,
                  {
                    fontSize: isVerySmallPhone ? 27 : isSmallPhone ? 30 : 33,
                    lineHeight: isVerySmallPhone ? 33 : isSmallPhone ? 37 : 41,
                  },
                ]}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                numberOfLines={1}
              >
                <CurrencyText amount={remainingAmount} />
              </Text>
            </View>

            {Number(loan.emi_day) > 0 && !isClosed && (
              <View style={styles.duePill}>
                <MaterialCommunityIcons
                  name="calendar-check-outline"
                  size={13}
                  color="#FFFFFF"
                />
                <Text style={styles.duePillText}>Day {loan.emi_day}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ================= REPAYMENT PROGRESS ================= */}

        <View>
          <View style={styles.repaymentHeader}>
            <Text style={[styles.repaymentLabel, { color: theme.textPrimary }]}>
              {isLent ? "Recovery Progress" : "Loan Repayment"}
            </Text>

            <Text style={[styles.repaymentPct, { color: progressColor }]}>
              {repaymentPercentage}%
            </Text>
          </View>

          <View
            style={[
              styles.repaymentTrack,
              { backgroundColor: isDarkMode ? "#334155" : "#E2E8F0" },
            ]}
          >
            <View
              style={[
                styles.repaymentFill,
                {
                  width: `${repaymentPercentage}%`,
                  backgroundColor: progressColor,
                },
              ]}
            />
          </View>
        </View>

        {/* ================= METRICS GRID ================= */}

        <View style={styles.metricsGrid}>
          {metrics.map((item) => (
            <View
              key={item.label}
              style={[
                styles.metricTile,
                {
                  width: metricTileWidth,
                  backgroundColor: theme.cardBgSecondary,
                  borderColor: theme.border,
                  padding: isSmallPhone ? 11 : 13,
                },
              ]}
            >
              <View style={styles.metricTopRow}>
                <Text
                  style={[styles.metricLabel, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={14}
                  color={item.color}
                />
              </View>

              <Text
                style={[
                  styles.metricValue,
                  {
                    color: theme.textPrimary,
                    fontSize: isSmallPhone ? 15 : 17,
                    lineHeight: isSmallPhone ? 19 : 22,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* ================================================================ */}
      {/* RESPONSIVE QUICK ACTIONS CARD                                    */}
      {/* ================================================================ */}

      <Card style={styles.actionsCard}>
        <View style={styles.actionsHeaderRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.actionsTitle, { color: theme.textPrimary }]}>
              Quick Actions
            </Text>
            <Text style={[styles.actionsSubtitle, { color: theme.textSecondary }]}>
              Manage payments, schedule adjustments, and insights
            </Text>
          </View>
        </View>

        <View
          onLayout={(event) => {
            const measured = Math.floor(event.nativeEvent.layout.width);
            if (measured > 0 && Math.abs(measured - (actionsWidth || 0)) >= 1) {
              setActionsWidth(measured);
            }
          }}
        >
          {actionsConfig.primary && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate(
                  actionsConfig.primary.route,
                  actionsConfig.primary.params,
                )
              }
              style={[
                styles.primaryActionBtn,
                {
                  backgroundColor: actionsConfig.primary.color,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={actionsConfig.primary.title}
            >
              <View style={styles.primaryActionIcon}>
                <MaterialCommunityIcons
                  name={actionsConfig.primary.icon}
                  size={22}
                  color={actionsConfig.primary.color}
                />
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.primaryActionTitle} numberOfLines={1}>
                  {actionsConfig.primary.title}
                </Text>
                <Text style={styles.primaryActionSub} numberOfLines={1}>
                  {actionsConfig.primary.subtitle}
                </Text>
              </View>

              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color="rgba(255,255,255,0.9)"
              />
            </TouchableOpacity>
          )}

          <View
            style={[
              styles.secondaryActionsGrid,
              { gap: actionGridLayout.gap },
            ]}
          >
            {actionsConfig.secondary.map((action) => (
              <ActionTile
                key={action.key}
                action={action}
                width={actionGridLayout.tileWidth}
                theme={theme}
                isDarkMode={isDarkMode}
                onPress={() => navigation.navigate(action.route, action.params)}
              />
            ))}
          </View>
        </View>
      </Card>

      {/* ================================================================ */}
      {/* LOAN ACTIVITY                                                    */}
      {/* ================================================================ */}

      <Card style={styles.activityCard}>
        {/* ================= SECTION HEADER ================= */}

        <View style={styles.activityHeader}>
          <View style={styles.activityHeaderLeft}>
            <View
              style={[
                styles.activityHeaderIcon,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(37, 99, 235, 0.18)"
                    : "#DBEAFE",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="timeline-clock-outline"
                size={21}
                color="#2563EB"
              />
            </View>

            <View
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <Text style={[styles.activityTitle, { color: theme.textPrimary }]}>
                Loan Activity
              </Text>

              <Text
                style={[styles.activitySubtitle, { color: theme.textSecondary }]}
                numberOfLines={2}
              >
                Payments and top-ups recorded for this loan
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.activityCount,
              {
                backgroundColor: isDarkMode
                  ? "rgba(37, 99, 235, 0.2)"
                  : "#EEF2FF",
              },
            ]}
          >
            <Text style={styles.activityCountText}>{linkedTxs.length}</Text>
          </View>
        </View>

        {/* ================= EMPTY STATE ================= */}

        {linkedTxs.length === 0 ? (
          <View style={styles.activityEmpty}>
            <View
              style={[
                styles.activityEmptyIcon,
                { backgroundColor: theme.cardBgSecondary },
              ]}
            >
              <MaterialCommunityIcons
                name="timeline-outline"
                size={34}
                color={theme.textMuted}
              />
            </View>

            <Text style={[styles.activityEmptyTitle, { color: theme.textPrimary }]}>
              No loan activity yet
            </Text>

            <Text style={[styles.activityEmptyText, { color: theme.textSecondary }]}>
              Payments and additional borrowing will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.activityList}>
            {linkedTxs.map((tx, index) => {
              const amount = Number(tx.amount || 0);
              const principal = Number(tx.principal_component || 0);
              const interest = Number(tx.interest_component || 0);
              const balance = Number(
                tx.outstanding_after_payment ?? loan.outstanding_amount ?? 0,
              );

              const transactionType = String(
                tx.type || tx.transaction_type || tx.direction || "",
              ).toLowerCase();

              const paymentType = (tx.loan_payment_type || "").toUpperCase();
              let isTopUp = paymentType === "TOP_UP" || paymentType === "ADVANCE";

              if (paymentType === "LINKED" || !paymentType) {
                const txDirection = String(tx.direction || "").toLowerCase();
                isTopUp =
                  (!isLent &&
                    (transactionType === "income" ||
                      txDirection === "credit")) ||
                  (isLent &&
                    (transactionType === "expense" ||
                      txDirection === "debit"));
              }

              const isPayment = !isTopUp;

              const isExpense =
                transactionType === "expense" ||
                transactionType === "debit" ||
                transactionType === "debit_expense";

              const activityTitle = isTopUp ? "Loan Top Up" : "Loan Payment";
              const activityDescription = isTopUp
                ? "Additional amount added to this loan"
                : "Payment made towards this loan";

              const activityIcon = isTopUp ? "cash-plus" : "cash-check";
              const activityColor = isTopUp ? "#7C3AED" : "#16A34A";
              const activityBg = isTopUp
                ? isDarkMode
                  ? "rgba(124, 58, 237, 0.2)"
                  : "#EDE9FE"
                : isDarkMode
                  ? "rgba(22, 163, 74, 0.2)"
                  : "#DCFCE7";

              const transactionColor = isExpense ? "#DC2626" : activityColor;
              const transactionBg = isExpense
                ? isDarkMode
                  ? "rgba(220, 38, 38, 0.2)"
                  : "#FEE2E2"
                : activityBg;

              const transactionDate = new Date(tx.date);

              const formattedDate = Number.isNaN(transactionDate.getTime())
                ? "Date unavailable"
                : transactionDate.toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

              const formattedTime = Number.isNaN(transactionDate.getTime())
                ? ""
                : transactionDate.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

              return (
                <View
                  key={tx.id}
                  style={[
                    styles.activityRow,
                    index === linkedTxs.length - 1 && styles.activityRowLast,
                  ]}
                >
                  {/* ================= TIMELINE ================= */}

                  <View style={styles.activityTimeline}>
                    <View
                      style={[
                        styles.activityTimelineIcon,
                        {
                          backgroundColor: transactionBg,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isExpense ? "cash-minus" : activityIcon}
                        size={20}
                        color={transactionColor}
                      />
                    </View>

                    {index !== linkedTxs.length - 1 && (
                      <View
                        style={[
                          styles.activityTimelineLine,
                          { backgroundColor: theme.border },
                        ]}
                      />
                    )}
                  </View>

                  {/* ================= ACTIVITY CARD ================= */}

                  <TouchableOpacity
                    activeOpacity={0.92}
                    style={[
                      styles.activityItemCard,
                      {
                        backgroundColor: theme.cardBgSecondary,
                        borderColor: theme.border,
                        borderLeftColor: activityColor,
                      },
                    ]}
                    onPress={() =>
                      setExpandedActivityId(
                        expandedActivityId === tx.id ? null : tx.id,
                      )
                    }
                  >
                    {/* ================= TOP ================= */}

                    <View style={styles.activityItemTop}>
                      <View style={styles.activityItemTitleWrap}>
                        <View style={styles.activityTitleRow}>
                          <Text
                            style={[
                              styles.activityItemTitle,
                              { color: theme.textPrimary },
                            ]}
                            numberOfLines={2}
                          >
                            {activityTitle}
                          </Text>

                          <View
                            style={[
                              styles.activityTypeBadge,
                              {
                                backgroundColor: transactionBg,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.activityTypeBadgeText,
                                {
                                  color: transactionColor,
                                },
                              ]}
                            >
                              {isExpense
                                ? "Expense"
                                : isTopUp
                                  ? "Top Up"
                                  : "Payment"}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.activityItemDescription,
                            { color: theme.textSecondary },
                          ]}
                          numberOfLines={2}
                        >
                          {isTopUp
                            ? activityDescription
                            : tx.notes || activityDescription}
                        </Text>

                        <View style={styles.activityMetaRow}>
                          <View style={styles.activityMetaItem}>
                            <MaterialCommunityIcons
                              name="calendar-outline"
                              size={14}
                              color={theme.textMuted}
                            />

                            <Text
                              style={[
                                styles.activityMetaText,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {formattedDate}
                            </Text>
                          </View>

                          {!!formattedTime && (
                            <View style={styles.activityMetaItem}>
                              <MaterialCommunityIcons
                                name="clock-outline"
                                size={14}
                                color={theme.textMuted}
                              />

                              <Text
                                style={[
                                  styles.activityMetaText,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                {formattedTime}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Amount */}

                      <View
                        style={[
                          styles.activityAmountWrap,
                          { borderTopColor: theme.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.activityAmount,
                            {
                              color: transactionColor,
                            },
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.7}
                        >
                          {isExpense ? "− " : "+ "}
                          <CurrencyText amount={amount} />
                        </Text>

                        <MaterialCommunityIcons
                          name={
                            expandedActivityId === tx.id
                              ? "chevron-up"
                              : "chevron-down"
                          }
                          size={20}
                          color={theme.textMuted}
                        />
                      </View>
                    </View>

                    {/* ================= EXPANDED DETAILS ================= */}

                    {expandedActivityId === tx.id && (
                      <View style={styles.expandedActivity}>
                        <View
                          style={[
                            styles.expandedDivider,
                            { backgroundColor: theme.border },
                          ]}
                        />

                        {/* Payment Breakdown */}

                        {isPayment && (
                          <View
                            style={[
                              styles.breakdownCard,
                              {
                                backgroundColor: theme.cardBg,
                                borderColor: theme.border,
                              },
                            ]}
                          >
                            <View style={styles.breakdownHeader}>
                              <MaterialCommunityIcons
                                name="chart-donut"
                                size={16}
                                color={theme.textSecondary}
                              />

                              <Text
                                style={[
                                  styles.breakdownHeaderText,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                Payment Breakdown
                              </Text>
                            </View>

                            <View style={styles.breakdownGrid}>
                              <View style={styles.breakdownItem}>
                                <Text
                                  style={[
                                    styles.breakdownLabel,
                                    { color: theme.textMuted },
                                  ]}
                                >
                                  Principal
                                </Text>

                                <Text
                                  style={[
                                    styles.breakdownValue,
                                    {
                                      color: "#2563EB",
                                    },
                                  ]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.7}
                                >
                                  <CurrencyText amount={principal} />
                                </Text>
                              </View>

                              <View
                                style={[
                                  styles.breakdownDivider,
                                  { backgroundColor: theme.border },
                                ]}
                              />

                              <View style={styles.breakdownItem}>
                                <Text
                                  style={[
                                    styles.breakdownLabel,
                                    { color: theme.textMuted },
                                  ]}
                                >
                                  Interest
                                </Text>

                                <Text
                                  style={[
                                    styles.breakdownValue,
                                    {
                                      color: "#EA580C",
                                    },
                                  ]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.7}
                                >
                                  <CurrencyText amount={interest} />
                                </Text>
                              </View>

                              <View
                                style={[
                                  styles.breakdownDivider,
                                  { backgroundColor: theme.border },
                                ]}
                              />

                              <View style={styles.breakdownItem}>
                                <Text
                                  style={[
                                    styles.breakdownLabel,
                                    { color: theme.textMuted },
                                  ]}
                                >
                                  Balance After
                                </Text>

                                <Text
                                  style={[
                                    styles.breakdownValue,
                                    {
                                      color: "#DC2626",
                                    },
                                  ]}
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  minimumFontScale={0.7}
                                >
                                  <CurrencyText amount={balance} />
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}

                        {/* Top Up Information */}

                        {isTopUp && (
                          <View
                            style={[
                              styles.topUpInfo,
                              {
                                backgroundColor: isDarkMode
                                  ? "rgba(124, 58, 237, 0.16)"
                                  : "#F5F3FF",
                              },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="information-outline"
                              size={17}
                              color="#7C3AED"
                            />

                            <Text
                              style={[
                                styles.topUpInfoText,
                                {
                                  color: isDarkMode ? "#DDD6FE" : "#6D28D9",
                                },
                              ]}
                            >
                              <CurrencyText amount={amount} /> was added to the
                              loan balance.
                            </Text>
                          </View>
                        )}

                        {/* Transaction Details */}

                        <View
                          style={[
                            styles.transactionDetails,
                            {
                              backgroundColor: theme.cardBg,
                              borderColor: theme.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.transactionDetailsTitle,
                              { color: theme.textSecondary },
                            ]}
                          >
                            Transaction Details
                          </Text>

                          <View style={styles.detailRow}>
                            <Text
                              style={[
                                styles.detailLabel,
                                { color: theme.textMuted },
                              ]}
                            >
                              Date & Time
                            </Text>

                            <Text
                              style={[
                                styles.detailValue,
                                { color: theme.textPrimary },
                              ]}
                            >
                              {formattedDate}
                              {formattedTime ? ` • ${formattedTime}` : ""}
                            </Text>
                          </View>

                          {!!tx.notes && (
                            <View style={styles.detailRow}>
                              <Text
                                style={[
                                  styles.detailLabel,
                                  { color: theme.textMuted },
                                ]}
                              >
                                Notes
                              </Text>

                              <Text
                                style={[
                                  styles.detailValue,
                                  { color: theme.textPrimary },
                                ]}
                                numberOfLines={4}
                              >
                                {tx.notes}
                              </Text>
                            </View>
                          )}

                          {!!tx.source_name && (
                            <View style={styles.detailRow}>
                              <Text
                                style={[
                                  styles.detailLabel,
                                  { color: theme.textMuted },
                                ]}
                              >
                                Payment Source
                              </Text>

                              <Text
                                style={[
                                  styles.detailValue,
                                  { color: theme.textPrimary },
                                ]}
                                numberOfLines={2}
                              >
                                {tx.source_name}
                              </Text>
                            </View>
                          )}

                          {!!tx.category_name && (
                            <View style={styles.detailRow}>
                              <Text
                                style={[
                                  styles.detailLabel,
                                  { color: theme.textMuted },
                                ]}
                              >
                                Category
                              </Text>

                              <Text
                                style={[
                                  styles.detailValue,
                                  { color: theme.textPrimary },
                                ]}
                                numberOfLines={2}
                              >
                                {tx.category_name}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Remove From Loan */}

                        <TouchableOpacity
                          activeOpacity={0.8}
                          disabled={unlinkingTxId === tx.id}
                          onPress={async (event) => {
                            event.stopPropagation?.();
                            setUnlinkingTxId(tx.id);
                            try {
                              await unlinkTransactionFromLoan(tx.id);

                              await loadLinkedTransactions();
                              await refresh();

                              if (expandedActivityId === tx.id) {
                                setExpandedActivityId(null);
                              }

                              setSnackbarMsg(
                                "Transaction removed from this loan.",
                              );
                            } catch (e) {
                              console.error(e);

                              setSnackbarMsg(
                                e?.message ||
                                "Unable to remove this transaction.",
                              );
                            } finally {
                              setUnlinkingTxId(null);
                            }

                            setSnackbarVisible(true);
                          }}
                          style={[
                            styles.unlinkButton,
                            {
                              backgroundColor: isDarkMode
                                ? "rgba(220, 38, 38, 0.14)"
                                : "#FEF2F2",
                              borderColor: isDarkMode
                                ? "rgba(220, 38, 38, 0.35)"
                                : "#FECACA",
                            },
                          ]}
                        >
                          {unlinkingTxId === tx.id ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <MaterialCommunityIcons
                              name="link-variant-off"
                              size={16}
                              color="#DC2626"
                            />
                          )}

                          <Text style={styles.unlinkButtonText}>
                            {unlinkingTxId === tx.id
                              ? "Removing..."
                              : "Remove from loan"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {/* ================= SNACKBAR ================= */}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: "OK",
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMsg}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // =====================================================================
  // Hero Summary Card
  // =====================================================================

  heroCard: {
    borderRadius: 24,
    overflow: "hidden",
  },
  heroBanner: {
    margin: -16,
    marginBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  directionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  directionPillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  typePill: {
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  typePillText: {
    color: "#E0E7FF",
    fontSize: 10,
    fontWeight: "700",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  heroSubtitle: {
    color: "#DCE8FF",
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
    alignSelf: "flex-start",
  },
  statusBadgeText: {
    fontWeight: "800",
    fontSize: 11,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 10,
  },
  balanceLabel: {
    color: "#DCE8FF",
    fontSize: 12,
    fontWeight: "600",
  },
  balanceValue: {
    color: "#FFFFFF",
    fontWeight: "900",
    marginTop: 3,
  },
  duePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  duePillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  repaymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  repaymentLabel: {
    fontWeight: "700",
    fontSize: 13,
  },
  repaymentPct: {
    fontWeight: "900",
    fontSize: 14,
  },
  repaymentTrack: {
    height: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  repaymentFill: {
    height: 10,
    borderRadius: 10,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    marginTop: 18,
    gap: 10,
  },
  metricTile: {
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 0,
  },
  metricTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  metricValue: {
    marginTop: 6,
    fontWeight: "900",
  },

  // =====================================================================
  // Responsive Quick Actions Card
  // =====================================================================

  actionsCard: {
    borderRadius: 22,
  },
  actionsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  actionsSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 12,
    gap: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  primaryActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryActionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  primaryActionSub: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  secondaryActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  actionTile: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 92,
  },
  actionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  actionTileLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 14,
  },

  // =====================================================================
  // Activity Card
  // =====================================================================

  activityCard: {
    borderRadius: 22,
    paddingBottom: 14,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  activityHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  activityHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  activityTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
  },
  activitySubtitle: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    paddingRight: 6,
  },
  activityCount: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 9,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  activityCountText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "900",
  },

  // =====================================================================
  // Empty
  // =====================================================================

  activityEmpty: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  activityEmptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  activityEmptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  activityEmptyText: {
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },

  // =====================================================================
  // Activity List
  // =====================================================================

  activityList: {
    marginTop: 2,
  },
  activityRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  activityRowLast: {
    marginBottom: 0,
  },

  // =====================================================================
  // Timeline
  // =====================================================================

  activityTimeline: {
    width: 40,
    alignItems: "center",
    marginRight: 8,
  },
  activityTimelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  activityTimelineLine: {
    width: 2,
    flex: 1,
    marginTop: 3,
  },

  // =====================================================================
  // Activity Card Item
  // =====================================================================

  activityItemCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  activityItemTop: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  activityItemTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  activityTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    gap: 6,
  },
  activityItemTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
  },
  activityItemDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },
  activityAmountWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  activityAmount: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    flexShrink: 1,
  },

  // =====================================================================
  // Meta
  // =====================================================================

  activityMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 9,
    gap: 7,
  },
  activityMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  activityMetaText: {
    fontSize: 11,
    fontWeight: "600",
  },
  activityTypeBadge: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
  },
  activityTypeBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },

  // =====================================================================
  // Breakdown
  // =====================================================================

  breakdownCard: {
    marginTop: 13,
    borderRadius: 14,
    padding: 11,
    borderWidth: 1,
  },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  breakdownHeaderText: {
    marginLeft: 6,
    fontSize: 11,
    fontWeight: "800",
  },
  breakdownGrid: {
    flexDirection: "row",
    alignItems: "center",
  },
  breakdownItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  breakdownLabel: {
    fontSize: 10,
    textAlign: "center",
  },
  breakdownValue: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    flexShrink: 1,
  },
  breakdownDivider: {
    width: 1,
    height: 30,
  },

  // =====================================================================
  // Top Up Info
  // =====================================================================

  topUpInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 13,
    padding: 10,
    borderRadius: 12,
  },
  topUpInfoText: {
    flex: 1,
    marginLeft: 7,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },

  // =====================================================================
  // Expanded Activity
  // =====================================================================

  expandedActivity: {
    marginTop: 2,
  },
  expandedDivider: {
    height: 1,
    marginTop: 14,
    marginBottom: 13,
  },

  // =====================================================================
  // Transaction Details
  // =====================================================================

  transactionDetails: {
    marginTop: 13,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  transactionDetailsTitle: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "column",
    alignItems: "flex-start",
    paddingVertical: 6,
  },
  detailLabel: {
    width: "100%",
    fontSize: 11,
    fontWeight: "700",
  },
  detailValue: {
    width: "100%",
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "left",
    lineHeight: 16,
  },

  // =====================================================================
  // Unlink
  // =====================================================================

  unlinkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 13,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  unlinkButtonText: {
    marginLeft: 6,
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "800",
  },
});
