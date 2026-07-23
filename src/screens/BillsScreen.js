import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  TouchableOpacity,
  TextInput
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  getBillsForCurrentMonth, // ← replaces getBills for the main list
  getBills,                  // kept for non-month-filtered use if needed
  getBillsSummary,
  getBillInsights,
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

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: BILL_STATUS.PENDING, label: 'Pending' },
  { key: BILL_STATUS.OVERDUE, label: 'Overdue' },
  { key: BILL_STATUS.PAID, label: 'Paid' },
];

export default function BillsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [insights, setInsights] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [viewMode, setViewMode] = useState('list');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [sortBy, setSortBy] = useState('due_date');
  const [search, setSearch] = useState('');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState('delete');
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  async function load() {
    const [rows, sum, ins, cats] = await Promise.all([
      // Use getBillsForCurrentMonth so recurring bills always show current-month due
      getBillsForCurrentMonth({
        status: statusFilter === 'all' ? null : statusFilter,
        category_id: categoryFilter,
        sortBy,
        sortDir: sortBy === 'amount' ? 'desc' : 'asc',
      }),
      getBillsSummary(),
      getBillInsights(),
      getCategories(true),
    ]);
    setItems(rows);
    setSummary(sum);
    setInsights(ins);
    setCategories(cats.filter(c => c.type === 'expense'));
    const map = {};
    cats.forEach(c => (map[c.id] = c));
    setCategoriesMap(map);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [statusFilter, categoryFilter, sortBy])
  );

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    return items.filter(b =>
      b.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    return categories.filter(c =>
      c.name.toLowerCase().includes(categorySearch.toLowerCase())
    );
  }, [categories, categorySearch]);

  function openDetail(bill) {
    // Navigate with both the occurrence id AND the template id so the detail
    // screen can show the full series list.
    navigation.navigate('BillDetail', {
      billId: bill._templateId || bill.id,
      occurrenceId: bill._isRecurringSeries ? bill.id : undefined,
    });
  }

  function openEdit(bill) {
    // Always edit the template for recurring series
    setEditingBill(bill);
    setShowForm(true);
  }

  async function handleMarkPaid(bill) {
    await markBillPaid(bill.id, { source_id: bill.source_id });
    load();
  }

  function handleSkip(bill) {
    setConfirmTarget(bill);
    setConfirmAction('skip');
    setConfirmMessage(`Skip "${bill.name}" for this period?`);
    setConfirmVisible(true);
  }

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

  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const listHeader = (
    <View>

      <BillSummaryBar summary={summary} />

      {summary?.overdueCount > 0 && (
        <View style={{
          backgroundColor: '#FFF0F0',
          padding: 12,
          borderRadius: 10,
          marginBottom: Spacing.xs
        }}>
          <Text style={{ color: '#E46A6A', fontWeight: '700' }}>
            {summary.overdueCount} overdue — {formatCurrency(summary.overdueAmount)}
          </Text>
        </View>
      )}

      {/* Current month label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <MaterialCommunityIcons name="calendar-month" size={16} color={Colors.muted} />
        <Text style={{ marginLeft: 6, color: Colors.muted, fontSize: 13, fontWeight: '600' }}>
          Showing dues for {monthLabel}
        </Text>
      </View>

      {/* STATUS DROPDOWN */}
      <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowStatusDropdown(true)}>
        <View>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>
            {STATUS_FILTERS.find(f => f.key === statusFilter)?.label}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-down" size={20} color={Colors.muted} />
      </TouchableOpacity>

      {/* CATEGORY DROPDOWN */}
      <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowCategoryDropdown(true)}>
        <View>
          <Text style={styles.label}>Category</Text>
          <Text style={styles.value}>
            {categoryFilter
              ? categories.find(c => c.id === categoryFilter)?.name
              : 'All categories'}
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
        <TouchableOpacity onPress={() => setSortBy('due_date')} style={{ marginRight: 16 }}>
          <Text style={{ color: sortBy === 'due_date' ? Colors.primary : Colors.muted }}>
            Sort: Due date
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSortBy('amount')}>
          <Text style={{ color: sortBy === 'amount' ? Colors.primary : Colors.muted }}>
            Sort: Amount
          </Text>
        </TouchableOpacity>
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
        data={filteredItems}
        keyExtractor={(i) => String(i.id)}
        renderItem={renderBill}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ padding: Spacing.xs, paddingBottom: 100 }}
      />

      {/* STATUS MODAL */}
      <Modal visible={showStatusDropdown} transparent>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowStatusDropdown(false)}>
          <View style={styles.modal}>
            {STATUS_FILTERS.map(f => (
              <TouchableOpacity key={f.key} onPress={() => {
                setStatusFilter(f.key);
                setShowStatusDropdown(false);
              }}>
                <Text style={[styles.item, statusFilter === f.key && styles.selected]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* CATEGORY MODAL WITH SEARCH */}
      <Modal visible={showCategoryDropdown} transparent>
        <TouchableOpacity style={styles.overlay} onPress={() => setShowCategoryDropdown(false)}>
          <View style={styles.modalLarge}>

            <TextInput
              placeholder="Search category..."
              value={categorySearch}
              onChangeText={setCategorySearch}
              style={styles.searchInput}
            />

            <FlatList
              data={[{ id: 'all', name: 'All categories' }, ...filteredCategories]}
              keyExtractor={(i) => i.id.toString()}
              renderItem={({ item }) => {
                const selected = item.id === 'all'
                  ? !categoryFilter
                  : categoryFilter === item.id;

                return (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => {
                      setCategoryFilter(item.id === 'all' ? null : item.id);
                      setShowCategoryDropdown(false);
                      setCategorySearch('');
                    }}
                  >
                    <Text style={[styles.item, selected && styles.selected]}>{item.name}</Text>
                    {selected && <MaterialCommunityIcons name="check" size={18} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <FAB onPress={() => { setEditingBill(null); setShowForm(true); }} />

      <Modal visible={showForm}>
        <BillForm
          bill={editingBill}
          onSaved={() => { setShowForm(false); setEditingBill(null); load(); }}
          onCancel={() => { setShowForm(false); setEditingBill(null); }}
        />
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
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { fontSize: 11, color: Colors.muted },
  value: { fontSize: 14, fontWeight: '700', color: Colors.text },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 10 },
  modalLarge: { backgroundColor: '#fff', borderRadius: 16, padding: 12 },
  item: { padding: 12, fontSize: 14 },
  selected: { color: Colors.primary, fontWeight: '700' },
  searchInput: { borderBottomWidth: 1, borderColor: '#eee', marginBottom: 10, paddingVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
};