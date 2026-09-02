import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { getLoans, getLoanPayments } from "../services/loans";
import events from "../services/events";
import Card from "../components/Card";
import FAB from "../components/FAB";
import { Colors, Spacing } from "../components/Theme";

/* =========================================================
   HELPERS
========================================================= */

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function number(value) {
  return Number(value || 0);
}

function getDirection(loan) {
  const value = String(loan?.loan_direction ?? loan?.direction ?? "")
    .trim()
    .toUpperCase();

  return value === "LENT" ? "LENT" : "BORROWED";
}

function isActive(loan) {
  return (loan?.status || "Active") === "Active";
}

function computeNextDueDate(loan) {
  try {
    const today = new Date();

    const day =
      Number(loan?.emi_day) ||
      (loan?.loan_start_date
        ? new Date(loan.loan_start_date).getDate()
        : today.getDate());

    const candidate = new Date(today.getFullYear(), today.getMonth(), day);

    if (candidate < today) {
      candidate.setMonth(candidate.getMonth() + 1);
    }

    return candidate;
  } catch (e) {
    return null;
  }
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

function getProgressColor(percent) {
  if (percent >= 100) return "#E25563";
  if (percent >= 80) return "#F4A261";
  return "#18A999";
}

/* =========================================================
   SMALL STAT CARD
========================================================= */

function StatCard({ title, amount, icon, color = "#36B37E" }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#E8ECF0",
        padding: 14,
        minHeight: 104,
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: `${color}18`,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <MaterialCommunityIcons name={icon} size={21} color={color} />
      </View>

      <Text
        style={{
          fontSize: 11,
          color: "#7B8794",
          fontWeight: "700",
        }}
      >
        {title}
      </Text>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{
          marginTop: 4,
          fontSize: 17,
          fontWeight: "900",
          color: "#172033",
        }}
      >
        {amount}
      </Text>
    </View>
  );
}

/* =========================================================
   PRIMARY SUMMARY CARD
========================================================= */

function PrimarySummaryCard({ title, subtitle, amount, icon, color }) {
  return (
    <Card
      style={{
        marginBottom: 12,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 5,
          backgroundColor: color,
          width: "100%",
        }}
      />

      <View
        style={{
          padding: 18,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            backgroundColor: `${color}18`,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 10,
          }}
        >
          <MaterialCommunityIcons name={icon} size={30} color={color} />
        </View>

        <Text
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: "#172033",
          }}
        >
          {title}
        </Text>

        <Text
          style={{
            marginTop: 4,
            color: "#7B8794",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {subtitle}
        </Text>

        <Text
          style={{
            marginTop: 12,
            fontSize: 30,
            fontWeight: "900",
            color,
          }}
        >
          {amount}
        </Text>
      </View>
    </Card>
  );
}

/* =========================================================
   PROGRESS CARD
========================================================= */

