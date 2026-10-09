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
  Alert
} from
  "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Button as PaperButton,


  TextInput as PaperTextInput
} from
  "react-native-paper";
import { Dimensions } from "react-native";
import MuiDateTimePicker from "../components/MuiDateTimePicker";
import PremiumRoundedBarChart from "../components/PremiumRoundedBarChart";
import {
  getBillById,
  getBillSeries,
  markBillPaid,
  skipBill,
  unskipBill,
  deleteBill,
  softDeleteBillOccurrence,
  getTransactionsForBillLink,
  getBillLinkedTransactions,
  linkAdditionalTransaction,
  removeTransactionFromBill,
  updateBill,
  createBill
} from
  "../services/bills";
import { getCategories } from "../services/categories";
import { getSources } from "../services/sources";
import Card from "../components/Card";
import ConfirmDialog from "../components/ConfirmDialog";
import BillForm from "../components/BillForm";
import CurrencyText from "../components/CurrencyText";
import { Colors, Spacing } from "../components/Theme";
import {
  formatCurrency,
  formatDueDate,
  getBillDisplayStatus,
  BILL_STATUS,
  getOccurrenceDateConstraints
} from
  "../services/billUtils";
import { getCreditCards, payCreditCardBill } from "../services/creditCards";
import { usePageLoader } from "../context/PageLoaderContext";
import PageLoader from "../components/PageLoader";
import { onStatementPaid } from "../services/creditCardScheduler";
import { setCategoriesMap } from "../redux/slices/categorySlice";
import {
  useAppDispatch,
  useBills,
  useBillsSummary,
  useCategoriesMap
} from
  "../redux/hooks";

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
        borderBottomColor: "#eff4ff"
      }}>

      <Text style={{ color: "#7c839b", fontFamily: "Inter", flex: 1 }}>{label}</Text>
      <Text
        style={{
          color: "#0b1c30",
          fontWeight: "600",
          flex: 1.5,
          textAlign: "right"
        }}>

        {value}
      </Text>
    </View>);

}

function StatusBadge({ display }) {
  return (
    <View
      style={{
        alignSelf: "center",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        backgroundColor: `${display.color}20`,
        flexDirection: 'row',
        alignItems: 'center'
      }}>
      <MaterialCommunityIcons name="check-circle" size={12} color={display.color} style={{ marginRight: 4 }} />
      <Text style={{ color: display.color, fontWeight: "700", fontSize: 12, fontFamily: "Inter" }}>
        {display.label}
      </Text>
    </View>);
}


function LinkedTransactionsCard({ linkedTxs, onAddMore, onUnlink }) {
  return (
    <Card style={{ borderRadius: 16, overflow: "hidden", backgroundColor: '#ffffff', borderColor: '#dce9ff', borderWidth: 1, elevation: 1, shadowColor: '#0b1c30', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14
        }}>

        <View>
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#0b1c30", fontFamily: "Plus Jakarta Sans" }}>
            Linked Transactions
          </Text>
          <Text style={{ fontSize: 13, color: "#7c839b", marginTop: 2, fontFamily: "Inter" }}>
            {linkedTxs.length} transaction{linkedTxs.length !== 1 ? "s" : ""}
          </Text>
        </View>
        {onAddMore &&
          <TouchableOpacity
            onPress={onAddMore}
            style={{
              backgroundColor: "#131b2e",
              width: 40,
              height: 40,
              borderRadius: 8,
              justifyContent: "center",
              alignItems: "center"
            }}>

            <MaterialCommunityIcons name="plus" size={24} color="#ffffff" />
          </TouchableOpacity>
        }
      </View>

      {linkedTxs.length === 0 ?
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <MaterialCommunityIcons name="link-off" size={46} color="#c6c6cd" />
          <Text
            style={{ marginTop: 8, fontWeight: "600", color: "#45464d", fontFamily: "Plus Jakarta Sans" }}>

            No linked transactions
          </Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "#7c839b",
              textAlign: "center",
              fontFamily: "Inter"
            }}>

            Link a payment to automatically mark this bill as paid.
          </Text>
        </View> :

        linkedTxs.map((tx) =>
          <View
            key={tx.id}
            style={{
              marginBottom: 10,
              borderRadius: 8,
              backgroundColor: "#f8f9ff",
              borderWidth: 1,
              borderColor: "#eff4ff",
              padding: 14
            }}>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: `${tx.category_color || '#131b2e'}15`
                }}>

                <MaterialCommunityIcons
                  name={tx.category_icon || "cash"}
                  color={tx.category_color || '#131b2e'}
                  size={24} />

              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#0b1c30",
                    fontFamily: "Inter"
                  }}>

                  {tx.notes || "No Notes"}
                </Text>
                <Text
                  style={{ marginTop: 3, fontSize: 12, color: "#7c839b", fontFamily: "Inter" }}>

                  {tx.date ?
                    new Date(tx.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    }) :
                    "—"}
                  {tx.source_name ? ` • ${tx.source_name}` : ""}
                </Text>
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 16,
                    fontWeight: "700",
                    color: "#0b1c30",
                    fontFamily: "Plus Jakarta Sans"
                  }}>

                  {formatCurrency(tx.amount)}
                </Text>
              </View>
              {onUnlink &&
                <TouchableOpacity
                  onPress={() => onUnlink(tx)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: "#ffdad6",
                    justifyContent: "center",
                    alignItems: "center"
                  }}>

                  <MaterialCommunityIcons
                    name="link-variant-remove"
                    size={22}
                    color="#ba1a1a" />

                </TouchableOpacity>
              }
            </View>
          </View>
        )
      }
    </Card>);
}

