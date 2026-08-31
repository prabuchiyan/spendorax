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
  getBillSeries,
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

// Add this helper near the top of the component
function isCreditCardBill(bill) {
  return (
    typeof bill.notes === 'string' &&
    bill.notes.startsWith('Recurring payment template for')
  ) || (
      typeof bill.notes === 'string' &&
      bill.notes.startsWith('Statement ')
    );
}

function getPreferredBillOccurrence(bill, allBills) {
  if (
    !bill.is_recurring &&
    !bill._isRecurringSeries
  ) {
    return bill;
  }
  const templateId = Number(
    bill._templateId ||
    bill.parent_bill_id ||
    bill.id
  );
  if (!templateId) {
    return bill;
  }
  const today = new Date();
  const todayString = today.toISOString().slice(0, 10);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const occurrences = allBills
    .filter(row => {
      const rowTemplateId = Number(
        row.parent_bill_id ||
        row._templateId ||
        row.id
      );
      return (
        rowTemplateId === templateId &&
        !row.deleted_at
      );
    })
    // IMPORTANT:
    // Occurrences without a due date are not
    // considered when determining the preferred due.
    .filter(row => Boolean(row.due_date))
    .sort((a, b) =>
      (b.due_date || '').localeCompare(
        a.due_date || ''
      )
    );

  if (!occurrences.length) {
    return {
      ...bill,
      // Explicitly tell the card that there is
      // no actual due date.
      due_date: null,
      _noDueDate: true,
    };
  }

  // 1. CURRENT MONTH
  const currentMonthBill =
    occurrences.find(row =>
      row.due_date.startsWith(
        currentMonthPrefix
      )
    );

  if (currentMonthBill) {
    // Current month is still unpaid.
    if (
      currentMonthBill.status !== 'paid' &&
      currentMonthBill.status !== 'skipped'
    ) {
      return currentMonthBill;
    }

    // Current month is paid.
    // Find latest previous pending/overdue.
    const previousPending =
      occurrences.find(row => {
        return (
          row.due_date <
          currentMonthBill.due_date &&
          row.status !== 'paid' &&
          row.status !== 'skipped'
        );
      });

    if (previousPending) {
      return previousPending;
    }

    // No previous pending.
    // Find nearest upcoming.
    const upcoming =
      occurrences
        .filter(row =>
          row.due_date >
          currentMonthBill.due_date
        )
        .sort((a, b) =>
          a.due_date.localeCompare(
            b.due_date
          )
        )[0];
    return upcoming || currentMonthBill;
  }

  // 2. NO CURRENT-MONTH DUE
  const previousPending =
    occurrences.find(row => {
      return (
        row.due_date <= todayString &&
        row.status !== 'paid' &&
        row.status !== 'skipped'
      );
    });

  if (previousPending) {
    return previousPending;
  }

  // 3. NO PREVIOUS PENDING
  // Find nearest future due.
  const upcoming =
    occurrences
      .filter(row =>
        row.due_date > todayString
      )
      .sort((a, b) =>
        a.due_date.localeCompare(
          b.due_date
        )
      )[0];

  if (upcoming) {
    return upcoming;
  }

  // 4. NOTHING TO DISPLAY
  return {
    ...bill,
    due_date: null,
    _noDueDate: true,
  };
}

