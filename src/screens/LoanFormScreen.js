import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { TextInput as PaperTextInput, Button as PaperButton, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import ManualDateTimePicker from '../components/ManualDateTimePicker';
import ConfirmDialog from '../components/ConfirmDialog';
import Card from '../components/Card';
import { Colors } from '../components/Theme';
import { createLoan, getLoanById, updateLoan } from '../services/loans';

const LOAN_TYPES = [
    { key: 'Home', label: 'Home', icon: 'home-outline' },
    { key: 'Vehicle', label: 'Vehicle', icon: 'car' },
    { key: 'Personal', label: 'Personal', icon: 'account-outline' },
    { key: 'Education', label: 'Education', icon: 'school' },
    { key: 'Business', label: 'Business', icon: 'briefcase-outline' },
    { key: 'Credit Card', label: 'Credit Card', icon: 'credit-card-outline' },
    { key: 'Friends', label: 'Friends', icon: 'handshake' },
    { key: 'Other', label: 'Other', icon: 'shape-outline' }
];

export default function LoanFormScreen({ navigation, route }) {
    const rawId = route?.params?.id ?? route?.params?.loanId;
    const editId = rawId != null && rawId !== '' ? Number(rawId) : null;
    const [loanData, setLoanData] = useState({
        loan_name: '', loan_type: 'Other', lender: '', principal_amount: '', interest_rate: '', loan_start_date: '', tenure_months: '', emi_amount: '', emi_day: '', outstanding_amount: '', notes: ''
    });

    const [errors, setErrors] = useState({});
    const [showTypePicker, setShowTypePicker] = useState(false);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showDueDayPicker, setShowDueDayPicker] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);

    useEffect(() => {
        if (editId) {
            (async () => {
                const d = await getLoanById(editId);
                if (d) {
                    setLoanData({
                        loan_name: d.loan_name || '', loan_type: d.loan_type || 'Other', lender: d.lender || '', principal_amount: d.principal_amount != null ? String(d.principal_amount) : '',
                        interest_rate: d.interest_rate != null ? String(d.interest_rate) : '', loan_start_date: d.loan_start_date ? d.loan_start_date.slice(0, 10) : '', tenure_months: d.tenure_months != null ? String(d.tenure_months) : '',
                        emi_amount: d.emi_amount != null ? String(d.emi_amount) : '', emi_day: d.emi_day != null ? String(d.emi_day) : '', outstanding_amount: d.outstanding_amount != null ? String(d.outstanding_amount) : '', notes: d.notes || '', created_at: d.created_at, updated_at: d.updated_at, status: d.status
                    });
                }
            })();
        }
    }, [editId]);

    function setField(key, value) {
        setLoanData(prev => ({ ...prev, [key]: value }));
    }

    function validate() {
        const next = {};
        if (!loanData.loan_name || !loanData.loan_name.trim()) next.loan_name = 'Loan name is required';
        const p = parseFloat(loanData.principal_amount);
        if (!loanData.principal_amount || isNaN(p) || p <= 0) next.principal_amount = 'Enter a valid principal amount';
        const ir = parseFloat(loanData.interest_rate);
        if (loanData.interest_rate === '' || isNaN(ir) || ir < 0) next.interest_rate = 'Enter a valid interest rate';
        if (loanData.emi_amount && isNaN(parseFloat(loanData.emi_amount))) next.emi_amount = 'Invalid EMI amount';
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    async function submit() {
        if (!validate()) return;
        const allowed = ['loan_name', 'loan_type', 'lender', 'principal_amount',
            'interest_rate', 'loan_start_date', 'loan_end_date', 'tenure_months',
            'emi_amount', 'emi_day', 'outstanding_amount', 'notes'];
        const payload = {};
        allowed.forEach(k => {
            const v = loanData[k];
            if (v !== undefined && v !== null && String(v) !== '') payload[k] = v;
        });
        if (payload.principal_amount !== undefined) payload.principal_amount = Number(payload.principal_amount);
        if (payload.interest_rate !== undefined) payload.interest_rate = Number(payload.interest_rate || 0);
        if (payload.tenure_months !== undefined) payload.tenure_months = Number(payload.tenure_months || 0);
        if (payload.emi_amount !== undefined) payload.emi_amount = Number(payload.emi_amount || 0);

        // keep outstanding consistent for new loans or when principal edited with no principal paid yet
        if (editId) {
            const prevPrincipalPaid = Number(loanData.principal_paid || 0);
            if (payload.principal_amount !== undefined && prevPrincipalPaid === 0) payload.outstanding_amount = payload.principal_amount;
        } else {
            if (payload.outstanding_amount === undefined && payload.principal_amount !== undefined) payload.outstanding_amount = payload.principal_amount;
        }

        try {
            console.log('Prabu editId', editId);
            console.log('Prabu payload', payload);
            if (editId) await updateLoan(editId, payload);
            else await createLoan(payload);
            navigation.goBack();
        } catch (e) {
            console.error('Save loan failed', e);
            setErrors({ form: e?.message || 'Failed to save loan' });
        }
    }

    // Soft-delete not supported for loans; we mark as Closed to mimic deletion safely
    async function confirmDelete() {
        try {
            if (editId) {
                await updateLoan(editId, { status: 'Closed', outstanding_amount: 0, remaining_months: 0 });
            }
            setShowConfirmDelete(false);
            navigation.goBack();
        } catch (e) {
            console.error('Delete failed', e);
        }
    }

    const summary = useMemo(() => ({
        principal: loanData.principal_amount || '-',
        outstanding: loanData.outstanding_amount || '-',
        interest: loanData.interest_rate || '-',
        emi: loanData.emi_amount || '-',
        tenure: loanData.tenure_months || '-'
    }), [loanData]);

    return (
        <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.content}
        >
            {/* Loan Information */}
            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Loan Information</Text>
                <PaperTextInput
                    label="Loan name"
                    value={loanData.loan_name}
                    onChangeText={(t) => setField('loan_name', t)}
                    mode="outlined"
                    left={<PaperTextInput.Icon icon="file-document-outline" />}
                    style={styles.input}
                    error={!!errors.loan_name}
                />
                {errors.loan_name ? <Text style={{ color: '#E46A6A', marginBottom: 8 }}>{errors.loan_name}</Text> : null}

                <TouchableOpacity onPress={() => setShowTypePicker(true)} style={{ marginBottom: 8 }}>
                    <PaperTextInput
                        label="Loan type"
                        value={loanData.loan_type}
                        editable={false}
                        mode="outlined"
                        left={<PaperTextInput.Icon icon="shape-outline" />}
                        right={<PaperTextInput.Icon icon="chevron-down" onPress={() => setShowTypePicker(true)} />}
                    />
                </TouchableOpacity>

                <PaperTextInput
                    label="Lender"
                    value={loanData.lender}
                    onChangeText={(t) => setField('lender', t)}
                    mode="outlined"
                    left={<PaperTextInput.Icon icon="bank-outline" />}
                />
            </Card>

            {/* Financial Details */}
            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Financial Details</Text>
                <PaperTextInput
                    label="Principal amount"
                    value={loanData.principal_amount}
                    onChangeText={(t) => setField('principal_amount', t)}
                    keyboardType="numeric"
                    mode="outlined"
                    left={<PaperTextInput.Icon icon="cash" />}
                    style={styles.input}
                    error={!!errors.principal_amount}
                />
                {errors.principal_amount ? <Text style={{ color: '#E46A6A', marginBottom: 8 }}>{errors.principal_amount}</Text> : null}

                <PaperTextInput
                    label="Interest rate (annual %)"
                    value={loanData.interest_rate}
                    onChangeText={(t) => setField('interest_rate', t)}
                    keyboardType="numeric"
                    mode="outlined"
                    left={<PaperTextInput.Icon icon="percent-outline" />}
                    style={styles.input}
                    error={!!errors.interest_rate}
                />

                <PaperTextInput
                    label="Outstanding amount"
                    value={loanData.outstanding_amount}
                    onChangeText={(t) => setField('outstanding_amount', t)}
                    keyboardType="numeric"
                    mode="outlined"
                    left={<PaperTextInput.Icon icon="wallet-outline" />}
                />
            </Card>

            {/* EMI Details */}
            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>EMI Information</Text>
                <PaperTextInput
                    label="EMI amount"
                    value={loanData.emi_amount}
                    onChangeText={(t) => setField('emi_amount', t)}
                    keyboardType="numeric"
                    mode="outlined"
                    left={<PaperTextInput.Icon icon="calendar-sync" />}
                    style={styles.input}
                />

                <TouchableOpacity onPress={() => setShowDueDayPicker(true)}>
                    <PaperTextInput
                        label="EMI due day"
                        value={loanData.emi_day ? String(loanData.emi_day) : ''}
                        editable={false}
                        mode="outlined"
                        left={<PaperTextInput.Icon icon="calendar-month" />}
                        right={<PaperTextInput.Icon icon="chevron-down" onPress={() => setShowDueDayPicker(true)} />}
                        style={styles.input}
                    />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowStartPicker(true)}>
                    <PaperTextInput
                        label="Start date"
                        value={loanData.loan_start_date}
                        editable={false}
                        mode="outlined"
                        left={<PaperTextInput.Icon icon="calendar-range" />}
                        right={<PaperTextInput.Icon icon="chevron-down" onPress={() => setShowStartPicker(true)} />}
                        style={styles.input}
                    />
                </TouchableOpacity>

                <PaperTextInput
                    label="Tenure (months)"
                    value={loanData.tenure_months}
                    onChangeText={(t) => setField('tenure_months', t)}
                    keyboardType="numeric"
                    mode="outlined"
                    left={<PaperTextInput.Icon icon="calendar-range" />}
                />
            </Card>

            {/* Additional Details */}
            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Additional Details</Text>
                <PaperTextInput
                    label="Notes (optional)"
                    value={loanData.notes}
                    onChangeText={(t) => setField('notes', t)}
                    mode="outlined"
                    multiline
                    numberOfLines={3}
                    style={styles.input}
                    left={<PaperTextInput.Icon icon="note-text-outline" />}
                />
            </Card>

            {/* Loan Summary */}
            <Card style={styles.card}>
                <Text style={styles.sectionTitle}>Loan Summary</Text>

                <View style={styles.summaryGrid}>

                    <View style={styles.summaryTile}>
                        <MaterialCommunityIcons
                            name="cash-multiple"
                            size={26}
                            color="#2563EB"
                        />

                        <Text style={styles.summaryTileLabel}>
                            Principal
                        </Text>

                        <Text style={styles.summaryTileValue}>
                            ₹{summary.principal}
                        </Text>
                    </View>

                    <View style={styles.summaryTile}>
                        <MaterialCommunityIcons
                            name="wallet-outline"
                            size={26}
                            color="#16A34A"
                        />

                        <Text style={styles.summaryTileLabel}>
                            Outstanding
                        </Text>

                        <Text style={styles.summaryTileValue}>
                            ₹{summary.outstanding}
                        </Text>
                    </View>

                    <View style={styles.summaryTile}>
                        <MaterialCommunityIcons
                            name="percent-outline"
                            size={26}
                            color="#F59E0B"
                        />
                        <Text style={styles.summaryTileLabel}>
                            Interest
                        </Text>
                        <Text style={styles.summaryTileValue}>
                            {summary.interest}%
                        </Text>
                    </View>

                    <View style={styles.summaryTile}>
                        <MaterialCommunityIcons
                            name="calendar-check-outline"
                            size={26}
                            color="#7C3AED"
                        />
                        <Text style={styles.summaryTileLabel}>
                            EMI
                        </Text>
                        <Text style={styles.summaryTileValue}>
                            ₹{summary.emi}
                        </Text>
                    </View>

                </View>
            </Card>

            {/* Actions */}
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
                {editId ? (
                    <PaperButton mode="outlined" onPress={() => setShowConfirmDelete(true)} style={{ flex: 1, marginRight: 8 }} textColor="#E46A6A">Delete</PaperButton>
                ) : null}
                <PaperButton mode="contained" onPress={submit} style={{ flex: 1 }}>{editId ? 'Update Loan' : 'Save Loan'}</PaperButton>
            </View>

            <ConfirmDialog visible={showConfirmDelete} title="Delete Loan?" message="This will mark the loan as Closed. This action cannot be undone." confirmLabel="Close Loan" cancelLabel="Cancel" onConfirm={confirmDelete} onCancel={() => setShowConfirmDelete(false)} />

            {/* Type picker modal (simple inline) */}
            {showTypePicker ? (
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Loan Type</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            {LOAN_TYPES.map(t => (
                                <Chip key={t.key} selected={loanData.loan_type === t.key} onPress={() => { setField('loan_type', t.key); setShowTypePicker(false); }} style={{ marginRight: 8, marginBottom: 8 }}>
                                    <MaterialCommunityIcons name={t.icon} size={18} style={{ marginRight: 6 }} />{t.label}
                                </Chip>
                            ))}
                        </View>
                        <PaperButton onPress={() => setShowTypePicker(false)}>Close</PaperButton>
                    </View>
                </View>
            ) : null}

            {/* Due day picker */}
            {showDueDayPicker ? (
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Select EMI due day</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            {Array.from({ length: 31 }).map((_, i) => {
                                const d = i + 1;
                                return (
                                    <Chip key={d} selected={String(loanData.emi_day) === String(d)} onPress={() => { setField('emi_day', String(d)); setShowDueDayPicker(false); }} style={{ marginRight: 6, marginBottom: 6 }}>{String(d)}</Chip>
                                );
                            })}
                        </View>
                        <PaperButton onPress={() => setShowDueDayPicker(false)}>Close</PaperButton>
                    </View>
                </View>
            ) : null}

            {/* Start date picker (platform) */}
            {showStartPicker && Platform.OS !== 'web' ? (
                <DateTimePicker
                    value={loanData.loan_start_date ? new Date(loanData.loan_start_date) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                        if (Platform.OS === 'android') {
                            setShowStartPicker(false);
                            if (event.type === 'dismissed') return;
                        }
                        if (selectedDate) setField('loan_start_date', selectedDate.toISOString().slice(0, 10));
                        if (Platform.OS === 'ios') setShowStartPicker(false);
                    }}
                />
            ) : null}

            {showStartPicker && Platform.OS === 'web' ? (
                <View />
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#EEF4FF',
    },

    content: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 120,
    },

    /* ---------- Cards ---------- */

    card: {
        marginBottom: 12,
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        borderLeftWidth: 5,
        borderLeftColor: '#4F46E5',
        shadowColor: '#4F46E5',
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
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 18,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#EEF2FF',
    },

    subtitle: {
        color: '#64748B',
        fontSize: 13,
        marginBottom: 16,
    },

    /* ---------- Inputs ---------- */

    input: {
        marginBottom: 16,
        backgroundColor: '#F8FAFF',
        overflow: 'hidden',
    },

    inputDense: {
        height: 58,
    },

    error: {
        color: '#EF4444',
        fontSize: 12,
        marginTop: -10,
        marginBottom: 12,
        marginLeft: 8,
        fontWeight: '600',
    },

    /* ---------- Layout ---------- */

    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },

    half: {
        width: '48%',
    },

    divider: {
        height: 1,
        backgroundColor: '#E7ECF7',
        marginVertical: 18,
    },

    /* ---------- Summary ---------- */

    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },

    summaryTile: {
        width: '48%',
        borderRadius: 22,
        paddingVertical: 22,
        marginBottom: 14,
        alignItems: 'center',
        backgroundColor: '#F8FAFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#4F46E5',
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
        fontWeight: '600',
        color: '#64748B',
    },

    summaryTileValue: {
        marginTop: 6,
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
    },

    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 18,
    },

    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EEF2F7',
    },

    summaryLabel: {
        color: '#64748B',
        fontWeight: '600',
        fontSize: 14,
    },

    summaryValue: {
        color: '#111827',
        fontWeight: '700',
        fontSize: 16,
    },

    /* ---------- Buttons ---------- */

    buttonRow: {
        flexDirection: 'row',
        marginTop: 16,
        marginBottom: 30,
    },

    primaryButton: {
        flex: 1,
        height: 56,
        borderRadius: 20,
        justifyContent: 'center',
        backgroundColor: '#4F46E5',
        shadowColor: '#4F46E5',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 6,
    },

    secondaryButton: {
        flex: 1,
        height: 56,
        borderRadius: 20,
        marginRight: 12,
        backgroundColor: '#FFF5F5',
        borderWidth: 1,
        borderColor: '#FCA5A5',
    },

    /* ---------- Bottom Sheet ---------- */

    sheetOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15,23,42,0.45)',
    },

    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 30,
        maxHeight: '78%',
    },

    sheetTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 18,
    },

    /* ---------- Chips ---------- */

    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },

    chip: {
        marginRight: 10,
        marginBottom: 10,
        borderRadius: 25,
        backgroundColor: '#EEF2FF',
        height: 42,
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },

    chipSelected: {
        backgroundColor: '#4F46E5',
        borderColor: '#4F46E5',
    },

    shadowLight: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
});