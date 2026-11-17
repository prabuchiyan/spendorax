import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { updateCreditCardStatement } from '../services/creditCards';
import events from '../services/events';
import { useTheme } from '../context/ThemeContext';
import MuiDateTimePicker from '../components/MuiDateTimePicker';

export default function CreditCardStatementEditScreen({ route, navigation }) {
    const { isDarkMode, theme } = useTheme();
    const { editData } = route.params || {};
    const [statementDate, setStatementDate] = useState(editData?.statement_date ? String(editData.statement_date).slice(0, 10) : '');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [openingBalance, setOpeningBalance] = useState('0');
    const [fees, setFees] = useState('0');
    const [interest, setInterest] = useState('0');
    const [refunds, setRefunds] = useState('0');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editData) {
            if (editData.statement_date) {
                setStatementDate(String(editData.statement_date).slice(0, 10));
            }
            setOpeningBalance(editData.opening_balance != null ? String(editData.opening_balance) : '0');
            setFees(editData.fees != null ? String(editData.fees) : '0');
            setInterest(editData.interest != null ? String(editData.interest) : '0');
            setRefunds(editData.refunds != null ? String(editData.refunds) : '0');
        }
    }, [editData]);

    const parseVal = (v) => {
        if (v == null) return 0;
        const cleaned = String(v).replace(/,/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    };

    const purchases = Number(editData?.purchases || 0);
    const calculatedClosing = Math.max(
        0,
        parseVal(openingBalance) + purchases + parseVal(fees) + parseVal(interest) - parseVal(refunds)
    );

    async function handleSave() {
        if (saving) return;

        setSaving(true);
        await new Promise(resolve => requestAnimationFrame(resolve)); // Allow UI to render the loading state on button
        try {
            const payload = {
                opening_balance: parseVal(openingBalance),
                fees: parseVal(fees),
                interest: parseVal(interest),
                refunds: parseVal(refunds),
                statement_date: statementDate || undefined,
            };

            if (editData && editData.id) {
                await updateCreditCardStatement(editData.id, payload);
                events.emit('statementChanged');
            }
            navigation.goBack();
        } catch (error) {
            console.error('Error saving statement details:', error);
            Alert.alert('Error', 'Failed to save statement details. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    const themeColor = editData?.card_color || "#4B7CF3";

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: theme.bg }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1 }}
            >
                {/* ── HEADER ── */}
                <View
                    style={{
                        backgroundColor: themeColor,
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
                                name="file-document-edit-outline"
                                size={32}
                                color="#FFF"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: "#FFF", fontSize: 26, fontWeight: "900", letterSpacing: 0.5 }}>
                                Edit Statement
                            </Text>
                            <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 6, fontSize: 14 }}>
                                Manually adjust statement values
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── FORM ── */}
                <View style={{ paddingHorizontal: 24, flex: 1 }}>

                    {/* ── STATEMENT DATE ── */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                            STATEMENT DATE
                        </Text>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowDatePicker(true)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: theme.inputBg,
                                borderWidth: 1,
                                borderColor: theme.border,
                                borderRadius: 8,
                                paddingHorizontal: 16,
                                paddingVertical: 14,
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="calendar" size={20} color={themeColor} style={{ marginRight: 10 }} />
                                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.textPrimary }}>
                                    {statementDate ? new Date(statementDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select Date'}
                                </Text>
                            </View>
                            <MaterialCommunityIcons name="pencil" size={16} color={themeColor} />
                        </TouchableOpacity>
                    </View>

                    {/* ── OPENING BALANCE ── */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                            OPENING BALANCE
                        </Text>
                        <TextInput
                            mode="outlined"
                            keyboardType="numeric"
                            value={openingBalance}
                            onChangeText={setOpeningBalance}
                            outlineColor={theme.border}
                            activeOutlineColor={themeColor}
                            style={{ backgroundColor: theme.inputBg, fontSize: 18, fontWeight: '600' }}
                            disabled={saving}
                            left={<TextInput.Affix text="₹ " textStyle={{ fontSize: 18, color: '#94A3B8', fontWeight: '600' }} />}
                        />
                    </View>

                    {/* ── FEES & INTEREST ── */}
                    <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>FEES</Text>
                            <TextInput
                                mode="outlined"
                                keyboardType="numeric"
                                value={fees}
                                onChangeText={setFees}
                                outlineColor={theme.border}
                                activeOutlineColor={themeColor}
                                style={{ backgroundColor: theme.inputBg, fontSize: 16, fontWeight: '600' }}
                                disabled={saving}
                                left={<TextInput.Affix text="₹ " textStyle={{ color: '#94A3B8' }} />}
                            />
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>INTEREST</Text>
                            <TextInput
                                mode="outlined"
                                keyboardType="numeric"
                                value={interest}
                                onChangeText={setInterest}
                                outlineColor={theme.border}
                                activeOutlineColor={themeColor}
                                style={{ backgroundColor: theme.inputBg, fontSize: 16, fontWeight: '600' }}
                                disabled={saving}
                                left={<TextInput.Affix text="₹ " textStyle={{ color: '#94A3B8' }} />}
                            />
                        </View>
                    </View>

                    {/* ── REFUNDS ── */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                            REFUNDS
                        </Text>
                        <TextInput
                            mode="outlined"
                            keyboardType="numeric"
                            value={refunds}
                            onChangeText={setRefunds}
                            outlineColor={theme.border}
                            activeOutlineColor={themeColor}
                            style={{ backgroundColor: theme.inputBg, fontSize: 18, fontWeight: '600' }}
                            disabled={saving}
                            left={<TextInput.Affix text="₹ " textStyle={{ fontSize: 18, color: '#94A3B8', fontWeight: '600' }} />}
                        />
                    </View>

                    {/* ── CALCULATION PREVIEW ── */}
                    <View
                        style={{
                            backgroundColor: theme.cardBg,
                            borderRadius: 20,
                            padding: 20,
                            borderWidth: 1,
                            borderColor: theme.border,
                            marginBottom: 24,
                        }}
                    >
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
                            <MaterialCommunityIcons name="calculator-variant-outline" size={20} color={themeColor} />
                            <Text style={{ fontSize: 13, fontWeight: "800", color: "#334155", marginLeft: 8, letterSpacing: 0.3 }}>
                                STATEMENT CALCULATION PREVIEW
                            </Text>
                        </View>

                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                            <Text style={{ fontSize: 14, color: theme.textSecondary }}>Opening Balance</Text>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: "#1E293B" }}>
                                ₹{parseVal(openingBalance).toFixed(2)}
                            </Text>
                        </View>

                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                            <Text style={{ fontSize: 14, color: theme.textSecondary }}>Purchases & Debits</Text>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: "#1E293B" }}>
                                + ₹{purchases.toFixed(2)}
                            </Text>
                        </View>

                        {parseVal(fees) > 0 && (
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                                <Text style={{ fontSize: 14, color: theme.textSecondary }}>Fees</Text>
                                <Text style={{ fontSize: 14, fontWeight: "600", color: "#DC2626" }}>
                                    + ₹{parseVal(fees).toFixed(2)}
                                </Text>
                            </View>
                        )}

                        {parseVal(interest) > 0 && (
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                                <Text style={{ fontSize: 14, color: theme.textSecondary }}>Interest</Text>
                                <Text style={{ fontSize: 14, fontWeight: "600", color: "#DC2626" }}>
                                    + ₹{parseVal(interest).toFixed(2)}
                                </Text>
                            </View>
                        )}

                        {parseVal(refunds) > 0 && (
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                                <Text style={{ fontSize: 14, color: theme.textSecondary }}>Refunds</Text>
                                <Text style={{ fontSize: 14, fontWeight: "600", color: "#059669" }}>
                                    - ₹{parseVal(refunds).toFixed(2)}
                                </Text>
                            </View>
                        )}

                        <View style={{ height: 1, backgroundColor: "#E2E8F0", marginVertical: 10 }} />

                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <Text style={{ fontSize: 15, fontWeight: "800", color: "#0F172A" }}>
                                New Statement Balance
                            </Text>
                            <Text style={{ fontSize: 18, fontWeight: "900", color: themeColor }}>
                                ₹{calculatedClosing.toFixed(2)}
                            </Text>
                        </View>
                    </View>

                    {/* SPACER TO PUSH BUTTON TO BOTTOM */}
                    <View style={{ flex: 1, minHeight: 20 }} />

                    <Button
                        mode="contained"
                        onPress={handleSave}
                        loading={saving}
                        disabled={saving}
                        buttonColor={themeColor}
                        style={{ borderRadius: 16, paddingVertical: 8, marginBottom: 24 }}
                        labelStyle={{ fontSize: 18, fontWeight: "800", color: "#FFF", letterSpacing: 0.5 }}
                    >
                        Update Statement
                    </Button>
                </View>
            </ScrollView>

            <MuiDateTimePicker
                visible={showDatePicker}
                initialDate={statementDate ? new Date(statementDate) : new Date()}
                hideTime={true}
                onClose={() => setShowDatePicker(false)}
                onSelect={(d) => {
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    setStatementDate(`${yyyy}-${mm}-${dd}`);
                    setShowDatePicker(false);
                }}
            />
        </KeyboardAvoidingView>
    );
}
