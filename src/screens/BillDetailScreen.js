import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Button as PaperButton,
  Chip,
  Divider,
  TextInput as PaperTextInput,
} from "react-native-paper";
import { Dimensions, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import ManualDateTimePicker from "../components/ManualDateTimePicker";
import PremiumRoundedBarChart from "../components/PremiumRoundedBarChart";
import {
  getBillById,
  getBillSeries,
  markBillPaid,
  skipBill,
  unskipBill,
  deleteBill,
  getTransactionsForBillLink,
  getBillLinkedTransactions,
  linkAdditionalTransaction,
  removeTransactionFromBill,
  updateBill,
  createBill,
} from "../services/bills";
import { getCategories } from "../services/categories";
import { getSources } from "../services/sources";
import Card from "../components/Card";
import ConfirmDialog from "../components/ConfirmDialog";
import BillForm from "../components/BillForm";
import { Colors, Spacing } from "../components/Theme";
import {
  formatCurrency,
  formatDueDate,
  getBillDisplayStatus,
  BILL_STATUS,
} from "../services/billUtils";
import { getCreditCards, payCreditCardBill } from "../services/creditCards";
import { usePageLoader } from "../context/PageLoaderContext";
import { onStatementPaid } from "../services/creditCardScheduler";

const screenWidth = Dimensions.get("window").width;

// ─── sub-components ──────────────────────────────────────────────────────────

function DetailRow({ label, value }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#EEF1F6",
      }}
    >
      <Text style={{ color: Colors.muted, flex: 1 }}>{label}</Text>
      <Text
        style={{
          color: Colors.text,
          fontWeight: "600",
          flex: 1.5,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function StatusBadge({ display }) {
  return (
    <View
      style={{
        alignSelf: "center",
        paddingHorizontal: 14,
        paddingVertical: 4,
        borderRadius: 20,
        backgroundColor: `${display.color}20`,
        marginTop: 6,
      }}
    >
      <Text style={{ color: display.color, fontWeight: "700", fontSize: 13 }}>
        {display.label}
      </Text>
    </View>
  );
}

function LinkedTransactionsCard({ linkedTxs, onAddMore, onUnlink }) {
  return (
    <Card style={{ borderRadius: 20, overflow: "hidden" }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <View>
          <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.text }}>
            Linked Transactions
          </Text>
          <Text style={{ fontSize: 12, color: Colors.muted, marginTop: 2 }}>
            {linkedTxs.length} transaction{linkedTxs.length !== 1 ? "s" : ""}
          </Text>
        </View>
        {onAddMore && (
          <TouchableOpacity
            onPress={onAddMore}
            style={{
              backgroundColor: Colors.primary,
              width: 42,
              height: 42,
              borderRadius: 21,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {linkedTxs.length === 0 ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <MaterialCommunityIcons name="link-off" size={46} color="#CFCFCF" />
          <Text
            style={{ marginTop: 8, fontWeight: "700", color: Colors.muted }}
          >
            No linked transactions
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 12,
              color: Colors.muted,
              textAlign: "center",
            }}
          >
            Link a payment to automatically mark this bill as paid.
          </Text>
        </View>
      ) : (
        linkedTxs.map((tx) => (
          <View
            key={tx.id}
            style={{
              marginBottom: 10,
              borderRadius: 16,
              backgroundColor: "#FAFAFA",
              padding: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: `${tx.category_color || Colors.primary}20`,
                }}
              >
                <MaterialCommunityIcons
                  name={tx.category_icon || "cash"}
                  color={tx.category_color || Colors.primary}
                  size={24}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: Colors.text,
                  }}
                >
                  {tx.notes || "No Notes"}
                </Text>
                <Text
                  style={{ marginTop: 3, fontSize: 12, color: Colors.muted }}
                >
                  {tx.date
                    ? new Date(tx.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                  {tx.source_name ? ` • ${tx.source_name}` : ""}
                </Text>
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 17,
                    fontWeight: "800",
                    color: Colors.text,
                  }}
                >
                  {formatCurrency(tx.amount)}
                </Text>
              </View>
              {onUnlink && (
                <TouchableOpacity
                  onPress={() => onUnlink(tx)}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: "#FFECEC",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <MaterialCommunityIcons
                    name="link-variant-remove"
                    size={22}
                    color="#F44336"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

function OccurrenceList({ series, selectedId, onSelect }) {
  if (!series.length) return null;
  return (
    <Card style={{ borderRadius: 20 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 15,
        }}
      >
        <View>
          <Text style={{ fontWeight: "800", fontSize: 17, color: Colors.text }}>
            Timeline
          </Text>
          <Text style={{ fontSize: 12, color: Colors.muted, marginTop: 2 }}>
            {series.length} Bill Occurrences
          </Text>
        </View>
        <MaterialCommunityIcons
          name="calendar-month"
          size={24}
          color={Colors.primary}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {series.map((occ) => {
          const display = getBillDisplayStatus(occ);
          const selected = occ.id === selectedId;
          const d = new Date(occ.due_date);
          const month = d.toLocaleDateString("en-IN", { month: "short" });
          const day = d.getDate();
          return (
            <TouchableOpacity
              key={occ.id}
              onPress={() => onSelect(occ)}
              style={{
                width: 90,
                marginRight: 10,
                borderRadius: 18,
                paddingVertical: 14,
                paddingHorizontal: 10,
                backgroundColor: selected ? display.color : "#F6F7FB",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: selected ? "#fff" : Colors.muted,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {month}
              </Text>
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "900",
                  color: selected ? "#fff" : Colors.text,
                }}
              >
                {day}
              </Text>
              <View
                style={{
                  marginTop: 8,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: selected ? "#fff" : Colors.muted,
                  }}
                >
                  Due
                </Text>

                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: selected ? "#fff" : Colors.text,
                  }}
                >
                  {formatCurrency(occ.amount)}
                </Text>

                <Text
                  style={{
                    marginTop: 4,
                    fontSize: 10,
                    color: selected ? "#fff" : Colors.muted,
                  }}
                >
                  Paid
                </Text>

                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: selected ? "#fff" : "#2DBE60",
                  }}
                >
                  {formatCurrency(occ.paid_amount || 0)}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={
                  display.label === "Paid"
                    ? "check-circle"
                    : display.label === "Skipped"
                      ? "skip-next-circle"
                      : display.label === "Overdue"
                        ? "alert-circle"
                        : "clock-outline"
                }
                size={18}
                color={selected ? "#fff" : display.color}
                style={{ marginTop: 6 }}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Card>
  );
}

function LinkTransactionModal({ visible, bill, onLink, onClose }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !bill) return;
    setLoading(true);
    Promise.all([getTransactionsForBillLink(bill), getSources(true)])
      .then(([txs]) => setCandidates(txs))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [visible, bill?.id]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "72%",
            padding: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Text
              style={{ fontWeight: "700", fontSize: 16, color: Colors.text }}
            >
              Link Transaction
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={Colors.muted}
              />
            </TouchableOpacity>
          </View>
          <Text style={{ color: Colors.muted, fontSize: 13, marginBottom: 12 }}>
            Showing expense transactions from the last month for "{bill?.name}"
          </Text>
          {loading ? (
            <ActivityIndicator
              size="large"
              color={Colors.primary}
              style={{ marginVertical: 30 }}
            />
          ) : candidates.length === 0 ? (
            <Text
              style={{
                color: Colors.muted,
                textAlign: "center",
                marginVertical: 30,
              }}
            >
              No matching transactions found.
            </Text>
          ) : (
            <FlatList
              data={candidates}
              keyExtractor={(t) => String(t.id)}
              renderItem={({ item: tx }) => (
                <TouchableOpacity
                  onPress={() => onLink(tx)}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: "#EEF1F6",
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: `${tx.category_color || Colors.primary}20`,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={tx.category_icon || "cash"}
                      size={18}
                      color={tx.category_color || Colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontWeight: "600",
                        color: Colors.text,
                        fontSize: 14,
                      }}
                      numberOfLines={1}
                    >
                      {tx.notes || "(no notes)"}
                    </Text>
                    <Text
                      style={{
                        color: Colors.muted,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {tx.date
                        ? new Date(tx.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                      {tx.source_name ? ` · ${tx.source_name}` : ""}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontWeight: "800",
                      color: "#E46A6A",
                      marginLeft: 8,
                      fontSize: 15,
                    }}
                  >
                    {formatCurrency(tx.amount)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
          <PaperButton
            mode="outlined"
            onPress={onClose}
            style={{ marginTop: 8 }}
          >
            Cancel
          </PaperButton>
        </View>
      </View>
    </Modal>
  );
}

function OccurrenceEditModal({ visible, occurrence, onSave, onClose }) {
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDuePicker, setShowDuePicker] = useState(false);

  useEffect(() => {
    if (occurrence) {
      setAmount(String(occurrence.amount || ""));
      setDueDate(occurrence.due_date ? occurrence.due_date.slice(0, 10) : "");
    }
  }, [occurrence?.id]);

  const dueParts = dueDate ? dueDate.split("-").map(Number) : [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <View
          style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20 }}
        >
          <Text style={{ fontWeight: "700", fontSize: 18, marginBottom: 16 }}>
            Edit Occurrence
          </Text>
          <Text style={{ fontSize: 13, color: Colors.muted, marginBottom: 6 }}>
            Amount
          </Text>
          <PaperTextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            mode="outlined"
            style={{ marginBottom: 16, backgroundColor: "#fff" }}
          />
          <Text style={{ fontSize: 13, color: Colors.muted, marginBottom: 6 }}>
            Due Date
          </Text>
          <TouchableOpacity onPress={() => setShowDuePicker(true)}>
            <PaperTextInput
              value={dueDate}
              editable={false}
              mode="outlined"
              style={{ marginBottom: 20, backgroundColor: "#fff" }}
              right={
                <PaperTextInput.Icon
                  icon="calendar"
                  onPress={() => setShowDuePicker(true)}
                />
              }
            />
          </TouchableOpacity>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <PaperButton mode="text" onPress={onClose}>
              Cancel
            </PaperButton>
            <PaperButton
              mode="contained"
              onPress={() => {
                const amt = parseFloat(amount);
                if (!amount || isNaN(amt) || amt <= 0 || !dueDate) return;
                onSave(amt, dueDate);
              }}
            >
              Save
            </PaperButton>
          </View>
        </View>
      </View>

      {showDuePicker && Platform.OS !== "web" ? (
        <DateTimePicker
          value={new Date(dueDate || Date.now())}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            if (Platform.OS === "android") {
              setShowDuePicker(false);
              if (event.type === "dismissed") return;
            }
            if (selectedDate)
              setDueDate(selectedDate.toISOString().slice(0, 10));
            if (Platform.OS === "ios") setShowDuePicker(false);
          }}
        />
      ) : (
        <Modal visible={showDuePicker} transparent animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <View
              style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16 }}
            >
              <Text style={{ fontWeight: "700", marginBottom: 12 }}>
                Due date
              </Text>
              <ManualDateTimePicker
                year={dueParts[0] || new Date().getFullYear()}
                month={dueParts[1] || new Date().getMonth() + 1}
                day={dueParts[2] || new Date().getDate()}
                hour={0}
                minute={0}
                onChange={(y, m, d) =>
                  setDueDate(
                    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
                  )
                }
                onClose={() => setShowDuePicker(false)}
              />
              <PaperButton onPress={() => setShowDuePicker(false)}>
                Done
              </PaperButton>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

function isCreditCardBill(bill) {
  return (
    typeof bill?.notes === "string" &&
    (bill.notes.startsWith("Recurring payment template for") ||
      bill.notes.startsWith("Statement "))
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function BillDetailScreen({ route, navigation }) {
  const rawId = route.params?.billId ?? route.params?.id;
  const occurrenceId = route.params?.occurrenceId;
  const [resolvedTemplateId, setResolvedTemplateId] = useState(null);
  const billId = resolvedTemplateId ?? rawId;

  // ── All useState hooks first (hooks 1-14) ─────────────────────────────────
  const [bill, setBill] = useState(null);
  const [series, setSeries] = useState([]);
  const [selectedOcc, setSelectedOcc] = useState(null);
  const [linkedTxs, setLinkedTxs] = useState([]);
  const [category, setCategory] = useState(null);
  const [source, setSource] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showEditOcc, setShowEditOcc] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPaymentSourcePicker, setShowPaymentSourcePicker] = useState(false);
  const [paymentSources, setPaymentSources] = useState([]);
  const [paymentSourceSearch, setPaymentSourceSearch] = useState("");
  const [selectedCreditCard, setSelectedCreditCard] = useState(null);
  const { show: showPageLoader, hide: hidePageLoader } = usePageLoader();

  // ── hook 15 ───────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      load();
    }, [rawId]),
  );

  // ── hook 16 ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (bill) navigation.setOptions({ title: bill.name });
  }, [bill]);

  const filteredSeries = React.useMemo(() => {
    if (!selectedOcc) return series;

    return series.filter((occ) => occ.id === selectedOcc.id);
  }, [series, selectedOcc]);

  // ── hooks 17 & 18 — MUST be before any early return ──────────────────────
  // FIX: these were previously placed AFTER the early returns, causing
  // "Rendered more hooks than during the previous render" on mobile because
  // bill=null on first render triggered an early return, skipping these hooks.
  const chartData = React.useMemo(() => {
    return series.map((occ) => {
      const date = new Date(occ.due_date);

      return {
        id: occ.id,
        label: date.toLocaleDateString("en", {
          month: "short",
          year: "2-digit",
        }), // Jan 26, Feb 26, Jan 27...
        due: Number(occ.amount || 0),
        paid: Number(occ.paid_amount || 0),
      };
    });
  }, [series]);

  const totalDueAmount = React.useMemo(() => {
    return series.reduce((sum, bill) => sum + Number(bill.amount || 0), 0);
  }, [series]);

  const totalPaidAmount = React.useMemo(() => {
    return series.reduce((sum, bill) => sum + Number(bill.paid_amount || 0), 0);
  }, [series]);

  const pendingAmount = totalDueAmount - totalPaidAmount;

  const paidCount = React.useMemo(() => {
    return series.filter((b) => Number(b.paid_amount || 0) > 0).length;
  }, [series]);

  const paymentPercentage = React.useMemo(() => {
    if (totalDueAmount === 0) return 0;

    return Math.min(100, (totalPaidAmount / totalDueAmount) * 100);
  }, [totalDueAmount, totalPaidAmount]);

  // ── Early returns AFTER every hook ───────────────────────────────────────
  if (!bill && !editing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={Colors.primary} />
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

            await load();
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

  // ── helpers / actions ─────────────────────────────────────────────────────

  async function load() {
    if (!rawId) {
      hidePageLoader();
      return;
    }

    showPageLoader();

    try {
      // Resolve: if rawId is a child bill, walk up to the template
      const rawBill = await getBillById(rawId);
      const templateId = rawBill?.parent_bill_id || rawId;
      setResolvedTemplateId(templateId);

      const [b, s, cats, srcs] = await Promise.all([
        getBillById(templateId),
        getBillSeries(templateId),
        getCategories(true),
        getSources(true),
      ]);

      setBill(b);
      setSeries(s);
      if (b?.category_id)
        setCategory(cats.find((c) => c.id === b.category_id) || null);
      if (b?.source_id)
        setSource(srcs.find((ss) => ss.id === b.source_id) || null);

      // Select the right occurrence
      let occ = null;
      if (occurrenceId) {
        occ = s.find((o) => o.id === occurrenceId) || null;
      }
      if (!occ && rawBill?.parent_bill_id) {
        // came from statements screen with child bill id directly
        occ = s.find((o) => o.id === rawId) || null;
      }
      if (!occ) {
        const now = new Date();
        occ =
          s.find((o) => {
            if (!o.due_date) return false;
            const d = new Date(o.due_date);
            return (
              d.getFullYear() === now.getFullYear() &&
              d.getMonth() === now.getMonth() &&
              o.status !== BILL_STATUS.PAID &&
              o.status !== BILL_STATUS.SKIPPED
            );
          }) ||
          s[s.length - 1] ||
          null;
      }
      setSelectedOcc(occ);
      if (occ) {
        setLinkedTxs(await getBillLinkedTransactions(occ.id));
        if (occ.due_date) {
          setSelectedLabel(
            new Date(occ.due_date).toLocaleDateString("en", {
              month: "short",
              year: "2-digit",
            }),
          );
        }
      }
    } catch (e) {
      console.error("[BillDetail] load failed:", e);
      setBill(null);
      setSeries([]);
      setSelectedOcc(null);
      setLinkedTxs([]);
    } finally {
      hidePageLoader();
    }
  }

  async function refreshSelectedOccurrence() {
    const updatedSeries = await getBillSeries(billId);
    setSeries(updatedSeries);
    const occ =
      updatedSeries.find((o) => Number(o.id) === Number(selectedOcc?.id)) ||
      null;
    setSelectedOcc(occ);
    setLinkedTxs(occ ? await getBillLinkedTransactions(occ.id) : []);
  }

  const handleMarkPaid = async () => {
    if (!selectedOcc && !bill) return;
    const targetBill = selectedOcc || bill;
    try {
      showPageLoader();
      const cards = await getCreditCards(false);
      const card = cards.find(
        (c) =>
          Number(c.payment_bill_id) === Number(targetBill.id) ||
          Number(c.payment_bill_id) === Number(targetBill.parent_bill_id),
      );

      // Normal bill
      if (!card) {
        await markBillPaid(targetBill.id, {
          source_id: targetBill.source_id,
        });
        await load();
        hidePageLoader();
        return;
      }

      // Credit card bill
      const sources = await getSources(true);
      setPaymentSources(
        sources.filter((s) => Number(s.id) !== Number(card.source_id)),
      );
      setSelectedCreditCard(card);
      setPaymentSourceSearch("");
      setShowPaymentSourcePicker(true);
      /*
       * Keep loader ON while the payment-source picker
       * is displayed. It will be hidden after the actual
       * payment is completed or cancelled.
       */
    } catch (e) {
      console.error("[BillDetail] Mark paid failed:", e);
      hidePageLoader();
    }
  };

  async function handleUnskip() {
    if (!selectedOcc) return;
    try {
      showPageLoader();
      await unskipBill(selectedOcc.id);
      await refreshSelectedOccurrence();
      await load();
    } catch (e) {
      console.error("[BillDetail] Unskip failed:", e);
    } finally {
      hidePageLoader();
    }
  }

  async function handleLinkTransaction(tx) {
    if (!selectedOcc) return;
    try {
      showPageLoader();
      await linkAdditionalTransaction(selectedOcc.id, tx.id);
      setShowLinkModal(false);
      await refreshSelectedOccurrence();
      await load();
    } catch (e) {
      console.error("[BillDetail] Link transaction failed:", e);
    } finally {
      hidePageLoader();
    }
  }

  async function handleUnlinkTransaction(tx) {
    if (!selectedOcc) return;
    try {
      showPageLoader();
      await removeTransactionFromBill(selectedOcc.id, tx.id);
      await refreshSelectedOccurrence();
      await load();
    } catch (e) {
      console.error("[BillDetail] Unlink transaction failed:", e);
    } finally {
      hidePageLoader();
    }
  }

  async function handleSelectOccurrence(occ) {
    setSelectedOcc(occ);
    setLinkedTxs(await getBillLinkedTransactions(occ.id));
    setSelectedLabel(
      new Date(occ.due_date).toLocaleDateString("en", {
        month: "short",
        year: "2-digit",
      }),
    );
  }

  async function handleSaveOccurrence(newAmount, newDueDate) {
    if (!selectedOcc) return;
    try {
      showPageLoader();
      /*
       * For CC statement bills (child bills), always
       * update the existing occurrence.
       *
       * For a normal recurring template, create a child
       * occurrence instead.
       */
      if (
        selectedOcc.id === bill.id &&
        bill.is_recurring &&
        !isCreditCardBill(bill)
      ) {
        await createBill({
          ...bill,
          amount: newAmount,
          due_date: newDueDate,
          is_recurring: 0,
          recurrence_type: null,
          parent_bill_id: bill.id,
        });
      } else {
        await updateBill(selectedOcc.id, {
          amount: newAmount,
          due_date: newDueDate,
        });
      }
      setShowEditOcc(false);
      await load();
    } catch (e) {
      console.error("[BillDetail] Save occurrence failed:", e);
    } finally {
      hidePageLoader();
    }
  }

  // ── derived values ────────────────────────────────────────────────────────
  const activeBill = selectedOcc || bill;
  const display = getBillDisplayStatus(activeBill);
  const isPaidOrSkipped =
    activeBill.status === BILL_STATUS.PAID ||
    activeBill.status === BILL_STATUS.SKIPPED;
  // A generated bill can be paid at any time.
  // Payment is no longer restricted to the bill's due month.

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.xs, paddingBottom: 120 }}
      >
        {/* Bill Summary */}
        <Card style={{ marginBottom: 12, borderRadius: 20 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "800",
              color: Colors.text,
              marginBottom: 18,
            }}
          >
            Bill Summary
          </Text>

          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 34,
                fontWeight: "900",
                color: "#2DBE60",
              }}
            >
              {formatCurrency(totalPaidAmount)}
            </Text>

            <Text
              style={{
                color: Colors.muted,
                fontWeight: "600",
                marginTop: 4,
              }}
            >
              Total Amount Paid
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <View style={styles.summaryTile}>
              <MaterialCommunityIcons
                name="check-circle"
                size={26}
                color="#2DBE60"
              />

              <Text style={styles.summaryValue}>{paidCount}</Text>

              <Text style={styles.summaryLabel}>Paid Bills</Text>
            </View>

            <View style={styles.summaryTile}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={26}
                color="#FF9800"
              />

              <Text style={styles.summaryValue}>
                {formatCurrency(pendingAmount)}
              </Text>

              <Text style={styles.summaryLabel}>Pending</Text>
            </View>

            <View style={styles.summaryTile}>
              <MaterialCommunityIcons
                name="receipt"
                size={26}
                color={Colors.primary}
              />

              <Text style={styles.summaryValue}>{series.length}</Text>

              <Text style={styles.summaryLabel}>Total Bills</Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 20,
            }}
          >
            <View
              style={{
                height: 10,
                borderRadius: 6,
                backgroundColor: "#ECECEC",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${paymentPercentage}%`,
                  height: "100%",
                  backgroundColor: "#2DBE60",
                }}
              />
            </View>

            <Text
              style={{
                marginTop: 8,
                textAlign: "center",
                color: Colors.muted,
                fontWeight: "600",
              }}
            >
              {formatCurrency(totalPaidAmount)} of{" "}
              {formatCurrency(totalDueAmount)} Paid
            </Text>
          </View>
        </Card>

        {/* Chart */}
        <Card
          style={{ marginBottom: 12, borderRadius: 20, overflow: "hidden" }}
        >
          <Text
            style={{
              fontWeight: "800",
              fontSize: 17,
              color: Colors.text,
              marginBottom: 10,
            }}
          >
            Bill History
          </Text>
          <PremiumRoundedBarChart
            labels={chartData.map((x) => x.label)}
            ids={chartData.map((x) => x.id)}
            dueValues={chartData.map((x) => x.due)}
            paidValues={chartData.map((x) => x.paid)}
            width={screenWidth - 56}
            height={250}
            baseColor={category?.color || Colors.primary}
            selectedLabel={selectedLabel}
            isEmpty={chartData.length === 0}
            onBarPress={(data) => {
              const match = series.find((x) => x.id === data.id);

              if (match) {
                handleSelectOccurrence(match);
              }
            }}
          />
        </Card>

        {/* Hero card */}
        <Card
          style={{
            marginBottom: 12,
            borderRadius: 22,
            overflow: "hidden",
            padding: 0,
          }}
        >
          <View
            style={{
              backgroundColor: `${display.color}12`,
              padding: 18,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: `${display.color}25`,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <MaterialCommunityIcons
                name={category?.icon || "receipt"}
                size={30}
                color={display.color}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text
                numberOfLines={1}
                style={{ fontSize: 19, fontWeight: "800", color: Colors.text }}
              >
                {bill.name}
              </Text>
              <View style={{ marginTop: 8 }}>
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.muted,
                  }}
                >
                  Due Amount
                </Text>

                <Text
                  style={{
                    fontSize: 30,
                    fontWeight: "900",
                    color: display.color,
                  }}
                >
                  {formatCurrency(activeBill.amount)}
                </Text>

                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: Colors.muted,
                  }}
                >
                  Paid Amount
                </Text>

                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "800",
                    color: "#2DBE60",
                  }}
                >
                  {formatCurrency(activeBill.paid_amount || 0)}
                </Text>
              </View>
              <View
                style={{
                  alignSelf: "flex-start",
                  marginTop: 8,
                  backgroundColor: display.color,
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 20,
                }}
              >
                <Text
                  style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}
                >
                  {display.label}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 14 }}>
            {[
              {
                icon: "calendar",
                label: "Due",
                value: formatDueDate(activeBill.due_date),
              },
              {
                icon: category?.icon || "shape",
                label: "Category",
                value: category?.name || "-",
              },
              { icon: "bank", label: "Source", value: source?.name || "-" },
              {
                icon: "repeat",
                label: "Repeat",
                value: bill.is_recurring
                  ? `${bill.recurrence_interval || 1} ${bill.recurrence_type}`
                  : "No",
              },
            ].map(({ icon, label, value }) => (
              <View key={label} style={styles.infoTile}>
                <MaterialCommunityIcons
                  name={icon}
                  color={Colors.primary}
                  size={18}
                />
                <Text style={styles.infoTitle}>{label}</Text>
                <Text numberOfLines={1} style={styles.infoValue}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Linked transactions */}
        <LinkedTransactionsCard
          linkedTxs={linkedTxs}
          onAddMore={() => setShowLinkModal(true)}
          onUnlink={handleUnlinkTransaction}
        />

        {/* Occurrence timeline */}
        <OccurrenceList
          series={series}
          selectedId={selectedOcc?.id}
          onSelect={handleSelectOccurrence}
        />

        {/* Dialogs */}
        <ConfirmDialog
          visible={confirmVisible}
          title={
            confirmAction === "delete_occ" ? "Delete Occurrence" : "Skip Bill"
          }
          message={
            confirmAction === "delete_occ"
              ? `Delete the occurrence for ${formatDueDate(activeBill.due_date)}? It won't be recreated.`
              : `Skip "${activeBill.name}" for ${formatDueDate(activeBill.due_date)}?`
          }
          confirmLabel={confirmAction === "skip" ? "Skip" : "Delete"}
          onCancel={() => {
            setConfirmVisible(false);
            setConfirmAction(null);
          }}
          onConfirm={async () => {
            try {
              showPageLoader();
              if (confirmAction === "delete_occ") {
                const isTemplate =
                  activeBill.id === bill?.id && bill?.is_recurring;
                if (isTemplate) {
                  // Template occurrence:
                  // create tombstone child and delete it.
                  const newId = await createBill({
                    ...bill,
                    is_recurring: 0,
                    recurrence_type: null,
                    parent_bill_id: bill.id,
                  });
                  await deleteBill(newId);
                } else {
                  // Normal child occurrence.
                  await deleteBill(activeBill.id);
                }
                // Wait for everything to finish.
                await load();
              } else if (confirmAction === "skip") {
                await skipBill(activeBill.id);
                await refreshSelectedOccurrence();
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

        <LinkTransactionModal
          visible={showLinkModal}
          bill={activeBill}
          onLink={handleLinkTransaction}
          onClose={() => setShowLinkModal(false)}
        />

        <OccurrenceEditModal
          visible={showEditOcc}
          occurrence={selectedOcc}
          onSave={handleSaveOccurrence}
          onClose={() => setShowEditOcc(false)}
        />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        {!isPaidOrSkipped && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#2DBE60" }]}
            onPress={handleMarkPaid}
          >
            <MaterialCommunityIcons
              name="check-circle"
              color="#fff"
              size={22}
            />
            <Text style={styles.actionTextWhite}>Paid</Text>
          </TouchableOpacity>
        )}

        {activeBill.status === BILL_STATUS.SKIPPED ? (
          <TouchableOpacity style={styles.actionButton} onPress={handleUnskip}>
            <MaterialCommunityIcons name="undo" color="#1976D2" size={22} />
            <Text style={styles.actionText}>Unskip</Text>
          </TouchableOpacity>
        ) : !isPaidOrSkipped ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setConfirmAction("skip");
              setConfirmVisible(true);
            }}
          >
            <MaterialCommunityIcons
              name="skip-next-circle"
              color="#F57C00"
              size={22}
            />
            <Text style={styles.actionText}>Skip</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowLinkModal(true)}
        >
          <MaterialCommunityIcons
            name="link-variant"
            color={Colors.primary}
            size={22}
          />
          <Text style={styles.actionText}>Link</Text>
        </TouchableOpacity>

        {!isCreditCardBill(activeBill) && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowEditOcc(true)}
          >
            <MaterialCommunityIcons
              name="square-edit-outline"
              color="#FF9800"
              size={22}
            />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setConfirmAction("delete_occ");
            setConfirmVisible(true);
          }}
        >
          <MaterialCommunityIcons
            name="delete-outline"
            color="#F44336"
            size={22}
          />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showPaymentSourcePicker}
        transparent
        animationType="slide"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              maxHeight: "55%",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontWeight: "700",
                fontSize: 16,
                marginBottom: 12,
              }}
            >
              Select Payment Source
            </Text>

            <PaperTextInput
              placeholder="Search source..."
              value={paymentSourceSearch}
              onChangeText={setPaymentSourceSearch}
              mode="outlined"
              style={{ marginBottom: 10 }}
            />

            <ScrollView>
              {paymentSources
                .filter((s) =>
                  s.name
                    .toLowerCase()
                    .includes(paymentSourceSearch.toLowerCase()),
                )
                .map((source) => (
                  <TouchableOpacity
                    key={source.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                    }}
                    onPress={async () => {
                      try {
                        showPageLoader();
                        const paymentId = await payCreditCardBill({
                          bill: activeBill,
                          card: selectedCreditCard,
                          paymentSourceId: source.id,
                        });
                        await markBillPaid(activeBill.id, {
                          createTransaction: false,
                          existingTransactionId: paymentId,
                        });
                        try {
                          await onStatementPaid(selectedCreditCard.id);
                        } catch (e) {
                          console.warn(
                            "[BillDetailScreen] onStatementPaid failed:",
                            e,
                          );
                        }
                        setShowPaymentSourcePicker(false);
                        setSelectedCreditCard(null);
                        setPaymentSourceSearch("");
                        await load();
                      } catch (e) {
                        console.error(
                          "[BillDetail] Credit card payment failed:",
                          e,
                        );
                        Alert.alert("Error", "Unable to complete payment.");
                      } finally {
                        hidePageLoader();
                      }
                    }}
                  >
                    <MaterialCommunityIcons
                      name={source.icon || "wallet"}
                      size={22}
                      color={Colors.primary}
                    />
                    <Text
                      style={{
                        marginLeft: 10,
                        flex: 1,
                      }}
                    >
                      {source.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <PaperButton
              onPress={() => {
                setShowPaymentSourcePicker(false);
                setSelectedCreditCard(null);
                setPaymentSourceSearch("");
                hidePageLoader();
              }}
            >
              Cancel
            </PaperButton>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  infoTile: { width: "50%", paddingVertical: 12, flexDirection: "column" },
  infoTitle: { marginTop: 4, fontSize: 11, color: Colors.muted },
  infoValue: {
    marginTop: 2,
    fontWeight: "700",
    color: Colors.text,
    fontSize: 14,
  },
  bottomBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 14,
  },
  actionText: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: Colors.text,
  },
  actionTextWhite: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  summaryTile: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
  },
  summaryLabel: {
    marginTop: 3,
    color: Colors.muted,
    fontSize: 12,
  },
});
