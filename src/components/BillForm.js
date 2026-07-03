import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, ScrollView, Modal, Text, Platform } from 'react-native';
import { TextInput as PaperTextInput, Button as PaperButton, Chip, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import { createBill, updateBill } from '../services/bills';
import { RECURRENCE_TYPES } from '../services/billUtils';
import ManualDateTimePicker from './ManualDateTimePicker';
import { Colors } from './Theme';

function toDateStr(isoOrDate) {
  if (!isoOrDate) return new Date().toISOString().slice(0, 10);
  return String(isoOrDate).slice(0, 10);
}

export default function BillForm({ bill, onSaved, onCancel }) {
  const isEdit = Boolean(bill?.id);

  const [name, setName] = useState(bill?.name || '');
  const [amount, setAmount] = useState(bill ? String(bill.amount) : '');
  const [dueDate, setDueDate] = useState(toDateStr(bill?.due_date));
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [categoryId, setCategoryId] = useState(bill?.category_id || null);
  const [sourceId, setSourceId] = useState(bill?.source_id || null);
  const [isRecurring, setIsRecurring] = useState(Boolean(bill?.is_recurring));
  const [recurrenceType, setRecurrenceType] = useState(bill?.recurrence_type || 'monthly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(String(bill?.recurrence_interval || 1));
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(bill?.recurrence_end_date?.slice(0, 10) || '');
  const [reminderDays, setReminderDays] = useState(String(bill?.reminder_days_before ?? 2));
  const [autoPay, setAutoPay] = useState(Boolean(bill?.auto_pay));
  const [notes, setNotes] = useState(bill?.notes || '');
  const [attachmentUrl, setAttachmentUrl] = useState(bill?.attachment_url || '');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [categorySearch, setCategorySearch] = useState('');
  const [sourceSearch, setSourceSearch] = useState('');

  useEffect(() => {
    (async () => {
      const cats = (await getCategories(true)).filter((c) => c.type === 'expense');
      setCategories(cats);
      const src = await getSources(true);
      setSources(src);
      if (!categoryId && cats.length) setCategoryId(cats[0].id);
      if (!sourceId && src.length) setSourceId(src[0].id);
    })();
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedSource = sources.find((s) => s.id === sourceId);
  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );
  const filteredSources = sources.filter(s =>
    s.name.toLowerCase().includes(sourceSearch.toLowerCase())
  );

  function validate() {
    const next = {};
    if (!name.trim()) next.name = 'Name is required';
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) next.amount = 'Enter a valid amount';
    if (!dueDate) next.dueDate = 'Due date is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    const payload = {
      name: name.trim(),
      amount: parseFloat(amount),
      due_date: dueDate,
      is_recurring: isRecurring,
      recurrence_type: isRecurring ? recurrenceType : null,
      recurrence_interval: isRecurring ? parseInt(recurrenceInterval, 10) || 1 : 1,
      recurrence_end_date: isRecurring && recurrenceEndDate ? recurrenceEndDate : null,
      category_id: categoryId,
      source_id: sourceId,
      reminder_days_before: parseInt(reminderDays, 10) || 2,
      auto_pay: autoPay,
      notes: notes || null,
      attachment_url: attachmentUrl || null,
    };

    if (isEdit) {
      await updateBill(bill.id, payload);
    } else {
      await createBill(payload);
    }
    onSaved && onSaved();
  }

  const dueParts = dueDate ? dueDate.split('-').map(Number) : [];
  const endParts = recurrenceEndDate ? recurrenceEndDate.split('-').map(Number) : [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <PaperTextInput
        label="Bill name"
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={{ marginBottom: 12 }}
        error={!!errors.name}
      />
      {errors.name ? <Text style={{ color: '#E46A6A', marginBottom: 8 }}>{errors.name}</Text> : null}

      <PaperTextInput
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        mode="outlined"
        style={{ marginBottom: 12 }}
        error={!!errors.amount}
      />
      {errors.amount ? <Text style={{ color: '#E46A6A', marginBottom: 8 }}>{errors.amount}</Text> : null}

      <TouchableOpacity onPress={() => setShowDuePicker(true)}>
        <PaperTextInput
          label="Due date"
          value={dueDate}
          editable={false}
          mode="outlined"
          style={{ marginBottom: 12 }}
          error={!!errors.dueDate}
          right={
            <PaperTextInput.Icon
              icon="calendar"
              onPress={() => setShowDuePicker(true)}
            />
          }
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setShowCategoryPicker(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <MaterialCommunityIcons
          name={selectedCategory?.icon || 'tag'}
          size={24}
          color={selectedCategory?.color || Colors.primary}
        />
        <Text style={{ marginLeft: 10, flex: 1 }}>{selectedCategory?.name || 'Select category'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setShowSourcePicker(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <MaterialCommunityIcons name={selectedSource?.icon || 'wallet'} size={24} color={Colors.primary} />
        <Text style={{ marginLeft: 10, flex: 1 }}>{selectedSource?.name || 'Payment source'}</Text>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontWeight: '600' }}>Recurring bill</Text>
        <Switch value={isRecurring} onValueChange={setIsRecurring} />
      </View>

      {isRecurring ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ marginBottom: 8, color: Colors.muted }}>Recurrence</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            {RECURRENCE_TYPES.map((t) => (
              <Chip
                key={t}
                selected={recurrenceType === t}
                onPress={() => setRecurrenceType(t)}
                style={{ marginRight: 6, marginBottom: 6 }}
              >
                {t}
              </Chip>
            ))}
          </View>
          <PaperTextInput
            label="Every (interval)"
            value={recurrenceInterval}
            onChangeText={setRecurrenceInterval}
            keyboardType="numeric"
            mode="outlined"
            style={{ marginBottom: 8 }}
          />
          <TouchableOpacity onPress={() => setShowEndPicker(true)}>
            <PaperTextInput
              label="Recurrence end date (optional)"
              value={recurrenceEndDate}
              editable={false}
              mode="outlined"
            />
          </TouchableOpacity>
        </View>
      ) : null}

      <PaperTextInput
        label="Remind days before due"
        value={reminderDays}
        onChangeText={setReminderDays}
        keyboardType="numeric"
        mode="outlined"
        style={{ marginBottom: 12 }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontWeight: '600' }}>Auto-pay</Text>
        <Switch value={autoPay} onValueChange={setAutoPay} />
      </View>

      <PaperTextInput
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        mode="outlined"
        multiline
        style={{ marginBottom: 12 }}
      />

      <PaperTextInput
        label="Attachment URL (optional)"
        value={attachmentUrl}
        onChangeText={setAttachmentUrl}
        mode="outlined"
        style={{ marginBottom: 16 }}
      />

      <View style={{ flexDirection: 'row' }}>
        <PaperButton mode="contained" onPress={submit} style={{ flex: 1, marginRight: 8 }}>
          {isEdit ? 'Save Changes' : 'Add Bill'}
        </PaperButton>
        {onCancel ? (
          <PaperButton mode="outlined" onPress={onCancel} style={{ flex: 1 }}>
            Cancel
          </PaperButton>
        ) : null}
      </View>

      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', maxHeight: '60%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Category</Text>
            <PaperTextInput
              placeholder="Search category..."
              value={categorySearch}
              onChangeText={setCategorySearch}
              mode="outlined"
              style={{ marginBottom: 10 }}
            />
            <ScrollView>
              {filteredCategories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => { setCategoryId(c.id); setShowCategoryPicker(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
                >
                  <MaterialCommunityIcons name={c.icon || 'tag'} size={22} color={c.color || Colors.primary} />
                  <Text style={{ marginLeft: 10 }}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <PaperButton onPress={() => setShowCategoryPicker(false)}>Close</PaperButton>
          </View>
        </View>
      </Modal>

      <Modal visible={showSourcePicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', maxHeight: '50%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Payment source</Text>
            <PaperTextInput
              placeholder="Search source..."
              value={sourceSearch}
              onChangeText={setSourceSearch}
              mode="outlined"
              style={{ marginBottom: 10 }}
            />
            <ScrollView>
              {filteredSources.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => { setSourceId(s.id); setShowSourcePicker(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
                >
                  <MaterialCommunityIcons name={s.icon || 'wallet'} size={22} color={Colors.primary} />
                  <Text style={{ marginLeft: 10 }}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <PaperButton onPress={() => setShowSourcePicker(false)}>Close</PaperButton>
          </View>
        </View>
      </Modal>

      <Modal visible={showDuePicker} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontWeight: '700', marginBottom: 12 }}>Due date</Text>
            {Platform.OS === 'web' ? (
              <ManualDateTimePicker
                year={dueParts[0]}
                month={dueParts[1]}
                day={dueParts[2]}
                hour={0}
                minute={0}
                onChange={(y, m, d) => {
                  const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  setDueDate(ds);
                }}
                onClose={() => setShowDuePicker(false)}
              />
            ) : (
              <PaperTextInput
                label="YYYY-MM-DD"
                value={dueDate}
                onChangeText={setDueDate}
                mode="outlined"
                style={{ marginBottom: 12 }}
              />
            )}
            <PaperButton onPress={() => setShowDuePicker(false)}>Done</PaperButton>
          </View>
        </View>
      </Modal>

      <Modal visible={showEndPicker} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontWeight: '700', marginBottom: 12 }}>Recurrence end date</Text>
            <ManualDateTimePicker
              year={endParts[0] || new Date().getFullYear()}
              month={endParts[1] || 1}
              day={endParts[2] || 1}
              hour={0}
              minute={0}
              onChange={(y, m, d) => {
                setRecurrenceEndDate(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
              }}
              onClose={() => setShowEndPicker(false)}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
