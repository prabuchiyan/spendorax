import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import CurrencyText from './CurrencyText';

function BillSummaryBar({ summary, isDarkMode }) {
  if (!summary) return null;

  const theme = isDarkMode
    ? {
      cardBg: "#182234",
      cardBorder: "#334155",
      textPrimary: "#F3F4F6",
      textSecondary: "#9CA3AF",
      badgeBg: "rgba(13, 148, 136, 0.15)",
      badgeBorder: "rgba(45, 212, 191, 0.3)",
      badgeDot: "#2dd4bf",
      badgeText: "#5eead4",
      progressTrack: "rgba(244, 63, 94, 0.25)",
      progressFill: "#2dd4bf",
      progressRemaining: "#f43f5e",
      boxPaidBg: "rgba(30, 41, 59, 0.7)",
      boxPaidBorder: "#334155",
      boxPaidIcon: "#2dd4bf",
      boxOverdueBg: "rgba(159, 18, 57, 0.3)",
      boxOverdueBorder: "rgba(244, 63, 94, 0.3)",
      boxOverdueText: "#fda4af",
      boxUpcomingBg: "rgba(30, 41, 59, 0.7)",
      boxUpcomingBorder: "#334155",
      boxUpcomingIcon: "#fbbf24",
    }
    : {
      cardBg: "#ffffff",
      cardBorder: "#e2ebf8",
      textPrimary: "#0b1c30",
      textSecondary: "#45464d",
      badgeBg: "#e6f7f3",
      badgeBorder: "#a7f3d0",
      badgeDot: "#006a61",
      badgeText: "#006a61",
      progressTrack: "#fee2e2",
      progressFill: "#006a61",
      progressRemaining: "#ba1a1a",
      boxPaidBg: "#f8faff",
      boxPaidBorder: "#e2ebf8",
      boxPaidIcon: "#006a61",
      boxOverdueBg: "#fff1f2",
      boxOverdueBorder: "#fecdd3",
      boxOverdueText: "#ba1a1a",
      boxUpcomingBg: "#f8faff",
      boxUpcomingBorder: "#e2ebf8",
      boxUpcomingIcon: "#c76c00",
    };

  const total = Number(summary.totalThisMonth) || 0;
  const paid = Number(summary.totalPaid) || 0;
  const overdue = Number(summary.overdueAmount) || 0;

  const paidPct = total > 0 ? Math.min(100, Math.max(0, (paid / total) * 100)) : 0;
  const remainingPct = 100 - paidPct;

  return (
    <View
      style={[
        styles.heroContainer,
        {
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        },
      ]}
    >
      {/* Status Header Bar */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerLabel, { color: theme.textSecondary }]}>
          This Month Total
        </Text>
        <View style={styles.headerRightRow}>
          <View
            style={[
              styles.settledBadge,
              {
                backgroundColor: theme.badgeBg,
                borderColor: theme.badgeBorder,
              },
            ]}
          >
            <View style={[styles.settledDot, { backgroundColor: theme.badgeDot }]} />
            <Text style={[styles.settledText, { color: theme.badgeText }]}>
              {Math.round(paidPct)}% Settled
            </Text>
          </View>
          <Text style={[styles.paidCountSub, { color: theme.textSecondary }]}>
            {summary.paidCount || 0} bills paid
          </Text>
        </View>
      </View>

      {/* Big Amount Display */}
      <View style={styles.amountContainer}>
        <Text
          numberOfLines={1}
          style={[styles.bigAmountText, { color: theme.textPrimary }]}
        >
          <CurrencyText amount={summary.totalThisMonth} />
        </Text>
      </View>

      {/* Dual-Tone Progress Settlement Bar */}
      <View style={[styles.progressTrack, { backgroundColor: theme.progressTrack }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${paidPct}%`,
              backgroundColor: theme.progressFill,
            },
          ]}
        />
        {remainingPct > 0 && overdue > 0 && (
          <View
            style={[
              styles.progressRemaining,
              {
                width: `${remainingPct}%`,
                backgroundColor: theme.progressRemaining,
              },
            ]}
          />
        )}
      </View>

      {/* Summary Micro-Pill Cards Grid (3 cards) */}
      <View style={styles.microGrid}>
        {/* Paid Box */}
        <View
          style={[
            styles.microBox,
            {
              backgroundColor: theme.boxPaidBg,
              borderColor: theme.boxPaidBorder,
              marginRight: 6,
            },
          ]}
        >
          <View style={styles.microBoxHeader}>
            <MaterialCommunityIcons
              name="check-circle"
              size={15}
              color={theme.boxPaidIcon}
            />
            <Text
              style={[
                styles.microBoxLabel,
                { color: theme.textSecondary, marginLeft: 4 },
              ]}
            >
              Paid
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.microBoxValue, { color: theme.textPrimary }]}
          >
            <CurrencyText amount={summary.totalPaid} />
          </Text>
        </View>

        {/* Overdue Box */}
        <View
          style={[
            styles.microBox,
            {
              backgroundColor: theme.boxOverdueBg,
              borderColor: theme.boxOverdueBorder,
              marginRight: 6,
            },
          ]}
        >
          <View style={styles.microBoxHeader}>
            <MaterialCommunityIcons
              name="alert"
              size={15}
              color={theme.boxOverdueText}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.microBoxLabel,
                { color: theme.boxOverdueText, marginLeft: 4, fontWeight: "700" },
              ]}
            >
              Overdue ({summary.overdueCount || 0})
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.microBoxValue, { color: theme.boxOverdueText }]}
          >
            <CurrencyText amount={summary.overdueAmount} />
          </Text>
        </View>

        {/* Next 7d Box */}
        <View
          style={[
            styles.microBox,
            {
              backgroundColor: theme.boxUpcomingBg,
              borderColor: theme.boxUpcomingBorder,
            },
          ]}
        >
          <View style={styles.microBoxHeader}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={15}
              color={theme.boxUpcomingIcon}
            />
            <Text
              style={[
                styles.microBoxLabel,
                { color: theme.textSecondary, marginLeft: 4 },
              ]}
            >
              Next 7d
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.microBoxValue, { color: theme.textPrimary }]}
          >
            <CurrencyText amount={summary.upcoming7} />
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#0b1c30",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  settledBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
  },
  settledDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  settledText: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "Inter",
  },
  paidCountSub: {
    fontSize: 11,
    fontWeight: "500",
    fontFamily: "Inter",
  },
  amountContainer: {
    marginTop: 8,
    marginBottom: 10,
  },
  bigAmountText: {
    fontSize: 32,
    fontWeight: "800",
    fontFamily: "Plus Jakarta Sans",
    letterSpacing: -0.6,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressRemaining: {
    height: "100%",
  },
  microGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  microBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "space-between",
  },
  microBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  microBoxLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  microBoxValue: {
    fontSize: 14.5,
    fontWeight: "800",
    fontFamily: "Plus Jakarta Sans",
  },
});

export default memo(BillSummaryBar);
