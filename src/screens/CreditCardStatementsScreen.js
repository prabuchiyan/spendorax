import React, { useState, useCallback, useMemo } from "react";
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
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { useAppDispatch, useCreditCardStatements } from '../redux/hooks';
import { setStatements } from '../redux/slices/creditCardSlice';
import { formatAmount, formatCurrency } from "../utils/numberUtils";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(String(value).slice(0, 10));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CreditCardStatementsScreen({ route, navigation }) {
  const { sourceId } = route?.params || {};
  const dispatch = useAppDispatch();
  const reduxStatements = useCreditCardStatements();
  const statements = reduxStatements || [];
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const items = await getAllCreditCardStatements();
    if (sourceId) {
      dispatch(setStatements(items.filter(item => Number(item.source_id) === Number(sourceId))));
    } else {
      dispatch(setStatements(items));
    }
  };

  const handleDeleteStatement = useCallback((statement) => {
    setDeleteTarget(statement);
  }, []);

  const confirmDeleteStatement = useCallback(async () => {
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      await deleteStatement(deleteTarget.id);
      const items = await getAllCreditCardStatements();
      if (sourceId) {
        dispatch(setStatements(items.filter(item => Number(item.source_id) === Number(sourceId))));
      } else {
        dispatch(setStatements(items || []));
      }
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
  }, [deleteTarget, deleting, dispatch, sourceId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [sourceId]),
  );

  const isStatementPaid = (statement) => {
    return statement.bill_is_paid === 1 || 
           String(statement.bill_status).toLowerCase() === 'paid' || 
           String(statement.status).toLowerCase() === 'paid' || 
           (Number(statement.closing_balance || 0) > 0 && Number(statement.payments || 0) >= Number(statement.closing_balance || 0));
  };

  const totalDue = useMemo(() => statements.reduce(
    (sum, statement) => {
      if (isStatementPaid(statement)) return sum;
      const remaining = Math.max(0, Number(statement.closing_balance || 0) - Number(statement.payments || 0));
      return sum + remaining;
    },
    0,
  ), [statements]);

  const totalMinimum = useMemo(() => statements.reduce(
    (sum, statement) => {
      if (isStatementPaid(statement)) return sum;
      const remainingMin = Math.max(0, Number(statement.minimum_due || 0) - Number(statement.payments || 0));
      return sum + remainingMin;
    },
    0,
  ), [statements]);

  return (
    <View style={styles.container}>
      {/* PREMIUM HERO SECTION */}
      <View style={styles.headerContainer}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIconWrapper}>
              <MaterialCommunityIcons name="receipt" size={24} color="#FFF" />
            </View>
            <View style={styles.heroTopTextRow}>
              <Text style={styles.heroTitle}>Total Statement Due</Text>
              <Text style={styles.heroAmount}>
                 ₹{totalDue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
          
          <View style={styles.heroDivider} />
          
          <View style={styles.heroBottom}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>MINIMUM DUE</Text>
              <Text style={styles.heroStatValue}>
                ₹{totalMinimum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatLabel}>STATEMENTS</Text>
              <Text style={styles.heroStatValue}>{statements.length}</Text>
            </View>
          </View>
        </View>
      </View>

      <FlatList
        data={statements}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <MaterialCommunityIcons
                name="file-document-outline"
                size={42}
                color="#A1A9B3"
              />
            </View>
            <Text style={styles.emptyTitle}>No Statements Found</Text>
            <Text style={styles.emptySubtitle}>You don't have any generated statements yet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isPaid = isStatementPaid(item);
          const paymentsMade = Number(item.payments || 0);
          const remainingBal = Math.max(0, Number(item.closing_balance || 0) - paymentsMade);
          const itemColor = item.card_color || '#4B7CF3';
          
          return (
            <Card style={styles.statementCard}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate("CreditCardStatementDetail", {
                    statementId: item.id,
                  })
                }
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.cardIconWrapper, { backgroundColor: `${itemColor}15` }]}>
                      <MaterialCommunityIcons
                        name="credit-card-outline"
                        size={20}
                        color={itemColor}
                      />
                    </View>
                    <View>
                      <Text style={styles.cardName}>{item.card_name || "Credit Card"}</Text>
                      <Text style={styles.cardDate}>Generated on {formatDate(item.statement_date)}</Text>
                    </View>
                  </View>
                  
                  <View style={[styles.statusBadge, { backgroundColor: isPaid ? '#E8FDF0' : '#F0F5FF' }]}>
                    <Text style={[styles.statusText, { color: isPaid ? '#10B981' : '#4B7CF3' }]}>
                      {isPaid ? "PAID" : "DUE"}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.detailRow}>
                    <Feather name="calendar" size={14} color="#8A96A3" />
                    <Text style={styles.detailText}>
                      Period: <Text style={styles.detailValue}>{formatDate(item.statement_start)} – {formatDate(item.statement_end)}</Text>
                    </Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Feather name="clock" size={14} color="#8A96A3" />
                    <Text style={styles.detailText}>
                      Due By: <Text style={[styles.detailValue, { color: isPaid ? '#10B981' : '#E46A6A' }]}>{formatDate(item.due_date)}</Text>
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.footerBalanceBox}>
                    <Text style={styles.footerBalanceLabel}>Closing Balance</Text>
                    <Text style={styles.footerBalanceAmount}>{formatCurrency(item.closing_balance)}</Text>
                    {paymentsMade > 0 && (
                      <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '700', marginTop: 4 }}>
                        Paid: {formatCurrency(paymentsMade)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.footerActions}>
                    <View style={styles.minDueBox}>
                      <Text style={styles.minDueLabel}>{isPaid ? 'Status' : 'Remaining Due'}</Text>
                      <Text style={[styles.minDueAmount, isPaid && { color: '#10B981' }]}>
                        {isPaid ? 'Fully Paid' : formatCurrency(remainingBal)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.deleteBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteStatement(item);
                      }}
                    >
                      <Feather name="trash-2" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </Card>
          );
        }}
      />

      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteModal}>
            <View style={styles.deleteIconCircle}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={40}
                color="#DC2626"
              />
            </View>

            <Text style={styles.deleteTitle}>Delete Statement?</Text>

            <Text style={styles.deleteMessage}>
              Are you sure you want to delete the statement from <Text style={{ fontWeight: '800' }}>{deleteTarget ? formatDate(deleteTarget.statement_date) : ""}</Text> for <Text style={{ fontWeight: '800' }}>{deleteTarget?.card_name || "Credit Card"}</Text>?
            </Text>

            <Text style={styles.deleteWarning}>
              The linked bill will also be removed. Original transactions will remain intact.
            </Text>

            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                disabled={deleting}
                onPress={() => setDeleteTarget(null)}
                style={styles.cancelDeleteButton}
              >
                <Text style={styles.cancelDeleteText}>Keep Statement</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={deleting}
                onPress={confirmDeleteStatement}
                style={styles.confirmDeleteButton}
              >
                <Feather name="trash-2" size={16} color="#FFF" style={{ marginRight: 6 }} />
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
    backgroundColor: '#F7F9FB',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 20,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  heroTopTextRow: {
    flex: 1,
  },
  heroTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroAmount: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 18,
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatItem: {
    flex: 1,
  },
  heroStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
  },
  heroStatLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroStatValue: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#24313D',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8A96A3',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  statementCard: {
    marginBottom: 14,
    padding: 0,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  cardDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#64748B',
    marginLeft: 8,
  },
  detailValue: {
    fontWeight: '700',
    color: '#334155',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerBalanceBox: {
    flex: 1,
  },
  footerBalanceLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footerBalanceAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  minDueBox: {
    alignItems: 'flex-end',
    marginRight: 16,
  },
  minDueLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  minDueAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  deleteModal: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  deleteIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
  },
  deleteMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#475569',
    marginBottom: 12,
  },
  deleteWarning: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#64748B',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelDeleteButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  cancelDeleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  confirmDeleteButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
  },
  confirmDeleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
