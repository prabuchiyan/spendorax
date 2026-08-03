import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, Modal,
  TouchableOpacity, TextInput, ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  TextInput as PaperTextInput,
  Button as PaperButton,
} from 'react-native-paper';
import {
  getBillsForCurrentMonth,
  getBillsSummary,
  getBillById,
  markBillPaid,
  skipBill,
  deleteBill,
} from '../services/bills';
import { getCategories } from '../services/categories';
import BillSummaryBar from '../components/BillSummaryBar';
import SwipeableBillCard from '../components/SwipeableBillCard';
import BillCalendarView from '../components/BillCalendarView';
import BillForm from '../components/BillForm';
import ConfirmDialog from '../components/ConfirmDialog';
import FAB from '../components/FAB';
import { Colors, Spacing } from '../components/Theme';
import { BILL_STATUS, formatCurrency } from '../services/billUtils';
import { getSources } from '../services/sources';
import { getCreditCards, payCreditCardBill } from '../services/creditCards';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: BILL_STATUS.PENDING, label: 'Pending' },
  { key: BILL_STATUS.OVERDUE, label: 'Overdue' },
  { key: BILL_STATUS.PAID, label: 'Paid' },
];

export default function BillsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [viewMode, setViewMode] = useState('list');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [sortBy, setSortBy] = useState('due_date');
  const [search, setSearch] = useState('');
  const [showStatusDD, setShowStatusDD] = useState(false);
  const [showCategoryDD, setShowCategoryDD] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState('delete');
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [showPaymentSourcePicker, setShowPaymentSourcePicker] = useState(false);
  const [paymentSources, setPaymentSources] = useState([]);
  const [paymentSourceSearch, setPaymentSourceSearch] = useState('');
  const [selectedPaymentBill, setSelectedPaymentBill] = useState(null);
  const [selectedCreditCard, setSelectedCreditCard] = useState(null);

  // ── data load ──────────────────────────────────────────────────────────────
  async function load() {
    const [rows, sum, cats] = await Promise.all([
      getBillsForCurrentMonth({
        status: statusFilter === 'all' ? null : statusFilter,
        category_id: categoryFilter,
        sortBy,
        sortDir: sortBy === 'amount' ? 'desc' : 'asc',
      }),
      getBillsSummary(),
      getCategories(true),
    ]);
    setItems(rows);
    setSummary(sum);
    const expCats = cats.filter(c => c.type === 'expense');
    setCategories(expCats);
    const map = {};
    cats.forEach(c => (map[c.id] = c));
    setCategoriesMap(map);
    const sources = await getSources(true);
    setPaymentSources(sources);
  }

  useFocusEffect(useCallback(() => { load(); }, [statusFilter, categoryFilter, sortBy]));

  // ── derived lists ──────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter(b => b.name?.toLowerCase().includes(search.toLowerCase()));
  }, [items, search]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    return categories.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()));
  }, [categories, categorySearch]);

  // ── navigation ─────────────────────────────────────────────────────────────
  // ISSUE 1: navigate to template id so detail page shows the full series.
  function openDetail(bill) {
    navigation.navigate('BillDetail', {
      billId: bill._templateId || bill.id,
      occurrenceId: bill._isRecurringSeries ? bill.id : undefined,
    });
  }

  async function openEdit(bill) {
    // Always load the real template row — never spread occurrence fields onto it.
    const templateId = bill._templateId || bill.id;
    const templateBill = await getBillById(templateId);
    setEditingBill(templateBill || bill);
    setShowForm(true);
  }

  const handleMarkPaid = async (bill) => {
    try {
      // Check whether this bill belongs to a Credit Card
      const cards = await getCreditCards(false);
      const card = cards.find(
        c =>
          Number(c.payment_bill_id) === Number(bill.parent_bill_id || bill.id)
      );
      // Normal bill → existing flow
      if (!card) {
        await markBillPaid(bill.id, {
          source_id: bill.source_id,
        });
        await load();
        return;
      }
      // Credit Card bill → ask user to choose payment source
      const sources = await getSources(true);
      const availableSources = sources.filter(
        s => Number(s.id) !== Number(card.source_id)
      );
      setPaymentSources(availableSources);
      setSelectedPaymentBill(bill);
      setSelectedCreditCard(card);
      setPaymentSourceSearch('');
      setShowPaymentSourcePicker(true);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Unable to mark bill as paid.');
    }
  };

  function handleSkip(bill) {
    setConfirmTarget(bill);
    setConfirmAction('skip');
    setConfirmMessage(`Skip "${bill.name}" for this period?`);
    setConfirmVisible(true);
  }

  // ── render ─────────────────────────────────────────────────────────────────
  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const renderBill = ({ item }) => (
    <SwipeableBillCard
      bill={item}
      category={categoriesMap[item.category_id]}
      onPress={openDetail}
      onMarkPaid={handleMarkPaid}
      onSkip={handleSkip}
      onEdit={openEdit}
    />
  );

  const listHeader = (
    <View>
      <BillSummaryBar summary={summary} />

      {summary?.overdueCount > 0 && (
        <View style={{
          backgroundColor: '#FFF0F0', padding: 12, borderRadius: 10, marginBottom: Spacing.xs,
        }}>
          <Text style={{ color: '#E46A6A', fontWeight: '700' }}>
            {summary.overdueCount} overdue — {formatCurrency(summary.overdueAmount)}
          </Text>
        </View>
      )}

      {/* Current-month label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <MaterialCommunityIcons name="calendar-month" size={15} color={Colors.muted} />
        <Text style={{ marginLeft: 5, color: Colors.muted, fontSize: 13, fontWeight: '600' }}>
          Due this month · {monthLabel}
        </Text>
      </View>

      {/* View-mode toggle */}
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {['list', 'calendar'].map(mode => (
          <TouchableOpacity
            key={mode}
            onPress={() => setViewMode(mode)}
            style={{
              flexDirection: 'row', alignItems: 'center',
              marginRight: 12, paddingBottom: 4,
              borderBottomWidth: 2,
              borderBottomColor: viewMode === mode ? Colors.primary : 'transparent',
            }}
          >
            <MaterialCommunityIcons
              name={mode === 'list' ? 'format-list-bulleted' : 'calendar-month-outline'}
              size={16}
              color={viewMode === mode ? Colors.primary : Colors.muted}
            />
            <Text style={{
              marginLeft: 4, fontSize: 13, fontWeight: '600',
              color: viewMode === mode ? Colors.primary : Colors.muted,
            }}>
              {mode === 'list' ? 'List' : 'Calendar'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status dropdown */}
      <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowStatusDD(true)}>
        <View>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{STATUS_FILTERS.find(f => f.key === statusFilter)?.label}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-down" size={20} color={Colors.muted} />
      </TouchableOpacity>

      {/* Category dropdown */}
      <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowCategoryDD(true)}>
        <View>
          <Text style={styles.label}>Category</Text>
          <Text style={styles.value}>
            {categoryFilter ? categories.find(c => c.id === categoryFilter)?.name : 'All categories'}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-down" size={20} color={Colors.muted} />
      </TouchableOpacity>

      <Searchbar
        placeholder="Search bills"
        value={search}
        onChangeText={setSearch}
        style={{ marginBottom: Spacing.xs }}
      />

      <View style={{ flexDirection: 'row', marginBottom: Spacing.xs }}>
        {[['due_date', 'Due date'], ['amount', 'Amount']].map(([key, label]) => (
          <TouchableOpacity key={key} onPress={() => setSortBy(key)} style={{ marginRight: 16 }}>
            <Text style={{ color: sortBy === key ? Colors.primary : Colors.muted, fontWeight: '600', fontSize: 13 }}>
              Sort: {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'calendar' && (
        <BillCalendarView
          bills={filteredItems}
          month={calMonth}
          year={calYear}
          onSelectBill={openDetail}
          onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m); }}
        />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <FlatList
        data={viewMode === 'list' ? filteredItems : []}
        keyExtractor={i => String(i.id)}
        renderItem={renderBill}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ padding: Spacing.xs, paddingBottom: 100 }}
        ListEmptyComponent={
          viewMode === 'list' ? (
            <View style={{ alignItems: 'center', paddingTop: 32 }}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={48} color="#ccc" />
              <Text style={{ color: Colors.muted, marginTop: 10 }}>No bills this month</Text>
            </View>
          ) : null
        }
      />

      {/* Status modal */}
      <Modal visible={showStatusDD} transparent>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowStatusDD(false)}>
          <View style={styles.modal}>
            {STATUS_FILTERS.map(f => (
              <TouchableOpacity key={f.key} onPress={() => { setStatusFilter(f.key); setShowStatusDD(false); }}>
                <Text style={[styles.item, statusFilter === f.key && styles.selected]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Category modal */}
      <Modal visible={showCategoryDD} transparent>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowCategoryDD(false)}>
          <View style={styles.modalLarge}>
            <TextInput
              placeholder="Search category..."
              value={categorySearch}
              onChangeText={setCategorySearch}
              style={styles.searchInput}
            />
            <FlatList
              data={[{ id: 'all', name: 'All categories' }, ...filteredCategories]}
              keyExtractor={i => String(i.id)}
              renderItem={({ item }) => {
                const sel = item.id === 'all' ? !categoryFilter : categoryFilter === item.id;
                return (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => {
                      setCategoryFilter(item.id === 'all' ? null : item.id);
                      setShowCategoryDD(false);
                      setCategorySearch('');
                    }}
                  >
                    <Text style={[styles.item, sel && styles.selected]}>{item.name}</Text>
                    {sel && <MaterialCommunityIcons name="check" size={18} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <FAB onPress={() => { setEditingBill(null); setShowForm(true); }} />

      {/* Add / edit form */}
      <Modal visible={showForm}>
        <BillForm
          bill={editingBill}
          onSaved={() => { setShowForm(false); setEditingBill(null); load(); }}
          onCancel={() => { setShowForm(false); setEditingBill(null); }}
        />
      </Modal>

      <Modal
        visible={showPaymentSourcePicker}
        transparent
        animationType="slide"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              maxHeight: '55%',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
            }}
          >

            <Text
              style={{
                fontWeight: '700',
                fontSize: 16,
                marginBottom: 12,
              }}
            >
              Select Payment Source
            </Text>

            <PaperTextInput
              placeholder="Search source..."
              value={paymentSourceSearch}
              onChangeText={setPaymentSourceSearch}
              mode="outlined"
              style={{ marginBottom: 10 }}
            />

            <ScrollView>

              {paymentSources
                .filter(s =>
                  s.name
                    .toLowerCase()
                    .includes(paymentSourceSearch.toLowerCase())
                )
                .map(source => (

                  <TouchableOpacity
                    key={source.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                    }}
                    onPress={async () => {
                      try {
                        await payCreditCardBill({
                          bill: selectedPaymentBill,
                          card: selectedCreditCard,
                          paymentSourceId: source.id,
                        });
                        await markBillPaid(
                          selectedPaymentBill.id,
                          {
                            createTransaction: false,
                          }
                        );
                        setShowPaymentSourcePicker(false);
                        setSelectedPaymentBill(null);
                        setSelectedCreditCard(null);
                        await load();
                      } catch (e) {
                        console.error(e);
                        Alert.alert(
                          'Error',
                          'Unable to complete payment.'
                        );
                      }

                    }}
                  >

                    <MaterialCommunityIcons
                      name={source.icon || 'wallet'}
                      size={22}
                      color={Colors.primary}
                    />

                    <Text
                      style={{
                        marginLeft: 10,
                        flex: 1,
                      }}
                    >
                      {source.name}
                    </Text>

                  </TouchableOpacity>

                ))}

            </ScrollView>

            <PaperButton
              onPress={() => {

                setShowPaymentSourcePicker(false);

                setSelectedPaymentBill(null);

                setSelectedCreditCard(null);

              }}
            >
              Cancel
            </PaperButton>

          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirmVisible}
        message={confirmMessage}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={async () => {
          if (confirmTarget) {
            if (confirmAction === 'delete') await deleteBill(confirmTarget.id);
            else await skipBill(confirmTarget.id);
            load();
          }
          setConfirmVisible(false);
        }}
      />
    </View>
  );
}

const styles = {
  dropdownTrigger: {
    backgroundColor: Colors.card, padding: 14, borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#eee', flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  label: { fontSize: 11, color: Colors.muted },
  value: { fontSize: 14, fontWeight: '700', color: Colors.text },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 10 },
  modalLarge: { backgroundColor: '#fff', borderRadius: 16, padding: 12, maxHeight: '70%' },
  item: { padding: 12, fontSize: 14 },
  selected: { color: Colors.primary, fontWeight: '700' },
  searchInput: { borderBottomWidth: 1, borderColor: '#eee', marginBottom: 10, paddingVertical: 6, paddingHorizontal: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
};