import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getAllCreditCardStatements } from "../services/creditCards";
import { deleteStatement } from "../services/creditCardScheduler";
import Card from "../components/Card";
import { Colors, Spacing } from "../components/Theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(String(value).slice(0, 10));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN");
}

function formatAmount(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

export default function CreditCardStatementsScreen({ navigation }) {
  const [statements, setStatements] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const items = await getAllCreditCardStatements();
    setStatements(items);
  };

  const handleDeleteStatement = useCallback((statement) => {
    setDeleteTarget(statement);
  }, []);

  const confirmDeleteStatement = useCallback(async () => {
    if (!deleteTarget || deleting) return;

    try {
      setDeleting(true);
      // deleteStatement handles: hard-deletes the statement row,
      // soft-deletes the linked bill, then immediately re-runs
      // the scheduler so the cycle regenerates if balance > 0.
      await deleteStatement(deleteTarget.id);
      const items = await getAllCreditCardStatements();
      setStatements(items || []);
      setDeleteTarget(null);
    } catch (error) {
      console.error("[CreditCardStatements] Delete failed:", error);
      setDeleteTarget(null);
      Alert.alert(
        "Delete Failed",
        error?.message || "Unable to delete the statement.",
      );
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleting]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const totalDue = statements.reduce(
    (sum, statement) => sum + Number(statement.closing_balance || 0),
    0,
  );
  const totalMinimum = statements.reduce(
    (sum, statement) => sum + Number(statement.minimum_due || 0),
    0,
  );

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Statements</Text>
          <Text style={styles.summaryValue}>{statements.length}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Due</Text>
          <Text style={styles.summaryValue}>{formatAmount(totalDue)}</Text>
        </View>
      </View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Minimum Due</Text>
          <Text style={styles.summaryValue}>{formatAmount(totalMinimum)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Cards Covered</Text>
          <Text style={styles.summaryValue}>
            {new Set(statements.map((s) => s.card_name || "Credit Card")).size}
          </Text>
        </View>
      </View>

      <FlatList
        data={statements}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: Spacing.s, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={48}
              color="#ccc"
            />
            <Text style={styles.emptyText}>No generated statements yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const rowContent = (
            <View style={styles.statementRow}>
              {/* LEFT / STATEMENT DETAILS */}
              <View style={styles.statementLeft}>
                <Text style={styles.cardName}>
                  {item.card_name || "Credit Card"}
                </Text>

                <Text style={styles.statementDate}>
                  Statement: {formatDate(item.statement_date)}
                </Text>

                <Text style={styles.statementPeriod}>
                  Period {formatDate(item.statement_start)} –{" "}
                  {formatDate(item.statement_end)}
                </Text>

                <Text style={styles.statementMeta}>
                  Due {formatDate(item.due_date)} · Balance{" "}
                  {formatAmount(item.closing_balance)} · Min{" "}
                  {formatAmount(item.minimum_due)}
                </Text>

                <View style={styles.rowFooter}>
                  <Text style={styles.statusPill}>
                    {(item.status || "generated").toString().toUpperCase()}
                  </Text>
                  {console.log("item", item)}
                  {item.bill_id ? (
                    <Text
                      style={[
                        styles.billLink,
                        item.bill_status === "paid" && styles.billPaidText,
                      ]}
                    >
                      {item.bill_status === "paid"
                        ? "Bill Paid"
                        : "Bill available"}
                    </Text>
                  ) : (
                    <Text style={styles.billLink}>No bill created</Text>
                  )}
                </View>
              </View>

              {/* RIGHT / ACTIONS */}
              <View style={styles.rowActions}>
                <MaterialCommunityIcons
                  name="credit-card-outline"
                  size={28}
                  color={item.card_color || Colors.primary}
                />

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    console.log(
                      "[CreditCardStatements] Delete clicked:",
                      item.id,
                    );

                    handleDeleteStatement(item);
                  }}
                  style={styles.deleteButton}
                  hitSlop={{
                    top: 10,
                    bottom: 10,
                    left: 10,
                    right: 10,
                  }}
                >
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={21}
                    color="#DC2626"
                  />
                </TouchableOpacity>
              </View>
            </View>
          );

          return (
            <Card style={styles.statementCard}>
              {/* Only statement details navigate to BillDetail */}
              {item.bill_id ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate("BillDetail", {
                      billId: item.bill_id,
                    })
                  }
                >
                  {rowContent}
                </TouchableOpacity>
              ) : (
                rowContent
              )}
            </Card>
          );
        }}
      />

      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteModal}>
            <MaterialCommunityIcons
              name="delete-alert-outline"
              size={42}
              color="#DC2626"
            />

            <Text style={styles.deleteTitle}>Delete Statement?</Text>

            <Text style={styles.deleteMessage}>
              Delete the{" "}
              {deleteTarget ? formatDate(deleteTarget.statement_date) : ""}{" "}
              statement for {deleteTarget?.card_name || "Credit Card"}?
            </Text>

            <Text style={styles.deleteWarning}>
              The generated credit card bill will also be deleted. Your original
              transactions will not be deleted.
            </Text>

            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                disabled={deleting}
                onPress={() => setDeleteTarget(null)}
                style={styles.cancelDeleteButton}
              >
                <Text style={styles.cancelDeleteText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={deleting}
                onPress={confirmDeleteStatement}
                style={styles.confirmDeleteButton}
              >
                <MaterialCommunityIcons
                  name="delete-outline"
                  size={18}
                  color="#fff"
                />

                <Text style={styles.confirmDeleteText}>
                  {deleting ? "Deleting..." : "Delete"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  summaryRow: {
    flexDirection: "row",
    padding: Spacing.s,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginRight: 10,
    elevation: 1,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.muted,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
  },
  statementCard: {
    marginBottom: Spacing.s,
  },
  statementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statementLeft: {
    flex: 1,
    paddingRight: 12,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: 4,
  },
  statementDate: {
    color: Colors.muted,
    fontSize: 13,
    marginBottom: 2,
  },
  statementPeriod: {
    color: Colors.muted,
    fontSize: 13,
    marginBottom: 4,
  },
  statementMeta: {
    color: Colors.text,
    fontSize: 13,
    marginBottom: 8,
  },
  rowFooter: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  statusPill: {
    backgroundColor: "#EFF6FF",
    color: Colors.primary,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 12,
    fontWeight: "700",
    marginRight: 10,
  },
  billLink: {
    color: Colors.muted,
    fontSize: 12,
  },
  emptyState: {
    alignItems: "center",
    marginTop: 60,
  },
  emptyText: {
    color: Colors.muted,
    marginTop: 10,
    fontSize: 14,
  },
  rowActions: {
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  deleteModal: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  deleteTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
  },
  deleteMessage: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: Colors.text,
  },
  deleteWarning: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    color: Colors.muted,
  },
  deleteModalActions: {
    flexDirection: "row",
    width: "100%",
    marginTop: 22,
    gap: 10,
  },
  cancelDeleteButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  cancelDeleteText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  confirmDeleteButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
  },
  confirmDeleteText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  billPaidText: {
    color: "#2DBE60",
    fontWeight: "700",
  },
});
