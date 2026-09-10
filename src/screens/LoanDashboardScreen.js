import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getLoans, getLoanPayments } from "../services/loans";
import events from "../services/events";
import FAB from "../components/FAB";
import { Colors, Spacing } from "../components/Theme";
import { useAppDispatch, useLoans } from '../redux/hooks';
import { setLoans } from '../redux/slices/loanSlice';

/* =========================================================
   HELPERS
========================================================= */

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
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

    return candidate.toISOString();
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
  if (percent >= 100) return "#16A34A";
  if (percent >= 80) return "#F59E0B";
  return "#3B82F6";
}

/* =========================================================
   SMALL ICON
========================================================= */

function IconBox({ icon, color, size = 42, iconSize = 21, radius = 13 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: `${color}16`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <MaterialCommunityIcons name={icon} size={iconSize} color={color} />
    </View>
  );
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status, color }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        height: 23,
        borderRadius: 12,
        backgroundColor: `${color}14`,
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
          fontSize: 8,
          fontWeight: "900",
          letterSpacing: 0.4,
          color,
        }}
      >
        {status}
      </Text>
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
}) {
  const { outstanding, paid, percentage, emi, total, activeCount, overdue } = summary;
  const progressColor = getProgressColor(percentage);
  const safePercentage = Math.max(0, Math.min(100, Number(percentage || 0)));

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 22,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#EAF0F6",
        shadowColor: "#172033",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 4,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#8A94A6" }}>
            {isBorrowed ? "Still to Repay" : "Pending Recovery"}
          </Text>
          <Text
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={{ fontSize: 28, fontWeight: "900", color: "#172033", marginTop: 4 }}
          >
            {money(outstanding)}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate("LoanList", { status: "Active", direction })}
          style={{
            backgroundColor: `${accent}15`,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            marginLeft: 12,
          }}
        >
          <Text style={{ color: accent, fontSize: 12, fontWeight: "800" }}>
            {activeCount} Active
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: "#8A94A6" }}>
            {isBorrowed ? "Repayment Progress" : "Recovery Progress"}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: "900", color: progressColor }}>
            {Math.round(safePercentage)}%
          </Text>
        </View>
        <View style={{ height: 8, backgroundColor: "#F0F3F6", borderRadius: 4 }}>
          <View
            style={{
              width: `${safePercentage}%`,
              height: "100%",
              backgroundColor: progressColor,
              borderRadius: 4,
            }}
          />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", color: "#687385" }}>
            Paid: <Text style={{ color: "#172033" }}>{money(paid)}</Text>
          </Text>
          <Text style={{ fontSize: 11, fontWeight: "600", color: "#687385" }}>
            Total: <Text style={{ color: "#172033" }}>{money(total)}</Text>
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#F8FAFC",
          borderRadius: 16,
          padding: 14,
          borderWidth: 1,
          borderColor: "#EAF0F6",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: "#8A94A6", marginBottom: 4, fontWeight: "600" }}>
            {isBorrowed ? "Monthly EMI" : "Total Lent"}
          </Text>
          <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5} style={{ fontSize: 16, fontWeight: "900", color: "#172033" }}>
            {money(isBorrowed ? emi : total)}
          </Text>
        </View>
        <View style={{ width: 1, backgroundColor: "#EAF0F6", marginHorizontal: 16 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: "#8A94A6", marginBottom: 4, fontWeight: "600" }}>
            Status
          </Text>
          <Text style={{ fontSize: 14, fontWeight: "900", color: overdue > 0 ? "#E25563" : "#16A34A", marginTop: 2 }}>
            {overdue > 0 ? `${overdue} Overdue` : "All Good"}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* =========================================================
   SECTION HEADER
