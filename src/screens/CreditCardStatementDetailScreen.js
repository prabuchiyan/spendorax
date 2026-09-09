import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getCreditCardStatementById, getStatementTransactions, updateCreditCardStatement } from "../services/creditCards";
import { Colors, Spacing } from "../components/Theme";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import FAB from "../components/FAB";
import CreditCardStatementEditModal from "../components/CreditCardStatementEditModal";

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

function formatAmount(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function CreditCardStatementDetailScreen({ route, navigation }) {
  const { statementId } = route.params;
  const [statement, setStatement] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
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
      <View style={[styles.headerCard, { borderTopColor: statement.card_color || Colors.primary }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.bankName}>{statement.card_name || "Credit Card"}</Text>
            <Text style={styles.statementTitle}>E-Statement</Text>
          </View>
          <MaterialCommunityIcons name="credit-card-chip" size={32} color="#D4AF37" />
        </View>

        <View style={styles.datesRow}>
          <View>
            <Text style={styles.dateLabel}>Statement Date</Text>
            <Text style={styles.dateValue}>{formatDate(statement.statement_date)}</Text>
          </View>
          <View>
            <Text style={styles.dateLabel}>Payment Due Date</Text>
            <Text style={styles.dateValueError}>{formatDate(statement.due_date)}</Text>
          </View>
        </View>

        <View style={styles.periodRow}>
          <Text style={styles.periodText}>
            Billing Period: {formatDate(statement.statement_start)} - {formatDate(statement.statement_end)}
          </Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Account Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Opening Balance</Text>
            <Text style={styles.summaryValue}>{formatAmount(statement.opening_balance)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Purchases & Debits</Text>
            <Text style={styles.summaryValue}>{formatAmount(statement.purchases)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Payments & Credits</Text>
            <Text style={styles.summaryValueSuccess}>{formatAmount((Number(statement.payments) || 0) + (Number(statement.refunds) || 0))}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Fees & Interest</Text>
            <Text style={styles.summaryValue}>{formatAmount((Number(statement.fees) || 0) + (Number(statement.interest) || 0))}</Text>
          </View>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.totalsRow}>
          <View>
            <Text style={styles.totalLabel}>Total Amount Due</Text>
            <Text style={styles.totalValue}>{formatAmount(statement.closing_balance)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.totalLabel}>Minimum Amount Due</Text>
            <Text style={styles.totalValueSecondary}>{formatAmount(statement.minimum_due)}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.transactionsHeader}>Transaction Details</Text>
    </View>
  );

  const renderTransaction = ({ item }) => {
    const isCredit = item.type === "income" || item.type === "transfer_in";
    return (
      <View style={styles.transactionRow}>
        <View style={styles.txDateCol}>
          <Text style={styles.txDate}>{formatDate(item.date).split(' ')[0]}</Text>
          <Text style={styles.txMonth}>{formatDate(item.date).split(' ')[1]}</Text>
        </View>
        <View style={styles.txDetailsCol}>
          <Text style={styles.txNote} numberOfLines={2}>{item.notes || item.category_name || item.type || "Transaction"}</Text>
          {item.payee && <Text style={styles.txPayee}>{item.payee}</Text>}
        </View>
        <View style={styles.txAmountCol}>
          <Text style={[styles.txAmount, isCredit && styles.txAmountCredit]}>
            {isCredit ? "" : ""}{formatAmount(item.amount)}
            <Text style={styles.txCrDr}>{isCredit ? " CR" : " DR"}</Text>
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderHeader}
        renderItem={renderTransaction}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="text-box-remove-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No transactions found for this period.</Text>
          </View>
        }
      />
      
      {statement.bill_id && statement.status !== 'paid' && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.payButton}
            onPress={() => navigation.navigate("BillDetail", { billId: statement.bill_id })}
          >
            <Text style={styles.payButtonText}>View & Pay Bill</Text>
          </TouchableOpacity>
        </View>
      )}

      <CreditCardStatementEditModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        editData={statement}
        onSave={async (payload) => {
          await updateCreditCardStatement(statement.id, payload);
          loadData();
        }}
      />
      <FAB onPress={() => setShowEditModal(true)} icon="pencil" />
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 16,
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
