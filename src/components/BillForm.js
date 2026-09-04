import React, { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Text,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

import {
  TextInput as PaperTextInput,
  Button as PaperButton,
  Chip,
  Switch,
} from "react-native-paper";

import DateTimePicker from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { getCategories } from "../services/categories";
import { getSources } from "../services/sources";
import { createBill, updateBill } from "../services/bills";
import { RECURRENCE_TYPES } from "../services/billUtils";
import ManualDateTimePicker from "./ManualDateTimePicker";
import { Colors } from "./Theme";

function toDateStr(isoOrDate) {
  if (!isoOrDate) {
    return new Date().toISOString().slice(0, 10);
  }

  return String(isoOrDate).slice(0, 10);
}

function formatDisplayDate(dateString) {
  if (!dateString) return "";

  const parts = String(dateString).split("-").map(Number);

  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return dateString;
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getRecurrenceLabel(type) {
  if (!type) return "Monthly";

  const value = String(type).toLowerCase();

  switch (value) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    case "quarterly":
      return "Quarterly";
    default:
      return type;
  }
}

/*
 * IMPORTANT:
 * Do not use database icon names directly.
 * Invalid MaterialCommunityIcons names render as "?".
 */
function SelectionRow({
  type,
  label,
  value,
  onPress,
}) {
  const isSource = type === "source";

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={styles.selectionRow}
    >
      <View
        style={[
          styles.selectionIcon,
          {
            backgroundColor: isSource
              ? "#EFF6FF"
              : "#F5F3FF",
          },
        ]}
      >
        <MaterialCommunityIcons
          name={
            isSource
              ? "wallet-outline"
              : "tag-outline"
          }
          size={20}
          color={
            isSource
              ? "#2563EB"
              : "#7C3AED"
          }
        />
      </View>

      <View style={styles.selectionContent}>
        <Text style={styles.selectionLabel}>
          {label}
        </Text>

        <Text
          style={styles.selectionValue}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={21}
        color="#94A3B8"
      />
    </TouchableOpacity>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={Colors.primary}
        />
      </View>

      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>
          {title}
        </Text>

        {!!subtitle && (
          <Text
            style={styles.sectionSubtitle}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function BillForm({
  bill,
  onSaved,
  onCancel,
}) {
  const { width: screenWidth } =
    useWindowDimensions();

  const isSmallPhone = screenWidth < 380;

  const isEdit = Boolean(bill?.id);

  const [name, setName] = useState(
    bill?.name || ""
  );

  const [amount, setAmount] = useState(
    bill ? String(bill.amount) : ""
  );

  const [dueDate, setDueDate] = useState(
    toDateStr(bill?.due_date)
  );

  const [categories, setCategories] =
    useState([]);

  const [sources, setSources] =
    useState([]);

  const [categoryId, setCategoryId] =
    useState(bill?.category_id || null);

  const [sourceId, setSourceId] =
    useState(bill?.source_id || null);

  const [isRecurring, setIsRecurring] =
    useState(
      Boolean(bill?.is_recurring)
    );

  const [recurrenceType, setRecurrenceType] =
    useState(
      bill?.recurrence_type || "monthly"
    );

  const [
    recurrenceInterval,
    setRecurrenceInterval,
  ] = useState(
    String(
      bill?.recurrence_interval || 1
    )
  );

  const [
    recurrenceEndDate,
    setRecurrenceEndDate,
  ] = useState(
    bill?.recurrence_end_date?.slice(
      0,
      10
    ) || ""
  );

  const [reminderDays, setReminderDays] =
    useState(
      String(
        bill?.reminder_days_before ?? 2
      )
    );

  const [autoPay, setAutoPay] =
    useState(
      Boolean(bill?.auto_pay)
    );

  const [notes, setNotes] = useState(
    bill?.notes || ""
  );

  const [
    attachmentUrl,
    setAttachmentUrl,
  ] = useState(
    bill?.attachment_url || ""
  );

  const [
    showCategoryPicker,
    setShowCategoryPicker,
  ] = useState(false);

  const [
    showSourcePicker,
    setShowSourcePicker,
  ] = useState(false);

  const [
    showDuePicker,
    setShowDuePicker,
  ] = useState(false);

  const [
    showEndPicker,
    setShowEndPicker,
  ] = useState(false);

  const [errors, setErrors] =
    useState({});

  const [
    categorySearch,
    setCategorySearch,
  ] = useState("");

  const [
    sourceSearch,
    setSourceSearch,
  ] = useState("");

  const [
    showAdvanced,
    setShowAdvanced,
  ] = useState(
    Boolean(notes || attachmentUrl)
  );

  useEffect(() => {
    (async () => {
      try {
        const cats = (
          await getCategories(true)
        ).filter(
          (c) => c.type === "expense"
        );

        setCategories(cats);

        const src =
          await getSources(true);

        setSources(src);

        if (
          !categoryId &&
          cats.length
        ) {
          setCategoryId(cats[0].id);
        }

        if (
          !sourceId &&
          src.length
        ) {
          setSourceId(src[0].id);
        }
      } catch (error) {
        console.error(
          "Failed to load bill form data:",
          error
        );
      }
    })();
  }, []);

  const selectedCategory =
    categories.find(
      (c) => c.id === categoryId
    );

  const selectedSource =
    sources.find(
      (s) => s.id === sourceId
    );

  const filteredCategories =
    categories.filter((c) =>
      String(c.name || "")
        .toLowerCase()
        .includes(
          categorySearch.toLowerCase()
        )
    );

  const filteredSources =
    sources.filter((s) =>
      String(s.name || "")
        .toLowerCase()
        .includes(
          sourceSearch.toLowerCase()
        )
    );

  function validate() {
    const next = {};

    if (!name.trim()) {
      next.name =
        "Bill name is required";
    }

    const amt = parseFloat(amount);

    if (
      !amount ||
      Number.isNaN(amt) ||
      amt <= 0
    ) {
      next.amount =
        "Enter a valid amount";
    }

    if (!dueDate) {
      next.dueDate =
        "Due date is required";
    }

    setErrors(next);

    return (
      Object.keys(next).length === 0
    );
  }

  async function submit() {
    if (!validate()) return;

    const payload = {
      name: name.trim(),
      amount: parseFloat(amount),
      due_date: dueDate,
      is_recurring: isRecurring,

      recurrence_type: isRecurring
        ? recurrenceType
        : null,

      recurrence_interval: isRecurring
        ? parseInt(
          recurrenceInterval,
          10
        ) || 1
        : 1,

      recurrence_end_date:
        isRecurring &&
          recurrenceEndDate
          ? recurrenceEndDate
          : null,

      category_id: categoryId,
      source_id: sourceId,

      reminder_days_before:
        parseInt(
          reminderDays,
          10
        ) || 2,

      auto_pay: autoPay,

      notes: notes || null,

      attachment_url:
        attachmentUrl || null,
    };

    if (isEdit) {
      await updateBill(
        bill.id,
        payload
      );
    } else {
      await createBill(payload);
    }

    onSaved && onSaved();
  }

  const dueParts = dueDate
    ? dueDate.split("-").map(Number)
    : [];

  const endParts =
    recurrenceEndDate
      ? recurrenceEndDate
        .split("-")
        .map(Number)
      : [];

  const recurrenceIntervalNumber =
    parseInt(
      recurrenceInterval,
      10
    ) || 1;

  const recurrenceText =
    recurrenceIntervalNumber === 1
      ? `Every ${getRecurrenceLabel(
        recurrenceType
      ).toLowerCase()}`
      : `Every ${recurrenceIntervalNumber} ${getRecurrenceLabel(
        recurrenceType
      ).toLowerCase()}${recurrenceIntervalNumber >
        1
        ? "s"
        : ""
      }`;

  return (
    <View style={styles.container}>
      {/* ========================================================= */}
      {/* HEADER                                                     */}
      {/* ========================================================= */}

      <View style={styles.header}>
        <View
          style={[
            styles.headerIcon,
            {
              backgroundColor: isEdit
                ? "#F3E8FF"
                : "#DBEAFE",
            },
          ]}
        >
          <MaterialCommunityIcons
            name={isEdit ? "pencil" : "receipt"}
            size={23}
            color={isEdit ? "#7C3AED" : "#2563EB"}
          />
        </View>

        <View style={styles.headerText}>
          <Text
            style={styles.headerTitle}
            numberOfLines={1}
          >
            {isEdit
              ? "Edit Bill"
              : "Add Bill"}
          </Text>

          <Text
            style={styles.headerSubtitle}
            numberOfLines={1}
          >
            {isEdit
              ? "Update your bill"
              : "Track your bill easily"}
          </Text>
        </View>

        {!!onCancel && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onCancel}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons
              name="close"
              size={20}
              color="#64748B"
            />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal:
              isSmallPhone ? 10 : 14,
          },
        ]}
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* ======================================================= */}
        {/* BASIC DETAILS                                            */}
        {/* ======================================================= */}

        <View style={styles.card}>
          {/* NAME */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Bill name
            </Text>

            <PaperTextInput
              placeholder="e.g. Electricity Bill"
              value={name}
              onChangeText={(text) => {
                setName(text);

                if (errors.name) {
                  setErrors((prev) => ({
                    ...prev,
                    name: undefined,
                  }));
                }
              }}
              mode="outlined"
              dense
              style={styles.input}
              outlineColor={
                errors.name
                  ? "#DC2626"
                  : "#DCE3EC"
              }
              activeOutlineColor={
                errors.name
                  ? "#DC2626"
                  : Colors.primary
              }
              left={
                <PaperTextInput.Icon
                  icon="pencil"
                  color="#94A3B8"
                />
              }
            />

            {!!errors.name && (
              <Text
                style={styles.errorText}
              >
                {errors.name}
              </Text>
            )}
          </View>

          {/* AMOUNT */}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Amount
            </Text>

            <PaperTextInput
              placeholder="0.00"
              value={amount}
              onChangeText={(text) => {
                setAmount(text);

                if (errors.amount) {
                  setErrors((prev) => ({
                    ...prev,
                    amount: undefined,
                  }));
                }
              }}
              keyboardType="numeric"
              mode="outlined"
              dense
              style={styles.amountInput}
              outlineColor={
                errors.amount
                  ? "#DC2626"
                  : "#DCE3EC"
              }
              activeOutlineColor={
                errors.amount
                  ? "#DC2626"
                  : Colors.primary
              }
              left={
                <PaperTextInput.Icon
                  icon="currency-inr"
                  color="#16A34A"
                />
              }
            />

            {!!errors.amount && (
              <Text
                style={styles.errorText}
              >
                {errors.amount}
              </Text>
            )}
          </View>

          {/* DUE DATE */}

          <View style={styles.fieldGroupLast}>
            <Text style={styles.fieldLabel}>
              Due date
            </Text>

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() =>
                setShowDuePicker(true)
              }
              style={[
                styles.dateField,
                errors.dueDate &&
                styles.dateFieldError,
              ]}
            >
              <View
                style={styles.dateIconBox}
              >
                <MaterialCommunityIcons
                  name="calendar-month-outline"
                  size={21}
                  color="#2563EB"
                />
              </View>

              <View
                style={styles.dateContent}
              >
                <Text
                  style={
                    styles.dateSmallLabel
                  }
                >
                  Due date
                </Text>

                <Text
                  style={[
                    styles.dateText,
                    !dueDate &&
                    styles.placeholderText,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {dueDate
                    ? formatDisplayDate(
                      dueDate
                    )
                    : "Select due date"}
                </Text>
              </View>

              <MaterialCommunityIcons
                name="chevron-down"
                size={21}
                color="#64748B"
              />
            </TouchableOpacity>

            {!!errors.dueDate && (
              <Text
                style={styles.errorText}
              >
                {errors.dueDate}
              </Text>
            )}
          </View>
        </View>

        {/* ======================================================= */}
        {/* PAYMENT                                                   */}
        {/* ======================================================= */}

        <View style={styles.card}>
          <SectionHeader
            icon="wallet-outline"
            title="Payment"
            subtitle="Choose where the payment comes from"
          />

          <SelectionRow
            type="source"
            label="Payment source"
            value={
              selectedSource?.name ||
              "Select account"
            }
            onPress={() =>
              setShowSourcePicker(true)
            }
          />

          <View
            style={styles.selectionDivider}
          />

          <SelectionRow
            type="category"
            label="Category"
            value={
              selectedCategory?.name ||
              "Select category"
            }
            onPress={() =>
              setShowCategoryPicker(true)
            }
          />
        </View>

        {/* ======================================================= */}
        {/* SCHEDULE                                                  */}
        {/* ======================================================= */}

        <View style={styles.card}>
          <SectionHeader
            icon="calendar-refresh-outline"
            title="Schedule"
            subtitle="Repeat, reminder and auto-pay"
          />

          {/* RECURRING */}

          <View style={styles.settingRow}>
            <View
              style={[
                styles.settingIcon,
                {
                  backgroundColor:
                    "#F5F3FF",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="repeat"
                size={20}
                color="#7C3AED"
              />
            </View>

            <View
              style={styles.settingContent}
            >
              <Text
                style={styles.settingTitle}
              >
                Recurring bill
              </Text>

              <Text
                style={styles.settingSubtitle}
                numberOfLines={1}
              >
                {isRecurring
                  ? recurrenceText
                  : "One-time bill"}
              </Text>
            </View>

            <Switch
              value={isRecurring}
              onValueChange={
                setIsRecurring
              }
              color={Colors.primary}
            />
          </View>

          {isRecurring && (
            <View
              style={styles.recurringBox}
            >
              <Text
                style={styles.subLabel}
              >
                Repeat frequency
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.chipContainer
                }
              >
                {RECURRENCE_TYPES.map(
                  (t) => {
                    const selected =
                      recurrenceType ===
                      t;

                    return (
                      <Chip
                        key={t}
                        selected={
                          selected
                        }
                        onPress={() =>
                          setRecurrenceType(
                            t
                          )
                        }
                        compact
                        style={[
                          styles.chip,
                          selected &&
                          styles.chipSelected,
                        ]}
                        textStyle={[
                          styles.chipText,
                          selected &&
                          styles.chipTextSelected,
                        ]}
                      >
                        {getRecurrenceLabel(
                          t
                        )}
                      </Chip>
                    );
                  }
                )}
              </ScrollView>

              <View
                style={
                  styles.recurringFields
                }
              >
                {/* INTERVAL */}

                <View
                  style={
                    styles.recurringField
                  }
                >
                  <Text
                    style={styles.subLabel}
                  >
                    Every
                  </Text>

                  <PaperTextInput
                    value={
                      recurrenceInterval
                    }
                    onChangeText={
                      setRecurrenceInterval
                    }
                    keyboardType="numeric"
                    mode="outlined"
                    dense
                    style={styles.input}
                    left={
                      <PaperTextInput.Icon
                        icon="numeric"
                        color="#7C3AED"
                      />
                    }
                  />
                </View>

                {/* END DATE */}

                <View
                  style={
                    styles.recurringField
                  }
                >
                  <Text
                    style={styles.subLabel}
                  >
                    End date
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() =>
                      setShowEndPicker(
                        true
                      )
                    }
                    style={
                      styles.endDateField
                    }
                  >
                    <MaterialCommunityIcons
                      name="calendar-outline"
                      size={18}
                      color="#7C3AED"
                    />

                    <Text
                      style={[
                        styles.endDateText,
                        !recurrenceEndDate &&
                        styles.placeholderText,
                      ]}
                      numberOfLines={1}
                    >
                      {recurrenceEndDate
                        ? formatDisplayDate(
                          recurrenceEndDate
                        )
                        : "Never"}
                    </Text>

                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={18}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* REMINDER */}

          <View
            style={[
              styles.settingRow,
              styles.topBorder,
            ]}
          >
            <View
              style={[
                styles.settingIcon,
                {
                  backgroundColor:
                    "#FFF7ED",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="bell-outline"
                size={20}
                color="#EA580C"
              />
            </View>

            <View
              style={styles.settingContent}
            >
              <Text
                style={styles.settingTitle}
              >
                Reminder
              </Text>

              <Text
                style={styles.settingSubtitle}
                numberOfLines={1}
              >
                Notify before due date
              </Text>
            </View>

            <View
              style={styles.reminderBox}
            >
              <PaperTextInput
                value={reminderDays}
                onChangeText={
                  setReminderDays
                }
                keyboardType="numeric"
                mode="outlined"
                dense
                style={
                  styles.reminderInput
                }
              />

              <Text
                style={styles.daysText}
              >
                days
              </Text>
            </View>
          </View>

          {/* AUTO PAY */}

          <View
            style={[
              styles.settingRow,
              styles.topBorder,
            ]}
          >
            <View
              style={[
                styles.settingIcon,
                {
                  backgroundColor:
                    "#F0FDF4",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="autorenew"
                size={20}
                color="#16A34A"
              />
            </View>

            <View
              style={styles.settingContent}
            >
              <Text
                style={styles.settingTitle}
              >
                Auto-pay
              </Text>

              <Text
                style={styles.settingSubtitle}
                numberOfLines={1}
              >
                Automatic payment enabled
              </Text>
            </View>

            <Switch
              value={autoPay}
              onValueChange={setAutoPay}
              color="#16A34A"
            />
          </View>
        </View>

        {/* ======================================================= */}
        {/* ADDITIONAL DETAILS                                       */}
        {/* ======================================================= */}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            setShowAdvanced(
              !showAdvanced
            )
          }
          style={styles.optionalToggle}
        >
          <View
            style={styles.optionalLeft}
          >
            <View
              style={styles.optionalIcon}
            >
              <MaterialCommunityIcons
                name="dots-horizontal"
                size={19}
                color="#64748B"
              />
            </View>

            <View
              style={styles.optionalText}
            >
              <Text
                style={styles.optionalTitle}
              >
                Additional details
              </Text>

              <Text
                style={styles.optionalSubtitle}
              >
                Notes and attachment
              </Text>
            </View>
          </View>

          <MaterialCommunityIcons
            name={
              showAdvanced
                ? "chevron-up"
                : "chevron-down"
            }
            size={21}
            color="#94A3B8"
          />
        </TouchableOpacity>

        {showAdvanced && (
          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text
                style={styles.fieldLabel}
              >
                Notes
              </Text>

              <PaperTextInput
                placeholder="Add a note..."
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                dense
                multiline
                numberOfLines={3}
                style={[
                  styles.input,
                  styles.notesInput,
                ]}
              />
            </View>

            <View
              style={styles.fieldGroupLast}
            >
              <Text
                style={styles.fieldLabel}
              >
                Attachment URL
              </Text>

              <PaperTextInput
                placeholder="Optional attachment link"
                value={attachmentUrl}
                onChangeText={
                  setAttachmentUrl
                }
                mode="outlined"
                dense
                style={styles.input}
                left={
                  <PaperTextInput.Icon
                    icon="link-variant"
                    color="#94A3B8"
                  />
                }
              />
            </View>
          </View>
        )}

        {/* ======================================================= */}
        {/* ACTIONS                                                   */}
        {/* ======================================================= */}

        <View style={styles.actions}>
          <PaperButton
            mode="contained"
            onPress={submit}
            style={styles.saveButton}
            contentStyle={
              styles.saveButtonContent
            }
            labelStyle={
              styles.saveButtonLabel
            }
            icon={
              isEdit
                ? "content-save-outline"
                : "check"
            }
          >
            {isEdit
              ? "Save Changes"
              : "Add Bill"}
          </PaperButton>

          {!!onCancel && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onCancel}
              style={styles.cancelButton}
            >
              <Text
                style={styles.cancelText}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ========================================================= */}
      {/* CATEGORY PICKER                                           */}
      {/* ========================================================= */}

      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setShowCategoryPicker(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.bottomSheet,
              {
                maxHeight:
                  isSmallPhone
                    ? "82%"
                    : "72%",
              },
            ]}
          >
            <View
              style={styles.sheetHandle}
            />

            <View
              style={styles.sheetHeader}
            >
              <View
                style={styles.sheetHeaderText}
              >
                <Text
                  style={styles.sheetTitle}
                >
                  Select Category
                </Text>

                <Text
                  style={styles.sheetSubtitle}
                >
                  Choose a category
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setShowCategoryPicker(
                    false
                  )
                }
                style={styles.sheetClose}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <PaperTextInput
              placeholder="Search categories"
              value={categorySearch}
              onChangeText={
                setCategorySearch
              }
              mode="outlined"
              dense
              style={styles.searchInput}
              left={
                <PaperTextInput.Icon
                  icon="magnify"
                  color="#94A3B8"
                />
              }
              right={
                categorySearch ? (
                  <PaperTextInput.Icon
                    icon="close-circle"
                    color="#94A3B8"
                    onPress={() =>
                      setCategorySearch(
                        ""
                      )
                    }
                  />
                ) : null
              }
            />

            <ScrollView
              style={styles.pickerList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              {filteredCategories.length ===
                0 ? (
                <View
                  style={styles.noResults}
                >
                  <MaterialCommunityIcons
                    name="tag-off-outline"
                    size={34}
                    color="#CBD5E1"
                  />

                  <Text
                    style={
                      styles.noResultsTitle
                    }
                  >
                    No categories found
                  </Text>
                </View>
              ) : (
                filteredCategories.map(
                  (c) => {
                    const selected =
                      c.id ===
                      categoryId;

                    return (
                      <TouchableOpacity
                        key={c.id}
                        activeOpacity={
                          0.8
                        }
                        onPress={() => {
                          setCategoryId(
                            c.id
                          );
                          setShowCategoryPicker(
                            false
                          );
                          setCategorySearch(
                            ""
                          );
                        }}
                        style={[
                          styles.pickerItem,
                          selected &&
                          styles.pickerItemSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.pickerItemIcon,
                            {
                              backgroundColor:
                                selected
                                  ? "#EDE9FE"
                                  : "#F8FAFC",
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="tag-outline"
                            size={21}
                            color={
                              selected
                                ? "#7C3AED"
                                : "#64748B"
                            }
                          />
                        </View>

                        <Text
                          style={[
                            styles.pickerItemText,
                            selected &&
                            styles.pickerItemTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>

                        {selected && (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={21}
                            color={
                              Colors.primary
                            }
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }
                )
              )}
            </ScrollView>

            <PaperButton
              mode="outlined"
              onPress={() =>
                setShowCategoryPicker(
                  false
                )
              }
              style={
                styles.sheetDoneButton
              }
            >
              Close
            </PaperButton>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* SOURCE PICKER                                             */}
      {/* ========================================================= */}

      <Modal
        visible={showSourcePicker}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setShowSourcePicker(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.bottomSheet,
              {
                maxHeight:
                  isSmallPhone
                    ? "82%"
                    : "72%",
              },
            ]}
          >
            <View
              style={styles.sheetHandle}
            />

            <View
              style={styles.sheetHeader}
            >
              <View
                style={styles.sheetHeaderText}
              >
                <Text
                  style={styles.sheetTitle}
                >
                  Payment Source
                </Text>

                <Text
                  style={styles.sheetSubtitle}
                >
                  Choose the account to pay from
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setShowSourcePicker(
                    false
                  )
                }
                style={styles.sheetClose}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <PaperTextInput
              placeholder="Search accounts"
              value={sourceSearch}
              onChangeText={
                setSourceSearch
              }
              mode="outlined"
              dense
              style={styles.searchInput}
              left={
                <PaperTextInput.Icon
                  icon="magnify"
                  color="#94A3B8"
                />
              }
              right={
                sourceSearch ? (
                  <PaperTextInput.Icon
                    icon="close-circle"
                    color="#94A3B8"
                    onPress={() =>
                      setSourceSearch("")
                    }
                  />
                ) : null
              }
            />

            <ScrollView
              style={styles.pickerList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
            >
              {filteredSources.length ===
                0 ? (
                <View
                  style={styles.noResults}
                >
                  <MaterialCommunityIcons
                    name="wallet-outline"
                    size={34}
                    color="#CBD5E1"
                  />

                  <Text
                    style={
                      styles.noResultsTitle
                    }
                  >
                    No accounts found
                  </Text>
                </View>
              ) : (
                filteredSources.map(
                  (s) => {
                    const selected =
                      s.id === sourceId;

                    return (
                      <TouchableOpacity
                        key={s.id}
                        activeOpacity={
                          0.8
                        }
                        onPress={() => {
                          setSourceId(
                            s.id
                          );
                          setShowSourcePicker(
                            false
                          );
                          setSourceSearch(
                            ""
                          );
                        }}
                        style={[
                          styles.pickerItem,
                          selected &&
                          styles.pickerItemSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.pickerItemIcon,
                            {
                              backgroundColor:
                                selected
                                  ? "#DBEAFE"
                                  : "#F8FAFC",
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="wallet-outline"
                            size={21}
                            color={
                              selected
                                ? "#2563EB"
                                : "#64748B"
                            }
                          />
                        </View>

                        <Text
                          style={[
                            styles.pickerItemText,
                            selected &&
                            styles.pickerItemTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {s.name}
                        </Text>

                        {selected && (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={21}
                            color={
                              Colors.primary
                            }
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }
                )
              )}
            </ScrollView>

            <PaperButton
              mode="outlined"
              onPress={() =>
                setShowSourcePicker(
                  false
                )
              }
              style={
                styles.sheetDoneButton
              }
            >
              Close
            </PaperButton>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* DUE DATE PICKER                                           */}
      {/* ========================================================= */}

      {showDuePicker &&
        Platform.OS !== "web" ? (
        <DateTimePicker
          value={
            dueDate
              ? new Date(
                `${dueDate}T00:00:00`
              )
              : new Date()
          }
          mode="date"
          display={
            Platform.OS === "ios"
              ? "spinner"
              : "default"
          }
          onChange={(
            event,
            selectedDate
          ) => {
            if (
              Platform.OS ===
              "android"
            ) {
              setShowDuePicker(false);

              if (
                event.type ===
                "dismissed"
              ) {
                return;
              }
            }

            if (selectedDate) {
              const y =
                selectedDate.getFullYear();

              const m = String(
                selectedDate.getMonth() +
                1
              ).padStart(2, "0");

              const d = String(
                selectedDate.getDate()
              ).padStart(2, "0");

              setDueDate(
                `${y}-${m}-${d}`
              );

              if (errors.dueDate) {
                setErrors((prev) => ({
                  ...prev,
                  dueDate: undefined,
                }));
              }
            }

            if (
              Platform.OS === "ios"
            ) {
              setShowDuePicker(false);
            }
          }}
        />
      ) : (
        <Modal
          visible={showDuePicker}
          transparent
          animationType="fade"
          onRequestClose={() =>
            setShowDuePicker(false)
          }
        >
          <View
            style={
              styles.modalOverlayCenter
            }
          >
            <View
              style={styles.dateModal}
            >
              <Text
                style={styles.dateModalTitle}
              >
                Due Date
              </Text>

              <Text
                style={
                  styles.dateModalSubtitle
                }
              >
                Select when this bill is due
              </Text>

              <ManualDateTimePicker
                year={
                  dueParts[0] ||
                  new Date().getFullYear()
                }
                month={
                  dueParts[1] ||
                  new Date().getMonth() +
                  1
                }
                day={
                  dueParts[2] ||
                  new Date().getDate()
                }
                hour={0}
                minute={0}
                onChange={(y, m, d) => {
                  const ds = `${y}-${String(
                    m
                  ).padStart(2, "0")}-${String(
                    d
                  ).padStart(2, "0")}`;

                  setDueDate(ds);

                  if (errors.dueDate) {
                    setErrors((prev) => ({
                      ...prev,
                      dueDate: undefined,
                    }));
                  }
                }}
                onClose={() =>
                  setShowDuePicker(false)
                }
              />

              <PaperButton
                mode="contained"
                onPress={() =>
                  setShowDuePicker(false)
                }
                style={
                  styles.dateDoneButton
                }
              >
                Done
              </PaperButton>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* RECURRENCE END DATE                                       */}
      {/* ========================================================= */}

      <Modal
        visible={showEndPicker}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowEndPicker(false)
        }
      >
        <View
          style={
            styles.modalOverlayCenter
          }
        >
          <View style={styles.dateModal}>
            <Text
              style={styles.dateModalTitle}
            >
              Recurrence End Date
            </Text>

            <Text
              style={
                styles.dateModalSubtitle
              }
            >
              Leave empty if this bill never ends
            </Text>

            <ManualDateTimePicker
              year={
                endParts[0] ||
                new Date().getFullYear()
              }
              month={
                endParts[1] ||
                new Date().getMonth() + 1
              }
              day={
                endParts[2] ||
                new Date().getDate()
              }
              hour={0}
              minute={0}
              onChange={(y, m, d) => {
                setRecurrenceEndDate(
                  `${y}-${String(m).padStart(
                    2,
                    "0"
                  )}-${String(d).padStart(
                    2,
                    "0"
                  )}`
                );
              }}
              onClose={() =>
                setShowEndPicker(false)
              }
            />

            <View
              style={
                styles.dateModalActions
              }
            >
              {!!recurrenceEndDate && (
                <PaperButton
                  mode="text"
                  onPress={() => {
                    setRecurrenceEndDate(
                      ""
                    );
                    setShowEndPicker(
                      false
                    );
                  }}
                  textColor="#DC2626"
                >
                  Never
                </PaperButton>
              )}

              <PaperButton
                mode="contained"
                onPress={() =>
                  setShowEndPicker(false)
                }
                style={
                  styles.dateDoneButton
                }
              >
                Done
              </PaperButton>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // ==============================================================
  // MAIN
  // ==============================================================

  container: {
    flex: 1,
    backgroundColor:
      Colors.background,
  },

  scrollContent: {
    paddingTop: 4,
    paddingBottom: 20,
  },

  // ==============================================================
  // HEADER
  // ==============================================================

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },

  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  headerText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },

  headerTitle: {
    fontSize: 19,
    lineHeight: 23,
    fontWeight: "900",
    color: "#111827",
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 10,
    color: "#64748B",
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },

  // ==============================================================
  // CARDS
  // ==============================================================

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 13,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: "#EDF1F5",
    shadowColor: "#000",
    shadowOpacity: 0.035,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 1,
  },

  // ==============================================================
  // SECTION HEADER
  // ==============================================================

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },

  sectionHeaderText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
  },

  sectionTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: "#1E293B",
  },

  sectionSubtitle: {
    marginTop: 1,
    fontSize: 9.5,
    color: "#94A3B8",
  },

  // ==============================================================
  // FIELDS
  // ==============================================================

  fieldGroup: {
    marginBottom: 11,
  },

  fieldGroupLast: {
    marginBottom: 0,
  },

  fieldLabel: {
    marginBottom: 5,
    fontSize: 10.5,
    fontWeight: "800",
    color: "#475569",
  },

  input: {
    backgroundColor: "#FFFFFF",
    minWidth: 0,
  },

  amountInput: {
    backgroundColor: "#FFFFFF",
    minWidth: 0,
  },

  notesInput: {
    minHeight: 78,
    textAlignVertical: "top",
  },

  errorText: {
    marginTop: 4,
    fontSize: 10,
    color: "#DC2626",
    fontWeight: "600",
  },

  // ==============================================================
  // DUE DATE
  // ==============================================================

  dateField: {
    width: "100%",
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DCE3EC",
    borderRadius: 9,
    paddingHorizontal: 9,
    backgroundColor: "#FFFFFF",
  },

  dateFieldError: {
    borderColor: "#DC2626",
  },

  dateIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },

  dateContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
    marginRight: 7,
  },

  dateSmallLabel: {
    fontSize: 9,
    color: "#94A3B8",
    fontWeight: "700",
  },

  dateText: {
    marginTop: 2,
    fontSize: 12.5,
    color: "#1E293B",
    fontWeight: "800",
  },

  placeholderText: {
    color: "#94A3B8",
    fontWeight: "600",
  },

  // ==============================================================
  // SELECTION
  // ==============================================================

  selectionRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    paddingVertical: 4,
  },

  selectionDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 5,
  },

  selectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  selectionContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 6,
  },

  selectionLabel: {
    fontSize: 9.5,
    color: "#94A3B8",
    fontWeight: "700",
  },

  selectionValue: {
    marginTop: 2,
    fontSize: 12.5,
    color: "#1E293B",
    fontWeight: "800",
  },

  // ==============================================================
  // SETTINGS
  // ==============================================================

  settingRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    paddingVertical: 4,
  },

  topBorder: {
    marginTop: 5,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },

  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  settingContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
    marginRight: 7,
  },

  settingTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#334155",
  },

  settingSubtitle: {
    marginTop: 2,
    fontSize: 9.5,
    color: "#94A3B8",
  },

  // ==============================================================
  // RECURRING
  // ==============================================================

  recurringBox: {
    marginTop: 9,
    marginLeft: 47,
    padding: 10,
    borderRadius: 13,
    backgroundColor: "#FAF9FF",
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },

  subLabel: {
    marginBottom: 5,
    fontSize: 9.5,
    fontWeight: "800",
    color: "#64748B",
  },

  chipContainer: {
    paddingBottom: 8,
    paddingRight: 4,
  },

  chip: {
    marginRight: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  chipSelected: {
    backgroundColor: "#EDE9FE",
  },

  chipText: {
    fontSize: 10.5,
    color: "#64748B",
  },

  chipTextSelected: {
    color: "#7C3AED",
    fontWeight: "800",
  },

  recurringFields: {
    flexDirection: "row",
    gap: 9,
  },

  recurringField: {
    flex: 1,
    minWidth: 0,
  },

  endDateField: {
    minHeight: 49,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D9DCE1",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 9,
  },

  endDateText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 7,
    marginRight: 4,
    fontSize: 11.5,
    color: "#334155",
    fontWeight: "700",
  },

  // ==============================================================
  // REMINDER
  // ==============================================================

  reminderBox: {
    flexDirection: "row",
    alignItems: "center",
  },

  reminderInput: {
    width: 52,
    backgroundColor: "#FFFFFF",
  },

  daysText: {
    marginLeft: 5,
    fontSize: 9.5,
    color: "#64748B",
    fontWeight: "700",
  },

  // ==============================================================
  // OPTIONAL
  // ==============================================================

  optionalToggle: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 3,
    marginBottom: 4,
  },

  optionalLeft: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  optionalIcon: {
    width: 33,
    height: 33,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },

  optionalText: {
    minWidth: 0,
    marginLeft: 9,
  },

  optionalTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#475569",
  },

  optionalSubtitle: {
    marginTop: 2,
    fontSize: 9.5,
    color: "#94A3B8",
  },

  // ==============================================================
  // ACTIONS
  // ==============================================================

  actions: {
    marginTop: 2,
    alignItems: "center",
  },

  saveButton: {
    width: "100%",
    borderRadius: 13,
    backgroundColor:
      Colors.primary,
  },

  saveButtonContent: {
    minHeight: 49,
  },

  saveButtonLabel: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "900",
  },

  cancelButton: {
    paddingVertical: 9,
    paddingHorizontal: 20,
  },

  cancelText: {
    color: "#64748B",
    fontSize: 11.5,
    fontWeight: "800",
  },

  // ==============================================================
  // MODALS
  // ==============================================================

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(15, 23, 42, 0.42)",
    justifyContent: "flex-end",
  },

  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 14,
  },

  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 12,
  },

  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sheetHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  sheetTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },

  sheetSubtitle: {
    marginTop: 2,
    fontSize: 9.5,
    color: "#94A3B8",
  },

  sheetClose: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },

  searchInput: {
    backgroundColor: "#FFFFFF",
    marginBottom: 7,
  },

  pickerList: {
    marginBottom: 7,
  },

  pickerItem: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 7,
    borderRadius: 12,
    marginBottom: 2,
  },

  pickerItemSelected: {
    backgroundColor: "#F8FAFC",
  },

  pickerItemIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  pickerItemText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 7,
    fontSize: 12.5,
    color: "#334155",
    fontWeight: "700",
  },

  pickerItemTextSelected: {
    color: "#111827",
    fontWeight: "900",
  },

  noResults: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 35,
  },

  noResultsTitle: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "800",
    color: "#64748B",
  },

  sheetDoneButton: {
    borderRadius: 11,
  },

  // ==============================================================
  // DATE MODAL
  // ==============================================================

  modalOverlayCenter: {
    flex: 1,
    backgroundColor:
      "rgba(15, 23, 42, 0.42)",
    justifyContent: "center",
    padding: 14,
  },

  dateModal: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    padding: 15,
  },

  dateModalTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },

  dateModalSubtitle: {
    marginTop: 3,
    marginBottom: 10,
    fontSize: 10,
    color: "#94A3B8",
  },

  dateDoneButton: {
    borderRadius: 11,
    marginTop: 6,
  },

  dateModalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 7,
  },
});