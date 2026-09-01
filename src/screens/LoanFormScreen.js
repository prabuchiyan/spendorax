import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from "react-native";
import {
  TextInput as PaperTextInput,
  Button as PaperButton,
  Chip,
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import ConfirmDialog from "../components/ConfirmDialog";
import Card from "../components/Card";
import {
  createLoan,
  getLoanById,
  updateLoan,
  deleteLoan,
} from "../services/loans";
import { getSources } from "../services/sources";
import { getCategories } from "../services/categories";

const LOAN_TYPES = [
  { key: "Home", label: "Home Loan", icon: "home-outline" },
  { key: "Vehicle", label: "Vehicle Loan", icon: "car-outline" },
  { key: "Two Wheeler", label: "Two Wheeler", icon: "motorbike" },
  { key: "Personal", label: "Personal Loan", icon: "account-outline" },
  { key: "Education", label: "Education Loan", icon: "school-outline" },
  { key: "Business", label: "Business Loan", icon: "briefcase-outline" },
  { key: "Gold", label: "Gold Loan", icon: "gold" },
  {
    key: "Property",
    label: "Loan Against Property",
    icon: "office-building-outline",
  },
  { key: "Mortgage", label: "Mortgage", icon: "home-lock" },
  { key: "Credit Card", label: "Credit Card", icon: "credit-card-outline" },
  { key: "Overdraft", label: "Overdraft", icon: "bank-transfer" },
  {
    key: "Line of Credit",
    label: "Line of Credit",
    icon: "credit-card-plus-outline",
  },
  { key: "Consumer", label: "Consumer Durable", icon: "television" },
  { key: "Medical", label: "Medical Loan", icon: "hospital-box-outline" },
  { key: "Agriculture", label: "Agriculture Loan", icon: "sprout" },
  // Personal lending
  {
    key: "Friend",
    label: "Friend",
    icon: "handshake-outline",
  },
  {
    key: "Family",
    label: "Family",
    icon: "account-multiple-outline",
  },
  {
    key: "Employee",
    label: "Employee",
    icon: "account-tie-outline",
  },
  {
    key: "Employer",
    label: "Employer",
    icon: "office-building-outline",
  },
  {
    key: "Customer",
    label: "Customer",
    icon: "account-circle-outline",
  },
  {
    key: "Vendor",
    label: "Vendor",
    icon: "truck-delivery-outline",
  },
  {
    key: "Supplier",
    label: "Supplier",
    icon: "package-variant-closed",
  },
  {
    key: "Partner",
    label: "Business Partner",
    icon: "account-group-outline",
  },
  // Misc
  {
    key: "Bank",
    label: "Bank Loan",
    icon: "bank-outline",
  },
  {
    key: "Finance",
    label: "Finance Company",
    icon: "cash-multiple",
  },
  {
    key: "NBFC",
    label: "NBFC",
    icon: "domain",
  },
  {
    key: "Other",
    label: "Other",
    icon: "shape-outline",
  },
];

function asDate(value) {
  if (!value) {
    return new Date();
  }
  /*
   * Already a Date object
   */
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value;
  }
  /*
   * Never append T00:00:00 to an existing
   * ISO datetime.
   */
  const stringValue = String(value).trim();
  const parsed = new Date(stringValue);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  console.warn("[LoanForm] Invalid loan_start_date:", value);
  return new Date();
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-IN", {
    month: "short",
  });
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

