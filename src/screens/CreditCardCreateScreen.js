import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity
} from 'react-native';
import { TextInput, Button, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createCreditCard, updateCreditCard } from '../services/creditCards';
import ColorPickerModal from '../components/ColorPickerModal';

export default function CreditCardCreateScreen({ route, navigation }) {
  const { editData } = route.params || {};

  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [last4, setLast4] = useState('');
  const [network, setNetwork] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [dueAfterDays, setDueAfterDays] = useState('');
  const [minimumDuePercent, setMinimumDuePercent] = useState('');
  const [interestRatePercent, setInterestRatePercent] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [color, setColor] = useState('#4B7CF3');
  const [status, setStatus] = useState(true);
  
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (editData) {
      setName(editData.name || '');
      setBank(editData.bank || '');
      setLast4(editData.last4 || '');
      setNetwork(editData.network || '');
      setCreditLimit(editData.credit_limit ? String(editData.credit_limit) : '0');
      setStatementDay(editData.statement_day ? String(editData.statement_day) : '');
      setDueAfterDays(editData.due_after_days ? String(editData.due_after_days) : '');
      setMinimumDuePercent(editData.minimum_due_percent ? String(editData.minimum_due_percent) : '0');
      setInterestRatePercent(editData.interest_rate_percent ? String(editData.interest_rate_percent) : '0');
      setCurrency(editData.currency || 'INR');
      setColor(editData.color || '#4B7CF3');
      setStatus(editData.status !== 'inactive');
    }
  }, [editData]);

  async function handleSave() {
    if (saving) return;

    let newErrors = {};
    if (!name.trim()) newErrors.name = 'Card name is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        bank: bank.trim() || null,
        last4: last4.trim() || null,
        network: network.trim() || null,
        credit_limit: parseFloat(creditLimit) || 0,
        statement_day: statementDay ? Number(statementDay) : null,
        due_after_days: dueAfterDays ? Number(dueAfterDays) : null,
        minimum_due_percent: parseFloat(minimumDuePercent) || 0,
        interest_rate_percent: parseFloat(interestRatePercent) || 0,
        currency: currency.trim() || 'INR',
        color,
        notes: null,
        status: status ? 'active' : 'inactive',
      };

      if (editData && editData.id) {
        await updateCreditCard(editData.id, payload);
      } else {
        await createCreditCard(payload);
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving credit card:', error);
      Alert.alert('Error', 'Failed to save credit card. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const displayName = name.trim() || 'Credit Card';

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
                    backgroundColor: color,
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
                            name="credit-card-outline"
                            size={32}
                            color="#FFF"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: "#FFF", fontSize: 26, fontWeight: "900", letterSpacing: 0.5 }}>
                            {editData ? 'Edit Card' : 'New Card'}
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 6, fontSize: 14 }}>
                            Manage your credit card details
                        </Text>
                    </View>
                </View>
            </View>

            {/* ── FORM ── */}
            <View style={{ paddingHorizontal: 24, flex: 1 }}>
                
                {/* ── PREVIEW CARD ── */}
                <View style={{
                    backgroundColor: color,
                    padding: 20,
                    borderRadius: 20,
                    marginBottom: 24,
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 8,
                }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <MaterialCommunityIcons name="integrated-circuit-chip" size={32} color="#FFF" />
                        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700', opacity: 0.9 }}>{network || 'Network'}</Text>
                    </View>
                    <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '800', letterSpacing: 2, marginBottom: 8 }}>
                        •••• •••• •••• {last4 || 'XXXX'}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>{displayName}</Text>
                        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600', opacity: 0.8 }}>{bank}</Text>
                    </View>
                </View>

                {/* ── NAME & BANK ── */}
                <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                        CARD NAME *
                    </Text>
                    <TextInput
                        mode="outlined"
                        value={name}
                        onChangeText={(val) => {
                            setName(val);
                            setErrors(prev => ({...prev, name: undefined}));
                        }}
                        placeholder="e.g. HDFC Millennia"
                        error={!!errors.name}
                        outlineColor="#E2E8F0"
                        activeOutlineColor={color}
                        style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }}
                        disabled={saving}
                    />
                    {!!errors.name && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                            <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
                            <Text style={{ color: "#DC2626", fontSize: 12, marginLeft: 6, fontWeight: "500" }}>
                                {errors.name}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>BANK</Text>
                        <TextInput mode="outlined" value={bank} onChangeText={setBank} placeholder="e.g. HDFC" outlineColor="#E2E8F0" activeOutlineColor={color} style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }} disabled={saving} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>LAST 4 DIGITS</Text>
                        <TextInput mode="outlined" value={last4} onChangeText={(text) => setLast4(text.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="1234" maxLength={4} keyboardType="numeric" outlineColor="#E2E8F0" activeOutlineColor={color} style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }} disabled={saving} />
                    </View>
                </View>

                <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>NETWORK</Text>
                        <TextInput mode="outlined" value={network} onChangeText={setNetwork} placeholder="Visa / Mastercard" outlineColor="#E2E8F0" activeOutlineColor={color} style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }} disabled={saving} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>CREDIT LIMIT</Text>
                        <TextInput mode="outlined" value={creditLimit} onChangeText={setCreditLimit} placeholder="0.00" keyboardType="numeric" outlineColor="#E2E8F0" activeOutlineColor={color} style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }} disabled={saving} />
                    </View>
                </View>

                <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>STATEMENT DAY</Text>
                        <TextInput mode="outlined" value={statementDay} onChangeText={(t) => setStatementDay(t.replace(/[^0-9]/g, ''))} placeholder="e.g. 5" keyboardType="numeric" outlineColor="#E2E8F0" activeOutlineColor={color} style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }} disabled={saving} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>DUE AFTER DAYS</Text>
                        <TextInput mode="outlined" value={dueAfterDays} onChangeText={(t) => setDueAfterDays(t.replace(/[^0-9]/g, ''))} placeholder="e.g. 20" keyboardType="numeric" outlineColor="#E2E8F0" activeOutlineColor={color} style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }} disabled={saving} />
                    </View>
                </View>
                
                <View style={{ flexDirection: 'row', marginBottom: 24 }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>MIN DUE %</Text>
                        <TextInput mode="outlined" value={minimumDuePercent} onChangeText={setMinimumDuePercent} placeholder="5" keyboardType="numeric" outlineColor="#E2E8F0" activeOutlineColor={color} style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }} disabled={saving} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>INTEREST RATE %</Text>
                        <TextInput mode="outlined" value={interestRatePercent} onChangeText={setInterestRatePercent} placeholder="3" keyboardType="numeric" outlineColor="#E2E8F0" activeOutlineColor={color} style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }} disabled={saving} />
                    </View>
                </View>

                {/* ── APPEARANCE ROW ── */}
                <View style={{ flexDirection: 'row', marginBottom: 16, alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                            CARD COLOR
                        </Text>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setShowColorPicker(true)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#FAFAFA',
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                padding: 14,
                                borderRadius: 12
                            }}
                        >
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color, marginRight: 10 }} />
                            <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#1E293B' }}>
                                {color.toUpperCase()}
                            </Text>
                            <MaterialCommunityIcons name="chevron-down" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1, marginLeft: 16, justifyContent: 'center' }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                            STATUS
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Switch value={status} onValueChange={setStatus} color={color} />
                            <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: '#1E293B' }}>{status ? 'Active' : 'Inactive'}</Text>
                        </View>
                    </View>
                </View>
                
                {/* SPACER TO PUSH BUTTON TO BOTTOM */}
                <View style={{ flex: 1, minHeight: 40 }} />

                <Button
                    mode="contained"
                    onPress={handleSave}
                    loading={saving}
                    disabled={saving}
                    buttonColor={color}
                    style={{ borderRadius: 16, paddingVertical: 8, marginBottom: 24 }}
                    labelStyle={{ fontSize: 18, fontWeight: "800", color: "#FFF", letterSpacing: 0.5 }}
                >
                    {editData ? 'Update Card' : 'Save Card'}
                </Button>
            </View>
        </ScrollView>

        <ColorPickerModal
            visible={showColorPicker}
            onClose={() => setShowColorPicker(false)}
            onSelect={setColor}
            currentColor={color}
        />
    </KeyboardAvoidingView>
  );
}
