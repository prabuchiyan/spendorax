import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button as PaperButton } from 'react-native-paper';
import { recordPayment, recordPrepayment, getLoans } from '../services/loans';
import { getSources } from '../services/sources';
import { getCategories } from '../services/categories';
import Card from '../components/Card';

function FieldCard({
    icon,
    title,
    value,
    color = '#2563EB',
    onPress,
}) {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            style={styles.fieldCard}
        >
            <View
                style={[
                    styles.fieldIcon,
                    {
                        backgroundColor: color + '20',
                    },
                ]}
            >
                <MaterialCommunityIcons
                    name={icon}
                    size={22}
                    color={color}
                />
            </View>

            <View style={{ flex: 1 }}>

                <Text style={styles.fieldTitle}>
                    {title}
                </Text>

                <Text
                    style={styles.fieldValue}
                    numberOfLines={1}
                >
                    {value}
                </Text>

            </View>

            <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color="#94A3B8"
            />

        </TouchableOpacity>
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
                        color="#FFFFFF"
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

export default function LoanPaymentScreen({ route, navigation }) {
    const routeLoanId = route?.params?.id ?? route?.params?.loanId;
    const loanIdParam = routeLoanId != null ? Number(routeLoanId) : null;
    const mode = route?.params?.mode || 'payment';

    const [loanId, setLoanId] = useState(loanIdParam);
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
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

    useEffect(() => {
        (async () => {
            try {
                const loanRows = await getLoans();
                setLoans(loanRows);
                if (!loanIdParam && loanRows.length > 0) {
                    setLoanId(loanRows[0].id);
                }
            } catch (e) {
                console.warn('Failed to load loans', e);
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
                console.warn('Failed to load sources', e);
            }
        })();
        (async () => {
            try {
                const cats = await getCategories();
                setCategories(cats);
            } catch (e) {
                console.warn('Failed to load categories', e);
            }
        })();
    }, [sourceId]);

    function validate() {
        if (!loanId) {
            alert('Select a loan first');
            return false;
        }

        if (!sourceId) {
            alert('Select a payment source');
            return false;
        }

        if (!categoryId) {
            alert('Select a category');
            return false;
        }

        if (!amount || Number(amount) <= 0) {
            alert('Enter a valid amount');
            return false;
        }
        return true;
    }

    async function save() {
        if (!validate()) return;
        const value = Number(amount);
        try {
            if (mode === 'prepayment') {
                await recordPrepayment({ loanId, date: new Date().toISOString(), amount: value, reduceEMI, sourceId, categoryId, notes });
            } else {
                await recordPayment({ loanId, date: new Date().toISOString(), amount: value, paymentType: 'EMI', sourceId, categoryId, notes });
            }
            navigation.goBack();
        } catch (e) {
            console.error('Payment failed', e);
            alert(e?.message || 'Failed to record payment');
        }
    }

    const selectedLoan = loans.find((l) => l.id === loanId);
    const selectedSource = sources.find((s) => s.id === sourceId);
    const selectedCategory = categories.find((c) => c.id === categoryId);
    const title = mode === 'prepayment' ? 'Record Prepayment' : 'Record EMI Payment';

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
                ><View
                    style={{
                        backgroundColor:
                            mode === 'prepayment'
                                ? '#EA580C'
                                : '#2563EB',

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
                                    name={
                                        mode === 'prepayment'
                                            ? 'cash-plus'
                                            : 'cash-fast'
                                    }
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
                                    {title}
                                </Text>

                                <Text
                                    style={{
                                        color: '#DCE8FF',
                                        marginTop: 4,
                                    }}
                                >
                                    Record and track your loan payment
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
                                        color: '#DCE8FF',
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
                                        color: '#DCE8FF',
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
                    />

                    <FieldCard
                        icon="wallet-outline"
                        color="#16A34A"
                        title="Payment Source"
                        value={
                            selectedSource
                                ? selectedSource.name
                                : 'Select Bank / Wallet'
                        }
                        onPress={() => setShowSourcePicker(true)}
                    />

                    <FieldCard
                        icon="shape-outline"
                        color="#EA580C"
                        title="Category"
                        value={
                            selectedCategory
                                ? selectedCategory.name
                                : 'Select Category'
                        }
                        onPress={() => setShowCategoryPicker(true)}
                    />

                    <View style={styles.amountCard}>

                        <Text style={styles.amountLabel}>
                            Payment Amount
                        </Text>

                        <View style={styles.amountRow}>
                            <View
                                style={[
                                    styles.amountInputContainer,
                                    amountFocused && {
                                        borderColor: '#2563EB',
                                        borderWidth: 2,
                                    },
                                ]}
                            >
                                <Text style={styles.currency}>
                                    ₹
                                </Text>
                                <TextInput
                                    onFocus={() => setAmountFocused(true)}
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
                                            outlineStyle: 'none',
                                        },
                                    ]}
                                    disableFullscreenUI={true}
                                    onChangeText={(text) => {
                                        let value = text.replace(/[^0-9.]/g, '')
                                        const firstDot = value.indexOf('.');
                                        if (firstDot !== -1) {
                                            value =
                                                value.substring(0, firstDot + 1) +
                                                value.substring(firstDot + 1).replace(/\./g, '');
                                        }
                                        setAmount(value);
                                    }}
                                />
                            </View>
                        </View>

                    </View>
                    {mode === 'prepayment' && (

                        <View
                            style={styles.preferenceCard}
                        >

                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center'
                                }}
                            >

                                <View
                                    style={styles.preferenceIcon}
                                >

                                    <MaterialCommunityIcons
                                        name="chart-line"
                                        size={22}
                                        color="#EA580C"
                                    />

                                </View>

                                <View style={{ flex: 1 }}>

                                    <Text
                                        style={styles.preferenceTitle}
                                    >
                                        Reduce Monthly EMI
                                    </Text>

                                    <Text
                                        style={styles.preferenceSubtitle}
                                    >
                                        Keep the same loan tenure and reduce your EMI after this prepayment.
                                    </Text>

                                </View>

                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={() =>
                                        setReduceEMI(!reduceEMI)
                                    }
                                    style={[
                                        styles.toggle,
                                        reduceEMI && styles.toggleOn,
                                    ]}
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
                        <Text style={styles.notesLabel}>
                            Notes (Optional)
                        </Text>

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
                                    outlineStyle: 'none',
                                },
                            ]}
                        />
                    </View>
                    <View
                        style={styles.saveContainer}
                    >

                        <PaperButton
                            mode="contained"
                            onPress={save}
                            style={styles.saveButton}
                            contentStyle={{
                                height: 54,
                            }}
                            labelStyle={{
                                fontSize: 16,
                                fontWeight: '800',
                            }}
                        >
                            {mode === 'prepayment' ? 'Save Prepayment' : 'Save Payment'}
                        </PaperButton>
                    </View>
                </Card>

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
                            {/* Handle */}

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

                            {/* Header */}

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
                                        Choose the loan for this payment
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

                            {/* List */}

                            <ScrollView
                                showsVerticalScrollIndicator={false}
                            >
                                {loans.map((loan) => {

                                    const outstanding =
                                        Number(
                                            loan.outstanding_amount || 0
                                        ).toLocaleString('en-IN');

                                    const emi =
                                        Number(
                                            loan.emi_amount || 0
                                        ).toLocaleString('en-IN');

                                    const selected =
                                        loan.id === loanId;

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
                            {/* Handle */}

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

                            {/* Header */}

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
                                        Select Payment Source
                                    </Text>

                                    <Text
                                        style={{
                                            marginTop: 4,
                                            color: '#64748B',
                                        }}
                                    >
                                        Choose where the payment is made from
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

                <Modal
                    visible={showCategoryPicker}
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
                            {/* Handle */}

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

                            {/* Header */}

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
                                        Select Category
                                    </Text>

                                    <Text
                                        style={{
                                            marginTop: 4,
                                            color: '#64748B',
                                        }}
                                    >
                                        Choose the expense category
                                    </Text>

                                </View>

                                <TouchableOpacity
                                    onPress={() => setShowCategoryPicker(false)}
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
                                {categories.map((category) => {

                                    const icon =
                                        category.icon ||
                                        'shape-outline';

                                    const color =
                                        category.color ||
                                        '#EA580C';

                                    return (

                                        <PickerItem
                                            key={category.id}
                                            icon={icon}
                                            iconColor={color}
                                            iconBg={color + '20'}
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

                                                setShowCategoryPicker(false);

                                            }}
                                        />

                                    );

                                })}

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

            </ScrollView>

        </View >
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
    }

});
