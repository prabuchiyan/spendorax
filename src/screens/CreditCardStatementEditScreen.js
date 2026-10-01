import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { updateCreditCardStatement } from '../services/creditCards';
import events from '../services/events';

export default function CreditCardStatementEditScreen({ route, navigation }) {
    const { editData } = route.params || {};
    const [openingBalance, setOpeningBalance] = useState('0');
    const [fees, setFees] = useState('0');
    const [interest, setInterest] = useState('0');
    const [refunds, setRefunds] = useState('0');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (editData) {
            setOpeningBalance(editData.opening_balance ? String(editData.opening_balance) : '0');
            setFees(editData.fees ? String(editData.fees) : '0');
            setInterest(editData.interest ? String(editData.interest) : '0');
            setRefunds(editData.refunds ? String(editData.refunds) : '0');
        }
    }, [editData]);

    async function handleSave() {
        if (saving) return;

        setSaving(true);
        try {
            const payload = {
                opening_balance: parseFloat(openingBalance) || 0,
                fees: parseFloat(fees) || 0,
                interest: parseFloat(interest) || 0,
                refunds: parseFloat(refunds) || 0
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

    const themeColor = "#4B7CF3";

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#FFF" }}
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

                    {/* ── OPENING BALANCE ── */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                            OPENING BALANCE
                        </Text>
                        <TextInput
                            mode="outlined"
                            keyboardType="numeric"
                            value={openingBalance}
                            onChangeText={setOpeningBalance}
                            outlineColor="#E2E8F0"
                            activeOutlineColor={themeColor}
                            style={{ backgroundColor: "#FAFAFA", fontSize: 18, fontWeight: '600' }}
                            disabled={saving}
                            left={<TextInput.Affix text="₹ " textStyle={{ fontSize: 18, color: '#94A3B8', fontWeight: '600' }} />}
                        />
                    </View>

                    {/* ── FEES & INTEREST ── */}
                    <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>FEES</Text>
                            <TextInput
                                mode="outlined"
                                keyboardType="numeric"
                                value={fees}
                                onChangeText={setFees}
                                outlineColor="#E2E8F0"
                                activeOutlineColor={themeColor}
                                style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }}
                                disabled={saving}
                                left={<TextInput.Affix text="₹ " textStyle={{ color: '#94A3B8' }} />}
                            />
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>INTEREST</Text>
                            <TextInput
                                mode="outlined"
                                keyboardType="numeric"
                                value={interest}
                                onChangeText={setInterest}
                                outlineColor="#E2E8F0"
                                activeOutlineColor={themeColor}
                                style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }}
                                disabled={saving}
                                left={<TextInput.Affix text="₹ " textStyle={{ color: '#94A3B8' }} />}
                            />
                        </View>
                    </View>

                    {/* ── REFUNDS ── */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                            REFUNDS
                        </Text>
                        <TextInput
                            mode="outlined"
                            keyboardType="numeric"
                            value={refunds}
                            onChangeText={setRefunds}
                            outlineColor="#E2E8F0"
                            activeOutlineColor={themeColor}
                            style={{ backgroundColor: "#FAFAFA", fontSize: 18, fontWeight: '600' }}
                            disabled={saving}
                            left={<TextInput.Affix text="₹ " textStyle={{ fontSize: 18, color: '#94A3B8', fontWeight: '600' }} />}
                        />
                    </View>

                    {/* SPACER TO PUSH BUTTON TO BOTTOM */}
                    <View style={{ flex: 1, minHeight: 40 }} />

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
        </KeyboardAvoidingView>
    );
}