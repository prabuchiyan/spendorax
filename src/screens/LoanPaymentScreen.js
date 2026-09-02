import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Button as PaperButton } from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import ManualDateTimePicker from "../components/ManualDateTimePicker";
import { recordPayment, recordPrepayment, getLoans } from "../services/loans";
import { getSources } from "../services/sources";
import { getCategories } from "../services/categories";
import Card from "../components/Card";

function FieldCard({ icon, title, value, color = "#2563EB", onPress, error }) {
  const hasError = !!error;

  return (
    <View style={styles.fieldWrapper}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[styles.fieldCard, hasError && styles.fieldCardError]}
      >
        <View
          style={[
            styles.fieldIcon,
            {
              backgroundColor: hasError ? "#FEE2E2" : color + "20",
            },
          ]}
        >
          <MaterialCommunityIcons
            name={hasError ? "alert-circle-outline" : icon}
            size={22}
            color={hasError ? "#DC2626" : color}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldTitle, hasError && styles.fieldTitleError]}>
            {title}
            <Text style={styles.requiredMark}> *</Text>
          </Text>

          <Text
            style={[styles.fieldValue, hasError && styles.fieldValueError]}
            numberOfLines={1}
          >
            {value}
          </Text>
        </View>

        <MaterialCommunityIcons
          name={hasError ? "alert-circle" : "chevron-right"}
          size={22}
          color={hasError ? "#DC2626" : "#94A3B8"}
        />
      </TouchableOpacity>

      <FieldError message={error} />
    </View>
  );
}

function FieldError({ message }) {
  if (!message) return null;

  return (
    <View style={styles.fieldErrorContainer}>
      <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />

      <Text style={styles.fieldErrorText}>{message}</Text>
    </View>
  );
}

function PickerItem({
  icon,
  iconColor = "#2563EB",
  iconBg = "#DBEAFE",
  title,
  subtitle,
  selected = false,
  onPress,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: selected ? "#EFF6FF" : "#FFFFFF",
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? "#2563EB" : "#EEF2F7",
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: iconBg,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 14,
        }}
      >
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: "800",
            color: "#111827",
          }}
          numberOfLines={1}
        >
          {title}
        </Text>

        {!!subtitle && (
          <Text
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "#64748B",
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {selected ? (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: "#2563EB",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
        </View>
      ) : (
        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color="#94A3B8"
        />
      )}
    </TouchableOpacity>
  );
}

function safeDate(value) {
  if (!value) {
    return new Date();
  }

  const d = new Date(value);

  if (!Number.isNaN(d.getTime())) {
    return d;
  }

  return new Date();
}

