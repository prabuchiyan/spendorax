import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Card from './Card';
import { Button } from 'react-native-paper';
import { forecloseLoan } from '../services/loans';
import { getSources } from '../services/sources';
import { getCategories } from '../services/categories';
import { Colors } from './Theme';

export default function LoanForeclosureModal({ visible, onClose, loanId, onSaved }) {
  const [amount, setAmount] = useState('');
  const [charges, setCharges] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sourceId, setSourceId] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    if (!visible) { setAmount(''); setCharges(''); setNotes(''); setSourceId(null); setCategoryId(null); }
  }, [visible]);

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

  async function save() {
    if (!amount || Number(amount) <= 0) return alert('Enter a positive amount');
    setLoading(true);
    try {
      await forecloseLoan({ loanId, date: new Date().toISOString(), finalPaymentAmount: Number(amount), foreclosureCharges: Number(charges || 0), sourceId, categoryId, notes });
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
            <TouchableOpacity onPress={() => setShowSourcePicker(true)} style={styles.selector}>
              <Text style={{ color: '#666', fontSize: 12 }}>Source / Bank</Text>
              <Text style={{ marginTop: 4 }}>{sources.find((s) => s.id === sourceId)?.name || 'Select source'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCategoryPicker(true)} style={styles.selector}>
              <Text style={{ color: '#666', fontSize: 12 }}>Category</Text>
              <Text style={{ marginTop: 4 }}>{categories.find((c) => c.id === categoryId)?.name || 'Select category'}</Text>
            </TouchableOpacity>
            <TextInput placeholder="Final payment amount" keyboardType="numeric" value={String(amount)} onChangeText={setAmount} style={styles.input} />
            <TextInput placeholder="Foreclosure charges (optional)" keyboardType="numeric" value={String(charges)} onChangeText={setCharges} style={[styles.input, { marginTop: 8 }]} />
            <TextInput placeholder="Notes" value={notes} onChangeText={setNotes} style={[styles.input, { marginTop: 8 }]} />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <Button onPress={onClose} disabled={loading} style={{ marginRight: 8 }}>Cancel</Button>
              <Button mode="contained" onPress={save} loading={loading}>Confirm Foreclosure</Button>
            </View>
          </Card>

          <Modal visible={showSourcePicker} transparent animationType="slide">
            <View style={styles.backdrop}>
              <View style={styles.modalContainer}>
                <Text style={{ fontWeight: '700', marginBottom: 12 }}>Select Source</Text>
                <ScrollView>
                  {sources.map((source) => (
                    <TouchableOpacity key={source.id} onPress={() => { setSourceId(source.id); setShowSourcePicker(false); }} style={styles.optionItem}>
                      <Text>{source.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Button onPress={() => setShowSourcePicker(false)}>Close</Button>
              </View>
            </View>
          </Modal>

          <Modal visible={showCategoryPicker} transparent animationType="slide">
            <View style={styles.backdrop}>
              <View style={styles.modalContainer}>
                <Text style={{ fontWeight: '700', marginBottom: 12 }}>Select Category</Text>
                <ScrollView>
                  {categories.map((category) => (
                    <TouchableOpacity key={category.id} onPress={() => { setCategoryId(category.id); setShowCategoryPicker(false); }} style={styles.optionItem}>
                      <Text>{category.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Button onPress={() => setShowCategoryPicker(false)}>Close</Button>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  container: { padding: 12 },
  modalContainer: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%' },
  input: { borderBottomWidth: 1, borderColor: '#eee', padding: 8, marginTop: 8 },
  selector: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12, marginTop: 12 },
  optionItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' }
});
