import React, { useState, useEffect } from 'react';
import {
    View, Text, Modal, TouchableOpacity, Platform,
    StyleSheet, Alert, ScrollView
} from 'react-native';
import { TextInput as PaperTextInput, Button as PaperButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { recordAdvance } from '../services/loans';
import { getSources } from '../services/sources';
import { getCategories } from '../services/categories';

// Reused exactly from LoanPaymentScreen
function FieldCard({ icon, title, value, color = '#2563EB', onPress }) {
    return (
        <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.fieldCard}>
            <View style={[styles.fieldIcon, { backgroundColor: color + '20' }]}>
                <MaterialCommunityIcons name={icon} size={22} color={color} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.fieldTitle}>{title}</Text>
                <Text style={styles.fieldValue} numberOfLines={1}>{value}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
        </TouchableOpacity>
    );
}

// Reused exactly from LoanPaymentScreen
function PickerItem({ icon, iconColor = '#2563EB', iconBg = '#DBEAFE', title, subtitle, selected = false, onPress }) {
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
            <View style={{
                width: 48, height: 48, borderRadius: 14,
                backgroundColor: iconBg, justifyContent: 'center',
                alignItems: 'center', marginRight: 14,
            }}>
                <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827' }} numberOfLines={1}>
                    {title}
                </Text>
                {!!subtitle && (
                    <Text style={{ marginTop: 4, fontSize: 12, color: '#64748B' }} numberOfLines={1}>
                        {subtitle}
                    </Text>
                )}
            </View>
            {selected ? (
                <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center',
                }}>
                    <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
                </View>
            ) : (
                <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
            )}
        </TouchableOpacity>
    );
}

