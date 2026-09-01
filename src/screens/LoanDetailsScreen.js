import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Snackbar } from "react-native-paper";
import { getLoanById, unlinkTransactionFromLoan } from "../services/loans";
import { getTransactions } from "../services/transactions";
import events from "../services/events";
import Card from "../components/Card";
import calc from "../services/loanCalculations";
import { Colors } from "../components/Theme";
import LendMoreSheet from "../components/LendMoreSheet";
import TopUpSheet from "../components/TopUpSheet";

function ActionButton({ icon, title, color, bg, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        width: "31%",
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
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function Metric({ label, value, color }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text
        style={{
          fontSize: 11,
          color: "#64748B",
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          marginTop: 4,
          color,
          fontWeight: "800",
          fontSize: 13,
        }}
      >
        ₹{Number(value || 0).toLocaleString("en-IN")}
      </Text>
    </View>
  );
}

export default function LoanDetailsScreen({ route, navigation }) {
  const id = route?.params?.id;
  const [loan, setLoan] = useState(null);
  const [linkedTxs, setLinkedTxs] = useState([]);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [showLendMore, setShowLendMore] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const l = await getLoanById(id);
      setLoan(l);
    })();
  }, [id]);

  useEffect(() => {
    loadLinkedTransactions();
    const offTx = events.on("transactionsChanged", () =>
      loadLinkedTransactions(),
    );
    const offLoans = events.on("loansChanged", () => {
      refresh();
      loadLinkedTransactions();
    });
    return () => {
      offTx && offTx();
      offLoans && offLoans();
    };
  }, [id]);

  async function loadLinkedTransactions() {
    if (!id) return setLinkedTxs([]);
    const txs = await getTransactions(1000000, "Yes");
    const linked = txs.filter((t) => Number(t.loan_id) === Number(id));
    // sort desc by date
    linked.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    setLinkedTxs(linked);
  }

  async function refresh() {
    const l = await getLoanById(id);
    setLoan(l);
  }

  if (!loan) return null;

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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background, padding: 12 }}
    >
      <Card style={{ borderRadius: 24, overflow: "hidden" }}>
        {/* ================= HEADER ================= */}

        <View
          style={{
            backgroundColor: "#2563EB",
            margin: -16,
            marginBottom: 18,
            padding: 20,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 22,
                  fontWeight: "900",
                }}
              >
                {loan.loan_name}
              </Text>

              <Text
                style={{
                  color: "#DCE8FF",
                  marginTop: 4,
                  fontSize: 14,
                }}
              >
                {loan.lender}
              </Text>
            </View>

            <View
              style={{
                backgroundColor:
                  loan.status === "Closed" ? "#DCFCE7" : "#DBEAFE",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 30,
              }}
            >
              <Text
                style={{
                  color: loan.status === "Closed" ? "#16A34A" : "#2563EB",
                  fontWeight: "800",
                }}
              >
                {loan.status || "Active"}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 24 }}>
            <Text
              style={{
                color: "#DCE8FF",
                fontSize: 13,
              }}
            >
              Outstanding Balance
            </Text>

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 34,
                fontWeight: "900",
                marginTop: 4,
              }}
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
              marginBottom: 8,
            }}
          >
            <Text
              style={{
                fontWeight: "700",
                color: "#374151",
              }}
            >
              Loan Repayment
            </Text>

            <Text
              style={{
                fontWeight: "900",
                color: "#16A34A",
              }}
            >
              {originalPrincipal > 0
                ? Math.round(
                    ((originalPrincipal - remainingAmount) /
                      originalPrincipal) *
                      100,
                  )
                : 0}
              %
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
                width: `${
                  originalPrincipal > 0
                    ? Math.round(
                        ((originalPrincipal - remainingAmount) /
                          originalPrincipal) *
                          100,
                      )
                    : 0
                }%`,
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
              value: `₹${originalPrincipal.toLocaleString("en-IN")}`,
            },
            {
              label: "Paid",
              value: `₹${paidSoFar.toLocaleString("en-IN")}`,
            },
            {
              label: "EMI",
              value: `₹${Number(loan.emi_amount || 0).toLocaleString("en-IN")}`,
            },
            {
              label: "Interest",
              value: `${loan.interest_rate}%`,
            },
            {
              label: "Remaining",
              value: remainingMonths,
            },
            {
              label: "Interest Left",
              value: `₹${interestToPay.toLocaleString("en-IN")}`,
            },
          ].map((item, index) => (
            <View
              key={index}
              style={{
                width: "48%",
                backgroundColor: "#F8FAFC",
                padding: 14,
                borderRadius: 16,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  color: "#64748B",
                  fontSize: 12,
                }}
              >
                {item.label}
              </Text>

              <Text
                style={{
                  marginTop: 6,
                  fontSize: 18,
                  fontWeight: "900",
                  color: "#111827",
                }}
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
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          {(loan.loan_direction || "BORROWED") === "LENT" ? (
            <>
              <ActionButton
                color="#16A34A"
                bg="#DCFCE7"
                icon="cash-plus"
                title="Receive Payment"
                onPress={() =>
                  navigation.navigate("LoanPayment", {
                    id: loan.id,
                  })
                }
              />

              <ActionButton
                color="#7C3AED"
                bg="#EDE9FE"
                icon="hand-coin-outline"
                title="Lend More"
                onPress={() => navigation.navigate("LendMore", { id: loan.id })}
              />

              <ActionButton
                color="#7C3AED"
                bg="#EDE9FE"
                icon="history"
                title="History"
                onPress={() =>
                  navigation.navigate("LoanHistory", {
                    id: loan.id,
                  })
                }
              />

              <ActionButton
                color="#64748B"
                bg="#E2E8F0"
                icon="file-chart"
                title="Reports"
                onPress={() => navigation.navigate("LoanReports")}
              />

              <ActionButton
                color="#0F766E"
                bg="#CCFBF1"
                icon="pencil"
                title="Edit"
                onPress={() =>
                  navigation.navigate("LoanForm", {
                    id: loan.id,
                  })
                }
              />
            </>
          ) : (
            <>
              <ActionButton
                color="#2563EB"
                bg="#DBEAFE"
                icon="cash-fast"
                title="Pay EMI"
                onPress={() =>
                  navigation.navigate("LoanPayment", {
                    id: loan.id,
                  })
                }
              />

              <ActionButton
                color="#2563EB"
                bg="#DBEAFE"
                icon="cash-plus"
                title="Top Up"
                onPress={() =>
                  navigation.navigate("TopUp", {
                    id: loan.id,
                    loanName: loan.loan_name,
                  })
                }
              />

              <ActionButton
                color="#EA580C"
                bg="#FED7AA"
                icon="trending-up"
                title="Prepay"
                onPress={() =>
                  navigation.navigate("LoanPayment", {
                    id: loan.id,
                    mode: "prepayment",
                  })
                }
              />

              <ActionButton
                color="#DC2626"
                bg="#FEE2E2"
                icon="bank-remove"
                title="Close"
                onPress={() =>
                  navigation.navigate("LoanForeclose", {
                    id: loan.id,
                  })
                }
              />

              <ActionButton
                color="#7C3AED"
                bg="#EDE9FE"
                icon="history"
                title="History"
                onPress={() =>
                  navigation.navigate("LoanHistory", {
                    id: loan.id,
                  })
                }
              />

              <ActionButton
                color="#64748B"
                bg="#E2E8F0"
                icon="file-chart"
                title="Reports"
                onPress={() => navigation.navigate("LoanReports")}
              />

              <ActionButton
                color="#0F766E"
                bg="#CCFBF1"
                icon="pencil"
                title="Edit"
                onPress={() =>
                  navigation.navigate("LoanForm", {
                    id: loan.id,
                  })
                }
              />
            </>
          )}
        </View>
      </Card>

      {/* ===================================================================== */}
      {/* LOAN ACTIVITY                                                         */}
      {/* ===================================================================== */}

      <View style={{ height: 12 }} />

      <Card style={styles.activityCard}>
        {/* ------------------------------------------------------------------- */}
        {/* Section Header                                                      */}
        {/* ------------------------------------------------------------------- */}

        <View style={styles.activityHeader}>
          <View style={styles.activityHeaderLeft}>
            <View style={styles.activityHeaderIcon}>
              <MaterialCommunityIcons
                name="timeline-clock-outline"
                size={22}
                color="#2563EB"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.activityTitle}>Loan Activity</Text>

              <Text style={styles.activitySubtitle}>
                Payments and top-ups recorded for this loan
              </Text>
            </View>
          </View>

          <View style={styles.activityCount}>
            <Text style={styles.activityCountText}>{linkedTxs.length}</Text>
          </View>
        </View>

        {/* ------------------------------------------------------------------- */}
        {/* Empty State                                                          */}
        {/* ------------------------------------------------------------------- */}

        {linkedTxs.length === 0 ? (
          <View style={styles.activityEmpty}>
            <View style={styles.activityEmptyIcon}>
              <MaterialCommunityIcons
                name="timeline-outline"
                size={34}
                color="#94A3B8"
              />
            </View>

            <Text style={styles.activityEmptyTitle}>No loan activity yet</Text>

            <Text style={styles.activityEmptyText}>
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

              const note = String(tx.notes || "").toLowerCase();

              /*
               * Detect whether this is a top-up /
               * additional borrowing transaction.
               */
              const isTopUp =
                note.includes("top up") ||
                note.includes("topup") ||
                note.includes("additional borrowing") ||
                note.includes("borrowed");

              const isPayment = !isTopUp;

              const activityTitle = isTopUp ? "Loan Top Up" : "Loan Payment";

              const activityDescription = isTopUp
                ? "Additional amount added to this loan"
                : "Payment made towards this loan";

              const activityIcon = isTopUp ? "cash-plus" : "cash-check";

              const activityColor = isTopUp ? "#7C3AED" : "#16A34A";

              const activityBg = isTopUp ? "#EDE9FE" : "#DCFCE7";

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
                  {/* --------------------------------------------------------- */}
                  {/* Timeline                                                   */}
                  {/* --------------------------------------------------------- */}

                  <View style={styles.activityTimeline}>
                    <View
                      style={[
                        styles.activityTimelineIcon,
                        {
                          backgroundColor: activityBg,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={activityIcon}
                        size={20}
                        color={activityColor}
                      />
                    </View>

                    {index !== linkedTxs.length - 1 && (
                      <View style={styles.activityTimelineLine} />
                    )}
                  </View>

                  {/* --------------------------------------------------------- */}
                  {/* Activity Card                                              */}
                  {/* --------------------------------------------------------- */}

                  <View
                    style={[
                      styles.activityItemCard,
                      {
                        borderLeftColor: activityColor,
                      },
                    ]}
                  >
                    {/* ------------------------------------------------------- */}
                    {/* Top Row                                                   */}
                    {/* ------------------------------------------------------- */}

                    <View style={styles.activityItemTop}>
                      <View style={styles.activityItemTitleWrap}>
                        <Text
                          style={styles.activityItemTitle}
                          numberOfLines={1}
                        >
                          {activityTitle}
                        </Text>

                        <Text
                          style={styles.activityItemDescription}
                          numberOfLines={2}
                        >
                          {isTopUp
                            ? activityDescription
                            : tx.notes || activityDescription}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.activityAmount,
                          {
                            color: activityColor,
                          },
                        ]}
                      >
                        ₹{amount.toLocaleString("en-IN")}
                      </Text>
                    </View>

                    {/* ------------------------------------------------------- */}
                    {/* Date / Type                                               */}
                    {/* ------------------------------------------------------- */}

                    <View style={styles.activityMetaRow}>
                      <View style={styles.activityMetaItem}>
                        <MaterialCommunityIcons
                          name="calendar-outline"
                          size={15}
                          color="#64748B"
                        />

                        <Text style={styles.activityMetaText}>
                          {formattedDate}
                        </Text>
                      </View>

                      {!!formattedTime && (
                        <View style={styles.activityMetaItem}>
                          <MaterialCommunityIcons
                            name="clock-outline"
                            size={15}
                            color="#64748B"
                          />

                          <Text style={styles.activityMetaText}>
                            {formattedTime}
                          </Text>
                        </View>
                      )}

                      <View
                        style={[
                          styles.activityTypeBadge,
                          {
                            backgroundColor: activityBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.activityTypeBadgeText,
                            {
                              color: activityColor,
                            },
                          ]}
                        >
                          {isTopUp ? "Top Up" : "Payment"}
                        </Text>
                      </View>
                    </View>

                    {/* ------------------------------------------------------- */}
                    {/* Payment Breakdown                                         */}
                    {/* ------------------------------------------------------- */}

                    {isPayment && (
                      <View style={styles.breakdownCard}>
                        <View style={styles.breakdownHeader}>
                          <MaterialCommunityIcons
                            name="chart-donut"
                            size={16}
                            color="#64748B"
                          />

                          <Text style={styles.breakdownHeaderText}>
                            Payment Breakdown
                          </Text>
                        </View>

                        <View style={styles.breakdownGrid}>
                          <View style={styles.breakdownItem}>
                            <Text style={styles.breakdownLabel}>Principal</Text>

                            <Text
                              style={[
                                styles.breakdownValue,
                                {
                                  color: "#2563EB",
                                },
                              ]}
                            >
                              ₹{principal.toLocaleString("en-IN")}
                            </Text>
                          </View>

                          <View style={styles.breakdownDivider} />

                          <View style={styles.breakdownItem}>
                            <Text style={styles.breakdownLabel}>Interest</Text>

                            <Text
                              style={[
                                styles.breakdownValue,
                                {
                                  color: "#EA580C",
                                },
                              ]}
                            >
                              ₹{interest.toLocaleString("en-IN")}
                            </Text>
                          </View>

                          <View style={styles.breakdownDivider} />

                          <View style={styles.breakdownItem}>
                            <Text style={styles.breakdownLabel}>
                              Balance After
                            </Text>

                            <Text
                              style={[
                                styles.breakdownValue,
                                {
                                  color: "#DC2626",
                                },
                              ]}
                            >
                              ₹{balance.toLocaleString("en-IN")}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* ------------------------------------------------------- */}
                    {/* Top Up Explanation                                        */}
                    {/* ------------------------------------------------------- */}

                    {isTopUp && (
                      <View style={styles.topUpInfo}>
                        <MaterialCommunityIcons
                          name="information-outline"
                          size={16}
                          color="#7C3AED"
                        />

                        <Text style={styles.topUpInfoText}>
                          This amount was added to the loan balance.
                        </Text>
                      </View>
                    )}

                    {/* ------------------------------------------------------- */}
                    {/* Actions                                                   */}
                    {/* ------------------------------------------------------- */}

                    <View style={styles.activityActions}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={async () => {
                          try {
                            await unlinkTransactionFromLoan(tx.id);

                            await loadLinkedTransactions();
                            await refresh();

                            setSnackbarMsg(
                              "Transaction removed from this loan.",
                            );
                          } catch (e) {
                            console.error(e);

                            setSnackbarMsg(
                              e?.message ||
                                "Unable to remove this transaction.",
                            );
                          }

                          setSnackbarVisible(true);
                        }}
                        style={styles.unlinkButton}
                      >
                        <MaterialCommunityIcons
                          name="link-variant-off"
                          size={16}
                          color="#DC2626"
                        />

                        <Text style={styles.unlinkButtonText}>
                          Remove from loan
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <LendMoreSheet
        visible={showLendMore}
        loanId={loan.id}
        loanName={loan.loan_name}
        onClose={() => setShowLendMore(false)}
        onSuccess={() => refresh()}
      />

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
  // Loan Activity
  // =====================================================================

  activityCard: {
    borderRadius: 22,
    paddingBottom: 18,
  },

  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  activityHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  activityHeaderIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  activityTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },

  activitySubtitle: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 12,
    lineHeight: 17,
  },

  activityCount: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 9,
    borderRadius: 17,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
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
    width: 44,
    alignItems: "center",
    marginRight: 10,
  },

  activityTimelineIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 14,
    borderLeftWidth: 3,
  },

  activityItemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  activityItemTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },

  activityItemTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
  },

  activityItemDescription: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 12,
    lineHeight: 17,
  },

  activityAmount: {
    fontSize: 17,
    fontWeight: "900",
  },

  // =====================================================================
  // Meta
  // =====================================================================

  activityMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 10,
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
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
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
  // Actions
  // =====================================================================

  activityActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  unlinkButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },

  unlinkButtonText: {
    marginLeft: 5,
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "800",
  },
});
