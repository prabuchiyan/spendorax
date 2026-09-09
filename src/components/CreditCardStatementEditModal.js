import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import FormModalShell from './FormModalShell';
import formModalStyles from './formModalStyles';

export default function CreditCardStatementEditModal({
  visible,
  onClose,
  onSave,
  editData,
}) {
  const [openingBalance, setOpeningBalance] = useState('0');
  const [fees, setFees] = useState('0');
  const [interest, setInterest] = useState('0');
  const [refunds, setRefunds] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    
    if (editData) {
      setOpeningBalance(String(editData.opening_balance || 0));
      setFees(String(editData.fees || 0));
      setInterest(String(editData.interest || 0));
      setRefunds(String(editData.refunds || 0));
    } else {
      setOpeningBalance('0');
      setFees('0');
      setInterest('0');
      setRefunds('0');
    }
    setSaving(false);
  }, [editData, visible]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        opening_balance: parseFloat(openingBalance) || 0,
        fees: parseFloat(fees) || 0,
        interest: parseFloat(interest) || 0,
        refunds: parseFloat(refunds) || 0,
      };
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error('Error saving statement details:', error);
      alert('Failed to save statement details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      visible={visible}
      onClose={saving ? undefined : onClose}
      icon="file-document-edit-outline"
      iconColor="#4B7CF3"
      iconSize={24}
      title="Edit Statement Details"
      subtitle="Manually adjust statement values"
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
              { backgroundColor: '#4B7CF3' },
            ]}
          >
            {saving ? 'Updating...' : 'Update'}
          </Button>
        </>
      }
    >
      <ScrollView
        style={{ maxHeight: 520 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          label="Opening Balance"
          value={openingBalance}
          onChangeText={setOpeningBalance}
          mode="outlined"
          style={formModalStyles.input}
          keyboardType="numeric"
          disabled={saving}
        />
        <TextInput
          label="Fees"
          value={fees}
          onChangeText={setFees}
          mode="outlined"
          style={formModalStyles.input}
          keyboardType="numeric"
          disabled={saving}
        />
        <TextInput
          label="Interest"
          value={interest}
          onChangeText={setInterest}
          mode="outlined"
          style={formModalStyles.input}
          keyboardType="numeric"
          disabled={saving}
        />
        <TextInput
          label="Refunds"
          value={refunds}
          onChangeText={setRefunds}
          mode="outlined"
          style={formModalStyles.input}
          keyboardType="numeric"
          disabled={saving}
        />
      </ScrollView>
    </FormModalShell>
  );
}
