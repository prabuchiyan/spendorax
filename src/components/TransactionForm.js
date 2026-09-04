import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Text,
  Platform,
  BackHandler,
  ActivityIndicator,
} from "react-native";
import {
  createTransaction,
  createTransfer,
  getTransactions,
  getTransactionNoteSuggestions,
  updateTransaction,
  deleteTransaction,
} from "../services/transactions";
import {
  getLoans,
  linkTransactionToLoan,
  unlinkTransactionFromLoan,
} from "../services/loans";
import { getCategories } from "../services/categories";
import { getSources } from "../services/sources";
import {
  TextInput as PaperTextInput,
  Button as PaperButton,
  Chip,
  Snackbar,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import CategoryCreateModal from "./CategoryCreateModal";
import SourceCreateModal from "./SourceCreateModal";
import ConfirmDialog from "./ConfirmDialog";
import { Feather } from "@expo/vector-icons";
import LinkedBillCard from "./LinkedBillCard";
import { usePageLoader } from "../context/PageLoaderContext";
import { onCardTransactionChanged } from "../services/creditCardScheduler";

export default function TransactionForm({
  onCreated,
  onCancel,
  transaction,
  isEdit,
  onPressBill,
  sourceId: initialSourceId,
  categoryId: initialCategoryId,
}) {
  const { show: showPageLoader, hide: hidePageLoader } = usePageLoader();
  const [amount, setAmount] = useState(
    isEdit && transaction ? String(transaction.amount) : "",
  );
  const [amountError, setAmountError] = useState(false);
  const [type, setType] = useState(
    isEdit && transaction ? transaction.type : "expense",
  );
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [categoryUsage, setCategoryUsage] = useState({});
  const [sourceUsage, setSourceUsage] = useState({});
  const [categoryId, setCategoryId] = useState(
    isEdit && transaction
      ? transaction.category_id
      : (initialCategoryId ?? null),
  );
  const [sourceId, setSourceId] = useState(
    isEdit && transaction ? transaction.source_id : (initialSourceId ?? null),
  );
  const [date, setDate] = useState(
    isEdit && transaction ? transaction.date : new Date().toISOString(),
  );
  const [notes, setNotes] = useState(
    isEdit && transaction ? transaction.notes : "",
  );
  const [transferGroupId, setTransferGroupId] = useState(
    isEdit && transaction ? transaction.transfer_group_id : "",
  );
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showCategoryCreateModal, setShowCategoryCreateModal] = useState(false);
  const [pickerMode, setPickerMode] = useState("date");
  const [notesError, setNotesError] = useState(false);
  const [toAccount, setToAccount] = useState(null);
  const [selectingFor, setSelectingFor] = useState("from");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [noteSuggestions, setNoteSuggestions] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCategoryGrid, setShowCategoryGrid] = useState(
    !((isEdit && transaction?.category_id) || (!isEdit && initialCategoryId)),
  );
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const categorySearchRef = useRef(null);
  const [showSourceGrid, setShowSourceGrid] = useState(
    !((isEdit && transaction?.source_id) || (!isEdit && initialSourceId)),
  );
  const [showToAccountGrid, setShowToAccountGrid] = useState(true);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceSearch, setSourceSearch] = useState("");
  const sourceSearchRef = useRef(null);
  const [showSourceCreateModal, setShowSourceCreateModal] = useState(false);
  const [loansList, setLoansList] = useState([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState(
    isEdit && transaction ? transaction.loan_id : null,
  );
  const [linking, setLinking] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loanSearch, setLoanSearch] = useState("");
  const [pendingLoan, setPendingLoan] = useState(null);
  const [showLoanActionSheet, setShowLoanActionSheet] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [isCounted, setIsCounted] = useState(
    isEdit && transaction
      ? transaction.is_counted !== undefined
        ? Boolean(transaction.is_counted)
        : true
      : true,
  );

  function markDirty() {
    setIsDirty(true);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        /* Categories and sources are required for the initial form,
         * so load them together instead of waiting for one after another. */
        const [cats, src] = await Promise.all([
          getCategories(true),
          getSources(true),
        ]);
        if (cancelled) return;
        setCategories(cats || []);
        setSources(src || []);
        /* Everything below is secondary data.
         * It is intentionally loaded after the form's primary data has been rendered
         * so opening Add Transaction does not wait for transaction history, notes or loans. */

        // CATEGORY / SOURCE USAGE
        getTransactions(1000000, "Yes")
          .then((transactions) => {
            if (cancelled) return;
            const categoryCount = {};
            const sourceCount = {};
            (transactions || []).forEach((txn) => {
              // Category usage
              if (txn.category_id && txn.type !== "transfer") {
                const categoryKey = String(txn.category_id);
                categoryCount[categoryKey] =
                  (categoryCount[categoryKey] || 0) + 1;
              }
              // Source usage
              if (txn.source_id) {
                const sourceKey = String(txn.source_id);
                sourceCount[sourceKey] = (sourceCount[sourceKey] || 0) + 1;
              }
            });
            setCategoryUsage(categoryCount);
            setSourceUsage(sourceCount);
          })
          .catch((usageError) => {
            console.warn(
              "Unable to calculate category/source usage:",
              usageError,
            );
            if (cancelled) return;
            setCategoryUsage({});
            setSourceUsage({});
          });
        //NOTE SUGGESTIONS
        getTransactionNoteSuggestions()
          .then((notes) => {
            if (cancelled) return;
            setNoteSuggestions(notes || []);
          })
          .catch((error) => {
            console.warn("Unable to load transaction note suggestions:", error);
            if (cancelled) return;
            setNoteSuggestions([]);
          });
        // LOANS
        getLoans()
          .then((lns) => {
            if (cancelled) return;
            setLoansList(lns || []);
          })
          .catch((error) => {
            console.warn("Unable to load loans:", error);
            if (cancelled) return;
            setLoansList([]);
          });
      } catch (error) {
        if (cancelled) return;
        console.warn("TransactionForm initial load failed:", error);
      }
    }
    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (categories.length === 0) return;
    if (type === "transfer") {
      setCategoryId(null);
      return;
    }
    // Preserve category while editing.
    // User can choose another category manually.
    if (isEdit) return;
    const exists = categories.some(
      (c) => c.id === categoryId && c.type === type,
    );
    if (!exists) {
      setCategoryId(null);
    }
  }, [type, categories, isEdit]);

  useEffect(() => {
    if (showCategoryModal) {
      setTimeout(() => {
        categorySearchRef.current?.focus();
      }, 250);
    }
  }, [showCategoryModal]);

  useEffect(() => {
    if (showSourceModal) {
      setTimeout(() => {
        sourceSearchRef.current?.focus();
      }, 250);
    }
  }, [showSourceModal]);

  useEffect(() => {
    if (isEdit && transaction?.category_id) {
      setCategoryId(transaction.category_id);
      setShowCategoryGrid(false);
    }
    if (isEdit && transaction?.source_id) {
      setSourceId(transaction.source_id);
      setShowSourceGrid(false);
    }
  }, [isEdit, transaction]);

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

  async function submit() {
    if (submitting) return; // guard against double taps while a save is in flight
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val === 0) {
      setAmountError(true);
      return;
    }
    // Category is mandatory only while creating a new transaction
    if (!isEdit && !categoryId && type !== "transfer") {
      setSnackbarMsg("Please select a category.");
      setSnackbarVisible(true);
      return;
    }
    if (!sourceId) {
      setSnackbarMsg("Please select a source.");
      setSnackbarVisible(true);
      return;
    }
    if (!notes.trim()) {
      setNotesError(true);
      return;
    }

    setSubmitting(true);
    // Give React Native one frame to render the loading spinner
    await new Promise((resolve) => requestAnimationFrame(resolve));

    let id;
    try {
      if (type === "transfer") {
        if (!sourceId || !toAccount) {
          setSnackbarMsg("Select both accounts");
          setSnackbarVisible(true);
          return;
        }
        if (sourceId === toAccount) {
          setSnackbarMsg("Cannot transfer to same account");
          setSnackbarVisible(true);
          return;
        }
        try {
          await createTransfer({
            fromAccount: sourceId,
            toAccount,
            amount: val,
            note: notes,
            date,
          });
        } catch (e) {
          console.log(e);
          setSnackbarMsg(e?.message || "Operation failed");
          setSnackbarVisible(true);
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
          notes,
          is_counted: isCounted ? 1 : 0,
        };
        try {
          if (isEdit && transaction && transaction.id) {
            id = await updateTransaction(transaction.id, transactionData);

            // Handle loan link changes
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
          } else {
            id = await createTransaction(transactionData);
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
          }
        } catch (e) {
          console.log(e);
          setSnackbarMsg(e?.message || "Operation failed");
          setSnackbarVisible(true);
          return;
        }
      }
      // AFTER — add this block immediately after the type === 'transfer' / else block resolves,
      // just before setIsDirty(false):
      // Notify credit card scheduler if this source belongs to a card
      try {
        const affectedSourceId = type === "transfer" ? sourceId : sourceId;
        await onCardTransactionChanged(affectedSourceId);
        // For transfers, the destination may also be a credit card source
        if (type === "transfer" && toAccount) {
          await onCardTransactionChanged(toAccount);
        }
      } catch (e) {
        // Non-critical — don't block save
        console.warn("[TransactionForm] onCardTransactionChanged failed:", e);
      }
      setIsDirty(false);
      if (onCreated) onCreated(id);
      if (!isEdit) {
        // Only reset form if it was a new transaction
        setAmount("");
        setNotes("");
        setDate(new Date().toISOString());
        setTransferGroupId("");
      }
      setAmountError(false);
      setNotesError(false);

      // Close the form now that the save has completed successfully.
      if (onCancel) onCancel();
    } finally {
      setSubmitting(false);
    }
  }

  const handleDelete = async () => {
    await deleteTransaction(transaction.id);
    // Notify scheduler — deleted transaction may affect a credit card statement
    try {
      if (transaction.source_id) {
        await onCardTransactionChanged(transaction.source_id);
      }
    } catch (e) {
      console.warn(
        "[TransactionForm] onCardTransactionChanged on delete failed:",
        e,
      );
    }
    setConfirmVisible(false);
    onCancel?.();
  };

  function formatDateTime(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    const day = d.getDate();
    const month = d.toLocaleString("en-IN", { month: "short" }); // Jun
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  }

  const handleNotesChange = (text) => {
    setNotes(text);
    setNotesError(false);
    markDirty();
    if (!text.trim()) {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const searchText = text.toLowerCase();
    const matches = noteSuggestions.filter((item) => {
      const category = categories.find((c) => c.id === item.category_id);
      return (
        item.notes.toLowerCase().includes(searchText) &&
        // Match selected transaction type
        (category?.type === type ||
          // Include suggestions that don't have a category
          !item.category_id)
      );
    });
    setFilteredSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  };

  // CATEGORIES
  // Most-used categories come first.
  // Usage = number of transactions.
  const filteredCategories = categories
    .filter((c) => {
      if (type === "transfer") {
        return false;
      }
      return c.type === type;
    })
    .sort((a, b) => {
      const usageA = Number(categoryUsage[String(a.id)] || 0);
      const usageB = Number(categoryUsage[String(b.id)] || 0);
      // Most used first
      if (usageA !== usageB) {
        return usageB - usageA;
      }
      // If usage is same, keep original ID order
      return Number(a.id) - Number(b.id);
    });

  const visibleCategories = filteredCategories.slice(0, 8);
  const searchedCategories = filteredCategories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase()),
  );

  // SOURCES
  // Most-used sources come first.
  // Usage = number of transactions.

  const sortedSources = sources
    .filter((s) => s.is_active === undefined || s.is_active)
    .sort((a, b) => {
      const usageA = Number(sourceUsage[String(a.id)] || 0);
      const usageB = Number(sourceUsage[String(b.id)] || 0);
      // Most used first
      if (usageA !== usageB) {
        return usageB - usageA;
      }
      // If usage is same, keep original ID order
      return Number(a.id) - Number(b.id);
    });

  const searchedSources = sortedSources.filter((s) =>
    s.name.toLowerCase().includes(sourceSearch.toLowerCase()),
  );

  // TO ACCOUNT SOURCES
  // Exclude the selected "From" source BEFORE taking
  // the first 4 sources.
  // This ensures To Account always shows 4 sources
  // whenever at least 4 valid alternatives exist.
  const toAccountSources = searchedSources.filter((s) => s.id !== sourceId);
  const visibleToAccountSources = toAccountSources.slice(0, 4);
  const visibleSources = searchedSources.slice(0, 4);
  const accent = type === "expense" ? "#E46A6A" : type === "income" ? "#36B37E" : "#000";
  const activeLoans = loansList.filter(
    (loan) => String(loan.status || "").toLowerCase() === "active",
  );

  const filteredLoans = [...activeLoans]
    .sort((a, b) => b.id - a.id)
    .filter(
      (l) =>
        (l.loan_name || "").toLowerCase().includes(loanSearch.toLowerCase()) ||
        (l.lender || "").toLowerCase().includes(loanSearch.toLowerCase()) ||
        (l.loan_type || "").toLowerCase().includes(loanSearch.toLowerCase()),
    );

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <View style={{ borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
        <View
          style={{
            backgroundColor:
              type === "expense"
                ? "#FFF2F2"
                : type === "income"
                  ? "#F1FFF6"
                  : "#F5F5F5",
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text
              style={{
                color: accent,
                fontSize: 14,
                fontWeight: "700",
                textTransform: "uppercase",
              }}
            >
              {type || "expense"}
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: accent }}>
              {amount
                ? Number(amount).toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })
                : "0.00"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ alignItems: "center", marginRight: 12 }}>
              <MaterialCommunityIcons
                name={
                  type === "transfer"
                    ? "currency-inr"
                    : (categories.find((x) => x.id === categoryId) || {})
                      .icon || "currency-inr"
                }
                size={26}
                color={
                  (categories.find((x) => x.id === categoryId) || {}).color ||
                  "#4B7CF3"
                }
              />
              <Text style={{ fontSize: 12 }}>
                {type === "transfer"
                  ? "Uncategorized"
                  : (categories.find((x) => x.id === categoryId) || {}).name ||
                  "Uncategorized"}
              </Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <MaterialCommunityIcons
                name={
                  (sources.find((x) => x.id === sourceId) || {}).icon || "cash"
                }
                size={26}
                color={
                  (sources.find((x) => x.id === sourceId) || {}).color ||
                  "#4B7CF3"
                }
              />
              <Text style={{ fontSize: 12 }}>
                {(sources.find((x) => x.id === sourceId) || {}).name ||
                  "Select Source"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Chip
            mode="outlined"
            selected={type === "expense"}
            showSelectedCheck={false}
            onPress={() => {
              setType("expense");
              markDirty();
            }}
            disabled={submitting}
            style={{
              marginRight: 8,
              borderColor: type === "expense" ? accent : undefined,
            }}
          >
            Expense
          </Chip>

          <Chip
            mode="outlined"
            selected={type === "income"}
            showSelectedCheck={false}
            onPress={() => {
              setType("income");
              markDirty();
            }}
            disabled={submitting}
            style={{
              marginRight: 8,
              borderColor: type === "income" ? accent : undefined,
            }}
          >
            Income
          </Chip>

          {!isEdit && (
            <Chip
              mode="outlined"
              selected={type === "transfer"}
              showSelectedCheck={false}
              onPress={() => {
                setType("transfer");
                markDirty();
              }}
              disabled={submitting}
              style={{
                borderColor: type === "transfer" ? "#000" : undefined,
              }}
              textStyle={{
                color: type === "transfer" ? "#000" : undefined,
                fontWeight: type === "transfer" ? "700" : "normal",
              }}
            >
              Transfer
            </Chip>
          )}
        </View>

        {isEdit && (
          <TouchableOpacity
            onPress={() => setConfirmVisible(true)}
            disabled={submitting}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#E46A6A",
              justifyContent: "center",
              alignItems: "center",
              opacity: submitting ? 0.5 : 1,
            }}
          >
            <Feather name="trash-2" size={20} color="#E46A6A" />
          </TouchableOpacity>
        )}
      </View>

      <PaperTextInput
        label="Amount"
        value={amount}
        onChangeText={(t) => {
          setAmount(t);
          if (amountError) setAmountError(false);
          markDirty();
        }}
        keyboardType="numeric"
        mode="outlined"
        style={{ marginBottom: 12 }}
        error={amountError}
        contentStyle={{ fontSize: 24 }}
        editable={!submitting}
      />
      {amountError ? (
        <Text style={{ color: "#E46A6A", marginBottom: 8 }}>
          Enter an amount greater than 0
        </Text>
      ) : null}

      <View
        style={{
          position: "relative",
          marginBottom: 12,
          zIndex: 999,
        }}
      >
        <PaperTextInput
          label={
            type === "expense"
              ? "Where did you spend?"
              : type === "income"
                ? "How did you get this money?"
                : "Where do you want to transfer?"
          }
          value={notes}
          onChangeText={handleNotesChange}
          mode="outlined"
          error={notesError}
          autoCorrect={false}
          autoCapitalize="sentences"
          editable={!submitting}
          right={
            notes.length > 0 ? (
              <PaperTextInput.Icon
                icon="close-circle-outline"
                onPress={() => {
                  setNotes("");
                  setFilteredSuggestions([]);
                  setShowSuggestions(false);
                  setNotesError(false);
                }}
                forceTextInputFocus={false}
              />
            ) : null
          }
        />

        {showSuggestions && (
          <View
            style={{
              position: "absolute",
              top: 62, // Immediately below the TextInput
              left: 0,
              right: 0,
              backgroundColor: "#fff",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#E6EAF2",
              maxHeight: 220,
              zIndex: 9999,
              elevation: 10,
            }}
          >
            <FlatList
              data={filteredSuggestions}
              keyExtractor={(item, index) => `${item.notes}-${index}`}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              persistentScrollbar
              style={{ maxHeight: 220 }}
              renderItem={({ item }) => {
                const category = categories.find(
                  (c) => c.id === item.category_id,
                );
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setNotes(item.notes);

                      if (category) {
                        setCategoryId(category.id);
                        setShowCategoryGrid(false);
                      }

                      setShowSuggestions(false);
                      setFilteredSuggestions([]);
                      setNotesError(false);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: "#F2F2F2",
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: category?.color || "#4B7CF3",
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 12,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={category?.icon || "tag"}
                        size={18}
                        color="#fff"
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "600",
                          color: "#222",
                        }}
                      >
                        {item.notes}
                      </Text>

                      {category && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#777",
                            marginTop: 2,
                          }}
                        >
                          {category.name}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </View>

      <View style={{ marginBottom: 12 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={submitting}
          onPress={() => {
            setPickerMode("date");
            setShowDateTimePicker(true);
          }}
        >
          <PaperTextInput
            label="Date & Time"
            value={formatDateTime(date)}
            editable={false}
            pointerEvents="none"
            mode="outlined"
            style={{ marginBottom: 8 }}
            right={
              <PaperTextInput.Icon
                icon="calendar"
                onPress={() => {
                  setPickerMode("date");
                  setShowDateTimePicker(true);
                }}
              />
            }
          />
        </TouchableOpacity>
      </View>

      {type !== "transfer" && (
        <View style={{ marginBottom: 12 }}>
          {!transferGroupId && (
            <>
              <Text style={{ marginBottom: 6, color: "#666" }}>Category</Text>

              {showCategoryGrid ? (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      rowGap: 8,
                      marginTop: 8,
                    }}
                  >
                    {visibleCategories.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        disabled={submitting}
                        onPress={() => {
                          setCategoryId(c.id);
                          setShowCategoryModal(false);
                          setShowCategoryGrid(false);
                          setCategorySearch("");
                          markDirty();
                        }}
                        style={{
                          width: "23%",
                          height: 72,
                          borderRadius: 10,
                          marginBottom: 8,
                          backgroundColor: c.color || "#4B7CF3",
                          justifyContent: "center",
                          alignItems: "center",
                          paddingHorizontal: 4,
                          paddingVertical: 6,
                          borderColor: "#111",
                        }}
                      >
                        <MaterialCommunityIcons
                          name={c.icon || "tag"}
                          size={18}
                          color="#fff"
                        />

                        {categoryId === c.id && (
                          <View
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              backgroundColor: "#fff",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <MaterialCommunityIcons
                              name="check"
                              size={12}
                              color="#2E7D32"
                            />
                          </View>
                        )}
                        <Text
                          numberOfLines={2}
                          style={{
                            color: "#fff",
                            textAlign: "center",
                            marginTop: 6,
                            fontWeight: "600",
                            fontSize: 12,
                            lineHeight: 16,
                          }}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowCategoryModal(true)}
                  activeOpacity={0.85}
                  disabled={submitting}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "#E6EAF2",
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    elevation: 2,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor:
                          categories.find((x) => x.id === categoryId)?.color ||
                          "#4B7CF3",
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 12,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={
                          categories.find((x) => x.id === categoryId)?.icon ||
                          "tag"
                        }
                        size={22}
                        color="#fff"
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          color: "#888",
                        }}
                      >
                        Selected Category
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: "#222",
                        }}
                      >
                        {categories.find((x) => x.id === categoryId)?.name}
                      </Text>
                    </View>

                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={22}
                      color="#4B7CF3"
                    />
                  </View>
                </TouchableOpacity>
              )}

              {showCategoryGrid && filteredCategories.length > 12 && (
                <TouchableOpacity
                  disabled={submitting}
                  onPress={() => {
                    setCategorySearch("");
                    setShowCategoryModal(true);
                  }}
                  style={{
                    alignItems: "center",
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#4B7CF3",
                      fontWeight: "700",
                    }}
                  >
                    See More
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            marginBottom: 8,
            color: "#666",
          }}
        >
          Payment Source
        </Text>
        {showSourceGrid ? (
          <>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "flex-start",
                marginTop: 8,
              }}
            >
              {visibleSources.map((s, index) => (
                <TouchableOpacity
                  key={s.id}
                  disabled={submitting}
                  onPress={() => {
                    setSourceId(s.id);
                    setShowSourceGrid(false);
                    setSourceSearch("");
                    markDirty();
                  }}
                  style={{
                    width: "23%",
                    height: 72,
                    marginBottom: 8,
                    marginRight: (index + 1) % 4 === 0 ? 0 : "2.66%",
                    borderRadius: 10,
                    backgroundColor: s.color || "#4B7CF3",
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 4,
                    paddingVertical: 6,
                    borderColor: "#111",
                    transform: [
                      {
                        scale: sourceId === s.id ? 1.05 : 1,
                      },
                    ],
                  }}
                >
                  <MaterialCommunityIcons
                    name={s.icon || "cash"}
                    size={18}
                    color="#fff"
                  />
                  {sourceId === s.id && (
                    <View
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: "#fff",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <MaterialCommunityIcons
                        name="check"
                        size={12}
                        color="#2E7D32"
                      />
                    </View>
                  )}

                  <Text
                    numberOfLines={2}
                    style={{
                      color: "#fff",
                      textAlign: "center",
                      marginTop: 6,
                      fontWeight: "600",
                      fontSize: 12,
                      lineHeight: 16,
                    }}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {searchedSources.length > 4 && (
              <TouchableOpacity
                disabled={submitting}
                onPress={() => {
                  setSourceSearch("");
                  setShowSourceModal(true);
                }}
                style={{
                  alignItems: "center",
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: "#4B7CF3",
                    fontWeight: "700",
                  }}
                >
                  See More
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <TouchableOpacity
            disabled={submitting}
            onPress={() => {
              setSourceSearch("");
              setShowSourceModal(true);
            }}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#fff",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#E6EAF2",
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              elevation: 2,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor:
                    sources.find((x) => x.id === sourceId)?.color || "#4B7CF3",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                <MaterialCommunityIcons
                  name={sources.find((x) => x.id === sourceId)?.icon || "cash"}
                  size={22}
                  color="#fff"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: "#888",
                  }}
                >
                  Selected Source
                </Text>

                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: "#222",
                  }}
                >
                  {sources.find((x) => x.id === sourceId)?.name}
                </Text>
              </View>

              <MaterialCommunityIcons
                name="pencil-outline"
                size={22}
                color="#4B7CF3"
              />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Loan Payment */}
      {activeLoans.length > 0 && type !== "transfer" && (
        <View style={{ marginBottom: 18 }}>
          <Text style={{ marginBottom: 8, color: "#666" }}>
            Link to Loan (Optional)
          </Text>
          {!selectedLoanId ? (
            <TouchableOpacity
              disabled={submitting}
              activeOpacity={0.85}
              onPress={() => {
                setLoanSearch("");
                setShowLoanModal(true);
              }}
              style={{
                backgroundColor: "#EEF4FF",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#4B7CF3",
                padding: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 27,
                    backgroundColor: "#4B7CF3",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 14,
                  }}
                >
                  <MaterialCommunityIcons
                    name="bank-outline"
                    size={28}
                    color="#fff"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: "#222" }}>
                    Link to Loan
                  </Text>
                  <Text style={{ color: "#666", marginTop: 3, lineHeight: 20 }}>
                    {type === "expense"
                      ? "Counts as EMI / prepayment on a borrowed loan, or lending more on a lent loan"
                      : "Counts as a top-up on a borrowed loan, or repayment received on a lent loan"}
                  </Text>
                </View>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={28}
                  color="#4B7CF3"
                />
              </View>
            </TouchableOpacity>
          ) : (
            (() => {
              const loan = activeLoans.find((l) => l.id === selectedLoanId);
              // Safety check:
              // If the selected loan is no longer active, don't display the linked loan card.
              if (!loan) {
                return null;
              }
              // Derive the effect label from loan direction + transaction type
              const loanDir = (loan?.loan_direction || "BORROWED").toUpperCase();
              const isLentLoan = loanDir === "LENT";

              // effect: what this transaction means for the loan
              const effectLabel = (() => {
                if (type === "expense") {
                  return isLentLoan ? "Lend More (increases outstanding)" : "EMI / Payment (reduces outstanding)";
                }
                // income
                return isLentLoan ? "Repayment Received (reduces outstanding)" : "Top Up (increases outstanding)";
              })();

              const effectColor = (() => {
                if (type === "expense") {
                  return isLentLoan ? "#7C3AED" : "#16A34A";
                }
                return isLentLoan ? "#16A34A" : "#7C3AED";
              })();

              const effectIcon = (() => {
                if (type === "expense") {
                  return isLentLoan ? "cash-plus" : "cash-minus";
                }
                return isLentLoan ? "cash-check" : "bank-plus";
              })();

              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={{
                    backgroundColor: "#F4FFF7",
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "#36B37E",
                    padding: 16,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 54,
                        height: 54,
                        borderRadius: 27,
                        backgroundColor: "#36B37E",
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 14,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="bank-check"
                        size={28}
                        color="#fff"
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontWeight: "700", color: "#222" }}>
                        {loan?.loan_name}
                      </Text>

                      <Text style={{ marginTop: 3, color: "#666" }}>
                        Outstanding ₹
                        {Number(loan?.outstanding_amount || 0).toLocaleString("en-IN")}
                      </Text>

                      {/* Effect indicator */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: 8,
                          backgroundColor: effectColor + "15",
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 5,
                          alignSelf: "flex-start",
                        }}
                      >
                        <MaterialCommunityIcons
                          name={effectIcon}
                          size={14}
                          color={effectColor}
                        />
                        <Text
                          style={{
                            marginLeft: 5,
                            fontSize: 12,
                            fontWeight: "700",
                            color: effectColor,
                          }}
                        >
                          {effectLabel}
                        </Text>
                      </View>

                      <Text style={{ marginTop: 6, color: "#36B37E", fontWeight: "700" }}>
                        ✓ Linked
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "flex-end",
                      marginTop: 14,
                    }}
                  >
                    <PaperButton
                      compact
                      onPress={() => {
                        setLoanSearch("");
                        setShowLoanModal(true);
                      }}
                      disabled={submitting}
                    >
                      Change
                    </PaperButton>

                    {isEdit ? (
                      <PaperButton
                        compact
                        textColor="#E46A6A"
                        disabled={linking || submitting}
                        onPress={async () => {
                          if (linking || submitting || !transaction?.id) return;
                          try {
                            setLinking(true);
                            // Show global loader because Unlink is outside the loan modal
                            showPageLoader();
                            await unlinkTransactionFromLoan(transaction.id);
                            setSelectedLoanId(null);
                            setLoanSearch("");
                            setSnackbarMsg("Transaction unlinked");
                            setSnackbarVisible(true);
                          } catch (e) {
                            console.error(
                              "[TransactionForm] Unlink loan failed:",
                              e,
                            );
                            setSnackbarMsg(
                              e?.message ||
                              "Failed to unlink transaction from loan",
                            );
                            setSnackbarVisible(true);
                          } finally {
                            setLinking(false);
                            hidePageLoader();
                          }
                        }}
                      >
                        Unlink
                      </PaperButton>
                    ) : (
                      <PaperButton
                        compact
                        textColor="#E46A6A"
                        disabled={submitting}
                        onPress={() => {
                          setSelectedLoanId(null);
                          markDirty();
                        }}
                      >
                        Clear
                      </PaperButton>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })()
          )}
        </View>
      )}

      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View
          style={{
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <View
            style={{
              width: 42,
              height: 5,
              borderRadius: 3,
              backgroundColor: "#D8D8D8",
            }}
          />
        </View>
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
              padding: 16,
              height: "85%",
              paddingBottom: 20,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                }}
              >
                Select Category
              </Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <PaperTextInput
              ref={categorySearchRef}
              label="Search category"
              value={categorySearch}
              onChangeText={setCategorySearch}
              mode="outlined"
              left={<PaperTextInput.Icon icon="magnify" />}
              style={{ marginBottom: 16 }}
            />

            <Text
              style={{
                marginBottom: 10,
                color: "#666",
                fontSize: 13,
              }}
            >
              {searchedCategories.length} Categories
            </Text>

            <View style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 90 }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "flex-start",
                  }}
                >
                  {searchedCategories.map((c, index) => (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => {
                        setCategoryId(c.id);
                        setCategorySearch("");
                        setShowCategoryModal(false);
                        setShowCategoryGrid(false);
                        markDirty();
                      }}
                      activeOpacity={0.8}
                      style={{
                        width: "23%",
                        height: 72,
                        marginBottom: 10,
                        marginRight: (index + 1) % 4 === 0 ? 0 : "2.66%",
                        borderRadius: 10,
                        backgroundColor: c.color || "#4B7CF3",
                        justifyContent: "center",
                        alignItems: "center",
                        paddingHorizontal: 4,
                        paddingVertical: 6,
                        borderColor: "#111",
                      }}
                    >
                      <MaterialCommunityIcons
                        name={c.icon || "tag"}
                        size={18}
                        color="#fff"
                      />
                      {categoryId === c.id && (
                        <View
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: "#fff",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <MaterialCommunityIcons
                            name="check"
                            size={12}
                            color="#2E7D32"
                          />
                        </View>
                      )}

                      <Text
                        numberOfLines={2}
                        style={{
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: "600",
                          textAlign: "center",
                          marginTop: 4,
                          lineHeight: 12,
                        }}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {searchedCategories.length === 0 && (
                  <Text
                    style={{
                      textAlign: "center",
                      color: "#999",
                      marginVertical: 30,
                    }}
                  >
                    No categories found
                  </Text>
                )}
              </ScrollView>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setCategorySearch("");
              setShowCategoryModal(false);
              setShowCategoryCreateModal(true);
            }}
            style={{
              position: "absolute",
              right: 20,
              bottom: 20,
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: accent,
              justifyContent: "center",
              alignItems: "center",
              elevation: 8,
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 6,
              shadowOffset: {
                width: 0,
                height: 3,
              },
            }}
          >
            <MaterialCommunityIcons name="plus" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        visible={showSourceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSourceModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(69, 48, 48, 0.45)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
              height: "85%",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "700",
                }}
              >
                Select Payment Source
              </Text>
              <TouchableOpacity onPress={() => setShowSourceModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <PaperTextInput
              ref={sourceSearchRef}
              label="Search Source"
              value={sourceSearch}
              onChangeText={setSourceSearch}
              mode="outlined"
              left={<PaperTextInput.Icon icon="magnify" />}
              style={{ marginBottom: 12 }}
            />

            <Text
              style={{
                color: "#666",
                marginBottom: 12,
              }}
            >
              {searchedSources.length} Sources
            </Text>

            <View style={{ flex: 1 }}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  paddingBottom: 100,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "flex-start",
                  }}
                >
                  {searchedSources.map((s, index) => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => {
                        if (selectingFor === "from") {
                          setSourceId(s.id);
                          setShowSourceGrid(false);
                        } else {
                          setToAccount(s.id);
                          setShowToAccountGrid(false);
                        }
                        setSourceSearch("");
                        setShowSourceModal(false);
                        markDirty();
                      }}
                      activeOpacity={0.8}
                      style={{
                        width: "23%",
                        height: 72,
                        marginBottom: 10,
                        marginRight: (index + 1) % 4 === 0 ? 0 : "2.66%",
                        borderRadius: 10,
                        backgroundColor: s.color || accent,
                        justifyContent: "center",
                        alignItems: "center",
                        paddingHorizontal: 4,
                        paddingVertical: 6,
                        borderColor: "#111",
                      }}
                    >
                      <MaterialCommunityIcons
                        name={s.icon || "cash"}
                        size={18}
                        color="#fff"
                      />

                      {sourceId === s.id && (
                        <View
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: "#fff",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <MaterialCommunityIcons
                            name="check"
                            size={12}
                            color="#2E7D32"
                          />
                        </View>
                      )}

                      <Text
                        numberOfLines={2}
                        style={{
                          color: "#fff",
                          textAlign: "center",
                          marginTop: 6,
                          fontWeight: "600",
                          fontSize: 12,
                          lineHeight: 16,
                        }}
                      >
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              {searchedSources.length === 0 && (
                <Text
                  style={{
                    textAlign: "center",
                    color: "#999",
                    marginTop: 30,
                  }}
                >
                  No payment sources found
                </Text>
              )}
            </View>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            setSourceSearch("");
            setShowSourceModal(false);
            setShowSourceCreateModal(true);
          }}
          style={{
            position: "absolute",
            right: 20,
            bottom: 20,
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: accent,
            justifyContent: "center",
            alignItems: "center",
            elevation: 8,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 6,
            shadowOffset: {
              width: 0,
              height: 3,
            },
          }}
        >
          <MaterialCommunityIcons name="plus" size={30} color="#fff" />
        </TouchableOpacity>
      </Modal>

      {type === "transfer" && (
        <View style={{ marginBottom: 12 }}>
          <Text
            style={{
              marginBottom: 8,
              color: "#666",
            }}
          >
            To Account
          </Text>

          {showToAccountGrid ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "flex-start",
                  marginTop: 8,
                }}
              >
                {visibleToAccountSources.map((s, index) => (
                  <TouchableOpacity
                    key={s.id}
                    disabled={submitting}
                    onPress={() => {
                      setToAccount(s.id);
                      setShowToAccountGrid(false);
                      setSourceSearch("");
                      markDirty();
                    }}
                    style={{
                      width: "23%",
                      height: 72,
                      marginBottom: 8,
                      marginRight: (index + 1) % 4 === 0 ? 0 : "2.66%",
                      borderRadius: 10,
                      backgroundColor: s.color || "#4B7CF3",
                      justifyContent: "center",
                      alignItems: "center",
                      paddingHorizontal: 4,
                      paddingVertical: 6,
                      transform: [
                        {
                          scale: toAccount === s.id ? 1.05 : 1,
                        },
                      ],
                    }}
                  >
                    <MaterialCommunityIcons
                      name={s.icon || "cash"}
                      size={18}
                      color="#fff"
                    />

                    {toAccount === s.id && (
                      <View
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: "#fff",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <MaterialCommunityIcons
                          name="check"
                          size={12}
                          color="#2E7D32"
                        />
                      </View>
                    )}

                    <Text
                      numberOfLines={2}
                      style={{
                        color: "#fff",
                        textAlign: "center",
                        marginTop: 6,
                        fontWeight: "600",
                        fontSize: 12,
                        lineHeight: 16,
                      }}
                    >
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {toAccountSources.length > 4 && (
                <TouchableOpacity
                  disabled={submitting}
                  onPress={() => {
                    setSelectingFor("to");
                    setSourceSearch("");
                    setShowSourceModal(true);
                  }}
                  style={{
                    alignItems: "center",
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#4B7CF3",
                      fontWeight: "700",
                    }}
                  >
                    See More
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity
              disabled={submitting}
              onPress={() => {
                setSelectingFor("to");
                setSourceSearch("");
                setShowSourceModal(true);
              }}
              activeOpacity={0.85}
              style={{
                backgroundColor: "#fff",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#E6EAF2",
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                elevation: 2,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flex: 1,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor:
                      sources.find((x) => x.id === toAccount)?.color ||
                      "#4B7CF3",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 12,
                  }}
                >
                  <MaterialCommunityIcons
                    name={
                      sources.find((x) => x.id === toAccount)?.icon || "cash"
                    }
                    size={22}
                    color="#fff"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#888",
                    }}
                  >
                    Destination Account
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: "#222",
                    }}
                  >
                    {sources.find((x) => x.id === toAccount)?.name}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={22}
                  color="#4B7CF3"
                />
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isEdit && transaction?.id && (
        <LinkedBillCard
          transactionId={transaction.id}
          onPressBill={onPressBill}
        />
      )}

      {/* is_counted toggle — only for expense and income, not transfer */}
      {type !== "transfer" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 10,
            marginBottom: 4,
            paddingHorizontal: 2,
          }}
        >
          <TouchableOpacity
            disabled={submitting}
            onPress={() => {
              setIsCounted((v) => !v);
              markDirty();
            }}
            activeOpacity={0.8}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isCounted
                ? type === "expense"
                  ? "#FFF2F2"
                  : "#F1FFF6"
                : "#F3F4F6",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: isCounted
                ? type === "expense"
                  ? "#E46A6A"
                  : "#36B37E"
                : "#D1D5DB",
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}
          >
            {/* Toggle track */}
            <View
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                backgroundColor: isCounted
                  ? type === "expense"
                    ? "#E46A6A"
                    : "#36B37E"
                  : "#D1D5DB",
                justifyContent: "center",
                paddingHorizontal: 2,
                marginRight: 10,
              }}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: "#fff",
                  alignSelf: isCounted ? "flex-end" : "flex-start",
                }}
              />
            </View>
            {/* Full-width text area */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: "#222",
                }}
              >
                {type === "expense"
                  ? isCounted
                    ? "Spend"
                    : "Not a Spend"
                  : isCounted
                    ? "Income"
                    : "Not a Income"}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: "#888",
                  marginTop: 1,
                }}
              >
                {isCounted
                  ? "Included in everywhere"
                  : "Excluded from everywhere"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      <View
        style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}
      >
        <PaperButton
          mode="contained"
          onPress={submit}
          loading={submitting}
          disabled={submitting}
          style={{ backgroundColor: accent }}
          labelStyle={{ color: "#fff" }}
        >
          {submitting
            ? isEdit
              ? "Updating..."
              : "Saving..."
            : isEdit
              ? "Update"
              : "Save"}
        </PaperButton>
        <View style={{ width: 12 }} />
        <PaperButton
          mode="outlined"
          disabled={submitting}
          onPress={() => {
            if (isDirty) {
              setShowUnsavedDialog(true);
            } else {
              if (onCancel) onCancel();
              else {
                setAmount("");
                setNotes("");
              }
            }
          }}
        >
          Cancel
        </PaperButton>
        <View style={{ width: 12 }} />
      </View>

      {/* Date & Time Picker */}
      {showDateTimePicker &&
        (() => {
          // Native picker for Android / iOS
          if (Platform.OS === "android") {
            try {
              // eslint-disable-next-line global-require
              const DateTimePicker =
                require("@react-native-community/datetimepicker").default;
              return (
                <DateTimePicker
                  value={new Date(date)}
                  mode={pickerMode}
                  display={pickerMode === "date" ? "calendar" : "clock"}
                  is24Hour={false}
                  onChange={(event, selected) => {
                    // User pressed Android Cancel
                    if (event.type === "dismissed") {
                      setShowDateTimePicker(false);
                      setPickerMode("date");
                      return;
                    }
                    if (!selected) {
                      return;
                    }
                    /* DATE */
                    if (pickerMode === "date") {
                      const existingDate = new Date(date);
                      const newDate = new Date(selected);
                      // Preserve existing time
                      newDate.setHours(
                        existingDate.getHours(),
                        existingDate.getMinutes(),
                        existingDate.getSeconds(),
                        0,
                      );
                      setDate(newDate.toISOString());
                      /* Close date picker.
                       * Then open Android's native time picker.
                       * No React Native Modal is involved. */
                      setShowDateTimePicker(false);
                      setTimeout(() => {
                        setPickerMode("time");
                        setShowDateTimePicker(true);
                      }, 250);
                      return;
                    }
                    /* TIME */
                    if (pickerMode === "time") {
                      const newDate = new Date(date);
                      newDate.setHours(
                        selected.getHours(),
                        selected.getMinutes(),
                        0,
                        0,
                      );
                      setDate(newDate.toISOString());
                      setShowDateTimePicker(false);
                      setPickerMode("date");
                      markDirty();
                    }
                  }}
                />
              );
            } catch (e) {
              console.warn(
                "[TransactionForm] Android DateTimePicker unavailable:",
                e,
              );
              setShowDateTimePicker(false);
              return null;
            }
          }
          /* IOS Keep the custom bottom-sheet design for iOS.*/
          if (Platform.OS === "ios") {
            try {
              // eslint-disable-next-line global-require
              const DateTimePicker =
                require("@react-native-community/datetimepicker").default;
              return (
                <Modal
                  visible={showDateTimePicker}
                  transparent
                  animationType="slide"
                  onRequestClose={() => {
                    setShowDateTimePicker(false);
                    setPickerMode("date");
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      justifyContent: "flex-end",
                      backgroundColor: "rgba(15,23,42,0.45)",
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: "#FFF",
                        borderTopLeftRadius: 28,
                        borderTopRightRadius: 28,
                        padding: 24,
                        paddingBottom: 40,
                      }}
                    >
                      {/* Handle */}
                      <View
                        style={{
                          width: 42,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: "#D6D6D6",
                          alignSelf: "center",
                          marginBottom: 16,
                        }}
                      />

                      {/* Title */}
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: "800",
                          color: "#111827",
                          marginBottom: 20,
                          textAlign: "center",
                        }}
                      >
                        {pickerMode === "date" ? "Select Date" : "Select Time"}
                      </Text>

                      <View
                        style={{
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 100,
                        }}
                      >
                        <DateTimePicker
                          value={new Date(date)}
                          mode={pickerMode}
                          display="spinner"
                          is24Hour={false}
                          onChange={(event, selected) => {
                            if (!selected) return;
                            if (pickerMode === "date") {
                              const existingDate = new Date(date);
                              const newDate = new Date(selected);

                              newDate.setHours(
                                existingDate.getHours(),
                                existingDate.getMinutes(),
                                existingDate.getSeconds(),
                                0,
                              );
                              setDate(newDate.toISOString());
                            } else {
                              const newDate = new Date(date);

                              newDate.setHours(
                                selected.getHours(),
                                selected.getMinutes(),
                                0,
                                0,
                              );

                              setDate(newDate.toISOString());
                            }
                          }}
                        />
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          marginTop: 24,
                        }}
                      >
                        <PaperButton
                          mode="outlined"
                          onPress={() => {
                            setShowDateTimePicker(false);
                            setPickerMode("date");
                          }}
                          style={{
                            flex: 1,
                            marginRight: 10,
                          }}
                        >
                          Cancel
                        </PaperButton>

                        <PaperButton
                          mode="contained"
                          onPress={() => {
                            if (pickerMode === "date") {
                              setPickerMode("time");
                            } else {
                              setShowDateTimePicker(false);
                              setPickerMode("date");
                              markDirty();
                            }
                          }}
                          style={{
                            flex: 1,
                          }}
                        >
                          {pickerMode === "date" ? "Next" : "Done"}
                        </PaperButton>
                      </View>
                    </View>
                  </View>
                </Modal>
              );
            } catch (e) {
              console.warn(
                "[TransactionForm] iOS DateTimePicker unavailable:",
                e,
              );
              setShowDateTimePicker(false);
              return null;
            }
          }

          // WEB FALLBACK
          return (
            <Modal
              visible={showDateTimePicker}
              transparent
              animationType="slide"
              onRequestClose={() => {
                setShowDateTimePicker(false);
                setPickerMode("date");
              }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: "rgba(0,0,0,0.4)",
                  justifyContent: "center",
                  padding: 20,
                }}
              >
                <View
                  style={{
                    backgroundColor: "#fff",
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "600",
                      marginBottom: 8,
                    }}
                  >
                    Pick Date / Time
                  </Text>

                  {(() => {
                    const dt = new Date(date || new Date().toISOString());
                    const [y, m, d, h, min] = [
                      dt.getFullYear(),
                      dt.getMonth() + 1,
                      dt.getDate(),
                      dt.getHours(),
                      dt.getMinutes(),
                    ];
                    const Manual = require("../components/ManualDateTimePicker").default;
                    return (
                      <Manual
                        year={y}
                        month={m}
                        day={d}
                        hour={h}
                        minute={min}
                        onChange={(ny, nm, nd, nh, nmin) => {
                          const ndt = new Date(ny, nm - 1, nd, nh, nmin);
                          setDate(ndt.toISOString());
                          markDirty();
                        }}
                        onClose={() => {
                          setShowDateTimePicker(false);
                          setPickerMode("date");
                        }}
                      />
                    );
                  })()}
                </View>
              </View>
            </Modal>
          );
        })()}

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Transaction"
        message={`Delete this ${type} transaction?`}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        visible={showUnsavedDialog}
        title="Discard changes?"
        message={
          isEdit
            ? "You've made changes that haven't been saved yet. If you go back now, your edits will be lost."
            : "You've started adding a transaction. If you go back now, your progress will be lost."
        }
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
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

      <Modal
        visible={showLoanModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!linking) {
            setShowLoanModal(false);
          }
        }}
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
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              height: "82%",
              padding: 16,
            }}
          >
            {/* HEADER */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "800",
                    color: "#222",
                  }}
                >
                  Link to Loan
                </Text>

                <Text
                  style={{
                    marginTop: 3,
                    color: "#777",
                    fontSize: 13,
                  }}
                >
                  Select the loan for this payment
                </Text>
              </View>

              <TouchableOpacity
                disabled={linking}
                onPress={() => setShowLoanModal(false)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: "#F3F4F6",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <MaterialCommunityIcons name="close" size={22} color="#555" />
              </TouchableOpacity>
            </View>

            {/* SEARCH */}
            <PaperTextInput
              label="Search loan"
              value={loanSearch}
              onChangeText={setLoanSearch}
              mode="outlined"
              disabled={linking}
              left={<PaperTextInput.Icon icon="magnify" />}
              right={
                loanSearch.length > 0 ? (
                  <PaperTextInput.Icon
                    icon="close-circle-outline"
                    onPress={() => setLoanSearch("")}
                  />
                ) : null
              }
              style={{
                marginBottom: 14,
              }}
            />

            {/* COUNT */}
            <Text
              style={{
                color: "#777",
                fontSize: 13,
                marginBottom: 10,
              }}
            >
              {filteredLoans.length}{" "}
              {filteredLoans.length === 1 ? "Loan" : "Loans"}
            </Text>

            {/* LOAN LIST */}
            <View style={{ flex: 1 }}>
              {filteredLoans.length === 0 ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingBottom: 40,
                  }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: "#EEF4FF",
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: 14,
                    }}
                  >
                    <MaterialCommunityIcons
                      name="bank-search-outline"
                      size={32}
                      color="#4B7CF3"
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: "#333",
                    }}
                  >
                    No loans found
                  </Text>
                  <Text
                    style={{
                      color: "#888",
                      marginTop: 5,
                      textAlign: "center",
                    }}
                  >
                    Try a different loan name or lender.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredLoans}
                  keyExtractor={(item) => String(item.id)}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingBottom: 30,
                  }}
                  renderItem={({ item }) => {
                    const isSelected = selectedLoanId === item.id;
                    return (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        disabled={linking || submitting}
                        onPress={() => {
                          if (linking || submitting) return;
                          // Show action sheet to confirm what kind of link this is
                          setPendingLoan(item);
                          setShowLoanModal(false);
                          setShowLoanActionSheet(true);
                        }}
                        style={{
                          backgroundColor: isSelected ? "#F0FFF6" : "#fff",
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isSelected ? "#36B37E" : "#E6EAF2",
                          padding: 14,
                          marginBottom: 10,
                          opacity: linking || submitting ? 0.65 : 1,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          {/* ICON */}
                          <View
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 24,
                              backgroundColor: isSelected
                                ? "#36B37E"
                                : "#4B7CF3",
                              justifyContent: "center",
                              alignItems: "center",
                              marginRight: 12,
                            }}
                          >
                            <MaterialCommunityIcons
                              name={isSelected ? "bank-check" : "bank-outline"}
                              size={24}
                              color="#fff"
                            />
                          </View>

                          {/* DETAILS */}
                          <View style={{ flex: 1 }}>
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 16,
                                fontWeight: "800",
                                color: "#222",
                              }}
                            >
                              {item.loan_name}
                            </Text>

                            {!!item.lender && (
                              <Text
                                numberOfLines={1}
                                style={{
                                  marginTop: 3,
                                  fontSize: 13,
                                  color: "#777",
                                }}
                              >
                                {item.lender}
                              </Text>
                            )}

                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                marginTop: 6,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: "#666",
                                }}
                              >
                                Outstanding
                              </Text>

                              <Text
                                style={{
                                  marginLeft: 5,
                                  fontSize: 13,
                                  fontWeight: "800",
                                  color: "#333",
                                }}
                              >
                                ₹
                                {Number(
                                  item.outstanding_amount || 0,
                                ).toLocaleString("en-IN")}
                              </Text>
                            </View>
                          </View>

                          {/* RIGHT */}
                          <View
                            style={{
                              marginLeft: 8,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {isSelected ? (
                              <View
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 15,
                                  backgroundColor: "#36B37E",
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}
                              >
                                <MaterialCommunityIcons
                                  name="check"
                                  size={18}
                                  color="#fff"
                                />
                              </View>
                            ) : (
                              <MaterialCommunityIcons
                                name="chevron-right"
                                size={26}
                                color="#999"
                              />
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          </View>

          {/* LOADER — ABOVE THE LOAN POPUP */}
          {linking && (
            <View
              pointerEvents="auto"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(255,255,255,0.72)",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 999999,
                elevation: 999999,
              }}
            >
              <View
                style={{
                  width: 170,
                  height: 170,
                  borderRadius: 36,
                  backgroundColor: "rgba(255,255,255,0.97)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.95)",
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#000",
                  shadowOffset: {
                    width: 0,
                    height: 18,
                  },
                  shadowOpacity: 0.15,
                  shadowRadius: 28,
                  elevation: 30,
                }}
              >
                <ActivityIndicator size="large" color="#4B7CF3" />

                <Text
                  style={{
                    marginTop: 14,
                    fontSize: 14,
                    fontWeight: "700",
                    color: "#333",
                  }}
                >
                  Linking loan...
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* LOAN ACTION SHEET                                                  */}
      {/* Shown after user picks a loan — confirms what this tx means        */}
      {/* ================================================================= */}
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
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              paddingBottom: 36,
            }}
          >
            {/* Handle */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#D1D5DB",
                alignSelf: "center",
                marginBottom: 18,
              }}
            />

            {/* Loan name header */}
            {pendingLoan && (() => {
              const isLentLoan =
                (pendingLoan.loan_direction || "BORROWED").toUpperCase() === "LENT";
              // Options driven by BOTH loan direction AND transaction type
              const options = isLentLoan
                ? type === "income"
                  ? [
                    {
                      label: "Receive Payment",
                      sublabel: "Borrower paid back part or full amount",
                      icon: "cash-check",
                      color: "#16A34A",
                      bg: "#DCFCE7",
                      paymentType: "EMI",
                    },
                  ]
                  : [
                    {
                      label: "Lend More",
                      sublabel: "Give additional money to the borrower",
                      icon: "cash-plus",
                      color: "#7C3AED",
                      bg: "#EDE9FE",
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
                      bg: "#EDE9FE",
                      paymentType: "TOP_UP",
                    },
                  ]
                  : [
                    {
                      label: "Pay EMI",
                      sublabel: "Regular monthly instalment payment",
                      icon: "cash-fast",
                      color: "#2563EB",
                      bg: "#DBEAFE",
                      paymentType: "EMI",
                    },
                    {
                      label: "Prepayment",
                      sublabel: "Extra payment to reduce principal faster",
                      icon: "trending-up",
                      color: "#EA580C",
                      bg: "#FED7AA",
                      paymentType: "PREPAYMENT",
                    },
                    {
                      label: "Foreclose",
                      sublabel: "Close the loan with full & final payment",
                      icon: "bank-remove",
                      color: "#DC2626",
                      bg: "#FEE2E2",
                      paymentType: "FORECLOSURE",
                    },
                  ];
              const doLink = async (paymentType) => {
                try {
                  setLinking(true);
                  setShowLoanActionSheet(false);

                  if (isEdit && transaction?.id) {
                    await linkTransactionToLoan(
                      transaction.id,
                      pendingLoan.id,
                      {
                        paymentType,
                        linkedDate: transaction.date || date,
                      },
                    );
                    setSnackbarMsg(`Linked to ${pendingLoan.loan_name}`);
                    setSnackbarVisible(true);
                  }

                  setSelectedLoanId(pendingLoan.id);
                  setPendingLoan(null);
                  setLoanSearch("");
                  markDirty();
                } catch (e) {
                  console.error("[TransactionForm] Link loan failed:", e);
                  setSnackbarMsg(e?.message || "Failed to link to loan");
                  setSnackbarVisible(true);
                } finally {
                  setLinking(false);
                }
              };

              return (
                <>
                  {/* Header */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 20,
                    }}
                  >
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 23,
                        backgroundColor: "#2563EB",
                        justifyContent: "center",
                        alignItems: "center",
                        marginRight: 12,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="bank-outline"
                        size={24}
                        color="#fff"
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          color: "#94A3B8",
                          fontWeight: "600",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        {isLentLoan ? "Lent Loan" : "Borrowed Loan"}
                      </Text>
                      <Text
                        style={{
                          fontSize: 17,
                          fontWeight: "800",
                          color: "#111827",
                        }}
                        numberOfLines={1}
                      >
                        {pendingLoan.loan_name}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#64748B" }}>
                        Outstanding ₹
                        {Number(
                          pendingLoan.outstanding_amount || 0,
                        ).toLocaleString("en-IN")}
                      </Text>
                    </View>
                  </View>

                  {/* Question */}
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: "#374151",
                      marginBottom: 14,
                    }}
                  >
                    What does this {type} represent?
                  </Text>

                  {/* Options */}
                  {options.map((opt) => (
                    <TouchableOpacity
                      key={opt.paymentType}
                      activeOpacity={0.85}
                      disabled={linking}
                      onPress={() => doLink(opt.paymentType)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: opt.bg,
                        borderRadius: 16,
                        padding: 14,
                        marginBottom: 10,
                        borderWidth: 1,
                        borderColor: opt.color + "40",
                      }}
                    >
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: opt.color,
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: 14,
                        }}
                      >
                        <MaterialCommunityIcons
                          name={opt.icon}
                          size={22}
                          color="#fff"
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "800",
                            color: "#111827",
                          }}
                        >
                          {opt.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 12,
                            color: "#64748B",
                            marginTop: 2,
                          }}
                        >
                          {opt.sublabel}
                        </Text>
                      </View>

                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={22}
                        color={opt.color}
                      />
                    </TouchableOpacity>
                  ))}

                  {/* Cancel */}
                  <TouchableOpacity
                    onPress={() => {
                      setShowLoanActionSheet(false);
                      setPendingLoan(null);
                      setShowLoanModal(true);
                    }}
                    style={{
                      alignItems: "center",
                      paddingVertical: 12,
                      marginTop: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: "#64748B",
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                    >
                      ← Back to loans
                    </Text>
                  </TouchableOpacity>
                </>
              );
            })()}

            {/* Loader overlay */}
            {linking && (
              <View
                style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: "rgba(255,255,255,0.8)",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="large" color="#2563EB" />
                <Text
                  style={{
                    marginTop: 12,
                    fontWeight: "700",
                    color: "#333",
                  }}
                >
                  Linking...
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <CategoryCreateModal
        visible={showCategoryCreateModal}
        onClose={() => setShowCategoryCreateModal(false)}
        onCategoryCreated={async (newCategory) => {
          const cats = await getCategories(true);
          setCategories(cats);
          setCategoryId(newCategory.id);
          requestAnimationFrame(() => {
            setShowCategoryCreateModal(false);
            setShowCategoryModal(false);
            setShowCategoryGrid(false);
            setCategorySearch("");
          });
        }}
        currentType={type}
      />

      <SourceCreateModal
        visible={showSourceCreateModal}
        onClose={() => setShowSourceCreateModal(false)}
        onSourceCreated={async () => {
          const updatedSources = await getSources(true);
          setSources(updatedSources);
          const newestSource = [...updatedSources].sort(
            (a, b) => b.id - a.id,
          )[0];
          requestAnimationFrame(() => {
            if (newestSource) {
              setSourceId(newestSource.id);
            }
            setShowSourceGrid(false);
            setSourceSearch("");
            setShowSourceCreateModal(false);
            setShowSourceModal(false);
          });
        }}
      />

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{ label: "OK", onPress: () => setSnackbarVisible(false) }}
      >
        {snackbarMsg}
      </Snackbar>
    </ScrollView>
  );
}