export default function LendMoreSheet({ visible, loanId, loanName, onClose, onSuccess }) {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [notes, setNotes] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    // Source & Category state
    const [sources, setSources] = useState([]);
    const [categories, setCategories] = useState([]);
    const [sourceId, setSourceId] = useState(null);
    const [categoryId, setCategoryId] = useState(null);
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const src = await getSources();
                setSources(src || []);
                if (src?.length > 0) setSourceId(src[0].id);
            } catch (e) { console.warn('Failed to load sources', e); }
        })();
        (async () => {
            try {
                const cats = await getCategories();
                setCategories(cats || []);
            } catch (e) { console.warn('Failed to load categories', e); }
        })();
    }, []);

    const selectedSource = sources.find(s => s.id === sourceId);
    const selectedCategory = categories.find(c => c.id === categoryId);

    function reset() {
        setAmount('');
        setDate(new Date().toISOString().slice(0, 10));
        setNotes('');
        setErrors({});
        // keep sourceId/categoryId so user doesn't re-pick every time
    }

    function validate() {
        const next = {};
        const amt = parseFloat(amount);
        if (!amount || isNaN(amt) || amt <= 0) next.amount = 'Enter a valid amount';
        if (!sourceId) next.source = 'Select a payment source';
        if (!categoryId) next.category = 'Select a category';
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    async function handleSubmit() {
        if (!validate()) return;
        setLoading(true);
        try {
            await recordAdvance({
                loanId,
                date: date + 'T00:00:00',
                amount: parseFloat(amount),
                sourceId,
                categoryId,
                notes: notes.trim() || `Additional lending: ${loanName}`,
            });
            reset();
            onSuccess?.();
            onClose?.();
        } catch (e) {
            Alert.alert('Error', e?.message || 'Failed to record advance');
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Modal
                visible={visible}
                transparent
                animationType="slide"
                onRequestClose={() => { reset(); onClose?.(); }}
            >
                <View style={styles.overlay}>
                    <View style={styles.sheet}>

                        {/* Handle bar */}
                        <View style={styles.handleWrap}>
                            <View style={styles.handle} />
                        </View>

                        <Text style={styles.title}>Lend More</Text>
                        <Text style={styles.subtitle}>Additional amount for {loanName}</Text>

                        <ScrollView showsVerticalScrollIndicator={false}>

                            {/* Amount */}
                            <PaperTextInput
                                label="Amount"
                                value={amount}
                                onChangeText={t => { setAmount(t); setErrors(p => ({ ...p, amount: null })); }}
                                keyboardType="numeric"
                                mode="outlined"
                                left={<PaperTextInput.Icon icon="currency-inr" />}
                                style={styles.input}
                                error={!!errors.amount}
                                autoFocus
                            />
                            {errors.amount ? <Text style={styles.error}>{errors.amount}</Text> : null}

                            {/* Date */}
                            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                                <PaperTextInput
                                    label="Date"
                                    value={date}
                                    editable={false}
                                    mode="outlined"
                                    left={<PaperTextInput.Icon icon="calendar" />}
                                    right={<PaperTextInput.Icon icon="chevron-down" />}
                                    style={styles.input}
                                />
                            </TouchableOpacity>

                            {/* Source picker */}
                            <FieldCard
                                icon="wallet-outline"
                                color="#16A34A"
                                title="Payment Source"
                                value={selectedSource ? selectedSource.name : 'Select Bank / Wallet'}
                                onPress={() => setShowSourcePicker(true)}
                            />
                            {errors.source ? <Text style={styles.error}>{errors.source}</Text> : null}

                            {/* Category picker */}
                            <FieldCard
                                icon="shape-outline"
                                color="#EA580C"
                                title="Category"
                                value={selectedCategory ? selectedCategory.name : 'Select Category'}
                                onPress={() => setShowCategoryPicker(true)}
                            />
                            {errors.category ? <Text style={styles.error}>{errors.category}</Text> : null}

                            {/* Notes */}
                            <PaperTextInput
                                label="Notes (optional)"
                                value={notes}
                                onChangeText={setNotes}
                                mode="outlined"
                                multiline
                                numberOfLines={2}
                                left={<PaperTextInput.Icon icon="note-text-outline" />}
                                style={styles.input}
                            />

                            {/* Buttons */}
                            <View style={styles.buttonRow}>
                                <PaperButton
                                    mode="outlined"
                                    onPress={() => { reset(); onClose?.(); }}
                                    style={[styles.button, { marginRight: 10 }]}
                                    disabled={loading}
                                >
                                    Cancel
                                </PaperButton>
                                <PaperButton
                                    mode="contained"
                                    onPress={handleSubmit}
                                    style={styles.button}
                                    loading={loading}
                                    disabled={loading}
                                    icon="hand-coin-outline"
                                >
                                    Give Money
                                </PaperButton>
                            </View>

                        </ScrollView>
                    </View>
                </View>

                {/* Date picker */}
                {showDatePicker && Platform.OS !== 'web' && (
                    <DateTimePicker
                        value={new Date(date)}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        maximumDate={new Date()}
                        onChange={(event, selectedDate) => {
                            if (Platform.OS === 'android') {
                                setShowDatePicker(false);
                                if (event.type === 'dismissed') return;
                            }
                            if (selectedDate) setDate(selectedDate.toISOString().slice(0, 10));
                            if (Platform.OS === 'ios') setShowDatePicker(false);
                        }}
                    />
                )}
            </Modal>

            {/* Source Picker Modal */}
            <Modal visible={showSourcePicker} transparent animationType="slide">
                <View style={styles.pickerOverlay}>
                    <View style={styles.pickerSheet}>
                        <View style={styles.pickerHandle} />
                        <View style={styles.pickerHeader}>
                            <View>
                                <Text style={styles.pickerTitle}>Select Payment Source</Text>
                                <Text style={styles.pickerSubtitle}>Choose where the money is sent from</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowSourcePicker(false)}>
                                <MaterialCommunityIcons name="close-circle" size={28} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {sources.map(source => (
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
                                        setErrors(p => ({ ...p, source: null }));
                                        setShowSourcePicker(false);
                                    }}
                                />
                            ))}
                            <View style={{ height: 10 }} />
                        </ScrollView>
                        <PaperButton mode="outlined" style={{ marginTop: 12, borderRadius: 14 }}
                            onPress={() => setShowSourcePicker(false)}>Close</PaperButton>
                    </View>
                </View>
            </Modal>

            {/* Category Picker Modal */}
            <Modal visible={showCategoryPicker} transparent animationType="slide">
                <View style={styles.pickerOverlay}>
                    <View style={styles.pickerSheet}>
                        <View style={styles.pickerHandle} />
                        <View style={styles.pickerHeader}>
                            <View>
                                <Text style={styles.pickerTitle}>Select Category</Text>
                                <Text style={styles.pickerSubtitle}>Choose the expense category</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                                <MaterialCommunityIcons name="close-circle" size={28} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {categories.map(category => (
                                <PickerItem
                                    key={category.id}
                                    icon={category.icon || 'shape-outline'}
                                    iconColor={category.color || '#EA580C'}
                                    iconBg={(category.color || '#EA580C') + '20'}
                                    selected={category.id === categoryId}
                                    title={category.name}
                                    subtitle={category.type ? `${category.type} Category` : 'Loan Category'}
                                    onPress={() => {
                                        setCategoryId(category.id);
                                        setErrors(p => ({ ...p, category: null }));
                                        setShowCategoryPicker(false);
                                    }}
                                />
                            ))}
                            <View style={{ height: 10 }} />
                        </ScrollView>
                        <PaperButton mode="outlined" style={{ marginTop: 12, borderRadius: 14 }}
                            onPress={() => setShowCategoryPicker(false)}>Close</PaperButton>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15,23,42,0.45)',
    },
    sheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 40,
        maxHeight: '90%',
    },
    handleWrap: { alignItems: 'center', marginBottom: 16 },
    handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D6D6D6' },
    title: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
    subtitle: { fontSize: 13, color: '#64748B', marginBottom: 20 },
    input: { marginBottom: 14, backgroundColor: '#F8FAFF' },
    error: {
        color: '#EF4444', fontSize: 12,
        marginTop: -10, marginBottom: 10,
        marginLeft: 8, fontWeight: '600',
    },
    buttonRow: { flexDirection: 'row', marginTop: 8, marginBottom: 16 },
    button: { flex: 1, borderRadius: 16 },

    // FieldCard
    fieldCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F8FAFC', borderRadius: 18,
        paddingVertical: 14, paddingHorizontal: 14,
        marginBottom: 14, minHeight: 72,
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    fieldIcon: {
        width: 46, height: 46, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    fieldTitle: { color: '#64748B', fontSize: 12 },
    fieldValue: { marginTop: 4, fontWeight: '800', fontSize: 15, color: '#111827' },

    // Picker modals
    pickerOverlay: {
        flex: 1, justifyContent: 'flex-end',
        backgroundColor: 'rgba(15,23,42,0.45)',
    },
    pickerSheet: {
        backgroundColor: '#F8FAFC',
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 20, maxHeight: '75%',
    },
    pickerHandle: {
        width: 52, height: 5, borderRadius: 3,
        backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 18,
    },
    pickerHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 18,
    },
    pickerTitle: { fontSize: 21, fontWeight: '900', color: '#111827' },
    pickerSubtitle: { marginTop: 4, color: '#64748B' },
});