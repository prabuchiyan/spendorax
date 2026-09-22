import React, {
  useEffect,
  useState,
  useLayoutEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import ContextualFAB from '../components/ContextualFAB';
import {
  getTransactionsPaginated,
  getSourceTransactionBalance,
} from "../services/transactions";
import { getCategories } from "../services/categories";
import { getSources } from "../services/sources";
import { Colors, Spacing } from "../components/Theme";

import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import TransactionListItem from "../components/TransactionListItem";
import { useFocusEffect } from "@react-navigation/native";
import { useBalanceVisibility } from "../context/BalanceVisibilityContext";
import { parseDate } from "../utils/dateUtils";

function PageLoader({ message = "Loading transactions..." }) {
  const rotation = React.useRef(new Animated.Value(0)).current;

  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const rotateAnimation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),

        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    rotateAnimation.start();
    pulseAnimation.start();

    return () => {
      rotateAnimation.stop();
      pulseAnimation.stop();
    };
  }, []);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.06],
  });

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 1],
  });

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.background,
      }}
    >
      {/* OUTER LOADER */}
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,

          alignItems: "center",
          justifyContent: "center",

          backgroundColor: "#FFFFFF",

          borderWidth: 1,
          borderColor: "#ECEEF1",

          shadowColor: "#000",

          shadowOffset: {
            width: 0,
            height: 4,
          },

          shadowOpacity: 0.08,
          shadowRadius: 10,

          elevation: 4,
        }}
      >
        {/* ROTATING RING */}
        <Animated.View
          style={{
            position: "absolute",

            width: 58,
            height: 58,

            borderRadius: 29,

            borderWidth: 3,

            borderColor: "#E5E7EB",

            borderTopColor: "#5B67F1",

            transform: [
              {
                rotate: spin,
              },
            ],
          }}
        />

        {/* CENTER ICON */}
        <Animated.View
          style={{
            transform: [
              {
                scale,
              },
            ],

            opacity,
          }}
        >
          <MaterialCommunityIcons
            name="wallet-outline"
            size={25}
            color="#5B67F1"
          />
        </Animated.View>
      </View>

      {/* TEXT */}
      <Text
        style={{
          marginTop: 18,

          fontSize: 14,

          fontWeight: "800",

          color: Colors.text,
        }}
      >
        {message}
      </Text>

      <Text
        style={{
          marginTop: 5,

          fontSize: 11,

          color: Colors.muted,
        }}
      >
        Please wait...
      </Text>
    </View>
  );
}

