import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    Modal, ScrollView, StyleSheet, Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button as PaperButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { recordAdvance, getLoanById } from '../services/loans';
import { getSources } from '../services/sources';
import { getCategories } from '../services/categories';
import Card from '../components/Card';

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

export default function LendMoreScreen({ route, navigation }) {
    const loanId = route?.params?.id ? Number(route.params.id) : null;

    const [loan, setLoan] = useState(null);
    const [amount, setAmount] = useState('');
    const [amountFocused, setAmountFocused] = useState(false);
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [sources, setSources] = useState([]);
    const [categories, setCategories] = useState([]);
    const [sourceId, setSourceId] = useState(null);
    const [categoryId, setCategoryId] = useState(null);

    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

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

    function validate() {
        if (!loanId) { alert('Loan not found'); return false; }
        if (!sourceId) { alert('Select a payment source'); return false; }
        if (!categoryId) { alert('Select a category'); return false; }
        if (!amount || Number(amount) <= 0) { alert('Enter a valid amount'); return false; }
        return true;
    }

    async function save() {
        if (!validate()) return;
        try {
            await recordAdvance({
                loanId,
                date: date + 'T' + new Date().toTimeString().slice(0, 8),
                amount: Number(amount),
                sourceId,
                categoryId,
                notes: notes.trim() || `Additional lending: ${loan?.loan_name}`,
            });
            navigation.goBack();
        } catch (e) {
            console.error('Advance failed', e);
            alert(e?.message || 'Failed to record advance');
        }
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#F3F6FB' }}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            >
                <Card style={{ borderRadius: 24, overflow: 'hidden' }}>

                    {/* ── HEADER (purple, matching lend direction) ── */}
                    <View style={{
                        backgroundColor: '#7C3AED',
                        margin: -16, marginBottom: 18,
                        padding: 20,
                        borderBottomLeftRadius: 24,
                        borderBottomRightRadius: 24,
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{
                                width: 56, height: 56, borderRadius: 18,
                                backgroundColor: 'rgba(255,255,255,0.18)',
                                justifyContent: 'center', alignItems: 'center', marginRight: 16,
                            }}>
                                <MaterialCommunityIcons name="hand-coin-outline" size={28} color="#FFF" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '900' }}>
                                    Lend More
                                </Text>
                                <Text style={{ color: '#DDD6FE', marginTop: 4 }}>
                                    Give additional money to borrower
                                </Text>
                            </View>
                        </View>

                        {/* Loan summary pill */}
                        {loan && (
                            <View style={{
                                marginTop: 22,
                                backgroundColor: 'rgba(255,255,255,0.12)',
                                borderRadius: 18, padding: 16,
                            }}>
                                <Text style={{ color: '#DDD6FE', fontSize: 12 }}>Lending To</Text>
                                <Text style={{ color: '#FFF', marginTop: 4, fontWeight: '900', fontSize: 18 }}>
                                    {loan.loan_name}
                                </Text>
                                <Text style={{ color: '#DDD6FE', marginTop: 6 }}>
                                    Current Outstanding ₹{Number(loan.outstanding_amount || 0).toLocaleString('en-IN')}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* ── SOURCE ── */}
                    <FieldCard
                        icon="wallet-outline"
                        color="#16A34A"
                        title="Payment Source"
                        value={selectedSource ? selectedSource.name : 'Select Bank / Wallet'}
                        onPress={() => setShowSourcePicker(true)}
                    />

                    {/* ── CATEGORY ── */}
                    <FieldCard
                        icon="shape-outline"
                        color="#EA580C"
                        title="Category"
                        value={selectedCategory ? selectedCategory.name : 'Select Category'}
                        onPress={() => setShowCategoryPicker(true)}
                    />

                    {/* ── DATE ── */}
                    <FieldCard
                        icon="calendar-outline"
                        color="#2563EB"
                        title="Date"
                        value={date}
                        onPress={() => setShowDatePicker(true)}
                    />

                    {/* ── AMOUNT ── */}
                    <View style={styles.amountCard}>
                        <Text style={styles.amountLabel}>Amount to Lend</Text>
                        <View style={styles.amountRow}>
                            <View style={[
                                styles.amountInputContainer,
                                amountFocused && { borderColor: '#7C3AED', borderWidth: 2 },
                            ]}>
                                <Text style={[styles.currency, { color: '#7C3AED' }]}>₹</Text>
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
                                    style={[styles.amountInput, { outlineStyle: 'none' }]}
                                    onChangeText={(text) => {
                                        let value = text.replace(/[^0-9.]/g, '');
                                        const firstDot = value.indexOf('.');
                                        if (firstDot !== -1) {
                                            value = value.substring(0, firstDot + 1) +
                                                value.substring(firstDot + 1).replace(/\./g, '');
                                        }
                                        setAmount(value);
                                    }}
                                />
                            </View>
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
                            style={[styles.notesInput, { outlineStyle: 'none' }]}
                        />
                    </View>

                    {/* ── SAVE BUTTON ── */}
                    <View style={{ marginTop: 10, marginBottom: 25 }}>
                        <PaperButton
                            mode="contained"
                            onPress={save}
                            style={[styles.saveButton, { backgroundColor: '#7C3AED' }]}
                            contentStyle={{ height: 54 }}
                            labelStyle={{ fontSize: 16, fontWeight: '800' }}
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
                                    onPress={() => { setSourceId(source.id); setShowSourcePicker(false); }}
                                />
                            ))}
                            <View style={{ height: 10 }} />
                        </ScrollView>
                        <PaperButton mode="outlined" style={{ marginTop: 12, borderRadius: 14 }}
                            onPress={() => setShowSourcePicker(false)}>Close</PaperButton>
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
                                    onPress={() => { setCategoryId(category.id); setShowCategoryPicker(false); }}
                                />
                            ))}
                            <View style={{ height: 10 }} />
                        </ScrollView>
                        <PaperButton mode="outlined" style={{ marginTop: 12, borderRadius: 14 }}
                            onPress={() => setShowCategoryPicker(false)}>Close</PaperButton>
                    </View>
                </View>
            </Modal>

            {/* ── DATE PICKER ── */}
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
        </View>
    );
}

