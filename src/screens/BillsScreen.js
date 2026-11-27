import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  StyleSheet,
  InteractionManager,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import {
  getBillsForCurrentMonth,
  getBillsSummary,
  getBillById,
  getBillSeriesMultiple,
  markBillPaid,
  skipBill,
  deleteBill,
  softDeleteBillOccurrence,
} from '../services/bills';
import { getCategories } from '../services/categories';
import { BILL_STATUS, formatDueDate, getPreferredBillOccurrence } from '../services/billUtils';
import BillSummaryBar from '../components/BillSummaryBar';
import BillCard from '../components/BillCard';
import BillCalendarView from '../components/BillCalendarView';
import BillForm from '../components/BillForm';
import SkipBillModal from '../components/SkipBillModal';
import DeleteBillModal from '../components/DeleteBillModal';
import ResponsiveBottomSheet from '../components/ResponsiveBottomSheet';
import ContextualFAB from '../components/ContextualFAB';
import CurrencyText from '../components/CurrencyText';
import { useTheme } from '../context/ThemeContext';
import { getSources } from '../services/sources';
import { payCreditCardBill, resolveCreditCardForBill } from '../services/creditCards';
import { setBillsSummary } from '../redux/slices/billSlice';
import { setCategoriesMap } from '../redux/slices/categorySlice';
import {
  useBillsSummary,
  useCategoriesMap,
  useAppDispatch,
} from '../redux/hooks';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: BILL_STATUS.PENDING, label: 'Pending' },
  { key: BILL_STATUS.OVERDUE, label: 'Overdue' },
  { key: BILL_STATUS.PAID, label: 'Paid' },
];

const SORT_MODES = [
  { key: 'due_date', label: 'Due Date', icon: 'calendar-clock-outline' },
  { key: 'amount', label: 'Highest Amount', icon: 'sort-descending' },
];

function isCreditCardBill(bill) {
  return (
    (typeof bill?.notes === 'string' &&
      bill.notes.startsWith('Recurring payment template for')) ||
    (typeof bill?.notes === 'string' && bill.notes.startsWith('Statement '))
  );
}

