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
} from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import ConfirmDialog from "../components/ConfirmDialog";

import {
  createLoan,
  getLoanById,
  updateLoan,
  deleteLoan,
} from "../services/loans";

import { getSources } from "../services/sources";
import { getCategories } from "../services/categories";

/* =========================================================
   LOAN TYPES
   Icons intentionally kept to very common MCI icons.
========================================================= */

const LOAN_TYPES = [
  { key: "Home", label: "Home Loan", icon: "home-outline" },
  { key: "Vehicle", label: "Vehicle Loan", icon: "car-outline" },
  { key: "Two Wheeler", label: "Two Wheeler", icon: "motorbike" },
  { key: "Personal", label: "Personal Loan", icon: "account-cash-outline" },
  { key: "Education", label: "Education Loan", icon: "school-outline" },
  { key: "Business", label: "Business Loan", icon: "briefcase-outline" },
  { key: "Gold", label: "Gold Loan", icon: "gold" },
  { key: "Property", label: "Loan Against Property", icon: "office-building-outline" },
  { key: "Mortgage", label: "Mortgage", icon: "home-city-outline" },
  { key: "Credit Card", label: "Credit Card", icon: "credit-card-outline" },
  { key: "Overdraft", label: "Overdraft", icon: "bank-transfer-out" },
  { key: "Line of Credit", label: "Line of Credit", icon: "cash-multiple" },
  { key: "Consumer", label: "Consumer Durable", icon: "washing-machine" },
  { key: "Medical", label: "Medical Loan", icon: "medical-bag" },
  { key: "Agriculture", label: "Agriculture Loan", icon: "sprout-outline" },
  { key: "Friend", label: "Friend", icon: "account-heart-outline" },
  { key: "Family", label: "Family", icon: "account-group-outline" },
  { key: "Employee", label: "Employee", icon: "account-tie-outline" },
  { key: "Employer", label: "Employer", icon: "briefcase-account-outline" },
  { key: "Customer", label: "Customer", icon: "account-outline" },
  { key: "Vendor", label: "Vendor", icon: "store-outline" },
  { key: "Supplier", label: "Supplier", icon: "truck-outline" },
  { key: "Partner", label: "Business Partner", icon: "handshake-outline" },
  { key: "Bank", label: "Bank Loan", icon: "bank-outline" },
  { key: "Finance", label: "Finance Company", icon: "finance" },
  { key: "NBFC", label: "NBFC", icon: "domain" },
  { key: "Other", label: "Other", icon: "dots-horizontal-circle-outline" },
];
/* =========================================================
   DIRECTION CONFIG
========================================================= */

const DIRECTION_CONFIG = {
  BORROWED: {
    label: "Loan",
    color: "#2563EB",
    accentLight: "#EFF6FF",
    personLabel: "Lender",
    personIcon: "account-outline",
    amountLabel: "Loan Amount",
    sourceLabel: "Credited To",
    categoryLabel: "Income Category",
    categoryType: "income",
  },

  LENT: {
    label: "Lend",
    color: "#7C3AED",
    accentLight: "#F5F3FF",
    personLabel: "Borrower",
    personIcon: "account-outline",
    amountLabel: "Amount Lent",
    sourceLabel: "Debited From",
    categoryLabel: "Expense Category",
    categoryType: "expense",
  },
};

/* =========================================================
   FIELD CONFIG
========================================================= */

const LOAN_FIELD_CONFIG = {
  Home: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  Vehicle: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  "Two Wheeler": {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  Personal: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  Education: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  Business: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  Property: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  Mortgage: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  Consumer: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  Medical: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  Agriculture: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  Bank: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  Finance: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  NBFC: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },

  Gold: {
    interest: true,
    tenure: false,
    emi: false,
    dueDay: false,
  },

  "Credit Card": {
    interest: true,
    tenure: false,
    emi: true,
    dueDay: true,
  },

  Overdraft: {
    interest: true,
    tenure: false,
    emi: true,
    dueDay: true,
  },

  "Line of Credit": {
    interest: true,
    tenure: false,
    emi: true,
    dueDay: true,
  },

  Friend: {
    interest: false,
    tenure: false,
    emi: true,
    dueDay: true,
  },

  Family: {
    interest: false,
    tenure: false,
    emi: true,
    dueDay: true,
  },

  Employee: {
    interest: false,
    tenure: false,
    emi: true,
    dueDay: true,
  },

  Employer: {
    interest: false,
    tenure: false,
    emi: true,
    dueDay: true,
  },

  Customer: {
    interest: false,
    tenure: false,
    emi: true,
    dueDay: true,
  },

  Vendor: {
    interest: false,
    tenure: false,
    emi: true,
    dueDay: true,
  },

  Supplier: {
    interest: false,
    tenure: false,
    emi: true,
    dueDay: true,
  },

  Partner: {
    interest: false,
    tenure: false,
    emi: true,
    dueDay: true,
  },

  Other: {
    interest: true,
    tenure: true,
    emi: true,
    dueDay: true,
  },
};

function getLoanFieldConfig(loanType, loanData, editId) {
  const base =
    LOAN_FIELD_CONFIG[loanType] ||
    LOAN_FIELD_CONFIG.Other;

  const hasValue = (value) =>
    value !== undefined &&
    value !== null &&
    String(value).trim() !== "";

  return {
    interest:
      base.interest ||
      (!!editId && hasValue(loanData.interest_rate)),

    tenure:
      base.tenure ||
      (!!editId && hasValue(loanData.tenure_months)),

    emi:
      base.emi ||
      (!!editId && hasValue(loanData.emi_amount)),

    dueDay:
      base.dueDay ||
      (!!editId && hasValue(loanData.emi_day)),

    // Always show outstanding while editing.
    outstanding: !!editId,
  };
}

/* =========================================================
   DATE HELPERS
========================================================= */

