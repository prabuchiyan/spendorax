import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  TouchableWithoutFeedback,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Button as PaperButton,
} from "react-native-paper";
import {
  getBillsForCurrentMonth,
  getBillsSummary,
  getBillById,
  getBillSeriesMultiple,
  markBillPaid,
  skipBill,
  deleteBill,
} from "../services/bills";
import { getCategories } from "../services/categories";
import { getPreferredBillOccurrence } from "../services/billUtils";
import BillSummaryBar from "../components/BillSummaryBar";
import BillCard from "../components/BillCard";
import BillCalendarView from "../components/BillCalendarView";
import BillForm from "../components/BillForm";
import ConfirmDialog from "../components/ConfirmDialog";
import { Colors, Spacing } from "../components/Theme";
import { BILL_STATUS } from "../services/billUtils";
import CurrencyText from "../components/CurrencyText";
import { getSources } from "../services/sources";
import { getCreditCards, payCreditCardBill } from "../services/creditCards";
// Redux imports
import { setBillsSummary } from "../redux/slices/billSlice";
import { setCategoriesMap } from "../redux/slices/categorySlice";
import {
  useBills,
  useBillsSummary,
  useCategoriesMap,
  useAppDispatch,
} from "../redux/hooks";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: BILL_STATUS.PENDING, label: "Pending" },
  { key: BILL_STATUS.OVERDUE, label: "Overdue" },
  { key: BILL_STATUS.PAID, label: "Paid" },
];

// Add this helper near the top of the component
function isCreditCardBill(bill) {
  return (
    (typeof bill.notes === "string" &&
      bill.notes.startsWith("Recurring payment template for")) ||
    (typeof bill.notes === "string" && bill.notes.startsWith("Statement "))
  );
}

