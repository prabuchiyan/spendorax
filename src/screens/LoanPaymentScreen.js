import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import { recordPayment } from '../services/loans';
import Card from '../components/Card';
import { Colors } from '../components/Theme';

export default function LoanPaymentScreen({ route, navigation }) {
  const loanId = route?.params?.id;
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  async function save() {
    if (!amount || Number(amount) <= 0) {
      alert('Enter amount');
      return;
    }
    try {
      await recordPayment({ loanId, amount: Number(amount), date: new Date().toISOString(), paymentType: 'EMI', notes });
      navigation.goBack();
    } catch (e) {
      console.error('Payment failed', e);
      alert('Failed to record payment');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, padding: 12 }}>
      <Card>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Record Payment</Text>
        <TextInput placeholder="Amount" keyboardType="numeric" value={String(amount)} onChangeText={setAmount} style={{ borderBottomWidth: 1, borderColor: '#eee', padding: 8 }} />
        <TextInput placeholder="Notes" value={notes} onChangeText={setNotes} style={{ borderBottomWidth: 1, borderColor: '#eee', padding: 8, marginTop: 8 }} />
        <PaperButton mode="contained" onPress={save} style={{ marginTop: 12 }}>Save</PaperButton>
      </Card>
    </View>
  );
}