function getInitialDate(value) {
  if (!value) {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

export default function LoanFormScreen({ navigation, route }) {
  const rawId = route?.params?.id ?? route?.params?.loanId;
  const editId = rawId != null && rawId !== "" ? Number(rawId) : null;
  const [loanData, setLoanData] = useState({
    loan_name: "",
    loan_type: "Other",
    lender: "",
    loan_direction: "BORROWED",
    principal_amount: "",
    interest_rate: "0",
    loan_start_date: new Date().toISOString(),
    tenure_months: "",
    emi_amount: "",
    emi_day: "",
    outstanding_amount: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [loadingLoan, setLoadingLoan] = useState(!!editId);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showDueDayPicker, setShowDueDayPicker] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [loanTypeSearch, setLoanTypeSearch] = useState("");
  const [sources, setSources] = useState([]);
  const [sourceId, setSourceId] = useState(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [sourceSearch, setSourceSearch] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [pickerMode, setPickerMode] = useState("date");

  useEffect(() => {
    if (!editId) {
      return;
    }
    let mounted = true;
    async function loadLoan() {
      try {
        setLoadingLoan(true);
        const d = await getLoanById(editId);
        if (!mounted || !d) {
          return;
        }
        setLoanData({
          loan_name: d.loan_name || "",
          loan_type: d.loan_type || "Other",
          lender: d.lender || "",
          loan_direction: d.loan_direction || "BORROWED",
          principal_amount:
            d.principal_amount != null ? String(d.principal_amount) : "",
          interest_rate:
            d.interest_rate != null ? String(d.interest_rate) : "0",
          loan_start_date: getInitialDate(d.loan_start_date),
          tenure_months: d.tenure_months != null ? String(d.tenure_months) : "",
          emi_amount: d.emi_amount != null ? String(d.emi_amount) : "",
          emi_day: d.emi_day != null ? String(d.emi_day) : "",
          outstanding_amount:
            d.outstanding_amount != null ? String(d.outstanding_amount) : "",
          notes: d.notes || "",
          created_at: d.created_at,
          updated_at: d.updated_at,
          status: d.status,
          principal_paid: d.principal_paid || 0,
        });

        /* Restore source/category only if the loan record contains them.
         * Existing update behavior remains unchanged below.
         */
        if (d.source_id != null) {
          setSourceId(d.source_id);
        }
        if (d.category_id != null) {
          setCategoryId(d.category_id);
        }
      } catch (e) {
        console.error("Failed to load loan:", e);
        if (mounted) {
          setErrors({
            form: e?.message || "Failed to load loan",
          });
        }
      } finally {
        if (mounted) {
          setLoadingLoan(false);
        }
      }
    }
    loadLoan();
    return () => {
      mounted = false;
    };
  }, [editId]);

  useEffect(() => {
    let mounted = true;
    async function loadSources() {
      try {
        const src = await getSources(true);
        if (!mounted) {
          return;
        }
        setSources(src || []);
        /* Default to the first source only when creating a new loan and no  source has already been selected. */
        if (!editId && src?.length > 0) {
          setSourceId((previous) => previous ?? src[0].id);
        }
      } catch (e) {
        console.warn("Failed to load sources", e);
      }
    }
    loadSources();
    return () => {
      mounted = false;
    };
  }, [editId]);

  useEffect(() => {
    let mounted = true;
    async function loadCategories() {
      try {
        const cats = await getCategories(true);
        if (!mounted) {
          return;
        }
        setCategories(cats || []);
      } catch (e) {
        console.warn("Failed to load categories", e);
      }
    }
    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  function setField(key, value) {
    setLoanData((previous) => ({
      ...previous,
      [key]: value,
    }));
    if (errors[key]) {
      setErrors((previous) => {
        const next = {
          ...previous,
        };
        delete next[key];
        return next;
      });
    }
  }

  function validate() {
    const next = {};
    if (!loanData.loan_name || !loanData.loan_name.trim()) {
      next.loan_name = "Loan name is required";
    }
    const principal = parseFloat(loanData.principal_amount);
    if (
      !loanData.principal_amount ||
      Number.isNaN(principal) ||
      principal <= 0
    ) {
      next.principal_amount = "Enter a valid principal amount";
    }
    const interestRate = parseFloat(loanData.interest_rate);
    if (
      loanData.interest_rate === "" ||
      Number.isNaN(interestRate) ||
      interestRate < 0
    ) {
      next.interest_rate = "Enter a valid interest rate";
    }
    if (loanData.emi_amount && Number.isNaN(parseFloat(loanData.emi_amount))) {
      next.emi_amount = "Invalid EMI amount";
    }
    if (!editId && !sourceId) {
      next.sourceId = "Select a payment source";
    }
    if (!editId && !categoryId) {
      next.categoryId = "Select a category";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (submitting || deleting) {
      return;
    }
    if (!validate()) {
      return;
    }
    let normalizedStartDate;
    try {
      const parsedStartDate = asDate(loanData.loan_start_date);
      if (Number.isNaN(parsedStartDate.getTime())) {
        throw new Error("Invalid loan start date");
      }
      normalizedStartDate = parsedStartDate.toISOString();
    } catch (e) {
      console.error("Invalid loan start date:", loanData.loan_start_date, e);
      setErrors((prev) => ({
        ...prev,
        loan_start_date: "Please select a valid start date and time",
      }));
      return;
    }
    const allowed = [
      "loan_name",
      "loan_type",
      "lender",
      "loan_direction",
      "principal_amount",
      "interest_rate",
      "loan_start_date",
      "loan_end_date",
      "tenure_months",
      "emi_amount",
      "emi_day",
      "outstanding_amount",
      "notes",
    ];
    const payload = {};
    allowed.forEach((key) => {
      const value = loanData[key];
      if (value !== undefined && value !== null && String(value) !== "") {
        payload[key] = value;
      }
    });

    if (payload.principal_amount !== undefined) {
      payload.principal_amount = Number(payload.principal_amount);
    }

    if (payload.interest_rate !== undefined) {
      payload.interest_rate = Number(payload.interest_rate || 0);
    }

    if (payload.tenure_months !== undefined) {
      payload.tenure_months = Number(payload.tenure_months || 0);
    }

    if (payload.emi_amount !== undefined) {
      payload.emi_amount = Number(payload.emi_amount || 0);
    }

    payload.loan_start_date = normalizedStartDate;

    // Source & Category
    if (!editId && sourceId) {
      payload.source_id = sourceId;
    }

    if (!editId && categoryId) {
      payload.category_id = categoryId;
    }

    // Outstanding amount
    if (editId) {
      const principalPaid = Number(loanData.principal_paid || 0);

      /* If no principal has been paid yet, keep outstanding equal to principal. */
      if (payload.principal_amount !== undefined && principalPaid === 0) {
        payload.outstanding_amount = payload.principal_amount;
      }
    } else if (
      payload.outstanding_amount === undefined &&
      payload.principal_amount !== undefined
    ) {
      /* New loan: outstanding starts at principal. */
      payload.outstanding_amount = payload.principal_amount;
    }

    // Save
    try {
      setSubmitting(true);
      console.log(
        "[LoanForm] Saving loan_start_date:",
        payload.loan_start_date,
      );
      if (editId) {
        await updateLoan(editId, payload);
      } else {
        await createLoan(payload);
      }
      navigation.goBack();
    } catch (e) {
      console.error("Save loan failed:", e);
      setErrors({
        form: e?.message || "Failed to save loan",
      });
    } finally {
      setSubmitting(false);
    }
  }
  async function confirmDelete() {
    if (!editId || deleting) {
      return;
    }
    try {
      setDeleting(true);
      await deleteLoan(editId);
      setShowConfirmDelete(false);
      navigation.popToTop();
    } catch (e) {
      console.error("Delete loan failed:", e);
      setShowConfirmDelete(false);
      setErrors({
        form: e?.message || "Failed to delete loan",
      });
    } finally {
      setDeleting(false);
    }
  }

  function handleCancel() {
    if (submitting) {
      return;
    }
    navigation.goBack();
  }

  /* Loan type search */
  const filteredLoanTypes = useMemo(() => {
    const search = loanTypeSearch.trim().toLowerCase();
    if (!search) {
      return LOAN_TYPES;
    }
    return LOAN_TYPES.filter((item) =>
      item.label.toLowerCase().includes(search),
    );
  }, [loanTypeSearch]);

  /* Source search */
  const filteredSources = useMemo(() => {
    const search = sourceSearch.trim().toLowerCase();
    if (!search) {
      return sources;
    }
    return sources.filter((source) =>
      String(source.name || "")
        .toLowerCase()
        .includes(search),
    );
  }, [sources, sourceSearch]);

  /* Category direction:
   * BORROWED -> income
   * LENT     -> expense */
  const directionCategories = useMemo(() => {
    const expectedType =
      loanData.loan_direction === "LENT" ? "expense" : "income";
    return categories.filter(
      (category) => String(category.type || "").toLowerCase() === expectedType,
    );
  }, [categories, loanData.loan_direction]);

  /* Category search */
  const filteredCategories = useMemo(() => {
    const search = categorySearch.trim().toLowerCase();
    if (!search) {
      return directionCategories;
    }
    return directionCategories.filter((category) =>
      String(category.name || "")
        .toLowerCase()
        .includes(search),
    );
  }, [directionCategories, categorySearch]);

  const selectedSource = sources.find(
    (source) => Number(source.id) === Number(sourceId),
  );

  const selectedCategory = categories.find(
    (category) => Number(category.id) === Number(categoryId),
  );

  const summary = useMemo(
    () => ({
      principal: loanData.principal_amount || "-",
      outstanding: loanData.outstanding_amount || "-",
      interest: loanData.interest_rate || "-",
      emi: loanData.emi_amount || "-",
      tenure: loanData.tenure_months || "-",
    }),
    [loanData],
  );

  function openStartDatePicker() {
    if (submitting) {
      return;
    }
    setPickerMode("date");
    setShowStartPicker(true);
  }

  function closeStartDatePicker() {
    setShowStartPicker(false);
    setPickerMode("date");
  }

  function handleNativeDateChange(event, selectedDate) {
    if (event?.type === "dismissed") {
      closeStartDatePicker();
      return;
    }
    if (!selectedDate) {
      return;
    }
    const existingDate = new Date(loanData.loan_start_date);
    const newDate = new Date(selectedDate);
    if (pickerMode === "date") {
      /* Preserve existing time. */
      newDate.setHours(
        existingDate.getHours(),
        existingDate.getMinutes(),
        0,
        0,
      );
      setField("loan_start_date", newDate.toISOString());
      if (Platform.OS === "android") {
        setShowStartPicker(false);
        setTimeout(() => {
          setPickerMode("time");
          setShowStartPicker(true);
        }, 250);
      } else {
        setPickerMode("time");
      }
      return;
    }

    /* TIME */
    const timeDate = new Date(loanData.loan_start_date);
    timeDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    setField("loan_start_date", timeDate.toISOString());
    closeStartDatePicker();
  }

  if (loadingLoan) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loaderText}>Loading loan...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* FORM ERROR */}
      {errors.form ? (
        <View style={styles.formError}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={20}
            color="#DC2626"
          />
          <Text style={styles.formErrorText}>{errors.form}</Text>
        </View>
      ) : null}

      {/* MONEY DIRECTION */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Money Direction</Text>
        <View style={styles.directionRow}>
          <Chip
            selected={loanData.loan_direction === "BORROWED"}
            onPress={() => {
              if (submitting) {
                return;
              }
              setField("loan_direction", "BORROWED");
              setCategoryId(null);
            }}
            disabled={submitting}
            style={styles.directionChip}
          >
            I Borrowed
          </Chip>

          <Chip
            selected={loanData.loan_direction === "LENT"}
            onPress={() => {
              if (submitting) {
                return;
              }
              setField("loan_direction", "LENT");
              setCategoryId(null);
            }}
            disabled={submitting}
            style={styles.directionChip}
          >
            I Lent
          </Chip>
        </View>
      </Card>

      {/* LOAN INFORMATION */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Loan Information</Text>
        <PaperTextInput
          label="Loan name"
          value={loanData.loan_name}
          onChangeText={(text) => setField("loan_name", text)}
          mode="outlined"
          left={<PaperTextInput.Icon icon="file-document-outline" />}
          style={styles.input}
          error={!!errors.loan_name}
          disabled={submitting}
        />
        {errors.loan_name ? (
          <Text style={styles.error}>{errors.loan_name}</Text>
        ) : null}
        <TouchableOpacity
          disabled={submitting}
          onPress={() => setShowTypePicker(true)}
          style={styles.selectWrapper}
        >
          <PaperTextInput
            label="Loan type"
            value={loanData.loan_type}
            editable={false}
            mode="outlined"
            left={<PaperTextInput.Icon icon="shape-outline" />}
            right={
              <PaperTextInput.Icon
                icon="chevron-down"
                onPress={() => setShowTypePicker(true)}
              />
            }
          />
        </TouchableOpacity>
        <PaperTextInput
          label={loanData.loan_direction === "LENT" ? "Borrower" : "Lender"}
          value={loanData.lender}
          onChangeText={(text) => setField("lender", text)}
          mode="outlined"
          left={
            <PaperTextInput.Icon
              icon={
                loanData.loan_direction === "LENT"
                  ? "account-outline"
                  : "bank-outline"
              }
            />
          }
          style={styles.input}
          disabled={submitting}
        />
        {/* PAYMENT SOURCE */}
        {!editId && (
          <>
            <TouchableOpacity
              disabled={submitting}
              onPress={() => setShowSourcePicker(true)}
              style={styles.selectWrapper}
            >
              <PaperTextInput
                label="Payment Source"
                value={selectedSource?.name || ""}
                editable={false}
                mode="outlined"
                left={
                  <PaperTextInput.Icon
                    icon={selectedSource?.icon || "wallet-outline"}
                    color={selectedSource?.color || "#4F46E5"}
                  />
                }
                right={
                  <PaperTextInput.Icon
                    icon="chevron-down"
                    onPress={() => setShowSourcePicker(true)}
                  />
                }
                error={!!errors.sourceId}
              />
            </TouchableOpacity>

            {errors.sourceId ? (
              <Text style={styles.error}>{errors.sourceId}</Text>
            ) : null}
          </>
        )}
        {/* CATEGORY */}
        {!editId && (
          <>
            <TouchableOpacity
              disabled={submitting}
              onPress={() => setShowCategoryPicker(true)}
              style={styles.selectWrapper}
            >
              <PaperTextInput
                label={
                  loanData.loan_direction === "LENT"
                    ? "Expense Category"
                    : "Income Category"
                }
                value={selectedCategory?.name || ""}
                editable={false}
                mode="outlined"
                left={
                  <PaperTextInput.Icon
                    icon={selectedCategory?.icon || "shape-outline"}
                    color={selectedCategory?.color || "#4F46E5"}
                  />
                }
                right={
                  <PaperTextInput.Icon
                    icon="chevron-down"
                    onPress={() => setShowCategoryPicker(true)}
                  />
                }
                error={!!errors.categoryId}
              />
            </TouchableOpacity>

            {errors.categoryId ? (
              <Text style={styles.error}>{errors.categoryId}</Text>
            ) : null}
          </>
        )}
      </Card>
      {/* FINANCIAL DETAILS */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Financial Details</Text>
        <PaperTextInput
          label="Principal amount"
          value={loanData.principal_amount}
          onChangeText={(text) => setField("principal_amount", text)}
          keyboardType="numeric"
          mode="outlined"
          left={<PaperTextInput.Icon icon="cash" />}
          style={styles.input}
          error={!!errors.principal_amount}
          disabled={submitting}
        />
        {errors.principal_amount ? (
          <Text style={styles.error}>{errors.principal_amount}</Text>
        ) : null}
        <PaperTextInput
          label="Interest rate (annual %)"
          value={loanData.interest_rate}
          onChangeText={(text) => setField("interest_rate", text)}
          keyboardType="numeric"
          mode="outlined"
          left={<PaperTextInput.Icon icon="percent-outline" />}
          style={styles.input}
          error={!!errors.interest_rate}
          disabled={submitting}
        />
        {errors.interest_rate ? (
          <Text style={styles.error}>{errors.interest_rate}</Text>
        ) : null}
        <PaperTextInput
          label="Outstanding amount"
          value={loanData.outstanding_amount}
          onChangeText={(text) => setField("outstanding_amount", text)}
          keyboardType="numeric"
          mode="outlined"
          left={<PaperTextInput.Icon icon="wallet-outline" />}
          style={styles.input}
          disabled={submitting}
        />
      </Card>
      {/* EMI DETAILS */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>EMI Information</Text>
        <PaperTextInput
          label="EMI amount"
          value={loanData.emi_amount}
          onChangeText={(text) => setField("emi_amount", text)}
          keyboardType="numeric"
          mode="outlined"
          left={<PaperTextInput.Icon icon="calendar-sync" />}
          style={styles.input}
          error={!!errors.emi_amount}
          disabled={submitting}
        />
        {errors.emi_amount ? (
          <Text style={styles.error}>{errors.emi_amount}</Text>
        ) : null}
        {/* EMI DUE DAY */}
        <TouchableOpacity
          disabled={submitting}
          onPress={() => setShowDueDayPicker(true)}
        >
          <PaperTextInput
            label="EMI due day"
            value={loanData.emi_day ? String(loanData.emi_day) : ""}
            editable={false}
            mode="outlined"
            left={<PaperTextInput.Icon icon="calendar-month" />}
            right={
              <PaperTextInput.Icon
                icon="chevron-down"
                onPress={() => setShowDueDayPicker(true)}
              />
            }
            style={styles.input}
          />
        </TouchableOpacity>
        {/* START DATE + TIME */}
        <TouchableOpacity disabled={submitting} onPress={openStartDatePicker}>
          <PaperTextInput
            label="Start date & time"
            value={formatDateTime(loanData.loan_start_date)}
            editable={false}
            mode="outlined"
            left={<PaperTextInput.Icon icon="calendar-clock-outline" />}
            right={
              <PaperTextInput.Icon
                icon="chevron-down"
                onPress={openStartDatePicker}
              />
            }
            style={styles.input}
          />
        </TouchableOpacity>
        <PaperTextInput
          label="Tenure (months)"
          value={loanData.tenure_months}
          onChangeText={(text) => setField("tenure_months", text)}
          keyboardType="numeric"
          mode="outlined"
          left={<PaperTextInput.Icon icon="calendar-range" />}
          style={styles.input}
          disabled={submitting}
        />
      </Card>
      {/* ADDITIONAL DETAILS */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Additional Details</Text>
        <PaperTextInput
          label="Notes (optional)"
          value={loanData.notes}
          onChangeText={(text) => setField("notes", text)}
          mode="outlined"
          multiline
          numberOfLines={3}
          style={styles.input}
          left={<PaperTextInput.Icon icon="note-text-outline" />}
          disabled={submitting}
        />
      </Card>
      {/* LOAN SUMMARY */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Loan Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryTile}>
            <MaterialCommunityIcons
              name="cash-multiple"
              size={26}
              color="#2563EB"
            />
            <Text style={styles.summaryTileLabel}>Principal</Text>
            <Text style={styles.summaryTileValue}>₹{summary.principal}</Text>
          </View>
          <View style={styles.summaryTile}>
            <MaterialCommunityIcons
              name="wallet-outline"
              size={26}
              color="#16A34A"
            />
            <Text style={styles.summaryTileLabel}>Outstanding</Text>
            <Text style={styles.summaryTileValue}>₹{summary.outstanding}</Text>
          </View>
          <View style={styles.summaryTile}>
            <MaterialCommunityIcons
              name="percent-outline"
              size={26}
              color="#F59E0B"
            />
            <Text style={styles.summaryTileLabel}>Interest</Text>
            <Text style={styles.summaryTileValue}>{summary.interest}%</Text>
          </View>
          <View style={styles.summaryTile}>
            <MaterialCommunityIcons
              name="calendar-check-outline"
              size={26}
              color="#7C3AED"
            />
            <Text style={styles.summaryTileLabel}>EMI</Text>
            <Text style={styles.summaryTileValue}>₹{summary.emi}</Text>
          </View>
        </View>
      </Card>
      {/* ACTIONS */}
      <View style={styles.buttonRow}>
        {editId ? (
          <PaperButton
            mode="outlined"
            onPress={() => setShowConfirmDelete(true)}
            disabled={submitting || deleting}
            loading={deleting}
            textColor="#DC2626"
            style={styles.deleteButton}
          >
            {deleting ? "Deleting..." : "Delete"}
          </PaperButton>
        ) : null}
        <PaperButton
          mode="contained"
          onPress={submit}
          loading={submitting}
          disabled={submitting || deleting}
          style={styles.primaryButton}
          contentStyle={styles.buttonContent}
        >
          {submitting
            ? editId
              ? "Updating..."
              : "Saving..."
            : editId
              ? "Update Loan"
              : "Save Loan"}
        </PaperButton>
        <PaperButton
          mode="outlined"
          onPress={handleCancel}
          disabled={submitting || deleting}
          style={styles.cancelButton}
          contentStyle={styles.buttonContent}
        >
          Cancel
        </PaperButton>
      </View>
      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        visible={showConfirmDelete}
        title="Delete Loan?"
        message="This will permanently delete the loan, all loan payments, and all transactions linked to this loan. This action cannot be undone."
        confirmLabel="Delete Loan"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setShowConfirmDelete(false)}
      />
      {/* LOAN TYPE PICKER */}
      {showTypePicker ? (
        <Modal
          visible={showTypePicker}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setLoanTypeSearch("");
            setShowTypePicker(false);
          }}
        >
          <View style={styles.sheetOverlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandleWrap}>
                <View style={styles.sheetHandle} />
              </View>
              <Text style={styles.sheetTitle}>Select Loan Type</Text>
              <PaperTextInput
                mode="outlined"
                value={loanTypeSearch}
                onChangeText={setLoanTypeSearch}
                placeholder="Search loan type..."
                left={<PaperTextInput.Icon icon="magnify" />}
                right={
                  loanTypeSearch ? (
                    <PaperTextInput.Icon
                      icon="close"
                      onPress={() => setLoanTypeSearch("")}
                    />
                  ) : null
                }
                style={styles.searchInput}
              />
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.chipContainer}
                keyboardShouldPersistTaps="handled"
              >
                {filteredLoanTypes.length === 0 ? (
                  <EmptyPickerState
                    icon="shape-outline"
                    text="No loan type found"
                  />
                ) : (
                  filteredLoanTypes.map((type) => {
                    const selected = loanData.loan_type === type.key;
                    return (
                      <Chip
                        key={type.key}
                        showSelectedCheck={false}
                        icon={type.icon}
                        onPress={() => {
                          setField("loan_type", type.key);
                          setLoanTypeSearch("");
                          setShowTypePicker(false);
                        }}
                        style={[
                          styles.loanTypeChip,
                          selected && styles.loanTypeChipSelected,
                        ]}
                        textStyle={[
                          styles.loanTypeChipText,
                          selected && styles.loanTypeChipTextSelected,
                        ]}
                      >
                        {type.label}
                      </Chip>
                    );
                  })
                )}
              </ScrollView>
              <PaperButton
                mode="contained"
                style={styles.closeButton}
                onPress={() => {
                  setLoanTypeSearch("");
                  setShowTypePicker(false);
                }}
              >
                Close
              </PaperButton>
            </View>
          </View>
        </Modal>
      ) : null}
      {/* EMI DUE DAY PICKER */}
      {showDueDayPicker ? (
        <Modal
          visible={showDueDayPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDueDayPicker(false)}
        >
          <View style={styles.sheetOverlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandleWrap}>
                <View style={styles.sheetHandle} />
              </View>
              <Text style={styles.sheetTitle}>Select EMI Due Day</Text>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.dayGrid}
              >
                {Array.from({
                  length: 31,
                }).map((_, index) => {
                  const day = String(index + 1);
                  const selected = String(loanData.emi_day) === day;
                  return (
                    <TouchableOpacity
                      key={day}
                      activeOpacity={0.85}
                      onPress={() => {
                        setField("emi_day", day);
                        setShowDueDayPicker(false);
                      }}
                      style={[
                        styles.dayTile,
                        selected && styles.dayTileSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          selected && styles.dayTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <PaperButton
                mode="contained"
                onPress={() => setShowDueDayPicker(false)}
                style={styles.closeButton}
              >
                Close
              </PaperButton>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* SOURCE PICKER */}
      {showSourcePicker ? (
        <Modal
          visible={showSourcePicker}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setSourceSearch("");
            setShowSourcePicker(false);
          }}
        >
          <View style={styles.sheetOverlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandleWrap}>
                <View style={styles.sheetHandle} />
              </View>
              <Text style={styles.sheetTitle}>Select Payment Source</Text>
              <Text style={styles.sheetSubtitle}>
                {loanData.loan_direction === "LENT"
                  ? "Money will be debited from this source"
                  : "Money will be credited to this source"}
              </Text>
              <PaperTextInput
                mode="outlined"
                value={sourceSearch}
                onChangeText={setSourceSearch}
                placeholder="Search source..."
                left={<PaperTextInput.Icon icon="magnify" />}
                right={
                  sourceSearch ? (
                    <PaperTextInput.Icon
                      icon="close"
                      onPress={() => setSourceSearch("")}
                    />
                  ) : null
                }
                style={styles.searchInput}
              />
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {filteredSources.length === 0 ? (
                  <EmptyPickerState
                    icon="wallet-outline"
                    text={
                      sourceSearch ? "No source found" : "No sources available"
                    }
                  />
                ) : (
                  filteredSources.map((source) => {
                    const selected = Number(source.id) === Number(sourceId);
                    const sourceColor = source.color || "#4F46E5";
                    return (
                      <TouchableOpacity
                        key={source.id}
                        activeOpacity={0.85}
                        onPress={() => {
                          setSourceId(source.id);
                          setSourceSearch("");
                          setShowSourcePicker(false);
                          if (errors.sourceId) {
                            setErrors((previous) => {
                              const next = {
                                ...previous,
                              };
                              delete next.sourceId;
                              return next;
                            });
                          }
                        }}
                        style={[
                          styles.sourceOption,
                          selected && {
                            backgroundColor: `${sourceColor}12`,
                            borderColor: sourceColor,
                            borderWidth: 1.5,
                          },
                        ]}
                      >
                        {/* SOURCE ICON */}
                        <View
                          style={[
                            styles.sourceIconWrap,
                            {
                              backgroundColor: `${sourceColor}18`,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={source.icon || "wallet-outline"}
                            size={22}
                            color={sourceColor}
                          />
                        </View>
                        {/* SOURCE INFO */}
                        <View style={styles.sourceInfo}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.sourceName,
                              {
                                color: selected ? sourceColor : "#111827",
                              },
                            ]}
                          >
                            {source.name}
                          </Text>
                          <View style={styles.sourceColorRow}>
                            <View
                              style={[
                                styles.sourceColorDot,
                                {
                                  backgroundColor: sourceColor,
                                },
                              ]}
                            />
                            <Text style={styles.sourceColorText}>Source</Text>
                          </View>
                        </View>
                        {selected ? (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={23}
                            color={sourceColor}
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={22}
                            color="#A8B0BB"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
                <View
                  style={{
                    height: 10,
                  }}
                />
              </ScrollView>

              <PaperButton
                mode="contained"
                style={styles.closeButton}
                onPress={() => {
                  setSourceSearch("");

                  setShowSourcePicker(false);
                }}
              >
                Close
              </PaperButton>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* CATEGORY PICKER */}
      {showCategoryPicker ? (
        <Modal
          visible={showCategoryPicker}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setCategorySearch("");

            setShowCategoryPicker(false);
          }}
        >
          <View style={styles.sheetOverlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandleWrap}>
                <View style={styles.sheetHandle} />
              </View>
              <Text style={styles.sheetTitle}>
                {loanData.loan_direction === "LENT"
                  ? "Select Expense Category"
                  : "Select Income Category"}
              </Text>
              <Text style={styles.sheetSubtitle}>
                {loanData.loan_direction === "LENT"
                  ? "Expense category for money given"
                  : "Income category for money received"}
              </Text>
              <PaperTextInput
                mode="outlined"
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder="Search category..."
                left={<PaperTextInput.Icon icon="magnify" />}
                right={
                  categorySearch ? (
                    <PaperTextInput.Icon
                      icon="close"
                      onPress={() => setCategorySearch("")}
                    />
                  ) : null
                }
                style={styles.searchInput}
              />

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {filteredCategories.length === 0 ? (
                  <EmptyPickerState
                    icon="shape-outline"
                    text={
                      categorySearch
                        ? "No category found"
                        : loanData.loan_direction === "LENT"
                          ? "No expense categories available"
                          : "No income categories available"
                    }
                  />
                ) : (
                  filteredCategories.map((category) => {
                    const selected = Number(category.id) === Number(categoryId);
                    const categoryColor = category.color || "#4F46E5";
                    return (
                      <TouchableOpacity
                        key={category.id}
                        activeOpacity={0.85}
                        onPress={() => {
                          setCategoryId(category.id);
                          setCategorySearch("");
                          setShowCategoryPicker(false);
                          if (errors.categoryId) {
                            setErrors((previous) => {
                              const next = {
                                ...previous,
                              };
                              delete next.categoryId;
                              return next;
                            });
                          }
                        }}
                        style={[
                          styles.sourceOption,
                          selected && {
                            backgroundColor: `${categoryColor}12`,
                            borderColor: categoryColor,
                            borderWidth: 1.5,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.sourceIconWrap,
                            {
                              backgroundColor: `${categoryColor}20`,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={category.icon || "shape-outline"}
                            size={22}
                            color={categoryColor}
                          />
                        </View>
                        <View style={styles.sourceInfo}>
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.sourceName,
                              {
                                color: selected ? categoryColor : "#111827",
                              },
                            ]}
                          >
                            {category.name}
                          </Text>
                          <View style={styles.sourceColorRow}>
                            <View
                              style={[
                                styles.sourceColorDot,
                                {
                                  backgroundColor: categoryColor,
                                },
                              ]}
                            />
                            <Text style={styles.sourceColorText}>
                              {loanData.loan_direction === "LENT"
                                ? "Expense"
                                : "Income"}
                            </Text>
                          </View>
                        </View>

                        {selected ? (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={23}
                            color={categoryColor}
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={22}
                            color="#A8B0BB"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
                <View
                  style={{
                    height: 10,
                  }}
                />
              </ScrollView>

              <PaperButton
                mode="contained"
                style={styles.closeButton}
                onPress={() => {
                  setCategorySearch("");

                  setShowCategoryPicker(false);
                }}
              >
                Close
              </PaperButton>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* START DATE / TIME PICKER */}
      {showStartPicker
        ? (() => {
            /* ANDROID Same native date -> time  flow as TransactionForm. */
            if (Platform.OS === "android") {
              return (
                <DateTimePicker
                  value={new Date(loanData.loan_start_date)}
                  mode={pickerMode}
                  display={pickerMode === "date" ? "calendar" : "clock"}
                  is24Hour={false}
                  onChange={handleNativeDateChange}
                />
              );
            }

            /* IOS */
            if (Platform.OS === "ios") {
              return (
                <Modal
                  visible={showStartPicker}
                  transparent
                  animationType="slide"
                  onRequestClose={closeStartDatePicker}
                >
                  <View style={styles.dateSheetOverlay}>
                    <View style={styles.dateSheet}>
                      <View style={styles.sheetHandleWrap}>
                        <View style={styles.sheetHandle} />
                      </View>
                      <Text style={styles.datePickerTitle}>
                        {pickerMode === "date" ? "Select Date" : "Select Time"}
                      </Text>
                      <View style={styles.nativePickerWrap}>
                        <DateTimePicker
                          value={new Date(loanData.loan_start_date)}
                          mode={pickerMode}
                          display="spinner"
                          is24Hour={false}
                          onChange={handleNativeDateChange}
                        />
                      </View>
                      <View style={styles.dateButtonRow}>
                        <PaperButton
                          mode="outlined"
                          onPress={closeStartDatePicker}
                          style={styles.dateActionButton}
                        >
                          Cancel
                        </PaperButton>
                        <PaperButton
                          mode="contained"
                          onPress={() => {
                            if (pickerMode === "date") {
                              setPickerMode("time");
                            } else {
                              closeStartDatePicker();
                            }
                          }}
                          style={styles.dateActionButton}
                        >
                          {pickerMode === "date" ? "Next" : "Done"}
                        </PaperButton>
                      </View>
                    </View>
                  </View>
                </Modal>
              );
            }

            /* WEB  Uses the same ManualDateTimePicker used by TransactionForm. */
            return (
              <Modal
                visible={showStartPicker}
                transparent
                animationType="slide"
                onRequestClose={closeStartDatePicker}
              >
                <View style={styles.webDateOverlay}>
                  <View style={styles.webDateCard}>
                    <Text style={styles.webDateTitle}>Pick Date / Time</Text>
                    {(() => {
                      const dt = new Date(
                        loanData.loan_start_date || new Date().toISOString(),
                      );
                      const year = dt.getFullYear();
                      const month = dt.getMonth() + 1;
                      const day = dt.getDate();
                      const hour = dt.getHours();
                      const minute = dt.getMinutes();
                      const ManualDateTimePicker =
                        require("../components/ManualDateTimePicker").default;
                      return (
                        <ManualDateTimePicker
                          year={year}
                          month={month}
                          day={day}
                          hour={hour}
                          minute={minute}
                          onChange={(
                            newYear,
                            newMonth,
                            newDay,
                            newHour,
                            newMinute,
                          ) => {
                            const newDate = new Date(
                              newYear,
                              newMonth - 1,
                              newDay,
                              newHour,
                              newMinute,
                            );
                            setField("loan_start_date", newDate.toISOString());
                          }}
                          onClose={closeStartDatePicker}
                        />
                      );
                    })()}
                  </View>
                </View>
              </Modal>
            );
          })()
        : null}
    </ScrollView>
  );
}

function EmptyPickerState({ icon, text }) {
  return (
    <View style={styles.emptyPicker}>
      <View style={styles.emptyPickerIcon}>
        <MaterialCommunityIcons name={icon} size={30} color="#94A3B8" />
      </View>
      <Text style={styles.emptyPickerText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#EEF4FF",
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 120,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EEF4FF",
    padding: 20,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  formError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  formErrorText: {
    flex: 1,
    marginLeft: 9,
    color: "#BE123C",
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderLeftWidth: 5,
    borderLeftColor: "#4F46E5",
    shadowColor: "#4F46E5",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2FF",
  },
  directionRow: {
    flexDirection: "row",
    marginTop: 8,
    flexWrap: "wrap",
  },
  directionChip: {
    marginRight: 8,
    marginBottom: 6,
  },
  input: {
    marginBottom: 16,
    backgroundColor: "#F8FAFF",
    overflow: "hidden",
  },
  selectWrapper: {
    marginBottom: 8,
  },
  error: {
    color: "#E46A6A",
    fontSize: 12,
    marginTop: -2,
    marginBottom: 10,
    marginLeft: 8,
    fontWeight: "600",
  },
  /* SUMMARY */
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  summaryTile: {
    width: "48%",
    borderRadius: 22,
    paddingVertical: 22,
    marginBottom: 14,
    alignItems: "center",
    backgroundColor: "#F8FAFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#4F46E5",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryTileLabel: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  summaryTileValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  /* BUTTONS */
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 30,
  },
  primaryButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: "#4F46E5",
    borderRadius: 14,
  },
  cancelButton: {
    marginLeft: 8,
    borderRadius: 14,
    borderColor: "#CBD5E1",
  },
  deleteButton: {
    borderRadius: 14,
    borderColor: "#FCA5A5",
  },
  buttonContent: {
    minHeight: 50,
  },
  /* SHEETS */
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 30,
    maxHeight: "82%",
  },
  sheetHandleWrap: {
    alignItems: "center",
    marginBottom: 14,
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D6D6D6",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  sheetSubtitle: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  searchInput: {
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
  },
  closeButton: {
    marginTop: 16,
    borderRadius: 14,
  },
  /* LOAN TYPE */
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  loanTypeChip: {
    marginRight: 10,
    marginBottom: 10,
    borderRadius: 24,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  loanTypeChipSelected: {
    backgroundColor: "#EEF2FF",
    borderColor: "#4F46E5",
  },
  loanTypeChipText: {
    color: "#475569",
    fontWeight: "600",
  },
  loanTypeChipTextSelected: {
    color: "#4F46E5",
    fontWeight: "700",
  },
  /* SOURCE / CATEGORY */
  sourceOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sourceIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 13,
  },
  sourceInfo: {
    flex: 1,
    minWidth: 0,
  },
  sourceName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  sourceColorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  sourceColorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  sourceColorText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  /* EMPTY */
  emptyPicker: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyPickerIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyPickerText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  /* EMI DAY */
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayTile: {
    width: "16.2%",
    aspectRatio: 1,
    margin: "0.2%",
    marginBottom: 10,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dayTileSelected: {
    backgroundColor: "#EEF2FF",
    borderColor: "#4F46E5",
  },
  dayText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
  },
  dayTextSelected: {
    color: "#4F46E5",
  },
  /* DATE PICKER */
  dateSheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  dateSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  datePickerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 20,
    textAlign: "center",
  },
  nativePickerWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },
  dateButtonRow: {
    flexDirection: "row",
    marginTop: 24,
  },
  dateActionButton: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 14,
  },
  /* WEB DATE PICKER */
  webDateOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  webDateCard: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 18,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  webDateTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
});
