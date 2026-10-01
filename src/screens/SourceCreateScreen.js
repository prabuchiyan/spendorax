import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { formatAmount } from '../utils/numberUtils';
import { TextInput, Button } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { createSource, updateSource } from '../services/sources';
import IconPicker from '../components/IconPicker';
import ColorPickerModal from '../components/ColorPickerModal';

export default function SourceCreateScreen({ route, navigation }) {
  const { editData, onSourceCreated } = route.params || {};

  const [name, setName] = useState('');
  const [initial, setInitial] = useState('');
  const [icon, setIcon] = useState('bank');
  const [color, setColor] = useState('#4B7CF3');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (editData) {
      setName(editData.name || '');
      setInitial(editData.initial_balance !== undefined ? String(editData.initial_balance) : '0');
      setIcon(editData.icon || 'bank');
      setColor(editData.color || '#4B7CF3');
    }
  }, [editData]);

  async function handleSave() {
    if (saving) return;
    
    let newErrors = {};
    if (!name.trim()) newErrors.name = 'Account name is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      name: name.trim(),
      initial_balance: parseFloat(initial) || 0,
      icon,
      color,
      is_active: 1
    };

    setSaving(true);
    try {
      if (editData && editData.id) {
        await updateSource(editData.id, payload);
      } else {
        await createSource(payload);
      }
      if (onSourceCreated) {
        onSourceCreated();
      }
      navigation.goBack();
    } catch (error) {
      console.error('Error saving source:', error);
      Alert.alert('Error', 'Failed to save account. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const displayName = name.trim() || 'Your Account';
  const numericBalance = parseFloat(initial) || 0;
  const formattedBalance = formatAmount(numericBalance);

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
                            name="wallet"
                            size={32}
                            color="#FFF"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: "#FFF", fontSize: 26, fontWeight: "900", letterSpacing: 0.5 }}>
                            {editData ? 'Edit Account' : 'New Account'}
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 6, fontSize: 14 }}>
                            Manage your payment source details
                        </Text>
                    </View>
                </View>
            </View>

            {/* ── FORM ── */}
            <View style={{ paddingHorizontal: 24, flex: 1 }}>
                
                {/* ── PREVIEW CARD ── */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: `${color}10`,
                    borderWidth: 1,
                    borderColor: `${color}30`,
                    padding: 16,
                    borderRadius: 20,
                    marginBottom: 24
                }}>
                    <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        backgroundColor: color,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16
                    }}>
                        <MaterialCommunityIcons name={icon} size={24} color="#FFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: color, fontWeight: '800', marginBottom: 2 }}>ACCOUNT PREVIEW</Text>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }} numberOfLines={1}>{displayName}</Text>
                        <Text style={{ fontSize: 14, color: '#64748B', marginTop: 2, fontWeight: '600' }}>₹{formattedBalance}</Text>
                    </View>
                </View>

                {/* ── NAME ── */}
                <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                        ACCOUNT NAME *
                    </Text>
                    <TextInput
                        mode="outlined"
                        value={name}
                        onChangeText={(val) => {
                            setName(val);
                            setErrors(prev => ({...prev, name: undefined}));
                        }}
                        placeholder="e.g. HDFC Bank"
                        error={!!errors.name}
                        outlineColor="#E2E8F0"
                        activeOutlineColor={color}
                        style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }}
                        disabled={saving}
                        left={<TextInput.Icon icon="bank-outline" color="#94A3B8" />}
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

                {/* ── INITIAL BALANCE ── */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                        INITIAL BALANCE
                    </Text>
                    <TextInput
                        mode="outlined"
                        keyboardType="numeric"
                        value={initial}
                        onChangeText={setInitial}
                        placeholder="0.00"
                        outlineColor="#E2E8F0"
                        activeOutlineColor={color}
                        style={{ backgroundColor: "#FAFAFA", fontSize: 16, fontWeight: '600' }}
                        disabled={saving}
                        left={<TextInput.Affix text="₹ " textStyle={{ fontSize: 16, color: '#94A3B8', fontWeight: '600' }} />}
                    />
                </View>

                {/* ── APPEARANCE ROW ── */}
                <View style={{ flexDirection: 'row', marginBottom: 16 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                            ICON
                        </Text>
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setShowIconPicker(true)}
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
                            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${color}20`, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                <MaterialCommunityIcons name={icon} size={20} color={color} />
                            </View>
                            <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#1E293B', textTransform: 'capitalize' }}>
                                {icon.replace(/-/g, ' ')}
                            </Text>
                            <MaterialCommunityIcons name="chevron-down" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                            COLOR
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
                    {editData ? 'Update Account' : 'Save Account'}
                </Button>
            </View>
        </ScrollView>

        <IconPicker
            visible={showIconPicker}
            onClose={() => setShowIconPicker(false)}
            onSelect={setIcon}
        />
        <ColorPickerModal
            visible={showColorPicker}
            onClose={() => setShowColorPicker(false)}
            onSelect={setColor}
            currentColor={color}
        />
    </KeyboardAvoidingView>
  );
}