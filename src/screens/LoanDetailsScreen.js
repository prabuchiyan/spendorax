import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Button, Alert, TouchableOpacity } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { getLoanById, unlinkTransactionFromLoan } from '../services/loans';
import { getTransactions } from '../services/transactions';
import events from '../services/events';
import Card from '../components/Card';
import calc from '../services/loanCalculations';
import { Colors } from '../components/Theme';
import LoanPrepaymentModal from '../components/LoanPrepaymentModal';
import LoanForeclosureModal from '../components/LoanForeclosureModal';

export default function LoanDetailsScreen({ route, navigation }) {
  const id = route?.params?.id;
  const [loan, setLoan] = useState(null);
  const [showPrepayment, setShowPrepayment] = useState(false);
  const [showForeclosure, setShowForeclosure] = useState(false);
  const [linkedTxs, setLinkedTxs] = useState([]);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  useEffect(() => {
    (async () => {
      if (!id) return;
      const l = await getLoanById(id);
      setLoan(l);
    })();
  }, [id]);

  useEffect(() => {
    loadLinkedTransactions();
    const offTx = events.on('transactionsChanged', () => loadLinkedTransactions());
    const offLoans = events.on('loansChanged', () => loadLinkedTransactions());
    return () => {
      offTx && offTx();
      offLoans && offLoans();
    };
  }, [id]);

  async function loadLinkedTransactions() {
    if (!id) return setLinkedTxs([]);
    const txs = await getTransactions(1000, 'Yes');
    const linked = txs.filter(t => Number(t.loan_id) === Number(id));
    // sort desc by date
    linked.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setLinkedTxs(linked);
  }

  async function refresh() {
    const l = await getLoanById(id);
    setLoan(l);
  }

  if (!loan) return null;

  const originalPrincipal = Number(loan.principal_amount || 0);
  const paidSoFar = Number(loan.total_paid || 0);
  const remainingAmount = Number(loan.outstanding_amount || 0);
  const remainingMonths = Number(loan.remaining_months || 0) === Infinity ? 0 : Number(loan.remaining_months || 0);
  const interestToPay = remainingAmount > 0 && remainingMonths > 0 && loan.emi_amount > 0
    ? calc.generateAmortizationSchedule(remainingAmount, loan.interest_rate, remainingMonths).reduce((sum, item) => sum + Number(item.interest || 0), 0)
    : 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background, padding: 12 }}>
      <Card>
        <Text style={{ fontSize: 18, fontWeight: '800' }}>{loan.loan_name}</Text>
        <Text style={{ color: '#666', marginTop: 6 }}>{loan.lender}</Text>
        <View style={{ height: 12 }} />
        <Text>Status: {loan.status || 'Active'}</Text>
        <Text>Original Amount: ₹{originalPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        <Text>Paid so far: ₹{paidSoFar.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        <Text>Outstanding: ₹{remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        <Text>Months remaining: {remainingMonths}</Text>
        <Text>Interest remaining: ₹{interestToPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
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
      <View style={{ height: 12 }} />
      <Card>
        <Text style={{ fontSize: 16, fontWeight: '700' }}>Linked Transactions</Text>
        <View style={{ height: 8 }} />
        {linkedTxs.length === 0 ? (
          <Text style={{ color: '#666' }}>No transactions linked to this loan.</Text>
        ) : (
          linkedTxs.map(tx => (
            <View key={tx.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '600' }}>{tx.notes || 'Payment'}</Text>
                <Text>₹{Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
              <Text style={{ color: '#666', marginTop: 6 }}>{new Date(tx.date).toLocaleString()}</Text>
              <View style={{ flexDirection: 'row', marginTop: 6, justifyContent: 'space-between' }}>
                <Text>Principal: ₹{Number(tx.principal_component || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                <Text>Interest: ₹{Number(tx.interest_component || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                <Text>Outstanding: ₹{Number(tx.outstanding_after_payment || loan.outstanding_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
              <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
                <TouchableOpacity onPress={() => {
                  Alert.alert('Unlink Transaction', 'Unlink this transaction from the loan?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Unlink', style: 'destructive', onPress: async () => {
                      try {
                        await unlinkTransactionFromLoan(tx.id);
                        await loadLinkedTransactions();
                        await refresh();
                        setSnackbarMsg('Transaction unlinked');
                        setSnackbarVisible(true);
                      } catch (e) {
                        console.warn(e);
                        setSnackbarMsg(e.message || 'Failed to unlink');
                        setSnackbarVisible(true);
                      }
                    } }
                  ]);
                }} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ color: '#E46A6A', fontWeight: '600' }}>Unlink</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </Card>
      <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={3000} action={{ label: 'OK', onPress: () => setSnackbarVisible(false) }}>
        {snackbarMsg}
      </Snackbar>
    </ScrollView>
  );
}