const styles = StyleSheet.create({
    fieldCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFFFFF', borderRadius: 18,
        paddingVertical: 14, paddingHorizontal: 14,
        marginBottom: 14, minHeight: 72,
    },
    fieldIcon: {
        width: 46, height: 46, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    fieldTitle: { color: '#64748B', fontSize: 12 },
    fieldValue: { marginTop: 4, fontWeight: '800', fontSize: 15, color: '#111827' },

    amountCard: {
        backgroundColor: '#FFFFFF', borderRadius: 20,
        padding: 16, marginBottom: 18, elevation: 2,
    },
    amountLabel: { color: '#64748B', fontSize: 12 },
    amountRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    currency: { fontSize: 30, fontWeight: '900', marginRight: 8 },
    amountInput: {
        flex: 1, fontSize: 30, fontWeight: '800',
        color: '#111827', paddingVertical: 8, minHeight: 54,
    },
    amountInputContainer: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        borderWidth: 1.5, borderColor: '#D6E4FF', borderRadius: 18,
        backgroundColor: '#F8FBFF', paddingHorizontal: 16,
        paddingVertical: 10, marginTop: 12,
    },

    notesCard: {
        backgroundColor: '#FFFFFF', borderRadius: 20,
        padding: 16, marginBottom: 18,
    },
    notesLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 10 },
    notesInput: {
        borderWidth: 1.5, borderColor: '#D6E4FF',
        backgroundColor: '#F8FBFF', borderRadius: 16,
        minHeight: 110, paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, color: '#111827', textAlignVertical: 'top',
    },
    saveButton: { borderRadius: 18, marginTop: 10 },

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