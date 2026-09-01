import React, { useEffect, useState } from "react";
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
import { Button as PaperButton } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import ManualDateTimePicker from "../components/ManualDateTimePicker";
import Card from "../components/Card";
import { recordTopUp } from "../services/loans";
import { getSources } from "../services/sources";
import { getCategories } from "../services/categories";

// =============================================================================
// Helpers
// =============================================================================

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

// =============================================================================
// Field Card
// =============================================================================

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

// =============================================================================
// Picker Item
// =============================================================================

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
      style={[
        styles.pickerItem,
        {
          backgroundColor: selected ? "#EFF6FF" : "#FFFFFF",

          borderWidth: selected ? 1.5 : 1,

          borderColor: selected ? "#2563EB" : "#EEF2F7",
        },
      ]}
    >
      <View
        style={[
          styles.pickerItemIcon,
          {
            backgroundColor: iconBg,
          },
        ]}
      >
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      </View>

      <View
        style={{
          flex: 1,
        }}
      >
        <Text style={styles.pickerItemTitle} numberOfLines={1}>
          {title}
        </Text>

        {!!subtitle && (
          <Text style={styles.pickerItemSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {selected ? (
        <View style={styles.selectedIcon}>
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

// =============================================================================
// Field Validation Error
// =============================================================================

function FieldError({ message }) {
  if (!message) {
    return null;
  }

  return (
    <View style={styles.fieldErrorContainer}>
      <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />

      <Text style={styles.fieldErrorText}>{message}</Text>
    </View>
  );
}

// =============================================================================
// Top Up Screen
// =============================================================================

export default function TopUpScreen({ route, navigation }) {
  // -------------------------------------------------------------------------
  // Loan
  // -------------------------------------------------------------------------

  const loanId = route?.params?.id ?? route?.params?.loanId;

  const loanName = route?.params?.loanName || "Loan";

  // -------------------------------------------------------------------------
  // Form
  // -------------------------------------------------------------------------

  const [amount, setAmount] = useState("");

  const [notes, setNotes] = useState("");

  // -------------------------------------------------------------------------
  // Date & Time
  // -------------------------------------------------------------------------

  /*
   * Keep the date as an ISO string.
   * This is the same approach used by Transaction Form.
   */
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString(),
  );

  /*
   * Controls the date/time picker.
   */
  const [showDatePicker, setShowDatePicker] = useState(false);

  /*
   * "date" or "time"
   */
  const [datePickerMode, setDatePickerMode] = useState("date");

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------

  const [sources, setSources] = useState([]);

  const [categories, setCategories] = useState([]);

  // -------------------------------------------------------------------------
  // Selected Values
  // -------------------------------------------------------------------------

  const [sourceId, setSourceId] = useState(null);

  const [categoryId, setCategoryId] = useState(null);

  // -------------------------------------------------------------------------
  // Pickers
  // -------------------------------------------------------------------------

  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  const [loading, setLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Amount Focus
  // -------------------------------------------------------------------------

  const [amountFocused, setAmountFocused] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [errors, setErrors] = useState({});

  // =========================================================================
  // Load Sources & Categories
  // =========================================================================

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [sourceData, categoryData] = await Promise.all([
          getSources(),
          getCategories(),
        ]);

        if (!mounted) {
          return;
        }

        const loadedSources = sourceData || [];

        const loadedCategories = categoryData || [];

        setSources(loadedSources);

        setCategories(loadedCategories);

        /*
         * Default payment source.
         */
        if (loadedSources.length > 0) {
          setSourceId(loadedSources[0].id);
        }
      } catch (error) {
        console.warn("Failed to load top up data:", error);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  // =========================================================================
  // Selected Source / Category
  // =========================================================================

  const selectedSource = sources.find(
    (source) => Number(source.id) === Number(sourceId),
  );

  const selectedCategory = categories.find(
    (category) => Number(category.id) === Number(categoryId),
  );

  const incomeCategories = categories.filter(
    (category) => String(category.type || "").toLowerCase() === "income",
  );

  const filteredIncomeCategories = incomeCategories.filter((category) =>
    String(category.name || "")
      .toLowerCase()
      .includes(categorySearch.trim().toLowerCase()),
  );

  // =========================================================================
  // Handle Back
  // =========================================================================

  function handleBack() {
    if (loading) {
      return;
    }

    navigation.goBack();
  }

  // =========================================================================
  // Close Date Picker
  // =========================================================================

  function closeDatePicker() {
    setShowDatePicker(false);
    setDatePickerMode("date");
  }

  // =========================================================================
  // Native Date / Time Picker
  // =========================================================================

  function handleNativeDateTimeChange(event, selectedDate) {
    /*
     * Android sends dismissed event.
     */
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
      /*
       * Preserve existing time.
       * Only replace date.
       */
      next.setFullYear(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
      );
    } else {
      /*
       * Preserve existing date.
       * Only replace time.
       */
      next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    }

    setTransactionDate(next.toISOString());

    /*
     * Android:
     * Date picker closes automatically,
     * then open time picker.
     */
    if (Platform.OS === "android") {
      if (datePickerMode === "date") {
        setDatePickerMode("time");

        setTimeout(() => {
          setShowDatePicker(true);
        }, 150);
      } else {
        closeDatePicker();
      }

      return;
    }

    /*
     * iOS:
     * Keep modal open.
     * User presses Next / Done.
     */
  }

  // =========================================================================
  // Open Date Picker
  // =========================================================================

  function openDatePicker() {
    setDatePickerMode("date");

    setShowDatePicker(true);
  }

  // =========================================================================
  // Date / Time Picker Content
  // =========================================================================

  function renderDateTimePicker() {
    if (!showDatePicker) {
      return null;
    }

    // =======================================================================
    // ANDROID
    // =======================================================================

    if (Platform.OS === "android") {
      return (
        <DateTimePicker
          value={safeDate(transactionDate)}
          mode={datePickerMode}
          display={datePickerMode === "date" ? "calendar" : "clock"}
          is24Hour={false}
          maximumDate={datePickerMode === "date" ? new Date() : undefined}
          onChange={handleNativeDateTimeChange}
        />
      );
    }

    // =======================================================================
    // IOS
    // =======================================================================

    if (Platform.OS === "ios") {
      return (
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
      );
    }

    // =======================================================================
    // WEB
    // =======================================================================

    return (
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={closeDatePicker}
      >
        <View style={styles.webDateOverlay}>
          <View style={styles.webDateCard}>
            <View style={styles.webDateHeader}>
              <View
                style={{
                  flex: 1,
                }}
              >
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
    );
  }

  // =========================================================================
  // Validation
  // =========================================================================

  function validate() {
    const nextErrors = {};

    // -----------------------------------------------------------------------
    // Loan
    // -----------------------------------------------------------------------

    if (!loanId) {
      nextErrors.loan = "Please select a loan before continuing.";
    }

    // -----------------------------------------------------------------------
    // Amount
    // -----------------------------------------------------------------------

    const trimmedAmount = String(amount || "").trim();

    const numericAmount = Number(trimmedAmount);

    if (!trimmedAmount) {
      nextErrors.amount = "Please enter the top up amount.";
    } else if (Number.isNaN(numericAmount)) {
      nextErrors.amount = "Please enter a valid amount.";
    } else if (numericAmount <= 0) {
      nextErrors.amount = "Top up amount must be greater than ₹0.";
    }

    // -----------------------------------------------------------------------
    // Payment Source
    // -----------------------------------------------------------------------

    if (!sourceId) {
      nextErrors.source =
        "Please choose the account or wallet used for this top up.";
    }

    // -----------------------------------------------------------------------
    // Category
    // -----------------------------------------------------------------------

    if (!categoryId) {
      nextErrors.category = "Please choose a category for this top up.";
    }

    // -----------------------------------------------------------------------
    // Date & Time
    // -----------------------------------------------------------------------

    if (!transactionDate || Number.isNaN(safeDate(transactionDate).getTime())) {
      nextErrors.date = "Please select when this top up was made.";
    }

    // -----------------------------------------------------------------------
    // Save Errors
    // -----------------------------------------------------------------------

    setErrors(nextErrors);

    // -----------------------------------------------------------------------
    // Friendly validation feedback
    // -----------------------------------------------------------------------

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

  // =========================================================================
  // Save Top Up
  // =========================================================================

  async function save() {
    if (!validate()) {
      return;
    }

    try {
      setLoading(true);

      await recordTopUp({
        loanId: Number(loanId),

        /*
         * IMPORTANT:
         * Send the selected date AND time.
         */
        date: safeDate(transactionDate).toISOString(),

        amount: Number(amount),

        sourceId: Number(sourceId),

        categoryId: Number(categoryId),

        notes: notes.trim() || `Loan top up: ${loanName}`,
      });

      navigation.goBack();
    } catch (error) {
      console.error("Top Up failed:", error);

      Alert.alert(
        "Top Up Failed",
        error?.message || "Failed to record loan top up.",
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <Card style={styles.mainCard}>
          {/* ========================================================= */}
          {/* Header                                                     */}
          {/* ========================================================= */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons
                name="cash-plus"
                size={30}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Top Up Loan</Text>

              <Text style={styles.headerSubtitle}>
                Add an additional amount to this loan
              </Text>
            </View>
          </View>
          {/* ========================================================= */}
          {/* Loan Summary                                               */}
          {/* ========================================================= */}
          <View style={styles.loanSummary}>
            <View style={styles.loanSummaryIcon}>
              <MaterialCommunityIcons name="bank" size={22} color="#2563EB" />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text style={styles.loanSummaryLabel}>Selected Loan</Text>

              <Text style={styles.loanSummaryName} numberOfLines={1}>
                {loanName}
              </Text>

              <Text style={styles.loanSummarySubtext}>
                Additional borrowing
              </Text>
            </View>
          </View>
          {/* ========================================================= */}
          {/* Payment Source                                             */}
          {/* ========================================================= */}
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
          {/* ========================================================= */}
          {/* Category                                                   */}
          {/* ========================================================= */}
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
          {/* ========================================================= */}
          {/* Date & Time                                                */}
          {/* ========================================================= */}
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
          {/* ========================================================= */}
          {/* Amount                                                     */}
          {/* ========================================================= */}

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
                Top Up Amount
                <Text style={styles.requiredMark}> *</Text>
              </Text>

              <View
                style={[
                  styles.amountInputContainer,
                  amountFocused && styles.amountInputFocused,
                  errors.amount && styles.amountInputError,
                ]}
              >
                <Text
                  style={[
                    styles.currency,
                    errors.amount && styles.currencyError,
                  ]}
                >
                  ₹
                </Text>

                <TextInput
                  value={amount}
                  onChangeText={(text) => {
                    let value = text.replace(/[^0-9.]/g, "");

                    const dotIndex = value.indexOf(".");

                    if (dotIndex !== -1) {
                      value =
                        value.substring(0, dotIndex + 1) +
                        value.substring(dotIndex + 1).replace(/\./g, "");
                    }

                    setAmount(value);

                    // Clear amount error immediately
                    if (errors.amount) {
                      setErrors((prev) => ({
                        ...prev,
                        amount: undefined,
                      }));
                    }
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Enter Amount"
                  placeholderTextColor="#94A3B8"
                  selectionColor="#2563EB"
                  cursorColor="#2563EB"
                  onFocus={() => setAmountFocused(true)}
                  onBlur={() => setAmountFocused(false)}
                  style={styles.amountInput}
                  editable={!loading}
                />
              </View>
            </View>

            <FieldError message={errors.amount} />
          </View>
          {/* ========================================================= */}
          {/* Notes                                                      */}
          {/* ========================================================= */}
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Notes (Optional)</Text>

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add remarks"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              selectionColor="#2563EB"
              cursorColor="#2563EB"
              style={styles.notesInput}
              editable={!loading}
            />
          </View>
          {/* ========================================================= */}
          {/* Confirm Button                                             */}
          {/* ========================================================= */}
          <PaperButton
            mode="contained"
            buttonColor="#2563EB"
            onPress={save}
            loading={loading}
            disabled={loading}
            icon="cash-plus"
            style={styles.saveButton}
            contentStyle={{
              height: 54,
            }}
            labelStyle={{
              fontSize: 16,
              fontWeight: "800",
            }}
          >
            Confirm Top Up
          </PaperButton>
        </Card>
      </ScrollView>

      {/* ================================================================= */}
      {/* DATE & TIME PICKER                                                */}
      {/* ================================================================= */}

      {renderDateTimePicker()}

      {/* ================================================================= */}
      {/* Payment Source Picker                                              */}
      {/* ================================================================= */}

      <Modal
        visible={showSourcePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSourcePicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />

            <View style={styles.pickerHeader}>
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text style={styles.pickerTitle}>Select Payment Source</Text>

                <Text style={styles.pickerSubtitle}>
                  Choose where the top up money comes from
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
                  selected={Number(source.id) === Number(sourceId)}
                  title={source.name}
                  subtitle="Payment Account"
                  onPress={() => {
                    setSourceId(source.id);

                    setShowSourcePicker(false);
                  }}
                />
              ))}

              {sources.length === 0 && (
                <View style={styles.emptyPicker}>
                  <MaterialCommunityIcons
                    name="wallet-off-outline"
                    size={32}
                    color="#94A3B8"
                  />

                  <Text style={styles.emptyPickerText}>
                    No payment sources found
                  </Text>
                </View>
              )}
            </ScrollView>

            <PaperButton
              mode="outlined"
              style={styles.pickerCloseButton}
              onPress={() => setShowSourcePicker(false)}
            >
              Close
            </PaperButton>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* Category Picker                                                   */}
      {/* ================================================================= */}

      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCategoryPicker(false);
          setCategorySearch("");
        }}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />

            {/* Header */}
            <View style={styles.pickerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerTitle}>Select Income Category</Text>

                <Text style={styles.pickerSubtitle}>
                  Choose an income category for this top up
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setShowCategoryPicker(false);
                  setCategorySearch("");
                }}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={28}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.categorySearchContainer}>
              <MaterialCommunityIcons
                name="magnify"
                size={22}
                color="#64748B"
              />

              <TextInput
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder="Search income category..."
                placeholderTextColor="#94A3B8"
                style={styles.categorySearchInput}
                autoCorrect={false}
                autoCapitalize="none"
              />

              {categorySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCategorySearch("")}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Category List */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {filteredIncomeCategories.map((category) => (
                <PickerItem
                  key={category.id}
                  icon={category.icon || "cash-plus"}
                  iconColor={category.color || "#16A34A"}
                  iconBg={(category.color || "#16A34A") + "20"}
                  selected={Number(category.id) === Number(categoryId)}
                  title={category.name}
                  subtitle="Income Category"
                  onPress={() => {
                    setCategoryId(category.id);
                    setCategorySearch("");
                    setShowCategoryPicker(false);

                    setErrors((prev) => ({
                      ...prev,
                      category: undefined,
                    }));
                  }}
                />
              ))}

              {/* No Results */}
              {filteredIncomeCategories.length === 0 && (
                <View style={styles.emptyPicker}>
                  <View style={styles.emptyPickerIcon}>
                    <MaterialCommunityIcons
                      name="magnify-close"
                      size={30}
                      color="#94A3B8"
                    />
                  </View>

                  <Text style={styles.emptyPickerTitle}>
                    No income category found
                  </Text>

                  <Text style={styles.emptyPickerText}>
                    Try searching with a different name.
                  </Text>
                </View>
              )}
            </ScrollView>

            <PaperButton
              mode="outlined"
              style={styles.pickerCloseButton}
              onPress={() => {
                setShowCategoryPicker(false);
                setCategorySearch("");
              }}
            >
              Close
            </PaperButton>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // =========================================================================
  // Page
  // =========================================================================

  container: {
    flex: 1,
    backgroundColor: "#F3F6FB",
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  mainCard: {
    borderRadius: 24,
    overflow: "hidden",
  },

  // =========================================================================
  // Header
  // =========================================================================

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    margin: -16,
    marginBottom: 18,
    padding: 20,
    minHeight: 100,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerBackButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },

  headerSubtitle: {
    color: "#DBEAFE",
    marginTop: 5,
    fontSize: 13,
  },

  // =========================================================================
  // Loan Summary
  // =========================================================================

  loanSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },

  loanSummaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  loanSummaryLabel: {
    color: "#64748B",
    fontSize: 12,
  },

  loanSummaryName: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
  },

  loanSummarySubtext: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 3,
  },

  // =========================================================================
  // Field Card
  // =========================================================================

  fieldCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    minHeight: 72,
    borderWidth: 1,
    borderColor: "#EEF2F7",
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
    fontWeight: "600",
  },

  fieldValue: {
    marginTop: 4,
    fontWeight: "800",
    fontSize: 15,
    color: "#111827",
  },

  // =========================================================================
  // Date Picker - iOS
  // =========================================================================

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

  // =========================================================================
  // Date Picker - Web
  // =========================================================================

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

  // =========================================================================
  // Amount
  // =========================================================================

  amountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },

  amountLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
  },

  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#D6E4FF",
    borderRadius: 18,
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 16,
    minHeight: 68,
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

  // =========================================================================
  // Notes
  // =========================================================================

  notesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#EEF2F7",
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

  // =========================================================================
  // Save Button
  // =========================================================================

  saveButton: {
    borderRadius: 18,
    marginTop: 4,
    marginBottom: 10,
  },

  // =========================================================================
  // Picker
  // =========================================================================

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

  pickerTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#111827",
  },

  pickerSubtitle: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 13,
  },

  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },

  pickerItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  pickerItemTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  pickerItemSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748B",
  },

  selectedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },

  pickerCloseButton: {
    marginTop: 12,
    borderRadius: 14,
  },

  emptyPicker: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 35,
  },

  emptyPickerText: {
    marginTop: 10,
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "600",
    marginTop: -10,
    marginBottom: 12,
    marginLeft: 4,
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

  amountInputFocused: {
    borderColor: "#2563EB",
    borderWidth: 2,
  },

  amountInputError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF7F7",
  },

  fieldWrapper: {
    marginBottom: 14,
  },

  amountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },

  amountCardError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF7F7",
  },

  amountLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
  },

  amountLabelError: {
    color: "#DC2626",
  },

  requiredMark: {
    color: "#DC2626",
    fontWeight: "900",
  },

  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#D6E4FF",
    borderRadius: 18,
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 16,
    minHeight: 68,
  },

  amountInputFocused: {
    borderColor: "#2563EB",
    borderWidth: 2,
  },

  amountInputError: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFFFFF",
  },

  currency: {
    fontSize: 30,
    fontWeight: "900",
    color: "#2563EB",
    marginRight: 8,
  },

  currencyError: {
    color: "#DC2626",
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
  categorySearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D6E4FF",
    borderRadius: 16,
    minHeight: 52,
    paddingHorizontal: 14,
    marginBottom: 14,
  },

  categorySearchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 8,
    outlineStyle: "none",
  },

  emptyPickerIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  emptyPickerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#334155",
  },

  emptyPickerText: {
    marginTop: 5,
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
  },
});
