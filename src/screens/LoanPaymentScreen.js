import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import { recordPayment, recordPrepayment, getLoans } from '../services/loans';
import { getSources } from '../services/sources';
import { getCategories } from '../services/categories';
import Card from '../components/Card';
import { Colors } from '../components/Theme';

export default function LoanPaymentScreen({ route, navigation }) {
  const routeLoanId = route?.params?.id ?? route?.params?.loanId;
  const loanIdParam = routeLoanId != null ? Number(routeLoanId) : null;
  const mode = route?.params?.mode || 'payment';

  const [loanId, setLoanId] = useState(loanIdParam);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [reduceEMI, setReduceEMI] = useState(false);
  const [loans, setLoans] = useState([]);
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sourceId, setSourceId] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [showLoanPicker, setShowLoanPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const loanRows = await getLoans();
        setLoans(loanRows);
        if (!loanIdParam && loanRows.length > 0) {
          setLoanId(loanRows[0].id);
        }
      } catch (e) {
        console.warn('Failed to load loans', e);
      }
    })();
  }, [loanIdParam]);

  useEffect(() => {
    (async () => {
      try {
        const src = await getSources();
        setSources(src);
        if (src.length > 0 && sourceId == null) setSourceId(src[0].id);
      } catch (e) {
        console.warn('Failed to load sources', e);
      }
    })();
    (async () => {
      try {
        const cats = await getCategories();
        setCategories(cats);
      } catch (e) {
        console.warn('Failed to load categories', e);
      }
    })();
  }, [sourceId]);

  function validate() {
    if (!loanId) {
      alert('Select a loan first');
      return false;
    }
    if (!amount || Number(amount) <= 0) {
      alert('Enter amount');
      return false;
    }
    return true;
  }

  async function save() {
    if (!validate()) return;
    const value = Number(amount);
    try {
      if (mode === 'prepayment') {
        await recordPrepayment({ loanId, date: new Date().toISOString(), amount: value, reduceEMI, sourceId, categoryId, notes });
      } else {
        await recordPayment({ loanId, date: new Date().toISOString(), amount: value, paymentType: 'EMI', sourceId, categoryId, notes });
      }
      navigation.goBack();
    } catch (e) {
      console.error('Payment failed', e);
      alert(e?.message || 'Failed to record payment');
    }
  }

  const selectedLoan = loans.find((l) => l.id === loanId);
  const selectedSource = sources.find((s) => s.id === sourceId);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const title = mode === 'prepayment' ? 'Record Prepayment' : 'Record EMI Payment';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, padding: 12 }}>
      <Card>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>{title}</Text>

        <TouchableOpacity onPress={() => setShowLoanPicker(true)} style={{ borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12, marginBottom: 12 }}>
          <Text style={{ color: '#666', fontSize: 12 }}>Loan</Text>
          <Text style={{ marginTop: 4 }}>{selectedLoan?.loan_name || 'Select loan'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowSourcePicker(true)} style={{ borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12, marginBottom: 12 }}>
          <Text style={{ color: '#666', fontSize: 12 }}>Source / Bank</Text>
          <Text style={{ marginTop: 4 }}>{selectedSource?.name || 'Select source'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowCategoryPicker(true)} style={{ borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12, marginBottom: 12 }}>
          <Text style={{ color: '#666', fontSize: 12 }}>Category</Text>
          <Text style={{ marginTop: 4 }}>{selectedCategory?.name || 'Select category'}</Text>
        </TouchableOpacity>

        <TextInput placeholder="Amount" keyboardType="numeric" value={String(amount)} onChangeText={setAmount} style={{ borderBottomWidth: 1, borderColor: '#eee', padding: 8, marginBottom: 12 }} />
        {mode === 'prepayment' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ flex: 1 }}>Reduce EMI</Text>
            <TouchableOpacity onPress={() => setReduceEMI(!reduceEMI)} style={{ width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: '#ccc', backgroundColor: reduceEMI ? Colors.primary : '#fff' }} />
          </View>
        ) : null}
        <TextInput placeholder="Notes" value={notes} onChangeText={setNotes} style={{ borderBottomWidth: 1, borderColor: '#eee', padding: 8, marginBottom: 12 }} />
        <PaperButton mode="contained" onPress={save} style={{ marginTop: 12 }}>{mode === 'prepayment' ? 'Save Prepayment' : 'Save Payment'}</PaperButton>
      </Card>

      <Modal visible={showLoanPicker} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <View style={{ backgroundColor: '#fff', maxHeight: '60%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Text style={{ fontWeight: '800', marginBottom: 12 }}>Select Loan</Text>
            <ScrollView>
              {loans.map((loan) => (
                <TouchableOpacity key={loan.id} onPress={() => { setLoanId(loan.id); setShowLoanPicker(false); }} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                  <Text>{loan.loan_name}</Text>
                  <Text style={{ color: '#666', fontSize: 12 }}>Outstanding ₹{Number(loan.outstanding_amount || 0).toLocaleString('en-IN')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <PaperButton onPress={() => setShowLoanPicker(false)} style={{ marginTop: 12 }}>Close</PaperButton>
          </View>
        </View>
      </Modal>

      <Modal visible={showSourcePicker} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <View style={{ backgroundColor: '#fff', maxHeight: '60%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Text style={{ fontWeight: '800', marginBottom: 12 }}>Select Source</Text>
            <ScrollView>
              {sources.map((source) => (
                <TouchableOpacity key={source.id} onPress={() => { setSourceId(source.id); setShowSourcePicker(false); }} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                  <Text>{source.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <PaperButton onPress={() => setShowSourcePicker(false)} style={{ marginTop: 12 }}>Close</PaperButton>
          </View>
        </View>
      </Modal>

      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <View style={{ backgroundColor: '#fff', maxHeight: '60%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Text style={{ fontWeight: '800', marginBottom: 12 }}>Select Category</Text>
            <ScrollView>
              {categories.map((category) => (
                <TouchableOpacity key={category.id} onPress={() => { setCategoryId(category.id); setShowCategoryPicker(false); }} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                  <Text>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <PaperButton onPress={() => setShowCategoryPicker(false)} style={{ marginTop: 12 }}>Close</PaperButton>
          </View>
        </View>
      </Modal>
    </View>
  );
}
