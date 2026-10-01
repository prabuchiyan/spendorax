import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    StyleSheet,
    Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button as PaperButton } from 'react-native-paper';
import MuiDateTimePicker from "../components/MuiDateTimePicker";
import {
    forecloseLoan,
    getLoans,
} from '../services/loans';
import { getSources } from '../services/sources';
import { getCategories } from '../services/categories';
import Card from '../components/Card';

function FieldCard({
    icon,
    title,
    value,
    color = "#2563EB",
    onPress,
    error,
    disabled = false,
}) {
    const hasError = !!error;

    return (
        <View style={styles.fieldWrapper}>
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={onPress}
                style={[styles.fieldCard, hasError && styles.fieldCardError]}
                disabled={disabled}
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
    iconColor = '#2563EB',
    iconBg = '#DBEAFE',
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
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: selected ? '#EFF6FF' : '#FFFFFF',
                borderRadius: 18,
                padding: 14,
                marginBottom: 10,
                borderWidth: selected ? 1.5 : 1,
                borderColor: selected ? '#2563EB' : '#EEF2F7',
            }}
        >
            <View
                style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: iconBg,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 14,
                }}
            >
                <MaterialCommunityIcons
                    name={icon}
                    size={22}
                    color={iconColor}
                />
            </View>

            <View style={{ flex: 1 }}>
                <Text
                    style={{
                        fontSize: 15,
                        fontWeight: '800',
                        color: '#111827',
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
                            color: '#64748B',
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
                        backgroundColor: '#2563EB',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color="#FFF"
                    />
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

export default function LoanForeclosureScreen({
    route,
    navigation,
}) {
    const routeLoanId =
        route?.params?.id ??
        route?.params?.loanId;

    const loanIdParam =
        routeLoanId != null
            ? Number(routeLoanId)
            : null;

    const [loanId, setLoanId] = useState(loanIdParam);

    const [amount, setAmount] = useState('');
    const [charges, setCharges] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [errors, setErrors] = useState({});

    const [loans, setLoans] = useState([]);
    const [sources, setSources] = useState([]);
    const [categories, setCategories] = useState([]);

    const [sourceId, setSourceId] = useState(null);
    const [categoryId, setCategoryId] = useState(null);

    const [showLoanPicker, setShowLoanPicker] = useState(false);
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');

    const [amountFocused, setAmountFocused] = useState(false);
    const [chargesFocused, setChargesFocused] = useState(false);

    const closeDatePicker = () => {
        setShowDatePicker(false);
    };

    const openDatePicker = () => {
        setShowDatePicker(true);
    };

    useEffect(() => {
        (async () => {
            try {
                const rows = await getLoans();

                setLoans(rows);

                if (!loanIdParam && rows.length > 0) {
                    setLoanId(rows[0].id);
                }
            } catch (e) {
                console.warn(e);
            }
        })();
    }, [loanIdParam]);

    useEffect(() => {
        (async () => {
            try {
                const src = await getSources();

                setSources(src);

                if (
                    src.length > 0 &&
                    sourceId == null
                ) {
                    setSourceId(src[0].id);
                }
            } catch (e) {
                console.warn(e);
            }
        })();

        (async () => {
            try {
                const cats =
                    await getCategories();

                setCategories(cats);
            } catch (e) {
                console.warn(e);
            }
        })();
    }, [sourceId]);

    function validate() {
        const nextErrors = {};

        if (!loanId) {
            nextErrors.loan = 'Please select a loan before continuing.';
        }

        if (!sourceId) {
            nextErrors.source = 'Please choose the account or wallet used for this payment.';
        }

        if (!categoryId) {
            nextErrors.category = 'Please choose a category for this payment.';
        }

        const trimmedAmount = String(amount || '').trim();
        const numericAmount = Number(trimmedAmount);

        if (!trimmedAmount) {
            nextErrors.amount = 'Please enter the payment amount.';
        } else if (Number.isNaN(numericAmount)) {
            nextErrors.amount = 'Please enter a valid amount.';
        } else if (numericAmount <= 0) {
            nextErrors.amount = 'Payment amount must be greater than ₹0.';
        }

        if (!transactionDate || Number.isNaN(safeDate(transactionDate).getTime())) {
            nextErrors.date = 'Please select when this payment was made.';
        }

        setErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            const errorCount = Object.keys(nextErrors).length;

            Alert.alert(
                'Almost there! ✨',
                errorCount === 1
                    ? 'Please fix the highlighted field before continuing.'
                    : `Please complete the ${errorCount} highlighted fields before continuing.`,
                [{ text: 'Got it' }],
            );

            return false;
        }

        return true;
    }

    async function save() {
        if (loading) return;
        if (!validate()) return;

        try {
            setLoading(true);
            await forecloseLoan({
                loanId,
                date: safeDate(transactionDate).toISOString(),
                finalPaymentAmount: Number(amount),
                foreclosureCharges: Number(
                    charges || 0
                ),
                sourceId,
                categoryId,
                notes,
            });

            navigation.goBack();
        } catch (e) {
            console.error(e);
            alert(
                e?.message ||
                'Failed to foreclose loan'
            );
        } finally {
            setLoading(false);
        }
    }

    const selectedLoan =
        loans.find(
            (l) => l.id === loanId
        );

    const selectedSource =
        sources.find(
            (s) => s.id === sourceId
        );

    const selectedCategory =
        categories.find(
            (c) => c.id === categoryId
        );

    const expenseCategories = categories.filter(
        (category) => String(category.type || '').toLowerCase() === 'expense'
    );

    const filteredExpenseCategories = expenseCategories.filter((category) =>
        String(category.name || '')
            .toLowerCase()
            .includes(categorySearch.trim().toLowerCase())
    );

    return (
        <View
            style={{
                flex: 1,
                backgroundColor: '#F3F6FB',
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
                        overflow: 'hidden',
                    }}
                >
                    {/* Header */}

                    <View
                        style={{
                            backgroundColor: '#DC2626',
                            margin: -16,
                            marginBottom: 18,
                            padding: 20,
                            borderBottomLeftRadius: 24,
                            borderBottomRightRadius: 24,
                        }}
                    >
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                            }}
                        >
                            <View
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 18,
                                    backgroundColor: 'rgba(255,255,255,0.18)',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: 16,
                                }}
                            >
                                <MaterialCommunityIcons
                                    name="bank-remove"
                                    size={28}
                                    color="#FFF"
                                />
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: '#FFF',
                                        fontSize: 22,
                                        fontWeight: '900',
                                    }}
                                >
                                    Foreclose Loan
                                </Text>

                                <Text
                                    style={{
                                        color: '#FEE2E2',
                                        marginTop: 4,
                                    }}
                                >
                                    Close this loan permanently with one final payment.
                                </Text>
                            </View>
                        </View>

                        {selectedLoan && (
                            <View
                                style={{
                                    marginTop: 22,
                                    backgroundColor: 'rgba(255,255,255,0.12)',
                                    borderRadius: 18,
                                    padding: 16,
                                }}
                            >
                                <Text
                                    style={{
                                        color: '#FEE2E2',
                                        fontSize: 12,
                                    }}
                                >
                                    Selected Loan
                                </Text>

                                <Text
                                    style={{
                                        color: '#FFF',
                                        marginTop: 4,
                                        fontWeight: '900',
                                        fontSize: 18,
                                    }}
                                >
                                    {selectedLoan.loan_name}
                                </Text>

                                <Text
                                    style={{
                                        color: '#FEE2E2',
                                        marginTop: 6,
                                    }}
                                >
                                    Outstanding ₹
                                    {Number(
                                        selectedLoan.outstanding_amount || 0
                                    ).toLocaleString('en-IN')}
                                </Text>
                            </View>
                        )}
                    </View>

                    <FieldCard
                        icon="bank-outline"
                        color="#2563EB"
                        title="Loan"
                        value={
                            selectedLoan
                                ? selectedLoan.loan_name
                                : 'Select Loan'
                        }
                        onPress={() => setShowLoanPicker(true)}
                        disabled={loading}
                    />

                    <FieldCard
                        icon={selectedSource?.icon || "wallet-outline"}
                        color={selectedSource?.color || "#16A34A"}
                        title="Payment Source"
                        value={
                            selectedSource
                                ? selectedSource.name
                                : 'Select Bank / Wallet'
                        }
                        error={errors.source}
                        onPress={() => {
                            setErrors((prev) => ({
                                ...prev,
                                source: undefined,
                            }));
                            setShowSourcePicker(true);
                        }}
                        disabled={loading}
                    />

                    <FieldCard
                        icon={selectedCategory?.icon || "shape-outline"}
                        color={selectedCategory?.color || "#EA580C"}
                        title="Category"
                        value={
                            selectedCategory
                                ? selectedCategory.name
                                : 'Select Category'
                        }
                        error={errors.category}
                        onPress={() => {
                            setErrors((prev) => ({
                                ...prev,
                                category: undefined,
                            }));
                            setShowCategoryPicker(true);
                        }}
                        disabled={loading}
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
                        disabled={loading}
                    />

                    {/* Final Payment */}

                    <View style={styles.amountCard}>
                        <Text style={[styles.amountLabel, errors.amount && { color: "#DC2626" }]}>
                            Final Payment Amount <Text style={{ color: "#DC2626" }}> *</Text>
                        </Text>

                        <View style={styles.amountRow}>
                            <View
                                style={[
                                    styles.amountInputContainer,
                                    errors.amount && {
                                        borderColor: "#DC2626",
                                        backgroundColor: "#FEF2F2",
                                    },
                                    amountFocused && !errors.amount && {
                                        borderColor: '#DC2626',
                                        borderWidth: 2,
                                    },
                                ]}
                            >
                                <Text style={[styles.currency, errors.amount && { color: "#DC2626" }]}>
                                    ₹
                                </Text>

                                <TextInput
                                    value={amount}
                                    keyboardType="decimal-pad"
                                    placeholder="Enter Amount"
                                    placeholderTextColor="#94A3B8"
                                    selectionColor="#DC2626"
                                    cursorColor="#DC2626"
                                    underlineColorAndroid="transparent"
                                    onFocus={() => {
                                        setAmountFocused(true);
                                        setErrors((prev) => ({
                                            ...prev,
                                            amount: undefined,
                                        }));
                                    }}
                                    onBlur={() =>
                                        setAmountFocused(false)
                                    }
                                    editable={!loading}
                                    style={[styles.amountInput, { outlineStyle: "none" }]}
                                    onChangeText={(text) => {
                                        let value = text.replace(
                                            /[^0-9.]/g,
                                            ''
                                        );

                                        const firstDot =
                                            value.indexOf('.');

                                        if (firstDot !== -1) {
                                            value =
                                                value.substring(
                                                    0,
                                                    firstDot + 1
                                                ) +
                                                value
                                                    .substring(
                                                        firstDot + 1
                                                    )
                                                    .replace(
                                                        /\./g,
                                                        ''
                                                    );
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

                    {/* Charges */}

                    <View style={styles.amountCard}>
                        <Text style={styles.amountLabel}>
                            Foreclosure Charges (Optional)
                        </Text>

                        <View style={styles.amountRow}>
                            <View
                                style={[
                                    styles.amountInputContainer,
                                    chargesFocused && {
                                        borderColor: '#DC2626',
                                        borderWidth: 2,
                                    },
                                ]}
                            >
                                <Text style={styles.currency}>
                                    ₹
                                </Text>

                                <TextInput
                                    value={charges}
                                    keyboardType="decimal-pad"
                                    placeholder="0"
                                    placeholderTextColor="#94A3B8"
                                    selectionColor="#DC2626"
                                    cursorColor="#DC2626"
                                    underlineColorAndroid="transparent"
                                    onFocus={() =>
                                        setChargesFocused(true)
                                    }
                                    onBlur={() =>
                                        setChargesFocused(false)
                                    }
                                    editable={!loading}
                                    style={styles.amountInput}
                                    onChangeText={(text) => {
                                        let value = text.replace(
                                            /[^0-9.]/g,
                                            ''
                                        );

                                        const firstDot =
                                            value.indexOf('.');

                                        if (firstDot !== -1) {
                                            value =
                                                value.substring(
                                                    0,
                                                    firstDot + 1
                                                ) +
                                                value
                                                    .substring(
                                                        firstDot + 1
                                                    )
                                                    .replace(
                                                        /\./g,
                                                        ''
                                                    );
                                        }

                                        setCharges(value);
                                    }}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Notes */}

                    <View style={styles.notesCard}>
                        <Text style={styles.notesLabel}>
                            Notes (Optional)
                        </Text>

                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Add remarks"
                            placeholderTextColor="#94A3B8"
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            selectionColor="#DC2626"
                            cursorColor="#DC2626"
                            underlineColorAndroid="transparent"
                            editable={!loading}
                            style={styles.notesInput}
                        />
                    </View>

                    <View style={styles.saveContainer}>
                        <PaperButton
                            mode="contained"
                            buttonColor="#DC2626"
                            onPress={save}
                            loading={loading}
                            disabled={loading}
                            style={styles.saveButton}
                            contentStyle={{
                                height: 54,
                            }}
                            labelStyle={{
                                fontSize: 16,
                                fontWeight: '800',
                            }}
                        >
                            Confirm Foreclosure
                        </PaperButton>
                    </View>
                </Card>

                {/* ---------------- Loan Picker ---------------- */}

                <Modal
                    visible={showLoanPicker}
                    transparent
                    animationType="slide"
                >
                    <View
                        style={{
                            flex: 1,
                            justifyContent: 'flex-end',
                            backgroundColor: 'rgba(15,23,42,0.45)',
                        }}
                    >
                        <View
                            style={{
                                backgroundColor: '#F8FAFC',
                                borderTopLeftRadius: 28,
                                borderTopRightRadius: 28,
                                padding: 20,
                                maxHeight: '75%',
                            }}
                        >
                            <View
                                style={{
                                    width: 52,
                                    height: 5,
                                    borderRadius: 3,
                                    backgroundColor: '#CBD5E1',
                                    alignSelf: 'center',
                                    marginBottom: 18,
                                }}
                            />

                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 18,
                                }}
                            >
                                <View>
                                    <Text
                                        style={{
                                            fontSize: 21,
                                            fontWeight: '900',
                                            color: '#111827',
                                        }}
                                    >
                                        Select Loan
                                    </Text>

                                    <Text
                                        style={{
                                            marginTop: 4,
                                            color: '#64748B',
                                        }}
                                    >
                                        Choose the loan to foreclose
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setShowLoanPicker(false)}
                                >
                                    <MaterialCommunityIcons
                                        name="close-circle"
                                        size={28}
                                        color="#94A3B8"
                                    />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                showsVerticalScrollIndicator={false}
                            >
                                {loans.map((loan) => (
                                    <PickerItem
                                        key={loan.id}
                                        icon="bank-outline"
                                        iconColor="#DC2626"
                                        iconBg="#FEE2E2"
                                        selected={loan.id === loanId}
                                        title={loan.loan_name}
                                        subtitle={`Outstanding ₹${Number(
                                            loan.outstanding_amount || 0
                                        ).toLocaleString('en-IN')}`}
                                        onPress={() => {
                                            setLoanId(loan.id);
                                            setShowLoanPicker(false);
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
                                onPress={() => setShowLoanPicker(false)}
                            >
                                Close
                            </PaperButton>
                        </View>
                    </View>
                </Modal>

                {/* ---------------- Source Picker ---------------- */}

                <Modal
                    visible={showSourcePicker}
                    transparent
                    animationType="slide"
                >
                    <View
                        style={{
                            flex: 1,
                            justifyContent: 'flex-end',
                            backgroundColor: 'rgba(15,23,42,0.45)',
                        }}
                    >
                        <View
                            style={{
                                backgroundColor: '#F8FAFC',
                                borderTopLeftRadius: 28,
                                borderTopRightRadius: 28,
                                padding: 20,
                                maxHeight: '75%',
                            }}
                        >
                            <View
                                style={{
                                    width: 52,
                                    height: 5,
                                    borderRadius: 3,
                                    backgroundColor: '#CBD5E1',
                                    alignSelf: 'center',
                                    marginBottom: 18,
                                }}
                            />

                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 18,
                                }}
                            >
                                <View>
                                    <Text
                                        style={{
                                            fontSize: 21,
                                            fontWeight: '900',
                                        }}
                                    >
                                        Select Payment Source
                                    </Text>

                                    <Text
                                        style={{
                                            marginTop: 4,
                                            color: '#64748B',
                                        }}
                                    >
                                        Choose payment account
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setShowSourcePicker(false)}
                                >
                                    <MaterialCommunityIcons
                                        name="close-circle"
                                        size={28}
                                        color="#94A3B8"
                                    />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                showsVerticalScrollIndicator={false}
                            >
                                {sources.map((source) => (
                                    <PickerItem
                                        key={source.id}
                                        icon={source.icon || "wallet-outline"}
                                        iconColor={source.color || "#16A34A"}
                                        iconBg={(source.color || "#16A34A") + "20"}
                                        selected={source.id === sourceId}
                                        title={source.name}
                                        subtitle={source.type ? `${source.type} Account` : "Payment Account"}
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

                {/* ---------------- Category Picker ---------------- */}

                <Modal
                    visible={showCategoryPicker}
                    transparent
                    animationType="slide"
                    onRequestClose={() => {
                        setCategorySearch("");
                        setShowCategoryPicker(false);
                    }}
                >
                    <View
                        style={{
                            flex: 1,
                            justifyContent: 'flex-end',
                            backgroundColor: 'rgba(15,23,42,0.45)',
                        }}
                    >
                        <View
                            style={{
                                backgroundColor: '#F8FAFC',
                                borderTopLeftRadius: 28,
                                borderTopRightRadius: 28,
                                padding: 20,
                                maxHeight: '75%',
                            }}
                        >
                            <View
                                style={{
                                    width: 52,
                                    height: 5,
                                    borderRadius: 3,
                                    backgroundColor: '#CBD5E1',
                                    alignSelf: 'center',
                                    marginBottom: 18,
                                }}
                            />

                            <View
                                style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 18,
                                }}
                            >
                                <View>
                                    <Text
                                        style={{
                                            fontSize: 21,
                                            fontWeight: '900',
                                        }}
                                    >
                                        Select Category
                                    </Text>

                                    <Text
                                        style={{
                                            marginTop: 4,
                                            color: '#64748B',
                                        }}
                                    >
                                        Choose expense category
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    onPress={() => {
                                        setCategorySearch("");
                                        setShowCategoryPicker(false);
                                    }}
                                >
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
                                    size={21}
                                    color="#64748B"
                                />

                                <TextInput
                                    value={categorySearch}
                                    onChangeText={setCategorySearch}
                                    placeholder="Search category..."
                                    placeholderTextColor="#94A3B8"
                                    style={styles.categorySearchInput}
                                    autoCorrect={false}
                                    returnKeyType="search"
                                    outlineStyle="none"
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

                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                {filteredExpenseCategories.map((category) => (
                                    <PickerItem
                                        key={category.id}
                                        icon={category.icon || 'shape-outline'}
                                        iconColor={
                                            category.color || '#EA580C'
                                        }
                                        iconBg={
                                            (category.color || '#EA580C') +
                                            '20'
                                        }
                                        selected={
                                            category.id === categoryId
                                        }
                                        title={category.name}
                                        subtitle={
                                            category.type
                                                ? `${category.type} Category`
                                                : 'Loan Category'
                                        }
                                        onPress={() => {
                                            setCategoryId(category.id);
                                            setCategorySearch("");
                                            setShowCategoryPicker(false);
                                        }}
                                    />
                                ))}

                                {!filteredExpenseCategories.length && (
                                    <View style={styles.emptyPicker}>
                                        <View style={styles.emptyPickerIcon}>
                                            <MaterialCommunityIcons
                                                name="shape-outline"
                                                size={30}
                                                color="#94A3B8"
                                            />
                                        </View>
                                        <Text style={styles.emptyPickerTitle}>
                                            No expense category found
                                        </Text>
                                        <Text style={styles.emptyPickerText}>
                                            {categorySearch
                                                ? `No category matches "${categorySearch}".`
                                                : "No expense categories available."}
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

                <MuiDateTimePicker
                    visible={showDatePicker}
                    disableFutureDates={true}
                    initialDate={safeDate(transactionDate)}
                    onClose={closeDatePicker}
                    onSelect={(selectedDate) => {
                        if (selectedDate) {
                            setTransactionDate(selectedDate.toISOString());
                        }
                        closeDatePicker();
                    }}
                />

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    fieldCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
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
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    fieldTitle: {
        color: '#64748B',
        fontSize: 12,
    },
    fieldValue: {
        marginTop: 4,
        fontWeight: '800',
        fontSize: 15,
        color: '#111827',
    },
    fieldWrapper: {
        marginBottom: 14,
    },
    fieldCardError: {
        borderColor: "#FCA5A5",
        borderWidth: 1.5,
        backgroundColor: "#FEF2F2",
        marginBottom: 4,
    },
    fieldTitleError: {
        color: "#DC2626",
    },
    requiredMark: {
        color: "#DC2626",
    },
    fieldValueError: {
        color: "#991B1B",
    },
    fieldErrorContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        marginTop: 4,
    },
    fieldErrorText: {
        color: "#DC2626",
        fontSize: 12,
        marginLeft: 6,
        fontWeight: "500",
    },
    amountCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 18,
        elevation: 2,
    },
    amountLabel: {
        color: '#64748B',
        fontSize: 12,
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    currency: {
        fontSize: 30,
        fontWeight: '900',
        color: '#2563EB',
        marginRight: 8,
    },
    amountInput: {
        flex: 1,
        fontSize: 30,
        fontWeight: '800',
        color: '#111827',
        paddingVertical: 8,
        minHeight: 54,
        outlineStyle: 'none',
    },
    notesCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 18,
    },
    notesLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 10,
    },
    notesInput: {
        borderWidth: 1.5,
        borderColor: '#D6E4FF',
        backgroundColor: '#F8FBFF',
        borderRadius: 16,
        minHeight: 110,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#111827',
        textAlignVertical: 'top',
        outlineStyle: 'none',
    },
    saveButton: {
        borderRadius: 18,
        marginTop: 10,
    },
    preferenceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        marginBottom: 18,
    },
    preferenceIcon: {
        width: 46,
        height: 46,
        borderRadius: 14,
        backgroundColor: '#FED7AA',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    preferenceTitle: {
        fontWeight: '800',
        fontSize: 15,
        color: '#111827',
    },
    preferenceSubtitle: {
        marginTop: 4,
        fontSize: 12,
        color: '#64748B',
        lineHeight: 18,
    },
    toggle: {
        width: 52,
        height: 30,
        borderRadius: 18,
        backgroundColor: '#CBD5E1',
        justifyContent: 'center',
    },
    toggleOn: {
        backgroundColor: '#16A34A',
    },
    toggleThumb: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFF',
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
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#D6E4FF',
        borderRadius: 18,
        backgroundColor: '#F8FBFF',
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
    }
});