function asDate(value) {
  if (!value) {
    return new Date();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? new Date()
      : value;
  }

  const stringValue = String(value).trim();
  const parsed = new Date(stringValue);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  console.warn(
    "[LoanForm] Invalid loan_start_date:",
    value
  );

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

  const minutes = String(
    d.getMinutes()
  ).padStart(2, "0");

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

/* =========================================================
   MAIN SCREEN
========================================================= */

export default function LoanFormScreen({
  navigation,
  route,
}) {
  const rawId =
    route?.params?.id ??
    route?.params?.loanId;

  const editId =
    rawId != null &&
      rawId !== ""
      ? Number(rawId)
      : null;

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

  const [loadingLoan, setLoadingLoan] =
    useState(!!editId);

  const [submitting, setSubmitting] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  /* Pickers */

  const [showTypePicker, setShowTypePicker] =
    useState(false);

  const [showStartPicker, setShowStartPicker] =
    useState(false);

  const [showDueDayPicker, setShowDueDayPicker] =
    useState(false);

  const [showConfirmDelete, setShowConfirmDelete] =
    useState(false);

  /* Type */

  const [loanTypeSearch, setLoanTypeSearch] =
    useState("");

  /* Sources */

  const [sources, setSources] = useState([]);
  const [sourceId, setSourceId] = useState(null);
  const [showSourcePicker, setShowSourcePicker] =
    useState(false);
  const [sourceSearch, setSourceSearch] =
    useState("");

  /* Categories */

  const [categoryId, setCategoryId] =
    useState(null);

  const [categories, setCategories] =
    useState([]);

  const [showCategoryPicker, setShowCategoryPicker] =
    useState(false);

  const [categorySearch, setCategorySearch] =
    useState("");

  /* Date */

  const [pickerMode, setPickerMode] =
    useState("date");

  const cfg =
    DIRECTION_CONFIG[
    loanData.loan_direction
    ] ||
    DIRECTION_CONFIG.BORROWED;

  const fieldConfig =
    getLoanFieldConfig(
      loanData.loan_type,
      loanData,
      editId
    );

  /* =========================================================
     LOAD EDIT LOAN
  ========================================================= */

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

          loan_type:
            d.loan_type || "Other",

          lender:
            d.lender || "",

          loan_direction:
            d.loan_direction || "BORROWED",

          principal_amount:
            d.principal_amount != null
              ? String(d.principal_amount)
              : "",

          interest_rate:
            d.interest_rate != null
              ? String(d.interest_rate)
              : "0",

          loan_start_date:
            getInitialDate(
              d.loan_start_date
            ),

          tenure_months:
            d.tenure_months != null
              ? String(d.tenure_months)
              : "",

          emi_amount:
            d.emi_amount != null
              ? String(d.emi_amount)
              : "",

          emi_day:
            d.emi_day != null
              ? String(d.emi_day)
              : "",

          outstanding_amount:
            d.outstanding_amount != null
              ? String(d.outstanding_amount)
              : "",

          notes:
            d.notes || "",

          created_at: d.created_at,
          updated_at: d.updated_at,
          status: d.status,

          principal_paid:
            d.principal_paid || 0,
        });

        if (d.source_id != null) {
          setSourceId(d.source_id);
        }

        if (d.category_id != null) {
          setCategoryId(d.category_id);
        }
      } catch (e) {
        console.error(
          "Failed to load loan:",
          e
        );

        if (mounted) {
          setErrors({
            form:
              e?.message ||
              "Failed to load loan",
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

  /* =========================================================
     LOAD SOURCES
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    async function loadSources() {
      try {
        const src = await getSources(true);

        if (!mounted) {
          return;
        }

        setSources(src || []);

        if (
          !editId &&
          src?.length > 0
        ) {
          setSourceId(
            (previous) =>
              previous ?? src[0].id
          );
        }
      } catch (e) {
        console.warn(
          "Failed to load sources",
          e
        );
      }
    }

    loadSources();

    return () => {
      mounted = false;
    };
  }, [editId]);

  /* =========================================================
     LOAD CATEGORIES
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    async function loadCategories() {
      try {
        const cats =
          await getCategories(true);

        if (!mounted) {
          return;
        }

        setCategories(cats || []);
      } catch (e) {
        console.warn(
          "Failed to load categories",
          e
        );
      }
    }

    loadCategories();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================================================
     FIELD UPDATE
  ========================================================= */

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

  /* =========================================================
     VALIDATION
  ========================================================= */

  function validate() {
    const next = {};

    if (
      !loanData.loan_name ||
      !loanData.loan_name.trim()
    ) {
      next.loan_name =
        "Loan name is required";
    }

    const principal = parseFloat(
      loanData.principal_amount
    );

    if (
      !loanData.principal_amount ||
      Number.isNaN(principal) ||
      principal <= 0
    ) {
      next.principal_amount =
        "Enter a valid amount";
    }

    const interestRate = parseFloat(
      loanData.interest_rate
    );

    if (
      loanData.interest_rate === "" ||
      Number.isNaN(interestRate) ||
      interestRate < 0
    ) {
      next.interest_rate =
        "Enter a valid interest rate";
    }

    if (
      loanData.emi_amount &&
      Number.isNaN(
        parseFloat(
          loanData.emi_amount
        )
      )
    ) {
      next.emi_amount =
        "Invalid EMI amount";
    }

    if (!editId && !sourceId) {
      next.sourceId =
        "Select an account";
    }

    if (!editId && !categoryId) {
      next.categoryId =
        "Select a category";
    }

    setErrors(next);

    return (
      Object.keys(next).length === 0
    );
  }

  /* =========================================================
     SUBMIT
  ========================================================= */

  async function submit() {
    if (
      submitting ||
      deleting
    ) {
      return;
    }

    if (!validate()) {
      return;
    }

    let normalizedStartDate;

    try {
      const parsedStartDate =
        asDate(
          loanData.loan_start_date
        );

      if (
        Number.isNaN(
          parsedStartDate.getTime()
        )
      ) {
        throw new Error(
          "Invalid loan start date"
        );
      }

      normalizedStartDate =
        parsedStartDate.toISOString();
    } catch (e) {
      console.error(
        "Invalid loan start date:",
        loanData.loan_start_date,
        e
      );

      setErrors((prev) => ({
        ...prev,
        loan_start_date:
          "Please select a valid date",
      }));

      return;
    }

    /* Keep existing service allowlist */

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
      const value =
        loanData[key];

      if (
        value !== undefined &&
        value !== null &&
        String(value) !== ""
      ) {
        payload[key] = value;
      }
    });

    if (
      payload.principal_amount !==
      undefined
    ) {
      payload.principal_amount =
        Number(
          payload.principal_amount
        );
    }

    if (
      payload.interest_rate !==
      undefined
    ) {
      payload.interest_rate =
        Number(
          payload.interest_rate || 0
        );
    }

    if (
      payload.tenure_months !==
      undefined
    ) {
      payload.tenure_months =
        Number(
          payload.tenure_months || 0
        );
    }

    if (
      payload.emi_amount !==
      undefined
    ) {
      payload.emi_amount =
        Number(
          payload.emi_amount || 0
        );
    }

    if (
      payload.emi_day !==
      undefined
    ) {
      payload.emi_day =
        Number(
          payload.emi_day || 0
        );
    }

    payload.loan_start_date =
      normalizedStartDate;

    /* Source & Category */

    if (!editId && sourceId) {
      payload.source_id =
        sourceId;
    }

    if (!editId && categoryId) {
      payload.category_id =
        categoryId;
    }

    /* Outstanding */

    if (editId) {
      const principalPaid =
        Number(
          loanData.principal_paid ||
          0
        );

      if (
        payload.principal_amount !==
        undefined &&
        principalPaid === 0
      ) {
        payload.outstanding_amount =
          payload.principal_amount;
      }
    } else if (
      payload.outstanding_amount ===
      undefined &&
      payload.principal_amount !==
      undefined
    ) {
      payload.outstanding_amount =
        payload.principal_amount;
    }

    /* Save */

    try {
      setSubmitting(true);

      await new Promise(
        (resolve) => {
          requestAnimationFrame(
            resolve
          );
        }
      );

      console.log(
        "[LoanForm] Saving loan_start_date:",
        payload.loan_start_date
      );

      if (editId) {
        await updateLoan(
          editId,
          payload
        );
      } else {
        await createLoan(
          payload
        );
      }

      navigation.goBack();
    } catch (e) {
      console.error(
        "Save loan failed:",
        e
      );

      setErrors({
        form:
          e?.message ||
          "Failed to save loan",
      });
    } finally {
      setSubmitting(false);
    }
  }

  /* =========================================================
     DELETE
  ========================================================= */

  async function confirmDelete() {
    if (
      !editId ||
      deleting
    ) {
      return;
    }

    try {
      setDeleting(true);

      await deleteLoan(editId);

      setShowConfirmDelete(false);

      navigation.popToTop();
    } catch (e) {
      console.error(
        "Delete loan failed:",
        e
      );

      setShowConfirmDelete(false);

      setErrors({
        form:
          e?.message ||
          "Failed to delete loan",
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

  /* =========================================================
     FILTERS
  ========================================================= */

  const filteredLoanTypes =
    useMemo(() => {
      const search =
        loanTypeSearch
          .trim()
          .toLowerCase();

      if (!search) {
        return LOAN_TYPES;
      }

      return LOAN_TYPES.filter(
        (item) =>
          item.label
            .toLowerCase()
            .includes(search)
      );
    }, [loanTypeSearch]);

  const filteredSources =
    useMemo(() => {
      const search =
        sourceSearch
          .trim()
          .toLowerCase();

      if (!search) {
        return sources;
      }

      return sources.filter(
        (source) =>
          String(
            source.name || ""
          )
            .toLowerCase()
            .includes(search)
      );
    }, [
      sources,
      sourceSearch,
    ]);

  const directionCategories =
    useMemo(() => {
      const expectedType =
        loanData.loan_direction ===
          "LENT"
          ? "expense"
          : "income";

      return categories.filter(
        (category) =>
          String(
            category.type || ""
          ).toLowerCase() ===
          expectedType
      );
    }, [
      categories,
      loanData.loan_direction,
    ]);

  const filteredCategories =
    useMemo(() => {
      const search =
        categorySearch
          .trim()
          .toLowerCase();

      if (!search) {
        return directionCategories;
      }

      return directionCategories.filter(
        (category) =>
          String(
            category.name || ""
          )
            .toLowerCase()
            .includes(search)
      );
    }, [
      directionCategories,
      categorySearch,
    ]);

  const selectedSource =
    sources.find(
      (source) =>
        Number(source.id) ===
        Number(sourceId)
    );

  const selectedCategory =
    categories.find(
      (category) =>
        Number(category.id) ===
        Number(categoryId)
    );

  /* =========================================================
     DATE PICKER
  ========================================================= */

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

  function handleNativeDateChange(
    event,
    selectedDate
  ) {
    if (
      event?.type ===
      "dismissed"
    ) {
      closeStartDatePicker();
      return;
    }

    if (!selectedDate) {
      return;
    }

    const existingDate =
      new Date(
        loanData.loan_start_date
      );

    const newDate =
      new Date(selectedDate);

    if (
      pickerMode === "date"
    ) {
      newDate.setHours(
        existingDate.getHours(),
        existingDate.getMinutes(),
        0,
        0
      );

      setField(
        "loan_start_date",
        newDate.toISOString()
      );

      if (
        Platform.OS ===
        "android"
      ) {
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

    const timeDate =
      new Date(
        loanData.loan_start_date
      );

    timeDate.setHours(
      selectedDate.getHours(),
      selectedDate.getMinutes(),
      0,
      0
    );

    setField(
      "loan_start_date",
      timeDate.toISOString()
    );

    closeStartDatePicker();
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loadingLoan) {
    return (
      <View
        style={
          styles.loaderContainer
        }
      >
        <ActivityIndicator
          size="large"
          color="#2563EB"
        />

        <Text
          style={
            styles.loaderText
          }
        >
          Loading loan...
        </Text>
      </View>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* =================================================
            TOP HEADER
        ================================================= */}

        <View style={styles.topHeader}>
          <View style={styles.headerTextWrap}>
            <Text
              style={styles.title}
            >
              {editId
                ? `Edit ${cfg.label}`
                : `New ${cfg.label}`}
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              {loanData.loan_direction ===
                "BORROWED"
                ? "Track money you borrowed"
                : "Track money you lent"}
            </Text>
          </View>

          <View
            style={[
              styles.headerIcon,
              {
                backgroundColor:
                  cfg.accentLight,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={
                loanData.loan_direction ===
                  "BORROWED"
                  ? "bank-outline"
                  : "cash"
              }
              size={23}
              color={cfg.color}
            />
          </View>
        </View>

        {/* =================================================
            ERROR
        ================================================= */}

        {errors.form ? (
          <View
            style={styles.formError}
          >
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={19}
              color="#DC2626"
            />

            <Text
              style={
                styles.formErrorText
              }
            >
              {errors.form}
            </Text>
          </View>
        ) : null}

        {/* =================================================
            BORROW / LEND SWITCH
        ================================================= */}

        <View
          style={
            styles.segmentContainer
          }
        >
          {[
            "BORROWED",
            "LENT",
          ].map((direction) => {
            const active =
              loanData.loan_direction ===
              direction;

            const color =
              DIRECTION_CONFIG[
                direction
              ].color;

            return (
              <TouchableOpacity
                key={direction}
                activeOpacity={0.8}
                disabled={
                  submitting
                }
                onPress={() => {
                  setField(
                    "loan_direction",
                    direction
                  );

                  setCategoryId(
                    null
                  );
                }}
                style={[
                  styles.segment,
                  active && {
                    backgroundColor:
                      color,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && {
                      color: "#FFFFFF",
                    },
                  ]}
                >
                  {direction ===
                    "BORROWED"
                    ? "I Borrowed"
                    : "I Lent"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* =================================================
            MAIN FORM
        ================================================= */}

        <View
          style={styles.formCard}
        >
          {/* NAME */}

          <CompactInput
            label={
              loanData.loan_direction ===
                "BORROWED"
                ? "Loan name"
                : "Lend name"
            }
            value={
              loanData.loan_name
            }
            onChangeText={(text) =>
              setField(
                "loan_name",
                text
              )
            }
            placeholder={
              loanData.loan_direction ===
                "BORROWED"
                ? "Home Loan"
                : "Money lent to Ravi"
            }
            icon="file-document-outline"
            disabled={submitting}
            error={
              errors.loan_name
            }
          />

          {/* TYPE */}
          <CompactSelect
            label="Type"
            value={
              LOAN_TYPES.find(
                (item) =>
                  item.key === loanData.loan_type
              )?.label || loanData.loan_type
            }
            icon={
              LOAN_TYPES.find(
                (item) =>
                  item.key === loanData.loan_type
              )?.icon || "bank-outline"
            }
            onPress={() =>
              setShowTypePicker(true)
            }
            disabled={submitting}
            color={cfg.color}
          />

          {/* PERSON */}
          <CompactInput
            label={
              cfg.personLabel
            }
            value={
              loanData.lender
            }
            onChangeText={(text) =>
              setField(
                "lender",
                text
              )
            }
            placeholder={
              loanData.loan_direction ===
                "BORROWED"
                ? "Who gave you the money?"
                : "Who received the money?"
            }
            icon="account-outline"
            disabled={submitting}
          />

          {/* AMOUNT */}

          <CompactInput
            label={
              cfg.amountLabel
            }
            value={
              loanData.principal_amount
            }
            onChangeText={(text) =>
              setField(
                "principal_amount",
                text
              )
            }
            keyboardType="numeric"
            placeholder="0"
            icon="cash"
            disabled={submitting}
            error={
              errors.principal_amount
            }
            accent={
              cfg.color
            }
            large
          />

          {/* INTEREST + TENURE */}

          {fieldConfig.interest ||
            fieldConfig.tenure ? (
            <View
              style={
                styles.row
              }
            >
              {fieldConfig.interest ? (
                <View
                  style={
                    styles.half
                  }
                >
                  <CompactInput
                    label="Interest %"
                    value={
                      loanData.interest_rate
                    }
                    onChangeText={(
                      text
                    ) =>
                      setField(
                        "interest_rate",
                        text
                      )
                    }
                    keyboardType="numeric"
                    placeholder="0"
                    icon="percent"
                    disabled={
                      submitting
                    }
                    error={
                      errors.interest_rate
                    }
                  />
                </View>
              ) : null}

              {fieldConfig.tenure ? (
                <View
                  style={
                    styles.half
                  }
                >
                  <CompactInput
                    label="Tenure"
                    value={
                      loanData.tenure_months
                    }
                    onChangeText={(
                      text
                    ) =>
                      setField(
                        "tenure_months",
                        text
                      )
                    }
                    keyboardType="numeric"
                    placeholder="Months"
                    icon="calendar"
                    disabled={
                      submitting
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {/* EMI + DUE DAY */}

          {fieldConfig.emi ||
            fieldConfig.dueDay ? (
            <View
              style={
                styles.row
              }
            >
              {fieldConfig.emi ? (
                <View
                  style={
                    styles.half
                  }
                >
                  <CompactInput
                    label={
                      loanData.loan_direction ===
                        "BORROWED"
                        ? "EMI"
                        : "Instalment"
                    }
                    value={
                      loanData.emi_amount
                    }
                    onChangeText={(
                      text
                    ) =>
                      setField(
                        "emi_amount",
                        text
                      )
                    }
                    keyboardType="numeric"
                    placeholder="0"
                    icon="cash"
                    disabled={
                      submitting
                    }
                    error={
                      errors.emi_amount
                    }
                  />
                </View>
              ) : null}

              {fieldConfig.dueDay ? (
                <View
                  style={
                    styles.half
                  }
                >
                  <CompactSelect
                    label="Due day"
                    value={
                      loanData.emi_day
                        ? `Day ${loanData.emi_day}`
                        : "Select day"
                    }
                    icon="calendar"
                    onPress={() =>
                      setShowDueDayPicker(
                        true
                      )
                    }
                    disabled={
                      submitting
                    }
                    color={
                      cfg.color
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {/* START DATE */}

          <CompactSelect
            label={
              loanData.loan_direction ===
                "BORROWED"
                ? "Start date"
                : "Date lent"
            }
            value={formatDateTime(
              loanData.loan_start_date
            )}
            icon="calendar"
            onPress={
              openStartDatePicker
            }
            disabled={submitting}
            color={cfg.color}
          />

          {/* OUTSTANDING ONLY WHEN EDITING */}

          {fieldConfig.outstanding ? (
            <CompactInput
              label="Outstanding"
              value={
                loanData.outstanding_amount
              }
              onChangeText={(text) =>
                setField(
                  "outstanding_amount",
                  text
                )
              }
              keyboardType="numeric"
              placeholder="Outstanding amount"
              icon="wallet-outline"
              disabled={
                submitting
              }
              accent={
                "#16A34A"
              }
            />
          ) : null}

          {/* ACCOUNT + CATEGORY */}

          {!editId ? (
            <>
              <View
                style={
                  styles.divider
                }
              />

              <Text
                style={
                  styles.subSectionTitle
                }
              >
                Transaction setup
              </Text>

              <View
                style={
                  styles.row
                }
              >
                <View
                  style={
                    styles.half
                  }
                >
                  <CompactSelect
                    label={cfg.sourceLabel}
                    value={selectedSource?.name || "Select account"}
                    icon={selectedSource?.icon || "wallet-outline"}
                    onPress={() => setShowSourcePicker(true)}
                    disabled={submitting}
                    color={selectedSource?.color || cfg.color}
                    error={errors.sourceId}
                  />
                </View>

                <View
                  style={
                    styles.half
                  }
                >
                  <CompactSelect
                    label="Category"
                    value={selectedCategory?.name || "Select category"}
                    icon={selectedCategory?.icon || "shape-outline"}
                    onPress={() => setShowCategoryPicker(true)}
                    disabled={submitting}
                    color={selectedCategory?.color || cfg.color}
                    error={errors.categoryId}
                  />
                </View>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={
              submitting ||
              deleting
            }
            onPress={handleCancel}
            style={styles.cancelButton}
          >
            <Text
              style={
                styles.cancelButtonText
              }
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <PaperButton
            mode="contained"
            onPress={submit}
            loading={submitting}
            disabled={
              submitting ||
              deleting
            }
            buttonColor={cfg.color}
            textColor="#FFFFFF"
            style={styles.saveButton}
            contentStyle={
              styles.saveButtonContent
            }
            icon={
              submitting
                ? undefined
                : "check"
            }
          >
            {submitting
              ? editId
                ? "Updating..."
                : "Saving..."
              : editId
                ? `Update ${cfg.label}`
                : `Save ${cfg.label}`}
          </PaperButton>
        </View>

        {editId ? (
          <TouchableOpacity
            activeOpacity={0.75}
            disabled={
              submitting ||
              deleting
            }
            onPress={() =>
              setShowConfirmDelete(true)
            }
            style={
              styles.deleteAction
            }
          >
            <MaterialCommunityIcons
              name="delete-outline"
              size={17}
              color="#DC2626"
            />

            <Text
              style={
                styles.deleteActionText
              }
            >
              Delete this loan
            </Text>
          </TouchableOpacity>
        ) : null}

        <View
          style={
            styles.bottomSpace
          }
        />
      </ScrollView>

      {/* =====================================================
          DELETE CONFIRMATION
      ===================================================== */}

      <ConfirmDialog
        visible={
          showConfirmDelete
        }
        title={`Delete ${cfg.label}?`}
        message={`This will permanently delete this ${cfg.label.toLowerCase()}, all payments, and all linked transactions. This cannot be undone.`}
        confirmLabel={`Delete ${cfg.label}`}
        cancelLabel="Cancel"
        onConfirm={
          confirmDelete
        }
        onCancel={() =>
          !deleting &&
          setShowConfirmDelete(
            false
          )
        }
      />

      {/* =====================================================
          TYPE PICKER
      ===================================================== */}

      <Modal
        visible={
          showTypePicker
        }
        transparent
        animationType="slide"
        onRequestClose={() => {
          setLoanTypeSearch("");
          setShowTypePicker(
            false
          );
        }}
      >
        <View
          style={
            styles.sheetOverlay
          }
        >
          <View
            style={
              styles.sheet
            }
          >
            <View
              style={
                styles.sheetHandle
              }
            />

            <View
              style={
                styles.sheetHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sheetTitle
                  }
                >
                  Loan type
                </Text>

                <Text
                  style={
                    styles.sheetSubtitle
                  }
                >
                  Choose the type that best matches
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setLoanTypeSearch(
                    ""
                  );
                  setShowTypePicker(
                    false
                  );
                }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <PaperTextInput
              mode="outlined"
              value={
                loanTypeSearch
              }
              onChangeText={
                setLoanTypeSearch
              }
              placeholder="Search type"
              left={
                <PaperTextInput.Icon
                  icon="magnify"
                />
              }
              right={
                loanTypeSearch ? (
                  <PaperTextInput.Icon
                    icon="close"
                    onPress={() =>
                      setLoanTypeSearch(
                        ""
                      )
                    }
                  />
                ) : null
              }
              style={
                styles.searchInput
              }
              dense
            />

            <ScrollView
              style={
                styles.sheetScroll
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              {filteredLoanTypes.length ===
                0 ? (
                <EmptyPickerState
                  icon="format-list-bulleted"
                  text="No type found"
                />
              ) : (
                filteredLoanTypes.map(
                  (type) => {
                    const selected =
                      loanData.loan_type ===
                      type.key;

                    return (
                      <TouchableOpacity
                        key={
                          type.key
                        }
                        activeOpacity={
                          0.8
                        }
                        onPress={() => {
                          setField(
                            "loan_type",
                            type.key
                          );

                          setLoanTypeSearch(
                            ""
                          );

                          setShowTypePicker(
                            false
                          );
                        }}
                        style={[
                          styles.simplePickerItem,
                          selected && {
                            backgroundColor:
                              cfg.accentLight,
                            borderColor:
                              cfg.color,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.simplePickerIcon,
                            {
                              backgroundColor:
                                selected
                                  ? cfg.color
                                  : "#F1F5F9",
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={type.icon || "bank-outline"}
                            size={20}
                            color={
                              selected
                                ? "#FFFFFF"
                                : "#64748B"
                            }
                          />
                        </View>

                        <Text
                          style={[
                            styles.simplePickerText,
                            selected && {
                              color:
                                cfg.color,
                              fontWeight:
                                "700",
                            },
                          ]}
                        >
                          {
                            type.label
                          }
                        </Text>

                        {selected ? (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={20}
                            color={
                              cfg.color
                            }
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={20}
                            color="#CBD5E1"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }
                )
              )}

              <View
                style={{
                  height: 16,
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =====================================================
          DUE DAY PICKER
      ===================================================== */}

      <Modal
        visible={
          showDueDayPicker
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setShowDueDayPicker(
            false
          )
        }
      >
        <View
          style={
            styles.sheetOverlay
          }
        >
          <View
            style={
              styles.smallSheet
            }
          >
            <View
              style={
                styles.sheetHandle
              }
            />

            <View
              style={
                styles.sheetHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sheetTitle
                  }
                >
                  Payment day
                </Text>

                <Text
                  style={
                    styles.sheetSubtitle
                  }
                >
                  Select the monthly due day
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setShowDueDayPicker(
                    false
                  )
                }
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <View
              style={
                styles.dayGrid
              }
            >
              {Array.from({
                length: 31,
              }).map(
                (_, index) => {
                  const day =
                    String(
                      index + 1
                    );

                  const selected =
                    String(
                      loanData.emi_day
                    ) === day;

                  return (
                    <TouchableOpacity
                      key={day}
                      activeOpacity={
                        0.8
                      }
                      onPress={() => {
                        setField(
                          "emi_day",
                          day
                        );

                        setShowDueDayPicker(
                          false
                        );
                      }}
                      style={[
                        styles.dayTile,
                        selected && {
                          backgroundColor:
                            cfg.color,
                          borderColor:
                            cfg.color,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          selected && {
                            color:
                              "#FFFFFF",
                          },
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* =====================================================
          SOURCE PICKER
      ===================================================== */}

      <Modal
        visible={
          showSourcePicker
        }
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSourceSearch("");
          setShowSourcePicker(
            false
          );
        }}
      >
        <View
          style={
            styles.sheetOverlay
          }
        >
          <View
            style={
              styles.sheet
            }
          >
            <View
              style={
                styles.sheetHandle
              }
            />

            <View
              style={
                styles.sheetHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sheetTitle
                  }
                >
                  {cfg.sourceLabel}
                </Text>

                <Text
                  style={
                    styles.sheetSubtitle
                  }
                >
                  Select the account used for this transaction
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setSourceSearch(
                    ""
                  );
                  setShowSourcePicker(
                    false
                  );
                }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <PaperTextInput
              mode="outlined"
              value={
                sourceSearch
              }
              onChangeText={
                setSourceSearch
              }
              placeholder="Search account"
              left={
                <PaperTextInput.Icon
                  icon="magnify"
                />
              }
              right={
                sourceSearch ? (
                  <PaperTextInput.Icon
                    icon="close"
                    onPress={() =>
                      setSourceSearch(
                        ""
                      )
                    }
                  />
                ) : null
              }
              style={
                styles.searchInput
              }
              dense
            />

            <ScrollView
              style={
                styles.sheetScroll
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              {filteredSources.length ===
                0 ? (
                <EmptyPickerState
                  icon="wallet-outline"
                  text={
                    sourceSearch
                      ? "No account found"
                      : "No accounts available"
                  }
                />
              ) : (
                filteredSources.map(
                  (source) => {
                    const selected =
                      Number(
                        source.id
                      ) ===
                      Number(
                        sourceId
                      );

                    const color =
                      source.color ||
                      cfg.color;

                    return (
                      <TouchableOpacity
                        key={
                          source.id
                        }
                        activeOpacity={
                          0.8
                        }
                        onPress={() => {
                          setSourceId(
                            source.id
                          );

                          setSourceSearch(
                            ""
                          );

                          setShowSourcePicker(
                            false
                          );

                          if (
                            errors.sourceId
                          ) {
                            setErrors(
                              (
                                previous
                              ) => {
                                const next =
                                {
                                  ...previous,
                                };

                                delete next.sourceId;

                                return next;
                              }
                            );
                          }
                        }}
                        style={[
                          styles.simplePickerItem,
                          selected && {
                            backgroundColor:
                              `${color}12`,
                            borderColor:
                              color,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.simplePickerIcon,
                            {
                              backgroundColor:
                                `${color}18`,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={source.icon || "wallet-outline"}
                            size={20}
                            color={color}
                          />
                        </View>

                        <View
                          style={
                            styles.pickerTextWrap
                          }
                        >
                          <Text
                            numberOfLines={
                              1
                            }
                            style={[
                              styles.simplePickerText,
                              selected && {
                                color:
                                  color,
                                fontWeight:
                                  "700",
                              },
                            ]}
                          >
                            {
                              source.name
                            }
                          </Text>
                        </View>

                        {selected ? (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={20}
                            color={
                              color
                            }
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={20}
                            color="#CBD5E1"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }
                )
              )}

              <View
                style={{
                  height: 16,
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =====================================================
          CATEGORY PICKER
      ===================================================== */}

      <Modal
        visible={
          showCategoryPicker
        }
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCategorySearch("");
          setShowCategoryPicker(
            false
          );
        }}
      >
        <View
          style={
            styles.sheetOverlay
          }
        >
          <View
            style={
              styles.sheet
            }
          >
            <View
              style={
                styles.sheetHandle
              }
            />

            <View
              style={
                styles.sheetHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sheetTitle
                  }
                >
                  {cfg.categoryLabel}
                </Text>

                <Text
                  style={
                    styles.sheetSubtitle
                  }
                >
                  Choose the transaction category
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setCategorySearch(
                    ""
                  );
                  setShowCategoryPicker(
                    false
                  );
                }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <PaperTextInput
              mode="outlined"
              value={
                categorySearch
              }
              onChangeText={
                setCategorySearch
              }
              placeholder="Search category"
              left={
                <PaperTextInput.Icon
                  icon="magnify"
                />
              }
              right={
                categorySearch ? (
                  <PaperTextInput.Icon
                    icon="close"
                    onPress={() =>
                      setCategorySearch(
                        ""
                      )
                    }
                  />
                ) : null
              }
              style={
                styles.searchInput
              }
              dense
            />

            <ScrollView
              style={
                styles.sheetScroll
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              {filteredCategories.length ===
                0 ? (
                <EmptyPickerState
                  icon="tag-outline"
                  text={
                    categorySearch
                      ? "No category found"
                      : `No ${cfg.categoryType} categories available`
                  }
                />
              ) : (
                filteredCategories.map(
                  (category) => {
                    const selected =
                      Number(
                        category.id
                      ) ===
                      Number(
                        categoryId
                      );

                    const color =
                      category.color ||
                      cfg.color;

                    return (
                      <TouchableOpacity
                        key={
                          category.id
                        }
                        activeOpacity={
                          0.8
                        }
                        onPress={() => {
                          setCategoryId(
                            category.id
                          );

                          setCategorySearch(
                            ""
                          );

                          setShowCategoryPicker(
                            false
                          );

                          if (
                            errors.categoryId
                          ) {
                            setErrors(
                              (
                                previous
                              ) => {
                                const next =
                                {
                                  ...previous,
                                };

                                delete next.categoryId;

                                return next;
                              }
                            );
                          }
                        }}
                        style={[
                          styles.simplePickerItem,
                          selected && {
                            backgroundColor:
                              `${color}12`,
                            borderColor:
                              color,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.simplePickerIcon,
                            {
                              backgroundColor:
                                `${color}18`,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={category.icon || "shape-outline"}
                            size={20}
                            color={color}
                          />
                        </View>

                        <View
                          style={
                            styles.pickerTextWrap
                          }
                        >
                          <Text
                            numberOfLines={
                              1
                            }
                            style={[
                              styles.simplePickerText,
                              selected && {
                                color:
                                  color,
                                fontWeight:
                                  "700",
                              },
                            ]}
                          >
                            {
                              category.name
                            }
                          </Text>
                        </View>

                        {selected ? (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={20}
                            color={
                              color
                            }
                          />
                        ) : (
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={20}
                            color="#CBD5E1"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }
                )
              )}

              <View
                style={{
                  height: 16,
                }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* =====================================================
          DATE PICKER
      ===================================================== */}

      {showStartPicker
        ? (() => {
          if (
            Platform.OS ===
            "android"
          ) {
            return (
              <DateTimePicker
                value={
                  new Date(
                    loanData.loan_start_date
                  )
                }
                mode={
                  pickerMode
                }
                display={
                  pickerMode ===
                    "date"
                    ? "calendar"
                    : "clock"
                }
                is24Hour={false}
                onChange={
                  handleNativeDateChange
                }
              />
            );
          }

          if (
            Platform.OS ===
            "ios"
          ) {
            return (
              <Modal
                visible={
                  showStartPicker
                }
                transparent
                animationType="slide"
                onRequestClose={
                  closeStartDatePicker
                }
              >
                <View
                  style={
                    styles.dateSheetOverlay
                  }
                >
                  <View
                    style={
                      styles.dateSheet
                    }
                  >
                    <View
                      style={
                        styles.sheetHandle
                      }
                    />

                    <Text
                      style={
                        styles.datePickerTitle
                      }
                    >
                      {pickerMode ===
                        "date"
                        ? "Select Date"
                        : "Select Time"}
                    </Text>

                    <View
                      style={
                        styles.nativePickerWrap
                      }
                    >
                      <DateTimePicker
                        value={
                          new Date(
                            loanData.loan_start_date
                          )
                        }
                        mode={
                          pickerMode
                        }
                        display="spinner"
                        is24Hour={
                          false
                        }
                        onChange={
                          handleNativeDateChange
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.dateButtonRow
                      }
                    >
                      <PaperButton
                        mode="outlined"
                        onPress={
                          closeStartDatePicker
                        }
                        style={
                          styles.dateActionButton
                        }
                      >
                        Cancel
                      </PaperButton>

                      <PaperButton
                        mode="contained"
                        buttonColor={
                          cfg.color
                        }
                        textColor="#FFFFFF"
                        onPress={() => {
                          if (
                            pickerMode ===
                            "date"
                          ) {
                            setPickerMode(
                              "time"
                            );
                          } else {
                            closeStartDatePicker();
                          }
                        }}
                        style={
                          styles.dateActionButton
                        }
                      >
                        {pickerMode ===
                          "date"
                          ? "Next"
                          : "Done"}
                      </PaperButton>
                    </View>
                  </View>
                </View>
              </Modal>
            );
          }

          /* WEB */

          return (
            <Modal
              visible={
                showStartPicker
              }
              transparent
              animationType="fade"
              onRequestClose={
                closeStartDatePicker
              }
            >
              <View
                style={
                  styles.webDateOverlay
                }
              >
                <View
                  style={
                    styles.webDateCard
                  }
                >
                  <View
                    style={
                      styles.sheetHeader
                    }
                  >
                    <Text
                      style={
                        styles.sheetTitle
                      }
                    >
                      Pick date & time
                    </Text>

                    <TouchableOpacity
                      onPress={
                        closeStartDatePicker
                      }
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={22}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>

                  {(() => {
                    const dt =
                      new Date(
                        loanData.loan_start_date ||
                        new Date().toISOString()
                      );

                    const ManualDateTimePicker =
                      require(
                        "../components/ManualDateTimePicker"
                      ).default;

                    return (
                      <ManualDateTimePicker
                        year={dt.getFullYear()}
                        month={
                          dt.getMonth() +
                          1
                        }
                        day={dt.getDate()}
                        hour={dt.getHours()}
                        minute={dt.getMinutes()}
                        onChange={(
                          y,
                          m,
                          d,
                          h,
                          min
                        ) =>
                          setField(
                            "loan_start_date",
                            new Date(
                              y,
                              m - 1,
                              d,
                              h,
                              min
                            ).toISOString()
                          )
                        }
                        onClose={
                          closeStartDatePicker
                        }
                      />
                    );
                  })()}
                </View>
              </View>
            </Modal>
          );
        })()
        : null}
    </View>
  );
}

/* =========================================================
   COMPACT INPUT
========================================================= */

function CompactInput({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
  disabled,
  error,
  accent,
  large,
}) {
  return (
    <View
      style={
        styles.fieldWrap
      }
    >
      <PaperTextInput
        mode="outlined"
        dense
        label={label}
        value={value}
        onChangeText={
          onChangeText
        }
        placeholder={
          placeholder
        }
        keyboardType={
          keyboardType
        }
        disabled={disabled}
        error={!!error}
        left={
          <PaperTextInput.Icon
            icon={icon}
            color={
              accent || "#64748B"
            }
          />
        }
        style={[
          styles.input,
          large &&
          styles.largeInput,
        ]}
        outlineStyle={
          styles.inputOutline
        }
      />

      {error ? (
        <Text
          style={
            styles.fieldError
          }
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/* =========================================================
   COMPACT SELECT
========================================================= */

function CompactSelect({
  label,
  value,
  icon,
  onPress,
  disabled,
  color,
  error,
}) {
  return (
    <View
      style={
        styles.fieldWrap
      }
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        disabled={disabled}
      >
        <PaperTextInput
          mode="outlined"
          dense
          label={label}
          value={value}
          editable={false}
          error={!!error}
          left={
            <PaperTextInput.Icon
              icon={icon}
              color={
                color || "#64748B"
              }
            />
          }
          right={
            <PaperTextInput.Icon
              icon="chevron-down"
              color="#94A3B8"
            />
          }
          style={
            styles.input
          }
          outlineStyle={
            styles.inputOutline
          }
          pointerEvents="none"
        />
      </TouchableOpacity>

      {error ? (
        <Text
          style={
            styles.fieldError
          }
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/* =========================================================
   EMPTY PICKER
========================================================= */

function EmptyPickerState({
  icon,
  text,
}) {
  return (
    <View
      style={
        styles.emptyPicker
      }
    >
      <View
        style={
          styles.emptyPickerIcon
        }
      >
        <MaterialCommunityIcons
          name={icon}
          size={28}
          color="#94A3B8"
        />
      </View>

      <Text
        style={
          styles.emptyPickerText
        }
      >
        {text}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: "#F5F7FB",
    },

    content: {
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 18,
    },

    /* =====================================================
       HEADER
    ===================================================== */

    topHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },

    headerTextWrap: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },

    title: {
      fontSize: 21,
      lineHeight: 26,
      fontWeight: "800",
      color: "#111827",
      letterSpacing: -0.3,
    },

    subtitle: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 16,
      color: "#64748B",
      fontWeight: "500",
    },

    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },

    /* =====================================================
       ERROR
    ===================================================== */

    formError: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FFF1F2",
      borderWidth: 1,
      borderColor: "#FECDD3",
      borderRadius: 11,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 9,
    },

    formErrorText: {
      flex: 1,
      marginLeft: 7,
      color: "#BE123C",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
    },

    /* =====================================================
       BORROW / LEND
    ===================================================== */

    segmentContainer: {
      flexDirection: "row",
      backgroundColor: "#E9EDF5",
      borderRadius: 12,
      padding: 3,
      marginBottom: 9,
    },

    segment: {
      flex: 1,
      minHeight: 38,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },

    segmentText: {
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "700",
      color: "#64748B",
    },

    /* =====================================================
       FORM
    ===================================================== */

    formCard: {
      backgroundColor: "#FFFFFF",
      borderRadius: 15,
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: 3,
      borderWidth: 1,
      borderColor: "#E2E8F0",

      shadowColor: "#0F172A",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 1,
    },

    /* =====================================================
       INPUTS
    ===================================================== */

    fieldWrap: {
      width: "100%",
      marginBottom: 8,
    },

    input: {
      backgroundColor: "#FFFFFF",
      fontSize: 14,
      height: 50,
    },

    largeInput: {
      height: 52,
    },

    inputOutline: {
      borderRadius: 11,
      borderWidth: 1,
      borderColor: "#D7DDE7",
    },

    fieldError: {
      color: "#DC2626",
      fontSize: 11,
      lineHeight: 15,
      marginTop: 3,
      marginLeft: 4,
      fontWeight: "600",
    },

    /* =====================================================
       IMPORTANT:
       Don't squeeze fields too much on mobile.
       They will still sit side-by-side on wider screens.
    ===================================================== */

    row: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      width: "100%",
    },

    half: {
      flex: 1,
      minWidth: 0,
    },

    divider: {
      height: 1,
      backgroundColor: "#EEF0F4",
      marginTop: 2,
      marginBottom: 9,
    },

    subSectionTitle: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
      color: "#475569",
      marginBottom: 7,
    },

    /* =====================================================
       ACTION BUTTONS
    ===================================================== */

    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 11,
    },

    saveButton: {
      flex: 1,
      marginTop: 0,
      borderRadius: 11,
    },

    saveButtonContent: {
      minHeight: 46,
    },

    cancelButton: {
      width: 96,
      minHeight: 46,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: "#CBD5E1",
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },

    cancelButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#475569",
    },

    /* =====================================================
       DELETE
    ===================================================== */

    deleteAction: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginTop: 7,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },

    deleteActionText: {
      marginLeft: 5,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
      color: "#DC2626",
    },

    /* =====================================================
       LOADING
    ===================================================== */

    loaderContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#F5F7FB",
    },

    loaderText: {
      marginTop: 10,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
      color: "#64748B",
    },

    /* =====================================================
       PICKER SHEETS
    ===================================================== */

    sheetOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(15,23,42,0.42)",
    },

    sheet: {
      backgroundColor: "#FFFFFF",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 14,
      paddingTop: 9,
      paddingBottom: 16,
      maxHeight: "82%",
    },

    smallSheet: {
      backgroundColor: "#FFFFFF",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 14,
      paddingTop: 9,
      paddingBottom: 20,
      maxHeight: "65%",
    },

    sheetHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: "#D1D5DB",
      marginBottom: 12,
    },

    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 9,
    },

    sheetTitle: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "800",
      color: "#111827",
    },

    sheetSubtitle: {
      marginTop: 2,
      fontSize: 11,
      lineHeight: 15,
      color: "#94A3B8",
    },

    searchInput: {
      backgroundColor: "#FFFFFF",
      marginBottom: 8,
      height: 46,
    },

    sheetScroll: {
      flexGrow: 0,
    },

    /* =====================================================
       PICKER ITEMS
    ===================================================== */

    simplePickerItem: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 54,
      paddingHorizontal: 8,
      paddingVertical: 7,
      marginBottom: 6,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: "#E5E7EB",
      backgroundColor: "#FFFFFF",
    },

    simplePickerIcon: {
      width: 35,
      height: 35,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
      flexShrink: 0,
    },

    simplePickerText: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
      color: "#334155",
      paddingRight: 5,
    },

    pickerTextWrap: {
      flex: 1,
      minWidth: 0,
      paddingRight: 4,
    },

    /* =====================================================
       EMPTY
    ===================================================== */

    emptyPicker: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 42,
      paddingHorizontal: 20,
    },

    emptyPickerIcon: {
      width: 56,
      height: 56,
      borderRadius: 17,
      backgroundColor: "#F1F5F9",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 9,
    },

    emptyPickerText: {
      color: "#94A3B8",
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "600",
      textAlign: "center",
    },

    /* =====================================================
       DAY PICKER
    ===================================================== */

    dayGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      paddingTop: 4,
      columnGap: 7,
    },

    dayTile: {
      width: "13.2%",
      aspectRatio: 1,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      backgroundColor: "#F8FAFC",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 7,
    },

    dayText: {
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "700",
      color: "#475569",
    },

    /* =====================================================
       DATE
    ===================================================== */

    dateSheetOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(15,23,42,0.42)",
    },

    dateSheet: {
      backgroundColor: "#FFFFFF",
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 14,
      paddingTop: 11,
      paddingBottom: 25,
    },

    datePickerTitle: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "800",
      color: "#111827",
      textAlign: "center",
      marginBottom: 10,
    },

    nativePickerWrap: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 90,
    },

    dateButtonRow: {
      flexDirection: "row",
      marginTop: 12,
      gap: 8,
    },

    dateActionButton: {
      flex: 1,
      borderRadius: 10,
    },

    /* =====================================================
       WEB DATE PICKER
    ===================================================== */

    webDateOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(15,23,42,0.42)",
      padding: 14,
    },

    webDateCard: {
      width: "100%",
      maxWidth: 500,
      backgroundColor: "#FFFFFF",
      borderRadius: 17,
      padding: 14,
    },
  });