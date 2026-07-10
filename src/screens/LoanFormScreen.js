import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import { createLoan, getLoanById, updateLoan } from '../services/loans';
import Card from '../components/Card';
import { Colors } from '../components/Theme';

export default function LoanFormScreen({ navigation, route }) {
  const editId = route?.params?.id;
  const [loan, setLoan] = useState({ loan_name: '', loan_type: 'Other', lender: '', principal_amount: '', interest_rate: '', loan_start_date: '', tenure_months: '', emi_amount: '', emi_day: '' });

  useEffect(() => {
    if (editId) {
      (async () => {
        const data = await getLoanById(editId);
        if (data) setLoan(data);
      })();
    }
  }, [editId]);

  async function save() {
    // basic validation
    if (!loan.loan_name || !loan.principal_amount || Number(loan.principal_amount) <= 0) {
      alert('Loan name and principal amount are required');
      return;
    }

    // Build a payload with only allowed DB columns to avoid UPDATE failures
    const allowed = [
      'loan_name','loan_type','lender','principal_amount','interest_rate','loan_start_date','loan_end_date','tenure_months','emi_amount','emi_day','outstanding_amount','notes'
    ];

    const payload = {};
    allowed.forEach(k => {
      if (loan[k] !== undefined && loan[k] !== null) {
        payload[k] = loan[k];
      }
    });

    // ensure numeric fields are numbers
    if (payload.principal_amount !== undefined) payload.principal_amount = Number(payload.principal_amount);
    if (payload.interest_rate !== undefined) payload.interest_rate = Number(payload.interest_rate || 0);
    if (payload.tenure_months !== undefined) payload.tenure_months = Number(payload.tenure_months || 0);
    if (payload.emi_amount !== undefined) payload.emi_amount = Number(payload.emi_amount || 0);

    // When editing, if principal changed and no principal has been paid yet,
    // keep outstanding_amount in sync with principal to avoid stale outstanding values
    if (editId && payload.principal_amount !== undefined) {
      const prevPrincipalPaid = Number(loan.principal_paid || 0);
      if (prevPrincipalPaid === 0) {
        payload.outstanding_amount = payload.principal_amount;
      }
    }

    // For new loans, default outstanding to principal when not explicitly provided
    if (!editId && payload.outstanding_amount === undefined && payload.principal_amount !== undefined) {
      payload.outstanding_amount = payload.principal_amount;
    }
    try {
      if (editId) {
        await updateLoan(editId, payload);
      } else {
        await createLoan(payload);
      }
      navigation.goBack();
    } catch (e) {
      console.error('Save loan failed', e);
      alert(e?.message || 'Failed to save loan');
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background, padding: 12 }}>
      <Card>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Loan Details</Text>
        <TextInput placeholder="Loan name" value={loan.loan_name} onChangeText={(t) => setLoan({ ...loan, loan_name: t })} style={{ borderBottomWidth: 1, borderColor: '#eee', padding: 8 }} />
        <TextInput placeholder="Lender" value={loan.lender} onChangeText={(t) => setLoan({ ...loan, lender: t })} style={{ borderBottomWidth: 1, borderColor: '#eee', padding: 8, marginTop: 8 }} />
        <TextInput placeholder="Principal amount" keyboardType="numeric" value={String(loan.principal_amount || '')} onChangeText={(t) => setLoan({ ...loan, principal_amount: t })} style={{ borderBottomWidth: 1, borderColor: '#eee', padding: 8, marginTop: 8 }} />
        <TextInput placeholder="Interest rate (annual %)" keyboardType="numeric" value={String(loan.interest_rate || '')} onChangeText={(t) => setLoan({ ...loan, interest_rate: t })} style={{ borderBottomWidth: 1, borderColor: '#eee', padding: 8, marginTop: 8 }} />
        <TextInput placeholder="Tenure (months)" keyboardType="numeric" value={String(loan.tenure_months || '')} onChangeText={(t) => setLoan({ ...loan, tenure_months: t })} style={{ borderBottomWidth: 1, borderColor: '#eee', padding: 8, marginTop: 8 }} />

        <PaperButton mode="contained" onPress={save} style={{ marginTop: 12 }}>Save</PaperButton>
      </Card>
    </ScrollView>
  );
}
