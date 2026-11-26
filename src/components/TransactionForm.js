import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../context/ThemeContext";
import {
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Switch,
  Modal,
  Text,
  TextInput,
  Platform,
  BackHandler,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import ResponsiveBottomSheet from "./ResponsiveBottomSheet";
import SearchableItemPickerModal from "./SearchableItemPickerModal";
import {
  createTransaction,
  createTransfer,
  getTransactionNoteSuggestions,
  updateTransaction,
  deleteTransaction,
  updateTransfer,
  getCategoryAndSourceUsage,
} from "../services/transactions";
import {
  getLoans,
  linkTransactionToLoan,
  unlinkTransactionFromLoan,
} from "../services/loans";
import { getCategories } from "../services/categories";
import { getSources } from "../services/sources";
import {
  getBillsForTransaction,
  getAvailableBillsForTransactionLink,
  linkBillToTransaction,
  unlinkBillFromTransaction,
} from "../services/bills";
import { Snackbar, Button as PaperButton } from "react-native-paper";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import CategoryCreateScreen from "../screens/CategoryCreateScreen";
import SourceCreateScreen from "../screens/SourceCreateScreen";
import CommonBottomSheetModal from "./CommonBottomSheetModal";
import MuiDateTimePicker from "./MuiDateTimePicker";
import { getBillDisplayStatus, formatDueDate } from "../services/billUtils";
import { usePageLoader } from "../context/PageLoaderContext";
import PageLoader from "../components/PageLoader";
import { onCardTransactionChanged } from "../services/creditCardScheduler";

function formatLoanPaymentTypeLabel(paymentType) {
  switch (String(paymentType || "LINKED").toUpperCase()) {
    case "EMI":
      return "EMI";
    case "PREPAYMENT":
      return "Prepayment";
    case "FORECLOSURE":
      return "Foreclosure";
    case "TOP_UP":
      return "Top Up";
    case "ADVANCE":
      return "Advance";
    default:
      return "Linked";
  }
}

export default function TransactionForm({
  onCreated,
  onCancel,
  transaction,
  isEdit,
  onPressBill,
  sourceId: initialSourceId,
  categoryId: initialCategoryId,
  initialType,
}) {
  const { theme, isDarkMode } = useTheme();
  const {
    visible: loaderVisible,
    show: showPageLoader,
    hide: hidePageLoader,
  } = usePageLoader();

  // Form Field States
  const [amount, setAmount] = useState(
    isEdit && transaction ? String(transaction.amount) : ""
  );
  const [amountError, setAmountError] = useState(false);
  const [type, setType] = useState(
    isEdit && transaction ? transaction.type : initialType || "expense"
  );
  const [isReady, setIsReady] = useState(false);
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [categoryUsage, setCategoryUsage] = useState({});
  const [sourceUsage, setSourceUsage] = useState({});

  const [categoryId, setCategoryId] = useState(
    isEdit && transaction
      ? transaction.category_id
      : (initialCategoryId ?? null)
  );
  const [sourceId, setSourceId] = useState(
    isEdit && transaction ? transaction.source_id : (initialSourceId ?? null)
  );
  const [date, setDate] = useState(
    isEdit && transaction ? transaction.date : new Date().toISOString()
  );
  const [notes, setNotes] = useState(
    isEdit && transaction ? transaction.notes : ""
  );
  const [transferGroupId, setTransferGroupId] = useState(
    isEdit && transaction ? transaction.transfer_group_id : ""
  );
  const [toAccount, setToAccount] = useState(
    isEdit && transaction && transaction.type === "transfer"
      ? transaction.toAccount
      : null
  );

  // Advanced Option States
  const [isCounted, setIsCounted] = useState(
    isEdit && transaction
      ? transaction.is_counted !== undefined
        ? Boolean(transaction.is_counted)
        : true
      : true
  );
  const [loansList, setLoansList] = useState([]);
  const [selectedLoanId, setSelectedLoanId] = useState(
    isEdit && transaction ? transaction.loan_id : null
  );
  const [selectedLoanPaymentType, setSelectedLoanPaymentType] = useState(
    isEdit && transaction ? transaction.loan_payment_type || null : null
  );

  // Bill Linking States (Create & Edit Mode)
  const [availableBills, setAvailableBills] = useState([]);
  const [selectedBillId, setSelectedBillId] = useState(null);
  const [linkedBills, setLinkedBills] = useState([]);
  const [hasLinkedBill, setHasLinkedBill] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [billSearch, setBillSearch] = useState("");

  // UI & Modal States
  const [selectingFor, setSelectingFor] = useState("from"); // "from" or "to"
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);

  const [showCategoryCreateModal, setShowCategoryCreateModal] = useState(false);
  const [showSourceCreateModal, setShowSourceCreateModal] = useState(false);

  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Loan Linking Modal States
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanSearch, setLoanSearch] = useState("");
  const [loanTab, setLoanTab] = useState("active");
  const [pendingLoan, setPendingLoan] = useState(null);
  const [showLoanActionSheet, setShowLoanActionSheet] = useState(false);
  const [linking, setLinking] = useState(false);

  // Notes & Suggestions
  const [noteSuggestions, setNoteSuggestions] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [notesError, setNotesError] = useState(false);
  const filterTimeoutRef = useRef(null);

  // App & Workflow States
  const [isDirty, setIsDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [unlinkConfirmTarget, setUnlinkConfirmTarget] = useState(null); // "bill" | "loan" | null
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Track keyboard visibility so fixed bottom bar does not block form suggestions
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const markDirty = () => setIsDirty(true);

  // Theme Helpers
  const cardBg = isDarkMode ? (theme?.cardBg || "#1E293B") : "#FFFFFF";
  const screenBg = isDarkMode ? (theme?.background || "#0F172A") : "#F8FAFC";
  const textPrimary = isDarkMode ? "#F9FAFB" : "#111827";
  const textSecondary = isDarkMode ? "#94A3B8" : "#64748B";
  const borderColor = isDarkMode ? "#334155" : "#E2E8F0";
  const dividerColor = isDarkMode ? "#293548" : "#F1F5F9";
  const inputBg = isDarkMode ? "#1A2234" : "#F8FAFC";

  const typeConfig = useMemo(() => {
    switch (type) {
      case "income":
        return {
          label: "Income",
          color: "#10B981",
          softBg: isDarkMode ? "#0E2A1E" : "#ECFDF5",
          border: isDarkMode ? "#059669" : "#A7F3D0",
          icon: "arrow-down-left",
        };
      case "transfer":
        return {
          label: "Transfer",
          color: "#3B82F6",
          softBg: isDarkMode ? "#17233B" : "#EFF6FF",
          border: isDarkMode ? "#2563EB" : "#BFDBFE",
          icon: "swap-horizontal",
        };
      case "expense":
      default:
        return {
          label: "Expense",
          color: "#EF4444",
          softBg: isDarkMode ? "#2D1518" : "#FEF2F2",
          border: isDarkMode ? "#DC2626" : "#FECACA",
          icon: "arrow-up-right",
        };
    }
  }, [type, isDarkMode]);

  // Load Initial Data
  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        const [cats, src] = await Promise.all([
          getCategories(true),
          getSources(true),
        ]);
        if (cancelled) return;
        setCategories(cats || []);
        setSources(src || []);
        setIsReady(true);

        getCategoryAndSourceUsage(1)
          .then(({ categoryCount, sourceCount }) => {
            if (cancelled) return;
            setCategoryUsage(categoryCount || {});
            setSourceUsage(sourceCount || {});
          })
          .catch(() => { });

        getTransactionNoteSuggestions()
          .then((notes) => {
            if (cancelled) return;
            setNoteSuggestions(notes || []);
          })
          .catch(() => { });

        getLoans()
          .then((lns) => {
            if (cancelled) return;
            setLoansList(lns || []);
          })
          .catch(() => { });

        // Fetch available bills for linking
        getAvailableBillsForTransactionLink(isEdit && transaction?.id ? transaction.id : null)
          .then((bills) => {
            if (cancelled) return;
            setAvailableBills(bills || []);
          })
          .catch(() => { });

        if (isEdit && transaction?.id) {
          getBillsForTransaction(transaction.id, true)
            .then((bills) => {
              if (cancelled) return;
              setLinkedBills(bills || []);
              setHasLinkedBill(bills?.length > 0);
              if (bills && bills.length > 0) {
                setSelectedBillId(bills[0].id);
              }
            })
            .catch(() => { });
        }
      } catch (error) {
        if (cancelled) return;
        console.warn("TransactionForm initial load failed:", error);
        setIsReady(true);
      }
    }
    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Category reset when switching types (clears category when changing type in both edit and create modes)
  const prevTypeRef = useRef(type);
  useEffect(() => {
    if (prevTypeRef.current !== type) {
      prevTypeRef.current = type;
      setCategoryId(null);
      return;
    }
    if (type === "transfer") {
      setCategoryId(null);
      return;
    }
    if (categories.length > 0 && categoryId) {
      const exists = categories.some(
        (c) => c.id === categoryId && c.type === type
      );
      if (!exists) {
        setCategoryId(null);
      }
    }
  }, [type, categories, categoryId]);

  // Sync edit transaction only when switching to a different transaction
  const loadedTxIdRef = useRef(transaction?.id);
  useEffect(() => {
    if (isEdit && transaction?.id && transaction.id !== loadedTxIdRef.current) {
      loadedTxIdRef.current = transaction.id;
      if (transaction.category_id) {
        setCategoryId(transaction.category_id);
      }
      if (transaction.source_id) {
        setSourceId(transaction.source_id);
      }
      if (transaction.type) {
        setType(transaction.type);
      }
    }
  }, [isEdit, transaction?.id, transaction?.category_id, transaction?.source_id, transaction?.type]);

  // Sync initial params on new transaction
  useEffect(() => {
    if (!isEdit) {
      if (initialType) setType(initialType);
      if (initialCategoryId) setCategoryId(initialCategoryId);
      if (initialSourceId) setSourceId(initialSourceId);
    }
  }, [initialType, initialCategoryId, initialSourceId, isEdit]);

  // Hardware back button for unsaved changes
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isDirty) {
        setShowUnsavedDialog(true);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [isDirty]);

  // Notes Search & Suggestions (Matches current transaction type and note text)
  const handleNotesChange = (text) => {
    setNotes(text);
    setNotesError(false);
    markDirty();

    if (filterTimeoutRef.current) {
      clearTimeout(filterTimeoutRef.current);
    }

    filterTimeoutRef.current = setTimeout(() => {
      if (!text.trim()) {
        setFilteredSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      const searchText = text.toLowerCase().trim();
      const matches = noteSuggestions.filter((item) => {
        const matchesText = (item.notes || "").toLowerCase().includes(searchText);
        if (!matchesText) return false;
        // Prioritize matching current transaction type
        if (type === "transfer") {
          return item.type === "transfer" || !item.type;
        }
        return item.type === type || !item.type;
      });
      setFilteredSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    }, 150);
  };

  // Submit Handler
  async function submit() {
    if (submitting) return;
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) {
      setAmountError(true);
      return;
    }
    if (!isEdit && !categoryId && type !== "transfer") {
      setSnackbarMsg("Please select a category.");
      setSnackbarVisible(true);
      return;
    }
    if (!sourceId) {
      setSnackbarMsg("Please select a payment source.");
      setSnackbarVisible(true);
      return;
    }
    if (!notes.trim()) {
      setNotesError(true);
      return;
    }

    setSubmitting(true);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    let id;
    try {
      if (type === "transfer") {
        if (!sourceId || !toAccount) {
          setSnackbarMsg("Select both accounts");
          setSnackbarVisible(true);
          setSubmitting(false);
          return;
        }
        if (sourceId === toAccount) {
          setSnackbarMsg("Cannot transfer to same account");
          setSnackbarVisible(true);
          setSubmitting(false);
          return;
        }
        try {
          if (isEdit && transaction && transaction.transfer_group_id) {
            await updateTransfer({
              groupId: transaction.transfer_group_id,
              fromAccount: sourceId,
              toAccount,
              amount: val,
              note: notes.trim(),
              date,
            });
          } else {
            await createTransfer({
              fromAccount: sourceId,
              toAccount,
              amount: val,
              note: notes.trim(),
              date,
            });
          }
        } catch (e) {
          setSnackbarMsg(e?.message || "Transfer failed");
          setSnackbarVisible(true);
          setSubmitting(false);
          return;
        }
        id = "transfer";
      } else {
        const transactionData = {
          type,
          amount: val,
          category_id: categoryId || null,
          source_id: sourceId,
          date,
          notes: notes.trim(),
          is_counted: isCounted ? 1 : 0,
        };
        try {
          if (isEdit && transaction && transaction.id) {
            id = await updateTransaction(transaction.id, transactionData);

            // Loan linking updates
            if (selectedLoanId !== transaction.loan_id) {
              try {
                if (transaction.loan_id && !selectedLoanId) {
                  await unlinkTransactionFromLoan(transaction.id);
                } else if (selectedLoanId) {
                  await linkTransactionToLoan(transaction.id, selectedLoanId, {
                    paymentType: selectedLoanPaymentType || "LINKED",
                    linkedDate: date,
                  });
                }
              } catch (e) {
                console.warn(e);
              }
            }

            // Bill linking updates
            const initialBillId = linkedBills[0]?.id || null;
            if (selectedBillId !== initialBillId) {
              try {
                if (initialBillId && !selectedBillId) {
                  await unlinkBillFromTransaction(initialBillId, transaction.id);
                } else if (selectedBillId) {
                  if (initialBillId) {
                    await unlinkBillFromTransaction(initialBillId, transaction.id);
                  }
                  await linkBillToTransaction(selectedBillId, transaction.id);
                }
              } catch (e) {
                console.warn("[TransactionForm] Bill link update failed:", e);
              }
            }
          } else {
            id = await createTransaction(transactionData);

            // Loan link on create
            if (selectedLoanId) {
              try {
                await linkTransactionToLoan(id, selectedLoanId, {
                  paymentType: selectedLoanPaymentType || "LINKED",
                  linkedDate: date,
                });
              } catch (e) {
                console.warn(e);
              }
            }

            // Bill link on create
            if (selectedBillId) {
              try {
                await linkBillToTransaction(selectedBillId, id);
              } catch (e) {
                console.warn("[TransactionForm] Bill link on create failed:", e);
              }
            }
          }
        } catch (e) {
          setSnackbarMsg(e?.message || "Operation failed");
          setSnackbarVisible(true);
          setSubmitting(false);
          return;
        }
      }

      try {
        const affectedSourceId = sourceId;
        await onCardTransactionChanged(affectedSourceId);
        if (type === "transfer" && toAccount) {
          await onCardTransactionChanged(toAccount);
        }
      } catch (e) {
        console.warn("[TransactionForm] onCardTransactionChanged failed:", e);
      }

      setIsDirty(false);
      if (onCreated) onCreated(id);
      if (!isEdit) {
        setAmount("");
        setNotes("");
        setDate(new Date().toISOString());
        setTransferGroupId("");
        setSelectedBillId(null);
        setSelectedLoanId(null);
        setSelectedLoanPaymentType(null);
      }
      setAmountError(false);
      setNotesError(false);
      if (onCancel) onCancel();
    } finally {
      setSubmitting(false);
    }
  }

  // Delete Handler
  const handleDelete = async () => {
    setSubmitting(true);
    try {
      await deleteTransaction(transaction.id);
      try {
        if (transaction.source_id) {
          await onCardTransactionChanged(transaction.source_id);
        }
      } catch (e) {
        console.warn(
          "[TransactionForm] onCardTransactionChanged on delete failed:",
          e
        );
      }
      setConfirmVisible(false);
      onCancel?.();
    } finally {
      setSubmitting(false);
    }
  };

  // Date Formatter
  function formatDateTime(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    const day = d.getDate();
    const month = d.toLocaleString("en-IN", { month: "short" });
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    if (isToday) {
      return `Today, ${hours}:${minutes} ${ampm}`;
    }
    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  }

  // Filtered & Sorted Categories
  const filteredCategories = useMemo(() => {
    return categories
      .filter((c) => (type === "transfer" ? false : c.type === type))
      .sort((a, b) => {
        const usageA = Number(categoryUsage[String(a.id)] || 0);
        const usageB = Number(categoryUsage[String(b.id)] || 0);
        if (usageA !== usageB) return usageB - usageA;
        return Number(a.id) - Number(b.id);
      });
  }, [categories, type, categoryUsage]);

  const frequentCategories = useMemo(() => {
    return filteredCategories.slice(0, 5);
  }, [filteredCategories]);

  // Filtered & Sorted Sources
  const sortedSources = useMemo(() => {
    return sources
      .filter((s) => s.is_active === undefined || s.is_active)
      .sort((a, b) => {
        const usageA = Number(sourceUsage[String(a.id)] || 0);
        const usageB = Number(sourceUsage[String(b.id)] || 0);
        if (usageA !== usageB) return usageB - usageA;
        return Number(a.id) - Number(b.id);
      });
  }, [sources, sourceUsage]);

  const frequentSources = useMemo(() => {
    return sortedSources.slice(0, 4);
  }, [sortedSources]);

  const destinationSources = useMemo(() => {
    return sortedSources.filter((s) => s.id !== sourceId);
  }, [sortedSources, sourceId]);

  const frequentDestinationSources = useMemo(() => {
    return destinationSources.slice(0, 4);
  }, [destinationSources]);

  const currentModalSources = selectingFor === "to" ? destinationSources : sortedSources;

  // Selected Objects
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedSource = sources.find((s) => s.id === sourceId);
  const selectedToAccount = sources.find((s) => s.id === toAccount);
  const selectedLoan = loansList.find((l) => l.id === selectedLoanId);
  const selectedBill =
    availableBills.find((b) => b.id === selectedBillId) ||
    linkedBills.find((b) => b.id === selectedBillId);

  // Filtered Available Bills (ONLY unpaid or partially paid bills)
  const searchedBills = useMemo(() => {
    const unpaidBills = availableBills.filter((b) => {
      if (b.is_completely_paid === true || b.is_completely_paid === 1 || String(b.is_completely_paid) === "true") return false;
      const statusLower = String(b.status || "").toLowerCase();
      if (statusLower === "paid" || statusLower === "skipped") return false;
      if (Number(b.is_paid) === 1 || b.is_paid === true || String(b.is_paid) === "true") return false;
      if (b.remaining_amount !== undefined && Number(b.remaining_amount) <= 0) return false;
      return true;
    });

    if (!billSearch.trim()) return unpaidBills;
    const lower = billSearch.trim().toLowerCase();
    return unpaidBills.filter((b) => (b.name || "").toLowerCase().includes(lower));
  }, [availableBills, billSearch]);

  // Loans list for loan modal
  const activeLoans = loansList.filter(
    (loan) => String(loan.status || "").toLowerCase() === "active"
  );
  const closedLoans = loansList.filter(
    (loan) => String(loan.status || "").toLowerCase() === "closed"
  );
  const baseLoans = loanTab === "active" ? activeLoans : closedLoans;
  const filteredLoans = baseLoans
    .sort((a, b) => b.id - a.id)
    .filter(
      (l) =>
        (l.loan_name || "").toLowerCase().includes(loanSearch.toLowerCase()) ||
        (l.lender || "").toLowerCase().includes(loanSearch.toLowerCase()) ||
        (l.loan_type || "").toLowerCase().includes(loanSearch.toLowerCase())
    );

  const handleTypeSwitch = (newType) => {
    if (type === newType) return;
    if (
      (type === "transfer" && newType !== "transfer") ||
      (type !== "transfer" && newType === "transfer")
    ) {
      setNotes("");
      setFilteredSuggestions([]);
      setShowSuggestions(false);
      setNotesError(false);
    }
    setCategoryId(null);
    setType(newType);
    markDirty();
  };

  const renderLinkedBillDetailCard = () => {
    if (!selectedBill) return null;
    const isDeleted =
      selectedBill.is_deleted ||
      selectedBill.status === "deleted" ||
      Boolean(selectedBill.deleted_at);
    const display = isDeleted
      ? { label: "Deleted", color: "#EF4444" }
      : getBillDisplayStatus(selectedBill);
    const bCat = categories.find((c) => c.id === selectedBill.category_id);
    const bPaidNum = Number(selectedBill.paid_amount || 0);
    const bAmtNum = Number(selectedBill.amount || 0);
    const remNum =
      selectedBill.remaining_amount !== undefined && selectedBill.remaining_amount !== null
        ? Number(selectedBill.remaining_amount)
        : Math.max(0, bAmtNum - bPaidNum);
    const isPartial =
      !selectedBill.is_completely_paid &&
      (selectedBill.is_partially_paid || (bPaidNum > 0 && bPaidNum < bAmtNum));

    const dueText = formatDueDate(selectedBill.due_date);
    const detailLine = isDeleted
      ? `Deleted Bill · Due ${dueText}`
      : isPartial
        ? `Due ${dueText} · Paid ₹${bPaidNum.toLocaleString("en-IN")} / ₹${bAmtNum.toLocaleString("en-IN")}`
        : remNum !== bAmtNum && remNum > 0
          ? `Due ${dueText} · Rem ₹${remNum.toLocaleString("en-IN")} / ₹${bAmtNum.toLocaleString("en-IN")}`
          : `Due ${dueText} · ₹${bAmtNum.toLocaleString("en-IN")}`;

    const canOpenBillDetail =
      isEdit &&
      !isDeleted &&
      typeof onPressBill === "function" &&
      linkedBills.some((b) => b.id === selectedBill.id);

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => {
          Keyboard.dismiss();
          setBillSearch("");
          setShowBillModal(true);
        }}
        style={[
          styles.linkedDetailCard,
          {
            backgroundColor: cardBg,
            borderColor: borderColor,
            borderLeftColor: display.color,
          },
        ]}
      >
        <View
          style={[
            styles.linkedIconCircle,
            { backgroundColor: bCat?.color || "#3B82F6" },
          ]}
        >
          <MaterialCommunityIcons
            name={bCat?.icon || "receipt"}
            size={17}
            color="#FFFFFF"
          />
        </View>

        <View style={styles.linkedDetailBody}>
          <View style={styles.linkedTitleRow}>
            <Text
              numberOfLines={1}
              style={[styles.linkedTitleText, { color: textPrimary }]}
            >
              {selectedBill.name}
            </Text>
            <View
              style={[
                styles.linkedStatusBadge,
                { backgroundColor: `${display.color}20` },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.linkedStatusBadgeText, { color: display.color }]}
              >
                {display.label}
              </Text>
            </View>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.linkedSubText, { color: textSecondary }]}
          >
            {detailLine}
          </Text>
        </View>

        {canOpenBillDetail && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onPressBill(selectedBill);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={[
              styles.linkedMiniBtn,
              { backgroundColor: isDarkMode ? "#1E293B" : "#EFF6FF" },
            ]}
          >
            <MaterialCommunityIcons name="open-in-new" size={14} color="#3B82F6" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            Keyboard.dismiss();
            setUnlinkConfirmTarget("bill");
          }}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
          style={[
            styles.linkedMiniBtn,
            { backgroundColor: isDarkMode ? "#371B20" : "#FEE2E2" },
          ]}
        >
          <MaterialCommunityIcons name="close" size={14} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderLinkedLoanDetailCard = () => {
    if (type === "transfer" || !selectedLoan) return null;
    const paymentLabel = formatLoanPaymentTypeLabel(
      selectedLoanPaymentType || transaction?.loan_payment_type
    );
    const outstandingStr = Number(selectedLoan.outstanding_amount || 0).toLocaleString("en-IN");
    const emiStr = selectedLoan.emi_amount
      ? ` · EMI ₹${Number(selectedLoan.emi_amount).toLocaleString("en-IN")}`
      : "";
    const detailLine = `${selectedLoan.lender ? selectedLoan.lender + " · " : ""}Outstanding ₹${outstandingStr}${emiStr}`;

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => {
          Keyboard.dismiss();
          setLoanSearch("");
          setShowLoanModal(true);
        }}
        style={[
          styles.linkedDetailCard,
          {
            backgroundColor: cardBg,
            borderColor: borderColor,
            borderLeftColor: "#10B981",
          },
        ]}
      >
        <View style={[styles.linkedIconCircle, { backgroundColor: "#10B981" }]}>
          <MaterialCommunityIcons name="bank-check" size={17} color="#FFFFFF" />
        </View>

        <View style={styles.linkedDetailBody}>
          <View style={styles.linkedTitleRow}>
            <Text
              numberOfLines={1}
              style={[styles.linkedTitleText, { color: textPrimary }]}
            >
              {selectedLoan.loan_name}
            </Text>
            <View
              style={[
                styles.linkedStatusBadge,
                { backgroundColor: isDarkMode ? "#143528" : "#DCFCE7" },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.linkedStatusBadgeText,
                  { color: isDarkMode ? "#34D399" : "#059669" },
                ]}
              >
                {paymentLabel}
              </Text>
            </View>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.linkedSubText, { color: textSecondary }]}
          >
            {detailLine}
          </Text>
        </View>

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            Keyboard.dismiss();
            setUnlinkConfirmTarget("loan");
          }}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
          style={[
            styles.linkedMiniBtn,
            { backgroundColor: isDarkMode ? "#371B20" : "#FEE2E2" },
          ]}
        >
          <MaterialCommunityIcons name="close" size={14} color="#EF4444" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (!isReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: screenBg }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const showLoanControl = type !== "transfer";
  const showLinkRow = !selectedBill || (showLoanControl && !selectedLoan);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={[styles.mainContainer, { backgroundColor: screenBg }]}>
        {/* FIXED NON-SCROLLING FORM CONTAINER */}
        <View style={styles.fixedFormBody}>
          {/* 1. COMPACT HERO AMOUNT SECTION (Type selector & Delete shown inline ONLY in Edit mode) */}
          <View
            style={[
              styles.heroAmountCard,
              {
                backgroundColor: typeConfig.softBg,
                borderColor: typeConfig.border,
              },
            ]}
          >
            <View style={styles.amountHeaderRow}>
              <View style={styles.amountHeaderLeft}>
                {isEdit ? (
                  type === "transfer" ? (
                    <View
                      style={[
                        styles.inlineEditBadge,
                        { backgroundColor: cardBg, borderColor: typeConfig.border },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="swap-horizontal"
                        size={13}
                        color={typeConfig.color}
                      />
                      <Text style={[styles.inlineEditBadgeText, { color: typeConfig.color }]}>
                        TRANSFER AMOUNT
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.inlineEditTypeGroup,
                        {
                          backgroundColor: isDarkMode ? "#0F172A" : "rgba(255,255,255,0.75)",
                          borderColor: typeConfig.border,
                        },
                      ]}
                    >
                      {[
                        { id: "expense", label: "Expense", color: "#EF4444" },
                        { id: "income", label: "Income", color: "#10B981" },
                      ].map((tab) => {
                        const active = type === tab.id;
                        return (
                          <TouchableOpacity
                            key={tab.id}
                            disabled={submitting}
                            activeOpacity={0.75}
                            onPress={() => handleTypeSwitch(tab.id)}
                            style={[
                              styles.inlineEditTypeBtn,
                              active && {
                                backgroundColor: tab.color,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.inlineEditTypeText,
                                {
                                  color: active ? "#FFFFFF" : textSecondary,
                                  fontWeight: active ? "800" : "600",
                                },
                              ]}
                            >
                              {tab.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )
                ) : (
                  <View style={styles.createTypeHeader}>
                    <MaterialCommunityIcons
                      name={typeConfig.icon}
                      size={14}
                      color={typeConfig.color}
                    />
                    <Text style={[styles.amountLabel, { color: typeConfig.color }]}>
                      {typeConfig.label.toUpperCase()} AMOUNT
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.amountHeaderRight}>
                {amount.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setAmount("");
                      setAmountError(false);
                      markDirty();
                    }}
                    activeOpacity={0.7}
                    style={styles.amountClearBtn}
                  >
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={18}
                      color={typeConfig.color}
                    />
                  </TouchableOpacity>
                )}

                {isEdit && (
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setConfirmVisible(true);
                    }}
                    disabled={submitting}
                    activeOpacity={0.75}
                    style={[
                      styles.inlineDeleteBtn,
                      {
                        backgroundColor: isDarkMode ? "#371B20" : "#FEE2E2",
                        borderColor: isDarkMode ? "#7F1D1D" : "#FECACA",
                      },
                    ]}
                  >
                    <Feather name="trash-2" size={14} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.amountInputRow}>
              <Text style={[styles.currencyPrefix, { color: typeConfig.color }]}>
                ₹
              </Text>
              <TextInput
                value={amount}
                onChangeText={(t) => {
                  setAmount(t);
                  if (amountError) setAmountError(false);
                  markDirty();
                }}
                placeholder="0.00"
                placeholderTextColor={isDarkMode ? "#64748B" : "#94A3B8"}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                editable={!submitting}
                style={[styles.amountInput, { color: typeConfig.color }]}
                selectionColor={typeConfig.color}
              />
            </View>

            {amountError && (
              <Text style={styles.errorText}>Enter an amount greater than 0</Text>
            )}
          </View>

          {/* 2. NOTE / MERCHANT SECTION (PLACED RIGHT AFTER AMOUNT, OVERLAY SUGGESTIONS) */}
          <View
            style={[
              styles.noteCardContainer,
              {
                backgroundColor: cardBg,
                borderColor: notesError ? "#EF4444" : borderColor,
                elevation: showSuggestions && filteredSuggestions.length > 0 ? 12 : 0,
              },
            ]}
          >
            <View style={styles.noteInputRow}>
              <View
                style={[
                  styles.rowAvatar,
                  {
                    backgroundColor: isDarkMode ? "#33271D" : "#FEF3C7",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="text-box-outline"
                  size={17}
                  color="#D97706"
                />
              </View>

              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: textSecondary }]}>
                  {type === "expense"
                    ? "Where did you spend?"
                    : type === "income"
                      ? "How did you get this money?"
                      : "Where do you want to transfer?"}
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={handleNotesChange}
                  onFocus={() => {
                    if (filteredSuggestions.length > 0) setShowSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 250);
                  }}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  placeholder="e.g. Groceries, Dinner, Electricity"
                  placeholderTextColor={textSecondary}
                  editable={!submitting}
                  style={[
                    styles.noteTextInput,
                    { color: textPrimary },
                    notesError && { color: "#EF4444" },
                  ]}
                />
              </View>

              {notes.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setNotes("");
                    setFilteredSuggestions([]);
                    setShowSuggestions(false);
                    setNotesError(false);
                  }}
                  activeOpacity={0.7}
                  style={{ padding: 4 }}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={17}
                    color={textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {notesError && (
              <Text style={[styles.errorText, { marginLeft: 44, marginTop: 2 }]}>
                Please enter a description or note
              </Text>
            )}

            {/* Floating Note Suggestions Overlay (never pushes fixed screen height) */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <View
                style={[
                  styles.suggestionsDropdown,
                  {
                    backgroundColor: cardBg,
                    borderColor: borderColor,
                  },
                ]}
              >
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  style={{ maxHeight: 190 }}
                  showsVerticalScrollIndicator={false}
                >
                  {filteredSuggestions.slice(0, 4).map((item, index) => {
                    const itemCat = categories.find((c) => c.id === item.category_id);
                    const itemSrc = sources.find((s) => s.id === item.source_id);
                    const itemToSrc = sources.find((s) => s.id === item.to_account);

                    const metaSub = (() => {
                      if (type === "transfer") {
                        if (itemSrc && itemToSrc) {
                          return `${itemSrc.name} → ${itemToSrc.name}`;
                        }
                        if (itemSrc) return `From: ${itemSrc.name}`;
                        return "Transfer";
                      }
                      return itemCat?.name || "Saved note";
                    })();

                    return (
                      <TouchableOpacity
                        key={`${item.notes}-${index}`}
                        onPress={() => {
                          Keyboard.dismiss();
                          setNotes(item.notes);
                          if (type !== "transfer" && item.category_id) {
                            setCategoryId(item.category_id);
                          }
                          if (type === "transfer") {
                            if (item.source_id) {
                              setSourceId(item.source_id);
                            }
                            if (item.to_account && item.to_account !== item.source_id) {
                              setToAccount(item.to_account);
                            }
                          }
                          setShowSuggestions(false);
                          setFilteredSuggestions([]);
                          setNotesError(false);
                          markDirty();
                        }}
                        style={[
                          styles.suggestionListItem,
                          {
                            borderBottomColor: dividerColor,
                            borderBottomWidth: index < 3 ? 1 : 0,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.suggestionIconCircle,
                            { backgroundColor: itemCat?.color || itemSrc?.color || "#3B82F6" },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={itemCat?.icon || itemSrc?.icon || "tag"}
                            size={16}
                            color="#FFFFFF"
                          />
                        </View>

                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.suggestionItemTitle,
                              { color: textPrimary },
                            ]}
                          >
                            {item.notes}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.suggestionItemSub,
                              { color: textSecondary },
                            ]}
                          >
                            {metaSub}
                          </Text>
                        </View>

                        <MaterialCommunityIcons
                          name="arrow-top-left"
                          size={15}
                          color={textSecondary}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* 3. INSET-GROUPED TAP-TO-SELECT ROWS */}
          <View
            style={[
              styles.groupedCard,
              {
                backgroundColor: cardBg,
                borderColor: borderColor,
              },
            ]}
          >
            {/* ROW 1: CATEGORY (Expense & Income) */}
            {type !== "transfer" && (
              <>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowCategoryModal(true);
                  }}
                  disabled={submitting}
                  activeOpacity={0.7}
                  style={styles.tapRow}
                >
                  <View
                    style={[
                      styles.rowAvatar,
                      {
                        backgroundColor: selectedCategory?.color || (isDarkMode ? "#334155" : "#E2E8F0"),
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={selectedCategory?.icon || "tag"}
                      size={17}
                      color={selectedCategory ? "#FFFFFF" : textSecondary}
                    />
                  </View>

                  <View style={styles.rowContent}>
                    <Text style={[styles.rowLabel, { color: textSecondary }]}>
                      Category
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.rowValue,
                        {
                          color: selectedCategory ? textPrimary : textSecondary,
                          fontWeight: selectedCategory ? "700" : "500",
                        },
                      ]}
                    >
                      {selectedCategory?.name || "Select Category"}
                    </Text>
                  </View>

                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={textSecondary}
                  />
                </TouchableOpacity>
                <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />
              </>
            )}

            {/* ROW 2: PAYMENT SOURCE / FROM ACCOUNT */}
            <View style={{ paddingBottom: frequentSources.length > 0 ? 5 : 0 }}>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setSelectingFor("from");
                  setShowSourceModal(true);
                }}
                disabled={submitting}
                activeOpacity={0.7}
                style={styles.tapRow}
              >
                <View
                  style={[
                    styles.rowAvatar,
                    {
                      backgroundColor: selectedSource?.color || (isDarkMode ? "#334155" : "#E2E8F0"),
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={selectedSource?.icon || "cash"}
                    size={17}
                    color={selectedSource ? "#FFFFFF" : textSecondary}
                  />
                </View>

                <View style={styles.rowContent}>
                  <Text style={[styles.rowLabel, { color: textSecondary }]}>
                    {type === "transfer" ? "From Account" : "Payment Account"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.rowValue,
                      {
                        color: selectedSource ? textPrimary : textSecondary,
                        fontWeight: selectedSource ? "700" : "500",
                      },
                    ]}
                  >
                    {selectedSource?.name || "Select Payment Account"}
                  </Text>
                </View>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={textSecondary}
                />
              </TouchableOpacity>

              {/* Recent Account Quick Chips directly on form */}
              {frequentSources.length > 0 && (
                <View style={styles.recentChipsContainer}>
                  <Text style={[styles.recentChipsLabel, { color: textSecondary }]}>
                    Recent:
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.recentChipsScroll}
                  >
                    {frequentSources.map((s) => {
                      const isSel = sourceId === s.id;
                      return (
                        <TouchableOpacity
                          key={`rec-src-${s.id}`}
                          onPress={() => {
                            Keyboard.dismiss();
                            setSourceId(s.id);
                            markDirty();
                          }}
                          style={[
                            styles.recentChip,
                            {
                              backgroundColor: isSel
                                ? s.color || "#3B82F6"
                                : isDarkMode
                                  ? "#1E293B"
                                  : "#F1F5F9",
                              borderColor: isSel ? s.color : borderColor,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={s.icon || "cash"}
                            size={11}
                            color={isSel ? "#FFFFFF" : s.color || textSecondary}
                            style={{ marginRight: 3 }}
                          />
                          <Text
                            style={[
                              styles.recentChipText,
                              { color: isSel ? "#FFFFFF" : textPrimary },
                            ]}
                          >
                            {s.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* ROW 3: TO ACCOUNT (Transfer Only) */}
            {type === "transfer" && (
              <>
                <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />
                <View style={{ paddingBottom: frequentDestinationSources.length > 0 ? 5 : 0 }}>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setSelectingFor("to");
                      setShowSourceModal(true);
                    }}
                    disabled={submitting}
                    activeOpacity={0.7}
                    style={styles.tapRow}
                  >
                    <View
                      style={[
                        styles.rowAvatar,
                        {
                          backgroundColor: selectedToAccount?.color || (isDarkMode ? "#334155" : "#E2E8F0"),
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={selectedToAccount?.icon || "bank-transfer-in"}
                        size={17}
                        color={selectedToAccount ? "#FFFFFF" : textSecondary}
                      />
                    </View>

                    <View style={styles.rowContent}>
                      <Text style={[styles.rowLabel, { color: textSecondary }]}>
                        To Account
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.rowValue,
                          {
                            color: selectedToAccount ? textPrimary : textSecondary,
                            fontWeight: selectedToAccount ? "700" : "500",
                          },
                        ]}
                      >
                        {selectedToAccount?.name || "Select Destination Account"}
                      </Text>
                    </View>

                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={textSecondary}
                    />
                  </TouchableOpacity>

                  {/* Recent Destination Quick Chips */}
                  {frequentDestinationSources.length > 0 && (
                    <View style={styles.recentChipsContainer}>
                      <Text style={[styles.recentChipsLabel, { color: textSecondary }]}>
                        Recent:
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.recentChipsScroll}
                      >
                        {frequentDestinationSources.map((s) => {
                          const isSel = toAccount === s.id;
                          return (
                            <TouchableOpacity
                              key={`rec-to-${s.id}`}
                              onPress={() => {
                                Keyboard.dismiss();
                                setToAccount(s.id);
                                markDirty();
                              }}
                              style={[
                                styles.recentChip,
                                {
                                  backgroundColor: isSel
                                    ? s.color || "#3B82F6"
                                    : isDarkMode
                                      ? "#1E293B"
                                      : "#F1F5F9",
                                  borderColor: isSel ? s.color : borderColor,
                                },
                              ]}
                            >
                              <MaterialCommunityIcons
                                name={s.icon || "bank-transfer-in"}
                                size={11}
                                color={isSel ? "#FFFFFF" : s.color || textSecondary}
                                style={{ marginRight: 3 }}
                              />
                              <Text
                                style={[
                                  styles.recentChipText,
                                  { color: isSel ? "#FFFFFF" : textPrimary },
                                ]}
                              >
                                {s.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </>
            )}

            <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />

            {/* ROW 4: DATE & TIME */}
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                setShowDateTimePicker(true);
              }}
              disabled={submitting}
              activeOpacity={0.7}
              style={styles.tapRow}
            >
              <View
                style={[
                  styles.rowAvatar,
                  {
                    backgroundColor: isDarkMode ? "#1E3A5F" : "#DBEAFE",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="calendar-clock"
                  size={17}
                  color="#2563EB"
                />
              </View>

              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: textSecondary }]}>
                  Date & Time
                </Text>
                <Text style={[styles.rowValue, { color: textPrimary, fontWeight: "700" }]}>
                  {formatDateTime(date)}
                </Text>
              </View>

              <MaterialCommunityIcons
                name="calendar-edit"
                size={19}
                color={textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* 4. COUNT AS SPEND TOGGLE CARD */}
          {type !== "transfer" && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Keyboard.dismiss();
                setIsCounted((v) => !v);
                markDirty();
              }}
              style={[
                styles.countToggleCard,
                {
                  backgroundColor: cardBg,
                  borderColor: isCounted
                    ? isDarkMode
                      ? "#065F46"
                      : "#A7F3D0"
                    : isDarkMode
                      ? "#78350F"
                      : "#FDE68A",
                },
              ]}
            >
              <View
                style={[
                  styles.linkedIconCircle,
                  {
                    backgroundColor: isCounted
                      ? isDarkMode
                        ? "#143528"
                        : "#ECFDF5"
                      : isDarkMode
                        ? "#3E2914"
                        : "#FEF3C7",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={isCounted ? "check-circle-outline" : "eye-off-outline"}
                  size={17}
                  color={isCounted ? "#10B981" : "#D97706"}
                />
              </View>

              <View style={styles.countToggleTextWrap}>
                <Text style={[styles.countToggleTitle, { color: textPrimary }]}>
                  {isCounted
                    ? type === "expense"
                      ? "Count as Spend"
                      : "Count as Income"
                    : type === "expense"
                      ? "Don't Count as Spend"
                      : "Don't Count as Income"}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.countToggleSub, { color: textSecondary }]}
                >
                  {isCounted
                    ? "Included in monthly totals & reports"
                    : "Excluded from spend & budget totals"}
                </Text>
              </View>

              <Switch
                value={isCounted}
                onValueChange={(val) => {
                  Keyboard.dismiss();
                  setIsCounted(val);
                  markDirty();
                }}
                trackColor={{
                  false: isDarkMode ? "#4B5563" : "#E2E8F0",
                  true: isDarkMode ? "#059669" : "#34D399",
                }}
                thumbColor={isCounted ? "#10B981" : isDarkMode ? "#CBD5E1" : "#F59E0B"}
                style={styles.compactSwitch}
              />
            </TouchableOpacity>
          )}

          {/* 5. INLINE LINKED BILL & LOAN DETAILS + QUICK LINK ACTIONS */}
          <View style={styles.linkedSection}>
            {renderLinkedBillDetailCard()}
            {renderLinkedLoanDetailCard()}

            {showLinkRow && (
              <View style={styles.linkActionsRow}>
                {!selectedBill && (
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setBillSearch("");
                      setShowBillModal(true);
                    }}
                    activeOpacity={0.75}
                    style={[
                      styles.linkActionCard,
                      {
                        backgroundColor: cardBg,
                        borderColor: borderColor,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.linkActionIconBadge,
                        { backgroundColor: isDarkMode ? "#17253D" : "#EFF6FF" },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="receipt"
                        size={15}
                        color="#3B82F6"
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.linkActionCardText, { color: textPrimary }]}
                    >
                      Link Bill
                    </Text>
                    <MaterialCommunityIcons
                      name="plus"
                      size={16}
                      color={textSecondary}
                    />
                  </TouchableOpacity>
                )}

                {showLoanControl && !selectedLoan && (
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setLoanSearch("");
                      setShowLoanModal(true);
                    }}
                    activeOpacity={0.75}
                    style={[
                      styles.linkActionCard,
                      {
                        backgroundColor: cardBg,
                        borderColor: borderColor,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.linkActionIconBadge,
                        { backgroundColor: isDarkMode ? "#142D24" : "#ECFDF5" },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="bank-outline"
                        size={15}
                        color="#10B981"
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.linkActionCardText, { color: textPrimary }]}
                    >
                      Link Loan
                    </Text>
                    <MaterialCommunityIcons
                      name="plus"
                      size={16}
                      color={textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* 6. FIXED BOTTOM ACTION BAR (Hidden while keyboard is open to avoid mid-screen overlap) */}
        {!isKeyboardVisible && (
          <View
            style={[
              styles.bottomActionBar,
              {
                backgroundColor: cardBg,
                borderTopColor: borderColor,
              },
            ]}
          >
            <TouchableOpacity
              onPress={submit}
              disabled={submitting}
              activeOpacity={0.85}
              style={[
                styles.primarySaveBtn,
                {
                  backgroundColor: typeConfig.color,
                  shadowColor: typeConfig.color,
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primarySaveBtnText}>
                  {isEdit ? "Update Transaction" : "Save Transaction"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* MODAL 1: CATEGORY SELECTION BOTTOM SHEET */}
        <SearchableItemPickerModal
          visible={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          title="Select Category"
          placeholder="Search category..."
          items={filteredCategories}
          selectedId={categoryId}
          onSelect={(id) => {
            setCategoryId(id);
            markDirty();
          }}
          showAllOption={false}
          defaultIcon="tag"
          itemSingular="category"
          itemPlural="categories"
          frequentItems={frequentCategories}
          frequentLabel="MOST FREQUENT"
          emptyText="No categories found"
          createLabel="+ New"
          createAccentColor={typeConfig.color}
          onCreateNew={() => {
            setShowCategoryModal(false);
            setShowCategoryCreateModal(true);
          }}
        />

        {/* MODAL 2: SOURCE SELECTION BOTTOM SHEET */}
        <SearchableItemPickerModal
          visible={showSourceModal}
          onClose={() => setShowSourceModal(false)}
          title={selectingFor === "to" ? "Select Destination Account" : "Select Payment Account"}
          placeholder="Search account or source..."
          items={currentModalSources}
          selectedId={selectingFor === "to" ? toAccount : sourceId}
          onSelect={(id) => {
            if (selectingFor === "to") {
              setToAccount(id);
            } else {
              setSourceId(id);
            }
            markDirty();
          }}
          showAllOption={false}
          defaultIcon="cash"
          itemSingular="account"
          itemPlural="accounts"
          frequentItems={selectingFor === "to" ? frequentDestinationSources : frequentSources}
          frequentLabel="RECENT / FREQUENT ACCOUNTS"
          emptyText="No payment accounts found"
          createLabel="+ New"
          createAccentColor={typeConfig.color}
          onCreateNew={() => {
            setShowSourceModal(false);
            setShowSourceCreateModal(true);
          }}
        />

        {/* MODAL 3: BILL SELECTION BOTTOM SHEET (CREATE & EDIT TIME) */}
        <ResponsiveBottomSheet
          visible={showBillModal}
          avoidKeyboard
          animationType="slide"
          maxHeightRatio={0.8}
          onRequestClose={() => setShowBillModal(false)}
          sheetStyle={[styles.bottomSheetContainer, { backgroundColor: cardBg }]}
        >
          {({ maxHeight }) => (
            <>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeaderRow}>
                <View style={styles.sheetHeaderTextWrap}>
                  <Text numberOfLines={1} style={[styles.sheetTitle, { color: textPrimary }]}>
                    Link to Bill
                  </Text>
                  <Text numberOfLines={1} style={[styles.sheetSubtitle, { color: textSecondary }]}>
                    {searchedBills.length} {searchedBills.length === 1 ? "pending bill" : "pending bills"} available
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowBillModal(false)}
                  style={[styles.closeIconBtn, { backgroundColor: inputBg }]}
                >
                  <MaterialCommunityIcons name="close" size={20} color={textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchBarBox, { backgroundColor: inputBg, borderColor }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={textSecondary} />
                <TextInput
                  value={billSearch}
                  onChangeText={setBillSearch}
                  placeholder="Search bill by name..."
                  placeholderTextColor={textSecondary}
                  style={[styles.searchTextInput, { color: textPrimary }]}
                  autoCorrect={false}
                />
                {billSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setBillSearch("")}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={searchedBills}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={{
                  flexGrow: 0,
                  flexShrink: 1,
                  maxHeight: Math.max(90, maxHeight - 145),
                }}
                contentContainerStyle={{ paddingBottom: 18 }}
                renderItem={({ item: b }) => {
                  const isSelected = selectedBillId === b.id;
                  const bCat = categories.find((c) => c.id === b.category_id);
                  const display = getBillDisplayStatus(b);
                  const bPaidNum = Number(b.paid_amount || 0);
                  const bAmtNum = Number(b.amount || 0);
                  const remAmt =
                    b.remaining_amount !== undefined && b.remaining_amount !== null
                      ? Number(b.remaining_amount)
                      : Math.max(0, bAmtNum - bPaidNum);
                  const isPartial =
                    !b.is_completely_paid &&
                    (b.is_partially_paid || (bPaidNum > 0 && bPaidNum < bAmtNum));

                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        Keyboard.dismiss();
                        setSelectedBillId(b.id);
                        if (!amount || amount === "0" || amount === "0.00") {
                          setAmount(String(remAmt || b.amount || ""));
                        }
                        if (!notes) {
                          setNotes(b.name || "Bill Payment");
                        }
                        if (!categoryId && b.category_id) {
                          setCategoryId(b.category_id);
                        }
                        setShowBillModal(false);
                        markDirty();
                      }}
                      style={[
                        styles.loanListItem,
                        {
                          backgroundColor: isSelected
                            ? isDarkMode
                              ? "#17253D"
                              : "#EFF6FF"
                            : cardBg,
                          borderColor: isSelected ? "#3B82F6" : borderColor,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.modalItemIconCircle,
                          { backgroundColor: bCat?.color || "#3B82F6" },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={bCat?.icon || "receipt"}
                          size={18}
                          color="#FFFFFF"
                        />
                      </View>

                      <View style={styles.modalItemInfoCol}>
                        <Text
                          numberOfLines={1}
                          style={[styles.loanItemTitle, { color: textPrimary }]}
                        >
                          {b.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.loanItemSub, { color: textSecondary }]}
                        >
                          Due {formatDueDate(b.due_date)}
                          {isPartial ? ` · Paid ₹${bPaidNum.toLocaleString("en-IN")}` : ""}
                        </Text>
                      </View>

                      <View style={styles.modalItemRightCol}>
                        <Text
                          numberOfLines={1}
                          style={[styles.modalItemAmount, { color: display.color }]}
                        >
                          ₹{Number(remAmt || bAmtNum || 0).toLocaleString("en-IN")}
                        </Text>
                        <View
                          style={[
                            styles.modalStatusPill,
                            { backgroundColor: `${display.color}20` },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[styles.modalStatusPillText, { color: display.color }]}
                          >
                            {display.label}
                          </Text>
                        </View>
                      </View>

                      {isSelected ? (
                        <View style={styles.checkedCircle}>
                          <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <MaterialCommunityIcons name="chevron-right" size={20} color={textSecondary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyStateBox}>
                    <MaterialCommunityIcons name="receipt" size={34} color={textSecondary} style={{ opacity: 0.45, marginBottom: 8 }} />
                    <Text style={[styles.emptyStateText, { color: textSecondary }]}>
                      No pending bills found to link
                    </Text>
                  </View>
                }
              />
            </>
          )}
        </ResponsiveBottomSheet>

        {/* MODAL 4: LOAN PICKER MODAL */}
        <ResponsiveBottomSheet
          visible={showLoanModal}
          avoidKeyboard
          animationType="slide"
          maxHeightRatio={0.8}
          disableBackdropPress={linking}
          onRequestClose={() => {
            if (!linking) setShowLoanModal(false);
          }}
          sheetStyle={[styles.bottomSheetContainer, { backgroundColor: cardBg }]}
        >
          {({ maxHeight }) => (
            <>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeaderRow}>
                <View style={styles.sheetHeaderTextWrap}>
                  <Text numberOfLines={1} style={[styles.sheetTitle, { color: textPrimary }]}>
                    Link to Loan
                  </Text>
                  <Text numberOfLines={1} style={[styles.sheetSubtitle, { color: textSecondary }]}>
                    Select loan for this payment
                  </Text>
                </View>
                <TouchableOpacity
                  disabled={linking}
                  onPress={() => setShowLoanModal(false)}
                  style={[styles.closeIconBtn, { backgroundColor: inputBg }]}
                >
                  <MaterialCommunityIcons name="close" size={20} color={textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchBarBox, { backgroundColor: inputBg, borderColor }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={textSecondary} />
                <TextInput
                  value={loanSearch}
                  onChangeText={setLoanSearch}
                  placeholder="Search loan by name or lender..."
                  placeholderTextColor={textSecondary}
                  style={[styles.searchTextInput, { color: textPrimary }]}
                  autoCorrect={false}
                />
                {loanSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setLoanSearch("")}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.loanTabsContainer}>
                <TouchableOpacity
                  onPress={() => setLoanTab("active")}
                  style={[
                    styles.loanTabBtn,
                    loanTab === "active" && {
                      borderBottomColor: "#3B82F6",
                      borderBottomWidth: 2,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: loanTab === "active" ? "#3B82F6" : textSecondary,
                      fontWeight: "700",
                    }}
                  >
                    Active ({activeLoans.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setLoanTab("closed")}
                  style={[
                    styles.loanTabBtn,
                    loanTab === "closed" && {
                      borderBottomColor: "#3B82F6",
                      borderBottomWidth: 2,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      color: loanTab === "closed" ? "#3B82F6" : textSecondary,
                      fontWeight: "700",
                    }}
                  >
                    Closed ({closedLoans.length})
                  </Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={filteredLoans}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={{
                  flexGrow: 0,
                  flexShrink: 1,
                  maxHeight: Math.max(90, maxHeight - 195),
                }}
                contentContainerStyle={{ paddingBottom: 18 }}
                renderItem={({ item }) => {
                  const isSelected = selectedLoanId === item.id;
                  const isLent = String(item.loan_direction || "BORROWED").toUpperCase() === "LENT";
                  const badgeColor = isLent ? "#7C3AED" : "#3B82F6";

                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        Keyboard.dismiss();
                        setPendingLoan(item);
                        setShowLoanModal(false);
                        setShowLoanActionSheet(true);
                      }}
                      style={[
                        styles.loanListItem,
                        {
                          backgroundColor: isSelected
                            ? isDarkMode
                              ? "#17253D"
                              : "#EFF6FF"
                            : cardBg,
                          borderColor: isSelected ? "#3B82F6" : borderColor,
                        },
                      ]}
                    >
                      <View style={[styles.modalItemIconCircle, { backgroundColor: badgeColor }]}>
                        <MaterialCommunityIcons
                          name={isLent ? "hand-coin-outline" : "bank-outline"}
                          size={18}
                          color="#FFFFFF"
                        />
                      </View>

                      <View style={styles.modalItemInfoCol}>
                        <Text
                          numberOfLines={1}
                          style={[styles.loanItemTitle, { color: textPrimary }]}
                        >
                          {item.loan_name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.loanItemSub, { color: textSecondary }]}
                        >
                          {item.lender ? `${item.lender} · ` : ""}
                          {item.loan_type || (isLent ? "Lent" : "Borrowed")}
                        </Text>
                      </View>

                      <View style={styles.modalItemRightCol}>
                        <Text
                          numberOfLines={1}
                          style={[styles.modalItemAmount, { color: badgeColor }]}
                        >
                          ₹{Number(item.outstanding_amount || 0).toLocaleString("en-IN")}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.modalItemRightSub, { color: textSecondary }]}
                        >
                          {item.emi_amount
                            ? `EMI ₹${Number(item.emi_amount).toLocaleString("en-IN")}`
                            : "Outstanding"}
                        </Text>
                      </View>

                      {isSelected ? (
                        <View style={styles.checkedCircle}>
                          <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <MaterialCommunityIcons name="chevron-right" size={20} color={textSecondary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyStateBox}>
                    <MaterialCommunityIcons name="bank-outline" size={34} color={textSecondary} style={{ opacity: 0.45, marginBottom: 8 }} />
                    <Text style={[styles.emptyStateText, { color: textSecondary }]}>
                      No loans found
                    </Text>
                  </View>
                }
              />
            </>
          )}
        </ResponsiveBottomSheet>

        {/* MODAL 5: LOAN ACTION SHEET */}
        <ResponsiveBottomSheet
          visible={showLoanActionSheet}
          animationType="slide"
          maxHeightRatio={0.72}
          disableBackdropPress={linking}
          onRequestClose={() => {
            if (!linking) {
              setShowLoanActionSheet(false);
              setPendingLoan(null);
            }
          }}
          sheetStyle={[styles.bottomSheetContainer, { backgroundColor: cardBg }]}
        >
          {({ maxHeight }) => (
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              style={{ flexGrow: 0, flexShrink: 1, maxHeight: Math.max(180, maxHeight - 12) }}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <View style={styles.sheetHandle} />
              {pendingLoan &&
                (() => {
                  const isLentLoan =
                    (pendingLoan.loan_direction || "BORROWED").toUpperCase() === "LENT";
                  const options = isLentLoan
                    ? type === "income"
                      ? [
                        {
                          label: "Receive Payment",
                          sublabel: "Borrower paid back part or full amount",
                          icon: "cash-check",
                          color: "#16A34A",
                          bg: isDarkMode ? "#142D20" : "#DCFCE7",
                          paymentType: "EMI",
                        },
                      ]
                      : [
                        {
                          label: "Lend More",
                          sublabel: "Give additional money to the borrower",
                          icon: "cash-plus",
                          color: "#7C3AED",
                          bg: isDarkMode ? "#2D1948" : "#EDE9FE",
                          paymentType: "ADVANCE",
                        },
                      ]
                    : type === "income"
                      ? [
                        {
                          label: "Top Up",
                          sublabel: "Received additional amount from lender",
                          icon: "bank-plus",
                          color: "#7C3AED",
                          bg: isDarkMode ? "#2D1948" : "#EDE9FE",
                          paymentType: "TOP_UP",
                        },
                      ]
                      : [
                        {
                          label: "Pay EMI",
                          sublabel: "Regular monthly instalment payment",
                          icon: "cash-fast",
                          color: "#2563EB",
                          bg: isDarkMode ? "#17274D" : "#DBEAFE",
                          paymentType: "EMI",
                        },
                        {
                          label: "Prepayment",
                          sublabel: "Extra payment to reduce principal faster",
                          icon: "trending-up",
                          color: "#EA580C",
                          bg: isDarkMode ? "#3D2416" : "#FED7AA",
                          paymentType: "PREPAYMENT",
                        },
                        {
                          label: "Foreclose",
                          sublabel: "Close the loan with full & final payment",
                          icon: "bank-remove",
                          color: "#DC2626",
                          bg: isDarkMode ? "#371A1E" : "#FEE2E2",
                          paymentType: "FORECLOSURE",
                        },
                      ];

                  const doLink = (paymentType) => {
                    setLinking(true);
                    showPageLoader();
                    setTimeout(async () => {
                      try {
                        if (isEdit && transaction?.id) {
                          await linkTransactionToLoan(transaction.id, pendingLoan.id, {
                            paymentType,
                            linkedDate: transaction.date || date,
                          });
                        }
                        setSelectedLoanId(pendingLoan.id);
                        setSelectedLoanPaymentType(paymentType);
                        setPendingLoan(null);
                        setLoanSearch("");
                        markDirty();
                      } catch (e) {
                        console.error("[TransactionForm] Link loan failed:", e);
                      } finally {
                        setLinking(false);
                        hidePageLoader();
                        setShowLoanActionSheet(false);
                      }
                    }, 0);
                  };

                  return (
                    <View style={{ paddingBottom: 20 }}>
                      <Text style={[styles.sheetTitle, { color: textPrimary, marginBottom: 4 }]}>
                        {pendingLoan.loan_name}
                      </Text>
                      <Text style={[styles.sheetSubtitle, { color: textSecondary, marginBottom: 16 }]}>
                        What does this {type} represent?
                      </Text>

                      {options.map((opt) => (
                        <TouchableOpacity
                          key={opt.paymentType}
                          onPress={() => doLink(opt.paymentType)}
                          style={[
                            styles.loanActionRow,
                            {
                              backgroundColor: opt.bg,
                              borderColor: opt.color + "40",
                            },
                          ]}
                        >
                          <View
                            style={[styles.rowAvatar, { backgroundColor: opt.color }]}
                          >
                            <MaterialCommunityIcons name={opt.icon} size={22} color="#FFFFFF" />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.loanActionLabel, { color: textPrimary }]}>
                              {opt.label}
                            </Text>
                            <Text style={[styles.loanActionSub, { color: textSecondary }]}>
                              {opt.sublabel}
                            </Text>
                          </View>
                          <MaterialCommunityIcons name="chevron-right" size={20} color={opt.color} />
                        </TouchableOpacity>
                      ))}

                      <TouchableOpacity
                        onPress={() => {
                          setShowLoanActionSheet(false);
                          setPendingLoan(null);
                          setShowLoanModal(true);
                        }}
                        style={{ alignSelf: "center", marginTop: 12, padding: 8 }}
                      >
                        <Text style={{ color: "#3B82F6", fontWeight: "700" }}>
                          ← Back to loans
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
            </ScrollView>
          )}
        </ResponsiveBottomSheet>

        {/* MODAL 6: CREATE CATEGORY MODAL */}
        <Modal
          visible={showCategoryCreateModal}
          animationType="slide"
          onRequestClose={() => setShowCategoryCreateModal(false)}
        >
          <CategoryCreateScreen
            route={{
              params: {
                currentType: type,
                onCategoryCreated: async (newCategory) => {
                  const cats = await getCategories(true);
                  setCategories(cats);
                  setCategoryId(newCategory.id);
                  requestAnimationFrame(() => {
                    setShowCategoryCreateModal(false);
                    setShowCategoryModal(false);
                  });
                },
              },
            }}
            navigation={{
              goBack: () => setShowCategoryCreateModal(false),
            }}
          />
        </Modal>

        {/* MODAL 7: CREATE SOURCE MODAL */}
        <Modal
          visible={showSourceCreateModal}
          animationType="slide"
          onRequestClose={() => setShowSourceCreateModal(false)}
        >
          <SourceCreateScreen
            route={{
              params: {
                onSourceCreated: async () => {
                  const updatedSources = await getSources(true);
                  setSources(updatedSources);
                  const newestSource = [...updatedSources].sort((a, b) => b.id - a.id)[0];
                  requestAnimationFrame(() => {
                    if (newestSource) {
                      if (selectingFor === "to") setToAccount(newestSource.id);
                      else setSourceId(newestSource.id);
                    }
                    setShowSourceCreateModal(false);
                    setShowSourceModal(false);
                  });
                },
              },
            }}
            navigation={{ goBack: () => setShowSourceCreateModal(false) }}
          />
        </Modal>

        {/* DATE & TIME PICKER */}
        <MuiDateTimePicker
          visible={showDateTimePicker}
          initialDate={date}
          disableFutureDates={true}
          onSelect={(newDate) => {
            setDate(newDate.toISOString());
            setShowDateTimePicker(false);
            markDirty();
          }}
          onClose={() => setShowDateTimePicker(false)}
        />

        {/* DELETE CONFIRMATION MODAL */}
        <CommonBottomSheetModal
          visible={confirmVisible}
          type="danger"
          title="Delete Transaction?"
          subtitle={`Are you sure you want to remove this ${type} transaction?`}
          confirmLabel="Delete Transaction"
          cancelLabel="Keep Transaction"
          loading={submitting}
          warnings={[
            { title: "Permanent Removal", text: "Transaction will be permanently removed from account records." },
            { title: "Balance Restored", text: "Account balances and category monthly totals will update." },
            { title: "Cannot Be Undone", text: "This transaction cannot be recovered once deleted." },
          ]}
          onCancel={() => {
            if (!submitting) setConfirmVisible(false);
          }}
          onConfirm={handleDelete}
        />

        {/* UNSAVED CHANGES MODAL */}
        <CommonBottomSheetModal
          visible={showUnsavedDialog}
          type="warning"
          icon="alert-circle-outline"
          title="Discard Changes?"
          subtitle={
            isEdit
              ? "You've made changes that haven't been saved yet."
              : "You've started adding a new transaction."
          }
          confirmLabel="Discard"
          cancelLabel="Keep Editing"
          warningTitle="Unsaved Progress Notice"
          warnings={[
            { title: "Edits Lost", text: "If you leave now, all your unsaved modifications will be lost." },
            { title: "Keep Editing", text: 'Tap "Keep Editing" to continue working on this transaction.' },
          ]}
          onCancel={() => setShowUnsavedDialog(false)}
          onConfirm={() => {
            setShowUnsavedDialog(false);
            setIsDirty(false);
            if (onCancel) onCancel();
            else {
              setAmount("");
              setNotes("");
            }
          }}
        />

        {/* UNLINK BILL / LOAN WARNING MODAL */}
        {(() => {
          const isUnlinkBill = unlinkConfirmTarget === "bill";
          const isBillDeleted =
            selectedBill?.is_deleted ||
            selectedBill?.status === "deleted" ||
            Boolean(selectedBill?.deleted_at);
          return (
            <CommonBottomSheetModal
              visible={!!unlinkConfirmTarget}
              type="warning"
              icon="link-variant-off"
              title={
                isUnlinkBill
                  ? isBillDeleted
                    ? "Unlink Deleted Bill?"
                    : "Unlink Bill?"
                  : "Unlink Loan?"
              }
              subtitle={
                isUnlinkBill
                  ? isBillDeleted
                    ? `This bill was previously deleted. Unlinking will remove "${selectedBill?.name || "this bill"}" from this transaction.`
                    : `Are you sure you want to unlink "${selectedBill?.name || "this bill"}" from this transaction?`
                  : `Are you sure you want to unlink "${selectedLoan?.loan_name || "this loan"}" from this transaction?`
              }
              confirmLabel={isUnlinkBill ? "Unlink Bill" : "Unlink Loan"}
              cancelLabel="Keep Linked"
              confirmIcon="link-variant-off"
              warningTitle="Unlink Action Warning"
              warnings={
                isUnlinkBill
                  ? [
                    {
                      title: "Bill Link Removed",
                      text: isBillDeleted
                        ? "Transaction link will be cleared from this record."
                        : "The bill will revert to pending/unpaid status once you save this transaction.",
                    },
                    {
                      title: "Transaction Kept",
                      text: "Your transaction amount, account, and history will remain intact.",
                    },
                  ]
                  : [
                    {
                      title: "Loan Payment Disconnected",
                      text: "This transaction will no longer count toward the loan schedule once you save.",
                    },
                    {
                      title: "Transaction Kept",
                      text: "Your transaction amount, account, and history will remain intact.",
                    },
                  ]
              }
              onCancel={() => setUnlinkConfirmTarget(null)}
              onConfirm={() => {
                if (isUnlinkBill) {
                  setSelectedBillId(null);
                } else {
                  setSelectedLoanId(null);
                  setSelectedLoanPaymentType(null);
                }
                markDirty();
                setUnlinkConfirmTarget(null);
              }}
            />
          );
        })()}

        {/* SNACKBAR */}
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={3000}
          action={{ label: "OK", onPress: () => setSnackbarVisible(false) }}
        >
          {snackbarMsg}
        </Snackbar>

        <PageLoader visible={loaderVisible} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  fixedFormBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },

  /* 1. Hero Amount Card & Inline Edit Type Controls */
  heroAmountCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 8,
  },
  amountHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  amountHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  amountHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  createTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  inlineEditBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  inlineEditBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  inlineEditTypeGroup: {
    flexDirection: "row",
    borderRadius: 9,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  inlineEditTypeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 7,
  },
  inlineEditTypeText: {
    fontSize: 11.5,
  },
  inlineDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  amountClearBtn: {
    padding: 2,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  currencyPrefix: {
    fontSize: 26,
    fontWeight: "800",
    marginRight: 5,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "800",
    padding: 0,
    margin: 0,
  },
  errorText: {
    fontSize: 11,
    color: "#EF4444",
    fontWeight: "600",
    marginTop: 2,
  },

  /* 2. Note Card Container (Directly after Amount, Floating Suggestions) */
  noteCardContainer: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    position: "relative",
    zIndex: 100,
  },
  noteInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  noteTextInput: {
    fontSize: 14,
    fontWeight: "600",
    padding: 0,
    margin: 0,
  },
  suggestionsDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
    overflow: "hidden",
    zIndex: 999,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  suggestionListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  suggestionIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  suggestionItemTitle: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  suggestionItemSub: {
    fontSize: 11,
    marginTop: 1,
  },

  /* 3. Inset-Grouped Card */
  groupedCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 8,
  },
  tapRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  rowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  rowContent: {
    flex: 1,
    marginLeft: 10,
  },
  rowLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    marginBottom: 1,
  },
  rowValue: {
    fontSize: 14,
  },
  rowDivider: {
    height: 1,
    marginLeft: 54,
  },

  /* Recent Chips on Form */
  recentChipsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 54,
    marginTop: 0,
    marginBottom: 2,
    paddingRight: 10,
  },
  recentChipsLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    marginRight: 5,
  },
  recentChipsScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 1,
  },
  recentChipText: {
    fontSize: 10.5,
    fontWeight: "700",
  },

  /* 4. Count as Spend & Inline Linked Cards */
  countToggleCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 8,
  },
  countToggleTextWrap: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
  },
  countToggleTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  countToggleSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  compactSwitch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  linkedSection: {
    gap: 7,
  },
  linkedDetailCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3.5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    gap: 8,
  },
  linkedIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  linkedDetailBody: {
    flex: 1,
  },
  linkedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkedTitleText: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  linkedStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  linkedStatusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  linkedSubText: {
    fontSize: 11,
    marginTop: 1,
  },
  linkedMiniBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  linkActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  linkActionCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 8,
  },
  linkActionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  linkActionCardText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
  },

  /* 5. Sticky Bottom Action Bar */
  bottomActionBar: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
  },
  primarySaveBtn: {
    height: 46,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  primarySaveBtnText: {
    fontSize: 15.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* Modals / Bottom Sheet Common */
  bottomSheetContainer: {
    width: "100%",
    maxWidth: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sheetHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  searchBarBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchTextInput: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
    fontSize: 14,
    padding: 0,
  },
  checkedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emptyStateBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },

  /* Loan & Bill Modal List Items */
  loanTabsContainer: {
    flexDirection: "row",
    marginBottom: 10,
  },
  loanTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  loanListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  modalItemIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  modalItemInfoCol: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 8,
  },
  loanItemTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  loanItemSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  modalItemRightCol: {
    alignItems: "flex-end",
    marginRight: 8,
    flexShrink: 0,
    maxWidth: "42%",
  },
  modalItemAmount: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  modalItemRightSub: {
    fontSize: 10.5,
    marginTop: 2,
  },
  modalStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
    marginTop: 2,
  },
  modalStatusPillText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  loanActionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  loanActionLabel: {
    fontSize: 15,
    fontWeight: "800",
  },
  loanActionSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