function formatDateTime(value) {
  const d = safeDate(value);

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LoanPaymentScreen({ route, navigation }) {
  const routeLoanId = route?.params?.id ?? route?.params?.loanId;
  const loanIdParam = routeLoanId != null ? Number(routeLoanId) : null;
  const mode = route?.params?.mode || "payment";

  const [loanId, setLoanId] = useState(loanIdParam);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState("date");
  const [categorySearch, setCategorySearch] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [reduceEMI, setReduceEMI] = useState(false);
  const [loans, setLoans] = useState([]);
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sourceId, setSourceId] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [showLoanPicker, setShowLoanPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);

  const closeDatePicker = () => {
    setShowDatePicker(false);
    setDatePickerMode("date");
  };

  const openDatePicker = () => {
    setDatePickerMode("date");
    setShowDatePicker(true);
  };

  const handleNativeDateTimeChange = (event, selectedDate) => {
    if (event?.type === "dismissed") {
      closeDatePicker();
      return;
    }

    if (!selectedDate) {
      return;
    }

    const current = safeDate(transactionDate);
    const next = new Date(current);

    if (datePickerMode === "date") {
      next.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
      );
    } else {
      next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    }

    setTransactionDate(next.toISOString());

    if (Platform.OS === "android") {
      if (datePickerMode === "date") {
        setDatePickerMode("time");

        setTimeout(() => {
          setShowDatePicker(true);
        }, 150);
      } else {
        closeDatePicker();
      }
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const loanRows = await getLoans();
        setLoans(loanRows);
        if (!loanIdParam && loanRows.length > 0) {
          setLoanId(loanRows[0].id);
        }
      } catch (e) {
        console.warn("Failed to load loans", e);
      }
    })();
  }, [loanIdParam]);

  useEffect(() => {
    (async () => {
      try {
        const src = await getSources();
        setSources(src);
        if (src.length > 0 && sourceId == null) setSourceId(src[0].id);
      } catch (e) {
        console.warn("Failed to load sources", e);
      }
    })();
    (async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (e) {
        console.warn("Failed to load categories", e);
      }
    })();
  }, [sourceId]);

  const categoryType = mode === "receive" ? "income" : "expense";

  const availableCategories = categories.filter(
    (category) => String(category.type || "").toLowerCase() === categoryType,
  );

  const filteredCategories = availableCategories.filter((category) =>
    String(category.name || "")
      .toLowerCase()
      .includes(categorySearch.trim().toLowerCase()),
  );

  function validate() {
    const nextErrors = {};

    if (!loanId) {
      nextErrors.loan = "Please select a loan before continuing.";
    }

    const trimmedAmount = String(amount || "").trim();
    const numericAmount = Number(trimmedAmount);

    if (!trimmedAmount) {
      nextErrors.amount = "Please enter the payment amount.";
    } else if (Number.isNaN(numericAmount)) {
      nextErrors.amount = "Please enter a valid amount.";
    } else if (numericAmount <= 0) {
      nextErrors.amount = "Payment amount must be greater than ₹0.";
    }

    if (!sourceId) {
      nextErrors.source =
        "Please choose the account or wallet used for this payment.";
    }

    if (!categoryId) {
      nextErrors.category = "Please choose a category for this payment.";
    }

    if (!transactionDate || Number.isNaN(safeDate(transactionDate).getTime())) {
      nextErrors.date = "Please select when this payment was made.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const errorCount = Object.keys(nextErrors).length;

      Alert.alert(
        "Almost there! ✨",
        errorCount === 1
          ? "Please fix the highlighted field before continuing."
          : `Please complete the ${errorCount} highlighted fields before continuing.`,
        [{ text: "Got it" }],
      );

      return false;
    }

    return true;
  }

  async function save() {
    if (loading) return;

    if (!validate()) {
      return;
    }

    const value = Number(amount);

    try {
      setLoading(true);

      if (mode === "prepayment") {
        await recordPrepayment({
          loanId,
          date: safeDate(transactionDate).toISOString(),
          amount: value,
          reduceEMI,
          sourceId,
          categoryId,
          notes,
        });
      } else {
        await recordPayment({
          loanId,
          date: safeDate(transactionDate).toISOString(),
          amount: value,
          paymentType: "EMI",
          sourceId,
          categoryId,
          notes,
        });
      }

      navigation.goBack();
    } catch (e) {
      console.error("Payment failed", e);

      Alert.alert("Unable to save", e?.message || "Failed to record payment", [
        { text: "OK" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const selectedLoan = loans.find((l) => l.id === loanId);
  const selectedSource = sources.find((s) => s.id === sourceId);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const title =
    mode === "receive"
      ? "Receive Loan Payment"
      : mode === "prepayment"
        ? "Record Prepayment"
        : "Record EMI Payment";

  const subtitle =
    mode === "receive"
      ? "Record a payment received from the borrower"
      : "Record and track your loan payment";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F3F6FB",
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 40,
        }}
      >
        <Card
          style={{
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              backgroundColor: mode === "prepayment" ? "#EA580C" : "#2563EB",

              margin: -16,
              marginBottom: 18,

              padding: 20,

              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 16,
                }}
              >
                <MaterialCommunityIcons
                  name={mode === "prepayment" ? "cash-plus" : "cash-fast"}
                  size={28}
                  color="#FFF"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "#FFF",
                    fontSize: 22,
                    fontWeight: "900",
                  }}
                >
                  {title}
                </Text>

                <Text
                  style={{
                    color: "#DCE8FF",
                    marginTop: 4,
                  }}
                >
                  {subtitle}
                </Text>
              </View>
            </View>

            {selectedLoan && (
              <View
                style={{
                  marginTop: 22,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  borderRadius: 18,
                  padding: 16,
                }}
              >
                <Text
                  style={{
                    color: "#DCE8FF",
                    fontSize: 12,
                  }}
                >
                  Selected Loan
                </Text>

                <Text
                  style={{
                    color: "#FFF",
                    marginTop: 4,
                    fontWeight: "900",
                    fontSize: 18,
                  }}
                >
                  {selectedLoan.loan_name}
                </Text>

                <Text
                  style={{
                    color: "#DCE8FF",
                    marginTop: 6,
                  }}
                >
                  Outstanding ₹
                  {Number(selectedLoan.outstanding_amount || 0).toLocaleString(
                    "en-IN",
                  )}
                </Text>
              </View>
            )}
          </View>

          <FieldCard
            icon="bank-outline"
            color="#2563EB"
            title="Loan"
            value={selectedLoan ? selectedLoan.loan_name : "Select Loan"}
            onPress={() => setShowLoanPicker(true)}
          />

          <FieldCard
            icon="wallet-outline"
            color="#16A34A"
            title="Payment Source"
            value={
              selectedSource ? selectedSource.name : "Select Bank / Wallet"
            }
            error={errors.source}
            onPress={() => {
              setErrors((prev) => ({
                ...prev,
                source: undefined,
              }));
              setShowSourcePicker(true);
            }}
          />

          <FieldCard
            icon="shape-outline"
            color={mode === "receive" ? "#16A34A" : "#EA580C"}
            title="Category"
            value={selectedCategory ? selectedCategory.name : "Select Category"}
            error={errors.category}
            onPress={() => {
              setErrors((prev) => ({
                ...prev,
                category: undefined,
              }));
              setShowCategoryPicker(true);
            }}
          />

          <FieldCard
            icon="calendar-clock"
            color="#2563EB"
            title="Date & Time"
            value={formatDateTime(transactionDate)}
            error={errors.date}
            onPress={() => {
              setErrors((prev) => ({
                ...prev,
                date: undefined,
              }));

              openDatePicker();
            }}
          />

          <View style={styles.amountCard}>
            <Text
              style={[
                styles.amountLabel,
                errors.amount && {
                  color: "#DC2626",
                },
              ]}
            >
              Payment Amount
              <Text style={{ color: "#DC2626" }}> *</Text>
            </Text>

            <View style={styles.amountRow}>
              <View
                style={[
                  styles.amountInputContainer,
                  errors.amount && {
                    borderColor: "#DC2626",
                    backgroundColor: "#FEF2F2",
                  },
                  amountFocused &&
                    !errors.amount && {
                      borderColor: "#2563EB",
                      borderWidth: 2,
                    },
                ]}
              >
                <Text
                  style={[
                    styles.currency,
                    errors.amount && {
                      color: "#DC2626",
                    },
                  ]}
                >
                  ₹
                </Text>

                <TextInput
                  onFocus={() => {
                    setAmountFocused(true);
                    setErrors((prev) => ({
                      ...prev,
                      amount: undefined,
                    }));
                  }}
                  onBlur={() => setAmountFocused(false)}
                  placeholder="Enter Amount"
                  value={String(amount)}
                  keyboardType="decimal-pad"
                  selectionColor="#2563EB"
                  cursorColor="#2563EB"
                  underlineColorAndroid="transparent"
                  placeholderTextColor="#94A3B8"
                  maxLength={12}
                  importantForAutofill="no"
                  autoCorrect={false}
                  style={[
                    styles.amountInput,
                    {
                      outlineStyle: "none",
                    },
                  ]}
                  disableFullscreenUI={true}
                  onChangeText={(text) => {
                    let value = text.replace(/[^0-9.]/g, "");

                    const firstDot = value.indexOf(".");

                    if (firstDot !== -1) {
                      value =
                        value.substring(0, firstDot + 1) +
                        value.substring(firstDot + 1).replace(/\./g, "");
                    }

                    setAmount(value);

                    if (errors.amount) {
                      setErrors((prev) => ({
                        ...prev,
                        amount: undefined,
                      }));
                    }
                  }}
                />
              </View>
            </View>

            <FieldError message={errors.amount} />
          </View>

          {mode === "prepayment" && (
            <View style={styles.preferenceCard}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View style={styles.preferenceIcon}>
                  <MaterialCommunityIcons
                    name="chart-line"
                    size={22}
                    color="#EA580C"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.preferenceTitle}>Reduce Monthly EMI</Text>

                  <Text style={styles.preferenceSubtitle}>
                    Keep the same loan tenure and reduce your EMI after this
                    prepayment.
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setReduceEMI(!reduceEMI)}
                  style={[styles.toggle, reduceEMI && styles.toggleOn]}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      reduceEMI && styles.toggleThumbOn,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Notes (Optional)</Text>

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add remarks (optional)"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              selectionColor="#2563EB"
              cursorColor="#2563EB"
              underlineColorAndroid="transparent"
              maxLength={250}
              style={[
                styles.notesInput,
                {
                  outlineStyle: "none",
                },
              ]}
            />
          </View>
          <View style={styles.saveContainer}>
            <PaperButton
              mode="contained"
              onPress={save}
              loading={loading}
              disabled={loading}
              style={styles.saveButton}
              contentStyle={{
                height: 54,
              }}
              labelStyle={{
                fontSize: 16,
                fontWeight: "800",
              }}
            >
              {mode === "receive"
                ? "Save Received Payment"
                : mode === "prepayment"
                  ? "Save Prepayment"
                  : "Save Payment"}
            </PaperButton>
          </View>
        </Card>

        <Modal visible={showLoanPicker} transparent animationType="slide">
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(15,23,42,0.45)",
            }}
          >
            <View
              style={{
                backgroundColor: "#F8FAFC",
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                padding: 20,
                maxHeight: "75%",
              }}
            >
              {/* Handle */}

              <View
                style={{
                  width: 52,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: "#CBD5E1",
                  alignSelf: "center",
                  marginBottom: 18,
                }}
              />

              {/* Header */}

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 21,
                      fontWeight: "900",
                      color: "#111827",
                    }}
                  >
                    Select Loan
                  </Text>

                  <Text
                    style={{
                      marginTop: 4,
                      color: "#64748B",
                    }}
                  >
                    Choose the loan for this payment
                  </Text>
                </View>

                <TouchableOpacity onPress={() => setShowLoanPicker(false)}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={28}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>

              {/* List */}

              <ScrollView showsVerticalScrollIndicator={false}>
                {loans.map((loan) => {
                  const outstanding = Number(
                    loan.outstanding_amount || 0,
                  ).toLocaleString("en-IN");

                  const emi = Number(loan.emi_amount || 0).toLocaleString(
                    "en-IN",
                  );

                  const selected = loan.id === loanId;

                  return (
                    <PickerItem
                      key={loan.id}
                      icon="bank-outline"
                      iconColor="#2563EB"
                      iconBg="#DBEAFE"
                      selected={selected}
                      title={loan.loan_name}
                      subtitle={`Outstanding ₹${outstanding}   •   EMI ₹${emi}`}
                      onPress={() => {
                        setLoanId(loan.id);
                        setErrors((prev) => ({
                          ...prev,
                          loan: undefined,
                        }));
                        setShowLoanPicker(false);
                      }}
                    />
                  );
                })}

                <View style={{ height: 10 }} />
              </ScrollView>

              {/* Footer */}

              <PaperButton
                mode="outlined"
                style={{
                  marginTop: 12,
                  borderRadius: 14,
                }}
                onPress={() => setShowLoanPicker(false)}
              >
                Close
              </PaperButton>
            </View>
          </View>
        </Modal>

        <Modal visible={showSourcePicker} transparent animationType="slide">
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(15,23,42,0.45)",
            }}
          >
            <View
              style={{
                backgroundColor: "#F8FAFC",
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                padding: 20,
                maxHeight: "75%",
              }}
            >
              {/* Handle */}

              <View
                style={{
                  width: 52,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: "#CBD5E1",
                  alignSelf: "center",
                  marginBottom: 18,
                }}
              />

              {/* Header */}

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 21,
                      fontWeight: "900",
                      color: "#111827",
                    }}
                  >
                    Select Payment Source
                  </Text>

                  <Text
                    style={{
                      marginTop: 4,
                      color: "#64748B",
                    }}
                  >
                    Choose where the payment is made from
                  </Text>
                </View>

                <TouchableOpacity onPress={() => setShowSourcePicker(false)}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={28}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {sources.map((source) => (
                  <PickerItem
                    key={source.id}
                    icon="wallet-outline"
                    iconColor="#16A34A"
                    iconBg="#DCFCE7"
                    selected={source.id === sourceId}
                    title={source.name}
                    subtitle="Payment Account"
                    onPress={() => {
                      setSourceId(source.id);
                      setErrors((prev) => ({
                        ...prev,
                        source: undefined,
                      }));
                      setShowSourcePicker(false);
                    }}
                  />
                ))}

                <View style={{ height: 10 }} />
              </ScrollView>

              <PaperButton
                mode="outlined"
                style={{
                  marginTop: 12,
                  borderRadius: 14,
                }}
                onPress={() => setShowSourcePicker(false)}
              >
                Close
              </PaperButton>
            </View>
          </View>
        </Modal>

        <Modal visible={showCategoryPicker} transparent animationType="slide">
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(15,23,42,0.45)",
            }}
          >
            <View
              style={{
                backgroundColor: "#F8FAFC",
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                padding: 20,
                maxHeight: "75%",
              }}
            >
              {/* Handle */}

              <View
                style={{
                  width: 52,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: "#CBD5E1",
                  alignSelf: "center",
                  marginBottom: 18,
                }}
              />

              {/* Header */}

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 18,
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 21,
                      fontWeight: "900",
                      color: "#111827",
                    }}
                  >
                    Select Category
                  </Text>

                  <Text
                    style={{
                      marginTop: 4,
                      color: "#64748B",
                    }}
                  >
                    Choose the {categoryType} category
                  </Text>
                </View>

                <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={28}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.categorySearchContainer}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={22}
                  color="#94A3B8"
                />

                <TextInput
                  value={categorySearch}
                  onChangeText={setCategorySearch}
                  placeholder={`Search ${categoryType} categories...`}
                  placeholderTextColor="#94A3B8"
                  style={styles.categorySearchInput}
                  autoCorrect={false}
                />

                {!!categorySearch && (
                  <TouchableOpacity onPress={() => setCategorySearch("")}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {filteredCategories.map((category) => {
                  const icon = category.icon || "shape-outline";
                  const color =
                    category.color ||
                    (mode === "receive" ? "#16A34A" : "#EA580C");

                  return (
                    <PickerItem
                      key={category.id}
                      icon={icon}
                      iconColor={color}
                      iconBg={color + "20"}
                      selected={category.id === categoryId}
                      title={category.name}
                      subtitle={
                        categoryType === "income"
                          ? "Income Category"
                          : "Expense Category"
                      }
                      onPress={() => {
                        setCategoryId(category.id);

                        setErrors((prev) => ({
                          ...prev,
                          category: undefined,
                        }));

                        setShowCategoryPicker(false);
                        setCategorySearch("");
                      }}
                    />
                  );
                })}

                {filteredCategories.length === 0 && (
                  <View style={styles.emptyPicker}>
                    <View style={styles.emptyPickerIcon}>
                      <MaterialCommunityIcons
                        name="shape-outline"
                        size={30}
                        color="#94A3B8"
                      />
                    </View>

                    <Text style={styles.emptyPickerTitle}>
                      No {categoryType} categories found
                    </Text>

                    <Text style={styles.emptyPickerText}>
                      Try a different category name.
                    </Text>
                  </View>
                )}

                <View style={{ height: 10 }} />
              </ScrollView>

              <PaperButton
                mode="outlined"
                style={{
                  marginTop: 12,
                  borderRadius: 14,
                }}
                onPress={() => setShowCategoryPicker(false)}
              >
                Close
              </PaperButton>
            </View>
          </View>
        </Modal>

        {/* Date & Time Picker - Android */}
        {showDatePicker && Platform.OS === "android" && (
          <DateTimePicker
            key={datePickerMode}
            value={safeDate(transactionDate)}
            mode={datePickerMode}
            display={datePickerMode === "date" ? "calendar" : "clock"}
            is24Hour={false}
            maximumDate={datePickerMode === "date" ? new Date() : undefined}
            onChange={handleNativeDateTimeChange}
          />
        )}

        {/* Date & Time Picker - iOS */}
        {showDatePicker && Platform.OS === "ios" && (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="slide"
            onRequestClose={closeDatePicker}
          >
            <View style={styles.dateOverlay}>
              <View style={styles.dateSheet}>
                <View style={styles.pickerHandle} />

                <Text style={styles.dateTitle}>
                  {datePickerMode === "date" ? "Select Date" : "Select Time"}
                </Text>

                <Text style={styles.dateSubtitle}>
                  {formatDateTime(transactionDate)}
                </Text>

                <DateTimePicker
                  value={safeDate(transactionDate)}
                  mode={datePickerMode}
                  display="spinner"
                  is24Hour={false}
                  maximumDate={
                    datePickerMode === "date" ? new Date() : undefined
                  }
                  onChange={handleNativeDateTimeChange}
                />

                <View style={styles.dateActions}>
                  <PaperButton
                    mode="outlined"
                    onPress={closeDatePicker}
                    style={styles.dateAction}
                  >
                    Cancel
                  </PaperButton>

                  <PaperButton
                    mode="contained"
                    onPress={() => {
                      if (datePickerMode === "date") {
                        setDatePickerMode("time");
                      } else {
                        closeDatePicker();
                      }
                    }}
                    style={styles.dateAction}
                  >
                    {datePickerMode === "date" ? "Next" : "Done"}
                  </PaperButton>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Date & Time Picker - Web */}
        {showDatePicker && Platform.OS === "web" && (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="fade"
            onRequestClose={closeDatePicker}
          >
            <View style={styles.webDateOverlay}>
              <View style={styles.webDateCard}>
                <View style={styles.webDateHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.webDateTitle}>Pick Date & Time</Text>

                    <Text style={styles.webDateSubtitle}>
                      {formatDateTime(transactionDate)}
                    </Text>
                  </View>

                  <TouchableOpacity onPress={closeDatePicker}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={28}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </View>

                <ManualDateTimePicker
                  year={safeDate(transactionDate).getFullYear()}
                  month={safeDate(transactionDate).getMonth() + 1}
                  day={safeDate(transactionDate).getDate()}
                  hour={safeDate(transactionDate).getHours()}
                  minute={safeDate(transactionDate).getMinutes()}
                  onChange={(year, month, day, hour, minute) => {
                    const nextDate = new Date(
                      year,
                      month - 1,
                      day,
                      hour,
                      minute,
                    );

                    setTransactionDate(nextDate.toISOString());
                  }}
                  onClose={closeDatePicker}
                />
              </View>
            </View>
          </Modal>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    minHeight: 72,
  },
  fieldIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  fieldTitle: {
    color: "#64748B",
    fontSize: 12,
  },
  fieldValue: {
    marginTop: 4,
    fontWeight: "800",
    fontSize: 15,
    color: "#111827",
  },
  amountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    elevation: 2,
  },
  amountLabel: {
    color: "#64748B",
    fontSize: 12,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  currency: {
    fontSize: 30,
    fontWeight: "900",
    color: "#2563EB",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
    paddingVertical: 8,
    minHeight: 54,
    outlineStyle: "none",
  },
  notesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 10,
  },
  notesInput: {
    borderWidth: 1.5,
    borderColor: "#D6E4FF",
    backgroundColor: "#F8FBFF",
    borderRadius: 16,
    minHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    textAlignVertical: "top",
    outlineStyle: "none",
  },
  saveButton: {
    borderRadius: 18,
    marginTop: 10,
  },
  preferenceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },
  preferenceIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#FED7AA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  preferenceTitle: {
    fontWeight: "800",
    fontSize: 15,
    color: "#111827",
  },
  preferenceSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 18,
    backgroundColor: "#CBD5E1",
    justifyContent: "center",
  },
  toggleOn: {
    backgroundColor: "#16A34A",
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFF",
    marginLeft: 3,
  },
  toggleThumbOn: {
    marginLeft: 25,
  },
  saveContainer: {
    marginTop: 10,
    marginBottom: 25,
  },
  amountInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#D6E4FF",
    borderRadius: 18,
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
  },
  contentStyle: {
    height: 56,
  },
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
  emptyPicker: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyPickerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyPickerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#334155",
  },
  emptyPickerText: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
  dateOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  dateSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  pickerHandle: {
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 8,
  },
  dateTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
    marginTop: 8,
  },
  dateSubtitle: {
    textAlign: "center",
    marginTop: 5,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  dateActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  dateAction: {
    flex: 1,
    borderRadius: 14,
  },
  webDateOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.45)",
    padding: 20,
  },
  webDateCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  webDateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  webDateTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#111827",
  },
  webDateSubtitle: {
    marginTop: 5,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
});
