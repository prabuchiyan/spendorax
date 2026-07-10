import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Card from './Card';
import { Button } from 'react-native-paper';
import { recordPrepayment } from '../services/loans';
import { Colors } from './Theme';

export default function LoanPrepaymentModal({ visible, onClose, loanId, onSaved }) {
  const [amount, setAmount] = useState('');
  const [reduceEMI, setReduceEMI] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setAmount(''); setNotes(''); setReduceEMI(false);
    }
  }, [visible]);

  async function save() {
    if (!amount || Number(amount) <= 0) return alert('Enter a positive amount');
    setLoading(true);
    try {
      await recordPrepayment({ loanId, date: new Date().toISOString(), amount: Number(amount), reduceEMI, notes });
      onSaved && onSaved();
      onClose();
    } catch (e) {
      console.error('Prepayment failed', e);
      alert(e.message || 'Failed to record prepayment');
    } finally { setLoading(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <Card>
            <Text style={{ fontWeight: '800', fontSize: 16 }}>Record Prepayment</Text>
            <TextInput placeholder="Amount" keyboardType="numeric" value={String(amount)} onChangeText={setAmount} style={styles.input} />
            <View style={{ height: 8 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text>Reduce EMI</Text>
              <TouchableOpacity onPress={() => setReduceEMI(!reduceEMI)}>
                <View style={[styles.checkbox, reduceEMI && { backgroundColor: Colors.primary }]} />
              </TouchableOpacity>
            </View>
            <TextInput placeholder="Notes" value={notes} onChangeText={setNotes} style={[styles.input, { marginTop: 8 }]} />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onPress={onClose} disabled={loading} style={{ marginRight: 8 }}>Cancel</Button>
              <Button mode="contained" onPress={save} loading={loading}>Save</Button>
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
  input: { borderBottomWidth: 1, borderColor: '#eee', padding: 8, marginTop: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#ccc' }
});
