import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  TextInput,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getLoans } from "../services/loans";
import LoanCard from "../components/LoanCard";
import { Colors } from "../components/Theme";
import { useAppDispatch, useLoans } from '../redux/hooks';
import { setLoans } from '../redux/slices/loanSlice';

export default function LoanListScreen({ navigation, route }) {
  const dispatch = useAppDispatch();
  const reduxLoans = useLoans();
  const loans = reduxLoans || [];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(route?.params?.status || "ALL");
  const [directionFilter, setDirectionFilter] = useState(
    route?.params?.direction || "ALL",
  );

  async function load() {
    const data = await getLoans();
    dispatch(setLoans(data));
  }

  useEffect(() => {
    const applyParams = () => {
      const status = route?.params?.status;
      const direction = route?.params?.direction;

      setFilter(status || "ALL");
      setDirectionFilter(direction || "ALL");

      load();
    };

    applyParams();

    const unsub = navigation.addListener("focus", applyParams);

    return unsub;
  }, [navigation, route]);

  const stats = useMemo(() => {
    return {
      total: loans.length,
      active: loans.filter((l) => (l.status || "Active") === "Active").length,
      closed: loans.filter((l) => l.status === "Closed").length,
    };
  }, [loans]);

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

  const Chip = ({ title, value, bg, color, icon }) => (
    <View
      style={{
        flex: 1,
        backgroundColor: bg || "#fff",
        padding: 16,
        borderRadius: 20,
        marginHorizontal: 5,
        alignItems: "center",
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {icon && <MaterialCommunityIcons name={icon} size={14} color={color} style={{ marginRight: 4 }} />}
        <Text style={{ color: color, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 28,
          fontWeight: "900",
          color: color,
        }}
      >
        {value}
      </Text>
    </View>
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
            {/* Summary */}

            <View
              style={{
                flexDirection: "row",
                marginBottom: 20,
              }}
            >
              <Chip title="Total" value={stats.total} bg="#F3E8FF" color="#9333EA" icon="finance" />
              <Chip title="Active" value={stats.active} bg="#DBEAFE" color="#2563EB" icon="lightning-bolt" />
              <Chip title="Closed" value={stats.closed} bg="#DCFCE7" color="#16A34A" icon="check-decagram" />
            </View>

            {/* Search */}
            <View
              style={{
                marginBottom: 18,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#FFFFFF",
                  borderRadius: 18,
                  height: 56,
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

            {/* Filter */}
            {/* Filter */}
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#64748B", marginBottom: 8, marginLeft: 4 }}>Status Filter</Text>
            <View style={{ backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, flexDirection: 'row', marginBottom: 18 }}>
              {["ALL", "Active", "Closed"].map((f) => {
                const isActive = filter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setFilter(f)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: isActive ? '#fff' : 'transparent',
                      alignItems: 'center',
                      elevation: isActive ? 2 : 0,
                      shadowColor: '#000',
                      shadowOpacity: isActive ? 0.05 : 0,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                    }}
                  >
                    <Text style={{ color: isActive ? Colors.primary : "#64748B", fontWeight: isActive ? "800" : "600", fontSize: 13 }}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            {/* Direction Filter */}
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#64748B", marginBottom: 8, marginLeft: 4 }}>Type Filter</Text>
            <View style={{ backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, flexDirection: 'row', marginBottom: 18 }}>
              {["ALL", "BORROWED", "LENT"].map((d) => {
                const isActive = directionFilter === d;
                const label = d === "ALL" ? "All" : d === "BORROWED" ? "Borrowed" : "Lent";
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDirectionFilter(d)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: isActive ? '#fff' : 'transparent',
                      alignItems: 'center',
                      elevation: isActive ? 2 : 0,
                      shadowColor: '#000',
                      shadowOpacity: isActive ? 0.05 : 0,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                    }}
                  >
                    <Text style={{ color: isActive ? Colors.primary : "#64748B", fontWeight: isActive ? "800" : "600", fontSize: 13 }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
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
