import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, FlatList,
  TouchableOpacity, Modal, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button as PaperButton, Chip, Divider, TextInput as PaperTextInput } from 'react-native-paper';
import { Dimensions, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import ManualDateTimePicker from '../components/ManualDateTimePicker';
import PremiumRoundedBarChart from '../components/PremiumRoundedBarChart';
import {
  getBillById,
  getBillSeries,
  markBillPaid,
  skipBill,
  deleteBill,
  getTransactionsForBillLink,
  getBillLinkedTransactions,
  linkAdditionalTransaction,
  removeTransactionFromBill,
} from '../services/bills';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import Card from '../components/Card';
import ConfirmDialog from '../components/ConfirmDialog';
import BillForm from '../components/BillForm';
import { Colors, Spacing } from '../components/Theme';
import {
  formatCurrency, formatDueDate,
  getBillDisplayStatus, BILL_STATUS,
} from '../services/billUtils';
import { createBill } from '../services/bills';

const screenWidth = Dimensions.get('window').width;

// ─── tiny sub-components ────────────────────────────────────────────────────

function DetailRow({ label, value }) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF1F6',
    }}>
      <Text style={{ color: Colors.muted, flex: 1 }}>{label}</Text>
      <Text style={{ color: Colors.text, fontWeight: '600', flex: 1.5, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function StatusBadge({ display }) {
  return (
    <View style={{
      alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 4,
      borderRadius: 20, backgroundColor: `${display.color}20`, marginTop: 6,
    }}>
      <Text style={{ color: display.color, fontWeight: '700', fontSize: 13 }}>{display.label}</Text>
    </View>
  );
}

// ─── linked transactions card ────────────────────────────────────────────────

function LinkedTransactionsCard({ linkedTxs, onAddMore, onUnlink }) {
  if (!linkedTxs.length && !onAddMore) return null;

  return (
    <Card style={{ marginTop: Spacing.s }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ fontWeight: '700', fontSize: 15, color: Colors.text }}>
          Linked Transactions ({linkedTxs.length})
        </Text>
        {onAddMore && (
          <TouchableOpacity onPress={onAddMore}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF3FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
            <MaterialCommunityIcons name="link-variant-plus" size={16} color={Colors.primary} />
            <Text style={{ color: Colors.primary, fontWeight: '600', marginLeft: 4, fontSize: 13 }}>Link More</Text>
          </TouchableOpacity>
        )}
      </View>

      {linkedTxs.length === 0 ? (
        <Text style={{ color: Colors.muted, fontSize: 13, textAlign: 'center', paddingVertical: 8 }}>
          No transactions linked yet
        </Text>
      ) : (
        linkedTxs.map((tx, idx) => (
          <View key={tx.id}>
            {idx > 0 && <Divider style={{ marginVertical: 4 }} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
              {/* Category icon circle */}
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: `${tx.category_color || Colors.primary}20`,
                alignItems: 'center', justifyContent: 'center', marginRight: 10,
              }}>
                <MaterialCommunityIcons
                  name={tx.category_icon || 'cash'}
                  size={20} color={tx.category_color || Colors.primary}
                />
              </View>

              {/* Info */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', color: Colors.text, fontSize: 14 }} numberOfLines={1}>
                  {tx.notes || '(no notes)'}
                </Text>
                <Text style={{ color: Colors.muted, fontSize: 12, marginTop: 2 }}>
                  {tx.date
                    ? new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                  {tx.source_name ? ` · ${tx.source_name}` : ''}
                </Text>
                {tx.category_name ? (
                  <Text style={{ color: Colors.muted, fontSize: 11, marginTop: 1 }}>{tx.category_name}</Text>
                ) : null}
              </View>

              {/* Amount + unlink */}
              <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                <Text style={{ fontWeight: '800', color: '#E46A6A', fontSize: 15 }}>
                  {formatCurrency(tx.amount)}
                </Text>
                {onUnlink && (
                  <TouchableOpacity onPress={() => onUnlink(tx)} style={{ marginTop: 4 }}>
                    <MaterialCommunityIcons name="link-variant-off" size={16} color={Colors.muted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

// ─── occurrence list ─────────────────────────────────────────────────────────

function OccurrenceList({ series, selectedId, onSelect }) {
  if (series.length <= 1) return null;

  return (
    <Card style={{ marginTop: Spacing.s }}>
      <Text style={{ fontWeight: '700', fontSize: 15, color: Colors.text, marginBottom: 10 }}>
        All Occurrences ({series.length})
      </Text>
      {series.map((occ) => {
        const d = getBillDisplayStatus(occ);
        const isSelected = selectedId === occ.id;
        return (
          <TouchableOpacity
            key={occ.id}
            onPress={() => onSelect(occ)}
            style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4,
              backgroundColor: isSelected ? `${d.color}12` : 'transparent',
              borderWidth: isSelected ? 1.5 : 1,
              borderColor: isSelected ? d.color : '#EEF1F6',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: Colors.text, fontWeight: isSelected ? '700' : '500', fontSize: 14 }}>
                {formatDueDate(occ.due_date)}
              </Text>
              {occ.linked_transaction_id ? (
                <Text style={{ fontSize: 11, color: Colors.muted, marginTop: 2 }}>
                  <MaterialCommunityIcons name="link-variant" size={11} color={Colors.muted} /> Tx #{occ.linked_transaction_id}
                </Text>
              ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '700', color: d.color, fontSize: 14 }}>{formatCurrency(occ.amount)}</Text>
              <View style={{ backgroundColor: `${d.color}20`, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 3 }}>
                <Text style={{ color: d.color, fontSize: 11, fontWeight: '600' }}>{d.label}</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </Card>
  );
}

// ─── link transaction modal ──────────────────────────────────────────────────

function LinkTransactionModal({ visible, bill, onLink, onClose }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sourcesMap, setSourcesMap] = useState({});

  useEffect(() => {
    if (!visible || !bill) return;
    setLoading(true);
    Promise.all([getTransactionsForBillLink(bill), getSources(true)])
      .then(([txs, srcs]) => {
        setCandidates(txs);
        const m = {};
        srcs.forEach(s => (m[s.id] = s));
        setSourcesMap(m);
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [visible, bill?.id]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
          maxHeight: '72%', padding: 16,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: Colors.text }}>Link Transaction</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={Colors.muted} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: Colors.muted, fontSize: 13, marginBottom: 12 }}>
            Filtered by category &amp; due month for "{bill?.name}"
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 30 }} />
          ) : candidates.length === 0 ? (
            <Text style={{ color: Colors.muted, textAlign: 'center', marginVertical: 30 }}>
              No matching transactions found.
            </Text>
          ) : (
            <FlatList
              data={candidates}
              keyExtractor={t => String(t.id)}
              renderItem={({ item: tx }) => (
                <TouchableOpacity
                  onPress={() => onLink(tx)}
                  style={{
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF1F6',
                  }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: `${tx.category_color || Colors.primary}20`,
                    alignItems: 'center', justifyContent: 'center', marginRight: 10,
                  }}>
                    <MaterialCommunityIcons name={tx.category_icon || 'cash'} size={18} color={tx.category_color || Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', color: Colors.text, fontSize: 14 }} numberOfLines={1}>
                      {tx.notes || '(no notes)'}
                    </Text>
                    <Text style={{ color: Colors.muted, fontSize: 12, marginTop: 2 }}>
                      {tx.date ? new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      {tx.source_name ? ` · ${tx.source_name}` : ''}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '800', color: '#E46A6A', marginLeft: 8, fontSize: 15 }}>
                    {formatCurrency(tx.amount)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          <PaperButton mode="outlined" onPress={onClose} style={{ marginTop: 12 }}>Cancel</PaperButton>
        </View>
      </View>
    </Modal>
  );
}

// ─── occurrence edit modal ───────────────────────────────────────────────────

function OccurrenceEditModal({ visible, occurrence, onSave, onClose }) {
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showDuePicker, setShowDuePicker] = useState(false);

  useEffect(() => {
    if (occurrence) {
      setAmount(String(occurrence.amount || ''));
      setDueDate(occurrence.due_date ? occurrence.due_date.slice(0, 10) : '');
    }
  }, [occurrence]);

  const dueParts = dueDate ? dueDate.split('-').map(Number) : [];

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) return;
    if (!dueDate) return;
    onSave(amt, dueDate);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20 }}>
          <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 16 }}>Edit Bill Occurrence</Text>

          <Text style={{ fontSize: 13, color: Colors.muted, marginBottom: 6 }}>Amount</Text>
          <PaperTextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            mode="outlined"
            style={{ marginBottom: 16, backgroundColor: '#fff' }}
          />

          <Text style={{ fontSize: 13, color: Colors.muted, marginBottom: 6 }}>Due Date</Text>
          <TouchableOpacity onPress={() => setShowDuePicker(true)}>
            <PaperTextInput
              value={dueDate}
              editable={false}
              mode="outlined"
              style={{ marginBottom: 20, backgroundColor: '#fff' }}
              right={<PaperTextInput.Icon icon="calendar" onPress={() => setShowDuePicker(true)} />}
            />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <PaperButton mode="text" onPress={onClose}>Cancel</PaperButton>
            <PaperButton mode="contained" onPress={handleSave}>Save</PaperButton>
          </View>
        </View>
      </View>

      {showDuePicker && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={new Date(dueDate || Date.now())}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            if (Platform.OS === 'android') {
              setShowDuePicker(false);
              if (event.type === 'dismissed') return;
            }
            if (selectedDate) {
              setDueDate(selectedDate.toISOString().slice(0, 10));
            }
            if (Platform.OS === 'ios') setShowDuePicker(false);
          }}
        />
      ) : (
        <Modal visible={showDuePicker} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
              <Text style={{ fontWeight: '700', marginBottom: 12 }}>Due date</Text>
              <ManualDateTimePicker
                year={dueParts[0] || new Date().getFullYear()}
                month={dueParts[1] || new Date().getMonth() + 1}
                day={dueParts[2] || new Date().getDate()}
                hour={0} minute={0}
                onChange={(y, m, d) => {
                  const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  setDueDate(ds);
                }}
                onClose={() => setShowDuePicker(false)}
              />
              <PaperButton onPress={() => setShowDuePicker(false)}>Done</PaperButton>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function BillDetailScreen({ route, navigation }) {
  const billId = route.params?.billId;       // template id
  const occurrenceId = route.params?.occurrenceId;

  const [bill, setBill] = useState(null);   // template
  const [series, setSeries] = useState([]);
  const [selectedOcc, setSelectedOcc] = useState(null);
  const [linkedTxs, setLinkedTxs] = useState([]);
  const [category, setCategory] = useState(null);
  const [source, setSource] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showEditOcc, setShowEditOcc] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedChartLabel, setSelectedChartLabel] = useState(null);

  // ── load ──────────────────────────────────────────────────────────────────
  async function load() {
    if (!billId) return;

    const [b, s, cats, srcs] = await Promise.all([
      getBillById(billId),
      getBillSeries(billId),
      getCategories(true),
      getSources(true),
    ]);

    setBill(b);
    setSeries(s);

    // Resolve category / source from template
    if (b?.category_id) setCategory(cats.find(c => c.id === b.category_id) || null);
    if (b?.source_id) setSource(srcs.find(ss => ss.id === b.source_id) || null);

    // Pick the occurrence to show
    let occ = null;
    if (occurrenceId) {
      occ = s.find(o => o.id === occurrenceId) || null;
    }
    if (!occ) {
      // Default: current-month unpaid, else most-recent
      const now = new Date();
      occ = s.find(o => {
        if (!o.due_date) return false;
        const d = new Date(o.due_date);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          o.status !== BILL_STATUS.PAID &&
          o.status !== BILL_STATUS.SKIPPED
        );
      }) || s[0] || null;
    }
    setSelectedOcc(occ);
    if (occ) {
      const txs = await getBillLinkedTransactions(occ.id);
      setLinkedTxs(txs);
    }

    // Set chart label
    if (occ && occ.due_date) {
      const d = new Date(occ.due_date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      setSelectedChartLabel(`${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`);
    }
  }

  // Reload linked txs whenever selected occurrence changes
  async function reloadLinkedTxs(occId) {
    if (!occId) { setLinkedTxs([]); return; }
    const txs = await getBillLinkedTransactions(occId);
    setLinkedTxs(txs);
  }

  useFocusEffect(useCallback(() => { load(); }, [billId]));

  useEffect(() => {
    if (bill) navigation.setOptions({ title: bill.name });
  }, [bill]);

  // ── actions ───────────────────────────────────────────────────────────────
  async function handleMarkPaid() {
    if (!selectedOcc) return;
    await markBillPaid(selectedOcc.id, { source_id: selectedOcc.source_id });
    load();
  }

  async function handleLinkTransaction(tx) {
    if (!selectedOcc) return;
    await linkAdditionalTransaction(selectedOcc.id, tx.id);
    setShowLinkModal(false);
    load();
  }

  async function handleUnlinkTransaction(tx) {
    if (!selectedOcc) return;
    await removeTransactionFromBill(selectedOcc.id, tx.id);
    await reloadLinkedTxs(selectedOcc.id);
  }

  async function handleSelectOccurrence(occ) {
    setSelectedOcc(occ);
    await reloadLinkedTxs(occ.id);
    if (occ.due_date) {
      const d = new Date(occ.due_date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      setSelectedChartLabel(`${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`);
    }
  }

  async function handleSaveOccurrence(newAmount, newDueDate) {
    if (!selectedOcc) return;
    if (selectedOcc.id === bill.id) {
      // It's the template acting as the first occurrence
      await createBill({
        ...bill,
        amount: newAmount,
        due_date: newDueDate,
        is_recurring: 0,
        recurrence_type: null,
        parent_bill_id: bill.id,
      });
    } else {
      const { updateBill } = require('../services/bills');
      await updateBill(selectedOcc.id, { amount: newAmount, due_date: newDueDate });
    }
    setShowEditOcc(false);
    load();
  }

  // Chart data extraction
  const chartData = React.useMemo(() => {
    const map = {};
    [...series].reverse().forEach(occ => {
      if (!occ.due_date) return;
      const d = new Date(occ.due_date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthLabel = `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
      if (!map[monthLabel]) map[monthLabel] = 0;
      map[monthLabel] += Number(occ.amount || 0);
    });
    return {
      labels: Object.keys(map),
      values: Object.values(map)
    };
  }, [series]);

  const filteredSeries = React.useMemo(() => {
    if (!selectedChartLabel) return series;
    return series.filter(occ => {
      if (!occ.due_date) return false;
      const d = new Date(occ.due_date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const lbl = `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
      return lbl === selectedChartLabel;
    });
  }, [series, selectedChartLabel]);

  // ── guards ────────────────────────────────────────────────────────────────
  if (!bill && !editing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
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

  const activeBill = selectedOcc || bill;
  const display = getBillDisplayStatus(activeBill);
  const isPaidOrSkipped = activeBill.status === BILL_STATUS.PAID || activeBill.status === BILL_STATUS.SKIPPED;

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const activeBillMonthStr = activeBill.due_date ? activeBill.due_date.slice(0, 7) : null;
  const isCurrentMonth = currentMonthStr === activeBillMonthStr;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{ padding: Spacing.xs, paddingBottom: 120 }}
    >
      {/* Monthly Chart */}
      <Card style={{ marginBottom: Spacing.s, paddingBottom: 0 }}>
        <Text style={{ fontWeight: '700', fontSize: 15, color: Colors.text, marginBottom: 10 }}>
          Bill History
        </Text>
        <PremiumRoundedBarChart
          labels={chartData.labels}
          values={chartData.values}
          width={screenWidth - 56}
          height={250}
          baseColor={category?.color || Colors.primary}
          selectedLabel={selectedChartLabel}
          isEmpty={chartData.labels.length === 0}
          onBarPress={(data) => {
            setSelectedChartLabel(data.label);

            const matchingOcc = series.find(occ => {
              if (!occ.due_date) return false;

              const d = new Date(occ.due_date);
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

              return `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}` === data.label;
            });

            if (matchingOcc) {
              handleSelectOccurrence(matchingOcc);
            }
          }}
        />
      </Card>

      {/* ── Hero card ── */}
      <Card style={{ marginBottom: Spacing.s }}>
        {/* Icon + name + amount */}
        <View style={{ alignItems: 'center', paddingBottom: 12 }}>
          <View style={{
            width: 60, height: 60, borderRadius: 30,
            backgroundColor: `${display.color}20`,
            alignItems: 'center', justifyContent: 'center', marginBottom: 10,
          }}>
            <MaterialCommunityIcons name={category?.icon || 'file-document-outline'} size={30} color={display.color} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: Colors.text }}>{bill.name}</Text>
          <Text style={{ fontSize: 30, fontWeight: '800', color: display.color, marginTop: 4 }}>
            {formatCurrency(activeBill.amount)}
          </Text>
          <StatusBadge display={display} />
        </View>

        <Divider style={{ marginBottom: 10 }} />

        <DetailRow label="Due date" value={formatDueDate(activeBill.due_date)} />
        <DetailRow label="Category" value={category?.name || '—'} />
        <DetailRow label="Source" value={source?.name || '—'} />
        <DetailRow
          label="Recurring"
          value={bill.is_recurring
            ? `Every ${bill.recurrence_interval || 1} ${bill.recurrence_type || 'month'}`
            : 'No'}
        />
        {bill.recurrence_end_date ? (
          <DetailRow label="Ends on" value={formatDueDate(bill.recurrence_end_date)} />
        ) : null}
        <DetailRow label="Reminder" value={`${bill.reminder_days_before ?? 2} day(s) before`} />
        <DetailRow label="Auto-pay" value={bill.auto_pay ? 'Enabled' : 'Disabled'} />
        {activeBill.paid_at ? (
          <DetailRow label="Paid at" value={new Date(activeBill.paid_at).toLocaleString('en-IN')} />
        ) : null}
        {bill.notes ? <DetailRow label="Notes" value={bill.notes} /> : null}
      </Card>

      {/* ── Action buttons ── */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.s }}>
        {!isPaidOrSkipped && (
          <PaperButton
            mode="contained" icon="check"
            onPress={handleMarkPaid}
            style={{ flex: 1, minWidth: 140, opacity: isCurrentMonth ? 1 : 0.5 }}
            buttonColor="#36B37E"
            disabled={!isCurrentMonth}
          >
            Mark Paid
          </PaperButton>
        )}

        {/* ISSUE 3: Link More Transactions (always show so user can link even after paid) */}
        <PaperButton
          mode="outlined" icon="link-variant-plus"
          onPress={() => setShowLinkModal(true)}
          style={{ flex: 1, minWidth: 140 }}
        >
          Link Transaction
        </PaperButton>

        {!isPaidOrSkipped && (
          <PaperButton
            mode="outlined"
            onPress={() => { setConfirmAction('skip'); setConfirmVisible(true); }}
            style={{ flex: 1, minWidth: 90 }}
          >
            Skip
          </PaperButton>
        )}

        <PaperButton mode="outlined" onPress={() => setShowEditOcc(true)} style={{ flex: 1, minWidth: 80 }}>
          Edit Bill
        </PaperButton>

        <PaperButton
          mode="outlined" textColor="#E46A6A"
          onPress={() => { setConfirmAction('delete_occ'); setConfirmVisible(true); }}
          style={{ flex: 1, minWidth: 80 }}
        >
          Delete Bill
        </PaperButton>
      </View>

      {/* ISSUE 4: Linked transactions card */}
      <LinkedTransactionsCard
        linkedTxs={linkedTxs}
        onAddMore={() => setShowLinkModal(true)}
        onUnlink={handleUnlinkTransaction}
      />

      {/* Occurrence list (ISSUE 1 detail view) */}
      <OccurrenceList
        series={filteredSeries}
        selectedId={selectedOcc?.id}
        onSelect={handleSelectOccurrence}
      />

      {/* ── Confirm dialog ── */}
      <ConfirmDialog
        visible={confirmVisible}
        title={confirmAction === 'delete_occ' ? 'Delete Bill' : 'Skip Bill'}
        message={
          confirmAction === 'delete_occ'
            ? `Delete the occurrence for ${formatDueDate(activeBill.due_date)}?`
            : `Skip "${activeBill.name}" for ${formatDueDate(activeBill.due_date)}?`
        }
        confirmLabel={confirmAction === 'skip' ? 'Skip' : 'Delete'}
        onCancel={() => { setConfirmVisible(false); setConfirmAction(null); }}
        onConfirm={async () => {
          if (confirmAction === 'delete_occ') {
            if (activeBill.id === bill.id) {
              // Create a deleted override child row
              const newId = await createBill({
                ...bill,
                is_recurring: 0,
                recurrence_type: null,
                parent_bill_id: bill.id,
              });
              await deleteBill(newId);
            } else {
              await deleteBill(activeBill.id);
            }
            load();
          } else if (confirmAction === 'skip') {
            await skipBill(activeBill.id);
            load();
          }
          setConfirmVisible(false);
          setConfirmAction(null);
        }}
      />

      {/* ISSUE 3: Link transaction modal */}
      <LinkTransactionModal
        visible={showLinkModal}
        bill={activeBill}
        onLink={handleLinkTransaction}
        onClose={() => setShowLinkModal(false)}
      />

      <OccurrenceEditModal
        visible={showEditOcc}
        occurrence={selectedOcc}
        onSave={handleSaveOccurrence}
        onClose={() => setShowEditOcc(false)}
      />
    </ScrollView>
  );
}