function OccurrenceList({ series, selectedId, onSelect }) {
  if (!series.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
      {series.map((occ) => {
        const display = getBillDisplayStatus(occ);
        const selected = occ.id === selectedId;
        const d = new Date(occ.due_date);
        const month = d.toLocaleDateString("en-IN", { month: "short" });
        const day = d.getDate();

        let statusColor = "#0b1c30";
        if (display.label === "Paid") statusColor = "#006a61";
        if (display.label === "Overdue") statusColor = "#ba1a1a";
        if (display.label === "Pending" || display.label === "Upcoming") statusColor = "#c76c00";
        if (display.label === "Skipped") statusColor = "#45464d";

        return (
          <TouchableOpacity
            key={occ.id}
            onPress={() => onSelect(occ)}
            style={{
              width: 104,
              marginRight: 12,
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 12,
              backgroundColor: "#f4f8fb",
              alignItems: "center"
            }}>

            <Text
              style={{
                color: "#7c839b",
                fontSize: 12,
                fontWeight: "500",
                fontFamily: "Inter"
              }}>
              {month}
            </Text>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "700",
                color: "#0b1c30",
                fontFamily: "Plus Jakarta Sans"
              }}>
              {day}
            </Text>
            <View style={{ marginTop: 8, alignItems: "center" }}>
              <Text style={{ fontSize: 11, color: "#45464d", fontFamily: "Inter" }}>
                Due {formatCurrency(occ.amount)}
              </Text>
              <Text style={{ fontSize: 11, color: "#006a61", fontFamily: "Inter", marginTop: 2, fontWeight: "500" }}>
                Paid <CurrencyText amount={occ.paid_amount || 0} />
              </Text>
            </View>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: display.label === "Paid" ? "#006a61" : "#e5eeff", justifyContent: 'center', alignItems: 'center', marginTop: 10 }}>
              <MaterialCommunityIcons
                name={
                  display.label === "Paid" ? "check" :
                    display.label === "Skipped" ? "skip-next" :
                      display.label === "Overdue" ? "alert" :
                        "clock-outline"
                }
                size={20}
                color={display.label === "Paid" ? "#fff" : display.color} />
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function LinkTransactionModal({ visible, bill, onLink, onClose }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [linkingId, setLinkingId] = useState(null);

  useEffect(() => {
    if (!visible || !bill) return;
    setSearch("");
    setLoading(true);
    Promise.all([getTransactionsForBillLink(bill), getSources(true)]).
      then(([txs]) => setCandidates(txs)).
      catch(() => setCandidates([])).
      finally(() => setLoading(false));
  }, [visible, bill?.id]);

  const filteredCandidates = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((tx) => {
      const notes = String(tx.notes || "").toLowerCase();
      const source = String(tx.source_name || "").toLowerCase();
      const category = String(tx.category_name || "").toLowerCase();
      const amount = String(tx.amount || "").toLowerCase();
      const date = tx.date ?
        new Date(tx.date).
          toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
          }).
          toLowerCase() :
        "";
      return (
        notes.includes(query) ||
        source.includes(query) ||
        category.includes(query) ||
        amount.includes(query) ||
        date.includes(query));

    });
  }, [candidates, search]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>

      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end"
        }}>

        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "78%",
            padding: 16
          }}>

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4
            }}>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontWeight: "600",
                  fontSize: 18,
                  color: "#0b1c30"
                }}>

                Link Transaction
              </Text>
              <Text
                style={{
                  color: "#7c839b", fontFamily: "Inter",
                  fontSize: 12,
                  marginTop: 2
                }}>

                {filteredCandidates.length} transaction
                {filteredCandidates.length !== 1 ? "s" : ""} available
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: "#eff4ff",
                justifyContent: "center",
                alignItems: "center"
              }}>

              <MaterialCommunityIcons
                name="close"
                size={22}
                color={'#7c839b'} />

            </TouchableOpacity>
          </View>

          {/* Info */}
          <Text
            style={{
              color: "#7c839b", fontFamily: "Inter",
              fontSize: 13,
              marginTop: 8,
              marginBottom: 12
            }}>

            Select an expense transaction to link with "{bill?.name}"
          </Text>

          {/* Search */}
          <PaperTextInput
            mode="outlined"
            placeholder="Search transactions..."
            value={search}
            onChangeText={setSearch}
            left={<PaperTextInput.Icon icon="magnify" />}
            right={
              search ?
                <PaperTextInput.Icon
                  icon="close-circle"
                  onPress={() => setSearch("")} /> :

                null
            }
            style={{
              backgroundColor: "#fff",
              marginBottom: 12
            }}
            outlineColor="#dce9ff"
            activeOutlineColor={'#131b2e'} />


          {/* Transaction list */}
          {loading ?
            <ActivityIndicator
              size="large"
              color={'#131b2e'}
              style={{ marginVertical: 30 }} /> :

            filteredCandidates.length === 0 ?
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 35
                }}>

                <MaterialCommunityIcons
                  name={search ? "magnify-close" : "receipt-text-remove-outline"}
                  size={46}
                  color="#CFCFCF" />


                <Text
                  style={{
                    color: "#7c839b", fontFamily: "Inter",
                    textAlign: "center",
                    marginTop: 10,
                    fontWeight: "600"
                  }}>

                  {search ?
                    "No transactions match your search." :
                    "No matching transactions found."}
                </Text>

                {search &&
                  <TouchableOpacity
                    onPress={() => setSearch("")}
                    style={{
                      marginTop: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 18,
                      backgroundColor: `${'#131b2e'}12`
                    }}>

                    <Text
                      style={{
                        color: '#131b2e',
                        fontWeight: "700",
                        fontSize: 13
                      }}>

                      Clear Search
                    </Text>
                  </TouchableOpacity>
                }
              </View> :

              <FlatList
                data={filteredCandidates}
                keyExtractor={(t) => String(t.id)}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item: tx }) =>
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
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: "#eff4ff"
                    }}>

                    {/* Icon */}
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: `${tx.category_color || '#131b2e'}20`,

                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 10
                      }}>

                      <MaterialCommunityIcons
                        name={tx.category_icon || "cash"}
                        size={19}
                        color={tx.category_color || '#131b2e'} />

                    </View>

                    {/* Details */}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontWeight: "700",
                          color: "#0b1c30",
                          fontSize: 14
                        }}
                        numberOfLines={1}>

                        {tx.notes || "(no notes)"}
                      </Text>

                      <Text
                        style={{
                          color: "#7c839b", fontFamily: "Inter",
                          fontSize: 12,
                          marginTop: 3
                        }}
                        numberOfLines={1}>

                        {tx.date ?
                          new Date(tx.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          }) :
                          "—"}

                        {tx.source_name ? ` · ${tx.source_name}` : ""}

                        {tx.category_name ? ` · ${tx.category_name}` : ""}
                      </Text>
                    </View>
                    {/* Amount */}
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text
                        style={{
                          fontWeight: "800",
                          color: "#E46A6A",
                          marginLeft: 8,
                          fontSize: 15
                        }}>

                        <CurrencyText amount={tx.amount} />
                      </Text>
                      {linkingId === tx.id && (
                        <ActivityIndicator size="small" color={'#131b2e'} style={{ marginLeft: 8 }} />
                      )}
                    </View>
                  </TouchableOpacity>
                } />

          }
          {/* Cancel */}
          <PaperButton
            mode="outlined"
            disabled={linkingId !== null}
            onPress={onClose}
            style={{ marginTop: 10 }}>

            Cancel
          </PaperButton>
        </View>
      </View>
    </Modal>);

}



