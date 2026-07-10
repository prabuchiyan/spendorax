import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Card from './Card';
import { Button } from 'react-native-paper';
import { forecloseLoan } from '../services/loans';
import { Colors } from './Theme';

export default function LoanForeclosureModal({ visible, onClose, loanId, onSaved }) {
  const [amount, setAmount] = useState('');
  const [charges, setCharges] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) { setAmount(''); setCharges(''); setNotes(''); }
  }, [visible]);

  async function save() {
    if (!amount || Number(amount) <= 0) return alert('Enter a positive amount');
    setLoading(true);
    try {
      await forecloseLoan({ loanId, date: new Date().toISOString(), finalPaymentAmount: Number(amount), foreclosureCharges: Number(charges || 0), notes });
      onSaved && onSaved();
      onClose();
    } catch (e) {
      console.error('Foreclosure failed', e);
      alert(e.message || 'Failed to foreclose loan');
    } finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <Card>
            <Text style={{ fontWeight: '800', fontSize: 16 }}>Foreclose Loan</Text>
            <TextInput placeholder="Final payment amount" keyboardType="numeric" value={String(amount)} onChangeText={setAmount} style={styles.input} />
            <TextInput placeholder="Foreclosure charges (optional)" keyboardType="numeric" value={String(charges)} onChangeText={setCharges} style={[styles.input, { marginTop: 8 }]} />
            <TextInput placeholder="Notes" value={notes} onChangeText={setNotes} style={[styles.input, { marginTop: 8 }]} />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onPress={onClose} disabled={loading} style={{ marginRight: 8 }}>Cancel</Button>
              <Button mode="contained" onPress={save} loading={loading}>Confirm Foreclosure</Button>
            </View>
          </Card>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  container: { padding: 12 },
  input: { borderBottomWidth: 1, borderColor: '#eee', padding: 8, marginTop: 8 }
});
