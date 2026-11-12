import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Share,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import {
  TextInput as PaperTextInput,
  Snackbar
} from "react-native-paper";
import PremiumRoundedBarChart from "../components/PremiumRoundedBarChart";
import {
  getBillById,
  getBillSeries,
  markBillPaid,
  skipBill,
  unskipBill,
  softDeleteBillOccurrence,
  getTransactionsForBillLink,
  getBillLinkedTransactions,
  linkAdditionalTransaction,
  removeTransactionFromBill,
} from "../services/bills";
import { getCategories } from "../services/categories";
import { getSources } from "../services/sources";
import ConfirmDialog from "../components/ConfirmDialog";
import SkipBillModal from "../components/SkipBillModal";
import UnskipBillModal from "../components/UnskipBillModal";
import BillForm from "../components/BillForm";
import CurrencyText from "../components/CurrencyText";
import {
  formatCurrency,
  formatDueDate,
  getBillDisplayStatus,
  BILL_STATUS,
} from "../services/billUtils";
import { getCreditCards, payCreditCardBill } from "../services/creditCards";
import { usePageLoader } from "../context/PageLoaderContext";
import { useTheme } from "../context/ThemeContext";
import PageLoader from "../components/PageLoader";
import { onStatementPaid } from "../services/creditCardScheduler";
import { setCategoriesMap } from "../redux/slices/categorySlice";
import {
  useAppDispatch,
  useBillsSummary,
  useCategoriesMap
} from "../redux/hooks";

const screenWidth = Dimensions.get("window").width;

function getBillMonthYear(billObj) {
  const dateStr = billObj?.due_date || billObj?.occurrence_date;
  if (dateStr) {
    const parts = String(dateStr).slice(0, 10).split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, monthIndex, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      }
    }
  }
  const now = new Date();
  return now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function formatRecurrenceType(type, isRecurring = true) {
  if (!isRecurring) return "One-Time";
  if (!type) return "Monthly";
  const upper = String(type).trim().toUpperCase();
  switch (upper) {
    case "MONTHLY":
      return "Monthly";
    case "YEARLY":
      return "Yearly";
    case "BI_MONTHLY":
      return "Bi-Monthly";
    case "QUARTERLY":
      return "Quarterly";
    case "HALF_YEARLY":
      return "Half-Yearly";
    case "WEEKLY":
      return "Weekly";
    case "DAILY":
      return "Daily";
    case "ONE_TIME":
    case "ONETIME":
      return "One-Time";
    default:
      return upper.charAt(0) + upper.slice(1).toLowerCase();
  }
}