export default function BillsScreen({ navigation }) {
  const dispatch = useAppDispatch();

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = {
    bg: isDarkMode ? "#0B0F17" : "#F8F9FF",
    headerBg: isDarkMode ? "#0B0F17" : "#F8F9FF",
    cardBg: isDarkMode ? "#182234" : "#FFFFFF",
    cardBorder: isDarkMode ? "#334155" : "#c6c6cd",
    textPrimary: isDarkMode ? "#F3F4F6" : "#0B1C30",
    textSecondary: isDarkMode ? "#9CA3AF" : "#45464D",
    activeBg: isDarkMode ? "#1E293B" : "#eff4ff",
    activeBorder: isDarkMode ? "#334155" : "#c6c6cd",
    activeText: isDarkMode ? "#FFFFFF" : "#000000",
    inactiveText: isDarkMode ? "#9CA3AF" : "#76777D",
    searchBg: isDarkMode ? "#182234" : "#FFFFFF",
    searchBorder: isDarkMode ? "#334155" : "#c6c6cd",
    alertBg: isDarkMode ? "rgba(159, 18, 57, 0.4)" : "#ffdad6", // rose-950/40 vs error-container
    alertBorder: isDarkMode ? "rgba(244, 63, 94, 0.3)" : "rgba(186, 26, 26, 0.2)",
    alertIconBg: isDarkMode ? "rgba(244, 63, 94, 0.1)" : "#ffb4ab",
    alertTextPrimary: isDarkMode ? "#FDA4AF" : "#93000a", // rose-300 vs on-error-container
    alertTextSecondary: isDarkMode ? "#FBCFE8" : "#ba1a1a",
    modalBg: isDarkMode ? "#182234" : "#FFFFFF",
    modalText: isDarkMode ? "#F3F4F6" : "#0B1C30",
    statementBg: isDarkMode ? "#111827" : "#f8f9ff",
    iconBg: isDarkMode ? "#1E293B" : "#eff4ff",
    iconColor: isDarkMode ? "#FFFFFF" : "#000000",
    successBg: isDarkMode ? "#134E4A" : "#e5eeff", // teal-900 vs surface-container
    successText: isDarkMode ? "#5EEAD4" : "#006a61", // teal-300 vs secondary
  };

  // Redux state
  const reduxBills = useBills();
  const reduxSummary = useBillsSummary();
  const categoriesMap = useCategoriesMap();
  const summary = reduxSummary || {};

  // Local state
  const [items, setItems] = useState([]);
  const [preferredOccurrences, setPreferredOccurrences] = useState({});
  const [categories, setCategories] = useState([]);
  const [viewMode, setViewMode] = useState("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [sortBy, setSortBy] = useState("due_date");
  const [search, setSearch] = useState("");
  const [showStatusDD, setShowStatusDD] = useState(false);
  const [showCategoryDD, setShowCategoryDD] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState("delete");
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [showPaymentSourcePicker, setShowPaymentSourcePicker] = useState(false);
  const [paymentSources, setPaymentSources] = useState([]);
  const [paymentSourceSearch, setPaymentSourceSearch] = useState("");
  const [selectedPaymentBill, setSelectedPaymentBill] = useState(null);
  const [selectedCreditCard, setSelectedCreditCard] = useState(null);

  // ── data load ──────────────────────────────────────────────────────────────
  async function load() {
    const [rows, sum, cats] = await Promise.all([
      getBillsForCurrentMonth({
        status: statusFilter === "all" ? null : statusFilter,
        category_id: categoryFilter,
        sortBy,
        sortDir: sortBy === "amount" ? "desc" : "asc",
      }),
      getBillsSummary(),
      getCategories(true),
    ]);
    setItems(rows);
    const preferredMap = {};
    const templateIdsToFetch = Array.from(
      new Set(
        rows
          .filter(
            (bill) =>
              (bill.is_recurring || bill._isRecurringSeries) &&
              !bill._isCreditCardStatement,
          )
          .map((bill) => bill._templateId || bill.parent_bill_id || bill.id),
      ),
    );

    if (templateIdsToFetch.length > 0) {
      try {
        const seriesMap = await getBillSeriesMultiple(templateIdsToFetch);
        rows.forEach((bill) => {
          if (!bill.is_recurring && !bill._isRecurringSeries) return;
          if (bill._isCreditCardStatement) return;

          const templateId = bill._templateId || bill.parent_bill_id || bill.id;
          if (seriesMap[templateId]) {
            preferredMap[String(templateId)] = getPreferredBillOccurrence(
              bill,
              seriesMap[templateId],
            );
          }
        });
      } catch (e) {
        console.warn("Preferred bill occurrence batch error:", e);
      }
    }
    setPreferredOccurrences(preferredMap);
    dispatch(setBillsSummary(sum));
    const expCats = cats.filter((c) => c.type === "expense");
    setCategories(expCats);
    const map = {};
    cats.forEach((c) => (map[c.id] = c));
    dispatch(setCategoriesMap(map));
    const sources = await getSources(true);
    setPaymentSources(sources);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [dispatch, statusFilter, categoryFilter, sortBy]),
  );

  // ── derived lists ──────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const displayItems = items.map((bill) => {
      const templateId = bill._templateId || bill.parent_bill_id || bill.id;
      const preferred = preferredOccurrences[String(templateId)];
      if (
        preferred &&
        !bill._isCreditCardParent &&
        !bill._isCreditCardStatement
      ) {
        return {
          ...bill,
          // Display the preferred recurring occurrence.
          due_date: preferred.due_date,
          status: preferred.status,
          amount: preferred.amount,
          // Preserve the no-due-date state.
          _noDueDate: preferred._noDueDate === true,
          // Preserve the recurring template identity.
          _templateId: bill._templateId || templateId,
          _displayOccurrenceId: preferred.id,
          _displayOccurrence: preferred,
        };
      }
      return bill;
    });
    // SEARCH FILTER
    const sourceItems = query
      ? displayItems.filter((bill) => bill.name?.toLowerCase().includes(query))
      : displayItems;
    // GROUP CREDIT-CARD STATEMENTS
    // Credit-card statements are different from normal recurring bills.
    // We group all statements belonging to the same credit card,
    // but the parent Bill Card uses ONLY the current month's statements for:
    //   - amount
    //   - due date
    //   - status
    // All actual statements remain inside `children`.
    const groups = new Map();
    const normalBills = [];
    sourceItems.forEach((bill) => {
      const parentId = Number(bill.parent_bill_id || 0);
      const isStatement =
        bill._isCreditCardStatement === true ||
        (typeof bill.notes === "string" && bill.notes.startsWith("Statement "));

      if (isStatement && parentId > 0) {
        if (!groups.has(parentId)) {
          groups.set(parentId, []);
        }
        groups.get(parentId).push(bill);
      } else {
        normalBills.push(bill);
      }
    });
    // CURRENT MONTH
    // Current month is determined using DUE DATE.
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthPrefix = `${currentYear}-${String(
      currentMonth + 1,
    ).padStart(2, "0")}`;
    // BUILD ONE BILL-CARD PARENT FOR EACH CREDIT CARD
    const groupedCreditCards = [];
    groups.forEach((statements, parentId) => {
      if (!statements.length) {
        return;
      }
      // SORT ALL STATEMENTS BY DUE DATE
      // Due date is preferred because this screen represents bills that need to be paid.
      statements.sort((a, b) => {
        const ad = a.due_date || a.statement_date || "9999-12-31";
        const bd = b.due_date || b.statement_date || "9999-12-31";

        return ad.localeCompare(bd);
      });

      // CURRENT MONTH STATEMENTS
      // ONLY these statements are used to calculate the amount displayed on the Bill Card.
      const currentMonthStatements = statements.filter((statement) => {
        const dueDate = statement.due_date || "";
        return dueDate.startsWith(currentMonthPrefix);
      });
      // DETERMINE WHAT THE CARD SHOULD DISPLAY
      // Normal case:
      //     Current month statement exists
      // Fallback:
      //     No current-month statement exists.
      //     Use the latest statement on/before today.
      // This fallback prevents the credit card from disappearing
      // completely when there is no current-month statement.
      let displayStatements = [];
      if (currentMonthStatements.length > 0) {
        displayStatements = currentMonthStatements;
      } else {
        const todayString = now.toISOString().slice(0, 10);
        const previousStatements = statements
          .filter((statement) => {
            const dueDate = statement.due_date || "";
            return dueDate && dueDate <= todayString;
          })
          .sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""));
        if (previousStatements.length > 0) {
          displayStatements = [previousStatements[0]];
        } else {
          // No current or previous statement.
          // Use the nearest upcoming statement if available.
          const upcomingStatements = statements
            .filter((statement) => {
              const dueDate = statement.due_date || "";
              return dueDate > todayString;
            })
            .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
          if (upcomingStatements.length > 0) {
            displayStatements = [upcomingStatements[0]];
          }
        }
      }
      // IF THERE IS NOTHING TO DISPLAY
      if (!displayStatements.length) {
        return;
      }
      // PARENT AMOUNT
      // Sum ONLY the statements represented by the Bill Card.
      const totalAmount = displayStatements.reduce(
        (sum, statement) => sum + Number(statement.amount || 0),
        0,
      );
      const latestDisplayStatement =
        displayStatements[displayStatements.length - 1];
      // BUILD CREDIT-CARD PARENT
      groupedCreditCards.push({
        ...latestDisplayStatement,
        id: `cc-${parentId}`,
        parent_bill_id: parentId,
        name: latestDisplayStatement.name || "Credit Card",
        // Amount is ONLY for the current/displayed statement.
        amount: totalAmount,
        // ALL ACTUAL STATEMENTS
        // Keep every generated statement here so the  Statements expansion continues to work.
        children: statements,
        // STATEMENTS REPRESENTED BY THE CARD
        _displayStatements: displayStatements,
        // CREDIT-CARD FLAGS
        _isCreditCardParent: true,
        _isCreditCardStatement: false,
        _isRecurringSeries: false,
        _templateId: parentId,
        // COUNTS
        _statementCount: statements.length,
        _currentMonthStatementCount: currentMonthStatements.length,
        _isCurrentMonthCreditCard: currentMonthStatements.length > 0,
        // NO DUE DATE STATE
        _noDueDate: !latestDisplayStatement.due_date,
      });
    });
    // RETURN NORMAL BILLS + CREDIT-CARD PARENTS
    return [...normalBills, ...groupedCreditCards];
  }, [items, search, preferredOccurrences]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    return categories.filter((c) =>
      c.name.toLowerCase().includes(categorySearch.toLowerCase()),
    );
  }, [categories, categorySearch]);

  // ── navigation ─────────────────────────────────────────────────────────────
  // ISSUE 1: navigate to template id so detail page shows the full series.
  function openDetail(bill) {
    navigation.navigate("BillDetail", {
      billId: bill._templateId || bill.id,
      occurrenceId: bill._isRecurringSeries ? bill.id : undefined,
    });
  }

  async function openEdit(bill) {
    // Always load the real template row — never spread occurrence fields onto it.
    const templateId = bill._templateId || bill.id;
    const templateBill = await getBillById(templateId);
    setEditingBill(templateBill || bill);
    setShowForm(true);
  }

  const handleMarkPaid = async (bill) => {
    try {
      const actualBill = bill._displayOccurrence?.id ? bill._displayOccurrence : bill;

      // FIND CREDIT CARD
      const cards = await getCreditCards(false);
      const parentBillId = Number(
        actualBill.parent_bill_id || actualBill._templateId || actualBill.id,
      );
      const card = cards.find(
        (c) => Number(c.payment_bill_id) === parentBillId,
      );
      // NORMAL BILL
      if (!card) {
        await markBillPaid(actualBill.id, {
          source_id: actualBill.source_id,
        });
        await load();
        return;
      }
      // CREDIT CARD BILL
      // Do NOT change the statement amount here.
      // We only open the payment-source picker.
      // The actual statement bill remains unchanged until the payment is explicitly recorded.
      const sources = await getSources(true);
      const availableSources = sources.filter(
        (s) => Number(s.id) !== Number(card.source_id),
      );
      setPaymentSources(availableSources);
      // Keep the actual bill that initiated  the payment action.
      setSelectedPaymentBill(actualBill);
      setSelectedCreditCard(card);
      setPaymentSourceSearch("");
      setShowPaymentSourcePicker(true);
    } catch (e) {
      console.error("handleMarkPaid error:", e);
      Alert.alert("Error", "Unable to mark bill as paid.");
    }
  };

  function handleSkip(bill) {
    const actualBill = bill._displayOccurrence?.id ? bill._displayOccurrence : bill;
    setConfirmTarget(actualBill);
    setConfirmAction("skip");
    setConfirmMessage(`Skip "${actualBill.name}" for this period?`);
    setConfirmVisible(true);
  }

  function handleDeleteBill(bill) {
    console.log("[BillsScreen] DELETE CLICKED - DISPLAY BILL:", bill);

    if (!bill?.id) {
      Alert.alert("Delete Bill", "Unable to identify this bill.");
      return;
    }

    // ---------------------------------------------------------
    // IMPORTANT:
    // For recurring bills, the card may display an occurrence
    // while `bill.id` is still the recurring template ID.
    //
    // Always delete the ACTUAL displayed occurrence.
    // ---------------------------------------------------------

    const actualBill = bill._displayOccurrence?.id
      ? bill._displayOccurrence
      : bill;

    console.log("[BillsScreen] DELETE ACTUAL TARGET:", {
      displayId: bill.id,
      occurrenceId: bill._displayOccurrenceId,
      actualId: actualBill.id,
      actualParentId: actualBill.parent_bill_id,
      actualDueDate: actualBill.due_date,
      actualName: actualBill.name,
    });

    if (!actualBill?.id) {
      Alert.alert(
        "Delete Bill",
        "Unable to identify the actual bill occurrence.",
      );
      return;
    }

    setConfirmTarget(actualBill);
    setConfirmAction("delete");

    const isRecurringOccurrence = !!actualBill.parent_bill_id;

    setConfirmMessage(
      isRecurringOccurrence
        ? `Delete "${actualBill.name}" for this period permanently?\n\n` +
        `• This bill occurrence will be permanently removed.\n` +
        `• Other recurring occurrences will remain.\n` +
        `• Linked transactions will NOT be deleted.\n` +
        `• Linked transactions will simply be unlinked.\n\n` +
        `This action cannot be undone.`
        : `Delete "${actualBill.name}" permanently?\n\n` +
        `• The bill will be permanently removed.\n` +
        `• Linked transactions will NOT be deleted.\n` +
        `• Linked transactions will simply be unlinked.\n\n` +
        `This action cannot be undone.`,
    );

    setConfirmVisible(true);
  }

  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const renderBill = ({ item }) => {
    // CREDIT CARD PARENT
    if (item._isCreditCardParent) {
      const parentKey = String(
        item.parent_bill_id || item._templateId || item.id,
      );
      const handleViewStatements = async () => {
        try {
          const cards = await getCreditCards(false);
          const card = cards.find(
            (c) => Number(c.payment_bill_id) === Number(parentKey)
          );
          if (card && card.source_id) {
            navigation.navigate("CreditCardStatements", { sourceId: card.source_id });
          } else {
            navigation.navigate("CreditCardStatements");
          }
        } catch (error) {
          console.error("Failed to route to statements:", error);
          navigation.navigate("CreditCardStatements");
        }
      };
      return (
        <View
          style={{
            marginBottom: 8,
          }}
        >
          {/* PARENT CREDIT CARD BILL */}
          <BillCard
            isDarkMode={isDarkMode}
            bill={item}
            category={categoriesMap[item.category_id]}
            onPress={() => {
              if (item.children && item.children.length > 0) {
                openDetail(item.children[0]);
              } else {
                openDetail(item);
              }
            }}
            onMarkPaid={() => {
              handleMarkPaid(item);
            }}
            onSkip={null}
            onEdit={null}
            // IMPORTANT:
            // Allow deleting the credit-card parent bill.
            onDelete={handleDeleteBill}
            showExpandButton={true}
            expanded={false}
            onToggleExpand={handleViewStatements}
          />

          {/* STATEMENT CHILDREN */}
          {false && item.children && item.children.length > 0 && (
            <View
              style={{
                marginLeft: 22,
                marginTop: -2,
                marginBottom: 4,
                borderLeftWidth: 2,
                borderLeftColor: isDarkMode ? "#333" : "#DCEBE2",
                paddingLeft: 12,
                paddingTop: 4,
              }}
            >
              {item.children.map((statement, index) => (
                <View
                  key={String(statement.id)}
                  style={{
                    backgroundColor: theme.statementBg,
                    borderRadius: 12,
                    padding: 10,
                    marginBottom: index === item.children.length - 1 ? 0 : 7,
                    borderWidth: 1,
                    borderColor: theme.cardBorder,
                  }}
                >
                  {/* STATEMENT HEADER */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 10,
                        backgroundColor: theme.iconBg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialCommunityIcons
                        name="credit-card-outline"
                        size={17}
                        color={theme.iconColor}
                      />
                    </View>
                    <View
                      style={{
                        flex: 1,
                        marginLeft: 9,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "800",
                          color: theme.textPrimary,
                        }}
                      >
                        Statement
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: theme.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {statement.statement_date || statement.due_date || "-"}
                      </Text>
                    </View>

                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: theme.textPrimary,
                      }}
                    >
                      <CurrencyText amount={Number(statement.amount || 0)} />
                    </Text>
                  </View>

                  {/* STATEMENT FOOTER  */}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 8,
                      paddingTop: 7,
                      borderTopWidth: 1,
                      borderTopColor: theme.cardBorder,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <MaterialCommunityIcons
                        name="calendar-clock-outline"
                        size={14}
                        color={theme.textSecondary}
                      />

                      <Text
                        style={{
                          fontSize: 9,
                          color: theme.textSecondary,
                          marginLeft: 4,
                        }}
                      >
                        Due {statement.due_date || "-"}
                      </Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => openDetail(statement)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 7,
                        backgroundColor: theme.iconBg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: "800",
                          color: theme.iconColor,
                        }}
                      >
                        View
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      );
    }

    // NORMAL BILL
    return (
      <BillCard
        isDarkMode={isDarkMode}
        bill={item}
        category={categoriesMap[item.category_id]}
        onPress={openDetail}
        onMarkPaid={handleMarkPaid}
        onSkip={handleSkip}
        onEdit={isCreditCardBill(item) ? null : openEdit}
        onDelete={(bill) => {
          console.log("[BillsScreen] DELETE PROP REACHED:", {
            id: bill?.id,
            occurrenceId: bill?._displayOccurrenceId,
            occurrence: bill?._displayOccurrence,
            parentId: bill?.parent_bill_id,
          });

          handleDeleteBill(bill);
        }}
      />
    );
  };
  const listHeader = (
    <View style={{ paddingTop: 10 }}>
      {/* HEADER WITH TOGGLE */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: isDarkMode ? "#182234" : "#eff4ff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? "#334155" : "rgba(198, 198, 205, 0.4)" }}>
          <MaterialCommunityIcons name="calendar-month" size={20} color={isDarkMode ? "#22d3ee" : "#000000"} />
          <Text style={{ marginLeft: 6, fontSize: 18, fontWeight: "600", color: theme.textPrimary }}>{monthLabel}</Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={theme.textSecondary} style={{ marginLeft: 4 }} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => setIsDarkMode(!isDarkMode)}
            style={{
              width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
              backgroundColor: isDarkMode ? "#182234" : "#eff4ff",
              borderWidth: 1, borderColor: isDarkMode ? "#334155" : "rgba(198, 198, 205, 0.4)", marginRight: 8
            }}
          >
            <MaterialCommunityIcons name={isDarkMode ? "white-balance-sunny" : "moon-waning-crescent"} size={18} color={isDarkMode ? "#fbbf24" : "#0b1c30"} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={{
              flexDirection: "row", alignItems: "center",
              backgroundColor: isDarkMode ? "#ffffff" : "#000000",
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
            }}
          >
            <MaterialCommunityIcons name="plus" size={18} color={isDarkMode ? "#0b1c30" : "#ffffff"} />
            <Text style={{ marginLeft: 4, fontSize: 13, fontWeight: "600", color: isDarkMode ? "#0b1c30" : "#ffffff" }}>Add Bill</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SUMMARY */}
      <View style={{ marginBottom: 16 }}>
        <BillSummaryBar summary={summary} isDarkMode={isDarkMode} />
      </View>

      {/* SEARCH + FILTER */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.cardBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            height: 44,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
          }}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={theme.textSecondary} />

          <TextInput
            placeholder="Search bill name (e.g. Netflix, Rent)..."
            placeholderTextColor={theme.inactiveText}
            value={search}
            onChangeText={setSearch}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 14,
              color: theme.textPrimary,
            }}
          />

          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* STATUS FILTERS AND CATEGORY TOGGLE */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowCategoryDD(true)}
          style={{
            height: 32,
            paddingHorizontal: 10,
            borderRadius: 16,
            backgroundColor: theme.cardBg,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={16}
            color={theme.textPrimary}
          />
          <Text style={{ marginLeft: 4, fontSize: 13, fontWeight: "500", color: theme.textPrimary }}>
            {categoryFilter ? (categoriesMap[categoryFilter]?.name || "Category") : "All Categories"}
          </Text>
          <MaterialCommunityIcons
            name="menu-down"
            size={16}
            color={theme.textPrimary}
          />
        </TouchableOpacity>

        <View style={{ width: 1, height: 16, backgroundColor: theme.cardBorder, marginRight: 10 }} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingRight: 8,
          }}
        >
          {STATUS_FILTERS.map((filter) => {
            const active = statusFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                activeOpacity={0.8}
                onPress={() => setStatusFilter(filter.key)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  marginRight: 6,
                  backgroundColor: active ? (isDarkMode ? "#ffffff" : "#000000") : theme.cardBg,
                  borderWidth: 1,
                  borderColor: active ? (isDarkMode ? "#ffffff" : "#000000") : theme.cardBorder,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: active ? "600" : "500",
                    color: active ? (isDarkMode ? "#0b1c30" : "#ffffff") : theme.textSecondary,
                  }}
                >
                  {filter.label === "All" ? `All Bills (${items.length})` : filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* SORT + VIEW MODE TOGGLE */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "700", color: theme.textPrimary }}>
          Payment Schedule
        </Text>

        <View
          style={{
            flexDirection: "row",
            backgroundColor: isDarkMode ? "#182234" : "rgba(211, 228, 254, 0.6)",
            borderRadius: 20,
            padding: 2,
            borderWidth: 1,
            borderColor: theme.cardBorder,
          }}
        >
          {[
            ["list", "format-list-bulleted", "List"],
            ["calendar", "calendar-month", "Calendar"],
          ].map(([mode, icon, label]) => {
            const active = viewMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => setViewMode(mode)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: active ? (isDarkMode ? "#334155" : "#ffffff") : "transparent",
                  shadowColor: active && !isDarkMode ? "#000" : "transparent",
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: active && !isDarkMode ? 2 : 0,
                }}
              >
                <MaterialCommunityIcons
                  name={icon}
                  size={16}
                  color={active ? theme.textPrimary : theme.textSecondary}
                />
                <Text
                  style={{
                    marginLeft: 4,
                    fontSize: 13,
                    fontWeight: active ? "600" : "400",
                    color: active ? theme.textPrimary : theme.textSecondary,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {summary?.overdueCount > 0 && (
        <TouchableOpacity
          activeOpacity={0.85}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.alertBg,
            borderRadius: 13,
            borderWidth: 1,
            borderColor: theme.alertBorder,
            paddingHorizontal: 11,
            paddingVertical: 9,
            marginBottom: 10,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 10,
              backgroundColor: theme.alertIconBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons
              name="alert-outline"
              size={17}
              color="#E46A6A"
            />
          </View>
          <View
            style={{
              flex: 1,
              marginLeft: 9,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: theme.alertTextPrimary,
              }}
            >
              Payment attention needed
            </Text>

            <Text
              style={{
                fontSize: 10,
                fontWeight: "600",
                color: theme.alertTextSecondary,
                marginTop: 2,
              }}
            >
              {summary.overdueCount} overdue ·{" "}
              <CurrencyText amount={summary.overdueAmount} />
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={theme.alertTextPrimary}
          />
        </TouchableOpacity>
      )}

      {viewMode === "calendar" && (
        <BillCalendarView
          bills={filteredItems}
          month={calMonth}
          year={calYear}
          isDarkMode={isDarkMode}
          onSelectBill={openDetail}
          onMonthChange={(y, m) => {
            setCalYear(y);
            setCalMonth(m);
          }}
        />
      )}
    </View>
  );

  const groupedSections = useMemo(() => {
    if (viewMode !== "list") return [];

    const groups = { urgent: [], upcoming: [], later: [], settled: [], inactive: [] };
    const now = new Date();
    // Use local YYYY-MM-DD string for comparison to avoid timezone issues
    const nowStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split("T")[0];

    filteredItems.forEach(bill => {
      const status = bill.status || 'pending';
      const isInactive = bill.recurrence_end_date && bill.recurrence_end_date < nowStr;

      if (isInactive) {
        groups.inactive.push(bill);
      } else if (status === 'overdue') {
        groups.urgent.push(bill);
      } else if (status === 'paid' || status === 'skipped') {
        groups.settled.push(bill);
      } else {
        const dueDate = new Date(bill.due_date || now);
        const diffTime = dueDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) {
          groups.later.push(bill);
        } else {
          groups.upcoming.push(bill);
        }
      }
    });

    const result = [];
    if (groups.urgent.length > 0) result.push({ title: "Urgent & Overdue", data: groups.urgent });
    if (groups.upcoming.length > 0) result.push({ title: "Upcoming", data: groups.upcoming });
    if (groups.later.length > 0) result.push({ title: "Later This Month", data: groups.later });
    if (groups.settled.length > 0) result.push({ title: "Settled & Paid", data: groups.settled });
    if (groups.inactive.length > 0) result.push({ title: "Inactive", data: groups.inactive });

    return result;
  }, [filteredItems, viewMode]);

  const scrollRef = useRef(null);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: Spacing.xs, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {listHeader}

        {viewMode === "list" && groupedSections.length === 0 && (
            <View style={{ alignItems: "center", paddingTop: 32 }}>
              <MaterialCommunityIcons
                name="clipboard-check-outline"
                size={48}
                color="#ccc"
              />
              <Text style={{ color: Colors.muted, marginTop: 10 }}>
                No bills this month
              </Text>
            </View>
          )}

          {viewMode === "list" && groupedSections.map((section, idx) => (
            <View key={section.title || idx}>
              <View style={{ paddingTop: 8, paddingBottom: 8, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: theme.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {section.title}
                </Text>
              </View>
              {section.data.map((item, i) => (
                <View key={item._displayOccurrenceId ? String(item._displayOccurrenceId) : (String(item.id) + "-" + i)}>
                  {renderBill({ item })}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>

      {/* Status modal */}
      <Modal visible={showStatusDD} transparent>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowStatusDD(false)}
        >
          <TouchableWithoutFeedback>
            <View style={[styles.modal, { backgroundColor: theme.modalBg }]}>
              {STATUS_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => {
                    setStatusFilter(f.key);
                    setShowStatusDD(false);
                  }}
                >
                  <Text
                    style={[
                      styles.item,
                      { color: theme.modalText },
                      statusFilter === f.key && styles.selected,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Category modal */}
      <Modal visible={showCategoryDD} transparent>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowCategoryDD(false)}
        >
          <TouchableWithoutFeedback>
            <View style={[styles.modalLarge, { backgroundColor: theme.modalBg }]}>
              <View style={[styles.categorySearchContainer, { backgroundColor: theme.searchBg, borderColor: theme.searchBorder }]}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={22}
                  color={theme.textSecondary}
                />
                <TextInput
                  placeholder="Search category..."
                  placeholderTextColor={theme.inactiveText}
                  value={categorySearch}
                  onChangeText={setCategorySearch}
                  style={[styles.categorySearchInput, { color: theme.textPrimary }]}
                  autoCorrect={false}
                />
                {!!categorySearch && (
                  <TouchableOpacity onPress={() => setCategorySearch("")}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={20}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={[
                  { id: "all", name: "All categories" },
                  ...filteredCategories,
                ]}
                keyExtractor={(i) => String(i.id)}
                renderItem={({ item }) => {
                  const sel =
                    item.id === "all"
                      ? !categoryFilter
                      : categoryFilter === item.id;
                  return (
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => {
                        setCategoryFilter(item.id === "all" ? null : item.id);
                        setShowCategoryDD(false);
                        setCategorySearch("");
                      }}
                    >
                      <Text style={[styles.item, { color: theme.modalText }, sel && styles.selected]}>
                        {item.name}
                      </Text>
                      {sel && (
                        <MaterialCommunityIcons
                          name="check"
                          size={18}
                          color={Colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* ContextualFAB removed as it was replaced by Add Bill button in header */}

      {/* Add / edit form */}
      <Modal visible={showForm}>
        <BillForm
          bill={editingBill}
          onSaved={() => {
            setShowForm(false);
            setEditingBill(null);
            load();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingBill(null);
          }}
        />
      </Modal>

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
              backgroundColor: theme.modalBg,
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
                color: theme.modalText,
              }}
            >
              Select Payment Source
            </Text>

            <View style={[styles.categorySearchContainer, { backgroundColor: theme.searchBg, borderColor: theme.searchBorder }]}>
              <MaterialCommunityIcons
                name="magnify"
                size={22}
                color={theme.textSecondary}
              />
              <TextInput
                placeholder="Search source..."
                placeholderTextColor={theme.inactiveText}
                value={paymentSourceSearch}
                onChangeText={setPaymentSourceSearch}
                style={[styles.categorySearchInput, { color: theme.textPrimary }]}
                autoCorrect={false}
              />
              {!!paymentSourceSearch && (
                <TouchableOpacity onPress={() => setPaymentSourceSearch("")}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>

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
                        const paymentId = await payCreditCardBill({
                          bill: selectedPaymentBill,
                          card: selectedCreditCard,
                          paymentSourceId: source.id,
                        });
                        await markBillPaid(selectedPaymentBill.id, {
                          createTransaction: false,
                          existingTransactionId: paymentId,
                        });
                        setShowPaymentSourcePicker(false);
                        setSelectedPaymentBill(null);
                        setSelectedCreditCard(null);
                        await load();
                      } catch (e) {
                        console.error(e);
                        Alert.alert("Error", "Unable to complete payment.");
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
                        color: theme.modalText,
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

                setSelectedPaymentBill(null);

                setSelectedCreditCard(null);
              }}
            >
              Cancel
            </PaperButton>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirmVisible}
        title={confirmAction === "delete" ? "Delete Bill?" : "Skip Bill?"}
        message={confirmMessage}
        confirmLabel={confirmAction === "delete" ? "Delete Bill" : "Skip"}
        cancelLabel="Cancel"
        onCancel={() => {
          setConfirmVisible(false);
          setConfirmTarget(null);
        }}
        onConfirm={async () => {
          if (!confirmTarget?.id) {
            setConfirmVisible(false);
            setConfirmTarget(null);
            return;
          }

          try {
            if (confirmAction === "delete") {
              await deleteBill(confirmTarget.id);
            } else {
              await skipBill(confirmTarget.id);
            }

            setConfirmVisible(false);
            setConfirmTarget(null);

            await load();
          } catch (error) {
            console.error("[BillsScreen] confirm action failed:", error);

            setConfirmVisible(false);
            setConfirmTarget(null);

            Alert.alert(
              "Error",
              confirmAction === "delete"
                ? "Unable to delete this bill."
                : "Unable to skip this bill.",
            );
          }
        }}
      />
    </View>
  );
}

const styles = {
  dropdownTrigger: {
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { fontSize: 11, color: Colors.muted },
  value: { fontSize: 14, fontWeight: "700", color: Colors.text },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    padding: 20,
  },
  modal: { backgroundColor: "#fff", borderRadius: 16, padding: 10 },
  modalLarge: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    maxHeight: "70%",
  },
  item: { padding: 12, fontSize: 14 },
  selected: { color: Colors.primary, fontWeight: "700" },
  categorySearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 12,
    minHeight: 48,
    marginBottom: 14,
  },
  categorySearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: "#111827",
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
};
