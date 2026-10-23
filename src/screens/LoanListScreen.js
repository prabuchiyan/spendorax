import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  TextInput,
  Platform,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getLoans } from "../services/loans";
import LoanCard from "../components/LoanCard";
import { Colors } from "../components/Theme";
import { useAppDispatch, useLoans } from '../redux/hooks';
import { setLoans } from '../redux/slices/loanSlice';
import events from "../services/events";

export default function LoanListScreen({ navigation, route }) {
  const dispatch = useAppDispatch();
  const reduxLoans = useLoans();
  const loans = reduxLoans || [];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(route?.params?.status || "ALL");
  const [directionFilter, setDirectionFilter] = useState(
    route?.params?.direction || "ALL",
  );

  const lastHandledParamsRef = useRef({
    status: route?.params?.status,
    direction: route?.params?.direction,
  });

  async function load() {
    const data = await getLoans();
    dispatch(setLoans(data));
  }

  // Handle incoming route params (e.g. from Dashboard or Drawer) without resetting on normal focus
  useEffect(() => {
    const nextStatus = route?.params?.status;
    const nextDirection = route?.params?.direction;

    if (
      nextStatus !== undefined &&
      nextStatus !== lastHandledParamsRef.current.status
    ) {
      setFilter(nextStatus || "ALL");
      lastHandledParamsRef.current.status = nextStatus;
    }

    if (
      nextDirection !== undefined &&
      nextDirection !== lastHandledParamsRef.current.direction
    ) {
      setDirectionFilter(nextDirection || "ALL");
      lastHandledParamsRef.current.direction = nextDirection;
    }
  }, [route?.params?.status, route?.params?.direction]);

  useEffect(() => {
    load();

    const unsub = navigation.addListener("focus", () => {
      load();
    });

    const offLoans = events.on("loansChanged", (payload) => {
      if (payload?.action === "recalculate") return;
      load();
    });

    const offPayments = events.on("loanPaymentsChanged", (payload) => {
      if (payload?.action === "recalculate") return;
      load();
    });

    const offTx = events.on("transactionsChanged", (payload) => {
      if (payload?.action === "recalculate" || payload?.action === "unlink") {
        return;
      }
      load();
    });

    return () => {
      unsub && unsub();
      offLoans && offLoans();
      offPayments && offPayments();
      offTx && offTx();
    };
  }, [navigation]);

  const stats = useMemo(() => {
    return {
      total: loans.length,
      active: loans.filter((l) => (l.status || "Active") === "Active").length,
      closed: loans.filter((l) => l.status === "Closed").length,
    };
  }, [loans]);

  const directionCounts = useMemo(() => {
    return {
      ALL: loans.length,
      BORROWED: loans.filter(
        (l) => (l.loan_direction || "BORROWED") === "BORROWED",
      ).length,
      LENT: loans.filter((l) => (l.loan_direction || "BORROWED") === "LENT")
        .length,
    };
  }, [loans]);

  const statusCounts = useMemo(() => {
    const pool =
      directionFilter === "ALL"
        ? loans
        : loans.filter(
            (l) => (l.loan_direction || "BORROWED") === directionFilter,
          );

    return {
      ALL: pool.length,
      Active: pool.filter((l) => (l.status || "Active") === "Active").length,
      Closed: pool.filter((l) => l.status === "Closed").length,
    };
  }, [loans, directionFilter]);

  const filtered = useMemo(() => {
    return [...loans]
      .filter((l) => {
        const matchesSearch = (l.loan_name || "")
          .toLowerCase()
          .includes(search.toLowerCase());

        const matchesFilter =
          filter === "ALL" ? true : (l.status || "Active") === filter;

        const matchesDirection =
          directionFilter === "ALL"
            ? true
            : (l.loan_direction || "BORROWED") === directionFilter;

        return matchesSearch && matchesFilter && matchesDirection;
      })
      .sort((a, b) => {
        // Active first
        if ((a.status || "Active") !== (b.status || "Active")) {
          return (a.status || "Active") === "Active" ? -1 : 1;
        }

        // Oldest loan first
        return (
          new Date(a.loan_start_date || 0) - new Date(b.loan_start_date || 0)
        );
      });
  }, [loans, search, filter, directionFilter]);

  const Chip = ({ title, value, bg, color, icon, isSelected, onPress }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: bg || "#fff",
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 20,
        marginHorizontal: 4,
        alignItems: "center",
        borderWidth: isSelected ? 2 : 1,
        borderColor: isSelected ? color : "transparent",
        elevation: isSelected ? 3 : 1,
        shadowColor: color,
        shadowOpacity: isSelected ? 0.2 : 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={14}
            color={color}
            style={{ marginRight: 4 }}
          />
        )}
        <Text
          style={{
            color: color,
            fontSize: 11,
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {title}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 26,
          fontWeight: "900",
          color: color,
        }}
      >
        {value}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.background,
      }}
    >
      <FlatList
        data={filtered}
        keyExtractor={(i) => String(i.id)}
        ListHeaderComponent={
          <>
            {/* Summary Chips */}
            <View
              style={{
                flexDirection: "row",
                marginBottom: 18,
              }}
            >
              <Chip
                title="Total"
                value={stats.total}
                bg="#F3E8FF"
                color="#9333EA"
                icon="finance"
                isSelected={filter === "ALL"}
                onPress={() => setFilter("ALL")}
              />
              <Chip
                title="Active"
                value={stats.active}
                bg="#DBEAFE"
                color="#2563EB"
                icon="lightning-bolt"
                isSelected={filter === "Active"}
                onPress={() => setFilter("Active")}
              />
              <Chip
                title="Closed"
                value={stats.closed}
                bg="#DCFCE7"
                color="#16A34A"
                icon="check-decagram"
                isSelected={filter === "Closed"}
                onPress={() => setFilter("Closed")}
              />
            </View>

            {/* Search Input */}
            <View
              style={{
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#FFFFFF",
                  borderRadius: 18,
                  height: 54,
                  paddingHorizontal: 16,
                  borderWidth: 1,
                  borderColor: "#E2E8F0",
                  elevation: 2,
                  shadowColor: "#000",
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  shadowOffset: {
                    width: 0,
                    height: 3,
                  },
                }}
              >
                <MaterialCommunityIcons
                  name="magnify"
                  size={22}
                  color="#64748B"
                />

                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search loans..."
                  placeholderTextColor="#94A3B8"
                  autoCorrect={false}
                  autoCapitalize="none"
                  underlineColorAndroid="transparent"
                  selectionColor={Colors.primary}
                  cursorColor={Colors.primary}
                  focusable={false}
                  style={[
                    {
                      flex: 1,
                      marginLeft: 12,
                      fontSize: 15,
                      color: "#111827",
                      paddingVertical: 0,
                      borderWidth: 0,
                    },
                    Platform.OS === "web" && {
                      outlineStyle: "none",
                    },
                  ]}
                />

                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch("")} hitSlop={10}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 1) Type Filter (Borrowed & Lent on TOP) */}
            <View style={styles.filterSection}>
              <View style={styles.filterHeader}>
                <View style={styles.filterHeaderLeft}>
                  <MaterialCommunityIcons
                    name="swap-horizontal-bold"
                    size={16}
                    color="#64748B"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.filterLabel}>Loan Type</Text>
                </View>
                <Text style={styles.filterSelectedHint}>
                  {directionFilter === "ALL"
                    ? "All types"
                    : directionFilter === "BORROWED"
                      ? "Borrowed only"
                      : "Lent only"}
                </Text>
              </View>

              <View style={styles.segmentContainer}>
                {[
                  {
                    key: "ALL",
                    label: "All",
                    icon: "layers-outline",
                    color: "#2563EB",
                  },
                  {
                    key: "BORROWED",
                    label: "Borrowed",
                    icon: "bank-outline",
                    color: "#2563EB",
                  },
                  {
                    key: "LENT",
                    label: "Lent",
                    icon: "hand-coin-outline",
                    color: "#D97706",
                  },
                ].map((tab) => {
                  const isActive = directionFilter === tab.key;
                  const count = directionCounts[tab.key] ?? 0;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => setDirectionFilter(tab.key)}
                      activeOpacity={0.75}
                      style={[
                        styles.segmentButton,
                        isActive && [
                          styles.segmentButtonActive,
                          { borderColor: tab.color + "30" },
                        ],
                      ]}
                    >
                      <View style={styles.tabContent}>
                        <MaterialCommunityIcons
                          name={tab.icon}
                          size={15}
                          color={isActive ? tab.color : "#64748B"}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.segmentText,
                            {
                              color: isActive ? tab.color : "#64748B",
                              fontWeight: isActive ? "800" : "600",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {tab.label}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.countBadge,
                          {
                            backgroundColor: isActive
                              ? tab.color + "18"
                              : "#E2E8F0",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.countBadgeText,
                            { color: isActive ? tab.color : "#64748B" },
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2) Status Filter (Active & Closed BELOW) */}
            <View style={[styles.filterSection, { marginBottom: 18 }]}>
              <View style={styles.filterHeader}>
                <View style={styles.filterHeaderLeft}>
                  <MaterialCommunityIcons
                    name="filter-variant"
                    size={16}
                    color="#64748B"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.filterLabel}>Status</Text>
                </View>
                <Text style={styles.filterSelectedHint}>
                  {filter === "ALL" ? "All statuses" : filter}
                </Text>
              </View>

              <View style={styles.segmentContainer}>
                {[
                  {
                    key: "ALL",
                    label: "All",
                    icon: "all-inclusive",
                    color: "#6366F1",
                  },
                  {
                    key: "Active",
                    label: "Active",
                    icon: "lightning-bolt",
                    color: "#2563EB",
                  },
                  {
                    key: "Closed",
                    label: "Closed",
                    icon: "check-decagram",
                    color: "#16A34A",
                  },
                ].map((tab) => {
                  const isActive = filter === tab.key;
                  const count = statusCounts[tab.key] ?? 0;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => setFilter(tab.key)}
                      activeOpacity={0.75}
                      style={[
                        styles.segmentButton,
                        isActive && [
                          styles.segmentButtonActive,
                          { borderColor: tab.color + "30" },
                        ],
                      ]}
                    >
                      <View style={styles.tabContent}>
                        <MaterialCommunityIcons
                          name={tab.icon}
                          size={15}
                          color={isActive ? tab.color : "#64748B"}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.segmentText,
                            {
                              color: isActive ? tab.color : "#64748B",
                              fontWeight: isActive ? "800" : "600",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {tab.label}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.countBadge,
                          {
                            backgroundColor: isActive
                              ? tab.color + "18"
                              : "#E2E8F0",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.countBadgeText,
                            { color: isActive ? tab.color : "#64748B" },
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate("LoanDetails", {
                id: item.id,
              })
            }
          >
            <LoanCard loan={item} />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View
            style={{
              alignItems: "center",
              marginTop: 80,
            }}
          >
            <MaterialCommunityIcons
              name="bank-off-outline"
              size={60}
              color="#CBD5E1"
            />

            <Text
              style={{
                marginTop: 16,
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              No loans found
            </Text>

            <Text
              style={{
                color: Colors.muted,
                marginTop: 6,
              }}
            >
              Add a loan to start tracking.
            </Text>
          </View>
        }
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 120,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filterSection: {
    marginBottom: 12,
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  filterHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  filterSelectedHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },
  segmentContainer: {
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    flexDirection: "row",
    gap: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 11,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  segmentButtonActive: {
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
  },
  tabContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  segmentText: {
    fontSize: 12,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
});

