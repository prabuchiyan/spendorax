import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button as PaperButton } from 'react-native-paper';
import { getBillById, markBillPaid, skipBill, deleteBill } from '../services/bills';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import Card from '../components/Card';
import ConfirmDialog from '../components/ConfirmDialog';
import BillForm from '../components/BillForm';
import { Colors, Spacing } from '../components/Theme';
import {
  formatCurrency,
  formatDueDate,
  getBillDisplayStatus,
} from '../services/billUtils';

export default function BillDetailScreen({ route, navigation }) {
  const billId = route.params?.billId;
  const [bill, setBill] = useState(null);
  const [category, setCategory] = useState(null);
  const [source, setSource] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  async function load() {
    if (!billId) return;
    const b = await getBillById(billId);
    setBill(b);
    if (b?.category_id) {
      const cats = await getCategories(true);
      setCategory(cats.find((c) => c.id === b.category_id) || null);
    }
    if (b?.source_id) {
      const src = await getSources(true);
      setSource(src.find((s) => s.id === b.source_id) || null);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [billId])
  );

  useEffect(() => {
    if (bill) {
      navigation.setOptions({ title: bill.name });
    }
  }, [bill, navigation]);

  if (!bill && !editing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: Colors.muted }}>Loading bill...</Text>
      </View>
    );
  }

  if (editing) {
    return (
      <BillForm
        bill={bill}
        onSaved={() => { setEditing(false); load(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const display = getBillDisplayStatus(bill);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background }} contentContainerStyle={{ padding: Spacing.m }}>
      <Card>
        <View style={{ alignItems: 'center', marginBottom: Spacing.m }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: `${display.color}22`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}
          >
            <MaterialCommunityIcons
              name={category?.icon || 'file-document-outline'}
              size={28}
              color={display.color}
            />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.text }}>{bill.name}</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: display.color, marginTop: 4 }}>
            {formatCurrency(bill.amount)}
          </Text>
          <Text style={{ color: display.color, fontWeight: '600', marginTop: 4 }}>{display.label}</Text>
        </View>

        <DetailRow label="Due date" value={formatDueDate(bill.due_date)} />
        <DetailRow label="Category" value={category?.name || '—'} />
        <DetailRow label="Payment source" value={source?.name || '—'} />
        <DetailRow
          label="Recurring"
          value={
            bill.is_recurring
              ? `Every ${bill.recurrence_interval || 1} ${bill.recurrence_type || 'month'}`
              : 'No'
          }
        />
        {bill.recurrence_end_date ? (
          <DetailRow label="Recurrence ends" value={formatDueDate(bill.recurrence_end_date)} />
        ) : null}
        <DetailRow label="Reminder" value={`${bill.reminder_days_before ?? 2} day(s) before`} />
        <DetailRow label="Auto-pay" value={bill.auto_pay ? 'Enabled' : 'Disabled'} />
        {bill.paid_at ? <DetailRow label="Paid at" value={new Date(bill.paid_at).toLocaleString()} /> : null}
        {bill.notes ? <DetailRow label="Notes" value={bill.notes} /> : null}
        {bill.attachment_url ? <DetailRow label="Attachment" value={bill.attachment_url} /> : null}
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {bill.status !== 'paid' && bill.status !== 'skipped' ? (
          <PaperButton
            mode="contained"
            icon="check"
            onPress={async () => {
              await markBillPaid(bill.id, { source_id: bill.source_id });
              load();
            }}
            style={{ flex: 1, minWidth: 140 }}
            buttonColor="#36B37E"
          >
            Mark Paid
          </PaperButton>
        ) : null}
        {bill.status !== 'paid' && bill.status !== 'skipped' ? (
          <PaperButton
            mode="outlined"
            onPress={() => {
              setConfirmAction('skip');
              setConfirmVisible(true);
            }}
            style={{ flex: 1, minWidth: 120 }}
          >
            Skip
          </PaperButton>
        ) : null}
        <PaperButton mode="outlined" onPress={() => setEditing(true)} style={{ flex: 1, minWidth: 100 }}>
          Edit
        </PaperButton>
        <PaperButton
          mode="outlined"
          textColor="#E46A6A"
          onPress={() => {
            setConfirmAction('delete');
            setConfirmVisible(true);
          }}
          style={{ flex: 1, minWidth: 100 }}
        >
          Delete
        </PaperButton>
      </View>

      <ConfirmDialog
        visible={confirmVisible}
        title={confirmAction === 'delete' ? 'Delete Bill' : 'Skip Bill'}
        message={
          confirmAction === 'delete'
            ? `Delete "${bill.name}"? This cannot be undone.`
            : `Skip "${bill.name}" for this period?`
        }
        onCancel={() => { setConfirmVisible(false); setConfirmAction(null); }}
        onConfirm={async () => {
          if (confirmAction === 'delete') {
            await deleteBill(bill.id);
            navigation.goBack();
          } else if (confirmAction === 'skip') {
            await skipBill(bill.id);
            load();
          }
          setConfirmVisible(false);
          setConfirmAction(null);
        }}
      />
    </ScrollView>
  );
}

function DetailRow({ label, value }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#EEF1F6',
      }}
    >
      <Text style={{ color: Colors.muted, flex: 1 }}>{label}</Text>
      <Text style={{ color: Colors.text, fontWeight: '600', flex: 1.2, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
