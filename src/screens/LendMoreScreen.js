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
import { recordAdvance, getLoanById } from "../services/loans";
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
          style={{ fontSize: 15, fontWeight: "800", color: "#111827" }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={{ marginTop: 4, fontSize: 12, color: "#64748B" }}
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

function closeDatePicker() {
  setShowDatePicker(false);
  setDatePickerMode("date");
}

function openDatePicker() {
  setDatePickerMode("date");
  setShowDatePicker(true);
}

function handleNativeDateTimeChange(event, selectedDate) {
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
    // Change only the date and preserve the existing time
    next.setFullYear(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
    );
  } else {
    // Change only the time and preserve the existing date
    next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
  }
  setTransactionDate(next.toISOString());
  // Android: date picker → time picker
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
}

export default function LendMoreScreen({ route, navigation }) {
  const loanId = route?.params?.id ? Number(route.params.id) : null;
  const [loan, setLoan] = useState(null);
  const [amount, setAmount] = useState("");
  const [amountFocused, setAmountFocused] = useState(false);
  const [notes, setNotes] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState("date");
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sourceId, setSourceId] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!loanId) return;
      const l = await getLoanById(loanId);
      setLoan(l);
    })();
  }, [loanId]);

  useEffect(() => {
    (async () => {
      try {
        const src = await getSources();
        setSources(src || []);
        if (src?.length > 0) setSourceId(src[0].id);
      } catch (e) {
        console.warn("Failed to load sources", e);
      }
    })();
    (async () => {
      try {
        const cats = await getCategories();
        setCategories(cats || []);
      } catch (e) {
        console.warn("Failed to load categories", e);
      }
    })();
  }, []);

  const selectedSource = sources.find((s) => s.id === sourceId);
  const selectedCategory = categories.find((c) => c.id === categoryId);

  function validate() {
    const nextErrors = {};
    // Loan
    if (!loanId) {
      nextErrors.loan = "Please select a loan before continuing.";
    }
    // Amount
    const trimmedAmount = String(amount || "").trim();
    const numericAmount = Number(trimmedAmount);
    if (!trimmedAmount) {
      nextErrors.amount = "Please enter the lending amount.";
    } else if (Number.isNaN(numericAmount)) {
      nextErrors.amount = "Please enter a valid amount.";
    } else if (numericAmount <= 0) {
      nextErrors.amount = "Lending amount must be greater than ₹0.";
    }

    // Payment Source
    if (!sourceId) {
      nextErrors.source =
        "Please choose the account or wallet used for this lending.";
    }

    // Category
    if (!categoryId) {
      nextErrors.category = "Please choose a category for this lending.";
    }

    // Date & Time
    if (!transactionDate || Number.isNaN(safeDate(transactionDate).getTime())) {
      nextErrors.date = "Please select when this lending was made.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const errorCount = Object.keys(nextErrors).length;
      Alert.alert(
        "Almost there! ✨",
        errorCount === 1
          ? "Please fix the highlighted field before continuing."
          : `Please complete the ${errorCount} highlighted fields before continuing.`,
        [
          {
            text: "Got it",
            style: "default",
          },
        ],
      );
      return false;
    }
    return true;
  }

  async function save() {
    if (!validate()) {
      return;
    }
    try {
      setLoading(true);
      await recordAdvance({
        loanId: Number(loanId),
        date: safeDate(transactionDate).toISOString(),
        amount: Number(amount),
        sourceId: Number(sourceId),
        categoryId: Number(categoryId),
        notes: notes.trim() || `Additional lending: ${loan?.loan_name}`,
      });
      navigation.goBack();
    } catch (e) {
      console.error("Advance failed:", e);
      Alert.alert(
        "Lend More Failed",
        e?.message || "Failed to record additional lending.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F3F6FB" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <Card style={{ borderRadius: 24, overflow: "hidden" }}>
          {/* ── HEADER (purple, matching lend direction) ── */}
          <View
            style={{
              backgroundColor: "#7C3AED",
              margin: -16,
              marginBottom: 18,
              padding: 20,
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
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
                  name="hand-coin-outline"
                  size={28}
                  color="#FFF"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: "#FFF", fontSize: 22, fontWeight: "900" }}
                >
                  Lend More
                </Text>
                <Text style={{ color: "#DDD6FE", marginTop: 4 }}>
                  Give additional money to borrower
                </Text>
              </View>
            </View>

            {/* Loan summary pill */}
            {loan && (
              <View
                style={{
                  marginTop: 22,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  borderRadius: 18,
                  padding: 16,
                }}
              >
                <Text style={{ color: "#DDD6FE", fontSize: 12 }}>
                  Lending To
                </Text>
                <Text
                  style={{
                    color: "#FFF",
                    marginTop: 4,
                    fontWeight: "900",
                    fontSize: 18,
                  }}
                >
                  {loan.loan_name}
                </Text>
                <Text style={{ color: "#DDD6FE", marginTop: 6 }}>
                  Current Outstanding ₹
                  {Number(loan.outstanding_amount || 0).toLocaleString("en-IN")}
                </Text>
              </View>
            )}
          </View>

          {/* ── SOURCE ── */}
          <FieldCard
            icon="wallet-outline"
            color="#16A34A"
            title="Payment Source"
            value={
              selectedSource ? selectedSource.name : "Select Bank / Wallet"
            }
            error={errors.source}
            onPress={() => {
              setShowSourcePicker(true);

              setErrors((prev) => ({
                ...prev,
                source: undefined,
              }));
            }}
          />

          {/* ── CATEGORY ── */}
          <FieldCard
            icon="shape-outline"
            color="#EA580C"
            title="Category"
            value={selectedCategory ? selectedCategory.name : "Select Category"}
            error={errors.category}
            onPress={() => {
              setShowCategoryPicker(true);

              setErrors((prev) => ({
                ...prev,
                category: undefined,
              }));
            }}
          />

          {/* ── DATE & TIME ── */}
          <FieldCard
            icon="calendar-clock"
            color="#7C3AED"
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

          {/* ── AMOUNT ── */}
          <View style={styles.fieldWrapper}>
            <View
              style={[
                styles.amountCard,
                errors.amount && styles.amountCardError,
              ]}
            >
              <Text
                style={[
                  styles.amountLabel,
                  errors.amount && styles.amountLabelError,
                ]}
              >
                Amount to Lend
                <Text style={styles.requiredMark}> *</Text>
              </Text>

              <View style={styles.amountRow}>
                <View
                  style={[
                    styles.amountInputContainer,
                    amountFocused && {
                      borderColor: "#7C3AED",
                      borderWidth: 2,
                    },
                    errors.amount && styles.amountInputError,
                  ]}
                >
                  <Text
                    style={[
                      styles.currency,
                      errors.amount
                        ? styles.currencyError
                        : { color: "#7C3AED" },
                    ]}
                  >
                    ₹
                  </Text>

                  <TextInput
                    onFocus={() => setAmountFocused(true)}
                    onBlur={() => setAmountFocused(false)}
                    placeholder="Enter Amount"
                    value={String(amount)}
                    keyboardType="decimal-pad"
                    selectionColor="#7C3AED"
                    cursorColor="#7C3AED"
                    underlineColorAndroid="transparent"
                    placeholderTextColor="#94A3B8"
                    maxLength={12}
                    autoCorrect={false}
                    style={[
                      styles.amountInput,
                      errors.amount && styles.amountInputTextError,
                      { outlineStyle: "none" },
                    ]}
                    onChangeText={(text) => {
                      let value = text.replace(/[^0-9.]/g, "");

                      const dotIndex = value.indexOf(".");

                      if (dotIndex !== -1) {
                        value =
                          value.substring(0, dotIndex + 1) +
                          value.substring(dotIndex + 1).replace(/\./g, "");
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
          </View>

          {/* ── NOTES ── */}
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
              selectionColor="#7C3AED"
              cursorColor="#7C3AED"
              underlineColorAndroid="transparent"
              maxLength={250}
              style={[styles.notesInput, { outlineStyle: "none" }]}
            />
          </View>

          {/* ── SAVE BUTTON ── */}
          <View style={{ marginTop: 10, marginBottom: 25 }}>
            <PaperButton
              mode="contained"
              onPress={save}
              loading={loading}
              disabled={loading}
              style={[styles.saveButton, { backgroundColor: "#7C3AED" }]}
              contentStyle={{ height: 54 }}
              labelStyle={{
                fontSize: 16,
                fontWeight: "800",
              }}
              icon="hand-coin-outline"
            >
              Give Money
            </PaperButton>
          </View>
        </Card>
      </ScrollView>

      {/* ── SOURCE PICKER MODAL ── */}
      <Modal visible={showSourcePicker} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>Select Payment Source</Text>
                <Text style={styles.pickerSubtitle}>
                  Choose where the money is sent from
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
                    setShowSourcePicker(false);
                  }}
                />
              ))}
              <View style={{ height: 10 }} />
            </ScrollView>
            <PaperButton
              mode="outlined"
              style={{ marginTop: 12, borderRadius: 14 }}
              onPress={() => setShowSourcePicker(false)}
            >
              Close
            </PaperButton>
          </View>
        </View>
      </Modal>

      {/* ── CATEGORY PICKER MODAL ── */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>Select Category</Text>
                <Text style={styles.pickerSubtitle}>
                  Choose the expense category
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
            <ScrollView showsVerticalScrollIndicator={false}>
              {categories.map((category) => (
                <PickerItem
                  key={category.id}
                  icon={category.icon || "shape-outline"}
                  iconColor={category.color || "#EA580C"}
                  iconBg={(category.color || "#EA580C") + "20"}
                  selected={category.id === categoryId}
                  title={category.name}
                  subtitle={
                    category.type
                      ? `${category.type} Category`
                      : "Loan Category"
                  }
                  onPress={() => {
                    setCategoryId(category.id);
                    setShowCategoryPicker(false);
                  }}
                />
              ))}
              <View style={{ height: 10 }} />
            </ScrollView>
            <PaperButton
              mode="outlined"
              style={{ marginTop: 12, borderRadius: 14 }}
              onPress={() => setShowCategoryPicker(false)}
            >
              Close
            </PaperButton>
          </View>
        </View>
      </Modal>

      {/* ── DATE & TIME PICKER ── */}

      {showDatePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={safeDate(transactionDate)}
          mode={datePickerMode}
          display={datePickerMode === "date" ? "calendar" : "clock"}
          is24Hour={false}
          maximumDate={datePickerMode === "date" ? new Date() : undefined}
          onChange={handleNativeDateTimeChange}
        />
      )}

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
                maximumDate={datePickerMode === "date" ? new Date() : undefined}
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
                  const nextDate = new Date(year, month - 1, day, hour, minute);

                  setTransactionDate(nextDate.toISOString());
                }}
                onClose={closeDatePicker}
              />
            </View>
          </View>
        </Modal>
      )}
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
  fieldTitle: { color: "#64748B", fontSize: 12 },
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
  amountLabel: { color: "#64748B", fontSize: 12 },
  amountRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  currency: { fontSize: 30, fontWeight: "900", marginRight: 8 },
  amountInput: {
    flex: 1,
    fontSize: 30,
    fontWeight: "800",
    color: "#111827",
    paddingVertical: 8,
    minHeight: 54,
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
  },
  saveButton: { borderRadius: 18, marginTop: 10 },
  pickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  pickerSheet: {
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: "75%",
  },
  pickerHandle: {
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 18,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  pickerTitle: { fontSize: 21, fontWeight: "900", color: "#111827" },
  pickerSubtitle: { marginTop: 4, color: "#64748B" },
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
  fieldWrapper: {
    marginBottom: 14,
  },
  fieldCardError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF7F7",
  },
  fieldTitleError: {
    color: "#DC2626",
  },
  fieldValueError: {
    color: "#B91C1C",
  },
  requiredMark: {
    color: "#DC2626",
    fontWeight: "900",
  },
  fieldErrorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 8,
    marginTop: 7,
    gap: 6,
  },
  fieldErrorText: {
    flex: 1,
    color: "#DC2626",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  amountCardError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF7F7",
  },
  amountLabelError: {
    color: "#DC2626",
  },
  amountInputError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFFFFF",
  },
  currencyError: {
    color: "#DC2626",
  },
  amountInputTextError: {
    color: "#B91C1C",
  },
});
