import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Button } from 'react-native';
import { getLoanById } from '../services/loans';
import Card from '../components/Card';
import { Colors } from '../components/Theme';
import LoanPrepaymentModal from '../components/LoanPrepaymentModal';
import LoanForeclosureModal from '../components/LoanForeclosureModal';

export default function LoanDetailsScreen({ route, navigation }) {
  const id = route?.params?.id;
  const [loan, setLoan] = useState(null);
  const [showPrepayment, setShowPrepayment] = useState(false);
  const [showForeclosure, setShowForeclosure] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const l = await getLoanById(id);
      setLoan(l);
    })();
  }, [id]);

  async function refresh() {
    const l = await getLoanById(id);
    setLoan(l);
  }

  if (!loan) return null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background, padding: 12 }}>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '800' }}>{loan.loan_name}</Text>
        <Text style={{ color: '#666', marginTop: 6 }}>{loan.lender}</Text>
        <View style={{ height: 12 }} />
        <Text>Outstanding: ₹{Number(loan.outstanding_amount || 0).toLocaleString('en-IN')}</Text>
        <Text>EMI: ₹{Number(loan.emi_amount || 0).toLocaleString('en-IN')}</Text>
        <Text>Interest Rate: {Number(loan.interest_rate || 0)}%</Text>
        <View style={{ height: 12 }} />
        <Button title="Record Payment" onPress={() => navigation.navigate('LoanPayment', { id: loan.id })} />
        <View style={{ height: 8 }} />
        <Button title="Prepayment" onPress={() => setShowPrepayment(true)} />
        <View style={{ height: 8 }} />
        <Button title="Foreclosure" onPress={() => setShowForeclosure(true)} />
        <View style={{ height: 8 }} />
        <Button title="History" onPress={() => navigation.navigate('LoanHistory', { id: loan.id })} />
        <View style={{ height: 8 }} />
        <Button title="Reports" onPress={() => navigation.navigate('LoanReports')} />
        <View style={{ height: 8 }} />
        <Button title="Edit" onPress={() => navigation.navigate('LoanForm', { id: loan.id })} />
      </Card>

      <LoanPrepaymentModal visible={showPrepayment} onClose={() => setShowPrepayment(false)} loanId={loan.id} onSaved={refresh} />
      <LoanForeclosureModal visible={showForeclosure} onClose={() => setShowForeclosure(false)} loanId={loan.id} onSaved={refresh} />
    </ScrollView>
  );
}
