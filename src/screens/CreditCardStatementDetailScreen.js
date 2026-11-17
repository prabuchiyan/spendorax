import React, { useState, useCallback, useEffect, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getCreditCardStatementById, getStatementTransactions } from "../services/creditCards";
import { healBogusStatementRefunds } from "../services/creditCardScheduler";
import { Colors, Spacing } from "../components/Theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import ContextualFAB from "../components/ContextualFAB";
import CurrencyText from "../components/CurrencyText";
import { formatCurrency } from "../utils/numberUtils";
import events from "../services/events";
import { useTheme } from "../context/ThemeContext";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(String(value).slice(0, 10));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export default function CreditCardStatementDetailScreen({ route, navigation }) {
  const { isDarkMode, theme } = useTheme();
  const { statementId } = route.params;
  const [statement, setStatement] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      try {
        await healBogusStatementRefunds();
      } catch (e) {
        console.warn("[CreditCardStatementDetail] Healing error:", e);
      }
      const st = await getCreditCardStatementById(statementId);
      if (st) {
        setStatement(st);
        if (st.source_id) {
          const txs = await getStatementTransactions(st.source_id, st.statement_start, st.statement_end);
          setTransactions(txs);
        }
      }
    } catch (err) {
      console.error("Failed to load statement details", err);
    } finally {
      setLoading(false);
    }
  }, [statementId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    const unsub = events.on("statementChanged", () => {
      loadData();
    });
    return () => unsub();
  }, [loadData]);

  useLayoutEffect(() => {
    if (statement) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate("CreditCardStatementEdit", { editData: statement })}
            style={{ marginRight: 16, padding: 6 }}
          >
            <MaterialCommunityIcons name="pencil-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation, statement]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!statement) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Statement not found.</Text>
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      <View style={[styles.headerCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: theme.isDark ? 1 : 0, borderTopColor: statement.card_color || Colors.primary }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.bankName, { color: theme.textPrimary }]}>{statement.card_name || "Credit Card"}</Text>
            <Text style={[styles.statementTitle, { color: theme.textSecondary }]}>E-Statement</Text>
          </View>
          <MaterialCommunityIcons name="credit-card-chip" size={32} color="#D4AF37" />
        </View>

        <View style={styles.datesRow}>
          <View>
            <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>Statement Date</Text>
            <Text style={[styles.dateValue, { color: theme.textPrimary }]}>{formatDate(statement.statement_date)}</Text>
          </View>
          <View>
            <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>Payment Due Date</Text>
            <Text style={styles.dateValueError}>{formatDate(statement.due_date)}</Text>
          </View>
        </View>

        <View style={styles.periodRow}>
          <Text style={[styles.periodText, { color: theme.textSecondary }]}>
            Billing Period: {formatDate(statement.statement_start)} - {formatDate(statement.statement_end)}
          </Text>
        </View>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: theme.isDark ? 1 : 0 }]}>
        <View style={styles.summaryHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Account Summary</Text>
          <TouchableOpacity
            style={styles.summaryEditBtn}
            onPress={() => navigation.navigate("CreditCardStatementEdit", { editData: statement })}
          >
            <MaterialCommunityIcons name="pencil" size={14} color={Colors.primary} />
            <Text style={styles.summaryEditBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Opening Balance</Text>
            <CurrencyText style={[styles.summaryValue, { color: theme.textPrimary }]} amount={statement.opening_balance} />
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Purchases & Debits</Text>
            <CurrencyText style={[styles.summaryValue, { color: theme.textPrimary }]} amount={statement.purchases} />
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Payments & Credits</Text>
            <CurrencyText
              style={styles.summaryValueSuccess}
              amount={(Number(statement.payments) || 0) + (Number(statement.refunds) || 0)}
            />
            {Number(statement.refunds || 0) > 0 && (
              <Text style={styles.breakdownTextSuccess}>
                Includes {formatCurrency(statement.refunds)} refunds
              </Text>
            )}
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Fees & Interest</Text>
            <CurrencyText
              style={styles.summaryValue}
              amount={(Number(statement.fees) || 0) + (Number(statement.interest) || 0)}
            />
            {(Number(statement.fees || 0) > 0 || Number(statement.interest || 0) > 0) && (
              <Text style={styles.breakdownText}>
                {[
                  Number(statement.fees || 0) > 0 ? `Fees: ${formatCurrency(statement.fees)}` : null,
                  Number(statement.interest || 0) > 0 ? `Interest: ${formatCurrency(statement.interest)}` : null,
                ].filter(Boolean).join(", ")}
              </Text>
            )}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.totalsRow}>
          <View>
            <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Total Amount Due</Text>
            <CurrencyText style={[styles.totalValue, { color: theme.textPrimary }]} amount={statement.closing_balance} />
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Minimum Amount Due</Text>
            <CurrencyText style={[styles.totalValueSecondary, { color: theme.textPrimary }]} amount={statement.minimum_due} />
          </View>
        </View>
      </View>

      <Text style={[styles.transactionsHeader, { color: theme.textPrimary }]}>Transaction Details</Text>
    </View>
  );

  const renderTransaction = ({ item }) => {
    const isCredit = item.type === "income" || item.type === "transfer_in";
    const isNotCounted =
      item.is_counted !== null &&
      item.is_counted !== undefined &&
      Number(item.is_counted) === 0;

    return (
      <View style={[styles.transactionRow, { borderBottomColor: theme.border }]}>
        <View style={styles.txDateCol}>
          <Text style={[styles.txDate, { color: theme.textPrimary }]}>{formatDate(item.date).split(" ")[0]}</Text>
          <Text style={[styles.txMonth, { color: theme.textSecondary }]}>{formatDate(item.date).split(" ")[1]}</Text>
        </View>
        <View style={styles.txDetailsCol}>
          <Text style={[styles.txNote, { color: theme.textPrimary }]} numberOfLines={2}>
            {item.notes || item.category_name || item.type || "Transaction"}
          </Text>
          {item.payee && <Text style={[styles.txPayee, { color: theme.textSecondary }]}>{item.payee}</Text>}
          {isNotCounted && (
            <View style={styles.notCountedTag}>
              <Text style={styles.notCountedTagText}>
                {item.type === "expense" ? "Not a Spend" : "Not a Income"}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.txAmountCol}>
          <CurrencyText
            style={[styles.txAmount, isCredit && styles.txAmountCredit]}
            amount={item.amount}
          />
          <Text style={styles.txCrDr}>{isCredit ? "CR" : "DR"}</Text>
        </View>
      </View>
    );
  };

  const isStatementPaid = (stmt) => {
    if (!stmt) return false;
    const isBillPaid =
      Number(stmt.bill_is_paid) === 1 ||
      stmt.bill_is_paid === true ||
      stmt.bill_is_paid === "1" ||
      String(stmt.bill_is_paid).toLowerCase() === "true";
    const isStatusPaid =
      String(stmt.bill_status).toLowerCase() === "paid" ||
      String(stmt.status).toLowerCase() === "paid";
    const closingBal = Number(stmt.closing_balance || 0);
    const isBalancePaid = closingBal <= 0;
    return isBillPaid || isStatusPaid || isBalancePaid;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        renderItem={renderTransaction}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="text-box-remove-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No transactions found for this period.</Text>
          </View>
        }
      />

      {statement.bill_id && !isStatementPaid(statement) && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.payButton}
            onPress={() =>
              navigation.navigate("BillDetail", {
                billId: statement.bill_id,
                occurrenceId: statement.bill_id,
              })
            }
          >
            <Text style={styles.payButtonText}>View & Pay Bill</Text>
          </TouchableOpacity>
        </View>
      )}

      <ContextualFAB
        onPress={() => navigation.navigate("CreditCardStatementEdit", { editData: statement })}
        icon="pencil"
        style={{ marginBottom: statement.bill_id && !isStatementPaid(statement) ? 100 : 0 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: Colors.muted,
    fontSize: 16,
  },
  listContent: {
    padding: Spacing.m,
    paddingBottom: 100,
  },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: Spacing.m,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderTopWidth: 6,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  bankName: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: 0.5,
  },
  statementTitle: {
    fontSize: 14,
    color: Colors.muted,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  datesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
  },
  dateLabel: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  dateValueError: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626",
  },
  periodRow: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
  },
  periodText: {
    fontSize: 13,
    color: Colors.muted,
    textAlign: "center",
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: Spacing.l,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  summaryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  summaryEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  summaryEditBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
    marginLeft: 4,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  summaryItem: {
    width: "48%",
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
  },
  summaryValueSuccess: {
    fontSize: 15,
    fontWeight: "600",
    color: "#059669",
  },
  breakdownTextSuccess: {
    fontSize: 11,
    color: "#059669",
    marginTop: 2,
    fontWeight: "500",
  },
  breakdownText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 12,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 13,
    color: Colors.muted,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
  },
  totalValueSecondary: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  transactionsHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 12,
    marginLeft: 4,
  },
  transactionRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  txDateCol: {
    width: 50,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#F3F4F6",
    paddingRight: 10,
    marginRight: 10,
  },
  txDate: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text,
  },
  txMonth: {
    fontSize: 12,
    color: Colors.muted,
    textTransform: "uppercase",
  },
  txDetailsCol: {
    flex: 1,
    justifyContent: "center",
  },
  txNote: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 2,
  },
  txPayee: {
    fontSize: 13,
    color: Colors.muted,
  },
  notCountedTag: {
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  notCountedTagText: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "600",
  },
  txAmountCol: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 10,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
  },
  txAmountCredit: {
    color: "#059669",
  },
  txCrDr: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.muted,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    color: Colors.muted,
    marginTop: 10,
    fontSize: 15,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  payButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  payButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