export default function BillsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [preferredOccurrences, setPreferredOccurrences] = useState({});
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
  const [expandedCreditCards, setExpandedCreditCards] = useState({});

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
    const preferredMap = {};
    await Promise.all(
      rows.map(async bill => {
        if (
          !bill.is_recurring &&
          !bill._isRecurringSeries
        ) {
          return;
        }

        // Do not interfere with credit-card statements.
        if (bill._isCreditCardStatement) {
          return;
        }
        try {
          const templateId =
            bill._templateId ||
            bill.parent_bill_id ||
            bill.id;

          const series =
            await getBillSeries(templateId);

          preferredMap[
            String(templateId)
          ] = getPreferredBillOccurrence(
            bill,
            series
          );
        } catch (e) {
          console.warn(
            'Preferred bill occurrence error:',
            templateId,
            e
          );
        }
      })
    );
    setPreferredOccurrences(preferredMap);
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
    const query = search.trim().toLowerCase();
    const displayItems = items.map(bill => {
      const templateId = bill._templateId || bill.parent_bill_id || bill.id;
      const preferred = preferredOccurrences[String(templateId)];
      if (
        preferred &&
        !bill._isCreditCardParent &&
        !bill._isCreditCardStatement
      ) {
        return {
          ...bill,
          // DISPLAY THE SELECTED/PREFERRED OCCURRENCE
          due_date: preferred.due_date,
          status: preferred.status,
          amount: preferred.amount,
          // Preserve the no-due-date state from the preferred
          // occurrence. Without this, BillCard cannot know that there is no due date.
          _noDueDate: preferred._noDueDate === true,
          // Preserve the actual template identity.
          _templateId: bill._templateId || templateId,
          _displayOccurrenceId: preferred.id,
          _displayOccurrence: preferred,
        };
      }
      return bill;
    });

    const sourceItems = query
      ? displayItems.filter(b =>
        b.name?.toLowerCase().includes(query)
      )
      : displayItems;
    const groups = new Map();
    const normalBills = [];
    sourceItems.forEach(bill => {
      const parentId = Number(bill.parent_bill_id || 0);
      const isStatement = bill._isCreditCardStatement === true ||
        (
          typeof bill.notes === 'string' &&
          bill.notes.startsWith('Statement ')
        );
      if (isStatement && parentId > 0) {
        if (!groups.has(parentId)) {
          groups.set(parentId, []);
        }
        groups.get(parentId).push(bill);
      } else {
        normalBills.push(bill);
      }
    });

    // BUILD ONE PARENT BILL FOR EACH CREDIT CARD
    const groupedCreditCards = [];
    groups.forEach((statements, parentId) => {
      if (!statements.length) {
        return;
      }
      // Sort statements by statement date / due date.
      statements.sort((a, b) => {
        const ad = a.statement_date || a.due_date || '9999-12-31';
        const bd = b.statement_date || b.due_date || '9999-12-31';
        return ad.localeCompare(bd);
      });
      // Parent amount = sum of all statements
      const totalAmount = statements.reduce((sum, statement) => sum + Number(statement.amount || 0), 0);
      // Use the latest statement for the parent card's status/due-date display.
      const latestStatement = statements[statements.length - 1];

      groupedCreditCards.push({
        ...latestStatement,
        // IMPORTANT: this is the GROUP/PARENT ID.
        id: `cc-${parentId}`,
        parent_bill_id: parentId,
        name: latestStatement.name || 'Credit Card',
        amount: totalAmount,
        // Children = actual generated statement bills
        children: statements,
        _isCreditCardParent: true,
        _isCreditCardStatement: false,
        _isRecurringSeries: false,
        _templateId: parentId,
        // Number of generated statements.
        _statementCount: statements.length,
      });
    });
    // RETURN NORMAL BILLS + CREDIT CARD PARENTS
    return [
      ...normalBills,
      ...groupedCreditCards,
    ];
  }, [items, search, preferredOccurrences]);

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
      // FIND CREDIT CARD
      const cards = await getCreditCards(false);
      const parentBillId =
        Number(bill.parent_bill_id || bill._templateId || bill.id);
      const card = cards.find(c => Number(c.payment_bill_id) === parentBillId);
      // NORMAL BILL
      if (!card) {
        await markBillPaid(
          bill.id,
          {
            source_id:
              bill.source_id,
          }
        );
        await load();
        return;
      }
      // CREDIT CARD BILL
      // Do NOT change the statement amount here.
      // We only open the payment-source picker.
      // The actual statement bill remains unchanged until the payment is explicitly recorded.
      const sources = await getSources(true);
      const availableSources = sources.filter(s => Number(s.id) !== Number(card.source_id));
      setPaymentSources(availableSources);
      // Keep the actual bill that initiated  the payment action.
      setSelectedPaymentBill(bill);
      setSelectedCreditCard(card);
      setPaymentSourceSearch('');
      setShowPaymentSourcePicker(true);
    } catch (e) {
      console.error('handleMarkPaid error:', e);
      Alert.alert('Error', 'Unable to mark bill as paid.');
    }
  };

  function handleSkip(bill) {
    setConfirmTarget(bill);
    setConfirmAction('skip');
    setConfirmMessage(`Skip "${bill.name}" for this period?`);
    setConfirmVisible(true);
  }

  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const renderBill = ({ item }) => {
    // CREDIT CARD PARENT
    if (item._isCreditCardParent) {
      const parentKey = String(
        item.parent_bill_id ||
        item._templateId ||
        item.id
      );
      const isExpanded = expandedCreditCards[parentKey] === true;
      const toggleStatements = () => {
        setExpandedCreditCards(prev => ({
          ...prev,
          [parentKey]:
            !prev[parentKey],
        }));
      };
      return (
        <View
          style={{
            marginBottom: 8,
          }}
        >
          {/* PARENT CREDIT CARD BILL */}
          <SwipeableBillCard
            bill={item}
            category={
              categoriesMap[item.category_id]
            }
            onPress={() => {
              if (
                item.children &&
                item.children.length > 0
              ) {
                openDetail(
                  item.children[0]
                );
              } else {
                openDetail(item);
              }
            }}
            onMarkPaid={() => {
              handleMarkPaid(item);
            }}
            onSkip={null}
            onEdit={null}
            showExpandButton={true}
            expanded={isExpanded}
            onToggleExpand={
              toggleStatements
            }
          />

          {/* STATEMENT CHILDREN */}
          {isExpanded &&
            item.children &&
            item.children.length > 0 && (
              <View
                style={{
                  marginLeft: 22,
                  marginTop: -2,
                  marginBottom: 4,
                  borderLeftWidth: 2,
                  borderLeftColor: '#DCEBE2',
                  paddingLeft: 12,
                  paddingTop: 4,
                }}
              >
                {item.children.map(
                  (statement, index) => (
                    <View
                      key={String(
                        statement.id
                      )}
                      style={{
                        backgroundColor: '#F8FBF9',
                        borderRadius: 12,
                        padding: 10,
                        marginBottom: index === item.children.length - 1 ? 0 : 7,
                        borderWidth: 1,
                        borderColor: '#E5F1EB',
                      }}
                    >
                      {/* STATEMENT HEADER */}
                      <View
                        style={{
                          flexDirection:
                            'row',
                          alignItems:
                            'center',
                        }}
                      >
                        <View
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 10,
                            backgroundColor: '#EAF5EF',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MaterialCommunityIcons
                            name="credit-card-outline"
                            size={17}
                            color="#3F8F6B"
                          />
                        </View>
                        <View
                          style={{
                            flex: 1,
                            marginLeft: 9,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '800',
                              color: '#25352D',
                            }}
                          >
                            Statement
                          </Text>
                          <Text
                            style={{
                              fontSize: 10,
                              color: '#718078',
                              marginTop: 2,
                            }}
                          >
                            {statement.statement_date || statement.due_date || '-'}
                          </Text>
                        </View>

                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: '#25352D',
                          }}
                        >
                          {formatCurrency(Number(statement.amount || 0))}
                        </Text>
                      </View>

                      {/* STATEMENT FOOTER  */}
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: 8,
                          paddingTop: 7,
                          borderTopWidth: 1,
                          borderTopColor: '#E5F1EB',
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                        >
                          <MaterialCommunityIcons
                            name="calendar-clock-outline"
                            size={14}
                            color="#8A958F"
                          />

                          <Text
                            style={{
                              fontSize: 9,
                              color: '#8A958F',
                              marginLeft: 4,
                            }}
                          >
                            Due{' '}{statement.due_date || '-'}
                          </Text>
                        </View>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() =>
                            openDetail(
                              statement
                            )
                          }
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 7,
                            backgroundColor: '#EAF5EF',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: '800',
                              color: '#3F8F6B',
                            }}
                          >
                            View
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )
                )}
              </View>
            )}
        </View>
      );
    }

    // NORMAL BILL
    return (
      <SwipeableBillCard
        bill={item}
        category={
          categoriesMap[item.category_id]
        }
        onPress={openDetail}
        onMarkPaid={handleMarkPaid}
        onSkip={handleSkip}
        onEdit={
          isCreditCardBill(item)
            ? null
            : openEdit
        }
      />
    );
  };
  const listHeader = (
    <View>
      {/* SUMMARY */}
      <View style={{ marginBottom: 12 }}>
        <BillSummaryBar summary={summary} />
      </View>
      {/* STATUS FILTERS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingRight: 8,
          marginBottom: 12,
        }}
      >
        {STATUS_FILTERS.map(filter => {
          const active = statusFilter === filter.key;
          const statusColor =
            filter.key === BILL_STATUS.OVERDUE
              ? '#E46A6A'
              : filter.key === BILL_STATUS.PAID
                ? '#3F8F6B'
                : filter.key === BILL_STATUS.PENDING
                  ? '#FFB020'
                  : '#2F7355';
          return (
            <TouchableOpacity
              key={filter.key}
              activeOpacity={0.8}
              onPress={() =>
                setStatusFilter(filter.key)
              }
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 13,
                paddingVertical: 8,
                borderRadius: 20,
                marginRight: 7,
                backgroundColor: active ? '#EAF5EF' : '#FFFFFF',
                borderWidth: 1,
                borderColor: active ? '#CFE6D9' : '#E6EEE9',
              }}
            >
              {filter.key !== 'all' && (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: statusColor,
                    marginRight: 6,
                  }}
                />
              )}
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: active ? '800' : '600',
                  color: active ? '#2F7355' : '#718078',
                }}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* SEARCH + FILTER */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E5F1EB',
            height: 46,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
          }}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color="#8A958F"
          />

          <TextInput
            placeholder="Search bills"
            placeholderTextColor="#A0AAA4"
            value={search}
            onChangeText={setSearch}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 13,
              color: '#25352D',
            }}
          />

          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color="#A0AAA4"
              />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowCategoryDD(true)}
          style={{
            width: 46,
            height: 46,
            marginLeft: 8,
            borderRadius: 14,
            backgroundColor: categoryFilter ? '#EAF5EF' : '#FFFFFF',
            borderWidth: 1,
            borderColor: categoryFilter ? '#CFE6D9' : '#E5F1EB',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={20}
            color={
              categoryFilter
                ? '#3F8F6B'
                : '#718078'
            }
          />
        </TouchableOpacity>
      </View>

      {/* SORT + MONTH */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <MaterialCommunityIcons
            name="calendar-month-outline"
            size={15}
            color="#718078"
          />

          <Text
            style={{
              marginLeft: 5,
              color: '#718078',
              fontSize: 11,
              fontWeight: '700',
            }}
          >
            {monthLabel}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <MaterialCommunityIcons
            name="sort"
            size={15}
            color="#718078"
          />
          {[
            ['due_date', 'Due'],
            ['amount', 'Amount'],
          ].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setSortBy(key)}
              style={{
                marginLeft: 10,
                paddingHorizontal: 8,
                paddingVertical: 5,
                borderRadius: 8,
                backgroundColor:
                  sortBy === key
                    ? '#EAF5EF'
                    : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '800',
                  color:
                    sortBy === key
                      ? '#3F8F6B'
                      : '#718078',
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* LIST / CALENDAR */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#EAF5EF',
          borderRadius: 12,
          padding: 3,
          marginBottom: 12,
        }}
      >
        {[
          ['list', 'format-list-bulleted', 'List'],
          ['calendar', 'calendar-month-outline', 'Calendar'],
        ].map(([mode, icon, label]) => {
          const active = viewMode === mode;

          return (
            <TouchableOpacity
              key={mode}
              onPress={() => setViewMode(mode)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 8,
                borderRadius: 9,
                backgroundColor: active
                  ? '#FFFFFF'
                  : 'transparent',
              }}
            >
              <MaterialCommunityIcons
                name={icon}
                size={15}
                color={
                  active
                    ? '#3F8F6B'
                    : '#718078'
                }
              />
              <Text
                style={{
                  marginLeft: 5,
                  fontSize: 11,
                  fontWeight: '800',
                  color: active
                    ? '#3F8F6B'
                    : '#718078',
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {summary?.overdueCount > 0 && (
        <TouchableOpacity
          activeOpacity={0.85}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFF5F5',
            borderRadius: 13,
            borderWidth: 1,
            borderColor: '#F5DCDC',
            paddingHorizontal: 11,
            paddingVertical: 9,
            marginBottom: 10,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 10,
              backgroundColor: '#FFE5E5',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialCommunityIcons
              name="alert-outline"
              size={17}
              color="#E46A6A"
            />
          </View>
          <View
            style={{
              flex: 1,
              marginLeft: 9,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                color: '#A85E5E',
              }}
            >
              Payment attention needed
            </Text>

            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: '#9A7777',
                marginTop: 2,
              }}
            >
              {summary.overdueCount} overdue ·{' '}
              {formatCurrency(
                summary.overdueAmount
              )}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color="#D98A8A"
          />
        </TouchableOpacity>
      )}

      {viewMode === 'calendar' && (
        <BillCalendarView
          bills={filteredItems}
          month={calMonth}
          year={calYear}
          onSelectBill={openDetail}
          onMonthChange={(y, m) => {
            setCalYear(y);
            setCalMonth(m);
          }}
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
                        const paymentId = await payCreditCardBill({
                          bill: selectedPaymentBill,
                          card: selectedCreditCard,
                          paymentSourceId: source.id,
                        });
                        await markBillPaid(
                          selectedPaymentBill.id,
                          {
                            createTransaction: false,
                            existingTransactionId: paymentId,
                          }
                        );
                        setShowPaymentSourcePicker(false);
                        setSelectedPaymentBill(null);
                        setSelectedCreditCard(null);
                        await load();
                      } catch (e) {
                        console.error(e);
                        Alert.alert('Error', 'Unable to complete payment.');
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