export default function BillsScreen({ navigation }) {
  const dispatch = useAppDispatch();
  const { isDarkMode, theme } = useTheme();

  const reduxSummary = useBillsSummary();
  const categoriesMap = useCategoriesMap();
  const summary = reduxSummary || {};

  const [items, setItems] = useState([]);
  const [preferredOccurrences, setPreferredOccurrences] = useState({});
  const [categories, setCategories] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [sortBy, setSortBy] = useState('due_date');
  const [search, setSearch] = useState('');

  const [showCategoryDD, setShowCategoryDD] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [actionSheetBill, setActionSheetBill] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [skipModalVisible, setSkipModalVisible] = useState(false);
  const [skipTarget, setSkipTarget] = useState(null);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [showPaymentSourcePicker, setShowPaymentSourcePicker] = useState(false);
  const [paymentSources, setPaymentSources] = useState([]);
  const [paymentSourceSearch, setPaymentSourceSearch] = useState('');
  const [selectedPaymentBill, setSelectedPaymentBill] = useState(null);
  const [selectedCreditCard, setSelectedCreditCard] = useState(null);

  const scrollRef = useRef(null);

  const palette = useMemo(() => {
    const primary = theme?.primary || '#4B7CF3';
    if (isDarkMode) {
      return {
        bg: theme?.bg || '#0B0F17',
        cardBg: theme?.cardBg || '#182234',
        cardBorder: theme?.cardBorder || '#334155',
        surfaceSubtle: '#1E293B',
        inputBg: '#131C2E',
        textPrimary: theme?.textPrimary || '#F3F4F6',
        textSecondary: theme?.textSecondary || '#9CA3AF',
        textMuted: '#64748B',
        divider: '#253248',
        primary,
        primarySoft: 'rgba(75, 124, 243, 0.16)',
        primaryBorder: 'rgba(96, 165, 250, 0.35)',
        primaryText: '#93C5FD',
        positive: '#34D399',
        positiveBg: 'rgba(16, 185, 129, 0.14)',
        positiveBorder: 'rgba(52, 211, 153, 0.28)',
        warning: '#FBBF24',
        warningBg: 'rgba(245, 158, 11, 0.14)',
        negative: '#F87171',
        negativeBg: 'rgba(239, 68, 68, 0.14)',
        negativeBorder: 'rgba(248, 113, 113, 0.30)',
        editBg: 'rgba(59, 130, 246, 0.15)',
        editBorder: 'rgba(96, 165, 250, 0.28)',
        editIcon: '#60A5FA',
        deleteBg: 'rgba(239, 68, 68, 0.14)',
        deleteBorder: 'rgba(248, 113, 113, 0.28)',
        deleteIcon: '#F87171',
        badgeBg: '#1E293B',
        badgeText: '#CBD5E1',
      };
    }

    return {
      bg: theme?.bg || '#F8F9FF',
      cardBg: theme?.cardBg || '#FFFFFF',
      cardBorder: theme?.cardBorder || '#E2E8F0',
      surfaceSubtle: '#F1F5F9',
      inputBg: '#FFFFFF',
      textPrimary: theme?.textPrimary || '#0B1C30',
      textSecondary: theme?.textSecondary || '#64748B',
      textMuted: '#94A3B8',
      divider: '#F1F5F9',
      primary,
      primarySoft: '#EFF4FF',
      primaryBorder: '#BFDBFE',
      primaryText: '#2563EB',
      positive: '#059669',
      positiveBg: '#ECFDF5',
      positiveBorder: '#A7F3D0',
      warning: '#D97706',
      warningBg: '#FFFBEB',
      negative: '#DC2626',
      negativeBg: '#FEF2F2',
      negativeBorder: '#FECACA',
      editBg: '#EFF6FF',
      editBorder: '#DBEAFE',
      editIcon: '#2563EB',
      deleteBg: '#FEF2F2',
      deleteBorder: '#FEE2E2',
      deleteIcon: '#EF4444',
      badgeBg: '#E2E8F0',
      badgeText: '#475569',
    };
  }, [isDarkMode, theme]);

  const load = useCallback(async () => {
    try {
      const [rows, sum, cats, sources] = await Promise.all([
        getBillsForCurrentMonth({
          status: statusFilter === 'all' ? null : statusFilter,
          category_id: categoryFilter,
          sortBy,
          sortDir: sortBy === 'amount' ? 'desc' : 'asc',
        }),
        getBillsSummary(),
        getCategories(true),
        getSources(true),
      ]);

      setItems(rows || []);
      const preferredMap = {};
      const templateIdsToFetch = Array.from(
        new Set(
          (rows || [])
            .filter(
              (bill) =>
                (bill.is_recurring || bill._isRecurringSeries) &&
                !bill._isCreditCardStatement
            )
            .map((bill) => bill._templateId || bill.parent_bill_id || bill.id)
        )
      );

      if (templateIdsToFetch.length > 0) {
        try {
          const seriesMap = await getBillSeriesMultiple(templateIdsToFetch);
          (rows || []).forEach((bill) => {
            if (!bill.is_recurring && !bill._isRecurringSeries) return;
            if (bill._isCreditCardStatement) return;

            const templateId = bill._templateId || bill.parent_bill_id || bill.id;
            if (seriesMap[templateId]) {
              preferredMap[String(templateId)] = getPreferredBillOccurrence(
                bill,
                seriesMap[templateId]
              );
            }
          });
        } catch (e) {
          console.warn('Preferred bill occurrence batch error:', e);
        }
      }

      setPreferredOccurrences(preferredMap);
      dispatch(setBillsSummary(sum));

      const safeCats = Array.isArray(cats) ? cats : [];
      setCategories(safeCats.filter((c) => c.type === 'expense'));
      const cmap = {};
      safeCats.forEach((c) => {
        cmap[c.id] = c;
      });
      dispatch(setCategoriesMap(cmap));
      setPaymentSources(sources || []);
    } catch (e) {
      console.warn('BillsScreen load error:', e);
    }
  }, [dispatch, statusFilter, categoryFilter, sortBy]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      InteractionManager.runAfterInteractions(() => {
        if (active) {
          load();
        }
      });
      return () => {
        active = false;
      };
    }, [load])
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const displayItems = items.map((bill) => {
      const templateId = bill._templateId || bill.parent_bill_id || bill.id;
      const preferred = preferredOccurrences[String(templateId)];
      if (
        preferred &&
        !bill._isCreditCardParent &&
        !bill._isCreditCardStatement
      ) {
        return {
          ...bill,
          ...preferred,
          _noDueDate: preferred._noDueDate === true || !preferred.due_date,
          _templateId: bill._templateId || templateId,
          _displayOccurrenceId: preferred.id,
          _displayOccurrence: preferred,
          _isRecurringSeries: true,
        };
      }
      return bill;
    });

    const sourceItems = query
      ? displayItems.filter((bill) => bill.name?.toLowerCase().includes(query))
      : displayItems;

    const groups = new Map();
    const normalBills = [];
    sourceItems.forEach((bill) => {
      const parentId = Number(bill.parent_bill_id || 0);
      const isStatement =
        bill._isCreditCardStatement === true ||
        (typeof bill.notes === 'string' && bill.notes.startsWith('Statement '));

      if (isStatement && parentId > 0) {
        if (!groups.has(parentId)) {
          groups.set(parentId, []);
        }
        groups.get(parentId).push(bill);
      } else {
        normalBills.push(bill);
      }
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const groupedCreditCards = [];

    groups.forEach((statements, parentId) => {
      if (!statements.length) return;
      statements.sort((a, b) => {
        const ad = a.due_date || a.statement_date || '9999-12-31';
        const bd = b.due_date || b.statement_date || '9999-12-31';
        return ad.localeCompare(bd);
      });

      const currentMonthStatements = statements.filter((s) =>
        (s.due_date || '').startsWith(currentMonthPrefix)
      );

      let displayStatements = [];
      const todayString = now.toISOString().slice(0, 10);
      if (currentMonthStatements.length > 0) {
        displayStatements = currentMonthStatements;
      } else {
        const previousStatements = statements
          .filter((s) => s.due_date && s.due_date <= todayString)
          .sort((a, b) => (b.due_date || '').localeCompare(a.due_date || ''));
        if (previousStatements.length > 0) {
          displayStatements = [previousStatements[0]];
        } else {
          const upcomingStatements = statements
            .filter((s) => s.due_date && s.due_date > todayString)
            .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
          if (upcomingStatements.length > 0) {
            displayStatements = [upcomingStatements[0]];
          }
        }
      }

      if (!displayStatements.length) return;

      const totalAmount = displayStatements.reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const latestDisplayStatement = displayStatements[displayStatements.length - 1];
      const allStatementsPaid = displayStatements.every(
        (s) =>
          s.status === BILL_STATUS.PAID ||
          Number(s.is_paid) === 1 ||
          Boolean(s.is_completely_paid)
      );
      const anyStatementOverdue = displayStatements.some(
        (s) =>
          s.status !== BILL_STATUS.PAID &&
          Number(s.is_paid) !== 1 &&
          (s.status === BILL_STATUS.OVERDUE ||
            (s.due_date && s.due_date.slice(0, 10) < todayString))
      );
      const ccStatus = allStatementsPaid
        ? BILL_STATUS.PAID
        : anyStatementOverdue
          ? BILL_STATUS.OVERDUE
          : BILL_STATUS.PENDING;

      groupedCreditCards.push({
        ...latestDisplayStatement,
        id: `cc-${parentId}`,
        parent_bill_id: parentId,
        name: latestDisplayStatement.name || 'Credit Card',
        status: ccStatus,
        is_paid: allStatementsPaid ? 1 : 0,
        is_completely_paid: allStatementsPaid,
        amount: totalAmount,
        children: statements,
        _displayStatements: displayStatements,
        _isCreditCardParent: true,
        _isCreditCardStatement: false,
        _isRecurringSeries: false,
        _templateId: parentId,
        _statementCount: statements.length,
        _currentMonthStatementCount: currentMonthStatements.length,
        _isCurrentMonthCreditCard: currentMonthStatements.length > 0,
        _noDueDate: !latestDisplayStatement.due_date,
      });
    });

    const allDisplayBills = [...normalBills, ...groupedCreditCards];
    if (!statusFilter || statusFilter === 'all') {
      return allDisplayBills;
    }

    const todayStrNow = now.toISOString().slice(0, 10);
    return allDisplayBills.filter((bill) => {
      const status = bill.status || 'pending';
      const isPaid =
        status === 'paid' ||
        Number(bill.is_paid) === 1 ||
        Boolean(bill.is_completely_paid);
      const isSkipped = status === 'skipped';
      const isDueDatePast = Boolean(
        bill.due_date && String(bill.due_date).slice(0, 10) < todayStrNow
      );
      const isOverdue = !isPaid && !isSkipped && (status === 'overdue' || isDueDatePast);

      if (statusFilter === BILL_STATUS.OVERDUE) return isOverdue;
      if (statusFilter === BILL_STATUS.PAID) return isPaid;
      if (statusFilter === BILL_STATUS.PENDING) return !isPaid && !isSkipped && !isOverdue;
      return status === statusFilter;
    });
  }, [items, search, preferredOccurrences, statusFilter]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    return categories.filter((c) =>
      c.name.toLowerCase().includes(categorySearch.toLowerCase())
    );
  }, [categories, categorySearch]);

  const filteredPaymentSources = useMemo(() => {
    const q = paymentSourceSearch.trim().toLowerCase();
    if (!q) return paymentSources;
    return paymentSources.filter((s) => (s.name || '').toLowerCase().includes(q));
  }, [paymentSources, paymentSourceSearch]);

  function openDetail(bill) {
    const isStatement =
      bill._isCreditCardStatement === true ||
      (typeof bill.notes === 'string' && bill.notes.startsWith('Statement '));
    const parentId = bill.parent_bill_id || bill._templateId;

    if (isStatement && parentId) {
      navigation.navigate('BillDetail', {
        billId: parentId,
        occurrenceId: bill.id,
      });
      return;
    }

    navigation.navigate('BillDetail', {
      billId: bill._templateId || bill.parent_bill_id || bill.id,
      occurrenceId:
        bill._displayOccurrenceId || (bill._isRecurringSeries ? bill.id : undefined),
    });
  }

  async function openEdit(bill) {
    const templateId = bill._templateId || bill.id;
    const templateBill = await getBillById(templateId);
    setEditingBill(templateBill || bill);
    setShowForm(true);
  }

  const handleMarkPaid = async (bill) => {
    try {
      const actualBill = bill._displayOccurrence?.id ? bill._displayOccurrence : bill;
      const card = await resolveCreditCardForBill(actualBill);

      if (!card) {
        await markBillPaid(actualBill.id, {
          source_id: actualBill.source_id,
        });
        await load();
        return;
      }

      const sources = await getSources(true);
      const availableSources = (sources || []).filter(
        (s) => Number(s.id) !== Number(card.source_id)
      );
      setPaymentSources(availableSources);
      setSelectedPaymentBill(actualBill);
      setSelectedCreditCard(card);
      setPaymentSourceSearch('');
      setShowPaymentSourcePicker(true);
    } catch (e) {
      console.error('handleMarkPaid error:', e);
      Alert.alert('Error', 'Unable to mark bill as paid.');
    }
  };

  function handleSkip(bill) {
    const actualBill = bill._displayOccurrence?.id ? bill._displayOccurrence : bill;
    setSkipTarget(actualBill);
    setSkipModalVisible(true);
  }

  function handleDeleteBill(bill) {
    if (!bill?.id) {
      Alert.alert('Delete Bill', 'Unable to identify this bill.');
      return;
    }
    const actualBill = bill._displayOccurrence?.id ? bill._displayOccurrence : bill;
    if (!actualBill?.id) {
      Alert.alert('Delete Bill', 'Unable to identify the actual bill occurrence.');
      return;
    }
    setConfirmTarget(actualBill);
    setConfirmVisible(true);
  }

  async function handleViewStatements(bill) {
    try {
      const card = await resolveCreditCardForBill(bill);
      if (card && card.source_id) {
        navigation.navigate('CreditCardStatements', {
          sourceId: card.source_id,
          cardId: card.id,
        });
      } else if (card && card.id) {
        navigation.navigate('CreditCardStatements', { cardId: card.id });
      } else {
        navigation.navigate('CreditCardStatements');
      }
    } catch (error) {
      console.error('Failed to route to statements:', error);
      navigation.navigate('CreditCardStatements');
    }
  }

  const cycleSortBy = () => {
    setSortBy((prev) => (prev === 'due_date' ? 'amount' : 'due_date'));
  };

  const activeSort = SORT_MODES.find((m) => m.key === sortBy) || SORT_MODES[0];

  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const renderBill = (item) => {
    if (item._isCreditCardParent) {
      return (
        <BillCard
          isDarkMode={isDarkMode}
          bill={item}
          category={categoriesMap[item.category_id]}
          onPress={openDetail}
          onMarkPaid={handleMarkPaid}
          onOpenActions={setActionSheetBill}
          onToggleExpand={() => handleViewStatements(item)}
        />
      );
    }

    return (
      <BillCard
        isDarkMode={isDarkMode}
        bill={item}
        category={categoriesMap[item.category_id]}
        onPress={openDetail}
        onMarkPaid={handleMarkPaid}
        onOpenActions={setActionSheetBill}
      />
    );
  };

  const groupedSections = useMemo(() => {
    if (viewMode !== 'list') return [];

    const groups = { urgent: [], upcoming: [], later: [], settled: [], inactive: [] };
    const nowDate = new Date();
    const nowStr = new Date(nowDate.getTime() - nowDate.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];

    filteredItems.forEach((bill) => {
      const status = bill.status || 'pending';
      const isPaid =
        status === 'paid' ||
        Number(bill.is_paid) === 1 ||
        Boolean(bill.is_completely_paid);
      const isSkipped = status === 'skipped';
      const isDueDatePast = Boolean(
        bill.due_date && String(bill.due_date).slice(0, 10) < nowStr
      );
      const isOverdue = !isPaid && !isSkipped && (status === 'overdue' || isDueDatePast);
      const isInactive = bill.recurrence_end_date && bill.recurrence_end_date < nowStr;

      if (isInactive) {
        groups.inactive.push({ ...bill, _sectionTag: 'inactive' });
      } else if (isOverdue) {
        groups.urgent.push({ ...bill, _sectionTag: 'urgent' });
      } else if (isPaid || isSkipped) {
        groups.settled.push({ ...bill, _sectionTag: 'settled' });
      } else {
        const dueDate = new Date(bill.due_date || nowDate);
        const diffDays = Math.ceil((dueDate - nowDate) / (1000 * 60 * 60 * 24));
        if (diffDays > 7) {
          groups.later.push(bill);
        } else {
          groups.upcoming.push(bill);
        }
      }
    });

    const result = [];
    if (groups.urgent.length > 0) {
      result.push({ title: 'Urgent & Overdue', accent: palette.negative, data: groups.urgent });
    }
    if (groups.upcoming.length > 0) {
      result.push({ title: 'Upcoming', accent: palette.warning, data: groups.upcoming });
    }
    if (groups.later.length > 0) {
      result.push({ title: 'Later This Month', accent: palette.primary, data: groups.later });
    }
    if (groups.settled.length > 0) {
      result.push({ title: 'Settled & Paid', accent: palette.positive, data: groups.settled });
    }
    if (groups.inactive.length > 0) {
      result.push({ title: 'Inactive', accent: palette.textMuted, data: groups.inactive });
    }
    return result;
  }, [filteredItems, viewMode, palette]);

  const listHeader = (
    <View style={styles.headerBlock}>
      {/* Top Month & List/Calendar Bar (No right-edge clipping) */}
      <View style={styles.topControlBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setViewMode((m) => (m === 'list' ? 'calendar' : 'list'))}
          style={[
            styles.monthPillBtn,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.cardBorder,
            },
            !isDarkMode && styles.cardShadowLight,
          ]}
        >
          <MaterialCommunityIcons
            name="calendar-month"
            size={18}
            color={palette.primary}
          />
          <Text numberOfLines={1} style={[styles.monthPillText, { color: palette.textPrimary }]}>
            {monthLabel}
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.viewModeTrack,
            {
              backgroundColor: palette.surfaceSubtle,
              borderColor: palette.cardBorder,
            },
          ]}
        >
          {[
            ['list', 'format-list-bulleted', 'List'],
            ['calendar', 'calendar-month-outline', 'Calendar'],
          ].map(([modeKey, iconName, label]) => {
            const active = viewMode === modeKey;
            return (
              <TouchableOpacity
                key={modeKey}
                activeOpacity={0.85}
                onPress={() => setViewMode(modeKey)}
                style={[
                  styles.viewModeTab,
                  active && [
                    styles.viewModeTabActive,
                    {
                      backgroundColor: isDarkMode ? '#243247' : palette.cardBg,
                      borderColor: isDarkMode ? palette.primaryBorder : palette.cardBorder,
                    },
                    !isDarkMode && styles.cardShadowLight,
                  ],
                ]}
              >
                <MaterialCommunityIcons
                  name={iconName}
                  size={15}
                  color={active ? palette.primaryText : palette.textSecondary}
                />
                <Text
                  style={[
                    styles.viewModeTabText,
                    {
                      color: active ? palette.textPrimary : palette.textSecondary,
                      fontWeight: active ? '800' : '600',
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Hero Summary Card */}
      <View style={styles.summaryWrapper}>
        <BillSummaryBar
          summary={summary}
          monthLabel={monthLabel}
          activeStatusFilter={statusFilter}
          onFilterPress={setStatusFilter}
          isDarkMode={isDarkMode}
        />
      </View>

      {/* Overdue Attention Banner (shown when overdue > 0 and not already filtered to overdue) */}
      {summary?.overdueCount > 0 && statusFilter !== BILL_STATUS.OVERDUE && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setStatusFilter(BILL_STATUS.OVERDUE)}
          style={[
            styles.attentionBanner,
            {
              backgroundColor: palette.negativeBg,
              borderColor: palette.negativeBorder,
            },
          ]}
        >
          <View
            style={[
              styles.attentionIconCircle,
              { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2' },
            ]}
          >
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={18}
              color={palette.negative}
            />
          </View>
          <View style={styles.attentionTextWrap}>
            <Text style={[styles.attentionTitle, { color: palette.negative }]}>
              Payment attention needed
            </Text>
            <Text style={[styles.attentionSub, { color: palette.textSecondary }]}>
              {summary.overdueCount} overdue ·{' '}
              <CurrencyText amount={summary.overdueAmount} /> · Tap to view
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={palette.negative} />
        </TouchableOpacity>
      )}

      {/* Search Bar */}
      <View
        style={[
          styles.searchBarBox,
          {
            backgroundColor: palette.inputBg,
            borderColor: palette.cardBorder,
          },
          !isDarkMode && styles.cardShadowLight,
        ]}
      >
        <MaterialCommunityIcons name="magnify" size={20} color={palette.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search bills by name..."
          placeholderTextColor={palette.textMuted}
          style={[styles.searchInput, { color: palette.textPrimary }]}
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="close-circle" size={18} color={palette.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statusPillsScroll}
      >
        {STATUS_FILTERS.map((filter) => {
          const active = statusFilter === filter.key;
          const activeBg =
            filter.key === BILL_STATUS.OVERDUE
              ? palette.negative
              : filter.key === BILL_STATUS.PAID
                ? palette.positive
                : filter.key === BILL_STATUS.PENDING
                  ? palette.warning
                  : palette.primary;

          return (
            <TouchableOpacity
              key={filter.key}
              activeOpacity={0.8}
              onPress={() => setStatusFilter(filter.key)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: active ? activeBg : palette.cardBg,
                  borderColor: active ? activeBg : palette.cardBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  { color: active ? '#FFFFFF' : palette.textSecondary },
                ]}
              >
                {filter.key === 'all' ? `All Bills (${items.length})` : filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Secondary Row: Category Filter Pill + Sort Cycle Pill */}
      <View style={styles.secondaryControlsRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowCategoryDD(true)}
          style={[
            styles.categoryFilterBtn,
            {
              backgroundColor: categoryFilter ? palette.primarySoft : palette.cardBg,
              borderColor: categoryFilter ? palette.primaryBorder : palette.cardBorder,
            },
          ]}
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={15}
            color={categoryFilter ? palette.primaryText : palette.textSecondary}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.categoryFilterText,
              { color: categoryFilter ? palette.primaryText : palette.textSecondary },
            ]}
          >
            {categoryFilter ? categoriesMap[categoryFilter]?.name || 'Category' : 'All Categories'}
          </Text>
          <Feather
            name="chevron-down"
            size={14}
            color={categoryFilter ? palette.primaryText : palette.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={cycleSortBy}
          style={[
            styles.sortPillBtn,
            {
              backgroundColor: sortBy !== 'due_date' ? palette.primarySoft : palette.cardBg,
              borderColor: sortBy !== 'due_date' ? palette.primaryBorder : palette.cardBorder,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={activeSort.icon}
            size={15}
            color={sortBy !== 'due_date' ? palette.primaryText : palette.textSecondary}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.sortPillText,
              { color: sortBy !== 'due_date' ? palette.primaryText : palette.textSecondary },
            ]}
          >
            Sort: {activeSort.label}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <BillCalendarView
          bills={filteredItems}
          month={calMonth}
          year={calYear}
          isDarkMode={isDarkMode}
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
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {listHeader}

        {viewMode === 'list' && groupedSections.length === 0 && (
          <View
            style={[
              styles.emptyStateCard,
              {
                backgroundColor: palette.cardBg,
                borderColor: palette.cardBorder,
              },
            ]}
          >
            <View style={[styles.emptyIconCircle, { backgroundColor: palette.surfaceSubtle }]}>
              <MaterialCommunityIcons
                name="clipboard-check-outline"
                size={34}
                color={palette.textMuted}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
              {search || statusFilter !== 'all' || categoryFilter
                ? 'No matching bills'
                : 'No bills this month'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
              {search
                ? `No bill matches "${search}"`
                : statusFilter !== 'all' || categoryFilter
                  ? 'Try clearing active filters to view all scheduled bills.'
                  : 'Tap + to add your recurring or upcoming monthly bills.'}
            </Text>
            {(search.length > 0 || statusFilter !== 'all' || categoryFilter) && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setCategoryFilter(null);
                }}
                style={[
                  styles.resetFilterBtn,
                  {
                    backgroundColor: palette.primarySoft,
                    borderColor: palette.primaryBorder,
                  },
                ]}
              >
                <Text style={[styles.resetFilterText, { color: palette.primaryText }]}>
                  Show all bills
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {viewMode === 'list' &&
          groupedSections.map((section, idx) => (
            <View key={section.title || idx} style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionDot, { backgroundColor: section.accent }]} />
                <Text style={[styles.sectionTitleText, { color: palette.textPrimary }]}>
                  {section.title}
                </Text>
                <View style={[styles.sectionCountBadge, { backgroundColor: palette.badgeBg }]}>
                  <Text style={[styles.sectionCountText, { color: palette.badgeText }]}>
                    {section.data.length}
                  </Text>
                </View>
              </View>

              {section.data.map((item, i) => (
                <View
                  key={
                    item._displayOccurrenceId
                      ? String(item._displayOccurrenceId)
                      : `${item.id}-${i}`
                  }
                >
                  {renderBill(item)}
                </View>
              ))}
            </View>
          ))}
      </ScrollView>

      {/* FLOATING ADD BILL FAB */}
      <ContextualFAB
        onPress={() => {
          setEditingBill(null);
          setShowForm(true);
        }}
      />

      {/* BILL ACTIONS SHEET (Hidden Edit / Delete / Pay / Skip / Timeline Hub) */}
      <ResponsiveBottomSheet
        visible={!!actionSheetBill}
        animationType="slide"
        maxHeightRatio={0.78}
        backdropColor={isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)'}
        onRequestClose={() => setActionSheetBill(null)}
        sheetStyle={[
          styles.actionSheetContainer,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
        ]}
      >
        {({ maxHeight }) =>
          actionSheetBill
            ? (() => {
              const target = actionSheetBill;
              const cat = categoriesMap[target.category_id];
              const sheetColor = cat?.color || palette.primary;
              const sheetAvatarBg = isDarkMode ? `${sheetColor}2E` : `${sheetColor}18`;
              const isPaid =
                target.status === 'paid' ||
                Number(target.is_paid) === 1 ||
                Boolean(target.is_completely_paid);
              const isSkipped = target.status === 'skipped';
              const canEdit = !target._isCreditCardParent && !isCreditCardBill(target);
              const canSkip = !isPaid && !isSkipped && !target._isCreditCardParent;
              const canPay = !isPaid && !isSkipped;

              return (
                <View style={{ maxHeight }}>
                  <View
                    style={[
                      styles.sheetHandle,
                      { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' },
                    ]}
                  />

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    style={{
                      flexGrow: 0,
                      flexShrink: 1,
                      maxHeight: Math.max(200, maxHeight - 36),
                    }}
                  >
                    <View style={styles.sheetHeaderRow}>
                      <View style={styles.sheetHeaderTextWrap}>
                        <Text style={[styles.sheetTitle, { color: palette.textPrimary }]}>
                          Bill Actions
                        </Text>
                        <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
                          Manage schedule, payments & details
                        </Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() => setActionSheetBill(null)}
                        accessibilityLabel="Close actions"
                        style={[
                          styles.sheetCloseBtn,
                          { backgroundColor: palette.surfaceSubtle },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="close"
                          size={18}
                          color={palette.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Selected Bill Preview */}
                    <View
                      style={[
                        styles.sheetPreviewCard,
                        {
                          backgroundColor: palette.surfaceSubtle,
                          borderColor: palette.cardBorder,
                          borderLeftColor: sheetColor,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.sheetPreviewAvatar,
                          { backgroundColor: sheetAvatarBg },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={
                            cat?.icon ||
                            (target._isCreditCardParent ? 'credit-card' : 'receipt')
                          }
                          size={22}
                          color={sheetColor}
                        />
                      </View>

                      <View style={styles.sheetPreviewInfo}>
                        <Text
                          numberOfLines={2}
                          style={[styles.sheetPreviewName, { color: palette.textPrimary }]}
                        >
                          {target.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.sheetPreviewMeta, { color: palette.textSecondary }]}
                        >
                          {target._noDueDate || !target.due_date
                            ? 'No due date'
                            : `Due ${formatDueDate(target.due_date)}`}
                        </Text>
                      </View>

                      <View style={styles.sheetPreviewRight}>
                        <CurrencyText
                          amount={target.amount}
                          numberOfLines={1}
                          style={[styles.sheetPreviewAmount, { color: palette.textPrimary }]}
                        />
                        <Text style={[styles.sheetPreviewTag, { color: palette.textMuted }]}>
                          {String(target.status || 'pending').toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Two-Column Action Tiles */}
                    <View style={styles.actionTilesRow}>
                      {canEdit ? (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            setActionSheetBill(null);
                            openEdit(target);
                          }}
                          style={[
                            styles.actionTile,
                            {
                              backgroundColor: palette.editBg,
                              borderColor: palette.editBorder,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.actionTileIconCircle,
                              { backgroundColor: palette.cardBg },
                            ]}
                          >
                            <Feather name="edit-2" size={18} color={palette.editIcon} />
                          </View>
                          <Text style={[styles.actionTileTitle, { color: palette.textPrimary }]}>
                            Edit Bill
                          </Text>
                          <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                            Amount, cycle & date
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            setActionSheetBill(null);
                            handleViewStatements(target);
                          }}
                          style={[
                            styles.actionTile,
                            {
                              backgroundColor: palette.editBg,
                              borderColor: palette.editBorder,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.actionTileIconCircle,
                              { backgroundColor: palette.cardBg },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="file-document-outline"
                              size={19}
                              color={palette.editIcon}
                            />
                          </View>
                          <Text style={[styles.actionTileTitle, { color: palette.textPrimary }]}>
                            Statements
                          </Text>
                          <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                            View card statements
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setActionSheetBill(null);
                          handleDeleteBill(target);
                        }}
                        style={[
                          styles.actionTile,
                          {
                            backgroundColor: palette.deleteBg,
                            borderColor: palette.deleteBorder,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.actionTileIconCircle,
                            { backgroundColor: palette.cardBg },
                          ]}
                        >
                          <Feather name="trash-2" size={18} color={palette.deleteIcon} />
                        </View>
                        <Text style={[styles.actionTileTitle, { color: palette.deleteIcon }]}>
                          Delete Bill
                        </Text>
                        <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                          Remove from schedule
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {canPay && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setActionSheetBill(null);
                          handleMarkPaid(target);
                        }}
                        style={[
                          styles.sheetHistoryRow,
                          {
                            backgroundColor: palette.positiveBg,
                            borderColor: palette.positiveBorder,
                            marginBottom: 8,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.sheetHistoryIcon,
                            { backgroundColor: palette.cardBg },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="check-circle-outline"
                            size={18}
                            color={palette.positive}
                          />
                        </View>
                        <View style={styles.sheetHistoryTextWrap}>
                          <Text style={[styles.sheetHistoryTitle, { color: palette.positive }]}>
                            Mark Bill as Paid
                          </Text>
                          <Text style={[styles.sheetHistorySub, { color: palette.textSecondary }]}>
                            Record payment & settle this due
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={palette.positive} />
                      </TouchableOpacity>
                    )}

                    {canSkip && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setActionSheetBill(null);
                          handleSkip(target);
                        }}
                        style={[
                          styles.sheetHistoryRow,
                          {
                            backgroundColor: palette.surfaceSubtle,
                            borderColor: palette.cardBorder,
                            marginBottom: 8,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.sheetHistoryIcon,
                            { backgroundColor: palette.warningBg },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="skip-next-circle-outline"
                            size={18}
                            color={palette.warning}
                          />
                        </View>
                        <View style={styles.sheetHistoryTextWrap}>
                          <Text style={[styles.sheetHistoryTitle, { color: palette.textPrimary }]}>
                            Skip This Period
                          </Text>
                          <Text style={[styles.sheetHistorySub, { color: palette.textSecondary }]}>
                            Skip only this occurrence cleanly
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={palette.textMuted} />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setActionSheetBill(null);
                        openDetail(target);
                      }}
                      style={[
                        styles.sheetHistoryRow,
                        {
                          backgroundColor: palette.surfaceSubtle,
                          borderColor: palette.cardBorder,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.sheetHistoryIcon,
                          { backgroundColor: palette.primarySoft },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="chart-timeline-variant"
                          size={18}
                          color={palette.primary}
                        />
                      </View>
                      <View style={styles.sheetHistoryTextWrap}>
                        <Text style={[styles.sheetHistoryTitle, { color: palette.textPrimary }]}>
                          View Bill Details & Linked Entries
                        </Text>
                        <Text style={[styles.sheetHistorySub, { color: palette.textSecondary }]}>
                          See payment history, notes & series
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={palette.textMuted} />
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              );
            })()
            : null
        }
      </ResponsiveBottomSheet>

      {/* CATEGORY FILTER SHEET (Adaptive + Keyboard-Safe Pinned Search) */}
      <ResponsiveBottomSheet
        visible={showCategoryDD}
        animationType="slide"
        maxHeightRatio={0.75}
        backdropColor={isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)'}
        onRequestClose={() => {
          setShowCategoryDD(false);
          setCategorySearch('');
        }}
        sheetStyle={[
          styles.pickerSheetContainer,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
        ]}
      >
        {({ maxHeight }) => (
          <View style={{ maxHeight }}>
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' },
              ]}
            />
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: palette.textPrimary }]}>
                Filter by Category
              </Text>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  setShowCategoryDD(false);
                  setCategorySearch('');
                }}
                style={[styles.sheetCloseBtn, { backgroundColor: palette.surfaceSubtle }]}
              >
                <MaterialCommunityIcons name="close" size={18} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.sheetSearchBox,
                {
                  backgroundColor: palette.inputBg,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <MaterialCommunityIcons name="magnify" size={20} color={palette.textSecondary} />
              <TextInput
                placeholder="Search category..."
                placeholderTextColor={palette.textMuted}
                value={categorySearch}
                onChangeText={setCategorySearch}
                style={[styles.sheetSearchInput, { color: palette.textPrimary }]}
                autoCorrect={false}
              />
              {!!categorySearch && (
                <TouchableOpacity onPress={() => setCategorySearch('')}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={palette.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={[{ id: 'all', name: 'All Categories' }, ...filteredCategories]}
              keyExtractor={(i) => String(i.id)}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: Math.max(180, maxHeight - 130) }}
              renderItem={({ item }) => {
                const selected = item.id === 'all' ? !categoryFilter : categoryFilter === item.id;
                return (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      setCategoryFilter(item.id === 'all' ? null : item.id);
                      setShowCategoryDD(false);
                      setCategorySearch('');
                    }}
                    style={[
                      styles.pickerRow,
                      {
                        backgroundColor: selected ? palette.primarySoft : 'transparent',
                        borderColor: selected ? palette.primaryBorder : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerRowLabel,
                        { color: selected ? palette.primaryText : palette.textPrimary },
                      ]}
                    >
                      {item.name}
                    </Text>
                    {selected && (
                      <MaterialCommunityIcons name="check" size={18} color={palette.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </ResponsiveBottomSheet>

      {/* CREDIT CARD PAYMENT SOURCE PICKER */}
      <ResponsiveBottomSheet
        visible={showPaymentSourcePicker}
        animationType="slide"
        maxHeightRatio={0.72}
        backdropColor={isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)'}
        onRequestClose={() => {
          setShowPaymentSourcePicker(false);
          setSelectedPaymentBill(null);
          setSelectedCreditCard(null);
        }}
        sheetStyle={[
          styles.pickerSheetContainer,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
        ]}
      >
        {({ maxHeight }) => (
          <View style={{ maxHeight }}>
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' },
              ]}
            />
            <View style={styles.sheetHeaderRow}>
              <View style={styles.sheetHeaderTextWrap}>
                <Text style={[styles.sheetTitle, { color: palette.textPrimary }]}>
                  Select Payment Source
                </Text>
                <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
                  Choose which account pays this statement
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  setShowPaymentSourcePicker(false);
                  setSelectedPaymentBill(null);
                  setSelectedCreditCard(null);
                }}
                style={[styles.sheetCloseBtn, { backgroundColor: palette.surfaceSubtle }]}
              >
                <MaterialCommunityIcons name="close" size={18} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.sheetSearchBox,
                {
                  backgroundColor: palette.inputBg,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <MaterialCommunityIcons name="magnify" size={20} color={palette.textSecondary} />
              <TextInput
                placeholder="Search source..."
                placeholderTextColor={palette.textMuted}
                value={paymentSourceSearch}
                onChangeText={setPaymentSourceSearch}
                style={[styles.sheetSearchInput, { color: palette.textPrimary }]}
                autoCorrect={false}
              />
              {!!paymentSourceSearch && (
                <TouchableOpacity onPress={() => setPaymentSourceSearch('')}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={palette.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: Math.max(180, maxHeight - 140) }}
            >
              {filteredPaymentSources.map((source) => (
                <TouchableOpacity
                  key={source.id}
                  activeOpacity={0.75}
                  style={[
                    styles.sourcePickerRow,
                    { borderBottomColor: palette.divider },
                  ]}
                  onPress={async () => {
                    try {
                      const paymentId = await payCreditCardBill({
                        bill: selectedPaymentBill,
                        card: selectedCreditCard,
                        paymentSourceId: source.id,
                      });
                      await markBillPaid(selectedPaymentBill.id, {
                        createTransaction: false,
                        existingTransactionId: paymentId,
                      });
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
                  <View
                    style={[
                      styles.sourcePickerIcon,
                      { backgroundColor: palette.primarySoft },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={source.icon || 'wallet'}
                      size={20}
                      color={palette.primary}
                    />
                  </View>
                  <Text style={[styles.sourcePickerLabel, { color: palette.textPrimary }]}>
                    {source.name}
                  </Text>
                  <Feather name="chevron-right" size={17} color={palette.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ResponsiveBottomSheet>

      {/* ADD / EDIT FORM MODAL */}
      <Modal visible={showForm} animationType="slide">
        <BillForm
          bill={editingBill}
          onSaved={() => {
            setShowForm(false);
            setEditingBill(null);
            load();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingBill(null);
          }}
        />
      </Modal>

      {/* DELETE BILL MODAL */}
      <DeleteBillModal
        visible={confirmVisible}
        bill={confirmTarget}
        loading={isDeleting}
        onCancel={() => {
          if (isDeleting) return;
          setConfirmVisible(false);
          setConfirmTarget(null);
        }}
        onConfirm={async () => {
          if (!confirmTarget?.id) {
            setConfirmVisible(false);
            setConfirmTarget(null);
            return;
          }
          try {
            setIsDeleting(true);
            const isRecurringOcc = Boolean(confirmTarget.parent_bill_id);
            if (isRecurringOcc) {
              await softDeleteBillOccurrence(
                confirmTarget.id,
                false,
                confirmTarget.due_date
              );
            } else {
              await deleteBill(confirmTarget.id);
            }
            setConfirmVisible(false);
            setConfirmTarget(null);
            await load();
          } catch (error) {
            console.error('[BillsScreen] delete action failed:', error);
            Alert.alert('Error', 'Unable to delete this bill.');
          } finally {
            setIsDeleting(false);
          }
        }}
      />

      {/* SKIP BILL MODAL */}
      <SkipBillModal
        visible={skipModalVisible}
        bill={skipTarget}
        loading={isSkipping}
        onCancel={() => {
          if (isSkipping) return;
          setSkipModalVisible(false);
          setSkipTarget(null);
        }}
        onConfirm={async () => {
          if (!skipTarget?.id || isSkipping) return;
          try {
            setIsSkipping(true);
            await skipBill(skipTarget.id);
            await load();
            setSkipModalVisible(false);
            setSkipTarget(null);
          } catch (error) {
            console.error('[BillsScreen] Skip failed:', error);
            Alert.alert('Error', 'Unable to skip this bill.');
          } finally {
            setIsSkipping(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardShadowLight: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    android: {
      elevation: 2,
    },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
    },
  }),
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 112,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  headerBlock: {
    marginBottom: 4,
  },

  /* Top Month & List/Calendar Bar */
  topControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  monthPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    flexShrink: 1,
    gap: 7,
  },
  monthPillText: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  viewModeTrack: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    gap: 3,
    flexShrink: 0,
  },
  viewModeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    borderRadius: 10,
    gap: 5,
  },
  viewModeTabActive: {
    borderWidth: 1,
  },
  viewModeTabText: {
    fontSize: 12.5,
  },

  summaryWrapper: {
    marginBottom: 12,
  },

  /* Attention Banner */
  attentionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
  },
  attentionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  attentionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  attentionSub: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },

  /* Search & Controls */
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 13,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 9,
    paddingVertical: 0,
  },
  statusPillsScroll: {
    gap: 7,
    paddingBottom: 10,
  },
  filterPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  categoryFilterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    minWidth: 0,
  },
  categoryFilterText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  sortPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
    flexShrink: 0,
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Sections */
  sectionBlock: {
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    gap: 7,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sectionTitleText: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sectionCountBadge: {
    minWidth: 22,
    height: 19,
    paddingHorizontal: 6,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: {
    fontSize: 10.5,
    fontWeight: '800',
  },

  /* Action Sheet & Picker Sheets */
  actionSheetContainer: {
    width: '100%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 20,
  },
  pickerSheetContainer: {
    width: '100%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 18,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sheetPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 14,
  },
  sheetPreviewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sheetPreviewInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 8,
  },
  sheetPreviewName: {
    fontSize: 15,
    fontWeight: '800',
  },
  sheetPreviewMeta: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  sheetPreviewRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: '38%',
  },
  sheetPreviewAmount: {
    fontSize: 15,
    fontWeight: '900',
  },
  sheetPreviewTag: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  actionTilesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  actionTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'flex-start',
  },
  actionTileIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTileTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionTileSub: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  sheetHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  sheetHistoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sheetHistoryTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  sheetHistoryTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  sheetHistorySub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  sheetSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  sheetSearchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    marginLeft: 8,
    paddingVertical: 0,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  pickerRowLabel: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  sourcePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 11,
  },
  sourcePickerIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourcePickerLabel: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
  },

  /* Empty State */
  emptyStateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 36,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  resetFilterBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  resetFilterText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
});