function ProgressCard({
  title,
  subtitle,
  percent,
  completed,
  remaining,
  completedLabel,
  remainingLabel,
}) {
  const safePercent = Math.max(0, Math.min(100, Number(percent || 0)));

  const progressColor = getProgressColor(safePercent);

  return (
    <Card
      style={{
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            backgroundColor: `${progressColor}18`,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <MaterialCommunityIcons
            name="chart-donut"
            size={22}
            color={progressColor}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "900",
              color: "#172033",
            }}
          >
            {title}
          </Text>

          <Text
            style={{
              marginTop: 2,
              fontSize: 11,
              color: "#7B8794",
            }}
          >
            {subtitle}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: progressColor,
          }}
        >
          {Math.round(safePercent)}%
        </Text>
      </View>

      <View
        style={{
          height: 9,
          backgroundColor: "#E9EEF2",
          borderRadius: 5,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${safePercent}%`,
            height: "100%",
            backgroundColor: progressColor,
            borderRadius: 5,
          }}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 10,
        }}
      >
        <View>
          <Text
            style={{
              fontSize: 10,
              color: "#8A94A6",
            }}
          >
            {completedLabel}
          </Text>

          <Text
            style={{
              marginTop: 2,
              fontSize: 14,
              fontWeight: "800",
              color: "#172033",
            }}
          >
            {money(completed)}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={{
              fontSize: 10,
              color: "#8A94A6",
            }}
          >
            {remainingLabel}
          </Text>

          <Text
            style={{
              marginTop: 2,
              fontSize: 14,
              fontWeight: "800",
              color: number(remaining) > 0 ? "#172033" : "#18A999",
            }}
          >
            {money(remaining)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/* =========================================================
   SECTION HEADER
========================================================= */

function SectionHeader({ title, subtitle, count }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 18,
        marginBottom: 10,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "900",
            color: "#172033",
          }}
        >
          {title}
        </Text>

        {!!subtitle && (
          <Text
            style={{
              marginTop: 2,
              fontSize: 11,
              color: "#7B8794",
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {count !== undefined && (
        <View
          style={{
            minWidth: 30,
            height: 26,
            paddingHorizontal: 8,
            borderRadius: 13,
            backgroundColor: "#E8F7EF",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "#287A57",
              fontSize: 11,
              fontWeight: "900",
            }}
          >
            {count}
          </Text>
        </View>
      )}
    </View>
  );
}

/* =========================================================
   LOAN CARD
========================================================= */

function DirectionLoanCard({ loan, direction, navigation }) {
  const outstanding = number(loan.outstanding_amount);
  const paid = number(loan.principal_paid);

  const total = paid + outstanding;

  const percentage = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

  const progressColor = getProgressColor(percentage);

  const overdue =
    outstanding > 0 &&
    loan.loan_end_date &&
    new Date(loan.loan_end_date) < new Date();

  const accent = overdue
    ? "#E25563"
    : direction === "BORROWED"
      ? "#36B37E"
      : "#4F7CAC";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() =>
        navigation.navigate("LoanDetails", {
          id: loan.id,
        })
      }
      style={{
        marginBottom: 10,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#E8ECF0",
        overflow: "hidden",
        elevation: 1,
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: accent,
        }}
      />

      <View
        style={{
          paddingVertical: 13,
          paddingHorizontal: 12,
          paddingLeft: 16,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              backgroundColor: `${accent}18`,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            <MaterialCommunityIcons
              name={direction === "BORROWED" ? "bank-minus" : "cash-plus"}
              size={22}
              color={accent}
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 15,
                fontWeight: "900",
                color: "#172033",
              }}
            >
              {loan.loan_name || "Loan"}
            </Text>

            <Text
              numberOfLines={1}
              style={{
                marginTop: 3,
                fontSize: 11,
                color: "#7B8794",
              }}
            >
              {direction === "BORROWED" ? "Outstanding" : "Pending recovery"}
              {"  "}
              {money(outstanding)}
            </Text>
          </View>

          <View
            style={{
              alignItems: "flex-end",
              marginLeft: 8,
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: "900",
                color: progressColor,
              }}
            >
              {Math.round(percentage)}%
            </Text>

            <Text
              style={{
                marginTop: 1,
                fontSize: 9,
                fontWeight: "800",
                color: overdue ? "#E25563" : progressColor,
              }}
            >
              {overdue
                ? "OVERDUE"
                : percentage >= 100
                  ? "COMPLETED"
                  : percentage >= 80
                    ? "NEAR COMPLETE"
                    : "IN PROGRESS"}
            </Text>
          </View>
        </View>

        <View
          style={{
            height: 6,
            backgroundColor: "#E9EEF2",
            borderRadius: 3,
            overflow: "hidden",
            marginTop: 11,
          }}
        >
          <View
            style={{
              width: `${percentage}%`,
              height: "100%",
              backgroundColor: progressColor,
              borderRadius: 3,
            }}
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 7,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              color: "#8A94A6",
            }}
          >
            Paid {money(paid)}
          </Text>

          {number(loan.emi_amount) > 0 && (
            <Text
              style={{
                fontSize: 10,
                color: "#8A94A6",
              }}
            >
              EMI {money(loan.emi_amount)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* =========================================================
   UPCOMING CARD
========================================================= */

function UpcomingCard({ loan, direction, navigation }) {
  const accent = direction === "BORROWED" ? "#36B37E" : "#4F7CAC";

  const dueDate = loan.nextDueDate || computeNextDueDate(loan);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() =>
        navigation.navigate("LoanDetails", {
          id: loan.id,
        })
      }
      style={{
        width: 205,
        marginRight: 10,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#E8ECF0",
        padding: 14,
        elevation: 1,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: `${accent}18`,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 9,
          }}
        >
          <MaterialCommunityIcons
            name={
              direction === "BORROWED"
                ? "calendar-arrow-right"
                : "calendar-check"
            }
            size={20}
            color={accent}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 13,
              fontWeight: "900",
              color: "#172033",
            }}
          >
            {loan.loan_name || "Loan"}
          </Text>

          <Text
            style={{
              marginTop: 2,
              fontSize: 10,
              color: "#7B8794",
            }}
          >
            {formatDate(dueDate)}
          </Text>
        </View>
      </View>

      <Text
        style={{
          marginTop: 12,
          fontSize: 18,
          fontWeight: "900",
          color: accent,
        }}
      >
        {money(number(loan.emi_amount) || number(loan.outstanding_amount))}
      </Text>

      <Text
        style={{
          marginTop: 2,
          fontSize: 10,
          color: "#8A94A6",
        }}
      >
        {direction === "BORROWED" ? "Next EMI" : "Expected recovery"}
      </Text>
    </TouchableOpacity>
  );
}

/* =========================================================
   RECENT PAYMENT
========================================================= */

function RecentPaymentCard({ item, direction }) {
  const accent = direction === "BORROWED" ? "#36B37E" : "#4F7CAC";

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E8ECF0",
        padding: 12,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: `${accent}18`,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <MaterialCommunityIcons
            name={direction === "BORROWED" ? "cash-minus" : "cash-plus"}
            size={20}
            color={accent}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 13,
              fontWeight: "900",
              color: "#172033",
            }}
          >
            {item.loan_name || "Loan payment"}
          </Text>

          <Text
            style={{
              marginTop: 2,
              fontSize: 10,
              color: "#7B8794",
            }}
          >
            {formatDate(item.payment_date)}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 15,
            fontWeight: "900",
            color: accent,
          }}
        >
          {money(item.amount ?? item.payment_amount ?? item.paid_amount)}
        </Text>
      </View>
    </View>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyCard({ icon, title, subtitle }) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#E8ECF0",
        padding: 22,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 15,
          backgroundColor: "#E8F7EF",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <MaterialCommunityIcons name={icon} size={25} color="#36B37E" />
      </View>

      <Text
        style={{
          fontSize: 15,
          fontWeight: "900",
          color: "#172033",
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          marginTop: 5,
          fontSize: 11,
          color: "#7B8794",
          textAlign: "center",
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

/* =========================================================
   MAIN REUSABLE DASHBOARD
========================================================= */

function LoanDirectionDashboard({ navigation }) {
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState("BORROWED");

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getLoans();

      console.log("========== LOAN DASHBOARD DEBUG ==========");

      console.log("Requested direction:", direction);

      console.log("Total loans:", data.length);

      console.log(
        "Loan directions:",
        data.map((loan) => ({
          id: loan.id,
          name: loan.loan_name,
          loan_direction: loan.loan_direction,
          direction: loan.direction,
        })),
      );

      const filtered = data
        .filter((loan) => getDirection(loan) === direction)
        .map((loan) => ({
          ...loan,
          nextDueDate: computeNextDueDate(loan),
          isOverdue:
            number(loan.outstanding_amount) > 0 &&
            loan.loan_end_date &&
            new Date(loan.loan_end_date) < new Date(),
        }));

      setLoans(filtered);

      let recent = [];

      for (const loan of filtered) {
        const rows = await getLoanPayments(loan.id, 6, 0);

        recent = recent.concat(
          rows.map((payment) => ({
            ...payment,
            loan_name: loan.loan_name,
          })),
        );
      }

      recent.sort(
        (a, b) => new Date(b.payment_date) - new Date(a.payment_date),
      );

      setPayments(recent.slice(0, 6));
    } catch (error) {
      console.error("Loan dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  }, [direction]);

  useEffect(() => {
    load();

    const unsubscribe = navigation.addListener("focus", load);

    const offLoans = events.on("loansChanged", load);

    const offPayments = events.on("loanPaymentsChanged", load);

    return () => {
      unsubscribe?.();
      offLoans?.();
      offPayments?.();
    };
  }, [navigation, load]);

  /* =====================================================
     SUMMARY
  ===================================================== */

  const summary = useMemo(() => {
    const active = loans.filter(isActive);

    const outstanding = loans.reduce(
      (sum, loan) => sum + number(loan.outstanding_amount),
      0,
    );

    const paid = loans.reduce(
      (sum, loan) => sum + number(loan.principal_paid),
      0,
    );

    const total = paid + outstanding;

    const percentage = total > 0 ? Math.min(100, (paid / total) * 100) : 0;

    const emi = active.reduce((sum, loan) => sum + number(loan.emi_amount), 0);

    const interest = loans.reduce(
      (sum, loan) => sum + number(loan.interest_paid),
      0,
    );

    const overdue = loans.filter(
      (loan) => loan.isOverdue && number(loan.outstanding_amount) > 0,
    ).length;

    const activeCount = active.length;

    const closedCount = loans.filter(
      (loan) => !isActive(loan) || number(loan.outstanding_amount) <= 0,
    ).length;

    return {
      outstanding,
      paid,
      total,
      percentage,
      emi,
      interest,
      overdue,
      activeCount,
      closedCount,
    };
  }, [loans]);

  /* =====================================================
     UPCOMING
  ===================================================== */

  const upcoming = useMemo(() => {
    return loans
      .filter((loan) => isActive(loan) && number(loan.outstanding_amount) > 0)
      .sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate))
      .slice(0, 6);
  }, [loans]);

  /* =====================================================
     ACTIVE
  ===================================================== */

  const activeLoans = useMemo(() => {
    return loans
      .filter((loan) => isActive(loan) && number(loan.outstanding_amount) > 0)
      .sort(
        (a, b) => number(b.outstanding_amount) - number(a.outstanding_amount),
      );
  }, [loans]);

  /* =====================================================
     LABELS
  ===================================================== */

  const isBorrowed = direction === "BORROWED";

  const accent = isBorrowed ? "#36B37E" : "#4F7CAC";

  const title = isBorrowed ? "Loans" : "Money Lent";

  const subtitle = isBorrowed
    ? "Track the money you borrowed"
    : "Track the money others owe you";

  const primaryTitle = isBorrowed ? "Outstanding Loan" : "Pending Recovery";

  const primarySubtitle = isBorrowed
    ? "Amount you still need to repay"
    : "Amount still owed to you";

  const primaryIcon = isBorrowed ? "bank-minus" : "cash-plus";

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={accent} />

        <Text
          style={{
            marginTop: 10,
            color: Colors.muted,
            fontSize: 13,
          }}
        >
          Loading {isBorrowed ? "loans" : "money lent"}...
        </Text>
      </View>
    );
  }

  /* =====================================================
     UI
  ===================================================== */

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.background,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: Spacing.xs,
          paddingBottom: 120,
        }}
      >
        {/* Header */}

        {/* Header */}

        <View
          style={{
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: "900",
              color: "#172033",
            }}
          >
            {direction === "BORROWED" ? "Loans" : "Money Lent"}
          </Text>

          <Text
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "#7B8794",
            }}
          >
            {direction === "BORROWED"
              ? "Track the money you borrowed"
              : "Track the money others owe you"}
          </Text>
        </View>

        {/* LOAN / LENT TABS */}

        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#E9EEF2",
            borderRadius: 14,
            padding: 4,
            marginBottom: 14,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setDirection("BORROWED")}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              backgroundColor:
                direction === "BORROWED" ? "#FFFFFF" : "transparent",
              elevation: direction === "BORROWED" ? 2 : 0,
              shadowColor: "#000",
              shadowOffset: {
                width: 0,
                height: 1,
              },
              shadowOpacity: direction === "BORROWED" ? 0.08 : 0,
              shadowRadius: 3,
            }}
          >
            <MaterialCommunityIcons
              name="bank-minus"
              size={19}
              color={direction === "BORROWED" ? "#36B37E" : "#7B8794"}
              style={{ marginRight: 7 }}
            />

            <Text
              style={{
                fontSize: 13,
                fontWeight: "900",
                color: direction === "BORROWED" ? "#172033" : "#7B8794",
              }}
            >
              Loans
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setDirection("LENT")}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              backgroundColor: direction === "LENT" ? "#FFFFFF" : "transparent",
              elevation: direction === "LENT" ? 2 : 0,
              shadowColor: "#000",
              shadowOffset: {
                width: 0,
                height: 1,
              },
              shadowOpacity: direction === "LENT" ? 0.08 : 0,
              shadowRadius: 3,
            }}
          >
            <MaterialCommunityIcons
              name="cash-plus"
              size={19}
              color={direction === "LENT" ? "#4F7CAC" : "#7B8794"}
              style={{ marginRight: 7 }}
            />

            <Text
              style={{
                fontSize: 13,
                fontWeight: "900",
                color: direction === "LENT" ? "#172033" : "#7B8794",
              }}
            >
              Money Lent
            </Text>
          </TouchableOpacity>
        </View>

        {/* Primary amount */}

        <PrimarySummaryCard
          title={primaryTitle}
          subtitle={primarySubtitle}
          amount={money(summary.outstanding)}
          icon={primaryIcon}
          color={accent}
        />

        {/* Stats */}

        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <StatCard
            title={isBorrowed ? "Monthly EMI" : "Total Lent"}
            amount={money(isBorrowed ? summary.emi : summary.total)}
            icon={isBorrowed ? "calendar-month" : "cash-multiple"}
            color={accent}
          />

          <StatCard
            title={isBorrowed ? "Interest Paid" : "Recovered"}
            amount={money(isBorrowed ? summary.interest : summary.paid)}
            icon={isBorrowed ? "percent" : "cash-check"}
            color={isBorrowed ? "#F4A261" : "#36B37E"}
          />
        </View>

        {/* Progress */}

        <ProgressCard
          title={isBorrowed ? "Repayment Progress" : "Recovery Progress"}
          subtitle={
            isBorrowed
              ? "How much of your principal is already paid"
              : "How much of the money lent has been recovered"
          }
          percent={summary.percentage}
          completed={summary.paid}
          remaining={summary.outstanding}
          completedLabel={isBorrowed ? "Principal paid" : "Recovered"}
          remainingLabel={isBorrowed ? "Still to repay" : "Pending recovery"}
        />

        {/* Health / overview */}

        <Card
          style={{
            marginBottom: 2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                backgroundColor: `${accent}18`,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}
            >
              <MaterialCommunityIcons
                name={
                  isBorrowed ? "shield-check-outline" : "account-cash-outline"
                }
                size={23}
                color={accent}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "900",
                  color: "#172033",
                }}
              >
                {isBorrowed ? "Loan Overview" : "Lending Overview"}
              </Text>

              <Text
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: "#7B8794",
                }}
              >
                Current status
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <View style={{ alignItems: "center", flex: 1 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "900",
                  color: "#172033",
                }}
              >
                {summary.activeCount}
              </Text>

              <Text
                style={{
                  marginTop: 2,
                  fontSize: 10,
                  color: "#7B8794",
                }}
              >
                Active
              </Text>
            </View>

            <View style={{ alignItems: "center", flex: 1 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "900",
                  color: "#172033",
                }}
              >
                {summary.closedCount}
              </Text>

              <Text
                style={{
                  marginTop: 2,
                  fontSize: 10,
                  color: "#7B8794",
                }}
              >
                Closed
              </Text>
            </View>

            <View style={{ alignItems: "center", flex: 1 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "900",
                  color: summary.overdue > 0 ? "#E25563" : "#18A999",
                }}
              >
                {summary.overdue}
              </Text>

              <Text
                style={{
                  marginTop: 2,
                  fontSize: 10,
                  color: "#7B8794",
                }}
              >
                Overdue
              </Text>
            </View>
          </View>
        </Card>

        {/* Upcoming */}

        <SectionHeader
          title={isBorrowed ? "Upcoming Payments" : "Expected Recovery"}
          subtitle={
            isBorrowed
              ? "Your next scheduled loan payments"
              : "Upcoming amounts expected back"
          }
          count={upcoming.length}
        />

        {upcoming.length === 0 ? (
          <EmptyCard
            icon={isBorrowed ? "calendar-check-outline" : "cash-check"}
            title={
              isBorrowed ? "No upcoming payments" : "No pending recoveries"
            }
            subtitle={
              isBorrowed
                ? "You have no active loan payments to show."
                : "You have no active money-lent records to show."
            }
          />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {upcoming.map((loan) => (
              <UpcomingCard
                key={loan.id}
                loan={loan}
                direction={direction}
                navigation={navigation}
              />
            ))}
          </ScrollView>
        )}

        {/* Active loans */}

        <SectionHeader
          title={isBorrowed ? "Active Loans" : "Active Money Lent"}
          subtitle={
            isBorrowed
              ? "Loans you are currently repaying"
              : "People or parties who still owe you"
          }
          count={activeLoans.length}
        />

        {activeLoans.length === 0 ? (
          <EmptyCard
            icon={isBorrowed ? "bank-off-outline" : "account-cash-outline"}
            title={isBorrowed ? "No active loans" : "No active lending"}
            subtitle={
              isBorrowed
                ? "Add a borrowed loan to start tracking repayments."
                : "Add money lent to someone to start tracking recovery."
            }
          />
        ) : (
          activeLoans.map((loan) => (
            <DirectionLoanCard
              key={loan.id}
              loan={loan}
              direction={direction}
              navigation={navigation}
            />
          ))
        )}

        {/* Recent activity */}

        <SectionHeader
          title={isBorrowed ? "Recent Payments" : "Recent Recoveries"}
          subtitle={
            isBorrowed ? "Latest loan payments" : "Latest repayments received"
          }
          count={payments.length}
        />

        {payments.length === 0 ? (
          <EmptyCard
            icon="history"
            title="No recent activity"
            subtitle={
              isBorrowed
                ? "Loan payments will appear here."
                : "Recovered payments will appear here."
            }
          />
        ) : (
          payments.map((payment) => (
            <RecentPaymentCard
              key={payment.id}
              item={payment}
              direction={direction}
            />
          ))
        )}
      </ScrollView>

      {/* FAB */}

      <FAB onPress={() => navigation.navigate("LoanForm")} />
    </View>
  );
}

export function LoanDashboardScreen({ navigation }) {
  return <LoanDirectionDashboard navigation={navigation} />;
}

export default LoanDashboardScreen;