function LinkedTransactionsCard({ linkedTxs, onAddMore, onUnlink, onEdit }) {
  const { theme, isDarkMode } = useTheme();
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <View style={styles.sectionHeaderRow}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Linked Transactions</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{linkedTxs.length}</Text>
          </View>
        </View>

        {onAddMore && (
          <TouchableOpacity
            onPress={onAddMore}
            activeOpacity={0.7}
            style={styles.linkNewBtn}>
            <MaterialCommunityIcons name="plus" size={14} color="#ffffff" style={{ marginRight: 3 }} />
            <Text style={styles.linkNewBtnText}>Link New</Text>
          </TouchableOpacity>
        )}
      </View>

      {linkedTxs.length === 0 ? (
        <View style={styles.emptyLinkedCard}>
          <View style={styles.emptyLinkedIconWrap}>
            <MaterialCommunityIcons name="link-variant-off" size={24} color="#94a3b8" />
          </View>
          <Text style={[styles.emptyLinkedTitle, { color: theme.textSecondary }]}>No linked transactions</Text>
          <Text style={styles.emptyLinkedSub}>
            Link a payment to automatically record and mark this bill as paid.
          </Text>
        </View>
      ) : (
        linkedTxs.map((tx) => {
          const sourceWords = (tx.source_name || "BANK").trim().split(" ");
          const line1 = sourceWords[0]?.slice(0, 5)?.toUpperCase() || "BANK";
          const avatarColor = tx.category_color || tx.source_color || "#006a61";
          const avatarIcon = tx.category_icon || tx.source_icon;

          return (
            <View key={tx.id} style={[styles.linkedTxItem, { backgroundColor: isDarkMode ? theme.cardBg : "#ffffff", borderColor: theme.border }]}>
              {/* Left Side: Clickable to Edit */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onEdit && onEdit(tx)}
                style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                accessibilityRole="button"
                accessibilityLabel={`Edit transaction ${tx.notes || "Payment"}`}>
                {/* Dynamic Avatar */}
                <View style={[styles.txAvatarWrap, { backgroundColor: `${avatarColor}18` }]}>
                  {avatarIcon ? (
                    <MaterialCommunityIcons
                      name={avatarIcon}
                      size={20}
                      color={avatarColor}
                    />
                  ) : (
                    <Text style={[styles.txAvatarText, { color: avatarColor }]}>
                      {line1.slice(0, 3)}
                    </Text>
                  )}
                </View>

                {/* Details */}
                <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                    <Text numberOfLines={1} style={[styles.txTitle, { color: theme.textPrimary }]}>
                      {tx.notes || "Payment Transaction"}
                    </Text>
                    <View style={styles.verifiedTag}>
                      <Text style={styles.verifiedTagText}>Verified</Text>
                    </View>
                  </View>

                  <View style={styles.txMetaRow}>
                    <Text style={styles.txDateText}>
                      {tx.date
                        ? new Date(tx.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                        : "—"}
                    </Text>
                    {tx.source_name ? (
                      <>
                        <Text style={styles.txBullet}>•</Text>
                        <View style={[styles.sourceBadge, { backgroundColor: isDarkMode ? "#1e293b" : "#f1f5f9" }]}>
                          <Text numberOfLines={1} style={[styles.sourceBadgeText, { color: theme.textSecondary }]}>
                            {tx.source_name}
                          </Text>
                        </View>
                      </>
                    ) : null}
                    <Text style={styles.txBullet}>•</Text>
                    <View style={[styles.txIdBadge, { backgroundColor: isDarkMode ? "#334155" : "#e2e8f0" }]}>
                      <Text style={[styles.txIdBadgeText, { color: isDarkMode ? "#cbd5e1" : "#475569" }]}>
                        TXN-{tx.id ? String(tx.id).padStart(4, "0") : "AUTO"}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.txAmountText, { color: theme.textPrimary }]}>
                    {formatCurrency(tx.amount)}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Unlink Action */}
              {onUnlink && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Unlink transaction"
                  onPress={() => onUnlink(tx)}
                  activeOpacity={0.7}
                  style={[styles.unlinkBtn, { backgroundColor: isDarkMode ? "#1e293b" : "#ffffff", borderColor: isDarkMode ? "#475569" : "#fecdd3" }]}>
                  <MaterialCommunityIcons
                    name="link-variant-off"
                    size={17}
                    color="#f43f5e"
                  />
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

function YearQuickJumpModal({
  visible,
  onClose,
  series = [],
  availableYears = [],
  yearGroups = {},
  activeYear,
  activeOccurrenceId,
  onSelectOccurrence,
}) {
  const { theme, isDarkMode } = useTheme();
  const [selectedYear, setSelectedYear] = useState(activeYear || availableYears[0]);

  useEffect(() => {
    if (visible) {
      setSelectedYear(activeYear || availableYears[0]);
    }
  }, [visible, activeYear, availableYears]);

  if (!visible) return null;

  const oldestOcc = series && series.length > 0 ? series[0] : null;
  const latestOcc = series && series.length > 0 ? series[series.length - 1] : null;
  const oldestYear = oldestOcc?.due_date ? new Date(oldestOcc.due_date).getFullYear() : null;
  const latestYear = latestOcc?.due_date ? new Date(latestOcc.due_date).getFullYear() : null;

  const monthsInSelectedYear = selectedYear && yearGroups[selectedYear] ? yearGroups[selectedYear] : [];
  const isFewYears = availableYears.length <= 4;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.unlinkModalOverlay}>
        <Pressable style={styles.unlinkModalBackdrop} onPress={onClose} />
        <View
          style={[
            styles.jumpModalCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
              borderWidth: isDarkMode ? 1 : 0,
            },
          ]}>
          {/* Header */}
          <View style={styles.jumpModalHeader}>
            <View style={styles.jumpIconCircle}>
              <MaterialCommunityIcons name="calendar-clock" size={24} color="#006a61" />
            </View>
            <Text style={[styles.jumpModalTitle, { color: theme.textPrimary }]}>
              Jump to Period
            </Text>
            <Text style={[styles.jumpModalSubtitle, { color: theme.textSecondary }]}>
              Quickly navigate through {series.length} bill cycles
            </Text>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.jumpModalScroll}
            contentContainerStyle={styles.jumpModalScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}>
            {/* Quick Shortcuts: Oldest & Latest */}
            {series.length > 5 && (
              <View style={styles.jumpShortcutsRow}>
                {oldestOcc && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      onSelectOccurrence(oldestOcc);
                      onClose();
                    }}
                    style={[
                      styles.jumpShortcutBtn,
                      {
                        backgroundColor: isDarkMode ? "#1e293b" : "#f1f5f9",
                        borderColor: theme.border,
                      },
                    ]}>
                    <MaterialCommunityIcons name="page-first" size={16} color="#006a61" style={{ marginRight: 4 }} />
                    <Text style={[styles.jumpShortcutText, { color: theme.textPrimary }]} numberOfLines={1}>
                      Oldest ({oldestYear})
                    </Text>
                  </TouchableOpacity>
                )}

                {latestOcc && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      onSelectOccurrence(latestOcc);
                      onClose();
                    }}
                    style={[
                      styles.jumpShortcutBtn,
                      {
                        backgroundColor: isDarkMode ? "#1e293b" : "#f1f5f9",
                        borderColor: theme.border,
                      },
                    ]}>
                    <MaterialCommunityIcons name="page-last" size={16} color="#006a61" style={{ marginRight: 4 }} />
                    <Text style={[styles.jumpShortcutText, { color: theme.textPrimary }]} numberOfLines={1}>
                      Latest ({latestYear})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Years Section */}
            {availableYears.length > 0 && (
              <View style={styles.jumpSectionWrap}>
                <Text style={[styles.jumpSectionLabel, { color: theme.textSecondary }]}>
                  SELECT YEAR ({availableYears.length})
                </Text>

                {/* Years Grid */}
                <View style={styles.jumpYearGrid}>
                  {availableYears.map((yr) => {
                    const isSelected = Number(selectedYear) === Number(yr);
                    return (
                      <TouchableOpacity
                        key={String(yr)}
                        activeOpacity={0.7}
                        onPress={() => setSelectedYear(yr)}
                        style={[
                          styles.yearGridBtn,
                          isFewYears ? { flex: 1 } : { width: "23%" },
                          {
                            backgroundColor: isSelected
                              ? "#006a61"
                              : isDarkMode
                                ? "#1e293b"
                                : "#f8faff",
                            borderColor: isSelected
                              ? "#006a61"
                              : isDarkMode
                                ? "#334155"
                                : "#e2ebf8",
                          },
                        ]}>
                        <Text
                          style={[
                            styles.yearGridBtnText,
                            { color: isSelected ? "#ffffff" : theme.textPrimary },
                          ]}
                          numberOfLines={1}>
                          {yr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Months in Selected Year */}
            {monthsInSelectedYear.length > 0 && (
              <View style={styles.jumpSectionWrap}>
                <Text style={[styles.jumpSectionLabel, { color: theme.textSecondary }]}>
                  CYCLES IN {selectedYear} ({monthsInSelectedYear.length})
                </Text>
                <View style={styles.monthChipsGrid}>
                  {monthsInSelectedYear.map((occ) => {
                    const date = new Date(occ.due_date);
                    const monthName = date.toLocaleDateString("en-IN", {
                      month: "short",
                    });
                    const isPaid = occ.status === BILL_STATUS.PAID || Number(occ.is_paid) === 1 || (Number(occ.amount || 0) > 0 && Number(occ.paid_amount || 0) >= Number(occ.amount || 0));
                    const isPartiallyPaid = !isPaid && (occ.status === "partially_paid" || occ.is_partially_paid || (Number(occ.paid_amount || 0) > 0 && Number(occ.paid_amount || 0) < Number(occ.amount || 0)));
                    const isSkipped = occ.status === BILL_STATUS.SKIPPED;
                    const isCurrentOcc =
                      activeOccurrenceId != null && Number(occ.id) === Number(activeOccurrenceId);

                    const statusColor = isPaid ? "#10b981" : isPartiallyPaid ? "#3b82f6" : isSkipped ? "#94a3b8" : "#f59e0b";
                    const statusLabel = isPaid ? "Paid" : isPartiallyPaid ? "Partial" : isSkipped ? "Skipped" : "Due";

                    const cardBorderColor = isCurrentOcc
                      ? "#006a61"
                      : isPaid
                        ? (isDarkMode ? "#065f46" : "#a7f3d0")
                        : isPartiallyPaid
                          ? (isDarkMode ? "#1d4ed8" : "#93c5fd")
                          : isSkipped
                            ? (isDarkMode ? "#475569" : "#cbd5e1")
                            : (isDarkMode ? "#334155" : theme.border);

                    const cardBgColor = isCurrentOcc
                      ? (isDarkMode ? "rgba(0, 106, 97, 0.25)" : "rgba(0, 106, 97, 0.08)")
                      : isPartiallyPaid
                        ? (isDarkMode ? "rgba(37, 99, 235, 0.15)" : "#eff6ff")
                        : (isDarkMode ? "#1e293b" : "#f8faff");

                    return (
                      <TouchableOpacity
                        key={String(occ.id)}
                        activeOpacity={0.7}
                        onPress={() => {
                          onSelectOccurrence(occ);
                          onClose();
                        }}
                        style={[
                          styles.cycleCardBtn,
                          {
                            backgroundColor: cardBgColor,
                            borderColor: cardBorderColor,
                            borderWidth: isCurrentOcc ? 1.5 : 1,
                          },
                        ]}>
                        <View style={styles.cycleCardHeader}>
                          <View style={styles.cycleCardHeaderLeft}>
                            <View
                              style={[
                                styles.monthStatusDot,
                                { backgroundColor: statusColor },
                              ]}
                            />
                            <Text
                              style={[
                                styles.cycleMonthText,
                                {
                                  color: isCurrentOcc ? "#006a61" : theme.textPrimary,
                                  fontWeight: isCurrentOcc ? "800" : "700",
                                },
                              ]}
                              numberOfLines={1}>
                              {monthName}
                            </Text>
                          </View>
                          {isCurrentOcc ? (
                            <View style={styles.cycleCurrentBadge}>
                              <Text style={styles.cycleCurrentBadgeText}>Active</Text>
                            </View>
                          ) : isPaid ? (
                            <MaterialCommunityIcons name="check-circle" size={13} color="#10b981" />
                          ) : null}
                        </View>
                        <View style={styles.cycleCardFooter}>
                          <Text
                            style={[
                              styles.cycleAmountText,
                              { color: isCurrentOcc ? (isDarkMode ? "#2dd4bf" : "#006a61") : theme.textPrimary },
                            ]}
                            numberOfLines={1}>
                            {formatCurrency(occ.amount)}
                          </Text>
                          <Text
                            style={[
                              styles.cycleStatusText,
                              { color: statusColor },
                            ]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Close button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onClose}
            style={[
              styles.jumpCloseBtn,
              { backgroundColor: isDarkMode ? "#334155" : "#f1f5f9" },
            ]}>
            <Text style={[styles.jumpCloseBtnText, { color: theme.textPrimary }]}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function LinkTransactionModal({ visible, bill, onLink, onClose }) {
  const { theme, isDarkMode } = useTheme();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [linkingId, setLinkingId] = useState(null);

  useEffect(() => {
    if (!visible || !bill) return;
    setSearch("");
    setLoading(true);
    Promise.all([getTransactionsForBillLink(bill), getSources(true)])
      .then(([txs]) => setCandidates(txs))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [visible, bill?.id]);

  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((tx) => {
      const notes = String(tx.notes || "").toLowerCase();
      const source = String(tx.source_name || "").toLowerCase();
      const category = String(tx.category_name || "").toLowerCase();
      const amount = String(tx.amount || "").toLowerCase();
      const date = tx.date
        ? new Date(tx.date)
          .toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
          })
          .toLowerCase()
        : "";
      return (
        notes.includes(query) ||
        source.includes(query) ||
        category.includes(query) ||
        amount.includes(query) ||
        date.includes(query)
      );
    });
  }, [candidates, search]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: theme.cardBg }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.modalHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalHeaderTitle, { color: theme.textPrimary }]}>
                Link Transaction
              </Text>
              <Text style={[styles.modalHeaderSubtitle, { color: theme.textSecondary }]}>
                Select an expense for "{bill?.name}" • {filteredCandidates.length} available
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              style={styles.modalCloseBtn}>
              <MaterialCommunityIcons name="close" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          <PaperTextInput
            placeholder="Search by note, amount, account..."
            value={search}
            onChangeText={setSearch}
            mode="outlined"
            left={<PaperTextInput.Icon icon="magnify" color="#7c839b" />}
            right={
              search ? (
                <PaperTextInput.Icon
                  icon="close-circle"
                  color="#7c839b"
                  onPress={() => setSearch("")}
                />
              ) : null
            }
            style={styles.searchInput}
            outlineStyle={{ borderRadius: 14 }}
            outlineColor="#e2ebf8"
            activeOutlineColor="#006a61"
          />

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#006a61" />
              <Text style={{ marginTop: 8, color: "#64748b", fontSize: 13, fontFamily: "Inter" }}>
                Finding unlinked transactions...
              </Text>
            </View>
          ) : filteredCandidates.length === 0 ? (
            <View style={styles.emptyCandidatesBox}>
              <MaterialCommunityIcons name="text-box-search-outline" size={36} color="#94a3b8" />
              <Text style={[styles.emptyCandidatesTitle, { color: theme.textPrimary }]}>No matching transactions</Text>
              <Text style={styles.emptyCandidatesSub}>
                {search ? "Try a different search term" : "Only expense transactions within 45 days can be linked."}
              </Text>
              {search ? (
                <TouchableOpacity onPress={() => setSearch("")} style={{ marginTop: 10 }}>
                  <Text style={{ color: "#006a61", fontWeight: "700", fontSize: 12, fontFamily: "Inter" }}>
                    Clear Search
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <FlatList
              data={filteredCandidates}
              keyExtractor={(t) => String(t.id)}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 320 }}
              renderItem={({ item: tx }) => (
                <TouchableOpacity
                  onPress={() => {
                    setLinkingId(tx.id);
                    setTimeout(async () => {
                      try {
                        await onLink(tx);
                      } finally {
                        setLinkingId(null);
                      }
                    }, 0);
                  }}
                  disabled={linkingId !== null}
                  activeOpacity={0.7}
                  style={[
                    styles.candidateRow,
                    linkingId !== null && linkingId !== tx.id && { opacity: 0.5 }
                  ]}>
                  <View style={[styles.candidateIconWrap, { backgroundColor: `${tx.category_color || '#006a61'}18` }]}>
                    <MaterialCommunityIcons
                      name={tx.category_icon || "cash"}
                      size={20}
                      color={tx.category_color || '#006a61'}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[styles.candidateNotes, { color: theme.textPrimary }]}>
                      {tx.notes || "Payment Transaction"}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3 }}>
                      <Text style={styles.candidateDate}>
                        {tx.date
                          ? new Date(tx.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })
                          : "—"}
                      </Text>
                      {tx.source_name ? (
                        <View style={styles.candidateSourceTag}>
                          <Text style={[styles.candidateSourceText, { color: theme.textSecondary }]}>{tx.source_name}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
                    <Text style={styles.candidateAmount}>
                      <CurrencyText amount={tx.amount} />
                    </Text>
                    {linkingId === tx.id ? (
                      <ActivityIndicator size="small" color="#006a61" style={{ marginLeft: 8 }} />
                    ) : (
                      <MaterialCommunityIcons name="chevron-right" size={18} color="#94a3b8" style={{ marginLeft: 4 }} />
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}

          <TouchableOpacity
            onPress={onClose}
            disabled={linkingId !== null}
            activeOpacity={0.7}
            style={styles.modalCancelBtn}>
            <Text style={styles.modalCancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function isCreditCardBill(bill) {
  return (
    typeof bill?.notes === "string" && (
      bill.notes.startsWith("Recurring payment template for") ||
      bill.notes.startsWith("Statement "))
  );
}

export default function BillDetailScreen({ route, navigation }) {
  const { isDarkMode, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const rawId = route.params?.billId ?? route.params?.id;
  const occurrenceId = route.params?.occurrenceId;
  const [resolvedTemplateId, setResolvedTemplateId] = useState(null);
  const billId = resolvedTemplateId ?? rawId;

  // ── All useState hooks (hooks 1-14) ───────────────────────────────────────
  const [bill, setBill] = useState(null);
  const [series, setSeries] = useState([]);
  const [selectedOcc, setSelectedOcc] = useState(null);
  const [linkedTxs, setLinkedTxs] = useState([]);
  const [category, setCategory] = useState(null);
  const [source, setSource] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showUnskipModal, setShowUnskipModal] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isUnskipping, setIsUnskipping] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [showPaymentSourcePicker, setShowPaymentSourcePicker] = useState(false);
  const [paymentSources, setPaymentSources] = useState([]);
  const [paymentSourceSearch, setPaymentSourceSearch] = useState("");
  const [selectedCreditCard, setSelectedCreditCard] = useState(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [unlinkingTx, setUnlinkingTx] = useState(null);
  const [unlinking, setUnlinking] = useState(false);
  const [showYearJumpModal, setShowYearJumpModal] = useState(false);
  const { visible: loaderVisible, show: showPageLoader, hide: hidePageLoader } = usePageLoader();
  const dispatch = useAppDispatch();
  const reduxSummary = useBillsSummary();
  const categoriesMap = useCategoriesMap();

  const selectedOccRef = useRef(null);
  const prevRawIdRef = useRef(rawId);

  // If rawId changes (different bill opened), reset selected occurrence reference
  if (prevRawIdRef.current !== rawId) {
    prevRawIdRef.current = rawId;
    selectedOccRef.current = null;
  }

  useFocusEffect(
    useCallback(() => {
      load(selectedOccRef.current?.id, selectedOccRef.current?.due_date);
    }, [rawId])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (bill) navigation.setOptions({ title: bill.name });
  }, [bill]);

  const chartData = useMemo(() => {
    return series.map((occ) => {
      const date = new Date(occ.due_date);
      return {
        id: occ.id,
        label: date.toLocaleDateString("en", {
          month: "short",
          year: "2-digit"
        }),
        due: Number(occ.amount || 0),
        paid: Number(occ.paid_amount || 0)
      };
    });
  }, [series]);

  const [chartOffset, setChartOffset] = useState(0);

  const displayChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    const itemsToShow = 5;
    if (chartData.length <= itemsToShow) return chartData;
    const start = Math.max(0, chartData.length - itemsToShow - chartOffset);
    return chartData.slice(start, start + itemsToShow);
  }, [chartData, chartOffset]);

  const availableYears = useMemo(() => {
    if (!series || series.length === 0) return [];
    const yearSet = new Set();
    series.forEach((occ) => {
      if (occ.due_date) {
        const y = new Date(occ.due_date).getFullYear();
        if (!isNaN(y)) yearSet.add(y);
      }
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [series]);

  const yearGroups = useMemo(() => {
    const map = {};
    (series || []).forEach((occ) => {
      if (!occ.due_date) return;
      const y = new Date(occ.due_date).getFullYear();
      if (isNaN(y)) return;
      if (!map[y]) map[y] = [];
      map[y].push(occ);
    });
    return map;
  }, [series]);

  const visibleYearLabel = useMemo(() => {
    if (!displayChartData || displayChartData.length === 0) return "";
    const years = displayChartData
      .map((item) => {
        const occ = series.find((s) => Number(s.id) === Number(item.id));
        return occ?.due_date ? new Date(occ.due_date).getFullYear() : null;
      })
      .filter((y) => y != null && !isNaN(y));
    if (years.length === 0) return "";
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    return minYear === maxYear ? String(minYear) : `${minYear}-${String(maxYear).slice(2)}`;
  }, [displayChartData, series]);

  const totalDueAmount = useMemo(() => {
    return series.reduce((sum, b) => {
      if (b.status === BILL_STATUS.SKIPPED) return sum;
      return sum + Number(b.amount || 0);
    }, 0);
  }, [series]);

  const totalPaidAmount = useMemo(() => {
    return series.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0);
  }, [series]);

  const pendingAmount = totalDueAmount - totalPaidAmount;

  const paidCount = useMemo(() => {
    return series.filter((b) => Number(b.paid_amount || 0) > 0).length;
  }, [series]);

  const paymentPercentage = useMemo(() => {
    if (totalDueAmount === 0) return 0;
    return Math.min(100, (totalPaidAmount / totalDueAmount) * 100);
  }, [totalDueAmount, totalPaidAmount]);

  const reduxCategory = categoriesMap?.[bill?.category_id] || category;

  // ── Early returns AFTER all hooks ─────────────────────────────────────────
  if (!bill && !editing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8faff" }}>
        <ActivityIndicator size="large" color={'#006a61'} />
      </View>
    );
  }

  if (editing) {
    return (
      <BillForm
        bill={bill}
        onSaved={async () => {
          try {
            showPageLoader();
            setEditing(false);
            await load(selectedOcc?.id, selectedOcc?.due_date);
          } catch (e) {
            console.error("[BillDetail] Bill save refresh failed:", e);
          } finally {
            hidePageLoader();
          }
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  // ── handlers & actions ───────────────────────────────────────────────────

  async function load(preserveOccId = null, preserveDueDate = null) {
    if (!rawId) {
      hidePageLoader();
      return;
    }

    showPageLoader();

    try {
      const rawBill = await getBillById(rawId);
      const templateId = rawBill?.parent_bill_id || rawId;
      setResolvedTemplateId(templateId);

      const [b, s, cats, srcs] = await Promise.all([
        getBillById(templateId),
        getBillSeries(templateId),
        getCategories(true),
        getSources(true)
      ]);

      setBill(b);
      setSeries(s);

      const categoryMap = {};
      (cats || []).forEach((c) => {
        categoryMap[c.id] = c;
      });
      dispatch(setCategoriesMap(categoryMap));

      if (b?.category_id)
        setCategory(cats.find((c) => c.id === b.category_id) || null);
      if (b?.source_id)
        setSource(srcs.find((ss) => ss.id === b.source_id) || null);

      const targetOccId = preserveOccId ?? selectedOccRef.current?.id;
      const targetDueDate = preserveDueDate ?? selectedOccRef.current?.due_date;

      let occ = null;
      if (targetOccId != null) {
        occ =
          s.find((o) => Number(o.id) === Number(targetOccId)) ||
          s.find((o) => String(o.id) === String(targetOccId)) ||
          null;
      }
      if (!occ && targetDueDate) {
        const targetMonth = String(targetDueDate).slice(0, 7);
        occ =
          s.find((o) => o.due_date && String(o.due_date).slice(0, 7) === targetMonth) ||
          null;
      }
      if (!occ && occurrenceId) {
        const matchesTemplateOnly = s.length > 1 && Number(occurrenceId) === Number(templateId);
        if (!matchesTemplateOnly) {
          occ =
            s.find((o) => Number(o.id) === Number(occurrenceId)) ||
            s.find((o) => String(o.id) === String(occurrenceId)) ||
            null;
        }
      }
      if (!occ && s.length > 1) {
        // Smart occurrence selection:
        // Current month or previous unpaid month by default.
        // Rule: If both previous month and current month are unpaid, current month defaults.
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth();
        const curMonthStr = `${curYear}-${String(curMonth + 1).padStart(2, "0")}`;

        const isUnpaid = (o) =>
          o &&
          o.status !== BILL_STATUS.PAID &&
          o.status !== BILL_STATUS.SKIPPED &&
          Number(o.is_paid) !== 1 &&
          !o.is_completely_paid;

        const getDateStr = (o) => o?.due_date || o?.statement_date || o?.occurrence_date || "";

        const currentMonthOcc = s.find((o) => {
          const ds = getDateStr(o);
          return ds && ds.slice(0, 7) === curMonthStr;
        });

        const prevUnpaidOccs = s.filter((o) => {
          const ds = getDateStr(o);
          return ds && ds.slice(0, 7) < curMonthStr && isUnpaid(o);
        });

        if (currentMonthOcc && isUnpaid(currentMonthOcc)) {
          // Both previous and current unpaid -> current month defaults
          occ = currentMonthOcc;
        } else if (prevUnpaidOccs.length > 0) {
          // Current month is settled (or missing), but previous unpaid exists
          occ = prevUnpaidOccs[prevUnpaidOccs.length - 1];
        } else if (currentMonthOcc) {
          // Current month exists (even if settled) and no previous unpaid exists
          occ = currentMonthOcc;
        } else {
          // Next upcoming occurrence or latest
          const upcoming = s.find((o) => {
            const ds = getDateStr(o);
            return ds && ds.slice(0, 7) > curMonthStr;
          });
          const rawChildMatch = rawBill?.parent_bill_id
            ? s.find((o) => Number(o.id) === Number(rawId))
            : null;
          occ = upcoming || rawChildMatch || s[s.length - 1] || null;
        }
      }
      if (!occ) {
        occ =
          (rawBill?.parent_bill_id && s.find((o) => Number(o.id) === Number(rawId))) ||
          s[s.length - 1] ||
          s[0] ||
          null;
      }
      setSelectedOcc(occ);
      selectedOccRef.current = occ;

      const itemsToShow = 5;
      if (occ && s.length > itemsToShow) {
        const idx = s.findIndex((o) => Number(o.id) === Number(occ.id));
        if (idx !== -1) {
          setChartOffset((prevOffset) => {
            const currentStart = Math.max(0, s.length - itemsToShow - prevOffset);
            const currentEnd = currentStart + itemsToShow - 1;
            if (idx >= currentStart && idx <= currentEnd) {
              return prevOffset;
            }
            return Math.max(0, Math.min(s.length - itemsToShow, s.length - 3 - idx));
          });
        }
      } else {
        setChartOffset(0);
      }

      if (occ) {
        setLinkedTxs(await getBillLinkedTransactions(occ.id));
        if (occ.due_date) {
          setSelectedLabel(
            new Date(occ.due_date).toLocaleDateString("en", {
              month: "short",
              year: "2-digit"
            })
          );
        }
      }
    } catch (e) {
      console.error("[BillDetail] load failed:", e);
      setBill(null);
      setSeries([]);
      setSelectedOcc(null);
      selectedOccRef.current = null;
      setLinkedTxs([]);
    } finally {
      hidePageLoader();
    }
  }

  async function refreshSelectedOccurrence() {
    const updatedSeries = await getBillSeries(billId);
    setSeries(updatedSeries);
    const targetId = selectedOccRef.current?.id ?? selectedOcc?.id;
    const targetDate = selectedOccRef.current?.due_date ?? selectedOcc?.due_date;
    let occ = updatedSeries.find((o) => Number(o.id) === Number(targetId)) || null;
    if (!occ && targetDate) {
      const targetMonth = String(targetDate).slice(0, 7);
      occ = updatedSeries.find((o) => o.due_date && String(o.due_date).slice(0, 7) === targetMonth) || null;
    }
    setSelectedOcc(occ);
    selectedOccRef.current = occ;
    setLinkedTxs(occ ? await getBillLinkedTransactions(occ.id) : []);
  }

  const handleMarkPaid = async () => {
    if (!selectedOcc && !bill) return;
    const targetBill = selectedOcc || bill;
    try {
      setIsMarkingPaid(true);
      const cards = await getCreditCards(false);
      const card = cards.find(
        (c) =>
          Number(c.payment_bill_id) === Number(targetBill.id) ||
          Number(c.payment_bill_id) === Number(targetBill.parent_bill_id)
      );

      // Normal bill
      if (!card) {
        await markBillPaid(targetBill.id, {
          source_id: targetBill.source_id
        });
        await load(targetBill.id);
        const monthYear = getBillMonthYear(targetBill);
        setToastMsg(`Bill paid for ${monthYear}`);
        setToastVisible(true);
        setIsMarkingPaid(false);
        return;
      }

      // Credit card bill
      const sources = await getSources(true);
      setPaymentSources(
        sources.filter((s) => Number(s.id) !== Number(card.source_id))
      );
      setSelectedCreditCard(card);
      setPaymentSourceSearch("");
      setIsMarkingPaid(false);
      setShowPaymentSourcePicker(true);
    } catch (e) {
      console.error("[BillDetail] Mark paid failed:", e);
      setIsMarkingPaid(false);
      Alert.alert("Error", "Unable to mark bill as paid.");
    }
  };

  async function handleUnskip() {
    const targetBill = selectedOcc || activeBill;
    if (!targetBill) return;
    try {
      setIsUnskipping(true);
      await unskipBill(targetBill.id);
      await refreshSelectedOccurrence();
      await load(targetBill.id, targetBill.due_date);
      setShowUnskipModal(false);
      const monthYear = getBillMonthYear(targetBill);
      setToastMsg(`Bill reactivated for ${monthYear}`);
      setToastVisible(true);
    } catch (e) {
      console.error("[BillDetail] Unskip failed:", e);
      Alert.alert("Error", "Unable to unskip this bill occurrence.");
    } finally {
      setIsUnskipping(false);
    }
  }

  async function handleLinkTransaction(tx) {
    if (!selectedOcc) return;
    try {
      showPageLoader();
      await linkAdditionalTransaction(selectedOcc.id, tx.id);
      setShowLinkModal(false);
      await refreshSelectedOccurrence();
      await load(selectedOcc.id);
      const monthYear = getBillMonthYear(selectedOcc);
      setToastMsg(`Bill paid for ${monthYear}`);
      setToastVisible(true);
    } catch (e) {
      console.error("[BillDetail] Link transaction failed:", e);
    } finally {
      hidePageLoader();
    }
  }

  async function handleConfirmUnlink() {
    if (!unlinkingTx || !selectedOcc) return;
    try {
      setUnlinking(true);
      await removeTransactionFromBill(selectedOcc.id, unlinkingTx.id);
      setUnlinkingTx(null);
      await refreshSelectedOccurrence();
      await load(selectedOcc.id);
      setToastMsg("Transaction unlinked successfully");
      setToastVisible(true);
    } catch (e) {
      console.error("[BillDetail] Unlink transaction failed:", e);
      Alert.alert("Error", "Could not unlink transaction.");
    } finally {
      setUnlinking(false);
    }
  }

  function handleEditTransaction(tx) {
    navigation.navigate("TransactionAdd", {
      isEdit: true,
      transaction: tx,
    });
  }

  async function handleSelectOccurrence(occ) {
    setSelectedOcc(occ);
    selectedOccRef.current = occ;
    setLinkedTxs(await getBillLinkedTransactions(occ.id));
    setSelectedLabel(
      new Date(occ.due_date).toLocaleDateString("en", {
        month: "short",
        year: "2-digit"
      })
    );
  }

  function handleJumpToOccurrence(targetOcc) {
    if (!targetOcc || !series || series.length === 0) return;
    const targetIdx = series.findIndex((o) => Number(o.id) === Number(targetOcc.id));
    if (targetIdx !== -1) {
      const itemsToShow = 5;
      const idealStart = Math.max(0, Math.min(series.length - itemsToShow, targetIdx - Math.floor(itemsToShow / 2)));
      const newOffset = Math.max(0, series.length - itemsToShow - idealStart);
      setChartOffset(newOffset);
    }
    handleSelectOccurrence(targetOcc);
  }

  const handleShareBill = async () => {
    try {
      const formattedDue = formatDueDate(activeBill.due_date);
      const amountStr = formatCurrency(activeBill.amount);
      const message = `Spendorax Bill Record:\n${bill.name}\nAmount: ${amountStr}\nDue Date: ${formattedDue}\nStatus: ${display?.label || 'Active'}`;
      await Share.share({ message });
    } catch (e) {
      console.error("[BillDetail] Share error:", e);
    }
  };

  const handleMoreOptions = () => {
    Alert.alert(
      bill.name,
      "Choose an action",
      [
        {
          text: "Edit Bill",
          onPress: () => {
            if (isCreditCardBill(activeBill)) {
              setEditing(true);
            } else {
              const targetOcc = selectedOcc || bill;
              selectedOccRef.current = targetOcc;
              navigation.navigate("BillOccurrenceEdit", { occurrence: targetOcc, bill });
            }
          }
        },
        {
          text: "Link Transaction",
          onPress: () => setShowLinkModal(true)
        },
        {
          text: "Delete Occurrence",
          style: "destructive",
          onPress: () => {
            setConfirmAction("delete_occ");
            setConfirmVisible(true);
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  // ── derived values ────────────────────────────────────────────────────────
  const activeBill = selectedOcc || bill;
  const display = getBillDisplayStatus(activeBill);
  const isFullyPaid =
    display?.label === "Paid" ||
    activeBill?.status === BILL_STATUS.PAID ||
    Number(activeBill?.is_paid) === 1 ||
    Boolean(activeBill?.is_completely_paid);
  const isPartiallyPaid =
    !isFullyPaid &&
    (display?.label === "Partially Paid" ||
      activeBill?.status === "partially_paid" ||
      Boolean(activeBill?.is_partially_paid) ||
      (Number(activeBill?.paid_amount || 0) > 0 &&
        Number(activeBill?.paid_amount || 0) < Number(activeBill?.amount || 0)));
  const isSkipped = activeBill?.status === BILL_STATUS.SKIPPED;
  const isPaidOrSkipped = isFullyPaid || isSkipped;

  const paidAmount = Number(activeBill?.paid_amount ?? activeBill?.total_paid ?? 0);
  const billAmount = Number(activeBill?.amount || 0);
  const remainingAmount = Math.max(0, billAmount - paidAmount);
  const isAnyLoading = isMarkingPaid || isSkipping || isUnskipping;

  const isPayable = (() => {
    if (isPaidOrSkipped) return false;
    if (!activeBill?.due_date) return true;

    const dueDate = new Date(activeBill.due_date);
    const now = new Date();

    if (bill?.recurrence_type === 'YEARLY') {
      return dueDate.getFullYear() <= now.getFullYear();
    }

    if (dueDate.getFullYear() < now.getFullYear()) return true;
    if (dueDate.getFullYear() > now.getFullYear()) return false;
    return dueDate.getMonth() <= now.getMonth();
  })();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* ── Stitch Custom Sticky TopBar ───────────────────────────────────── */}
      <View style={[styles.topBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.border, paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 14) }]}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            aria-label="Go Back"
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={styles.headerBackButton}>
            <MaterialCommunityIcons name="arrow-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <View style={styles.headerTitleRow}>
              <Text numberOfLines={1} style={[styles.headerTitle, { color: theme.textPrimary }]}>
                {bill.name}
              </Text>
              <View style={[
                styles.headerStatusBadge,
                isPaidOrSkipped
                  ? { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }
                  : { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }
              ]}>
                <View style={[
                  styles.headerStatusDot,
                  { backgroundColor: isPaidOrSkipped ? "#10b981" : "#059669" }
                ]} />
                <Text style={[
                  styles.headerStatusText,
                  { color: isPaidOrSkipped ? "#047857" : "#065f46" }
                ]}>
                  {isPaidOrSkipped ? (display?.label || "Paid") : "Active"}
                </Text>
              </View>
            </View>
            <Text numberOfLines={1} style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {bill.notes || (reduxCategory?.name ? `${reduxCategory.name} • ${formatRecurrenceType(bill.recurrence_type, bill.is_recurring)}` : "Govt. Guaranteed Savings Scheme")}
            </Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            aria-label="Share bill record"
            onPress={handleShareBill}
            activeOpacity={0.7}
            style={styles.headerActionBtn}>
            <MaterialCommunityIcons name="share-variant-outline" size={18} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity
            aria-label="More options"
            onPress={handleMoreOptions}
            activeOpacity={0.7}
            style={styles.headerActionBtn}>
            <MaterialCommunityIcons name="dots-vertical" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: isPayable ? 140 : 120 }
        ]}
        showsVerticalScrollIndicator={false}>

        {/* ── 1. Executive Dark Hero Card ───────────────────────────────────── */}
        <View style={styles.heroCard}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="heroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#0c1626" />
                <Stop offset="50%" stopColor="#101e34" />
                <Stop offset="100%" stopColor="#0c1424" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" rx={24} fill="url(#heroGradient)" />
          </Svg>
          {/* Ambient Glow accents */}
          <View style={styles.heroGlowTeal} pointerEvents="none" />
          <View style={styles.heroGlowBlue} pointerEvents="none" />

          {/* Top Row: Category Avatar + Recurrence + Occurrence & Status Badge */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroCategoryChipWrap}>
              <View style={styles.heroCategoryAvatar}>
                <MaterialCommunityIcons
                  name={reduxCategory?.icon || "cellphone"}
                  size={20}
                  color="#34d399"
                />
              </View>
              <View style={styles.heroCategoryTextWrap}>
                <View style={styles.heroCategoryNameRow}>
                  <Text numberOfLines={1} style={styles.heroCategoryName}>
                    {reduxCategory?.name || "General"}
                  </Text>
                  <View style={styles.heroBullet} />
                  <Text numberOfLines={1} style={styles.heroRecurrenceText}>
                    {formatRecurrenceType(bill.recurrence_type, bill.is_recurring)}
                  </Text>
                </View>
                <Text numberOfLines={1} style={styles.heroOccurrenceSub}>
                  Occurrence: <Text style={styles.heroOccurrenceHighlight}>{selectedLabel || formatDueDate(activeBill.due_date)}</Text>
                </Text>
              </View>
            </View>

            {/* Paid / Status Pill */}
            <View style={[
              styles.heroStatusPill,
              isPaidOrSkipped
                ? (activeBill.status === BILL_STATUS.SKIPPED ? styles.heroStatusPillSkipped : styles.heroStatusPillPaid)
                : (isPartiallyPaid
                    ? styles.heroStatusPillPartiallyPaid
                    : (display?.label?.toLowerCase().includes("overdue") ? styles.heroStatusPillOverdue : styles.heroStatusPillActive))
            ]}>
              <MaterialCommunityIcons
                name={
                  isPaidOrSkipped
                    ? (activeBill.status === BILL_STATUS.SKIPPED ? "skip-next" : "check")
                    : (isPartiallyPaid
                        ? "progress-check"
                        : (display?.label?.toLowerCase().includes("overdue") ? "alert-circle-outline" : "clock-outline"))
                }
                size={12}
                color={
                  isPaidOrSkipped
                    ? (activeBill.status === BILL_STATUS.SKIPPED ? "#f59e0b" : "#34d399")
                    : (isPartiallyPaid
                        ? "#60a5fa"
                        : (display?.label?.toLowerCase().includes("overdue") ? "#fb7185" : "#38bdf8"))
                }
                style={{ marginRight: 4 }}
              />
              <Text numberOfLines={1} style={[
                styles.heroStatusPillText,
                {
                  color: isPaidOrSkipped
                    ? (activeBill.status === BILL_STATUS.SKIPPED ? "#fde68a" : "#6ee7b7")
                    : (isPartiallyPaid
                        ? "#93c5fd"
                        : (display?.label?.toLowerCase().includes("overdue") ? "#fda4af" : "#bae6fd"))
                }
              ]}>
                {activeBill.status === BILL_STATUS.SKIPPED
                  ? "Skipped"
                  : (isPartiallyPaid ? "Partially Paid" : (display?.label || "Active"))}
              </Text>
            </View>
          </View>

          {/* Prominent Bill Title */}
          <Text numberOfLines={2} style={styles.heroMainTitle}>
            {bill.name}
          </Text>

          {/* Amount Dual Panel Container */}
          <View style={styles.heroAmountBox}>
            {/* Due Amount Panel */}
            <View style={styles.heroAmountCol}>
              <Text style={styles.heroAmountLabel}>DUE AMOUNT</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.heroAmountValueDue}>
                <CurrencyText amount={activeBill.amount} />
              </Text>
              <View style={styles.heroAmountSubRow}>
                <MaterialCommunityIcons name="calendar-outline" size={12} color="#94a3b8" />
                <Text numberOfLines={1} style={styles.heroAmountSubText}>
                  Due {formatDueDate(activeBill.due_date)}
                </Text>
              </View>
            </View>

            {/* Inset Divider */}
            <View style={styles.heroAmountDivider} />

            {/* Paid Amount Panel */}
            <View style={styles.heroAmountCol}>
              <Text style={[styles.heroAmountLabel, { color: "#34d399" }]}>PAID AMOUNT</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.heroAmountValuePaid}>
                <CurrencyText amount={activeBill.paid_amount || 0} />
              </Text>
              <View style={[
                styles.heroSettledBadge,
                isPaidOrSkipped
                  ? (activeBill.status === BILL_STATUS.SKIPPED
                    ? { backgroundColor: "rgba(245, 158, 11, 0.2)", borderColor: "rgba(251, 191, 36, 0.3)" }
                    : { backgroundColor: "rgba(16, 185, 129, 0.2)", borderColor: "rgba(52, 211, 153, 0.3)" })
                  : (isPartiallyPaid
                    ? { backgroundColor: "rgba(59, 130, 246, 0.2)", borderColor: "rgba(96, 165, 250, 0.3)" }
                    : { backgroundColor: "rgba(245, 158, 11, 0.2)", borderColor: "rgba(251, 191, 36, 0.3)" })
              ]}>
                <MaterialCommunityIcons
                  name={isPaidOrSkipped ? (activeBill.status === BILL_STATUS.SKIPPED ? "skip-next" : "check-circle") : (isPartiallyPaid ? "progress-check" : "clock-outline")}
                  size={11}
                  color={isPaidOrSkipped ? (activeBill.status === BILL_STATUS.SKIPPED ? "#fbbf24" : "#34d399") : (isPartiallyPaid ? "#60a5fa" : "#fbbf24")}
                  style={{ marginRight: 3 }}
                />
                <Text numberOfLines={1} style={[
                  styles.heroSettledBadgeText,
                  { color: isPaidOrSkipped ? (activeBill.status === BILL_STATUS.SKIPPED ? "#fde68a" : "#6ee7b7") : (isPartiallyPaid ? "#93c5fd" : "#fde68a") }
                ]}>
                  {isPaidOrSkipped ? (activeBill.status === BILL_STATUS.SKIPPED ? "Skipped" : "Fully Settled") : (isPartiallyPaid ? "Partially Paid" : "Pending")}
                </Text>
              </View>
            </View>
          </View>

          {/* 4-Grid Key Metadata (Inside Hero Card) */}
          <View style={styles.heroMetaGrid}>
            {/* Tile 1: Bill Due Date */}
            <View style={styles.heroMetaItem}>
              <View style={[styles.heroMetaIconWrap, { backgroundColor: "rgba(59, 130, 246, 0.18)", borderColor: "rgba(96, 165, 250, 0.3)" }]}>
                <MaterialCommunityIcons name="calendar-month-outline" size={15} color="#60a5fa" />
              </View>
              <View style={styles.heroMetaTextWrap}>
                <Text numberOfLines={1} style={styles.heroMetaLabel}>Bill Due Date</Text>
                <Text numberOfLines={1} style={styles.heroMetaValue}>
                  {formatDueDate(activeBill.due_date)}
                </Text>
              </View>
            </View>

            {/* Tile 2: Category */}
            <View style={styles.heroMetaItem}>
              <View style={[styles.heroMetaIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.18)", borderColor: "rgba(52, 211, 153, 0.3)" }]}>
                <MaterialCommunityIcons name="shape-outline" size={15} color="#34d399" />
              </View>
              <View style={styles.heroMetaTextWrap}>
                <Text numberOfLines={1} style={styles.heroMetaLabel}>Category</Text>
                <Text numberOfLines={1} style={styles.heroMetaValue}>
                  {reduxCategory?.name || "General"}
                </Text>
              </View>
            </View>

            {/* Tile 3: Source */}
            <View style={styles.heroMetaItem}>
              <View style={[styles.heroMetaIconWrap, { backgroundColor: "rgba(99, 102, 241, 0.18)", borderColor: "rgba(129, 140, 248, 0.3)" }]}>
                <MaterialCommunityIcons name="bank-outline" size={15} color="#818cf8" />
              </View>
              <View style={styles.heroMetaTextWrap}>
                <Text numberOfLines={1} style={styles.heroMetaLabel}>Source</Text>
                <Text numberOfLines={1} style={styles.heroMetaValue}>
                  {source?.name || "Not specified"}
                </Text>
              </View>
            </View>

            {/* Tile 4: Repeat */}
            <View style={styles.heroMetaItem}>
              <View style={[styles.heroMetaIconWrap, { backgroundColor: "rgba(20, 184, 166, 0.18)", borderColor: "rgba(45, 212, 191, 0.3)" }]}>
                <MaterialCommunityIcons name="calendar-sync-outline" size={15} color="#2dd4bf" />
              </View>
              <View style={styles.heroMetaTextWrap}>
                <Text numberOfLines={1} style={styles.heroMetaLabel}>Repeat</Text>
                <Text numberOfLines={1} style={styles.heroMetaValue}>
                  {formatRecurrenceType(bill.recurrence_type, bill.is_recurring)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── 2. Linked Transactions Section ─────────────────────────────────── */}
        <LinkedTransactionsCard
          linkedTxs={linkedTxs}
          onAddMore={() => setShowLinkModal(true)}
          onUnlink={(tx) => setUnlinkingTx(tx)}
          onEdit={handleEditTransaction}
        />

        {/* ── 3. Series Overview Section ────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.sectionTitle}>Series Overview</Text>
              <View style={styles.seriesGreenDot} />
            </View>
            <View style={styles.lifetimeBadge}>
              <MaterialCommunityIcons name="star-outline" size={13} color="#059669" style={{ marginRight: 4 }} />
              <Text style={styles.lifetimeBadgeText}>Lifetime Record</Text>
            </View>
          </View>

          {/* Settled Total */}
          <View style={styles.seriesCenterDisplay}>
            <Text style={styles.seriesBigAmount}>
              <CurrencyText amount={totalPaidAmount} />
            </Text>
            <View style={styles.seriesSubRow}>
              <Text style={styles.seriesSubText}>Total Amount Settled</Text>
              <View style={styles.seriesCyclesBadge}>
                <Text style={styles.seriesCyclesBadgeText}>
                  {paymentPercentage.toFixed(0)}% Settled • {series.length} Cycles
                </Text>
              </View>
            </View>
          </View>

          {/* 3-Metrics Grid */}
          <View style={styles.seriesMetricsGrid}>
            {/* Metric 1: Paid Bills */}
            <View style={[styles.seriesMetricCard, { backgroundColor: "#f0fdf4", borderColor: "#dcfce7" }]}>
              <View style={[styles.seriesMetricIconWrap, { backgroundColor: "#dcfce7" }]}>
                <MaterialCommunityIcons name="check" size={14} color="#059669" />
              </View>
              <Text style={styles.seriesMetricVal}>{paidCount}</Text>
              <Text style={styles.seriesMetricLbl}>Paid Bills</Text>
            </View>

            {/* Metric 2: Pending */}
            <View style={[styles.seriesMetricCard, { backgroundColor: "#fffbeb", borderColor: "#fef3c7" }]}>
              <View style={[styles.seriesMetricIconWrap, { backgroundColor: "#fef3c7" }]}>
                <MaterialCommunityIcons name="clock-outline" size={14} color="#d97706" />
              </View>
              <Text numberOfLines={1} style={styles.seriesMetricVal}>
                <CurrencyText amount={pendingAmount} />
              </Text>
              <Text style={styles.seriesMetricLbl}>Pending</Text>
            </View>

            {/* Metric 3: Total Occurrences */}
            <View style={[styles.seriesMetricCard, { backgroundColor: "#eff6ff", borderColor: "#dbeafe" }]}>
              <View style={[styles.seriesMetricIconWrap, { backgroundColor: "#dbeafe" }]}>
                <MaterialCommunityIcons name="text-box-outline" size={14} color="#2563eb" />
              </View>
              <Text style={styles.seriesMetricVal}>{series.length}</Text>
              <Text style={styles.seriesMetricLbl}>Occurrences</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.seriesProgressWrap}>
            <View style={styles.seriesProgressTrack}>
              <View style={[styles.seriesProgressFill, { width: `${paymentPercentage}%` }]} />
            </View>
            <View style={styles.seriesProgressStats}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.settledSmallDot} />
                <Text style={styles.settledSmallText}>
                  {paymentPercentage.toFixed(0)}% Settled
                </Text>
              </View>
              <Text style={styles.settledDetailAmounts}>
                <CurrencyText amount={totalPaidAmount} /> of <CurrencyText amount={totalDueAmount} />
              </Text>
            </View>
          </View>
        </View>

        {/* ── 4. Billing History Section ────────────────────────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", flex: 1, marginRight: 8 }}>
              <Text style={styles.sectionTitle}>Billing History</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{series.length} Occurrences</Text>
              </View>

              {/* Year Quick-Jump Pill */}
              {availableYears.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowYearJumpModal(true)}
                  style={[
                    styles.yearJumpPill,
                    {
                      backgroundColor: isDarkMode ? "#1e293b" : "#f1f5f9",
                      borderColor: theme.border,
                    },
                  ]}>
                  <MaterialCommunityIcons name="calendar-search" size={13} color="#006a61" style={{ marginRight: 4 }} />
                  <Text style={[styles.yearJumpPillText, { color: theme.textPrimary }]}>
                    {visibleYearLabel ? visibleYearLabel : "Year"}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={14} color={theme.textSecondary} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              )}
            </View>

            <View style={{ flexDirection: "row" }}>
              <TouchableOpacity
                onPress={() => setChartOffset((prev) => Math.min(Math.max(0, chartData.length - 5), prev + 1))}
                style={[
                  styles.paginationBtn,
                  (chartData.length <= 5 || chartOffset >= chartData.length - 5) && { opacity: 0.35 }
                ]}
                disabled={chartData.length <= 5 || chartOffset >= chartData.length - 5}>
                <MaterialCommunityIcons name="chevron-left" size={18} color="#0f172a" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setChartOffset((prev) => Math.max(0, prev - 1))}
                style={[
                  styles.paginationBtn,
                  chartOffset === 0 && { opacity: 0.35 }
                ]}
                disabled={chartOffset === 0}>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#0f172a" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Interactive Hint Banner */}
          <View style={styles.chartHintBanner}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MaterialCommunityIcons name="gesture-tap" size={14} color="#006a61" style={{ marginRight: 6 }} />
              <Text style={styles.chartHintText}>Tap bar to view cycle</Text>
            </View>
            {selectedLabel ? (
              <View style={styles.chartActivePill}>
                <View style={styles.chartActiveDot} />
                <Text style={styles.chartActiveText}>Active: {selectedLabel}</Text>
              </View>
            ) : null}
          </View>

          {/* Bar Chart */}
          <View style={styles.chartContainer}>
            <PremiumRoundedBarChart
              labels={displayChartData.map((x) => x.label)}
              ids={displayChartData.map((x) => x.id)}
              dueValues={displayChartData.map((x) => x.due)}
              paidValues={displayChartData.map((x) => x.paid)}
              width={screenWidth - 48}
              height={155}
              baseColor={'#006a61'}
              selectedLabel={selectedLabel}
              selectedId={selectedOcc?.id}
              isEmpty={displayChartData.length === 0}
              onBarPress={(data) => {
                const match = series.find((x) => Number(x.id) === Number(data.id));
                if (match) {
                  handleSelectOccurrence(match);
                }
              }}
            />
          </View>

          {/* Reconciled Timeline Footer */}
          <View style={styles.reconciliationFooter}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
              <View style={styles.reconciledDot} />
              <Text numberOfLines={1} style={styles.reconciledText}>
                Last cycle reconciled on <Text style={styles.reconciledBold}>{formatDueDate(activeBill.due_date)}</Text>
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setChartOffset(0)}>
              <Text style={styles.viewAllCyclesText}>View Latest →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dialogs */}
        <ConfirmDialog
          visible={confirmVisible}
          title="Delete Occurrence"
          message={`Delete the occurrence for ${formatDueDate(activeBill.due_date)}? It won't be recreated.`}
          confirmLabel="Delete"
          onCancel={() => {
            setConfirmVisible(false);
            setConfirmAction(null);
          }}
          onConfirm={async () => {
            try {
              showPageLoader();
              if (confirmAction === "delete_occ") {
                const isTemplate = activeBill.id === bill?.id && bill?.is_recurring;
                await softDeleteBillOccurrence(activeBill.id, isTemplate, activeBill.due_date);
                selectedOccRef.current = null;
                await load();
              }
            } catch (e) {
              console.error("[BillDetail] Action failed:", e);
            } finally {
              setConfirmVisible(false);
              setConfirmAction(null);
              hidePageLoader();
            }
          }}
        />

        <SkipBillModal
          visible={showSkipModal}
          bill={activeBill}
          loading={isSkipping}
          onCancel={() => !isSkipping && setShowSkipModal(false)}
          onConfirm={async () => {
            try {
              setIsSkipping(true);
              await skipBill(activeBill.id);
              await refreshSelectedOccurrence();
              await load(activeBill.id, activeBill.due_date);
              const monthYear = getBillMonthYear(activeBill);
              setToastMsg(`Bill skipped for ${monthYear}`);
              setToastVisible(true);
              setShowSkipModal(false);
            } catch (e) {
              console.error("[BillDetail] Skip failed:", e);
              Alert.alert("Error", "Unable to skip this bill occurrence.");
            } finally {
              setIsSkipping(false);
            }
          }}
        />

        <UnskipBillModal
          visible={showUnskipModal}
          bill={activeBill}
          loading={isUnskipping}
          onCancel={() => !isUnskipping && setShowUnskipModal(false)}
          onConfirm={handleUnskip}
        />

        <LinkTransactionModal
          visible={showLinkModal}
          bill={activeBill}
          onLink={handleLinkTransaction}
          onClose={() => setShowLinkModal(false)}
        />

        {/* ── Unlink Transaction Confirmation Modal ──────────────────────── */}
        <Modal
          visible={Boolean(unlinkingTx)}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => {
            if (!unlinking) setUnlinkingTx(null);
          }}>
          <View style={styles.unlinkModalOverlay}>
            <Pressable
              style={styles.unlinkModalBackdrop}
              onPress={() => {
                if (!unlinking) setUnlinkingTx(null);
              }}
            />
            <View
              style={[
                styles.unlinkModalCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.border,
                  borderWidth: isDarkMode ? 1 : 0,
                },
              ]}>
              {/* Top danger badge */}
              <View style={styles.unlinkIconCircle}>
                <MaterialCommunityIcons
                  name="link-variant-off"
                  size={28}
                  color="#EF4444"
                />
              </View>

              {/* Title & Subtitle */}
              <Text style={[styles.unlinkModalTitle, { color: theme.textPrimary }]}>
                Unlink Transaction?
              </Text>
              <Text style={[styles.unlinkModalSubtitle, { color: theme.textSecondary }]}>
                Are you sure you want to remove this linked transaction from the bill?
              </Text>

              {/* Transaction Preview Card */}
              {unlinkingTx && (
                <View
                  style={[
                    styles.unlinkTxPreview,
                    {
                      backgroundColor: isDarkMode ? "#1E293B" : "#F8FAFC",
                      borderColor: theme.border,
                    },
                  ]}>
                  <View
                    style={[
                      styles.unlinkTxIconWrap,
                      {
                        backgroundColor: `${unlinkingTx.category_color || unlinkingTx.source_color || "#006a61"}18`,
                      },
                    ]}>
                    <MaterialCommunityIcons
                      name={unlinkingTx.category_icon || unlinkingTx.source_icon || "cash"}
                      size={20}
                      color={unlinkingTx.category_color || unlinkingTx.source_color || "#006a61"}
                    />
                  </View>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text
                      style={[styles.unlinkTxPreviewName, { color: theme.textPrimary }]}
                      numberOfLines={1}>
                      {unlinkingTx.notes || "Payment Transaction"}
                    </Text>
                    <Text style={[styles.unlinkTxPreviewSub, { color: theme.textSecondary }]}>
                      {unlinkingTx.date
                        ? new Date(unlinkingTx.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                        : "—"}
                      {unlinkingTx.source_name ? ` • ${unlinkingTx.source_name}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[styles.unlinkTxPreviewAmount, { color: theme.textPrimary }]}>
                      <CurrencyText amount={Number(unlinkingTx.amount || 0)} />
                    </Text>
                  </View>
                </View>
              )}

              {/* Warning Note Pill */}
              <View
                style={[
                  styles.unlinkWarningBox,
                  {
                    backgroundColor: isDarkMode ? "rgba(217, 119, 6, 0.12)" : "#FFFBEB",
                    borderColor: isDarkMode ? "rgba(245, 158, 11, 0.28)" : "#FDE68A",
                  },
                ]}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={18}
                  color="#D97706"
                  style={{ marginRight: 8, marginTop: 1 }}
                />
                <Text
                  style={[
                    styles.unlinkWarningText,
                    { color: isDarkMode ? "#FBBF24" : "#92400E" },
                  ]}>
                  Unlinking will recalculate the bill's paid amount. If total paid drops below the due amount, the bill will return to unpaid/pending status.
                </Text>
              </View>

              {/* Action Buttons Row */}
              <View style={styles.unlinkActionRow}>
                <TouchableOpacity
                  style={[
                    styles.unlinkCancelBtn,
                    { backgroundColor: isDarkMode ? "#334155" : "#F1F5F9" },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setUnlinkingTx(null)}
                  disabled={unlinking}>
                  <Text
                    style={[
                      styles.unlinkCancelBtnText,
                      { color: isDarkMode ? "#F3F4F6" : "#475569" },
                    ]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.unlinkConfirmBtn}
                  activeOpacity={0.8}
                  onPress={handleConfirmUnlink}
                  disabled={unlinking}>
                  {unlinking ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="link-variant-off"
                        size={16}
                        color="#FFFFFF"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.unlinkConfirmBtnText}>Unlink</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <YearQuickJumpModal
          visible={showYearJumpModal}
          onClose={() => setShowYearJumpModal(false)}
          series={series}
          availableYears={availableYears}
          yearGroups={yearGroups}
          activeYear={activeBill?.due_date ? new Date(activeBill.due_date).getFullYear() : availableYears[0]}
          activeOccurrenceId={activeBill?.id}
          onSelectOccurrence={handleJumpToOccurrence}
        />
      </ScrollView>

      {/* ── 5. Stitch Bottom Action Dock ──────────────────────────────────── */}
      <View style={[styles.bottomDock, { backgroundColor: theme.cardBg, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 12) }]}>
        {isPayable && (
          <TouchableOpacity
            style={[
              styles.primaryPayButton,
              isAnyLoading && { opacity: 0.6 }
            ]}
            onPress={handleMarkPaid}
            disabled={isAnyLoading}
            activeOpacity={0.8}>
            {isMarkingPaid ? (
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
            ) : (
              <MaterialCommunityIcons
                name="check-circle"
                color="#ffffff"
                size={18}
                style={{ marginRight: 6 }}
              />
            )}
            <Text style={styles.primaryPayText}>
              {isPartiallyPaid ? `Pay Remaining (${formatCurrency(remainingAmount)})` : "Mark as Paid"}
            </Text>
          </TouchableOpacity>
        )}

        <View style={[
          styles.dockIconActionsRow,
          !isPayable && { justifyContent: "space-around", flex: 1 }
        ]}>
          {activeBill.status === BILL_STATUS.SKIPPED ? (
            <TouchableOpacity
              style={[styles.dockActionButton, isAnyLoading && { opacity: 0.6 }]}
              onPress={() => setShowUnskipModal(true)}
              disabled={isAnyLoading}
              activeOpacity={0.7}>
              <View style={[styles.dockIconCircle, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                {isUnskipping ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <MaterialCommunityIcons name="undo" color="#2563eb" size={18} />
                )}
              </View>
              <Text style={styles.dockActionLabel}>Unskip</Text>
            </TouchableOpacity>
          ) : !isPaidOrSkipped ? (
            <TouchableOpacity
              style={[styles.dockActionButton, isAnyLoading && { opacity: 0.6 }]}
              onPress={() => setShowSkipModal(true)}
              disabled={isAnyLoading}
              activeOpacity={0.7}>
              <View style={[styles.dockIconCircle, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}>
                {isSkipping ? (
                  <ActivityIndicator size="small" color="#d97706" />
                ) : (
                  <MaterialCommunityIcons name="skip-next" color="#d97706" size={18} />
                )}
              </View>
              <Text style={styles.dockActionLabel}>Skip</Text>
            </TouchableOpacity>
          ) : null}

          {/* Link Option */}
          <TouchableOpacity
            style={[styles.dockActionButton, isAnyLoading && { opacity: 0.5 }]}
            onPress={() => setShowLinkModal(true)}
            disabled={isAnyLoading}
            activeOpacity={0.7}>
            <View style={[styles.dockIconCircle, { backgroundColor: "#f0fdfa", borderColor: "#ccfbf1" }]}>
              <MaterialCommunityIcons name="link-variant" color="#006a61" size={19} />
            </View>
            <Text style={[styles.dockActionLabel, { color: "#006a61" }]}>Link</Text>
          </TouchableOpacity>

          {/* Edit Option */}
          {!isCreditCardBill(activeBill) && (
            <TouchableOpacity
              style={[styles.dockActionButton, isAnyLoading && { opacity: 0.5 }]}
              onPress={() => {
                const targetOcc = selectedOcc || bill;
                selectedOccRef.current = targetOcc;
                navigation.navigate("BillOccurrenceEdit", { occurrence: targetOcc, bill });
              }}
              disabled={isAnyLoading}
              activeOpacity={0.7}>
              <View style={[styles.dockIconCircle, { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" }]}>
                <MaterialCommunityIcons name="pencil-outline" color="#475569" size={18} />
              </View>
              <Text style={styles.dockActionLabel}>Edit</Text>
            </TouchableOpacity>
          )}

          {/* Delete Option */}
          <TouchableOpacity
            style={[styles.dockActionButton, isAnyLoading && { opacity: 0.5 }]}
            onPress={() => {
              setConfirmAction("delete_occ");
              setConfirmVisible(true);
            }}
            disabled={isAnyLoading}
            activeOpacity={0.7}>
            <View style={[styles.dockIconCircle, { backgroundColor: "#fff1f2", borderColor: "#fecdd3" }]}>
              <MaterialCommunityIcons name="trash-can-outline" color="#e11d48" size={18} />
            </View>
            <Text style={[styles.dockActionLabel, { color: "#e11d48" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Payment Source Picker Modal for Credit Card Bills */}
      <Modal
        visible={showPaymentSourcePicker}
        transparent
        animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.modalHeaderTitle}>
              Select Payment Source
            </Text>
            <Text style={styles.modalHeaderSubtitle}>
              Choose the account to record this credit card payment
            </Text>

            <PaperTextInput
              placeholder="Search source..."
              value={paymentSourceSearch}
              onChangeText={setPaymentSourceSearch}
              mode="outlined"
              left={<PaperTextInput.Icon icon="magnify" color="#7c839b" />}
              right={
                paymentSourceSearch ? (
                  <PaperTextInput.Icon
                    icon="close-circle"
                    color="#7c839b"
                    onPress={() => setPaymentSourceSearch("")}
                  />
                ) : null
              }
              style={styles.searchInput}
              outlineStyle={{ borderRadius: 14 }}
              outlineColor="#e2ebf8"
              activeOutlineColor="#006a61"
            />

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 240 }}>
              {paymentSources
                .filter((s) =>
                  s.name.toLowerCase().includes(paymentSourceSearch.toLowerCase())
                )
                .map((sItem) => (
                  <TouchableOpacity
                    key={sItem.id}
                    style={[styles.paymentSourceRow, { borderBottomColor: theme.border }]}
                    onPress={async () => {
                      try {
                        setIsMarkingPaid(true);
                        const paymentId = await payCreditCardBill({
                          bill: activeBill,
                          card: selectedCreditCard,
                          paymentSourceId: sItem.id
                        });
                        await markBillPaid(activeBill.id, null, paymentId);
                        try {
                          await onStatementPaid(selectedCreditCard.id);
                        } catch (e) {
                          console.warn("[BillDetailScreen] onStatementPaid failed:", e);
                        }
                        setShowPaymentSourcePicker(false);
                        setSelectedCreditCard(null);
                        setPaymentSourceSearch("");
                        await load(activeBill.id, activeBill.due_date);
                        const monthYear = getBillMonthYear(activeBill);
                        setToastMsg(`Bill paid for ${monthYear}`);
                        setToastVisible(true);
                      } catch (e) {
                        console.error("[BillDetail] Credit card payment failed:", e);
                        Alert.alert("Error", "Unable to complete payment.");
                      } finally {
                        setIsMarkingPaid(false);
                      }
                    }}>
                    <View style={styles.paymentSourceIconWrap}>
                      <MaterialCommunityIcons
                        name={sItem.icon || "wallet"}
                        size={20}
                        color="#006a61"
                      />
                    </View>
                    <Text style={[styles.paymentSourceName, { color: theme.textPrimary }]}>
                      {sItem.name}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                setShowPaymentSourcePicker(false);
                setSelectedCreditCard(null);
                setPaymentSourceSearch("");
                setIsMarkingPaid(false);
              }}
              activeOpacity={0.7}
              style={styles.modalCancelBtn}>
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full-screen ActivityIndicator Loader when marking paid */}
      {isMarkingPaid && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#006a61" />
            <Text style={styles.loadingText}>Processing payment...</Text>
          </View>
        </View>
      )}

      {/* Toast message upon payment completion */}
      <Snackbar
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
        duration={3000}
        style={styles.snackbar}
        action={{
          label: "OK",
          textColor: "#ffffff",
          onPress: () => setToastVisible(false),
        }}
      >
        <Text style={styles.snackbarText}>{toastMsg}</Text>
      </Snackbar>

      <PageLoader visible={loaderVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8faff",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  /* ── Stitch TopBar Header ─────────────────────────────────────────── */
  topBar: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderBottomWidth: 1,
    borderBottomColor: "#edf2fa",
    paddingHorizontal: 16,
    paddingBottom: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0b1c30",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 50,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  headerBackButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0b1c30",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerTitleWrap: {
    marginLeft: 10,
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Plus Jakarta Sans",
    letterSpacing: -0.3,
    maxWidth: screenWidth - 190,
  },
  headerStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
    marginLeft: 7,
  },
  headerStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  headerStatusText: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94a3b8",
    fontFamily: "Inter",
    marginTop: 1,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },

  /* ── 1. Executive Dark Hero Card ───────────────────────────────────── */
  heroCard: {
    backgroundColor: "#0c1626",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.6)",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#0c1424",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  heroGlowTeal: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(0, 163, 150, 0.18)",
  },
  heroGlowBlue: {
    position: "absolute",
    bottom: -40,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  heroCategoryChipWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  heroCategoryAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  heroCategoryTextWrap: {
    marginLeft: 10,
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  heroCategoryNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
  },
  heroCategoryName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
    flexShrink: 1,
  },
  heroBullet: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#64748b",
    marginHorizontal: 6,
    flexShrink: 0,
  },
  heroRecurrenceText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5eead4",
    flexShrink: 1,
  },
  heroOccurrenceSub: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  heroOccurrenceHighlight: {
    color: "#e2e8f0",
    fontWeight: "700",
  },
  heroStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    flexShrink: 0,
  },
  heroStatusPillPaid: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(52, 211, 153, 0.3)",
  },
  heroStatusPillPartiallyPaid: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    borderColor: "rgba(96, 165, 250, 0.4)",
  },
  heroStatusPillSkipped: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  heroStatusPillActive: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderColor: "rgba(96, 165, 250, 0.3)",
  },
  heroStatusPillOverdue: {
    backgroundColor: "rgba(244, 63, 94, 0.15)",
    borderColor: "rgba(251, 113, 133, 0.3)",
  },
  heroStatusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  heroMainTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
    marginVertical: 10,
    lineHeight: 28,
  },
  heroAmountBox: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 10,
  },
  heroAmountCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "space-between",
  },
  heroAmountDivider: {
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginHorizontal: 10,
  },
  heroAmountLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#94a3b8",
  },
  heroAmountValueDue: {
    fontSize: 21,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 2,
    letterSpacing: -0.3,
  },
  heroAmountSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  heroAmountSubText: {
    marginLeft: 4,
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
    flex: 1,
  },
  heroAmountValuePaid: {
    fontSize: 21,
    fontWeight: "800",
    color: "#6ee7b7",
    marginTop: 2,
    letterSpacing: -0.3,
  },
  heroSettledBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
    maxWidth: "100%",
    marginTop: 4,
  },
  heroSettledBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    flexShrink: 1,
  },
  heroMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 7,
  },
  heroMetaItem: {
    width: "48.5%",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  heroMetaIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    flexShrink: 0,
  },
  heroMetaTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroMetaLabel: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  heroMetaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 1,
  },

  /* ── Reusable Section Card Styling ────────────────────────────────── */
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e2ebf8",
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0b1c30",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Plus Jakarta Sans",
    letterSpacing: -0.2,
  },
  countBadge: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 1.5,
    marginLeft: 7,
  },
  countBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#475569",
    fontFamily: "Inter",
  },

  /* ── 2. Linked Transactions ────────────────────────────────────────── */
  linkNewBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#006a61",
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 20,
    shadowColor: "#006a61",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  linkNewBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#ffffff",
    fontFamily: "Inter",
  },
  linkedTxItem: {
    backgroundColor: "#f8faff",
    borderColor: "#edf3fc",
    borderWidth: 1,
    borderRadius: 16,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  txAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  txAvatarText: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "Plus Jakarta Sans",
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    maxWidth: 90,
  },
  sourceBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  bankChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(151, 20, 77, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(151, 20, 77, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  bankChipTop: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#97144d",
    letterSpacing: -0.2,
    fontFamily: "Plus Jakarta Sans",
  },
  bankChipBottom: {
    fontSize: 7.5,
    fontWeight: "800",
    color: "rgba(151, 20, 77, 0.8)",
    fontFamily: "Inter",
    marginTop: 1,
  },
  txTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter",
    maxWidth: screenWidth - 210,
  },
  verifiedTag: {
    backgroundColor: "#d1fae5",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  verifiedTagText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#065f46",
    fontFamily: "Inter",
  },
  txMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  txDateText: {
    fontSize: 11,
    color: "#94a3b8",
    fontFamily: "Inter",
    fontWeight: "500",
  },
  txBullet: {
    color: "#cbd5e1",
    marginHorizontal: 5,
    fontSize: 10,
  },
  txIdBadge: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  txIdBadgeText: {
    fontSize: 9.5,
    color: "#475569",
    fontWeight: "700",
    fontFamily: "Inter",
  },
  txAmountText: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Plus Jakarta Sans",
    marginTop: 3,
  },
  unlinkBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fecdd3",
    alignItems: "center",
    justifyContent: "center",
  },
  unlinkModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
  },
  unlinkModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  unlinkModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  unlinkIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  unlinkModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
    fontFamily: "Plus Jakarta Sans",
  },
  unlinkModalSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 4,
    fontFamily: "Inter",
  },
  unlinkTxPreview: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
    width: "100%",
  },
  unlinkTxIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  unlinkTxPreviewName: {
    fontSize: 13.5,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  unlinkTxPreviewSub: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: "Inter",
  },
  unlinkTxPreviewAmount: {
    fontSize: 13.5,
    fontWeight: "800",
    fontFamily: "Plus Jakarta Sans",
  },
  unlinkWarningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
    width: "100%",
  },
  unlinkWarningText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    lineHeight: 17,
    fontFamily: "Inter",
  },
  unlinkActionRow: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
  },
  unlinkCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  unlinkCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  unlinkConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#EF4444",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  unlinkConfirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter",
  },

  /* ── Year Quick-Jump Styles ───────────────────────────────────────── */
  yearJumpPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 14,
    borderWidth: 1,
    marginLeft: 6,
  },
  yearJumpPillText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  jumpModalCard: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "84%",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  jumpModalHeader: {
    alignItems: "center",
    marginBottom: 12,
    width: "100%",
  },
  jumpIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0, 106, 97, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  jumpModalTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    fontFamily: "Plus Jakarta Sans",
    marginBottom: 3,
  },
  jumpModalSubtitle: {
    fontSize: 12,
    fontFamily: "Inter",
    textAlign: "center",
  },
  jumpModalScroll: {
    width: "100%",
    flexShrink: 1,
    flexGrow: 0,
  },
  jumpModalScrollContent: {
    width: "100%",
    alignItems: "center",
    paddingBottom: 4,
  },
  jumpShortcutsRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    marginBottom: 12,
  },
  jumpShortcutBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  jumpShortcutText: {
    fontSize: 11.5,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  jumpSectionWrap: {
    width: "100%",
    marginBottom: 12,
  },
  jumpSectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    fontFamily: "Inter",
    alignSelf: "flex-start",
    marginBottom: 7,
  },
  jumpYearGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  yearGridBtn: {
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  yearGridBtnText: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: "Plus Jakarta Sans",
  },
  monthChipsGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    paddingVertical: 2,
  },
  cycleCardBtn: {
    width: "48.5%",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  cycleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  cycleCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 4,
  },
  monthStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  cycleMonthText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  cycleCurrentBadge: {
    backgroundColor: "#006a61",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  cycleCurrentBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
    fontFamily: "Inter",
    letterSpacing: 0.3,
  },
  cycleCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 5,
    width: "100%",
  },
  cycleAmountText: {
    fontSize: 11.5,
    fontWeight: "700",
    fontFamily: "Inter",
    flex: 1,
    marginRight: 4,
  },
  cycleStatusText: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "Inter",
    textTransform: "capitalize",
  },
  jumpCloseBtn: {
    width: "100%",
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  jumpCloseBtnText: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  emptyLinkedCard: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    backgroundColor: "#fbfcfe",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2ebf8",
    borderStyle: "dashed",
  },
  emptyLinkedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyLinkedTitle: {
    fontWeight: "800",
    fontSize: 13.5,
    color: "#0f172a",
    fontFamily: "Plus Jakarta Sans",
  },
  emptyLinkedSub: {
    marginTop: 3,
    fontSize: 11.5,
    color: "#94a3b8",
    textAlign: "center",
    fontFamily: "Inter",
    lineHeight: 16,
    maxWidth: 240,
  },

  /* ── 3. Series Overview ────────────────────────────────────────────── */
  seriesGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    marginLeft: 6,
  },
  lifetimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 2.5,
  },
  lifetimeBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#047857",
    fontFamily: "Inter",
  },
  seriesCenterDisplay: {
    alignItems: "center",
    paddingVertical: 10,
  },
  seriesBigAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: "#006a61",
    fontFamily: "Plus Jakarta Sans",
    letterSpacing: -0.5,
  },
  seriesSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  seriesSubText: {
    fontSize: 11.5,
    color: "#94a3b8",
    fontFamily: "Inter",
    fontWeight: "500",
    marginRight: 6,
  },
  seriesCyclesBadge: {
    backgroundColor: "#f0fdfa",
    borderColor: "#ccfbf1",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
  },
  seriesCyclesBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0f766e",
    fontFamily: "Inter",
  },
  seriesMetricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  seriesMetricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    marginHorizontal: 3,
  },
  seriesMetricIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  seriesMetricVal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Plus Jakarta Sans",
  },
  seriesMetricLbl: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    fontFamily: "Inter",
    marginTop: 2,
  },
  seriesProgressWrap: {
    marginTop: 14,
  },
  seriesProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  seriesProgressFill: {
    height: "100%",
    backgroundColor: "#006a61",
    borderRadius: 4,
  },
  seriesProgressStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  settledSmallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    marginRight: 4,
  },
  settledSmallText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#006a61",
    fontFamily: "Inter",
  },
  settledDetailAmounts: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    fontFamily: "Inter",
  },

  /* ── 4. Billing History ────────────────────────────────────────────── */
  paginationBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#e2ebf8",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  chartHintBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginBottom: 10,
  },
  chartHintText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#475569",
    fontFamily: "Inter",
  },
  chartActivePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chartActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#10b981",
    marginRight: 4,
  },
  chartActiveText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#006a61",
    fontFamily: "Inter",
  },
  chartContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 4,
  },
  reconciliationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
    marginTop: 6,
  },
  reconciledDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    marginRight: 5,
  },
  reconciledText: {
    fontSize: 11,
    color: "#64748b",
    fontFamily: "Inter",
    flex: 1,
  },
  reconciledBold: {
    fontWeight: "700",
    color: "#0f172a",
  },
  viewAllCyclesText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#006a61",
    fontFamily: "Inter",
  },

  /* ── 5. Stitch Bottom Action Dock ──────────────────────────────────── */
  bottomDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0b1c30",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },
  primaryPayButton: {
    flex: 1.5,
    height: 46,
    backgroundColor: "#006a61",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    shadowColor: "#006a61",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryPayText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
    fontFamily: "Inter",
  },
  dockIconActionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dockActionButton: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
  },
  dockIconCircle: {
    width: 44,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dockActionLabel: {
    marginTop: 3,
    fontSize: 10.5,
    fontWeight: "700",
    color: "#475569",
    fontFamily: "Inter",
  },

  /* ── Modals & Overlays ─────────────────────────────────────────────── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11, 28, 48, 0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
    maxHeight: "80%",
    shadowColor: "#0b1c30",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d9e6",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Plus Jakarta Sans",
  },
  modalHeaderSubtitle: {
    color: "#7c839b",
    fontFamily: "Inter",
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5fa",
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    backgroundColor: "#fbfcfe",
    marginVertical: 10,
    fontSize: 13,
  },
  emptyCandidatesBox: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyCandidatesTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Plus Jakarta Sans",
    marginTop: 8,
  },
  emptyCandidatesSub: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 20,
    fontFamily: "Inter",
  },
  candidateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5fa",
  },
  candidateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  candidateNotes: {
    fontWeight: "700",
    color: "#0f172a",
    fontSize: 13.5,
    fontFamily: "Inter",
  },
  candidateDate: {
    color: "#94a3b8",
    fontFamily: "Inter",
    fontSize: 11,
  },
  candidateSourceTag: {
    backgroundColor: "#f1f5fa",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
    marginLeft: 6,
  },
  candidateSourceText: {
    fontSize: 10,
    color: "#475569",
    fontWeight: "600",
  },
  candidateAmount: {
    fontWeight: "800",
    color: "#0f172a",
    fontSize: 14.5,
    fontFamily: "Plus Jakarta Sans",
  },
  modalCancelBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#f1f5fa",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 13.5,
    fontFamily: "Inter",
  },
  paymentSourceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5fa",
  },
  paymentSourceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#f0fdfa",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  paymentSourceName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 28, 48, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    elevation: 99999,
  },
  loadingCard: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0b1c30",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Plus Jakarta Sans",
  },
  snackbar: {
    position: "absolute",
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: "#006a61",
    borderRadius: 12,
  },
  snackbarText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13,
    fontFamily: "Inter",
  },
});