function isCreditCardBill(bill) {
  return (
    typeof bill?.notes === "string" && (
      bill.notes.startsWith("Recurring payment template for") ||
      bill.notes.startsWith("Statement ")));

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
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPaymentSourcePicker, setShowPaymentSourcePicker] = useState(false);
  const [paymentSources, setPaymentSources] = useState([]);
  const [paymentSourceSearch, setPaymentSourceSearch] = useState("");
  const [selectedCreditCard, setSelectedCreditCard] = useState(null);
  const { visible: loaderVisible, show: showPageLoader, hide: hidePageLoader } = usePageLoader();
  const dispatch = useAppDispatch();
  const reduxBills = useBills();
  const reduxSummary = useBillsSummary();
  const categoriesMap = useCategoriesMap();

  // ── hook 15 ───────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      load();
    }, [rawId])
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
          year: "2-digit"
        }), // Jan 26, Feb 26, Jan 27...
        due: Number(occ.amount || 0),
        paid: Number(occ.paid_amount || 0)
      };
    });
  }, [series]);

  const [chartOffset, setChartOffset] = useState(0);

  const displayChartData = React.useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    const itemsToShow = 5;
    if (chartData.length <= itemsToShow) return chartData;
    const start = Math.max(0, chartData.length - itemsToShow - chartOffset);
    return chartData.slice(start, start + itemsToShow);
  }, [chartData, chartOffset]);

  const totalDueAmount = React.useMemo(() => {
    return series.reduce((sum, bill) => {
      if (bill.status === BILL_STATUS.SKIPPED) return sum;
      return sum + Number(bill.amount || 0);
    }, 0);
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

    return Math.min(100, totalPaidAmount / totalDueAmount * 100);
  }, [totalDueAmount, totalPaidAmount]);

  const reduxCategory = categoriesMap?.[bill?.category_id] || category;
  const summary = reduxSummary || {};

  // ── Early returns AFTER every hook ───────────────────────────────────────
  if (!bill && !editing) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={'#131b2e'} />
      </View>);

  }

  if (editing) {
    return (
      <BillForm
        bill={bill}
        onSaved={async () => {
          try {
            showPageLoader();

            setEditing(false);

            await load(selectedOcc?.id);
          } catch (e) {
            console.error("[BillDetail] Bill save refresh failed:", e);
          } finally {
            hidePageLoader();
          }
        }}
        onCancel={() => setEditing(false)} />);


  }

  // ── helpers / actions ─────────────────────────────────────────────────────

  async function load(preserveOccId = null) {
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
        getSources(true)]
      );

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

      // Select the right occurrence
      let occ = null;
      if (preserveOccId) {
        occ = s.find((o) => o.id === preserveOccId) || null;
      }
      if (!occ && occurrenceId) {
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
              o.status !== BILL_STATUS.SKIPPED);

          }) ||
          s[s.length - 1] ||
          null;
      }
      setSelectedOcc(occ);

      if (occ && s.length > 5) {
        const idx = s.findIndex((o) => o.id === occ.id);
        if (idx !== -1) {
          setChartOffset(
            Math.max(0, Math.min(s.length - 5, s.length - 3 - idx))
          );
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
          Number(c.payment_bill_id) === Number(targetBill.parent_bill_id)
      );

      // Normal bill
      if (!card) {
        await markBillPaid(targetBill.id, {
          source_id: targetBill.source_id
        });
        await load(targetBill.id);
        hidePageLoader();
        return;
      }

      // Credit card bill
      const sources = await getSources(true);
      setPaymentSources(
        sources.filter((s) => Number(s.id) !== Number(card.source_id))
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
      await load(selectedOcc.id);
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
      await load(selectedOcc.id);
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
      await load(selectedOcc.id);
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
        year: "2-digit"
      })
    );
  }



  // ── derived values ────────────────────────────────────────────────────────
  const activeBill = selectedOcc || bill;
  const display = getBillDisplayStatus(activeBill);
  const isPaidOrSkipped =
    activeBill.status === BILL_STATUS.PAID ||
    activeBill.status === BILL_STATUS.SKIPPED;

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

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.xs, paddingBottom: 140 }}>
        {/* 1. Hero Card */}
        <Card style={{ marginBottom: 16, borderRadius: 16, padding: 0, overflow: "hidden", backgroundColor: '#ffffff', borderColor: '#dce9ff', borderWidth: 1, elevation: 1, shadowColor: '#0b1c30', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}>
          <View style={{ padding: 18, flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 56, height: 72, borderRadius: 14, backgroundColor: '#e6f7f5', justifyContent: "center", alignItems: "center" }}>
              <MaterialCommunityIcons name={reduxCategory?.icon || "cellphone"} size={32} color="#006a61" />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#0b1c30", fontFamily: "Plus Jakarta Sans" }}>
                  {selectedLabel || "Current Bill"}
                </Text>
                <View style={{ marginLeft: 10 }}>
                  <StatusBadge display={display} />
                </View>
              </View>
              <Text style={{ marginTop: 4, fontSize: 13, color: "#7c839b", fontFamily: "Inter" }}>
                {reduxCategory?.name || "Category"} • {bill.is_recurring ? bill.recurrence_type : "One-time"}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", backgroundColor: "#f8faff", paddingVertical: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#eff4ff" }}>
            <View style={{ flex: 1, paddingLeft: 18 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: "#7c839b", fontFamily: "Inter", letterSpacing: 0.5 }}>DUE AMOUNT</Text>
              <Text style={{ fontSize: 26, fontWeight: "700", color: "#0b1c30", fontFamily: "Plus Jakarta Sans", marginTop: 4 }}>
                <CurrencyText amount={activeBill.amount} />
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <MaterialCommunityIcons name="calendar-check" size={20} color="#006a61" />
                <Text style={{ marginLeft: 4, fontSize: 12, color: "#45464d", fontFamily: "Inter" }}>
                  Due {formatDueDate(activeBill.due_date)}
                </Text>
              </View>
            </View>
            <View style={{ flex: 1, paddingRight: 18 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: "#7c839b", fontFamily: "Inter", letterSpacing: 0.5 }}>PAID AMOUNT</Text>
              <Text style={{ fontSize: 26, fontWeight: "700", color: "#006a61", fontFamily: "Plus Jakarta Sans", marginTop: 4 }}>
                <CurrencyText amount={activeBill.paid_amount || 0} />
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <MaterialCommunityIcons name="check-circle-outline" size={20} color="#006a61" />
                <Text style={{ marginLeft: 4, fontSize: 12, color: "#006a61", fontFamily: "Inter", fontWeight: "500" }}>
                  {isPaidOrSkipped ? "Fully Settled" : "Pending"}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 14 }}>
            {[
              { icon: "calendar-outline", label: "Bill Date", value: formatDueDate(activeBill.due_date) },
              { icon: "shape-outline", label: "Category", value: reduxCategory?.name || "-" },
              { icon: "bank-outline", label: "Source", value: source?.name || "-" },
              { icon: "repeat", label: "Repeat", value: bill.is_recurring ? bill.recurrence_type : "No" }
            ].map(({ icon, label, value }) => (
              <View key={label} style={styles.infoTile}>
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#f4f8fb", justifyContent: "center", alignItems: "center", marginRight: 10 }}>
                    <MaterialCommunityIcons name={icon} color={'#7c839b'} size={18} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 12, color: "#7c839b", fontFamily: "Inter" }}>{label}</Text>
                    <Text numberOfLines={1} style={{ marginTop: 2, fontWeight: "600", color: "#0b1c30", fontSize: 13, fontFamily: "Inter" }}>
                      {value}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* 3. Chart & History */}
        <Card
          style={{ marginBottom: 16, borderRadius: 16, padding: 0, overflow: 'hidden', backgroundColor: '#ffffff', borderColor: '#dce9ff', borderWidth: 1, elevation: 1, shadowColor: '#0b1c30', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 10 }}>
            <View>
              <Text
                style={{
                  fontWeight: "600",
                  fontSize: 18,
                  color: "#0b1c30",
                  fontFamily: "Plus Jakarta Sans"
                }}>
                Billing History
              </Text>
              <Text style={{ fontSize: 13, color: "#7c839b", marginTop: 2, fontFamily: "Inter" }}>
                {series.length} Bill Occurrences
              </Text>
            </View>

            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity
                onPress={() => setChartOffset((prev) => Math.min(Math.max(0, chartData.length - 5), prev + 1))}
                style={{
                  width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#eff4ff', backgroundColor: "#fff",
                  alignItems: "center", justifyContent: "center", marginRight: 8,
                  opacity: chartData.length <= 5 || chartOffset >= chartData.length - 5 ? 0.3 : 1
                }}
                disabled={chartData.length <= 5 || chartOffset >= chartData.length - 5}>
                <MaterialCommunityIcons name="chevron-left" size={20} color={'#0b1c30'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setChartOffset((prev) => Math.max(0, prev - 1))}
                style={{
                  width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#eff4ff', backgroundColor: "#fff",
                  alignItems: "center", justifyContent: "center",
                  opacity: chartOffset === 0 ? 0.3 : 1
                }}
                disabled={chartOffset === 0}>
                <MaterialCommunityIcons name="chevron-right" size={20} color={'#0b1c30'} />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={{
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 10
            }}>
            <PremiumRoundedBarChart
              labels={displayChartData.map((x) => x.label)}
              ids={displayChartData.map((x) => x.id)}
              dueValues={displayChartData.map((x) => x.due)}
              paidValues={displayChartData.map((x) => x.paid)}
              width={screenWidth - 32}
              height={150}
              baseColor={'#dce9ff'}
              selectedColor={'#6bd8cb'}
              selectedLabel={selectedLabel}
              isEmpty={displayChartData.length === 0}
              onBarPress={(data) => {
                const match = series.find((x) => x.id === data.id);
                if (match) {
                  handleSelectOccurrence(match);
                }
              }} />
          </View>


        </Card>

        {/* 2. Linked transactions */}
        <LinkedTransactionsCard
          linkedTxs={linkedTxs}
          onAddMore={() => setShowLinkModal(true)}
          onUnlink={handleUnlinkTransaction} />

        {/* 4. Bill Summary */}
        <Card style={{ marginBottom: 16, borderRadius: 16, backgroundColor: '#ffffff', borderColor: '#dce9ff', borderWidth: 1, elevation: 1, shadowColor: '#0b1c30', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "600",
                color: "#0b1c30",
                fontFamily: "Plus Jakarta Sans"
              }}>
              Bill Summary
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#7c839b", fontFamily: "Inter" }}>Lifetime Record</Text>
          </View>

          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 36,
                fontWeight: "700",
                color: "#006a61",
                fontFamily: "Plus Jakarta Sans"
              }}>
              <CurrencyText amount={totalPaidAmount} />
            </Text>
            <Text
              style={{
                color: "#7c839b",
                fontWeight: "500",
                fontSize: 13,
                marginTop: 4,
                fontFamily: "Inter"
              }}>
              Total Amount Paid
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between"
            }}>

            <View style={[styles.summaryTile, { backgroundColor: '#f4f8fb', paddingVertical: 14, borderRadius: 12, marginHorizontal: 4 }]}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#006a61', justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name="check" size={14} color="#fff" />
              </View>
              <Text style={styles.summaryValue}>{paidCount}</Text>
              <Text style={styles.summaryLabel}>Paid Bills</Text>
            </View>

            <View style={[styles.summaryTile, { backgroundColor: '#f4f8fb', paddingVertical: 14, borderRadius: 12, marginHorizontal: 4 }]}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#2f1500', justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name="clock-time-four" size={14} color="#ffdcc3" />
              </View>
              <Text style={styles.summaryValue}>
                <CurrencyText amount={pendingAmount} />
              </Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>

            <View style={[styles.summaryTile, { backgroundColor: '#f4f8fb', paddingVertical: 14, borderRadius: 12, marginHorizontal: 4 }]}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#eff4ff', justifyContent: 'center', alignItems: 'center', }}>
                <MaterialCommunityIcons name="text-box-outline" size={14} color={'#131b2e'} />
              </View>
              <Text style={styles.summaryValue}>{series.length}</Text>
              <Text style={styles.summaryLabel}>Total Bills</Text>
            </View>
          </View>

          <View style={{ marginTop: 24 }}>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: "#eaf1ff",
                overflow: "hidden"
              }}>
              <View
                style={{
                  width: `${paymentPercentage}%`,
                  height: "100%",
                  backgroundColor: "#006a61"
                }} />
            </View>
            <Text
              style={{
                marginTop: 10,
                textAlign: "center",
                color: "#45464d", fontFamily: "Inter",
                fontWeight: "600",
                fontSize: 12
              }}>
              <CurrencyText amount={totalPaidAmount} /> of <CurrencyText amount={totalDueAmount} /> Paid
            </Text>
          </View>
        </Card>

        {/* Dialogs */}
        <ConfirmDialog
          visible={confirmVisible}
          title={confirmAction === "delete_occ" ? "Delete Occurrence" : "Skip Bill"}
          message={confirmAction === "delete_occ" ? `Delete the occurrence for ${formatDueDate(activeBill.due_date)}? It won't be recreated.` : `Skip "${activeBill.name}" for ${formatDueDate(activeBill.due_date)}?`}
          confirmLabel={confirmAction === "skip" ? "Skip" : "Delete"}
          onCancel={() => { setConfirmVisible(false); setConfirmAction(null); }}
          onConfirm={async () => {
            try {
              showPageLoader();
              if (confirmAction === "delete_occ") {
                const isTemplate = activeBill.id === bill?.id && bill?.is_recurring;
                await softDeleteBillOccurrence(activeBill.id, isTemplate, activeBill.due_date);
                await load();
              } else if (confirmAction === "skip") {
                await skipBill(activeBill.id);
                await refreshSelectedOccurrence();
                await load(activeBill.id);
              }
            } catch (e) { console.error("[BillDetail] Action failed:", e); } finally { setConfirmVisible(false); setConfirmAction(null); hidePageLoader(); }
          }} />

        <LinkTransactionModal
          visible={showLinkModal}
          bill={activeBill}
          onLink={handleLinkTransaction}
          onClose={() => setShowLinkModal(false)} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        {isPayable &&
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#006a61" }]}
            onPress={handleMarkPaid}>

            <MaterialCommunityIcons
              name="check-circle"
              color="#fff"
              size={22} />

            <Text style={styles.actionTextWhite}>Paid</Text>
          </TouchableOpacity>
        }

        {activeBill.status === BILL_STATUS.SKIPPED ?
          <TouchableOpacity style={styles.actionButton} onPress={handleUnskip}>
            <MaterialCommunityIcons name="undo" color="#0b57d0" size={22} />
            <Text style={styles.actionText}>Unskip</Text>
          </TouchableOpacity> :
          !isPaidOrSkipped ?
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setConfirmAction("skip");
                setConfirmVisible(true);
              }}>

              <MaterialCommunityIcons
                name="skip-next-circle"
                color="#c76c00"
                size={22} />

              <Text style={styles.actionText}>Skip</Text>
            </TouchableOpacity> :
            null}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowLinkModal(true)}>

          <MaterialCommunityIcons name="link-variant" color="#003a70" size={22} />
          <Text style={[styles.actionText, { color: "#003a70" }]}>Link</Text>
        </TouchableOpacity>

        {!isCreditCardBill(activeBill) &&
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate("BillOccurrenceEdit", { occurrence: selectedOcc, bill })}>

            <MaterialCommunityIcons name="square-edit-outline" color="#b75500" size={22} />
            <Text style={[styles.actionText, { color: "#b75500" }]}>Edit</Text>
          </TouchableOpacity>
        }

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setConfirmAction("delete_occ");
            setConfirmVisible(true);
          }}
        >
          <MaterialCommunityIcons name="delete-outline" color="#ba1a1a" size={22} />
          <Text style={[styles.actionText, { color: "#ba1a1a" }]}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Modal
        visible={showPaymentSourcePicker}
        transparent
        animationType="slide">

        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end"
          }}>

          <View
            style={{
              backgroundColor: "#fff",
              maxHeight: "55%",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16
            }}>

            <Text
              style={{
                fontWeight: "700",
                fontSize: 16,
                marginBottom: 12
              }}>

              Select Payment Source
            </Text>

            <PaperTextInput
              placeholder="Search source..."
              value={paymentSourceSearch}
              onChangeText={setPaymentSourceSearch}
              mode="outlined"
              style={{ marginBottom: 10 }} />


            <ScrollView>
              {paymentSources.
                filter((s) =>
                  s.name.
                    toLowerCase().
                    includes(paymentSourceSearch.toLowerCase())
                ).
                map((source) =>
                  <TouchableOpacity
                    key={source.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 12
                    }}
                    onPress={async () => {
                      try {
                        showPageLoader();
                        const paymentId = await payCreditCardBill({
                          bill: activeBill,
                          card: selectedCreditCard,
                          paymentSourceId: source.id
                        });
                        await markBillPaid(activeBill.id, null, paymentId);
                        try {
                          await onStatementPaid(selectedCreditCard.id);
                        } catch (e) {
                          console.warn(
                            "[BillDetailScreen] onStatementPaid failed:",
                            e
                          );
                        }
                        setShowPaymentSourcePicker(false);
                        setSelectedCreditCard(null);
                        setPaymentSourceSearch("");
                        await load();
                      } catch (e) {
                        console.error(
                          "[BillDetail] Credit card payment failed:",
                          e
                        );
                        Alert.alert("Error", "Unable to complete payment.");
                      } finally {
                        hidePageLoader();
                      }
                    }}>

                    <MaterialCommunityIcons
                      name={source.icon || "wallet"}
                      size={22}
                      color={'#131b2e'} />

                    <Text
                      style={{
                        marginLeft: 10,
                        flex: 1
                      }}>

                      {source.name}
                    </Text>
                  </TouchableOpacity>
                )}
            </ScrollView>

            <PaperButton
              onPress={() => {
                setShowPaymentSourcePicker(false);
                setSelectedCreditCard(null);
                setPaymentSourceSearch("");
                hidePageLoader();
              }}>

              Cancel
            </PaperButton>
          </View>
        </View>
      </Modal>
      <PageLoader visible={loaderVisible} />
    </View>);

}

const styles = StyleSheet.create({
  infoTile: { width: "50%", paddingVertical: 12, flexDirection: "column" },
  infoTitle: { marginTop: 4, fontSize: 12, color: "#7c839b", fontFamily: "Inter" },
  infoValue: {
    marginTop: 2,
    fontWeight: "600",
    color: "#0b1c30",
    fontSize: 14,
    fontFamily: "Inter"
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#eff4ff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9999,
  },
  actionText: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "600",
    color: "#0b1c30",
    fontFamily: "Inter"
  },
  actionTextWhite: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
    fontFamily: "Inter"
  },
  summaryTile: {
    flex: 1,
    alignItems: "center"
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#0b1c30",
    fontFamily: "Plus Jakarta Sans"
  },
  summaryLabel: {
    marginTop: 3,
    color: "#7c839b",
    fontSize: 12,
    fontFamily: "Inter"
  }
});