========================================================= */
function SectionHeader({ title, subtitle, count, onViewAll }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 15,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          flex: 1,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: "900",
            color: "#172033",
          }}
        >
          {title}
        </Text>

        {!!subtitle && (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 1,
              fontSize: 10,
              color: "#8A94A6",
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {count !== undefined && (
          <View
            style={{
              minWidth: 26,
              height: 23,
              paddingHorizontal: 7,
              borderRadius: 12,
              backgroundColor: "#F0F3F6",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 8,
            }}
          >
            <Text
              style={{
                color: "#5E6A7A",
                fontSize: 10,
                fontWeight: "900",
              }}
            >
              {count}
            </Text>
          </View>
        )}

        {onViewAll && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onViewAll}
            style={{
              marginLeft: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#3B82F6" }}>
              View All
            </Text>
          </TouchableOpacity>
        )}
      </View>
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

  const completed = percentage >= 100 || outstanding <= 0;

  const accent = overdue
    ? "#E25563"
    : direction === "BORROWED"
      ? "#36B37E"
      : "#4F7CAC";

  const status = overdue ? "OVERDUE" : completed ? "COMPLETED" : "ACTIVE";

  const statusColor = overdue ? "#E25563" : completed ? "#16A34A" : accent;

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={() =>
        navigation.navigate("LoanDetails", {
          id: loan.id,
        })
      }
      style={{
        marginBottom: 8,
        backgroundColor: "#FFFFFF",
        borderRadius: 15,
        borderWidth: 1,
        borderColor: "#E7EBF0",
        overflow: "hidden",
        shadowColor: "#172033",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
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
          paddingVertical: 11,
          paddingLeft: 14,
          paddingRight: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <IconBox
            icon={direction === "BORROWED" ? "bank-minus" : "cash-plus"}
            color={accent}
            size={40}
            iconSize={20}
            radius={12}
          />

          <View
            style={{
              flex: 1,
              minWidth: 0,
              marginLeft: 10,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontWeight: "900",
                color: "#172033",
              }}
            >
              {loan.loan_name || "Loan"}
            </Text>

            <Text
              numberOfLines={1}
              style={{
                marginTop: 2,
                fontSize: 10,
                color: "#8A94A6",
              }}
            >
              {direction === "BORROWED" ? "Outstanding" : "Pending recovery"} •{" "}
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
                fontSize: 16,
                fontWeight: "900",
                color: progressColor,
              }}
            >
              {Math.round(percentage)}%
            </Text>

            <StatusBadge status={status} color={statusColor} />
          </View>
        </View>

        {/* Progress */}

        <View
          style={{
            marginTop: 10,
            height: 6,
            backgroundColor: "#EDF1F4",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${Math.min(100, percentage)}%`,
              height: "100%",
              backgroundColor: progressColor,
              borderRadius: 4,
            }}
          />
        </View>

        {/* Bottom details */}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              color: "#8A94A6",
            }}
          >
            Paid {money(paid)}
          </Text>

          {number(loan.emi_amount) > 0 && (
            <Text
              style={{
                fontSize: 9,
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
  const overdue =
    dueDate &&
    new Date(dueDate) < new Date() &&
    number(loan.outstanding_amount) > 0;
  const { width } = Dimensions.get("window");

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={() => navigation.navigate("LoanDetails", { id: loan.id })}
      style={{
        width: width * 0.42,
        marginRight: 12,
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#EAF0F6",
        padding: 16,
        shadowColor: "#172033",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <IconBox
          icon={direction === "BORROWED" ? "calendar-arrow-right" : "calendar-check"}
          color={overdue ? "#E25563" : accent}
          size={38}
          iconSize={18}
          radius={12}
        />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "900", color: "#172033" }}>
            {loan.loan_name || "Loan"}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 11, color: overdue ? "#E25563" : "#8A94A6", fontWeight: overdue ? "800" : "600" }}>
            {overdue ? "Overdue" : formatDate(dueDate)}
          </Text>
        </View>
      </View>

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ marginTop: 14, fontSize: 18, fontWeight: "900", color: overdue ? "#E25563" : accent }}
      >
        {money(number(loan.emi_amount) || number(loan.outstanding_amount))}
      </Text>

      <Text style={{ marginTop: 2, fontSize: 11, color: "#8A94A6", fontWeight: "600" }}>
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
        borderRadius: 13,
        borderWidth: 1,
        borderColor: "#E8ECF0",
        paddingVertical: 10,
        paddingHorizontal: 11,
        marginBottom: 7,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <IconBox
          icon={direction === "BORROWED" ? "cash-minus" : "cash-plus"}
          color={accent}
          size={36}
          iconSize={18}
          radius={11}
        />

        <View
          style={{
            flex: 1,
            marginLeft: 9,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 12,
              fontWeight: "900",
              color: "#172033",
            }}
          >
            {item.loan_name || "Loan payment"}
          </Text>

          <Text
            style={{
              marginTop: 2,
              fontSize: 9,
              color: "#8A94A6",
            }}
          >
            {formatDate(item.payment_date)}
          </Text>
        </View>

        <View
          style={{
            alignItems: "flex-end",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "900",
              color: accent,
            }}
          >
            {money(item.amount ?? item.payment_amount ?? item.paid_amount)}
          </Text>

          <Text
            style={{
              marginTop: 1,
              fontSize: 8,
              fontWeight: "800",
              color: "#9AA3AF",
            }}
          >
            {direction === "BORROWED" ? "PAYMENT" : "RECOVERY"}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyCard({
  icon,
  title,
  subtitle,
  color = "#36B37E",
  compact = false,
}) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 15,
        borderWidth: 1,
        borderColor: "#E7EBF0",
        paddingVertical: compact ? 16 : 20,
        paddingHorizontal: 18,
        alignItems: "center",
      }}
    >
      <IconBox
        icon={icon}
        color={color}
        size={compact ? 40 : 46}
        iconSize={compact ? 21 : 24}
        radius={compact ? 12 : 14}
      />

      <Text
        style={{
          marginTop: 8,
          fontSize: 13,
          fontWeight: "900",
          color: "#172033",
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          marginTop: 3,
          fontSize: 10,
          lineHeight: 15,
          color: "#8A94A6",
          textAlign: "center",
          maxWidth: 290,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

/* =========================================================
   TABS
========================================================= */

function DirectionTabs({ direction, setDirection }) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#F0F3F6",
        borderRadius: 20,
        padding: 4,
        marginBottom: 16,
      }}
    >
      <DirectionTab
        active={direction === "BORROWED"}
        icon="bank-minus"
        label="Loans"
        color="#36B37E"
        onPress={() => setDirection("BORROWED")}
      />

      <DirectionTab
        active={direction === "LENT"}
        icon="cash-plus"
        label="Money Lent"
        color="#4F7CAC"
        onPress={() => setDirection("LENT")}
      />
    </View>
  );
}

function DirectionTab({ active, icon, label, color, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        flex: 1,
        height: 44,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        backgroundColor: active ? "#FFFFFF" : "transparent",
        shadowColor: "#172033",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: active ? 0.05 : 0,
        shadowRadius: 4,
        elevation: active ? 2 : 0,
      }}
    >
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={active ? color : "#8A94A6"}
        style={{ marginRight: 8 }}
      />
      <Text
        style={{
          fontSize: 13,
          fontWeight: "800",
          color: active ? "#172033" : "#8A94A6",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* =========================================================
   MAIN DASHBOARD
========================================================= */

function LoanDirectionDashboard({ navigation }) {
  const dispatch = useAppDispatch();
  const reduxLoans = useLoans();
  const loans = reduxLoans || [];
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

      dispatch(setLoans(filtered));

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
      .filter((loan) => isActive(loan) && number(loan.outstanding_amount) > 0 && number(loan.emi_amount) > 0)
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
    ? "Track what you still need to repay"
    : "Track what others still owe you";

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
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            backgroundColor: `${accent}12`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="small" color={accent} />
        </View>

        <Text
          style={{
            marginTop: 10,
            color: Colors.muted,
            fontSize: 12,
            fontWeight: "700",
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
          paddingHorizontal: Spacing.xs,
          paddingTop: 4,
          paddingBottom: 105,
        }}
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <IconBox
            icon={primaryIcon}
            color={accent}
            size={42}
            iconSize={22}
            radius={13}
          />

          <View
            style={{
              flex: 1,
              marginLeft: 10,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                lineHeight: 25,
                fontWeight: "900",
                color: "#172033",
              }}
            >
              {title}
            </Text>

            <Text
              numberOfLines={1}
              style={{
                marginTop: 2,
                fontSize: 10,
                color: "#7B8794",
              }}
            >
              {subtitle}
            </Text>
          </View>
        </View>

        {/* =================================================
            TABS
        ================================================= */}

        <DirectionTabs direction={direction} setDirection={setDirection} />

        {/* =================================================
            HERO SUMMARY
        ================================================= */}

        <HeroDashboardCard
          summary={summary}
          accent={accent}
          isBorrowed={isBorrowed}
          navigation={navigation}
          direction={direction}
        />

        {/* =================================================
            UPCOMING
        ================================================= */}

        <SectionHeader
          title={isBorrowed ? "Upcoming Payments" : "Expected Recovery"}
          subtitle={
            isBorrowed
              ? "Your next scheduled payments"
              : "Amounts expected back"
          }
          count={upcoming.length}
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
                ? "Active loan payments will appear here."
                : "Active money-lent records will appear here."
            }
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingRight: 4,
            }}
          >
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

        {/* =================================================
            ACTIVE LOANS
        ================================================= */}

        <SectionHeader
          title={isBorrowed ? "Active Loans" : "Active Money Lent"}
          subtitle={
            isBorrowed ? "Currently being repaid" : "People who still owe you"
          }
          count={activeLoans.length}
          onViewAll={() => navigation.navigate("LoanList", { direction })}
        />

        {activeLoans.length === 0 ? (
          <EmptyCard
            color={accent}
            icon={isBorrowed ? "bank-off-outline" : "account-cash-outline"}
            title={isBorrowed ? "No active loans" : "No active lending"}
            subtitle={
              isBorrowed
                ? "Add a borrowed loan to start tracking repayments."
                : "Add money lent to someone to track recovery."
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

        {/* =================================================
            RECENT ACTIVITY
        ================================================= */}

        <SectionHeader
          title={isBorrowed ? "Recent Payments" : "Recent Recoveries"}
          subtitle={
            isBorrowed ? "Latest loan payments" : "Latest repayments received"
          }
          count={payments.length}
        />

        {payments.length === 0 ? (
          <EmptyCard
            compact
            color={accent}
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

      {/* =================================================
          FAB
      ================================================= */}

      <View
        style={{
          position: "absolute",
          right: 16,
          bottom: 18,
        }}
      >
        <FAB onPress={() => navigation.navigate("LoanForm")} />
      </View>
    </View>
  );
}

/* =========================================================
   EXPORT
========================================================= */

export function LoanDashboardScreen({ navigation }) {
  return <LoanDirectionDashboard navigation={navigation} />;
}

export default LoanDashboardScreen;
