import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

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
    bg: "#FED7AA",
    icon: "trending-up",
    label: "Prepay",
  },
  all: {
    color: "#7C3AED",
    bg: "#EDE9FE",
    icon: "view-grid-outline",
    label: "All Loans",
  },
};

function QuickButton({ action, onPress }) {
  const theme = ACTIONS[action];

  if (!theme || !onPress) return null;

  return (
    <TouchableOpacity
      style={styles.button}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: theme.bg,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={theme.icon}
          size={22}
          color={theme.color}
        />
      </View>

      <Text style={styles.label}>{theme.label}</Text>
    </TouchableOpacity>
  );
}

export default function LoanQuickActions({
  actions = ["add", "pay", "prepay", "all"],
  onAdd,
  onPay,
  onPrepay,
  onAll,
}) {
  const handlers = {
    add: onAdd,
    pay: onPay,
    prepay: onPrepay,
    all: onAll,
  };

  return (
    <View style={styles.container}>
      {actions.map((action) => (
        <QuickButton key={action} action={action} onPress={handlers[action]} />
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
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: "700",
    color: "#374151",
    textAlign: "center",
  },
});
