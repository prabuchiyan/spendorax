import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { TextInput as PaperInput, Button as PaperButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createBill, updateBill } from '../services/bills';
import { getOccurrenceDateConstraints } from '../services/billUtils';
import MuiDateTimePicker from "../components/MuiDateTimePicker";

function isCreditCardBill(bill) {
    return (
        typeof bill?.notes === "string" && (
            bill.notes.startsWith("Recurring payment template for") ||
            bill.notes.startsWith("Statement ")));
}

export default function BillOccurrenceEditScreen({ route, navigation }) {
    const { occurrence, bill } = route.params;

    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [showDuePicker, setShowDuePicker] = useState(false);
    const [constraints, setConstraints] = useState({ minDate: null, maxDate: null });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (occurrence && bill) {
            setAmount(String(occurrence.amount || ''));
            const currentDueDate = occurrence.due_date ? occurrence.due_date.slice(0, 10) : '';
            setDueDate(currentDueDate);

            const { minDate, maxDate } = getOccurrenceDateConstraints({
                recurrenceType: bill.recurrence_type,
                occurrenceDate: currentDueDate,
                startDate: bill.due_date,
                endDate: bill.recurrence_end_date
            });
            setConstraints({ minDate, maxDate });
        }
    }, [occurrence, bill]);

    async function handleSave() {
        let newErrors = {};
        const amt = parseFloat(amount);

        if (!amount || isNaN(amt) || amt <= 0) {
            newErrors.amount = 'Please enter a valid amount';
        }
        if (!dueDate) {
            newErrors.dueDate = 'Please select a due date';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            setLoading(true);
            await new Promise(resolve => requestAnimationFrame(resolve)); // allow UI to render loading

            if (
                occurrence.id === bill.id &&
                bill.is_recurring &&
                !isCreditCardBill(bill)
            ) {
                await createBill({
                    ...bill,
                    amount: amt,
                    due_date: dueDate,
                    is_recurring: 0,
                    recurrence_type: null,
                    parent_bill_id: bill.id
                });
            } else {
                await updateBill(occurrence.id, {
                    amount: amt,
                    due_date: dueDate
                });
            }

            navigation.goBack();
        } catch (e) {
            console.error("[BillOccurrenceEdit] Save occurrence failed:", e);
            Alert.alert("Error", e?.message || "Failed to save occurrence.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#FFF" }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View pointerEvents={loading ? "none" : "auto"} style={{ flex: 1, opacity: loading ? 0.6 : 1 }}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ flexGrow: 1 }}
                >
                    {/* ── HEADER ── */}
                    <View
                        style={{
                            backgroundColor: "#2563EB",
                            padding: 24,
                            paddingTop: 32,
                            paddingBottom: 40,
                            borderBottomLeftRadius: 40,
                            borderBottomRightRadius: 40,
                            marginBottom: 32,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <View
                                style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 20,
                                    backgroundColor: "rgba(255,255,255,0.2)",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    marginRight: 16,
                                }}
                            >
                                <MaterialCommunityIcons
                                    name="calendar-edit"
                                    size={32}
                                    color="#FFF"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: "#FFF", fontSize: 26, fontWeight: "900", letterSpacing: 0.5 }}>
                                    Edit Occurrence
                                </Text>
                                <Text style={{ color: "#DBEAFE", marginTop: 6, fontSize: 14 }}>
                                    Update this specific bill's details
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* ── FORM ── */}
                    <View style={{ paddingHorizontal: 24, flex: 1 }}>

                        {/* ── AMOUNT ── */}
                        <View style={{ marginBottom: 16, marginTop: 12 }}>
                            <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                                AMOUNT
                            </Text>
                            <PaperInput
                                mode="outlined"
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={(val) => {
                                    setAmount(val);
                                    setErrors((prev) => ({ ...prev, amount: undefined }));
                                }}
                                error={!!errors.amount}
                                outlineColor="#E2E8F0"
                                activeOutlineColor="#2563EB"
                                style={{ backgroundColor: "#FAFAFA", fontSize: 24, fontWeight: '700', paddingVertical: 8 }}
                                disabled={loading}
                                left={<PaperInput.Affix text="₹ " textStyle={{ fontSize: 24, color: '#2563EB', fontWeight: '700' }} />}
                                placeholder="0.00"
                            />
                            {!!errors.amount && (
                                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                                    <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
                                    <Text style={{ color: "#DC2626", fontSize: 12, marginLeft: 6, fontWeight: "500" }}>
                                        {errors.amount}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* ── DUE DATE ── */}
                        <View style={{ marginBottom: 16, marginTop: 12 }}>
                            <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                                DUE DATE
                            </Text>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                disabled={loading}
                                onPress={() => setShowDuePicker(true)}
                            >
                                <PaperInput
                                    value={dueDate}
                                    editable={false}
                                    disabled={loading}
                                    mode="outlined"
                                    outlineColor="#E2E8F0"
                                    activeOutlineColor="#2563EB"
                                    style={{ backgroundColor: "#FAFAFA", fontSize: 18, fontWeight: '600' }}
                                    error={!!errors.dueDate}
                                    right={
                                        <PaperInput.Icon
                                            icon="calendar"
                                            color="#94A3B8"
                                            onPress={() => !loading && setShowDuePicker(true)}
                                        />
                                    }
                                />
                            </TouchableOpacity>
                            {!!errors.dueDate && (
                                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                                    <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
                                    <Text style={{ color: "#DC2626", fontSize: 12, marginLeft: 6, fontWeight: "500" }}>
                                        {errors.dueDate}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* SPACER TO PUSH BUTTON TO BOTTOM */}
                        <View style={{ flex: 1, minHeight: 40 }} />

                        <PaperButton
                            mode="contained"
                            onPress={handleSave}
                            loading={loading}
                            disabled={loading}
                            buttonColor="#2563EB"
                            style={{ borderRadius: 16, paddingVertical: 8, marginBottom: 24 }}
                            labelStyle={{ fontSize: 18, fontWeight: "800", color: "#FFF", letterSpacing: 0.5 }}
                        >
                            Save Changes
                        </PaperButton>
                    </View>
                </ScrollView>
            </View>

            <MuiDateTimePicker
                visible={showDuePicker}
                initialDate={dueDate ? new Date(dueDate) : new Date()}
                minDate={constraints.minDate}
                maxDate={constraints.maxDate}
                hideTime={true}
                onClose={() => setShowDuePicker(false)}
                onSelect={(selectedDate) => {
                    if (selectedDate) {
                        setDueDate(selectedDate.toISOString().slice(0, 10));
                        setErrors((prev) => ({ ...prev, dueDate: undefined }));
                    }
                    setShowDuePicker(false);
                }}
            />
        </KeyboardAvoidingView>
    );
}
