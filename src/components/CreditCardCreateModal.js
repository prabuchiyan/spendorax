import React, { useEffect, useState } from 'react';
import { View, Switch, ScrollView } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import FormModalShell from './FormModalShell';
import ColorPickerModal from './ColorPickerModal';
import formModalStyles from './formModalStyles';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function CreditCardCreateModal({
  visible,
  onClose,
  onSave,
  editData,
}) {
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [last4, setLast4] = useState('');
  const [network, setNetwork] = useState('');
  const [creditLimit, setCreditLimit] = useState('0');
  const [statementDay, setStatementDay] = useState('');
  const [dueAfterDays, setDueAfterDays] = useState('');
  const [minimumDuePercent, setMinimumDuePercent] = useState('0');
  const [currency, setCurrency] = useState('INR');
  const [color, setColor] = useState('#4B7CF3');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (editData) {
      // EDIT MODE
      setName(editData.name || '');
      setBank(editData.bank || '');
      setLast4(editData.last4 || '');
      setNetwork(editData.network || '');
      setCreditLimit(String(editData.credit_limit || 0));
      setStatementDay(
        editData.statement_day ? String(editData.statement_day) : ''
      );
      setDueAfterDays(
        editData.due_after_days ? String(editData.due_after_days) : ''
      );
      setMinimumDuePercent(
        String(editData.minimum_due_percent || 0)
      );
      setCurrency(editData.currency || 'INR');
      setColor(editData.color || '#4B7CF3');
      setNotes(editData.notes || '');
      setStatus(editData.status !== 'inactive');
    } else {
      // CREATE MODE - always reset the form
      setName('');
      setBank('');
      setLast4('');
      setNetwork('');
      setCreditLimit('0');
      setStatementDay('');
      setDueAfterDays('');
      setMinimumDuePercent('0');
      setCurrency('INR');
      setColor('#4B7CF3');
      setNotes('');
      setStatus(true);
    }
    setSaving(false);
    setShowColorPicker(false);
  }, [editData, visible]);

  const handleSave = async () => {
    // Prevent duplicate taps
    if (saving) {
      return;
    }
    if (!name.trim()) {
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
        currency: currency.trim() || 'INR',
        color,
        notes: notes.trim() || null,
        status: status ? 'active' : 'inactive',
      };
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error('Error saving credit card:', error);
      alert('Failed to save credit card. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      visible={visible}
      onClose={saving ? undefined : onClose}
      icon="credit-card-outline"
      iconColor={color}
      iconSize={24}
      title={editData ? 'Edit Credit Card' : 'New Credit Card'}
      subtitle="Manage your card details"
      actions={
        <>
          <Button
            onPress={onClose}
            textColor="#666"
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={[
              formModalStyles.saveBtn,
              { backgroundColor: color },
            ]}
          >
            {saving
              ? (editData ? 'Updating...' : 'Saving...')
              : (editData ? 'Update' : 'Save')}
          </Button>
        </>
      }
      footer={
        <ColorPickerModal
          visible={showColorPicker}
          onClose={() => {
            if (!saving) {
              setShowColorPicker(false);
            }
          }}
          onSelect={(selectedColor) => {
            if (!saving) {
              setColor(selectedColor);
            }
          }}
          currentColor={color}
        />
      }
    >
      <ScrollView
        style={{ maxHeight: 520 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          label="Card Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={formModalStyles.input}
          disabled={saving}
        />
        <TextInput
          label="Bank"
          value={bank}
          onChangeText={setBank}
          mode="outlined"
          style={formModalStyles.input}
          disabled={saving}
        />
        <TextInput
          label="Last 4 Digits"
          value={last4}
          onChangeText={(text) =>
            setLast4(
              text.replace(/[^0-9]/g, '').slice(0, 4)
            )
          }
          mode="outlined"
          style={formModalStyles.input}
          maxLength={4}
          keyboardType="numeric"
          disabled={saving}
        />
        <TextInput
          label="Network"
          value={network}
          onChangeText={setNetwork}
          mode="outlined"
          style={formModalStyles.input}
          disabled={saving}
        />

        <TextInput
          label="Credit Limit"
          value={creditLimit}
          onChangeText={setCreditLimit}
          mode="outlined"
          style={formModalStyles.input}
          keyboardType="numeric"
          disabled={saving}
        />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <TextInput
            label="Statement Day"
            value={statementDay}
            onChangeText={(text) =>
              setStatementDay(
                text.replace(/[^0-9]/g, '')
              )
            }
            mode="outlined"
            style={[
              formModalStyles.input,
              { flex: 1, marginRight: 6 },
            ]}
            keyboardType="numeric"
            disabled={saving}
          />
          <TextInput
            label="Due After Days"
            value={dueAfterDays}
            onChangeText={(text) =>
              setDueAfterDays(
                text.replace(/[^0-9]/g, '')
              )
            }
            mode="outlined"
            style={[
              formModalStyles.input,
              { flex: 1, marginLeft: 6 },
            ]}
            keyboardType="numeric"
            disabled={saving}
          />
        </View>
        <TextInput
          label="Minimum Due %"
          value={minimumDuePercent}
          onChangeText={setMinimumDuePercent}
          mode="outlined"
          style={formModalStyles.input}
          keyboardType="numeric"
          disabled={saving}
        />
        <TextInput
          label="Currency"
          value={currency}
          onChangeText={setCurrency}
          mode="outlined"
          style={formModalStyles.input}
          disabled={saving}
        />
        <TextInput
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          mode="outlined"
          style={formModalStyles.input}
          multiline
          numberOfLines={3}
          disabled={saving}
        />
        <View
          style={[
            formModalStyles.controls,
            {
              justifyContent: 'space-between',
              alignItems: 'center',
            },
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <MaterialCommunityIcons
              name="brightness-5"
              size={20}
              color={color}
              style={{ marginRight: 10 }}
            />
            <Text>
              {status ? 'Active' : 'Inactive'}
            </Text>
          </View>
          <Switch
            value={status}
            onValueChange={setStatus}
            disabled={saving}
            trackColor={{
              false: '#ccc',
              true: color,
            }}
            thumbColor={status ? color : '#fff'}
          />
        </View>
      </ScrollView>
    </FormModalShell>
  );
}
