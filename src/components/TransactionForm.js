import React, { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "../context/ThemeContext";
import {
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
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
import LinkedBillCard from "./LinkedBillCard";
import { usePageLoader } from "../context/PageLoaderContext";
import PageLoader from "../components/PageLoader";
import { onCardTransactionChanged } from "../services/creditCardScheduler";

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
  const [categorySearch, setCategorySearch] = useState("");
  const categorySearchRef = useRef(null);

  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceSearch, setSourceSearch] = useState("");
  const sourceSearchRef = useRef(null);

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

  // Autofocus modal searches
  useEffect(() => {
    if (showCategoryModal) {
      setTimeout(() => categorySearchRef.current?.focus(), 250);
    }
  }, [showCategoryModal]);

  useEffect(() => {
    if (showSourceModal) {
      setTimeout(() => sourceSearchRef.current?.focus(), 250);
    }
  }, [showSourceModal]);

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
                    paymentType: "LINKED",
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
                  paymentType: "LINKED",
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

  const searchedCategories = useMemo(() => {
    if (!categorySearch.trim()) return filteredCategories;
    const lower = categorySearch.trim().toLowerCase();
    return filteredCategories.filter((c) => c.name.toLowerCase().includes(lower));
  }, [filteredCategories, categorySearch]);

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

  const searchedSources = useMemo(() => {
    if (!sourceSearch.trim()) return currentModalSources;
    const lower = sourceSearch.trim().toLowerCase();
    return currentModalSources.filter((s) => s.name.toLowerCase().includes(lower));
  }, [currentModalSources, sourceSearch]);

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

  if (!isReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: screenBg }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={[styles.mainContainer, { backgroundColor: screenBg }]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 1. TOP SEGMENTED TYPE CONTROL & HEADER ACTIONS */}
          <View style={styles.headerBar}>
            <View style={[styles.segmentedContainer, { backgroundColor: isDarkMode ? "#1E293B" : "#F1F5F9" }]}>
              {(isEdit && type === "transfer"
                ? [{ id: "transfer", label: "Transfer", color: "#3B82F6" }]
                : [
                  { id: "expense", label: "Expense", color: "#EF4444" },
                  { id: "income", label: "Income", color: "#10B981" },
                  ...(!isEdit
                    ? [{ id: "transfer", label: "Transfer", color: "#3B82F6" }]
                    : []),
                ]
              ).map((tab) => {
                const active = type === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    disabled={submitting}
                    activeOpacity={0.75}
                    onPress={() => {
                      const newType = tab.id;
                      if (type !== newType) {
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
                      }
                    }}
                    style={[
                      styles.segmentTab,
                      active && [
                        styles.segmentTabActive,
                        {
                          backgroundColor: cardBg,
                          shadowColor: isDarkMode ? "#000" : tab.color,
                        },
                      ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color: active ? tab.color : textSecondary,
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

            {isEdit && (
              <TouchableOpacity
                onPress={() => setConfirmVisible(true)}
                disabled={submitting}
                activeOpacity={0.7}
                style={[
                  styles.deleteButton,
                  {
                    backgroundColor: isDarkMode ? "#371B20" : "#FEE2E2",
                    borderColor: isDarkMode ? "#7F1D1D" : "#FECACA",
                  },
                ]}
              >
                <Feather name="trash-2" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>

          {/* 2. HERO AMOUNT SECTION */}
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
              <Text style={[styles.amountLabel, { color: typeConfig.color }]}>
                {typeConfig.label.toUpperCase()} AMOUNT
              </Text>
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
                editable={!submitting}
                style={[styles.amountInput, { color: typeConfig.color }]}
                selectionColor={typeConfig.color}
              />
            </View>

            {amountError && (
              <Text style={styles.errorText}>Enter an amount greater than 0</Text>
            )}
          </View>

          {/* 3. NOTE / MERCHANT SECTION (PLACED RIGHT AFTER AMOUNT) */}
          <View
            style={[
              styles.noteCardContainer,
              {
                backgroundColor: cardBg,
                borderColor: notesError ? "#EF4444" : borderColor,
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
                  size={20}
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
                    size={18}
                    color={textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {notesError && (
              <Text style={[styles.errorText, { marginLeft: 48, marginTop: 4 }]}>
                Please enter a description or note
              </Text>
            )}

            {/* Note Suggestions Dropdown (Existing list style with auto-assignment) */}
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
                {filteredSuggestions.slice(0, 4).map((item, index) => {
                  const itemCat = categories.find((c) => c.id === item.category_id);
                  const itemSrc = sources.find((s) => s.id === item.source_id);
                  const itemToSrc = sources.find((s) => s.id === item.to_account);

                  // Derive subtitle showing auto-picked account/category
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
                        // Auto-pick category only for expense and income
                        if (type !== "transfer" && item.category_id) {
                          setCategoryId(item.category_id);
                        }
                        // Source selection should ONLY happen on transfer type!
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
                          size={18}
                          color="#FFFFFF"
                        />
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text
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
                        size={16}
                        color={textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* 4. INSET-GROUPED TAP-TO-SELECT ROWS */}
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
                  onPress={() => setShowCategoryModal(true)}
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
                      size={20}
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
                    size={22}
                    color={textSecondary}
                  />
                </TouchableOpacity>
                <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />
              </>
            )}

            {/* ROW 2: PAYMENT SOURCE / FROM ACCOUNT */}
            <View style={{ paddingBottom: 4 }}>
              <TouchableOpacity
                onPress={() => {
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
                    size={20}
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
                  size={22}
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
                            size={12}
                            color={isSel ? "#FFFFFF" : s.color || textSecondary}
                            style={{ marginRight: 4 }}
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
                <View style={{ paddingBottom: 4 }}>
                  <TouchableOpacity
                    onPress={() => {
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
                        size={20}
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
                      size={22}
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
                                size={12}
                                color={isSel ? "#FFFFFF" : s.color || textSecondary}
                                style={{ marginRight: 4 }}
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
              onPress={() => setShowDateTimePicker(true)}
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
                  size={20}
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
                size={20}
                color={textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* 5. COMPACT ADVANCED OPTIONS PILL STRIP */}
          <View style={styles.advancedStrip}>
            {/* Visibility Toggle Pill: Count as Spend / Count as Income */}
            {type !== "transfer" && (
              <TouchableOpacity
                onPress={() => {
                  setIsCounted((v) => !v);
                  markDirty();
                }}
                activeOpacity={0.75}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor: isCounted
                      ? isDarkMode
                        ? "#152E20"
                        : "#ECFDF5"
                      : isDarkMode
                        ? "#3E2914"
                        : "#FEF3C7",
                    borderColor: isCounted
                      ? isDarkMode
                        ? "#059669"
                        : "#10B981"
                      : isDarkMode
                        ? "#B45309"
                        : "#F59E0B",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={isCounted ? "check-circle-outline" : "eye-off-outline"}
                  size={15}
                  color={isCounted ? "#10B981" : "#D97706"}
                />
                <Text
                  style={[
                    styles.optionPillText,
                    {
                      color: isCounted ? (isDarkMode ? "#34D399" : "#059669") : "#B45309",
                      fontWeight: isCounted ? "700" : "600",
                    },
                  ]}
                >
                  {isCounted
                    ? type === "expense"
                      ? "Count as Spend"
                      : "Count as Income"
                    : type === "expense"
                      ? "Don't Count as Spend"
                      : "Don't Count as Income"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Bill Link Pill (Available during Create & Edit Mode) */}
            <TouchableOpacity
              onPress={() => {
                setBillSearch("");
                setShowBillModal(true);
              }}
              activeOpacity={0.75}
              style={[
                styles.optionPill,
                {
                  backgroundColor: selectedBill
                    ? isDarkMode
                      ? "#15243E"
                      : "#EFF6FF"
                    : isDarkMode
                      ? "#1E293B"
                      : "#F8FAFC",
                  borderColor: selectedBill
                    ? isDarkMode
                      ? "#2563EB"
                      : "#3B82F6"
                    : borderColor,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={selectedBill ? "receipt-text-check" : "receipt"}
                size={15}
                color={selectedBill ? "#3B82F6" : textSecondary}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.optionPillText,
                  {
                    color: selectedBill ? "#2563EB" : textSecondary,
                    fontWeight: selectedBill ? "700" : "600",
                  },
                ]}
              >
                {selectedBill ? `Bill: ${selectedBill.name}` : "+ Link Bill"}
              </Text>
              {selectedBill && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedBillId(null);
                    markDirty();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close" size={14} color="#EF4444" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Loan Link Pill (Expense & Income) */}
            {type !== "transfer" && (
              <TouchableOpacity
                onPress={() => {
                  setLoanSearch("");
                  setShowLoanModal(true);
                }}
                activeOpacity={0.75}
                style={[
                  styles.optionPill,
                  {
                    backgroundColor: selectedLoan
                      ? isDarkMode
                        ? "#142D24"
                        : "#ECFDF5"
                      : isDarkMode
                        ? "#1E293B"
                        : "#F8FAFC",
                    borderColor: selectedLoan
                      ? isDarkMode
                        ? "#059669"
                        : "#10B981"
                      : borderColor,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={selectedLoan ? "bank-check" : "bank-outline"}
                  size={15}
                  color={selectedLoan ? "#10B981" : textSecondary}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.optionPillText,
                    {
                      color: selectedLoan ? (isDarkMode ? "#34D399" : "#059669") : textSecondary,
                      fontWeight: selectedLoan ? "700" : "600",
                    },
                  ]}
                >
                  {selectedLoan ? `Loan: ${selectedLoan.loan_name}` : "+ Link Loan"}
                </Text>
                {selectedLoan && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      if (isEdit && transaction?.id) {
                        unlinkTransactionFromLoan(transaction.id).catch(() => { });
                      }
                      setSelectedLoanId(null);
                      markDirty();
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="close" size={14} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* In-scroll Save Action Button (rendered only when keyboard is visible to prevent duplicate buttons) */}
          {isKeyboardVisible && (
            <View style={styles.inScrollSaveContainer}>
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
        </ScrollView>

        {/* 6. FIXED BOTTOM ACTION BAR (Shown at the bottom when keyboard is NOT open) */}
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
        <Modal
          visible={showCategoryModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCategoryModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.bottomSheetContainer, { backgroundColor: cardBg }]}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeaderRow}>
                <View>
                  <Text style={[styles.sheetTitle, { color: textPrimary }]}>
                    Select Category
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: textSecondary }]}>
                    {searchedCategories.length} categories available
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setShowCategoryModal(false)}
                  style={[styles.closeIconBtn, { backgroundColor: inputBg }]}
                >
                  <MaterialCommunityIcons name="close" size={20} color={textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchBarBox, { backgroundColor: inputBg, borderColor }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={textSecondary} />
                <TextInput
                  ref={categorySearchRef}
                  value={categorySearch}
                  onChangeText={setCategorySearch}
                  placeholder="Search category..."
                  placeholderTextColor={textSecondary}
                  style={[styles.searchTextInput, { color: textPrimary }]}
                  autoCorrect={false}
                />
                {categorySearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCategorySearch("")}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {!categorySearch && frequentCategories.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.subHeaderLabel, { color: textSecondary }]}>
                    MOST FREQUENT
                  </Text>
                  <View style={styles.quickChipsWrap}>
                    {frequentCategories.map((c) => (
                      <TouchableOpacity
                        key={`freq-${c.id}`}
                        onPress={() => {
                          setCategoryId(c.id);
                          setShowCategoryModal(false);
                          setCategorySearch("");
                          markDirty();
                        }}
                        style={[
                          styles.frequentChip,
                          {
                            backgroundColor: categoryId === c.id ? c.color : inputBg,
                            borderColor: categoryId === c.id ? c.color : borderColor,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={c.icon || "tag"}
                          size={14}
                          color={categoryId === c.id ? "#FFFFFF" : c.color || "#3B82F6"}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.frequentChipText,
                            { color: categoryId === c.id ? "#FFFFFF" : textPrimary },
                          ]}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 80 }}
              >
                <View style={styles.categoryGrid}>
                  {/* Dedicated + New Category card in the grid */}
                  <TouchableOpacity
                    onPress={() => {
                      setShowCategoryModal(false);
                      setShowCategoryCreateModal(true);
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.categoryGridItem,
                      {
                        backgroundColor: isDarkMode ? "#1E293B" : "#F8FAFC",
                        borderColor: typeConfig.color,
                        borderStyle: "dashed",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.categoryItemIconCircle,
                        { backgroundColor: typeConfig.color },
                      ]}
                    >
                      <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.categoryItemText,
                        { color: typeConfig.color, fontWeight: "800" },
                      ]}
                    >
                      + New
                    </Text>
                  </TouchableOpacity>

                  {searchedCategories.map((c) => {
                    const isSelected = categoryId === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => {
                          setCategoryId(c.id);
                          setShowCategoryModal(false);
                          setCategorySearch("");
                          markDirty();
                        }}
                        activeOpacity={0.8}
                        style={[
                          styles.categoryGridItem,
                          {
                            backgroundColor: isSelected
                              ? c.color || "#3B82F6"
                              : isDarkMode
                                ? "#1E293B"
                                : "#F8FAFC",
                            borderColor: isSelected ? c.color : borderColor,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.categoryItemIconCircle,
                            {
                              backgroundColor: isSelected
                                ? "rgba(255,255,255,0.25)"
                                : c.color || "#3B82F6",
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={c.icon || "tag"}
                            size={18}
                            color="#FFFFFF"
                          />
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.categoryItemText,
                            {
                              color: isSelected ? "#FFFFFF" : textPrimary,
                              fontWeight: isSelected ? "700" : "600",
                            },
                          ]}
                        >
                          {c.name}
                        </Text>
                        {isSelected && (
                          <View style={styles.categoryCheckBadge}>
                            <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {searchedCategories.length === 0 && (
                  <View style={styles.emptyStateBox}>
                    <Text style={[styles.emptyStateText, { color: textSecondary }]}>
                      No categories found
                    </Text>
                    {categorySearch.trim().length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setShowCategoryModal(false);
                          setShowCategoryCreateModal(true);
                        }}
                        style={[styles.emptyCreateBtn, { backgroundColor: typeConfig.color }]}
                      >
                        <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                        <Text style={styles.emptyCreateBtnText}>
                          Create "{categorySearch.trim()}"
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL 2: SOURCE SELECTION BOTTOM SHEET */}
        <Modal
          visible={showSourceModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSourceModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.bottomSheetContainer, { backgroundColor: cardBg }]}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeaderRow}>
                <View>
                  <Text style={[styles.sheetTitle, { color: textPrimary }]}>
                    {selectingFor === "to" ? "Select Destination Account" : "Select Payment Account"}
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: textSecondary }]}>
                    {searchedSources.length} accounts available
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setShowSourceModal(false)}
                  style={[styles.closeIconBtn, { backgroundColor: inputBg }]}
                >
                  <MaterialCommunityIcons name="close" size={20} color={textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchBarBox, { backgroundColor: inputBg, borderColor }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={textSecondary} />
                <TextInput
                  ref={sourceSearchRef}
                  value={sourceSearch}
                  onChangeText={setSourceSearch}
                  placeholder="Search account or source..."
                  placeholderTextColor={textSecondary}
                  style={[styles.searchTextInput, { color: textPrimary }]}
                  autoCorrect={false}
                />
                {sourceSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setSourceSearch("")}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Recent / Most Used Account Quick Chips */}
              {!sourceSearch && (selectingFor === "to" ? frequentDestinationSources : frequentSources).length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.subHeaderLabel, { color: textSecondary }]}>
                    RECENT / FREQUENT ACCOUNTS
                  </Text>
                  <View style={styles.quickChipsWrap}>
                    {(selectingFor === "to" ? frequentDestinationSources : frequentSources).map((s) => {
                      const isSel = selectingFor === "to" ? toAccount === s.id : sourceId === s.id;
                      return (
                        <TouchableOpacity
                          key={`freq-src-${s.id}`}
                          onPress={() => {
                            if (selectingFor === "to") setToAccount(s.id);
                            else setSourceId(s.id);
                            setShowSourceModal(false);
                            setSourceSearch("");
                            markDirty();
                          }}
                          style={[
                            styles.frequentChip,
                            {
                              backgroundColor: isSel ? s.color || "#3B82F6" : inputBg,
                              borderColor: isSel ? s.color : borderColor,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={s.icon || "cash"}
                            size={14}
                            color={isSel ? "#FFFFFF" : s.color || "#3B82F6"}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.frequentChipText,
                              { color: isSel ? "#FFFFFF" : textPrimary },
                            ]}
                          >
                            {s.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 80 }}
              >
                <View style={styles.categoryGrid}>
                  {/* Dedicated + New Account card in the grid */}
                  <TouchableOpacity
                    onPress={() => {
                      setShowSourceModal(false);
                      setShowSourceCreateModal(true);
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.categoryGridItem,
                      {
                        backgroundColor: isDarkMode ? "#1E293B" : "#F8FAFC",
                        borderColor: typeConfig.color,
                        borderStyle: "dashed",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.categoryItemIconCircle,
                        { backgroundColor: typeConfig.color },
                      ]}
                    >
                      <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.categoryItemText,
                        { color: typeConfig.color, fontWeight: "800" },
                      ]}
                    >
                      + New
                    </Text>
                  </TouchableOpacity>

                  {searchedSources.map((s) => {
                    const isSelected = selectingFor === "to" ? toAccount === s.id : sourceId === s.id;
                    const itemColor = s.color || "#3B82F6";
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => {
                          if (selectingFor === "to") {
                            setToAccount(s.id);
                          } else {
                            setSourceId(s.id);
                          }
                          setShowSourceModal(false);
                          setSourceSearch("");
                          markDirty();
                        }}
                        activeOpacity={0.8}
                        style={[
                          styles.categoryGridItem,
                          {
                            backgroundColor: isSelected
                              ? itemColor
                              : isDarkMode
                                ? "#1E293B"
                                : "#F8FAFC",
                            borderColor: isSelected ? itemColor : borderColor,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.categoryItemIconCircle,
                            {
                              backgroundColor: isSelected
                                ? "rgba(255,255,255,0.25)"
                                : itemColor,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={s.icon || "cash"}
                            size={18}
                            color="#FFFFFF"
                          />
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.categoryItemText,
                            {
                              color: isSelected ? "#FFFFFF" : textPrimary,
                              fontWeight: isSelected ? "700" : "600",
                            },
                          ]}
                        >
                          {s.name}
                        </Text>
                        {isSelected && (
                          <View style={styles.categoryCheckBadge}>
                            <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {searchedSources.length === 0 && (
                  <View style={styles.emptyStateBox}>
                    <Text style={[styles.emptyStateText, { color: textSecondary }]}>
                      No payment accounts found
                    </Text>
                    {sourceSearch.trim().length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setShowSourceModal(false);
                          setShowSourceCreateModal(true);
                        }}
                        style={[styles.emptyCreateBtn, { backgroundColor: typeConfig.color }]}
                      >
                        <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                        <Text style={styles.emptyCreateBtnText}>
                          Create "{sourceSearch.trim()}"
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL 3: BILL SELECTION BOTTOM SHEET (CREATE & EDIT TIME) */}
        <Modal
          visible={showBillModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowBillModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.bottomSheetContainer, { backgroundColor: cardBg }]}>
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeaderRow}>
                <View>
                  <Text style={[styles.sheetTitle, { color: textPrimary }]}>
                    Link to Bill
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: textSecondary }]}>
                    Select an unpaid or pending bill
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
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {searchedBills.map((b) => {
                  const isSelected = selectedBillId === b.id;
                  const bCat = categories.find((c) => c.id === b.category_id);
                  const remAmt = b.remaining_amount !== undefined ? b.remaining_amount : b.amount;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      activeOpacity={0.8}
                      onPress={() => {
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
                          styles.rowAvatar,
                          { backgroundColor: bCat?.color || "#3B82F6" },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={bCat?.icon || "receipt"}
                          size={20}
                          color="#FFFFFF"
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.loanItemTitle, { color: textPrimary }]}>
                          {b.name}
                        </Text>
                        <Text style={[styles.loanItemSub, { color: textSecondary }]}>
                          {b.due_date ? `Due ${String(b.due_date).substring(0, 10)}` : "Pending bill"} • ₹
                          {Number(remAmt || b.amount || 0).toLocaleString("en-IN")}
                        </Text>
                      </View>
                      {isSelected ? (
                        <View style={styles.checkedCircle}>
                          <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <MaterialCommunityIcons name="chevron-right" size={22} color={textSecondary} />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {searchedBills.length === 0 && (
                  <View style={styles.emptyStateBox}>
                    <Text style={[styles.emptyStateText, { color: textSecondary }]}>
                      No pending bills found to link
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL 4: LOAN PICKER MODAL */}
        <Modal
          visible={showLoanModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (!linking) setShowLoanModal(false);
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.bottomSheetContainer, { backgroundColor: cardBg }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeaderRow}>
                <View>
                  <Text style={[styles.sheetTitle, { color: textPrimary }]}>
                    Link to Loan
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: textSecondary }]}>
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
                    style={{
                      color: loanTab === "closed" ? "#3B82F6" : textSecondary,
                      fontWeight: "700",
                    }}
                  >
                    Closed ({closedLoans.length})
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {filteredLoans.map((item) => {
                  const isSelected = selectedLoanId === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      onPress={() => {
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
                      <View style={[styles.rowAvatar, { backgroundColor: "#3B82F6" }]}>
                        <MaterialCommunityIcons name="bank-outline" size={20} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.loanItemTitle, { color: textPrimary }]}>
                          {item.loan_name}
                        </Text>
                        <Text style={[styles.loanItemSub, { color: textSecondary }]}>
                          Outstanding ₹
                          {Number(item.outstanding_amount || 0).toLocaleString("en-IN")}
                        </Text>
                      </View>
                      {isSelected ? (
                        <View style={styles.checkedCircle}>
                          <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <MaterialCommunityIcons name="chevron-right" size={22} color={textSecondary} />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {filteredLoans.length === 0 && (
                  <View style={styles.emptyStateBox}>
                    <Text style={[styles.emptyStateText, { color: textSecondary }]}>
                      No loans found
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL 5: LOAN ACTION SHEET */}
        <Modal
          visible={showLoanActionSheet}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (!linking) {
              setShowLoanActionSheet(false);
              setPendingLoan(null);
            }
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.bottomSheetContainer, { backgroundColor: cardBg }]}>
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
            </View>
          </View>
        </Modal>

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
                    setCategorySearch("");
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
                    setSourceSearch("");
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },

  /* 1. Header Bar */
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  segmentedContainer: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  segmentTabActive: {
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  segmentText: {
    fontSize: 14,
  },
  deleteButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },

  /* 2. Hero Amount Card */
  heroAmountCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 10,
  },
  amountHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
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
    fontSize: 30,
    fontWeight: "800",
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 34,
    fontWeight: "800",
    padding: 0,
    margin: 0,
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    fontWeight: "600",
    marginTop: 4,
  },

  /* 3. Note Card Container (Directly after Amount) */
  noteCardContainer: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    position: "relative",
    zIndex: 99,
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
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  suggestionListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  suggestionItemTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  suggestionItemSub: {
    fontSize: 11,
    marginTop: 1,
  },

  /* 4. Inset-Grouped Card */
  groupedCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 10,
  },
  tapRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 15,
  },
  rowDivider: {
    height: 1,
    marginLeft: 62,
  },

  /* Recent Chips on Form */
  recentChipsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 62,
    marginTop: 2,
    marginBottom: 4,
    paddingRight: 10,
  },
  recentChipsLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginRight: 6,
  },
  recentChipsScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recentChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  recentChipText: {
    fontSize: 11,
    fontWeight: "700",
  },

  /* 5. Advanced Strip */
  advancedStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  optionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  optionPillText: {
    fontSize: 12,
  },

  /* 6. Sticky Bottom Action Bar */
  bottomActionBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  inScrollSaveContainer: {
    marginTop: 20,
    marginBottom: 28,
  },
  primarySaveBtn: {
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  primarySaveBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  emptyCreateBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  emptyCreateBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Modals / Bottom Sheet Common */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "85%",
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
    marginLeft: 8,
    fontSize: 14,
    padding: 0,
  },
  subHeaderLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  quickChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  frequentChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  frequentChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  categoryGridItem: {
    width: "31%",
    height: 76,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    position: "relative",
  },
  categoryItemIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  categoryItemText: {
    fontSize: 11,
    textAlign: "center",
  },
  categoryCheckBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  sourceListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  sourceItemName: {
    fontSize: 15,
  },
  sourceItemSub: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  checkedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateBox: {
    alignItems: "center",
    paddingVertical: 30,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: "500",
  },

  /* Loan Modal Extras */
  loanTabsContainer: {
    flexDirection: "row",
    marginBottom: 12,
  },
  loanTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  loanListItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  loanItemTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  loanItemSub: {
    fontSize: 12,
    marginTop: 2,
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
