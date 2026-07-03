import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, Modal, Text, Platform } from 'react-native';
import { createTransaction, createTransfer } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import { TextInput as PaperTextInput, Button as PaperButton, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CategoryCreateModal from './CategoryCreateModal';
import { updateTransaction } from '../services/transactions';

export default function TransactionForm({ onCreated, onCancel, transaction, isEdit }) {
  const [amount, setAmount] = useState(isEdit && transaction ? String(transaction.amount) : '');
  const [amountError, setAmountError] = useState(false);
  const [type, setType] = useState(isEdit && transaction ? transaction.type : 'expense');
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [categoryId, setCategoryId] = useState(isEdit && transaction ? transaction.category_id : null);
  const [sourceId, setSourceId] = useState(isEdit && transaction ? transaction.source_id : null);
  const [date, setDate] = useState(isEdit && transaction ? transaction.date : new Date().toISOString());
  const [notes, setNotes] = useState(isEdit && transaction ? transaction.notes : '');
  const [transferGroupId, setTransferGroupId] = useState(isEdit && transaction ? transaction.transfer_group_id : '');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showCategoryCreateModal, setShowCategoryCreateModal] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [srcSearch, setSrcSearch] = useState('');
  const [pickerMode, setPickerMode] = useState('date');
  const [notesError, setNotesError] = useState(false);
  const [toAccount, setToAccount] = useState(null);
  const [selectingFor, setSelectingFor] = useState('from');

  useEffect(() => {
    (async () => {
      const cats = await getCategories(true);
      setCategories(cats);
      const src = await getSources(true);
      setSources(src);
      // Set default category/source if not in edit mode AND no category/source is selected yet
      if (!isEdit) {
        if (cats.length && categoryId === null) setCategoryId(cats[0].id);
        if (src.length && sourceId === null) setSourceId(src[0].id);
      }
    })();
  }, []);

  async function submit() {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val === 0) {
      setAmountError(true);
      return;
    }
    if (!categoryId && type !== 'transfer' && transferGroupId === null) {
      alert('Please select a category.');
      return;
    }
    if (!sourceId) {
      alert('Please select a source.'); // Simple alert for missing source
      return;
    }
    if (!notes.trim()) {
      setNotesError(true);
      return;
    }

    let id;
    if (type === 'transfer') {
      if (!sourceId || !toAccount) {
        alert('Select both accounts');
        return;
      }

      if (sourceId === toAccount) {
        alert('Cannot transfer to same account');
        return;
      }

      try {
        await createTransfer({
          fromAccount: sourceId,
          toAccount,
          amount: val,
          note: notes,
          date,
        });
      } catch (e) {
        console.log(e);
        alert(e.message);
      }
      id = 'transfer';
    } else {
      const transactionData = { type, amount: val, category_id: categoryId, source_id: sourceId, date, notes };

      if (isEdit && transaction && transaction.id) {
        id = await updateTransaction(transaction.id, transactionData);
      } else {
        id = await createTransaction(transactionData);
      }
    }
    if (onCreated) onCreated(id);
    if (!isEdit) { // Only reset form if it was a new transaction
      setAmount('');
      setNotes('');
      setDate(new Date().toISOString());
      setTransferGroupId('')
    }
    setAmountError(false);
    setNotesError(false);
  }

  function formatDateTime(isoString) {
    if (!isoString) return '';

    const d = new Date(isoString);

    const day = d.getDate();
    const month = d.toLocaleString('en-IN', { month: 'short' }); // Jun
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  }
  const accent =
    type === 'expense' ? '#E46A6A' :
      type === 'income' ? '#36B37E' : '#000';

  return (
    <ScrollView>
      <View style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        <View style={{
          backgroundColor:
            type === 'expense' ? '#FFF2F2' :
              type === 'income' ? '#F1FFF6' : '#F5F5F5',
          padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <View>
            <Text style={{ color: accent, fontSize: 14, fontWeight: '700', textTransform: 'uppercase' }}>{type || 'expense'}</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: accent }}>{amount ? (Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })) : '0.00'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ alignItems: 'center', marginRight: 12 }}>
              <MaterialCommunityIcons name={type === 'transfer' ? 'currency-usd' : (categories.find(x => x.id === categoryId) || {}).icon || 'currency-usd'} size={26} color={(categories.find(x => x.id === categoryId) || {}).color || '#4B7CF3'} />
              <Text style={{ fontSize: 12 }}>{type === 'transfer' ? 'Uncategorized' : (categories.find(x => x.id === categoryId) || {}).name || 'Uncategorized'}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <MaterialCommunityIcons name={(sources.find(x => x.id === sourceId) || {}).icon || 'cash'} size={26} color={(sources.find(x => x.id === sourceId) || {}).color || '#4B7CF3'} />
              <Text style={{ fontSize: 12 }}>{(sources.find(x => x.id === sourceId) || {}).name || 'Select Source'}</Text>
            </View>
          </View>
        </View>
      </View>

      <PaperTextInput label="Amount" value={amount} onChangeText={(t) => { setAmount(t); if (amountError) setAmountError(false); }} keyboardType="numeric" mode="outlined" style={{ marginBottom: 12, fontSize: 20 }} error={amountError} contentStyle={{ fontSize: 24 }} />
      {amountError ? <Text style={{ color: '#E46A6A', marginBottom: 8 }}>Enter an amount greater than 0</Text> : null}
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <Chip
          mode="outlined"
          selected={type === 'expense'}
          showSelectedCheck={false}
          onPress={() => setType('expense')}
          style={{ marginRight: 8, borderColor: type === 'expense' ? accent : undefined }}
        >
          Expense
        </Chip>

        <Chip
          mode="outlined"
          selected={type === 'income'}
          showSelectedCheck={false}
          onPress={() => setType('income')}
          style={{ marginRight: 8, borderColor: type === 'income' ? accent : undefined }}
        >
          Income
        </Chip>

        {!isEdit &&
          <Chip
            mode="outlined"
            selected={type === 'transfer'}
            showSelectedCheck={false}
            onPress={() => setType('transfer')}
            style={{
              borderColor: type === 'transfer' ? '#000' : undefined
            }}
            textStyle={{
              color: type === 'transfer' ? '#000' : undefined,
              fontWeight: type === 'transfer' ? '700' : 'normal'
            }}
          >
            Transfer
          </Chip>
        }
      </View>

      <View style={{ marginBottom: 12 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setPickerMode('date');
            setShowDateTimePicker(true);
          }}
        >
          <PaperTextInput
            label="Date & Time"
            value={formatDateTime(date)}
            editable={false}
            pointerEvents="none"
            mode="outlined"
            style={{ marginBottom: 8 }}
            right={
              <PaperTextInput.Icon
                icon="calendar"
                onPress={() => setShowDateTimePicker(true)}
              />
            }
          />
        </TouchableOpacity>
      </View>

      {type !== 'transfer' && (
        <View style={{ marginBottom: 12 }}>
          {!transferGroupId &&
            <>
              <Text style={{ marginBottom: 6, color: '#666' }}>Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(true)} activeOpacity={0.8} style={{ borderWidth: 1, borderColor: '#eee', padding: 12, borderRadius: 8, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name={(categories.find(x => x.id === categoryId) || {}).icon || 'tag'} size={20} color={(categories.find(x => x.id === categoryId) || {}).color || '#4B7CF3'} style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 16 }}>{(categories.find(x => x.id === categoryId) || {}).name || 'Select category'}</Text>
              </TouchableOpacity>
            </>
          }
          <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}>
              <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, maxHeight: '80%' }}>
                <PaperTextInput label="Search" value={catSearch} onChangeText={setCatSearch} mode="outlined" style={{ marginBottom: 8 }} />
                <ScrollView>
                  <TouchableOpacity
                    onPress={() => { setShowCategoryPicker(false); setShowCategoryCreateModal(true); }}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: '#f3f3f3', backgroundColor: '#e6f7ff' }}
                  >
                    <MaterialCommunityIcons name="plus-circle-outline" size={20} color={'#4B7CF3'} style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 16, color: '#4B7CF3', fontWeight: '600' }}>Create New Category</Text>
                  </TouchableOpacity>
                  {categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase())).map(c => (
                    <TouchableOpacity key={c.id} onPress={() => { setCategoryId(c.id); setShowCategoryPicker(false); }} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: '#f3f3f3', backgroundColor: categoryId === c.id ? '#FFF9F9' : '#fff' }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.color || '#eee', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <MaterialCommunityIcons name={c.icon || 'tag'} size={18} color={'#fff'} />
                      </View>
                      <Text style={{ fontSize: 16 }}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={{ height: 8 }} />
                <PaperButton mode="outlined" onPress={() => setShowCategoryPicker(false)}>Close</PaperButton>
              </View>
            </View>
          </Modal>
        </View>
      )}

      <View style={{ marginBottom: 12 }}>
        <Text style={{ marginBottom: 6, color: '#666' }}>Payment Source</Text>
        <TouchableOpacity onPress={() => { setSelectingFor('from'); setShowSourcePicker(true) }} activeOpacity={0.8} style={{ borderWidth: 1, borderColor: '#eee', padding: 12, borderRadius: 8, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f4ff', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <MaterialCommunityIcons name={(sources.find(x => x.id === sourceId) || {}).icon || 'cash'} size={18} color={(sources.find(x => x.id === sourceId) || {}).color || '#4B7CF3'} />
          </View>
          <Text style={{ fontSize: 16 }}>{(sources.find(x => x.id === sourceId) || {}).name || 'Select source'}</Text>
        </TouchableOpacity>
        <Modal visible={showSourcePicker} transparent animationType="slide" onRequestClose={() => setShowSourcePicker(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, maxHeight: '80%' }}>
              <PaperTextInput label="Search" value={srcSearch} onChangeText={setSrcSearch} mode="outlined" style={{ marginBottom: 8 }} />
              <ScrollView>
                {sources.filter(s =>
                  s.name.toLowerCase().includes(srcSearch.toLowerCase()) &&
                  (s.is_active === undefined || s.is_active)
                ).map(s => ( // Filter active sources
                  <TouchableOpacity key={s.id}
                    onPress={() => {
                      if (selectingFor === 'from') {
                        setSourceId(s.id);
                      } else {
                        setToAccount(s.id);
                      }
                      setShowSourcePicker(false);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: '#f3f3f3', backgroundColor: sourceId === s.id ? '#F7FBFF' : '#fff' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#eef7ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <MaterialCommunityIcons name={s.icon || 'cash'} size={18} color={(s.color) || '#4B7CF3'} />
                    </View>
                    <Text style={{ fontSize: 16 }}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ height: 8 }} />
              <PaperButton mode="outlined" onPress={() => setShowSourcePicker(false)}>Close</PaperButton>
            </View>
          </View>
        </Modal>
      </View>

      {type === 'transfer' && (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ marginBottom: 6, color: '#666' }}>To Account</Text>
          <TouchableOpacity
            onPress={() => {
              setSelectingFor('to');
              setShowSourcePicker(true);
            }}
            activeOpacity={0.8}
            style={{
              borderWidth: 1,
              borderColor: '#eee',
              padding: 12,
              borderRadius: 8,
              backgroundColor: '#fff',
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#eef7ff',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12
            }}>
              <MaterialCommunityIcons
                name={(sources.find(x => x.id === toAccount) || {}).icon || 'cash'}
                size={18}
                color={(sources.find(x => x.id === toAccount) || {}).color || '#4B7CF3'}
              />
            </View>

            <Text style={{ fontSize: 16 }}>
              {(sources.find(x => x.id === toAccount) || {}).name || 'Select destination account'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <PaperTextInput label="Notes" value={notes} onChangeText={(t) => { setNotes(t); setNotesError(false); }} mode="outlined" multiline style={{ marginBottom: 12 }} error={notesError} />
      {notesError && <Text style={{ color: '#E46A6A', marginBottom: 8 }}>Notes cannot be empty.</Text>}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        <PaperButton mode="contained" onPress={submit} style={{ backgroundColor: accent }} labelStyle={{ color: '#fff' }}>
          Save
        </PaperButton>
        <View style={{ width: 12 }} />
        <PaperButton mode="outlined" onPress={() => { if (onCancel) onCancel(); else { setAmount(''); setNotes(''); } }}>Cancel</PaperButton>
        <View style={{ width: 12 }} />
      </View>

      {/* Native DateTimePicker usage with fallback modal for platforms without library */}
      {showDateTimePicker && (
        (() => {
          // Prefer native datetimepicker only on native platforms; on web use the ManualDateTimePicker fallback
          if (Platform.OS !== 'web') {
            try {
              // Try to use community datetimepicker if available
              // eslint-disable-next-line global-require
              const DateTimePicker = require('@react-native-community/datetimepicker').default;
              return (
                <DateTimePicker
                  value={new Date(date)}
                  mode={pickerMode}
                  is24Hour={true}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selected) => {
                    // event may be undefined on some platforms
                    const evType = event && (event.type || event.nativeEvent?.action);
                    if (Platform.OS === 'android') {
                      // user dismissed
                      if (evType === 'dismissed' || evType === 'dismiss') {
                        setShowDateTimePicker(false);
                        setPickerMode('date');
                        return;
                      }
                      // user picked a date/time
                      if (pickerMode === 'date') {
                        const picked = selected || new Date();
                        const prev = new Date(date);
                        // preserve previous time
                        picked.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
                        setDate(picked.toISOString());
                        // open time picker next
                        setShowDateTimePicker(false);
                        setPickerMode('time');
                        setTimeout(() => setShowDateTimePicker(true), 50);
                      } else {
                        const picked = selected || new Date();
                        const prev = new Date(date);
                        prev.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
                        setDate(prev.toISOString());
                        setShowDateTimePicker(false);
                        setPickerMode('date');
                      }
                    } else {
                      // iOS behavior
                      if (selected) setDate((selected).toISOString());
                      setShowDateTimePicker(false);
                      setPickerMode('date');
                    }
                  }}
                />
              );
            } catch (e) {
              // fall through to manual picker
            }
          }

          // Fallback manual picker for web or if native picker not available
          return (
            <Modal visible={showDateTimePicker} transparent animationType="slide" onRequestClose={() => setShowDateTimePicker(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}>
                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8 }}>
                  <Text style={{ fontWeight: '600', marginBottom: 8 }}>Pick Date / Time</Text>
                  {(() => {
                    const dt = new Date(date || new Date().toISOString());
                    const [y, m, d, h, min] = [dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), dt.getHours(), dt.getMinutes()];
                    const Manual = require('../components/ManualDateTimePicker').default;
                    return (
                      <Manual
                        year={y} month={m} day={d} hour={h} minute={min}
                        onChange={(ny, nm, nd, nh, nmin) => {
                          const ndt = new Date(ny, nm - 1, nd, nh, nmin);
                          setDate(ndt.toISOString());
                        }}
                        onClose={() => setShowDateTimePicker(false)}
                      />
                    );
                  })()}
                </View>
              </View>
            </Modal>
          );
        })()
      )}

      <CategoryCreateModal
        visible={showCategoryCreateModal}
        onClose={() => setShowCategoryCreateModal(false)}
        onCategoryCreated={async (newCategory) => {
          const cats = await getCategories(true);
          setCategories(cats);
          setCategoryId(newCategory.id);
        }}
        currentType={type}
      />
    </ScrollView>
  );
}