export default function SourcesDetails({ route, navigation }) {
  const { sourceId, sourceName } = route.params || {};

  const { balanceVisible } = useBalanceVisibility();

  const [transactions, setTransactions] = useState([]);

  const [categoriesMap, setCategoriesMap] = useState({});

  const [sourcesMap, setSourcesMap] = useState({});

  const [source, setSource] = useState(null);

  const [loading, setLoading] = useState(true);

  const [groupMode, setGroupMode] = useState("weekly");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sourceBalance, setSourceBalance] = useState(0);
  const LIMIT = 30;
  const loadedCountRef = useRef(LIMIT);

  const groupOptions = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
  ];

  // HEADER
  useLayoutEffect(() => {
    navigation.setOptions({
      title: sourceName || "Source",
    });
  }, [navigation, sourceName]);

  const loadInitialData = useCallback(
    async (isSilent = false) => {
      if (sourceId === null || sourceId === undefined) {
        setTransactions([]);
        setSource(null);
        setLoading(false);
        return;
      }

      try {
        if (!isSilent) setLoading(true);

        const currentLimit = isSilent
          ? Math.max(loadedCountRef.current, LIMIT)
          : LIMIT;

        const [txData, catData, sourceData, balance] = await Promise.all([
          getTransactionsPaginated({
            limit: currentLimit,
            offset: 0,
            sourceId: Number(sourceId),
          }),
          getCategories(true),
          getSources(true),
          getSourceTransactionBalance(Number(sourceId)),
        ]);

        const categoryMap = {};
        if (Array.isArray(catData)) {
          catData.forEach((c) => (categoryMap[c.id] = c));
        }

        const sourceMap = {};
        if (Array.isArray(sourceData)) {
          sourceData.forEach((s) => (sourceMap[s.id] = s));
        }

        const currentSource =
          (Array.isArray(sourceData) ? sourceData : []).find(
            (s) => Number(s.id) === Number(sourceId),
          ) || null;

        setCategoriesMap(categoryMap);
        setSourcesMap(sourceMap);
        setSource(currentSource);
        setTransactions(txData || []);
        setSourceBalance(balance || 0);

        if (!isSilent) {
          setPage(1);
          loadedCountRef.current = LIMIT;
        }

        setHasMore((txData || []).length === currentLimit);
      } catch (error) {
        console.error("Error loading initial data:", error);
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [sourceId],
  );

  const loadMoreData = async () => {
    if (loadingMore || !hasMore || loading) return;
    try {
      setLoadingMore(true);
      const newItems = await getTransactionsPaginated({
        limit: LIMIT,
        offset: page * LIMIT,
        sourceId: Number(sourceId),
      });
      if (newItems && newItems.length > 0) {
        setTransactions((prev) => [...prev, ...newItems]);
        setPage((prev) => {
          const newPage = prev + 1;
          loadedCountRef.current = newPage * LIMIT;
          return newPage;
        });
        setHasMore(newItems.length === LIMIT);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading more:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // REFRESH WHEN SCREEN FOCUSED
  useFocusEffect(
    useCallback(() => {
      loadInitialData(true);
    }, [loadInitialData]),
  );

  // EDIT TRANSACTION
  const handleEdit = useCallback(
    (item) => {
      navigation.navigate("TransactionAdd", {
        isEdit: true,
        transaction: item,
      });
    },
    [navigation],
  );

  // BALANCE
  const totalBalance = useMemo(() => {
    const initialBalance = Number(source?.initial_balance || 0);
    return initialBalance + sourceBalance;
  }, [source, sourceBalance]);

  // GROUP TRANSACTIONS
  const groupedTransactions = useMemo(() => {
    const groups = {};

    const getGroupDate = (date) => {
      if (groupMode === "weekly") {
        const startOfWeek = new Date(date);
        const day = startOfWeek.getDay();
        const diff = (day + 6) % 7;
        startOfWeek.setDate(startOfWeek.getDate() - diff);
        startOfWeek.setHours(0, 0, 0, 0);
        return startOfWeek;
      }

      if (groupMode === "monthly") {
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        return monthStart;
      }

      const dayOnly = new Date(date);
      dayOnly.setHours(0, 0, 0, 0);
      return dayOnly;
    };

    const getGroupKey = (date) => {
      const groupDate = getGroupDate(date);

      if (groupMode === "weekly") {
        return `${groupDate.getFullYear()}-${String(groupDate.getMonth() + 1).padStart(2, "0")}-${String(groupDate.getDate()).padStart(2, "0")}`;
      }

      if (groupMode === "monthly") {
        return `${groupDate.getFullYear()}-${String(groupDate.getMonth() + 1).padStart(2, "0")}`;
      }

      return `${groupDate.getFullYear()}-${String(groupDate.getMonth() + 1).padStart(2, "0")}-${String(groupDate.getDate()).padStart(2, "0")}`;
    };

    transactions.forEach((item) => {
      const date = parseDate(item.date);

      if (!date) {
        return;
      }

      const key = getGroupKey(date);

      if (!groups[key]) {
        groups[key] = {
          date: getGroupDate(date),
          items: [],
        };
      }

      groups[key].items.push(item);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((groupKey) => {
        const groupDate = groups[groupKey].date;
        const items = groups[groupKey].items;

        let title;

        if (groupMode === "daily") {
          if (groupDate.getTime() === today.getTime()) {
            title = "Today";
          } else if (groupDate.getTime() === yesterday.getTime()) {
            title = "Yesterday";
          } else {
            title = groupDate.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
          }
        } else if (groupMode === "weekly") {
          const weekEnd = new Date(groupDate);
          weekEnd.setDate(weekEnd.getDate() + 6);
          title = `Week of ${groupDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - ${weekEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
        } else {
          title = groupDate.toLocaleDateString("en-IN", {
            month: "short",
            year: "numeric",
          });
        }

        const income = items.reduce((sum, item) => {
          const type = String(item.type || "").toLowerCase();
          if (type === "income" || type === "credit") {
            return sum + Number(item.amount || 0);
          }
          if (type === "transfer" && String(item.toAccount) === String(sourceId)) {
            return sum + Number(item.amount || 0);
          }
          return sum;
        }, 0);

        const expense = items.reduce((sum, item) => {
          const type = String(item.type || "").toLowerCase();
          if (type === "expense" || type === "debit") {
            return sum + Number(item.amount || 0);
          }
          if (type === "transfer" && String(item.source_id) === String(sourceId)) {
            return sum + Number(item.amount || 0);
          }
          return sum;
        }, 0);

        return {
          title,
          dateKey: groupKey,
          data: items,
          dailyIncome: income,
          dailyExpense: expense,
        };
      });
  }, [transactions, parseDate, groupMode]);

  // TRANSACTION CARD
  const renderItem = useCallback(
    ({ item, index, section }) => {
      const category = categoriesMap[item.category_id] || {};

      const isLast = index === section.data.length - 1;

      const transactionSource = sourcesMap[item.source_id] || null;
      const transactionToSource = item.toAccount ? (sourcesMap[item.toAccount] || null) : null;

      // CARD
      return (
        <TransactionListItem
          item={item}
          category={category}
          source={transactionSource}
          toSource={transactionToSource}
          currentSourceId={sourceId}
          isLast={isLast}
          showDate={true}
          hideAmount={!balanceVisible}
          onPress={() => handleEdit(item)}
        />
      );
    },
    [categoriesMap, source, balanceVisible, handleEdit],
  );

  const isCreditCard = String(source?.type || '').toLowerCase() === 'credit_card';

  // SCREEN
  return (
    <View style={styles.container}>
      {/* BALANCE */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{isCreditCard ? 'Total Outstanding' : 'Available Balance'}</Text>

        <Text style={styles.heroAmount}>
          {balanceVisible
            ? `₹ ${totalBalance.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "••••••"}
        </Text>

        {isCreditCard && (
           <TouchableOpacity 
             style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#F0F5FF', borderRadius: 20 }}
             onPress={() => navigation.navigate('CreditCardStatements', { sourceId: source?.id })}
           >
             <MaterialCommunityIcons name="file-document-outline" size={15} color="#4B7CF3" style={{ marginRight: 6 }} />
             <Text style={{ fontSize: 13, fontWeight: '700', color: '#4B7CF3' }}>View Statements</Text>
           </TouchableOpacity>
        )}
      </View>

      {/* HEADER */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Recent Activity</Text>

          <Text style={styles.headerSubtitle}>
            Transactions from this source
          </Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countText}>{transactions.length}</Text>
        </View>
      </View>

      {/* GROUPING MODE CHIPS */}
      <View style={styles.chipContainer}>
        {groupOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            onPress={() => setGroupMode(option.key)}
            style={{
              ...styles.chip,

              backgroundColor: groupMode === option.key ? "#5B67F1" : "#F0F1F3",
            }}
          >
            <Text
              style={{
                ...styles.chipText,

                color: groupMode === option.key ? "#FFFFFF" : "#6B7280",
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* CONTENT */}

      {loading ? (
        <PageLoader message="Loading transactions..." />
      ) : transactions.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={36}
              color="#AEB4BC"
            />
          </View>

          <Text style={styles.emptyTitle}>No transactions found</Text>

          <Text style={styles.emptySubtitle}>
            Transactions for this source will appear here
          </Text>
        </View>
      ) : (
        <SectionList
          sections={groupedTransactions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          onEndReached={loadMoreData}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={Colors.text} />
              </View>
            ) : null
          }
          contentContainerStyle={{
            paddingBottom: 40,

            paddingHorizontal: 1,
          }}
          renderSectionHeader={({ section }) => (
            <View
              style={{
                paddingTop: 9,

                paddingBottom: 7,

                backgroundColor: Colors.background,
              }}
            >
              <View
                style={{
                  flexDirection: "row",

                  alignItems: "center",

                  justifyContent: "space-between",
                }}
              >
                {/* DATE */}

                <View>
                  <Text
                    style={{
                      fontSize: 13,

                      fontWeight: "900",

                      color: Colors.text,

                      textTransform: "uppercase",

                      letterSpacing: 0.4,
                    }}
                  >
                    {section.title}
                  </Text>

                  <Text
                    style={{
                      fontSize: 11,

                      color: Colors.muted,

                      marginTop: 2,
                    }}
                  >
                    {section.data.length}{" "}
                    {section.data.length === 1 ? "transaction" : "transactions"}
                  </Text>
                </View>

                {/* DAILY TOTAL */}
                <View
                  style={{
                    flexDirection: "row",

                    alignItems: "center",
                  }}
                >
                  {section.dailyIncome > 0 && (
                    <Text
                      style={{
                        color: "#20A56A",

                        fontSize: 11,

                        fontWeight: "800",

                        marginRight: 8,
                      }}
                    >
                      +₹
                      {section.dailyIncome.toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  )}

                  {section.dailyExpense > 0 && (
                    <Text
                      style={{
                        color: "#E35D6A",

                        fontSize: 11,

                        fontWeight: "800",
                      }}
                    >
                      -₹
                      {section.dailyExpense.toLocaleString("en-IN", {
                        maximumFractionDigits: 0,
                      })}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      )}

      <ContextualFAB
        icon="plus"
        actions={[
          {
            icon: 'arrow-down',
            label: 'Expense',
            color: '#E35D6A',
            style: { backgroundColor: '#fff' },
            onPress: () => navigation.navigate("TransactionAdd", { sourceId: Number(sourceId), initialType: 'expense' }),
          },
          {
            icon: 'arrow-up',
            label: 'Income',
            color: '#3F8F6B',
            style: { backgroundColor: '#fff' },
            onPress: () => navigation.navigate("TransactionAdd", { sourceId: Number(sourceId), initialType: 'income' }),
          },
          {
            icon: 'swap-horizontal',
            label: 'Transfer',
            color: '#4B7CF3',
            style: { backgroundColor: '#fff' },
            onPress: () => navigation.navigate("TransactionAdd", { sourceId: Number(sourceId), initialType: 'transfer' }),
          },
        ]}
        style={{
          position: "absolute",
          bottom: 70,
          right: 20,
          zIndex: 20,
          elevation: 20,
        }}
      />
    </View>
  );
}

// STYLES
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.xs,
  },
  hero: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 14,
    alignItems: "center",
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#F0F1F3",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: 25,
    fontWeight: "900",
    color: Colors.text,
    marginTop: 7,
    letterSpacing: -0.5,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  countBadge: {
    minWidth: 30,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EEF0F3",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#EEF0F3",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 14,
  },
  emptySubtitle: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 5,
    textAlign: "center",
    maxWidth: 260,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  chipContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  chip: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
});
