import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

const ACTIONS = {
  add: {
    color: "#2563EB",
    bg: "#DBEAFE",
    icon: "plus-circle-outline",
    label: "Add Loan",
  },
  pay: {
    color: "#16A34A",
    bg: "#DCFCE7",
    icon: "cash-fast",
    label: "Pay EMI",
  },
  prepay: {
    color: "#EA580C",
    bg: "#FFEDD5",
    icon: "trending-up",
    label: "Prepay",
  },
  receive: {
    color: "#16A34A",
    bg: "#DCFCE7",
    icon: "cash-plus",
    label: "Receive",
  },
  lendMore: {
    color: "#7C3AED",
    bg: "#EDE9FE",
    icon: "hand-coin-outline",
    label: "Lend More",
  },
  all: {
    color: "#7C3AED",
    bg: "#EDE9FE",
    icon: "view-grid-outline",
    label: "All Loans",
  },
};

function QuickButton({ action, customLabel, onPress, theme, isDarkMode }) {
  const actionTheme = ACTIONS[action];

  if (!actionTheme || !onPress) return null;

  const label = customLabel || actionTheme.label;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
        },
      ]}
      activeOpacity={0.82}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: isDarkMode
              ? `${actionTheme.color}24`
              : actionTheme.bg,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={actionTheme.icon}
          size={21}
          color={actionTheme.color}
        />
      </View>

      <Text
        style={[styles.label, { color: theme.textPrimary }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function LoanQuickActions({
  actions = ["add", "pay", "prepay", "all"],
  actionLabels = {},
  onAdd,
  onPay,
  onPrepay,
  onReceive,
  onLendMore,
  onAll,
  onActionPress,
}) {
  const { theme, isDarkMode } = useTheme();

  const handlers = {
    add: onAdd,
    pay: onPay,
    prepay: onPrepay,
    receive: onReceive,
    lendMore: onLendMore,
    all: onAll,
  };

  return (
    <View style={styles.container}>
      {actions.map((action) => (
        <QuickButton
          key={action}
          action={action}
          customLabel={actionLabels[action]}
          theme={theme}
          isDarkMode={isDarkMode}
          onPress={
            handlers[action] ||
            (onActionPress ? () => onActionPress(action) : undefined)
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 14,
  },
});
