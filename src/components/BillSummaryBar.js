import React, { memo } from 'react';
import { View, Text } from 'react-native';
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
        textInverse: "#0B1C30",
        progressBg: "rgba(51, 65, 85, 0.5)",
        progressFill: "#2dd4bf", // teal-400
        progressSecond: "#f59e0b", // amber-500
        progressThird: "#f43f5e", // rose-500
        badgeBg: "rgba(51, 65, 85, 0.6)",
        badgeText: "#5EEAD4", // teal-300
        badgeBorder: "rgba(20, 184, 166, 0.3)",
        badgeDot: "#2dd4bf",
        box1Bg: "rgba(30, 41, 59, 0.8)",
        box2Bg: "rgba(76, 5, 25, 0.4)",
        box2Border: "rgba(244, 63, 94, 0.3)",
        box3Bg: "rgba(69, 26, 3, 0.4)",
        box3Border: "rgba(245, 158, 11, 0.3)",
      }
    : {
        cardBg: "#ffffff",
        cardBorder: "rgba(198, 198, 205, 0.4)",
        textPrimary: "#0b1c30",
        textSecondary: "#45464d",
        textInverse: "#ffffff",
        progressBg: "#e5eeff", // surface-container
        progressFill: "#006a61", // secondary
        progressSecond: "#ffb77d", // tertiary-fixed-dim
        progressThird: "#ba1a1a", // error
        badgeBg: "#e5eeff",
        badgeText: "#006f66",
        badgeBorder: "rgba(0, 111, 102, 0.3)",
        badgeDot: "#006a61",
        box1Bg: "rgba(239, 244, 255, 0.7)",
        box2Bg: "rgba(255, 218, 214, 0.4)",
        box2Border: "rgba(186, 26, 26, 0.2)",
        box3Bg: "rgba(255, 220, 195, 0.3)",
        box3Border: "rgba(199, 108, 0, 0.2)",
      };

  const total = Number(summary.totalThisMonth) || 0;
  const paid = Number(summary.totalPaid) || 0;
  const overdue = Number(summary.overdueAmount) || 0;
  
  const paidPct = total > 0 ? (paid / total) * 100 : 0;
  const overduePct = total > 0 ? (overdue / total) * 100 : 0;
  const pendingPct = total > 0 ? 100 - paidPct - overduePct : 0;

  return (
    <View style={{
      backgroundColor: theme.cardBg,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <View>
          <Text style={{ fontSize: 13, fontWeight: "500", color: theme.textSecondary }}>This Month Total</Text>
          <Text style={{ fontSize: 32, fontWeight: "800", color: theme.textPrimary, marginTop: 2, letterSpacing: -0.5 }}>
            <CurrencyText amount={summary.totalThisMonth} />
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor: theme.badgeBg,
            borderWidth: 1,
            borderColor: theme.badgeBorder,
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.badgeDot, marginRight: 6 }} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: theme.badgeText }}>
              {Math.round(paidPct)}% Settled
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>
            {summary.paidCount || 0} bills paid
          </Text>
        </View>
      </View>

      <View style={{ width: "100%", height: 8, backgroundColor: theme.progressBg, borderRadius: 4, flexDirection: "row", overflow: "hidden", marginVertical: 8 }}>
        <View style={{ width: `${paidPct}%`, height: "100%", backgroundColor: theme.progressFill }} />
        <View style={{ width: `${pendingPct}%`, height: "100%", backgroundColor: theme.progressSecond }} />
        <View style={{ width: `${overduePct}%`, height: "100%", backgroundColor: theme.progressThird }} />
      </View>

      <View style={{ flexDirection: "row", paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.cardBorder }}>
        <View style={{ flex: 1, padding: 8, borderRadius: 8, backgroundColor: theme.box1Bg, borderWidth: 1, borderColor: theme.cardBorder, marginRight: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
            <MaterialCommunityIcons name="check-circle" size={15} color={isDarkMode ? "#2dd4bf" : "#006a61"} />
            <Text style={{ fontSize: 11, color: theme.textSecondary, marginLeft: 4 }}>Paid</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: theme.textPrimary }}>
            <CurrencyText amount={summary.totalPaid} />
          </Text>
        </View>
        <View style={{ flex: 1, padding: 8, borderRadius: 8, backgroundColor: theme.box2Bg, borderWidth: 1, borderColor: theme.box2Border, marginRight: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
            <MaterialCommunityIcons name="alert" size={15} color={isDarkMode ? "#fda4af" : "#93000a"} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: isDarkMode ? "#fda4af" : "#93000a", marginLeft: 4 }}>Overdue ({summary.overdueCount || 0})</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: isDarkMode ? "#fecdd3" : "#93000a" }}>
            <CurrencyText amount={summary.overdueAmount} />
          </Text>
        </View>
        <View style={{ flex: 1, padding: 8, borderRadius: 8, backgroundColor: theme.box3Bg, borderWidth: 1, borderColor: theme.box3Border }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
            <MaterialCommunityIcons name="clock-outline" size={15} color={isDarkMode ? "#fbbf24" : "#c76c00"} />
            <Text style={{ fontSize: 11, color: theme.textSecondary, marginLeft: 4 }}>Next 7d</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: theme.textPrimary }}>
            <CurrencyText amount={summary.upcoming7} />
          </Text>
        </View>
      </View>
    </View>
  );
}

export default memo(BillSummaryBar);
