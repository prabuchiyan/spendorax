import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Snackbar } from "react-native-paper";
import { getLoanById, unlinkTransactionFromLoan } from "../services/loans";
import { getTransactions } from "../services/transactions";
import events from "../services/events";
import Card from "../components/Card";
import calc from "../services/loanCalculations";
import { Colors } from "../components/Theme";

function ActionButton({ icon, title, color, bg, onPress, width = "31%" }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        width,
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        paddingVertical: 12,
        marginBottom: 12,
        alignItems: "center",
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: {
          width: 0,
          height: 2,
        },
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: bg || color + "20",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <MaterialCommunityIcons name={icon} size={22} color={color} />
      </View>

      <Text
        style={{
          marginTop: 10,
          fontSize: 11,
          fontWeight: "700",
          color: "#374151",
          textAlign: "center",
          paddingHorizontal: 4,
        }}
        numberOfLines={2}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function LoanDetailsScreen({ route, navigation }) {
  const { width: screenWidth } = useWindowDimensions();

  const isSmallPhone = screenWidth < 380;
  const isVerySmallPhone = screenWidth < 340;

  const horizontalPadding = isSmallPhone ? 8 : 12;
  const actionWidth = "31%";

  const id = route?.params?.id;

  const [loan, setLoan] = useState(null);
  const [linkedTxs, setLinkedTxs] = useState([]);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [expandedActivityId, setExpandedActivityId] = useState(null);

  useEffect(() => {
    (async () => {
      if (!id) return;

      try {
        const l = await getLoanById(id);
        setLoan(l);
      } catch (error) {
        console.error("Failed to load loan:", error);
      }
    })();
  }, [id]);

  useEffect(() => {
    loadLinkedTransactions();

    const offTx = events.on("transactionsChanged", (payload) => {
      if (
        payload?.action === "recalculate" ||
        payload?.action === "unlink"
      ) {
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

      const linked = txs.filter(
        (t) => Number(t.loan_id) === Number(id)
      );

      linked.sort(
        (a, b) =>
          new Date(b.date).getTime() -
          new Date(a.date).getTime()
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
      setLoan(l);
    } catch (error) {
      console.error("Failed to refresh loan:", error);
    }
  }

  if (!loan) return null;

  const originalPrincipal = Number(
    loan.principal_amount || 0
  );

  const paidSoFar = Number(
    loan.total_paid || 0
  );

  const remainingAmount = Number(
    loan.outstanding_amount || 0
  );

  const remainingMonths =
    Number(loan.remaining_months || 0) === Infinity
      ? 0
      : Number(loan.remaining_months || 0);

  const interestToPay =
    remainingAmount > 0 &&
      remainingMonths > 0 &&
      loan.emi_amount > 0
      ? calc
        .generateAmortizationSchedule(
          remainingAmount,
          loan.interest_rate,
          remainingMonths
        )
        .reduce(
          (sum, item) =>
            sum + Number(item.interest || 0),
          0
        )
      : 0;

  const repaymentPercentage =
    originalPrincipal > 0
      ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((originalPrincipal -
              remainingAmount) /
              originalPrincipal) *
            100
          )
        )
      )
      : 0;

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: Colors.background,
      }}
      contentContainerStyle={{
        paddingHorizontal: horizontalPadding,
        paddingTop: 10,
        paddingBottom: 30,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ================================================================ */}
      {/* LOAN SUMMARY CARD                                                */}
      {/* ================================================================ */}

      <Card
        style={{
          borderRadius: 24,
          overflow: "hidden",
        }}
      >
        {/* ================= HEADER ================= */}

        <View
          style={{
            backgroundColor: "#2563EB",
            margin: -16,
            marginBottom: 18,
            padding: isSmallPhone ? 16 : 20,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          <View
            style={{
              flexDirection: isSmallPhone ? "column" : "row",
              justifyContent: "space-between",
              alignItems: isSmallPhone
                ? "stretch"
                : "center",
            }}
          >
            <View
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: isSmallPhone ? 19 : 22,
                  lineHeight: isSmallPhone ? 24 : 28,
                  fontWeight: "900",
                  paddingRight: isSmallPhone ? 0 : 8,
                }}
                numberOfLines={3}
              >
                {loan.loan_name}
              </Text>

              {!!loan.lender && (
                <Text
                  style={{
                    color: "#DCE8FF",
                    marginTop: 4,
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                  numberOfLines={2}
                >
                  {loan.lender}
                </Text>
              )}
            </View>

            <View
              style={{
                backgroundColor:
                  loan.status === "Closed"
                    ? "#DCFCE7"
                    : "#DBEAFE",
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 30,
                alignSelf: isSmallPhone
                  ? "flex-start"
                  : "auto",
                marginTop: isSmallPhone ? 10 : 0,
              }}
            >
              <Text
                style={{
                  color:
                    loan.status === "Closed"
                      ? "#16A34A"
                      : "#2563EB",
                  fontWeight: "800",
                  fontSize: 12,
                }}
              >
                {loan.status || "Active"}
              </Text>
            </View>
          </View>

          <View
            style={{
              marginTop: isSmallPhone ? 20 : 24,
            }}
          >
            <Text
              style={{
                color: "#DCE8FF",
                fontSize: 12,
              }}
            >
              Outstanding Balance
            </Text>

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: isVerySmallPhone
                  ? 28
                  : isSmallPhone
                    ? 31
                    : 34,
                lineHeight: isVerySmallPhone
                  ? 34
                  : isSmallPhone
                    ? 38
                    : 42,
                fontWeight: "900",
                marginTop: 4,
              }}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={1}
            >
              ₹{remainingAmount.toLocaleString("en-IN")}
            </Text>
          </View>
        </View>

        {/* ================= REPAYMENT ================= */}

        <View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontWeight: "700",
                color: "#374151",
                fontSize: 13,
              }}
            >
              Loan Repayment
            </Text>

            <Text
              style={{
                fontWeight: "900",
                color: "#16A34A",
                fontSize: 13,
              }}
            >
              {repaymentPercentage}%
            </Text>
          </View>

          <View
            style={{
              height: 10,
              backgroundColor: "#E5E7EB",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${repaymentPercentage}%`,
                height: 10,
                backgroundColor: "#22C55E",
                borderRadius: 10,
              }}
            />
          </View>
        </View>

        {/* ================= METRICS ================= */}

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            marginTop: 22,
          }}
        >
          {[
            {
              label: "Original",
              value: `₹${originalPrincipal.toLocaleString(
                "en-IN"
              )}`,
            },
            {
              label: "Paid",
              value: `₹${paidSoFar.toLocaleString(
                "en-IN"
              )}`,
            },
            {
              label: "EMI",
              value: `₹${Number(
                loan.emi_amount || 0
              ).toLocaleString("en-IN")}`,
            },
            {
              label: "Interest",
              value: `${loan.interest_rate || 0}%`,
            },
            {
              label: "Remaining",
              value: remainingMonths,
            },
            {
              label: "Interest Left",
              value: `₹${interestToPay.toLocaleString(
                "en-IN"
              )}`,
            },
          ].map((item, index) => (
            <View
              key={index}
              style={{
                width: isVerySmallPhone
                  ? "100%"
                  : "48%",
                backgroundColor: "#F8FAFC",
                padding: isSmallPhone ? 12 : 14,
                borderRadius: 16,
                marginBottom: 12,
                minWidth: 0,
              }}
            >
              <Text
                style={{
                  color: "#64748B",
                  fontSize: 11,
                }}
                numberOfLines={1}
              >
                {item.label}
              </Text>

              <Text
                style={{
                  marginTop: 6,
                  fontSize: isSmallPhone ? 16 : 18,
                  lineHeight: isSmallPhone ? 20 : 22,
                  fontWeight: "900",
                  color: "#111827",
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {item.value}
              </Text>
            </View>
          ))}
        </View>

        {/* ================= ACTIONS ================= */}

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "flex-start",
            marginTop: 8,
          }}
        >
          {(loan.loan_direction || "BORROWED") ===
            "LENT" ? (
            <>
              <ActionButton
                width={actionWidth}
                color="#16A34A"
                bg="#DCFCE7"
                icon="cash-plus"
                title="Receive Payment"
                onPress={() =>
                  navigation.navigate(
                    "LoanPayment",
                    {
                      id: loan.id,
                      mode: "receive",
                    }
                  )
                }
              />

              <ActionButton
                width={actionWidth}
                color="#7C3AED"
                bg="#EDE9FE"
                icon="hand-coin-outline"
                title="Lend More"
                onPress={() =>
                  navigation.navigate(
                    "LendMore",
                    {
                      id: loan.id,
                    }
                  )
                }
              />

              <ActionButton
                width={actionWidth}
                color="#7C3AED"
                bg="#EDE9FE"
                icon="history"
                title="History"
                onPress={() =>
                  navigation.navigate(
                    "LoanHistory",
                    {
                      id: loan.id,
                    }
                  )
                }
              />

              <ActionButton
                width={actionWidth}
                color="#64748B"
                bg="#E2E8F0"
                icon="file-chart"
                title="Reports"
                onPress={() =>
                  navigation.navigate(
                    "LoanReports"
                  )
                }
              />

              <ActionButton
                width={actionWidth}
                color="#0F766E"
                bg="#CCFBF1"
                icon="pencil"
                title="Edit"
                onPress={() =>
                  navigation.navigate(
                    "LoanForm",
                    {
                      id: loan.id,
                    }
                  )
                }
              />
            </>
          ) : (
            <>
              <ActionButton
                width={actionWidth}
                color="#2563EB"
                bg="#DBEAFE"
                icon="cash-fast"
                title="Pay EMI"
                onPress={() =>
                  navigation.navigate(
                    "LoanPayment",
                    {
                      id: loan.id,
                    }
                  )
                }
              />

              <ActionButton
                width={actionWidth}
                color="#2563EB"
                bg="#DBEAFE"
                icon="cash-plus"
                title="Top Up"
                onPress={() =>
                  navigation.navigate(
                    "TopUp",
                    {
                      id: loan.id,
                      loanName: loan.loan_name,
                    }
                  )
                }
              />

              <ActionButton
                width={actionWidth}
                color="#EA580C"
                bg="#FED7AA"
                icon="trending-up"
                title="Prepay"
                onPress={() =>
                  navigation.navigate(
                    "LoanPayment",
                    {
                      id: loan.id,
                      mode: "prepayment",
                    }
                  )
                }
              />

              <ActionButton
                width={actionWidth}
                color="#DC2626"
                bg="#FEE2E2"
                icon="bank-remove"
                title="Close"
                onPress={() =>
                  navigation.navigate(
                    "LoanForeclose",
                    {
                      id: loan.id,
                    }
                  )
                }
              />

              <ActionButton
                width={actionWidth}
                color="#7C3AED"
                bg="#EDE9FE"
                icon="history"
                title="History"
                onPress={() =>
                  navigation.navigate(
                    "LoanHistory",
                    {
                      id: loan.id,
                    }
                  )
                }
              />

              <ActionButton
                width={actionWidth}
                color="#64748B"
                bg="#E2E8F0"
                icon="file-chart"
                title="Reports"
                onPress={() =>
                  navigation.navigate(
                    "LoanReports"
                  )
                }
              />

              <ActionButton
                width={actionWidth}
                color="#0F766E"
                bg="#CCFBF1"
                icon="pencil"
                title="Edit"
                onPress={() =>
                  navigation.navigate(
                    "LoanForm",
                    {
                      id: loan.id,
                    }
                  )
                }
              />
            </>
          )}
        </View>
      </Card>

      {/* ================================================================ */}
      {/* LOAN ACTIVITY                                                    */}
      {/* ================================================================ */}

      <View style={{ height: 12 }} />

      <Card style={styles.activityCard}>
        {/* ================= SECTION HEADER ================= */}

        <View style={styles.activityHeader}>
          <View style={styles.activityHeaderLeft}>
            <View style={styles.activityHeaderIcon}>
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
              <Text style={styles.activityTitle}>
                Loan Activity
              </Text>

              <Text
                style={styles.activitySubtitle}
                numberOfLines={2}
              >
                Payments and top-ups recorded for this
                loan
              </Text>
            </View>
          </View>

          <View style={styles.activityCount}>
            <Text style={styles.activityCountText}>
              {linkedTxs.length}
            </Text>
          </View>
        </View>

        {/* ================= EMPTY STATE ================= */}

        {linkedTxs.length === 0 ? (
          <View style={styles.activityEmpty}>
            <View style={styles.activityEmptyIcon}>
              <MaterialCommunityIcons
                name="timeline-outline"
                size={34}
                color="#94A3B8"
              />
            </View>

            <Text style={styles.activityEmptyTitle}>
              No loan activity yet
            </Text>

            <Text style={styles.activityEmptyText}>
              Payments and additional borrowing will
              appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.activityList}>
            {linkedTxs.map((tx, index) => {
              const amount = Number(
                tx.amount || 0
              );

              const principal = Number(
                tx.principal_component || 0
              );

              const interest = Number(
                tx.interest_component || 0
              );

              const balance = Number(
                tx.outstanding_after_payment ??
                loan.outstanding_amount ??
                0
              );

              const note = String(
                tx.notes || ""
              ).toLowerCase();

              const isTopUp =
                note.includes("top up") ||
                note.includes("topup") ||
                note.includes(
                  "additional borrowing"
                ) ||
                note.includes("borrowed");

              const isPayment = !isTopUp;

              const transactionType = String(
                tx.type ||
                tx.transaction_type ||
                tx.direction ||
                ""
              ).toLowerCase();

              const isExpense =
                transactionType === "expense" ||
                transactionType === "debit" ||
                transactionType ===
                "debit_expense";

              const activityTitle = isTopUp
                ? "Loan Top Up"
                : "Loan Payment";

              const activityDescription = isTopUp
                ? "Additional amount added to this loan"
                : "Payment made towards this loan";

              const activityIcon = isTopUp
                ? "cash-plus"
                : "cash-check";

              const activityColor = isTopUp
                ? "#7C3AED"
                : "#16A34A";

              const activityBg = isTopUp
                ? "#EDE9FE"
                : "#DCFCE7";

              const transactionColor = isExpense
                ? "#DC2626"
                : activityColor;

              const transactionBg = isExpense
                ? "#FEE2E2"
                : activityBg;

              const transactionDate =
                new Date(tx.date);

              const formattedDate =
                Number.isNaN(
                  transactionDate.getTime()
                )
                  ? "Date unavailable"
                  : transactionDate.toLocaleDateString(
                    "en-IN",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }
                  );

              const formattedTime =
                Number.isNaN(
                  transactionDate.getTime()
                )
                  ? ""
                  : transactionDate.toLocaleTimeString(
                    "en-IN",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  );

              return (
                <View
                  key={tx.id}
                  style={[
                    styles.activityRow,
                    index ===
                    linkedTxs.length - 1 &&
                    styles.activityRowLast,
                  ]}
                >
                  {/* ================= TIMELINE ================= */}

                  <View style={styles.activityTimeline}>
                    <View
                      style={[
                        styles.activityTimelineIcon,
                        {
                          backgroundColor:
                            transactionBg,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          isExpense
                            ? "cash-minus"
                            : activityIcon
                        }
                        size={20}
                        color={
                          transactionColor
                        }
                      />
                    </View>

                    {index !==
                      linkedTxs.length - 1 && (
                        <View
                          style={
                            styles.activityTimelineLine
                          }
                        />
                      )}
                  </View>

                  {/* ================= ACTIVITY CARD ================= */}

                  <TouchableOpacity
                    activeOpacity={0.92}
                    style={[
                      styles.activityItemCard,
                      {
                        borderLeftColor:
                          activityColor,
                      },
                    ]}
                    onPress={() =>
                      setExpandedActivityId(
                        expandedActivityId ===
                          tx.id
                          ? null
                          : tx.id
                      )
                    }
                  >
                    {/* ================= TOP ================= */}

                    <View
                      style={
                        styles.activityItemTop
                      }
                    >
                      <View
                        style={
                          styles.activityItemTitleWrap
                        }
                      >
                        <View
                          style={
                            styles.activityTitleRow
                          }
                        >
                          <Text
                            style={
                              styles.activityItemTitle
                            }
                            numberOfLines={2}
                          >
                            {activityTitle}
                          </Text>

                          <View
                            style={[
                              styles.activityTypeBadge,
                              {
                                backgroundColor:
                                  transactionBg,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.activityTypeBadgeText,
                                {
                                  color:
                                    transactionColor,
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
                          style={
                            styles.activityItemDescription
                          }
                          numberOfLines={2}
                        >
                          {isTopUp
                            ? activityDescription
                            : tx.notes ||
                            activityDescription}
                        </Text>

                        <View
                          style={
                            styles.activityMetaRow
                          }
                        >
                          <View
                            style={
                              styles.activityMetaItem
                            }
                          >
                            <MaterialCommunityIcons
                              name="calendar-outline"
                              size={14}
                              color="#64748B"
                            />

                            <Text
                              style={
                                styles.activityMetaText
                              }
                            >
                              {formattedDate}
                            </Text>
                          </View>

                          {!!formattedTime && (
                            <View
                              style={
                                styles.activityMetaItem
                              }
                            >
                              <MaterialCommunityIcons
                                name="clock-outline"
                                size={14}
                                color="#64748B"
                              />

                              <Text
                                style={
                                  styles.activityMetaText
                                }
                              >
                                {formattedTime}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Amount */}

                      <View
                        style={
                          styles.activityAmountWrap
                        }
                      >
                        <Text
                          style={[
                            styles.activityAmount,
                            {
                              color:
                                transactionColor,
                            },
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.7}
                        >
                          {isExpense
                            ? "− "
                            : "+ "}
                          ₹
                          {amount.toLocaleString(
                            "en-IN"
                          )}
                        </Text>

                        <MaterialCommunityIcons
                          name={
                            expandedActivityId ===
                              tx.id
                              ? "chevron-up"
                              : "chevron-down"
                          }
                          size={20}
                          color="#94A3B8"
                        />
                      </View>
                    </View>

                    {/* ================= EXPANDED DETAILS ================= */}

                    {expandedActivityId ===
                      tx.id && (
                        <View
                          style={
                            styles.expandedActivity
                          }
                        >
                          <View
                            style={
                              styles.expandedDivider
                            }
                          />

                          {/* Payment Breakdown */}

                          {isPayment && (
                            <View
                              style={
                                styles.breakdownCard
                              }
                            >
                              <View
                                style={
                                  styles.breakdownHeader
                                }
                              >
                                <MaterialCommunityIcons
                                  name="chart-donut"
                                  size={16}
                                  color="#64748B"
                                />

                                <Text
                                  style={
                                    styles.breakdownHeaderText
                                  }
                                >
                                  Payment Breakdown
                                </Text>
                              </View>

                              <View
                                style={
                                  styles.breakdownGrid
                                }
                              >
                                <View
                                  style={
                                    styles.breakdownItem
                                  }
                                >
                                  <Text
                                    style={
                                      styles.breakdownLabel
                                    }
                                  >
                                    Principal
                                  </Text>

                                  <Text
                                    style={[
                                      styles.breakdownValue,
                                      {
                                        color:
                                          "#2563EB",
                                      },
                                    ]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={
                                      0.7
                                    }
                                  >
                                    ₹
                                    {principal.toLocaleString(
                                      "en-IN"
                                    )}
                                  </Text>
                                </View>

                                <View
                                  style={
                                    styles.breakdownDivider
                                  }
                                />

                                <View
                                  style={
                                    styles.breakdownItem
                                  }
                                >
                                  <Text
                                    style={
                                      styles.breakdownLabel
                                    }
                                  >
                                    Interest
                                  </Text>

                                  <Text
                                    style={[
                                      styles.breakdownValue,
                                      {
                                        color:
                                          "#EA580C",
                                      },
                                    ]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={
                                      0.7
                                    }
                                  >
                                    ₹
                                    {interest.toLocaleString(
                                      "en-IN"
                                    )}
                                  </Text>
                                </View>

                                <View
                                  style={
                                    styles.breakdownDivider
                                  }
                                />

                                <View
                                  style={
                                    styles.breakdownItem
                                  }
                                >
                                  <Text
                                    style={
                                      styles.breakdownLabel
                                    }
                                  >
                                    Balance After
                                  </Text>

                                  <Text
                                    style={[
                                      styles.breakdownValue,
                                      {
                                        color:
                                          "#DC2626",
                                      },
                                    ]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={
                                      0.7
                                    }
                                  >
                                    ₹
                                    {balance.toLocaleString(
                                      "en-IN"
                                    )}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          )}

                          {/* Top Up Information */}

                          {isTopUp && (
                            <View
                              style={
                                styles.topUpInfo
                              }
                            >
                              <MaterialCommunityIcons
                                name="information-outline"
                                size={17}
                                color="#7C3AED"
                              />

                              <Text
                                style={
                                  styles.topUpInfoText
                                }
                              >
                                ₹
                                {amount.toLocaleString(
                                  "en-IN"
                                )}{" "}
                                was added to the loan
                                balance.
                              </Text>
                            </View>
                          )}

                          {/* Transaction Details */}

                          <View
                            style={
                              styles.transactionDetails
                            }
                          >
                            <Text
                              style={
                                styles.transactionDetailsTitle
                              }
                            >
                              Transaction Details
                            </Text>

                            <View
                              style={
                                styles.detailRow
                              }
                            >
                              <Text
                                style={
                                  styles.detailLabel
                                }
                              >
                                Date & Time
                              </Text>

                              <Text
                                style={
                                  styles.detailValue
                                }
                              >
                                {formattedDate}
                                {formattedTime
                                  ? ` • ${formattedTime}`
                                  : ""}
                              </Text>
                            </View>

                            {!!tx.notes && (
                              <View
                                style={
                                  styles.detailRow
                                }
                              >
                                <Text
                                  style={
                                    styles.detailLabel
                                  }
                                >
                                  Notes
                                </Text>

                                <Text
                                  style={
                                    styles.detailValue
                                  }
                                  numberOfLines={4}
                                >
                                  {tx.notes}
                                </Text>
                              </View>
                            )}

                            {!!tx.source_name && (
                              <View
                                style={
                                  styles.detailRow
                                }
                              >
                                <Text
                                  style={
                                    styles.detailLabel
                                  }
                                >
                                  Payment Source
                                </Text>

                                <Text
                                  style={
                                    styles.detailValue
                                  }
                                  numberOfLines={2}
                                >
                                  {tx.source_name}
                                </Text>
                              </View>
                            )}

                            {!!tx.category_name && (
                              <View
                                style={
                                  styles.detailRow
                                }
                              >
                                <Text
                                  style={
                                    styles.detailLabel
                                  }
                                >
                                  Category
                                </Text>

                                <Text
                                  style={
                                    styles.detailValue
                                  }
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
                            onPress={async (event) => {
                              event.stopPropagation?.();

                              try {
                                await unlinkTransactionFromLoan(
                                  tx.id
                                );

                                await loadLinkedTransactions();
                                await refresh();

                                if (
                                  expandedActivityId ===
                                  tx.id
                                ) {
                                  setExpandedActivityId(
                                    null
                                  );
                                }

                                setSnackbarMsg(
                                  "Transaction removed from this loan."
                                );
                              } catch (e) {
                                console.error(e);

                                setSnackbarMsg(
                                  e?.message ||
                                  "Unable to remove this transaction."
                                );
                              }

                              setSnackbarVisible(
                                true
                              );
                            }}
                            style={
                              styles.unlinkButton
                            }
                          >
                            <MaterialCommunityIcons
                              name="link-variant-off"
                              size={16}
                              color="#DC2626"
                            />

                            <Text
                              style={
                                styles.unlinkButtonText
                              }
                            >
                              Remove from loan
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
        onDismiss={() =>
          setSnackbarVisible(false)
        }
        duration={3000}
        action={{
          label: "OK",
          onPress: () =>
            setSnackbarVisible(false),
        }}
      >
        {snackbarMsg}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // =====================================================================
  // Activity Card
  // =====================================================================

  activityCard: {
    borderRadius: 20,
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
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  activityTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
    color: "#111827",
  },

  activitySubtitle: {
    marginTop: 3,
    color: "#64748B",
    fontSize: 11,
    lineHeight: 16,
    paddingRight: 6,
  },

  activityCount: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 9,
    borderRadius: 17,
    backgroundColor: "#EEF2FF",
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
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },

  activityEmptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
    textAlign: "center",
  },

  activityEmptyText: {
    marginTop: 6,
    color: "#64748B",
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
    backgroundColor: "#E2E8F0",
    marginTop: 3,
  },

  // =====================================================================
  // Activity Card
  // =====================================================================

  activityItemCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
    borderLeftWidth: 3,
  },

  activityItemTop: {
    flexDirection: "column",
    alignItems: "stretch",
  },

  activityItemTitleWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 0,
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
    color: "#111827",
  },

  activityItemDescription: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 12,
    lineHeight: 17,
  },

  activityAmountWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 0,
    marginTop: 9,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
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
    color: "#64748B",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 11,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
    color: "#64748B",
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
    color: "#94A3B8",
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
    backgroundColor: "#E2E8F0",
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
    backgroundColor: "#F5F3FF",
  },

  topUpInfoText: {
    flex: 1,
    marginLeft: 7,
    color: "#6D28D9",
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
    backgroundColor: "#E2E8F0",
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  transactionDetailsTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#475569",
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
    color: "#94A3B8",
    fontWeight: "700",
  },

  detailValue: {
    width: "100%",
    marginTop: 3,
    fontSize: 11,
    color: "#334155",
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
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  unlinkButtonText: {
    marginLeft: 6,
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "800",
  },
});