import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button as PaperButton, Chip } from 'react-native-paper';
import {
  getBillById,
  getBillSeries,
  markBillPaid,
  skipBill,
  deleteBill,
  getTransactionsForBillLink,
} from '../services/bills';
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
  BILL_STATUS,
} from '../services/billUtils';

export default function BillDetailScreen({ route, navigation }) {
  const billId = route.params?.billId;           // template id
  const occurrenceId = route.params?.occurrenceId; // optional: pre-select occurrence
  const [bill, setBill] = useState(null);         // template bill
  const [series, setSeries] = useState([]);        // all occurrences
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);
  const [category, setCategory] = useState(null);
  const [source, setSource] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  // Link existing transaction
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkCandidates, setLinkCandidates] = useState([]);
  const [linkLoading, setLinkLoading] = useState(false);
  // Sources map for transaction display
  const [sourcesMap, setSourcesMap] = useState({});

  async function load() {
    if (!billId) return;
    const b = await getBillById(billId);
    setBill(b);
    const s = await getBillSeries(billId);
    setSeries(s);
    // Pre-select the occurrence passed in from BillsScreen, or default to
    // the most-recent unpaid one, or the first in the list
    if (occurrenceId) {
      const match = s.find((o) => o.id === occurrenceId);
      setSelectedOccurrence(match || s[0] || null);
    } else {
      // Default to current month's unpaid occurrence if available
      const now = new Date();
      const thisMonth = s.find((o) => {
        if (!o.due_date) return false;
        const d = new Date(o.due_date);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          o.status !== BILL_STATUS.PAID &&
          o.status !== BILL_STATUS.SKIPPED
        );
      });
      setSelectedOccurrence(thisMonth || s[0] || null);
    }
    if (b?.category_id) {
      const cats = await getCategories(true);
      setCategory(cats.find((c) => c.id === b.category_id) || null);
    }
    if (b?.source_id) {
      const src = await getSources(true);
      setSource(src.find((ss) => ss.id === b.source_id) || null);
      const map = {};
      src.forEach((ss) => (map[ss.id] = ss));
      setSourcesMap(map);
    } else {
      const src = await getSources(true);
      const map = {};
      src.forEach((ss) => (map[ss.id] = ss));
      setSourcesMap(map);
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [billId])
  );

  useEffect(() => {
    if (bill) navigation.setOptions({ title: bill.name });
  }, [bill, navigation]);

  // ── Link existing transaction ──────────────────────────────────────────────
  async function openLinkModal() {
    if (!selectedOccurrence) return;
    setLinkLoading(true);
    setShowLinkModal(true);
    try {
      const txs = await getTransactionsForBillLink(selectedOccurrence);
      setLinkCandidates(txs);
    } catch (e) {
      setLinkCandidates([]);
    } finally {
      setLinkLoading(false);
    }
  }

  async function handleLinkTransaction(tx) {
    if (!selectedOccurrence) return;
    await markBillPaid(selectedOccurrence.id, {
      createTransaction: false,
      existingTransactionId: tx.id,
      date: tx.date,
    });
    setShowLinkModal(false);
    load();
  }

  // ── Actions on selectedOccurrence ─────────────────────────────────────────
  async function handleMarkPaid() {
    if (!selectedOccurrence) return;
    await markBillPaid(selectedOccurrence.id, {
      source_id: selectedOccurrence.source_id,
    });
    load();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
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

  const display = getBillDisplayStatus(selectedOccurrence || bill);
  const activeBill = selectedOccurrence || bill;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{ padding: Spacing.xs, paddingBottom: 100 }}
    >
      {/* ── Header card ── */}
      <Card>
        <View style={{ alignItems: 'center', marginBottom: Spacing.xs }}>
          <View style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: `${display.color}22`,
            alignItems: 'center', justifyContent: 'center', marginBottom: 8,
          }}>
            <MaterialCommunityIcons
              name={category?.icon || 'file-document-outline'}
              size={28} color={display.color}
            />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.text }}>{bill.name}</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: display.color, marginTop: 4 }}>
            {formatCurrency(activeBill.amount)}
          </Text>
          <Text style={{ color: display.color, fontWeight: '600', marginTop: 4 }}>{display.label}</Text>
        </View>

        <DetailRow label="Due date" value={formatDueDate(activeBill.due_date)} />
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
        {activeBill.paid_at ? (
          <DetailRow label="Paid at" value={new Date(activeBill.paid_at).toLocaleString()} />
        ) : null}
        {activeBill.linked_transaction_id ? (
          <DetailRow label="Linked Tx" value={`#${activeBill.linked_transaction_id}`} />
        ) : null}
        {bill.notes ? <DetailRow label="Notes" value={bill.notes} /> : null}
      </Card>

      {/* ── Action buttons ── */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.s }}>
        {activeBill.status !== 'paid' && activeBill.status !== 'skipped' ? (
          <PaperButton
            mode="contained"
            icon="check"
            onPress={handleMarkPaid}
            style={{ flex: 1, minWidth: 140 }}
            buttonColor="#36B37E"
          >
            Mark Paid
          </PaperButton>
        ) : null}
        {/* Link to existing transaction */}
        {activeBill.status !== 'paid' && activeBill.status !== 'skipped' ? (
          <PaperButton
            mode="outlined"
            icon="link-variant"
            onPress={openLinkModal}
            style={{ flex: 1, minWidth: 140 }}
          >
            Link Transaction
          </PaperButton>
        ) : null}
        {activeBill.status !== 'paid' && activeBill.status !== 'skipped' ? (
          <PaperButton
            mode="outlined"
            onPress={() => {
              setConfirmAction('skip');
              setConfirmVisible(true);
            }}
            style={{ flex: 1, minWidth: 100 }}
          >
            Skip
          </PaperButton>
        ) : null}
        <PaperButton mode="outlined" onPress={() => setEditing(true)} style={{ flex: 1, minWidth: 80 }}>
          Edit
        </PaperButton>
        <PaperButton
          mode="outlined"
          textColor="#E46A6A"
          onPress={() => { setConfirmAction('delete'); setConfirmVisible(true); }}
          style={{ flex: 1, minWidth: 80 }}
        >
          Delete
        </PaperButton>
      </View>

      {/* ── Occurrences list ── */}
      {series.length > 1 && (
        <Card style={{ marginTop: Spacing.s }}>
          <Text style={{ fontWeight: '700', fontSize: 15, color: Colors.text, marginBottom: 10 }}>
            All Occurrences ({series.length})
          </Text>
          {series.map((occ) => {
            const d = getBillDisplayStatus(occ);
            const isSelected = selectedOccurrence?.id === occ.id;
            return (
              <TouchableOpacity
                key={occ.id}
                onPress={() => setSelectedOccurrence(occ)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  marginBottom: 4,
                  backgroundColor: isSelected ? `${d.color}14` : 'transparent',
                  borderWidth: isSelected ? 1 : 0,
                  borderColor: d.color,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: Colors.text, fontWeight: isSelected ? '700' : '500', fontSize: 14 }}>
                    {formatDueDate(occ.due_date)}
                  </Text>
                  {occ.linked_transaction_id ? (
                    <Text style={{ fontSize: 11, color: Colors.muted, marginTop: 2 }}>
                      Linked Tx #{occ.linked_transaction_id}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '700', color: d.color, fontSize: 14 }}>
                    {formatCurrency(occ.amount)}
                  </Text>
                  <Chip
                    compact
                    style={{ marginTop: 4, backgroundColor: `${d.color}22` }}
                    textStyle={{ color: d.color, fontSize: 11 }}
                  >
                    {d.label}
                  </Chip>
                </View>
              </TouchableOpacity>
            );
          })}
        </Card>
      )}

      {/* ── Confirm dialog ── */}
      <ConfirmDialog
        visible={confirmVisible}
        title={confirmAction === 'delete' ? 'Delete Bill' : 'Skip Bill'}
        message={
          confirmAction === 'delete'
            ? `Delete "${bill.name}"? This cannot be undone.`
            : `Skip "${activeBill.name}" for ${formatDueDate(activeBill.due_date)}?`
        }
        onCancel={() => { setConfirmVisible(false); setConfirmAction(null); }}
        onConfirm={async () => {
          if (confirmAction === 'delete') {
            await deleteBill(bill.id);
            navigation.goBack();
          } else if (confirmAction === 'skip') {
            await skipBill(activeBill.id);
            load();
          }
          setConfirmVisible(false);
          setConfirmAction(null);
        }}
      />

      {/* ── Link existing transaction modal ── */}
      <Modal visible={showLinkModal} transparent animationType="slide">
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
            maxHeight: '70%', padding: 16,
          }}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 4, color: Colors.text }}>
              Link to Existing Transaction
            </Text>
            <Text style={{ color: Colors.muted, fontSize: 13, marginBottom: 12 }}>
              Showing transactions filtered by category &amp; due month for "{activeBill?.name}"
            </Text>

            {linkLoading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 30 }} />
            ) : linkCandidates.length === 0 ? (
              <Text style={{ color: Colors.muted, textAlign: 'center', marginVertical: 30 }}>
                No matching transactions found for this period.
              </Text>
            ) : (
              <FlatList
                data={linkCandidates}
                keyExtractor={(t) => String(t.id)}
                renderItem={({ item: tx }) => (
                  <TouchableOpacity
                    onPress={() => handleLinkTransaction(tx)}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: '#EEF1F6',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: Colors.text }}>{tx.notes || '(no notes)'}</Text>
                      <Text style={{ fontSize: 12, color: Colors.muted, marginTop: 2 }}>
                        {tx.date ? new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                        {tx.source_id && sourcesMap[tx.source_id] ? ` · ${sourcesMap[tx.source_id].name}` : ''}
                      </Text>
                    </View>
                    <Text style={{ fontWeight: '800', color: '#E46A6A', marginLeft: 8 }}>
                      {formatCurrency(tx.amount)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <PaperButton
              mode="outlined"
              onPress={() => setShowLinkModal(false)}
              style={{ marginTop: 12 }}
            >
              Cancel
            </PaperButton>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF1F6',
    }}>
      <Text style={{ color: Colors.muted, flex: 1 }}>{label}</Text>
      <Text style={{ color: Colors.text, fontWeight: '600', flex: 1.2, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}