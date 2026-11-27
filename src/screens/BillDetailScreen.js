import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { Snackbar } from 'react-native-paper';
import PremiumRoundedBarChart from '../components/PremiumRoundedBarChart';
import {
  getBillById,
  getBillSeries,
  markBillPaid,
  skipBill,
  unskipBill,
  softDeleteBillOccurrence,
  getTransactionsForBillLink,
  getBillLinkedTransactions,
  linkAdditionalTransaction,
  removeTransactionFromBill,
} from '../services/bills';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import CommonBottomSheetModal from '../components/CommonBottomSheetModal';
import ResponsiveBottomSheet from '../components/ResponsiveBottomSheet';
import SkipBillModal from '../components/SkipBillModal';
import UnskipBillModal from '../components/UnskipBillModal';
import BillForm from '../components/BillForm';
import CurrencyText from '../components/CurrencyText';
import {
  formatCurrency,
  formatDueDate,
  getBillDisplayStatus,
  BILL_STATUS,
} from '../services/billUtils';
import { getCreditCards, payCreditCardBill } from '../services/creditCards';
import { usePageLoader } from '../context/PageLoaderContext';
import { useTheme } from '../context/ThemeContext';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext';
import PageLoader from '../components/PageLoader';
import { onStatementPaid } from '../services/creditCardScheduler';
import { setCategoriesMap } from '../redux/slices/categorySlice';
import { useAppDispatch, useCategoriesMap } from '../redux/hooks';

const screenWidth = Dimensions.get('window').width;

function getBillMonthYear(billObj) {
  const dateStr = billObj?.due_date || billObj?.occurrence_date;
  if (dateStr) {
    const parts = String(dateStr).slice(0, 10).split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, monthIndex, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      }
    }
  }
  return new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatRecurrenceType(type, isRecurring = true) {
  if (!isRecurring) return 'One-Time';
  if (!type) return 'Monthly';
  const upper = String(type).trim().toUpperCase();
  switch (upper) {
    case 'MONTHLY':
      return 'Monthly';
    case 'YEARLY':
      return 'Yearly';
    case 'BI_MONTHLY':
      return 'Bi-Monthly';
    case 'QUARTERLY':
      return 'Quarterly';
    case 'HALF_YEARLY':
      return 'Half-Yearly';
    case 'WEEKLY':
      return 'Weekly';
    case 'DAILY':
      return 'Daily';
    case 'ONE_TIME':
    case 'ONETIME':
      return 'One-Time';
    default:
      return upper.charAt(0) + upper.slice(1).toLowerCase();
  }
}

function isCreditCardBill(bill) {
  return (
    typeof bill?.notes === 'string' &&
    (bill.notes.startsWith('Recurring payment template for') ||
      bill.notes.startsWith('Statement '))
  );
}

function LinkedTransactionsCard({
  linkedTxs,
  palette,
  isDarkMode,
  onAddMore,
  onUnlink,
  onEdit,
}) {
  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: palette.cardBg,
          borderColor: palette.cardBorder,
        },
        !isDarkMode && styles.cardShadowLight,
      ]}
    >
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleGroup}>
          <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
            Linked Transactions
          </Text>
          <View style={[styles.countBadge, { backgroundColor: palette.badgeBg }]}>
            <Text style={[styles.countBadgeText, { color: palette.badgeText }]}>
              {linkedTxs.length}
            </Text>
          </View>
        </View>

        {onAddMore && (
          <TouchableOpacity
            onPress={onAddMore}
            activeOpacity={0.8}
            style={[styles.linkNewBtn, { backgroundColor: palette.positive }]}
          >
            <MaterialCommunityIcons name="plus" size={14} color="#FFFFFF" />
            <Text style={styles.linkNewBtnText}>Link New</Text>
          </TouchableOpacity>
        )}
      </View>

      {linkedTxs.length === 0 ? (
        <View
          style={[
            styles.emptyLinkedCard,
            {
              backgroundColor: palette.surfaceSubtle,
              borderColor: palette.cardBorder,
            },
          ]}
        >
          <View style={[styles.emptyLinkedIconWrap, { backgroundColor: palette.cardBg }]}>
            <MaterialCommunityIcons name="link-variant-off" size={22} color={palette.textMuted} />
          </View>
          <Text style={[styles.emptyLinkedTitle, { color: palette.textPrimary }]}>
            No linked transactions
          </Text>
          <Text style={[styles.emptyLinkedSub, { color: palette.textSecondary }]}>
            Link a payment to automatically record and settle this bill cycle.
          </Text>
        </View>
      ) : (
        linkedTxs.map((tx) => {
          const sourceWords = (tx.source_name || 'BANK').trim().split(' ');
          const line1 = sourceWords[0]?.slice(0, 3)?.toUpperCase() || 'BNK';
          const avatarColor = tx.category_color || tx.source_color || palette.positive;
          const avatarIcon = tx.category_icon || tx.source_icon;
          const avatarBg = isDarkMode ? `${avatarColor}2E` : `${avatarColor}18`;

          return (
            <View
              key={tx.id}
              style={[
                styles.linkedTxItem,
                {
                  backgroundColor: palette.surfaceSubtle,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => onEdit && onEdit(tx)}
                style={styles.linkedTxTouch}
                accessibilityRole="button"
                accessibilityLabel={`Edit transaction ${tx.notes || 'Payment'}`}
              >
                <View style={[styles.txAvatarWrap, { backgroundColor: avatarBg }]}>
                  {avatarIcon ? (
                    <MaterialCommunityIcons name={avatarIcon} size={20} color={avatarColor} />
                  ) : (
                    <Text style={[styles.txAvatarText, { color: avatarColor }]}>{line1}</Text>
                  )}
                </View>

                <View style={styles.txDetailsCol}>
                  <View style={styles.txTitleRow}>
                    <Text numberOfLines={1} style={[styles.txTitle, { color: palette.textPrimary }]}>
                      {tx.notes || 'Payment Transaction'}
                    </Text>
                    <View style={[styles.verifiedTag, { backgroundColor: palette.positiveBg }]}>
                      <Text style={[styles.verifiedTagText, { color: palette.positive }]}>
                        Verified
                      </Text>
                    </View>
                  </View>

                  <View style={styles.txMetaRow}>
                    <Text style={[styles.txDateText, { color: palette.textSecondary }]}>
                      {tx.date
                        ? new Date(tx.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </Text>
                    {tx.source_name ? (
                      <>
                        <Text style={[styles.txBullet, { color: palette.textMuted }]}>•</Text>
                        <View style={[styles.sourceBadge, { backgroundColor: palette.cardBg }]}>
                          <Text
                            numberOfLines={1}
                            style={[styles.sourceBadgeText, { color: palette.textSecondary }]}
                          >
                            {tx.source_name}
                          </Text>
                        </View>
                      </>
                    ) : null}
                  </View>

                  <CurrencyText
                    amount={tx.amount}
                    style={[styles.txAmountText, { color: palette.textPrimary }]}
                  />
                </View>
              </TouchableOpacity>

              {onUnlink && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Unlink transaction"
                  onPress={() => onUnlink(tx)}
                  activeOpacity={0.75}
                  style={[
                    styles.unlinkBtn,
                    {
                      backgroundColor: palette.deleteBg,
                      borderColor: palette.deleteBorder,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="link-variant-off"
                    size={16}
                    color={palette.deleteIcon}
                  />
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

function YearQuickJumpModal({
  visible,
  onClose,
  series = [],
  availableYears = [],
  yearGroups = {},
  activeYear,
  activeOccurrenceId,
  onSelectOccurrence,
  palette,
  isDarkMode,
  balanceVisible,
}) {
  const [selectedYear, setSelectedYear] = useState(activeYear || availableYears[0]);

  useEffect(() => {
    if (visible) {
      setSelectedYear(activeYear || availableYears[0]);
    }
  }, [visible, activeYear, availableYears]);

  if (!visible) return null;

  const oldestOcc = series && series.length > 0 ? series[0] : null;
  const latestOcc = series && series.length > 0 ? series[series.length - 1] : null;
  const oldestYear = oldestOcc?.due_date ? new Date(oldestOcc.due_date).getFullYear() : null;
  const latestYear = latestOcc?.due_date ? new Date(latestOcc.due_date).getFullYear() : null;
  const monthsInSelectedYear = selectedYear && yearGroups[selectedYear] ? yearGroups[selectedYear] : [];
  const isFewYears = availableYears.length <= 4;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.unlinkModalOverlay,
          { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.58)' },
        ]}
      >
        <Pressable style={styles.unlinkModalBackdrop} onPress={onClose} />
        <View
          style={[
            styles.jumpModalCard,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.cardBorder,
              borderWidth: 1,
            },
          ]}
        >
          <View style={styles.jumpModalHeader}>
            <View style={[styles.jumpIconCircle, { backgroundColor: palette.positiveBg }]}>
              <MaterialCommunityIcons name="calendar-clock" size={24} color={palette.positive} />
            </View>
            <Text style={[styles.jumpModalTitle, { color: palette.textPrimary }]}>
              Jump to Period
            </Text>
            <Text style={[styles.jumpModalSubtitle, { color: palette.textSecondary }]}>
              Navigate across {series.length} bill cycles
            </Text>
          </View>

          <ScrollView
            style={styles.jumpModalScroll}
            contentContainerStyle={styles.jumpModalScrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {series.length > 5 && (
              <View style={styles.jumpShortcutsRow}>
                {oldestOcc && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      onSelectOccurrence(oldestOcc);
                      onClose();
                    }}
                    style={[
                      styles.jumpShortcutBtn,
                      {
                        backgroundColor: palette.surfaceSubtle,
                        borderColor: palette.cardBorder,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="page-first" size={16} color={palette.positive} />
                    <Text
                      style={[styles.jumpShortcutText, { color: palette.textPrimary }]}
                      numberOfLines={1}
                    >
                      Oldest ({oldestYear})
                    </Text>
                  </TouchableOpacity>
                )}

                {latestOcc && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      onSelectOccurrence(latestOcc);
                      onClose();
                    }}
                    style={[
                      styles.jumpShortcutBtn,
                      {
                        backgroundColor: palette.surfaceSubtle,
                        borderColor: palette.cardBorder,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="page-last" size={16} color={palette.positive} />
                    <Text
                      style={[styles.jumpShortcutText, { color: palette.textPrimary }]}
                      numberOfLines={1}
                    >
                      Latest ({latestYear})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {availableYears.length > 0 && (
              <View style={styles.jumpSectionWrap}>
                <Text style={[styles.jumpSectionLabel, { color: palette.textSecondary }]}>
                  SELECT YEAR ({availableYears.length})
                </Text>
                <View style={styles.jumpYearGrid}>
                  {availableYears.map((yr) => {
                    const isSelected = Number(selectedYear) === Number(yr);
                    return (
                      <TouchableOpacity
                        key={String(yr)}
                        activeOpacity={0.75}
                        onPress={() => setSelectedYear(yr)}
                        style={[
                          styles.yearGridBtn,
                          isFewYears ? { flex: 1 } : { width: '23%' },
                          {
                            backgroundColor: isSelected ? palette.positive : palette.surfaceSubtle,
                            borderColor: isSelected ? palette.positive : palette.cardBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.yearGridBtnText,
                            { color: isSelected ? '#FFFFFF' : palette.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {yr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {monthsInSelectedYear.length > 0 && (
              <View style={styles.jumpSectionWrap}>
                <Text style={[styles.jumpSectionLabel, { color: palette.textSecondary }]}>
                  CYCLES IN {selectedYear} ({monthsInSelectedYear.length})
                </Text>
                <View style={styles.monthChipsGrid}>
                  {monthsInSelectedYear.map((occ) => {
                    const date = new Date(occ.due_date);
                    const monthName = date.toLocaleDateString('en-IN', { month: 'short' });
                    const occAmount = Math.round(Number(occ.amount || 0) * 100);
                    const occPaid = Math.round(Number(occ.paid_amount || 0) * 100);
                    const isPaid =
                      occ.status === BILL_STATUS.PAID ||
                      Number(occ.is_paid) === 1 ||
                      Boolean(occ.is_completely_paid) ||
                      (occAmount > 0 && occPaid >= occAmount);
                    const isPartiallyPaid =
                      !isPaid &&
                      (occ.status === 'partially_paid' ||
                        occ.is_partially_paid ||
                        (occPaid > 0 && occPaid < occAmount));
                    const isSkipped = occ.status === BILL_STATUS.SKIPPED;
                    const isCurrentOcc =
                      activeOccurrenceId != null && Number(occ.id) === Number(activeOccurrenceId);

                    const statusColor = isPaid
                      ? palette.positive
                      : isPartiallyPaid
                        ? palette.info
                        : isSkipped
                          ? palette.textMuted
                          : palette.warning;
                    const statusLabel = isPaid
                      ? 'Paid'
                      : isPartiallyPaid
                        ? 'Partial'
                        : isSkipped
                          ? 'Skipped'
                          : 'Due';

                    return (
                      <TouchableOpacity
                        key={String(occ.id)}
                        activeOpacity={0.75}
                        onPress={() => {
                          onSelectOccurrence(occ);
                          onClose();
                        }}
                        style={[
                          styles.cycleCardBtn,
                          {
                            backgroundColor: isCurrentOcc
                              ? palette.positiveBg
                              : palette.surfaceSubtle,
                            borderColor: isCurrentOcc ? palette.positive : palette.cardBorder,
                            borderWidth: isCurrentOcc ? 1.5 : 1,
                          },
                        ]}
                      >
                        <View style={styles.cycleCardHeader}>
                          <View style={styles.cycleCardHeaderLeft}>
                            <View style={[styles.monthStatusDot, { backgroundColor: statusColor }]} />
                            <Text
                              style={[
                                styles.cycleMonthText,
                                {
                                  color: isCurrentOcc ? palette.positive : palette.textPrimary,
                                  fontWeight: isCurrentOcc ? '800' : '700',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {monthName}
                            </Text>
                          </View>
                          {isCurrentOcc ? (
                            <View
                              style={[
                                styles.cycleCurrentBadge,
                                { backgroundColor: palette.positive },
                              ]}
                            >
                              <Text style={styles.cycleCurrentBadgeText}>Active</Text>
                            </View>
                          ) : isPaid ? (
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={13}
                              color={palette.positive}
                            />
                          ) : null}
                        </View>
                        <View style={styles.cycleCardFooter}>
                          <Text
                            style={[
                              styles.cycleAmountText,
                              { color: isCurrentOcc ? palette.positive : palette.textPrimary },
                            ]}
                            numberOfLines={1}
                          >
                            {balanceVisible
                              ? formatCurrency(
                                  isPartiallyPaid && occ.remaining_amount != null
                                    ? occ.remaining_amount
                                    : occ.amount
                                )
                              : '••••••'}
                          </Text>
                          <Text style={[styles.cycleStatusText, { color: statusColor }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onClose}
            style={[styles.jumpCloseBtn, { backgroundColor: palette.surfaceSubtle }]}
          >
            <Text style={[styles.jumpCloseBtnText, { color: palette.textPrimary }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function LinkTransactionModal({ visible, bill, onLink, onClose, palette, isDarkMode }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [linkingId, setLinkingId] = useState(null);

  useEffect(() => {
    if (!visible || !bill) return;
    setSearch('');
    setLoading(true);
    Promise.all([getTransactionsForBillLink(bill), getSources(true)])
      .then(([txs]) => setCandidates(txs || []))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [visible, bill?.id]);

  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((tx) => {
      const notes = String(tx.notes || '').toLowerCase();
      const source = String(tx.source_name || '').toLowerCase();
      const category = String(tx.category_name || '').toLowerCase();
      const amount = String(tx.amount || '').toLowerCase();
      const date = tx.date
        ? new Date(tx.date)
            .toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
            .toLowerCase()
        : '';
      return (
        notes.includes(query) ||
        source.includes(query) ||
        category.includes(query) ||
        amount.includes(query) ||
        date.includes(query)
      );
    });
  }, [candidates, search]);

  return (
    <ResponsiveBottomSheet
      visible={visible}
      animationType="slide"
      maxHeightRatio={0.82}
      backdropColor={isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)'}
      onRequestClose={onClose}
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
                Link Transaction
              </Text>
              <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
                For "{bill?.name}" · {filteredCandidates.length} available
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.75}
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
              placeholder="Search by note, amount, account..."
              placeholderTextColor={palette.textMuted}
              value={search}
              onChangeText={setSearch}
              style={[styles.sheetSearchInput, { color: palette.textPrimary }]}
              autoCorrect={false}
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color={palette.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.modalLoadingWrap}>
              <ActivityIndicator size="small" color={palette.positive} />
              <Text style={[styles.modalLoadingText, { color: palette.textSecondary }]}>
                Finding unlinked transactions...
              </Text>
            </View>
          ) : filteredCandidates.length === 0 ? (
            <View style={styles.emptyCandidatesBox}>
              <MaterialCommunityIcons
                name="text-box-search-outline"
                size={36}
                color={palette.textMuted}
              />
              <Text style={[styles.emptyCandidatesTitle, { color: palette.textPrimary }]}>
                No matching transactions
              </Text>
              <Text style={[styles.emptyCandidatesSub, { color: palette.textSecondary }]}>
                {search
                  ? 'Try a different search term'
                  : 'Only expense transactions within 45 days can be linked.'}
              </Text>
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')} style={{ marginTop: 10 }}>
                  <Text style={{ color: palette.positive, fontWeight: '800', fontSize: 12.5 }}>
                    Clear Search
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <FlatList
              data={filteredCandidates}
              keyExtractor={(t) => String(t.id)}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: Math.max(200, maxHeight - 165) }}
              renderItem={({ item: tx }) => {
                const iconColor = tx.category_color || palette.positive;
                const iconBg = isDarkMode ? `${iconColor}2E` : `${iconColor}18`;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setLinkingId(tx.id);
                      setTimeout(async () => {
                        try {
                          await onLink(tx);
                        } finally {
                          setLinkingId(null);
                        }
                      }, 0);
                    }}
                    disabled={linkingId !== null}
                    activeOpacity={0.75}
                    style={[
                      styles.candidateRow,
                      { borderBottomColor: palette.divider },
                      linkingId !== null && linkingId !== tx.id && { opacity: 0.5 },
                    ]}
                  >
                    <View style={[styles.candidateIconWrap, { backgroundColor: iconBg }]}>
                      <MaterialCommunityIcons
                        name={tx.category_icon || 'cash'}
                        size={20}
                        color={iconColor}
                      />
                    </View>

                    <View style={styles.candidateBody}>
                      <Text
                        numberOfLines={1}
                        style={[styles.candidateNotes, { color: palette.textPrimary }]}
                      >
                        {tx.notes || 'Payment Transaction'}
                      </Text>
                      <View style={styles.candidateMetaRow}>
                        <Text style={[styles.candidateDate, { color: palette.textSecondary }]}>
                          {tx.date
                            ? new Date(tx.date).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </Text>
                        {tx.source_name ? (
                          <View
                            style={[
                              styles.candidateSourceTag,
                              { backgroundColor: palette.surfaceSubtle },
                            ]}
                          >
                            <Text
                              style={[
                                styles.candidateSourceText,
                                { color: palette.textSecondary },
                              ]}
                            >
                              {tx.source_name}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.candidateRight}>
                      <CurrencyText
                        amount={tx.amount}
                        style={[styles.candidateAmount, { color: palette.textPrimary }]}
                      />
                      {linkingId === tx.id ? (
                        <ActivityIndicator size="small" color={palette.positive} />
                      ) : (
                        <Feather name="chevron-right" size={17} color={palette.textMuted} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}
    </ResponsiveBottomSheet>
  );
}

export default function BillDetailScreen({ route, navigation }) {
  const { isDarkMode, theme } = useTheme();
  const { balanceVisible, toggleBalance } = useBalanceVisibility();
  const insets = useSafeAreaInsets();
  const rawId = route.params?.billId ?? route.params?.id;
  const occurrenceId = route.params?.occurrenceId;
  const [resolvedTemplateId, setResolvedTemplateId] = useState(null);
  const billId = resolvedTemplateId ?? rawId;

  const [bill, setBill] = useState(null);
  const [series, setSeries] = useState([]);
  const [selectedOcc, setSelectedOcc] = useState(null);
  const [linkedTxs, setLinkedTxs] = useState([]);
  const [category, setCategory] = useState(null);
  const [source, setSource] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [isDeletingOcc, setIsDeletingOcc] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showUnskipModal, setShowUnskipModal] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [isUnskipping, setIsUnskipping] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [showPaymentSourcePicker, setShowPaymentSourcePicker] = useState(false);
  const [paymentSources, setPaymentSources] = useState([]);
  const [paymentSourceSearch, setPaymentSourceSearch] = useState('');
  const [selectedCreditCard, setSelectedCreditCard] = useState(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [unlinkingTx, setUnlinkingTx] = useState(null);
  const [unlinking, setUnlinking] = useState(false);
  const [showYearJumpModal, setShowYearJumpModal] = useState(false);
  const [chartOffset, setChartOffset] = useState(0);

  const { visible: loaderVisible, show: showPageLoader, hide: hidePageLoader } = usePageLoader();
  const dispatch = useAppDispatch();
  const categoriesMap = useCategoriesMap();

  const selectedOccRef = useRef(null);
  const prevRawIdRef = useRef(rawId);

  if (prevRawIdRef.current !== rawId) {
    prevRawIdRef.current = rawId;
    selectedOccRef.current = null;
  }

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
        info: '#60A5FA',
        infoBg: 'rgba(59, 130, 246, 0.16)',
        positive: '#34D399',
        positiveBg: 'rgba(16, 185, 129, 0.14)',
        positiveBorder: 'rgba(52, 211, 153, 0.28)',
        warning: '#FBBF24',
        warningBg: 'rgba(245, 158, 11, 0.15)',
        warningBorder: 'rgba(251, 191, 36, 0.28)',
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
      info: '#2563EB',
      infoBg: '#EFF6FF',
      positive: '#059669',
      positiveBg: '#ECFDF5',
      positiveBorder: '#A7F3D0',
      warning: '#D97706',
      warningBg: '#FFFBEB',
      warningBorder: '#FDE68A',
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

  useFocusEffect(
    useCallback(() => {
      load(selectedOccRef.current?.id, selectedOccRef.current?.due_date);
    }, [rawId])
  );

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (bill) navigation.setOptions({ title: bill.name });
  }, [bill, navigation]);

  const chartData = useMemo(() => {
    return series.map((occ) => {
      const date = new Date(occ.due_date);
      return {
        id: occ.id,
        label: date.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
        due: Number(occ.amount || 0),
        paid: Number(occ.paid_amount || 0),
      };
    });
  }, [series]);

  const displayChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    const itemsToShow = 5;
    if (chartData.length <= itemsToShow) return chartData;
    const start = Math.max(0, chartData.length - itemsToShow - chartOffset);
    return chartData.slice(start, start + itemsToShow);
  }, [chartData, chartOffset]);

  const availableYears = useMemo(() => {
    if (!series || series.length === 0) return [];
    const yearSet = new Set();
    series.forEach((occ) => {
      if (occ.due_date) {
        const y = new Date(occ.due_date).getFullYear();
        if (!isNaN(y)) yearSet.add(y);
      }
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [series]);

  const yearGroups = useMemo(() => {
    const map = {};
    (series || []).forEach((occ) => {
      if (!occ.due_date) return;
      const y = new Date(occ.due_date).getFullYear();
      if (isNaN(y)) return;
      if (!map[y]) map[y] = [];
      map[y].push(occ);
    });
    return map;
  }, [series]);

  const visibleYearLabel = useMemo(() => {
    if (!displayChartData || displayChartData.length === 0) return '';
    const years = displayChartData
      .map((item) => {
        const occ = series.find((s) => Number(s.id) === Number(item.id));
        return occ?.due_date ? new Date(occ.due_date).getFullYear() : null;
      })
      .filter((y) => y != null && !isNaN(y));
    if (years.length === 0) return '';
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    return minYear === maxYear ? String(minYear) : `${minYear}-${String(maxYear).slice(2)}`;
  }, [displayChartData, series]);

  const totalDueAmount = useMemo(() => {
    return series.reduce((sum, b) => {
      if (b.status === BILL_STATUS.SKIPPED) return sum;
      return sum + Number(b.amount || 0);
    }, 0);
  }, [series]);

  const totalPaidAmount = useMemo(() => {
    return series.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0);
  }, [series]);

  const pendingAmount = Math.max(0, totalDueAmount - totalPaidAmount);

  const paidCount = useMemo(() => {
    return series.filter((b) => Number(b.paid_amount || 0) > 0).length;
  }, [series]);

  const paymentPercentage = useMemo(() => {
    if (totalDueAmount === 0) return 0;
    return Math.min(100, (totalPaidAmount / totalDueAmount) * 100);
  }, [totalDueAmount, totalPaidAmount]);

  const filteredPaymentSources = useMemo(() => {
    const q = paymentSourceSearch.trim().toLowerCase();
    if (!q) return paymentSources;
    return paymentSources.filter((s) => (s.name || '').toLowerCase().includes(q));
  }, [paymentSources, paymentSourceSearch]);

  const reduxCategory = categoriesMap?.[bill?.category_id] || category;

  if (!bill && !editing) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.positive} />
      </View>
    );
  }

  if (editing) {
    return (
      <BillForm
        bill={bill}
        onSaved={async () => {
          try {
            showPageLoader();
            setEditing(false);
            await load(selectedOcc?.id, selectedOcc?.due_date);
          } catch (e) {
            console.error('[BillDetail] Bill save refresh failed:', e);
          } finally {
            hidePageLoader();
          }
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  async function load(preserveOccId = null, preserveDueDate = null) {
    if (!rawId) {
      hidePageLoader();
      return;
    }

    showPageLoader();

    try {
      const rawBill = await getBillById(rawId);
      const templateId = rawBill?.parent_bill_id || rawId;
      setResolvedTemplateId(templateId);

      const [b, s, cats, srcs] = await Promise.all([
        getBillById(templateId),
        getBillSeries(templateId),
        getCategories(true),
        getSources(true),
      ]);

      setBill(b);
      setSeries(s || []);

      const categoryMap = {};
      (cats || []).forEach((c) => {
        categoryMap[c.id] = c;
      });
      dispatch(setCategoriesMap(categoryMap));

      if (b?.category_id) setCategory(cats.find((c) => c.id === b.category_id) || null);
      if (b?.source_id) setSource(srcs.find((ss) => ss.id === b.source_id) || null);

      const targetOccId = preserveOccId ?? selectedOccRef.current?.id;
      const targetDueDate = preserveDueDate ?? selectedOccRef.current?.due_date;

      let occ = null;
      if (targetOccId != null) {
        occ =
          s.find((o) => Number(o.id) === Number(targetOccId)) ||
          s.find((o) => String(o.id) === String(targetOccId)) ||
          null;
      }
      if (!occ && targetDueDate) {
        const targetMonth = String(targetDueDate).slice(0, 7);
        occ = s.find((o) => o.due_date && String(o.due_date).slice(0, 7) === targetMonth) || null;
      }
      if (!occ && occurrenceId) {
        const matchesTemplateOnly = s.length > 1 && Number(occurrenceId) === Number(templateId);
        if (!matchesTemplateOnly) {
          occ =
            s.find((o) => Number(o.id) === Number(occurrenceId)) ||
            s.find((o) => String(o.id) === String(occurrenceId)) ||
            null;
        }
      }
      if (!occ && s.length > 1) {
        const now = new Date();
        const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const isUnpaid = (o) =>
          o &&
          o.status !== BILL_STATUS.PAID &&
          o.status !== BILL_STATUS.SKIPPED &&
          Number(o.is_paid) !== 1 &&
          !o.is_completely_paid;
        const getDateStr = (o) => o?.due_date || o?.statement_date || o?.occurrence_date || '';

        const currentMonthOcc = s.find((o) => {
          const ds = getDateStr(o);
          return ds && ds.slice(0, 7) === curMonthStr;
        });
        const prevUnpaidOccs = s.filter((o) => {
          const ds = getDateStr(o);
          return ds && ds.slice(0, 7) < curMonthStr && isUnpaid(o);
        });

        if (currentMonthOcc && isUnpaid(currentMonthOcc)) {
          occ = currentMonthOcc;
        } else if (prevUnpaidOccs.length > 0) {
          occ = prevUnpaidOccs[prevUnpaidOccs.length - 1];
        } else if (currentMonthOcc) {
          occ = currentMonthOcc;
        } else {
          const upcoming = s.find((o) => {
            const ds = getDateStr(o);
            return ds && ds.slice(0, 7) > curMonthStr;
          });
          const rawChildMatch = rawBill?.parent_bill_id
            ? s.find((o) => Number(o.id) === Number(rawId))
            : null;
          occ = upcoming || rawChildMatch || s[s.length - 1] || null;
        }
      }
      if (!occ) {
        occ =
          (rawBill?.parent_bill_id && s.find((o) => Number(o.id) === Number(rawId))) ||
          s[s.length - 1] ||
          s[0] ||
          null;
      }

      setSelectedOcc(occ);
      selectedOccRef.current = occ;

      const itemsToShow = 5;
      if (occ && s.length > itemsToShow) {
        const idx = s.findIndex((o) => Number(o.id) === Number(occ.id));
        if (idx !== -1) {
          setChartOffset((prevOffset) => {
            const currentStart = Math.max(0, s.length - itemsToShow - prevOffset);
            const currentEnd = currentStart + itemsToShow - 1;
            if (idx >= currentStart && idx <= currentEnd) return prevOffset;
            return Math.max(0, Math.min(s.length - itemsToShow, s.length - 3 - idx));
          });
        }
      } else {
        setChartOffset(0);
      }

      if (occ) {
        setLinkedTxs(await getBillLinkedTransactions(occ.id));
        if (occ.due_date) {
          setSelectedLabel(
            new Date(occ.due_date).toLocaleDateString('en', {
              month: 'short',
              year: '2-digit',
            })
          );
        }
      }
    } catch (e) {
      console.error('[BillDetail] load failed:', e);
      setBill(null);
      setSeries([]);
      setSelectedOcc(null);
      selectedOccRef.current = null;
      setLinkedTxs([]);
    } finally {
      hidePageLoader();
    }
  }

  async function refreshSelectedOccurrence() {
    const updatedSeries = await getBillSeries(billId);
    setSeries(updatedSeries);
    const targetId = selectedOccRef.current?.id ?? selectedOcc?.id;
    const targetDate = selectedOccRef.current?.due_date ?? selectedOcc?.due_date;
    let occ = updatedSeries.find((o) => Number(o.id) === Number(targetId)) || null;
    if (!occ && targetDate) {
      const targetMonth = String(targetDate).slice(0, 7);
      occ =
        updatedSeries.find((o) => o.due_date && String(o.due_date).slice(0, 7) === targetMonth) ||
        null;
    }
    setSelectedOcc(occ);
    selectedOccRef.current = occ;
    setLinkedTxs(occ ? await getBillLinkedTransactions(occ.id) : []);
  }

  const activeBill = selectedOcc || bill;

  const handleMarkPaid = async () => {
    if (!selectedOcc && !bill) return;
    const targetBill = selectedOcc || bill;
    try {
      setIsMarkingPaid(true);
      const cards = await getCreditCards(false);
      const card = cards.find(
        (c) =>
          Number(c.payment_bill_id) === Number(targetBill.id) ||
          Number(c.payment_bill_id) === Number(targetBill.parent_bill_id)
      );

      if (!card) {
        await markBillPaid(targetBill.id, {
          source_id: targetBill.source_id,
        });
        await load(targetBill.id);
        setToastMsg(`Bill paid for ${getBillMonthYear(targetBill)}`);
        setToastVisible(true);
        setIsMarkingPaid(false);
        return;
      }

      const sources = await getSources(true);
      setPaymentSources(sources.filter((s) => Number(s.id) !== Number(card.source_id)));
      setSelectedCreditCard(card);
      setPaymentSourceSearch('');
      setIsMarkingPaid(false);
      setShowPaymentSourcePicker(true);
    } catch (e) {
      console.error('[BillDetail] Mark paid failed:', e);
      setIsMarkingPaid(false);
      Alert.alert('Error', 'Unable to mark bill as paid.');
    }
  };

  async function handleUnskip() {
    const targetBill = selectedOcc || activeBill;
    if (!targetBill) return;
    try {
      setIsUnskipping(true);
      await unskipBill(targetBill.id);
      await refreshSelectedOccurrence();
      await load(targetBill.id, targetBill.due_date);
      setShowUnskipModal(false);
      setToastMsg(`Bill reactivated for ${getBillMonthYear(targetBill)}`);
      setToastVisible(true);
    } catch (e) {
      console.error('[BillDetail] Unskip failed:', e);
      Alert.alert('Error', 'Unable to unskip this bill occurrence.');
    } finally {
      setIsUnskipping(false);
    }
  }

  async function handleLinkTransaction(tx) {
    if (!selectedOcc) return;
    try {
      showPageLoader();
      await linkAdditionalTransaction(selectedOcc.id, tx.id);
      setShowLinkModal(false);
      await refreshSelectedOccurrence();
      await load(selectedOcc.id);
      setToastMsg(`Bill paid for ${getBillMonthYear(selectedOcc)}`);
      setToastVisible(true);
    } catch (e) {
      console.error('[BillDetail] Link transaction failed:', e);
    } finally {
      hidePageLoader();
    }
  }

  async function handleConfirmUnlink() {
    if (!unlinkingTx || !selectedOcc) return;
    try {
      setUnlinking(true);
      await removeTransactionFromBill(selectedOcc.id, unlinkingTx.id);
      setUnlinkingTx(null);
      await refreshSelectedOccurrence();
      await load(selectedOcc.id);
      setToastMsg('Transaction unlinked successfully');
      setToastVisible(true);
    } catch (e) {
      console.error('[BillDetail] Unlink transaction failed:', e);
      Alert.alert('Error', 'Could not unlink transaction.');
    } finally {
      setUnlinking(false);
    }
  }

  function handleEditTransaction(tx) {
    navigation.navigate('TransactionAdd', {
      isEdit: true,
      transaction: tx,
    });
  }

  async function handleSelectOccurrence(occ) {
    setSelectedOcc(occ);
    selectedOccRef.current = occ;
    setLinkedTxs(await getBillLinkedTransactions(occ.id));
    setSelectedLabel(
      new Date(occ.due_date).toLocaleDateString('en', {
        month: 'short',
        year: '2-digit',
      })
    );
  }

  function handleJumpToOccurrence(targetOcc) {
    if (!targetOcc || !series || series.length === 0) return;
    const targetIdx = series.findIndex((o) => Number(o.id) === Number(targetOcc.id));
    if (targetIdx !== -1) {
      const itemsToShow = 5;
      const idealStart = Math.max(
        0,
        Math.min(series.length - itemsToShow, targetIdx - Math.floor(itemsToShow / 2))
      );
      const newOffset = Math.max(0, series.length - itemsToShow - idealStart);
      setChartOffset(newOffset);
    }
    handleSelectOccurrence(targetOcc);
  }

  const handleShareBill = async () => {
    try {
      const formattedDue = formatDueDate(activeBill.due_date);
      const amountStr = formatCurrency(activeBill.amount);
      const message = `Spendorax Bill Record:\n${bill.name}\nAmount: ${amountStr}\nDue Date: ${formattedDue}\nStatus: ${display?.label || 'Active'}`;
      await Share.share({ message });
    } catch (e) {
      console.error('[BillDetail] Share error:', e);
    }
  };

  function openEditBillOrOccurrence() {
    if (isCreditCardBill(activeBill)) {
      setEditing(true);
    } else {
      const targetOcc = selectedOcc || bill;
      selectedOccRef.current = targetOcc;
      navigation.navigate('BillOccurrenceEdit', { occurrence: targetOcc, bill });
    }
  }

  const paidAmount = Number(activeBill?.paid_amount ?? activeBill?.total_paid ?? 0);
  const billAmount = Number(activeBill?.amount || 0);
  const roundedPaid = Math.round(paidAmount * 100);
  const roundedAmount = Math.round(billAmount * 100);
  const remainingAmount = Math.max(0, Math.round(roundedAmount - roundedPaid) / 100);

  const display = getBillDisplayStatus(activeBill);
  const isFullyPaid =
    display?.label === 'Paid' ||
    activeBill?.status === BILL_STATUS.PAID ||
    Number(activeBill?.is_paid) === 1 ||
    Boolean(activeBill?.is_completely_paid) ||
    (roundedAmount > 0 && roundedPaid >= roundedAmount);
  const isPartiallyPaid =
    !isFullyPaid &&
    (display?.label === 'Partially Paid' ||
      activeBill?.status === 'partially_paid' ||
      Boolean(activeBill?.is_partially_paid) ||
      (roundedPaid > 0 && roundedPaid < roundedAmount));
  const isSkipped = activeBill?.status === BILL_STATUS.SKIPPED;
  const isOverdue = !isFullyPaid && !isPartiallyPaid && !isSkipped && String(display?.label || '').toLowerCase().includes('overdue');
  const isPaidOrSkipped = isFullyPaid || isSkipped;
  const isAnyLoading = isMarkingPaid || isSkipping || isUnskipping;

  const isPayable = (() => {
    if (isPaidOrSkipped) return false;
    if (!activeBill?.due_date) return true;
    const dueDate = new Date(activeBill.due_date);
    const now = new Date();
    if (bill?.recurrence_type === 'YEARLY') {
      return dueDate.getFullYear() <= now.getFullYear();
    }
    if (dueDate.getFullYear() < now.getFullYear()) return true;
    if (dueDate.getFullYear() > now.getFullYear()) return false;
    return dueDate.getMonth() <= now.getMonth();
  })();

  const statusTone = isFullyPaid
    ? {
        label: 'Fully Settled',
        pillLabel: 'Paid',
        color: palette.positive,
        bg: palette.positiveBg,
        icon: 'check-circle',
      }
    : isSkipped
      ? {
          label: 'Skipped',
          pillLabel: 'Skipped',
          color: palette.warning,
          bg: palette.warningBg,
          icon: 'skip-next-circle-outline',
        }
      : isPartiallyPaid
        ? {
            label: 'Partially Paid',
            pillLabel: 'Partially Paid',
            color: palette.info,
            bg: palette.infoBg,
            icon: 'progress-clock',
          }
        : isOverdue
          ? {
              label: display?.label || 'Overdue',
              pillLabel: 'Pending',
              color: palette.negative,
              bg: palette.negativeBg,
              icon: 'alert-circle-outline',
            }
          : {
              label: display?.label || 'Pending',
              pillLabel: 'Pending',
              color: palette.warning,
              bg: palette.warningBg,
              icon: 'clock-outline',
            };

  const catColor = reduxCategory?.color || palette.positive;
  const catAvatarBg = isDarkMode ? `${catColor}2E` : `${catColor}18`;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Sticky Top Header */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: palette.cardBg,
            borderBottomColor: palette.cardBorder,
            paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 44 : 14),
          },
        ]}
      >
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            aria-label="Go Back"
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
            style={[
              styles.headerBackButton,
              {
                backgroundColor: palette.surfaceSubtle,
                borderColor: palette.cardBorder,
              },
            ]}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={palette.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text numberOfLines={1} style={[styles.headerTitle, { color: palette.textPrimary }]}>
              Bill Details
            </Text>
            <Text numberOfLines={1} style={[styles.headerSubtitle, { color: palette.textSecondary }]}>
              {selectedLabel || formatDueDate(activeBill.due_date)}
            </Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            aria-label={balanceVisible ? 'Hide amounts' : 'Show amounts'}
            onPress={toggleBalance}
            activeOpacity={0.75}
            style={[
              styles.headerIconBtn,
              {
                backgroundColor: palette.surfaceSubtle,
                borderColor: palette.cardBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={palette.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            aria-label="Share bill record"
            onPress={handleShareBill}
            activeOpacity={0.75}
            style={[
              styles.headerIconBtn,
              {
                backgroundColor: palette.surfaceSubtle,
                borderColor: palette.cardBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="share-variant-outline"
              size={18}
              color={palette.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            aria-label="More options"
            onPress={() => setShowActionSheet(true)}
            activeOpacity={0.75}
            style={[
              styles.headerIconBtn,
              {
                backgroundColor: palette.surfaceSubtle,
                borderColor: palette.cardBorder,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="dots-horizontal"
              size={19}
              color={palette.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(120, insets.bottom + 96) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Adaptive Light / Dark Bill Overview Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.cardBorder,
              borderLeftColor: statusTone.color,
            },
            !isDarkMode && styles.cardShadowLight,
          ]}
        >
          {/* Top Row: Category Avatar + Occurrence & Status Pill */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroCategoryGroup}>
              <View style={[styles.heroCategoryAvatar, { backgroundColor: catAvatarBg }]}>
                <MaterialCommunityIcons
                  name={reduxCategory?.icon || 'receipt'}
                  size={21}
                  color={catColor}
                />
              </View>
              <View style={styles.heroHeaderTextCol}>
                <Text style={[styles.heroEyebrow, { color: palette.textSecondary }]}>
                  BILL OCCURRENCE
                </Text>
                <Text numberOfLines={1} style={[styles.heroSubMeta, { color: palette.textMuted }]}>
                  {selectedLabel || formatDueDate(activeBill.due_date)} ·{' '}
                  {formatRecurrenceType(bill.recurrence_type, bill.is_recurring)}
                </Text>
              </View>
            </View>

            <View style={[styles.heroStatusPill, { backgroundColor: statusTone.bg }]}>
              <MaterialCommunityIcons
                name={statusTone.icon}
                size={13}
                color={statusTone.color}
              />
              <Text style={[styles.heroStatusPillText, { color: statusTone.color }]}>
                {statusTone.label}
              </Text>
            </View>
          </View>

          {/* Non-Truncating 2-Line Bill Name */}
          <Text numberOfLines={2} style={[styles.heroMainTitle, { color: palette.textPrimary }]}>
            {bill.name}
          </Text>
          {bill.notes ? (
            <Text numberOfLines={2} style={[styles.heroNotesText, { color: palette.textSecondary }]}>
              {bill.notes}
            </Text>
          ) : null}

          {/* Dual Amount Panel */}
          <View
            style={[
              styles.heroAmountBox,
              {
                backgroundColor: palette.surfaceSubtle,
                borderColor: palette.cardBorder,
              },
            ]}
          >
            <View style={styles.heroAmountCol}>
              <Text style={[styles.heroAmountLabel, { color: palette.textSecondary }]}>
                {isFullyPaid || isPartiallyPaid ? 'REMAINING DUE' : 'DUE AMOUNT'}
              </Text>
              <CurrencyText
                amount={isFullyPaid ? 0 : isPartiallyPaid ? remainingAmount : activeBill.amount}
                numberOfLines={1}
                style={[styles.heroAmountValue, { color: palette.textPrimary }]}
              />
              <View style={styles.heroAmountSubRow}>
                <MaterialCommunityIcons
                  name="calendar-outline"
                  size={12}
                  color={palette.textMuted}
                />
                <Text numberOfLines={1} style={[styles.heroAmountSubText, { color: palette.textSecondary }]}>
                  {isFullyPaid || isPartiallyPaid
                    ? `Total ${balanceVisible ? formatCurrency(activeBill.amount) : '••••'}`
                    : `Due ${formatDueDate(activeBill.due_date)}`}
                </Text>
              </View>
            </View>

            <View style={[styles.heroAmountDivider, { backgroundColor: palette.cardBorder }]} />

            <View style={styles.heroAmountCol}>
              <Text style={[styles.heroAmountLabel, { color: palette.positive }]}>
                PAID AMOUNT
              </Text>
              <CurrencyText
                amount={activeBill.paid_amount || 0}
                numberOfLines={1}
                style={[styles.heroAmountValue, { color: palette.positive }]}
              />
              <View style={[styles.heroSettledBadge, { backgroundColor: statusTone.bg }]}>
                <MaterialCommunityIcons
                  name={statusTone.icon}
                  size={11}
                  color={statusTone.color}
                />
                <Text numberOfLines={1} style={[styles.heroSettledBadgeText, { color: statusTone.color }]}>
                  {isFullyPaid ? 'Fully Settled' : statusTone.pillLabel}
                </Text>
              </View>
            </View>
          </View>

          {/* 4-Tile Key Metadata Grid */}
          <View style={styles.heroMetaGrid}>
            <View
              style={[
                styles.heroMetaItem,
                {
                  backgroundColor: palette.surfaceSubtle,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <View style={[styles.heroMetaIconWrap, { backgroundColor: palette.infoBg }]}>
                <MaterialCommunityIcons
                  name="calendar-month-outline"
                  size={15}
                  color={palette.info}
                />
              </View>
              <View style={styles.heroMetaTextWrap}>
                <Text numberOfLines={1} style={[styles.heroMetaLabel, { color: palette.textMuted }]}>
                  DUE DATE
                </Text>
                <Text numberOfLines={1} style={[styles.heroMetaValue, { color: palette.textPrimary }]}>
                  {formatDueDate(activeBill.due_date)}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.heroMetaItem,
                {
                  backgroundColor: palette.surfaceSubtle,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <View style={[styles.heroMetaIconWrap, { backgroundColor: palette.positiveBg }]}>
                <MaterialCommunityIcons
                  name="shape-outline"
                  size={15}
                  color={palette.positive}
                />
              </View>
              <View style={styles.heroMetaTextWrap}>
                <Text numberOfLines={1} style={[styles.heroMetaLabel, { color: palette.textMuted }]}>
                  CATEGORY
                </Text>
                <Text numberOfLines={1} style={[styles.heroMetaValue, { color: palette.textPrimary }]}>
                  {reduxCategory?.name || 'General'}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.heroMetaItem,
                {
                  backgroundColor: palette.surfaceSubtle,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <View style={[styles.heroMetaIconWrap, { backgroundColor: palette.primarySoft }]}>
                <MaterialCommunityIcons name="bank-outline" size={15} color={palette.primary} />
              </View>
              <View style={styles.heroMetaTextWrap}>
                <Text numberOfLines={1} style={[styles.heroMetaLabel, { color: palette.textMuted }]}>
                  SOURCE
                </Text>
                <Text numberOfLines={1} style={[styles.heroMetaValue, { color: palette.textPrimary }]}>
                  {source?.name || 'Not specified'}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.heroMetaItem,
                {
                  backgroundColor: palette.surfaceSubtle,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <View style={[styles.heroMetaIconWrap, { backgroundColor: palette.positiveBg }]}>
                <MaterialCommunityIcons
                  name="calendar-sync-outline"
                  size={15}
                  color={palette.positive}
                />
              </View>
              <View style={styles.heroMetaTextWrap}>
                <Text numberOfLines={1} style={[styles.heroMetaLabel, { color: palette.textMuted }]}>
                  REPEAT
                </Text>
                <Text numberOfLines={1} style={[styles.heroMetaValue, { color: palette.textPrimary }]}>
                  {formatRecurrenceType(bill.recurrence_type, bill.is_recurring)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 2. Linked Transactions Section */}
        <LinkedTransactionsCard
          linkedTxs={linkedTxs}
          palette={palette}
          isDarkMode={isDarkMode}
          onAddMore={() => setShowLinkModal(true)}
          onUnlink={(tx) => setUnlinkingTx(tx)}
          onEdit={handleEditTransaction}
        />

        {/* 3. Series Overview Section */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.cardBorder,
            },
            !isDarkMode && styles.cardShadowLight,
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
                Series Overview
              </Text>
              <View style={[styles.seriesGreenDot, { backgroundColor: palette.positive }]} />
            </View>
            <View
              style={[
                styles.lifetimeBadge,
                {
                  backgroundColor: palette.positiveBg,
                  borderColor: palette.positiveBorder,
                },
              ]}
            >
              <MaterialCommunityIcons name="star-outline" size={13} color={palette.positive} />
              <Text style={[styles.lifetimeBadgeText, { color: palette.positive }]}>
                Lifetime Record
              </Text>
            </View>
          </View>

          <View style={styles.seriesCenterDisplay}>
            <CurrencyText
              amount={totalPaidAmount}
              style={[styles.seriesBigAmount, { color: palette.positive }]}
            />
            <View style={styles.seriesSubRow}>
              <Text style={[styles.seriesSubText, { color: palette.textSecondary }]}>
                Total Amount Settled
              </Text>
              <View style={[styles.seriesCyclesBadge, { backgroundColor: palette.positiveBg }]}>
                <Text style={[styles.seriesCyclesBadgeText, { color: palette.positive }]}>
                  {paymentPercentage.toFixed(0)}% · {series.length} Cycles
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.seriesMetricsGrid}>
            <View
              style={[
                styles.seriesMetricCard,
                {
                  backgroundColor: palette.positiveBg,
                  borderColor: palette.positiveBorder,
                },
              ]}
            >
              <View style={[styles.seriesMetricIconWrap, { backgroundColor: palette.cardBg }]}>
                <MaterialCommunityIcons name="check" size={14} color={palette.positive} />
              </View>
              <Text style={[styles.seriesMetricVal, { color: palette.textPrimary }]}>
                {paidCount}
              </Text>
              <Text style={[styles.seriesMetricLbl, { color: palette.textSecondary }]}>
                Paid Bills
              </Text>
            </View>

            <View
              style={[
                styles.seriesMetricCard,
                {
                  backgroundColor: palette.warningBg,
                  borderColor: palette.warningBorder,
                },
              ]}
            >
              <View style={[styles.seriesMetricIconWrap, { backgroundColor: palette.cardBg }]}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={palette.warning} />
              </View>
              <CurrencyText
                amount={pendingAmount}
                minimumFractionDigits={pendingAmount % 1 !== 0 ? 2 : 0}
                maximumFractionDigits={pendingAmount % 1 !== 0 ? 2 : 0}
                numberOfLines={1}
                style={[styles.seriesMetricVal, { color: palette.textPrimary }]}
              />
              <Text style={[styles.seriesMetricLbl, { color: palette.textSecondary }]}>
                Pending
              </Text>
            </View>

            <View
              style={[
                styles.seriesMetricCard,
                {
                  backgroundColor: palette.primarySoft,
                  borderColor: palette.primaryBorder,
                },
              ]}
            >
              <View style={[styles.seriesMetricIconWrap, { backgroundColor: palette.cardBg }]}>
                <MaterialCommunityIcons
                  name="text-box-outline"
                  size={14}
                  color={palette.primaryText}
                />
              </View>
              <Text style={[styles.seriesMetricVal, { color: palette.textPrimary }]}>
                {series.length}
              </Text>
              <Text style={[styles.seriesMetricLbl, { color: palette.textSecondary }]}>
                Cycles
              </Text>
            </View>
          </View>

          <View style={styles.seriesProgressWrap}>
            <View
              style={[
                styles.seriesProgressTrack,
                {
                  backgroundColor: palette.surfaceSubtle,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.seriesProgressFill,
                  {
                    width: `${paymentPercentage}%`,
                    backgroundColor: palette.positive,
                  },
                ]}
              />
            </View>
            <View style={styles.seriesProgressStats}>
              <View style={styles.settledSmallRow}>
                <View style={[styles.settledSmallDot, { backgroundColor: palette.positive }]} />
                <Text style={[styles.settledSmallText, { color: palette.positive }]}>
                  {paymentPercentage.toFixed(0)}% Settled
                </Text>
              </View>
              <Text style={[styles.settledDetailAmounts, { color: palette.textSecondary }]}>
                <CurrencyText amount={totalPaidAmount} /> of <CurrencyText amount={totalDueAmount} />
              </Text>
            </View>
          </View>
        </View>

        {/* 4. Billing History Section */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.cardBorder,
            },
            !isDarkMode && styles.cardShadowLight,
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.historyHeaderLeft}>
              <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
                Billing History
              </Text>
              <View style={[styles.countBadge, { backgroundColor: palette.badgeBg }]}>
                <Text style={[styles.countBadgeText, { color: palette.badgeText }]}>
                  {series.length}
                </Text>
              </View>

              {availableYears.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setShowYearJumpModal(true)}
                  style={[
                    styles.yearJumpPill,
                    {
                      backgroundColor: palette.surfaceSubtle,
                      borderColor: palette.cardBorder,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="calendar-search"
                    size={13}
                    color={palette.positive}
                  />
                  <Text style={[styles.yearJumpPillText, { color: palette.textPrimary }]}>
                    {visibleYearLabel || 'Year'}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={14}
                    color={palette.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.paginationGroup}>
              <TouchableOpacity
                onPress={() =>
                  setChartOffset((prev) => Math.min(Math.max(0, chartData.length - 5), prev + 1))
                }
                style={[
                  styles.paginationBtn,
                  {
                    backgroundColor: palette.surfaceSubtle,
                    borderColor: palette.cardBorder,
                  },
                  (chartData.length <= 5 || chartOffset >= chartData.length - 5) && {
                    opacity: 0.35,
                  },
                ]}
                disabled={chartData.length <= 5 || chartOffset >= chartData.length - 5}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={18}
                  color={palette.textPrimary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setChartOffset((prev) => Math.max(0, prev - 1))}
                style={[
                  styles.paginationBtn,
                  {
                    backgroundColor: palette.surfaceSubtle,
                    borderColor: palette.cardBorder,
                  },
                  chartOffset === 0 && { opacity: 0.35 },
                ]}
                disabled={chartOffset === 0}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={18}
                  color={palette.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.chartHintBanner,
              {
                backgroundColor: palette.positiveBg,
                borderColor: palette.positiveBorder,
              },
            ]}
          >
            <View style={styles.chartHintLeft}>
              <MaterialCommunityIcons
                name="gesture-tap"
                size={14}
                color={palette.positive}
              />
              <Text style={[styles.chartHintText, { color: palette.textSecondary }]}>
                Tap bar to inspect cycle
              </Text>
            </View>
            {selectedLabel ? (
              <View
                style={[
                  styles.chartActivePill,
                  {
                    backgroundColor: palette.cardBg,
                    borderColor: palette.positiveBorder,
                  },
                ]}
              >
                <View style={[styles.chartActiveDot, { backgroundColor: palette.positive }]} />
                <Text style={[styles.chartActiveText, { color: palette.positive }]}>
                  {selectedLabel}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.chartContainer}>
            <PremiumRoundedBarChart
              labels={displayChartData.map((x) => x.label)}
              ids={displayChartData.map((x) => x.id)}
              dueValues={displayChartData.map((x) => x.due)}
              paidValues={displayChartData.map((x) => x.paid)}
              width={Math.min(screenWidth, 640) - 64}
              height={155}
              baseColor={palette.positive}
              selectedLabel={selectedLabel}
              selectedId={selectedOcc?.id}
              isEmpty={displayChartData.length === 0}
              onBarPress={(data) => {
                const match = series.find((x) => Number(x.id) === Number(data.id));
                if (match) handleSelectOccurrence(match);
              }}
            />
          </View>

          <View style={[styles.reconciliationFooter, { borderTopColor: palette.divider }]}>
            <View style={styles.reconciledLeft}>
              <View style={[styles.reconciledDot, { backgroundColor: palette.positive }]} />
              <Text numberOfLines={1} style={[styles.reconciledText, { color: palette.textSecondary }]}>
                Cycle due{' '}
                <Text style={[styles.reconciledBold, { color: palette.textPrimary }]}>
                  {formatDueDate(activeBill.due_date)}
                </Text>
              </Text>
            </View>
            <TouchableOpacity activeOpacity={0.75} onPress={() => setChartOffset(0)}>
              <Text style={[styles.viewAllCyclesText, { color: palette.positive }]}>
                View Latest →
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delete Occurrence Modal */}
        <CommonBottomSheetModal
          visible={confirmVisible}
          type="danger"
          title="Delete Occurrence?"
          subtitle={`Are you sure you want to delete the occurrence for ${
            activeBill ? formatDueDate(activeBill.due_date) : ''
          }?`}
          confirmLabel="Delete Occurrence"
          cancelLabel="Keep Bill"
          loading={isDeletingOcc}
          warnings={[
            {
              title: 'Occurrence Removed',
              text: `This occurrence for ${
                activeBill ? formatDueDate(activeBill.due_date) : ''
              } will be removed.`,
            },
            {
              title: 'Schedule Intact',
              text: 'Other recurring cycles will remain unaffected.',
            },
            {
              title: 'Cannot Be Undone',
              text: 'This bill occurrence will not be recreated.',
            },
          ]}
          onCancel={() => {
            if (!isDeletingOcc) {
              setConfirmVisible(false);
              setConfirmAction(null);
            }
          }}
          onConfirm={async () => {
            if (isDeletingOcc) return;
            try {
              setIsDeletingOcc(true);
              showPageLoader();
              if (confirmAction === 'delete_occ') {
                const isTemplate = activeBill.id === bill?.id && bill?.is_recurring;
                await softDeleteBillOccurrence(activeBill.id, isTemplate, activeBill.due_date);
                selectedOccRef.current = null;
                await load();
              }
            } catch (e) {
              console.error('[BillDetail] Action failed:', e);
            } finally {
              setIsDeletingOcc(false);
              setConfirmVisible(false);
              setConfirmAction(null);
              hidePageLoader();
            }
          }}
        />

        <SkipBillModal
          visible={showSkipModal}
          bill={activeBill}
          loading={isSkipping}
          onCancel={() => !isSkipping && setShowSkipModal(false)}
          onConfirm={async () => {
            try {
              setIsSkipping(true);
              await skipBill(activeBill.id);
              await refreshSelectedOccurrence();
              await load(activeBill.id, activeBill.due_date);
              setToastMsg(`Bill skipped for ${getBillMonthYear(activeBill)}`);
              setToastVisible(true);
              setShowSkipModal(false);
            } catch (e) {
              console.error('[BillDetail] Skip failed:', e);
              Alert.alert('Error', 'Unable to skip this bill occurrence.');
            } finally {
              setIsSkipping(false);
            }
          }}
        />

        <UnskipBillModal
          visible={showUnskipModal}
          bill={activeBill}
          loading={isUnskipping}
          onCancel={() => !isUnskipping && setShowUnskipModal(false)}
          onConfirm={handleUnskip}
        />

        <LinkTransactionModal
          visible={showLinkModal}
          bill={activeBill}
          palette={palette}
          isDarkMode={isDarkMode}
          onLink={handleLinkTransaction}
          onClose={() => setShowLinkModal(false)}
        />

        <CommonBottomSheetModal
          visible={Boolean(unlinkingTx)}
          type="warning"
          icon="link-variant-off"
          title="Unlink Transaction?"
          subtitle="Are you sure you want to remove this linked transaction from the bill?"
          confirmLabel="Unlink"
          cancelLabel="Cancel"
          confirmIcon="link-variant-off"
          loading={unlinking}
          warningTitle="Unlinking Notice"
          warnings={[
            {
              title: 'Transaction Unlinked',
              text: 'This transaction will be disconnected from the bill.',
            },
            {
              title: 'Bill Status Updated',
              text: 'Unlinking recalculates paid amount; bill may return to unpaid/pending dues.',
            },
            {
              title: 'Expense Kept',
              text: 'The expense transaction itself remains in your account records.',
            },
          ]}
          onCancel={() => {
            if (!unlinking) setUnlinkingTx(null);
          }}
          onConfirm={handleConfirmUnlink}
        />

        <YearQuickJumpModal
          visible={showYearJumpModal}
          onClose={() => setShowYearJumpModal(false)}
          series={series}
          availableYears={availableYears}
          yearGroups={yearGroups}
          activeYear={
            activeBill?.due_date ? new Date(activeBill.due_date).getFullYear() : availableYears[0]
          }
          activeOccurrenceId={activeBill?.id}
          onSelectOccurrence={handleJumpToOccurrence}
          palette={palette}
          isDarkMode={isDarkMode}
          balanceVisible={balanceVisible}
        />
      </ScrollView>

      {/* Clean Uncluttered Bottom Action Dock (Primary Action + Actions Sheet Trigger) */}
      <View
        style={[
          styles.bottomDock,
          {
            backgroundColor: palette.cardBg,
            borderTopColor: palette.cardBorder,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 12),
          },
        ]}
      >
        {isPayable ? (
          <TouchableOpacity
            style={[
              styles.primaryPayButton,
              { backgroundColor: isOverdue ? palette.negative : palette.positive },
              isAnyLoading && { opacity: 0.6 },
            ]}
            onPress={handleMarkPaid}
            disabled={isAnyLoading}
            activeOpacity={0.85}
          >
            {isMarkingPaid ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons name="check-circle" color="#FFFFFF" size={18} />
            )}
            <Text style={styles.primaryPayText}>
              {isPartiallyPaid
                ? `Pay Remaining (${balanceVisible ? formatCurrency(remainingAmount) : '••••'})`
                : 'Mark as Paid'}
            </Text>
          </TouchableOpacity>
        ) : activeBill.status === BILL_STATUS.SKIPPED ? (
          <TouchableOpacity
            style={[
              styles.primaryPayButton,
              { backgroundColor: palette.primary },
              isAnyLoading && { opacity: 0.6 },
            ]}
            onPress={() => setShowUnskipModal(true)}
            disabled={isAnyLoading}
            activeOpacity={0.85}
          >
            {isUnskipping ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons name="undo" color="#FFFFFF" size={18} />
            )}
            <Text style={styles.primaryPayText}>Reactivate Bill</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.primaryPayButton,
              { backgroundColor: palette.positiveSoft || palette.positiveBg, borderWidth: 1, borderColor: palette.positiveBorder },
            ]}
            onPress={() => setShowLinkModal(true)}
            disabled={isAnyLoading}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="link-variant" color={palette.positive} size={18} />
            <Text style={[styles.primaryPayText, { color: palette.positive }]}>
              Link Payment
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowActionSheet(true)}
          disabled={isAnyLoading}
          style={[
            styles.dockActionsBtn,
            {
              backgroundColor: palette.surfaceSubtle,
              borderColor: palette.cardBorder,
            },
          ]}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={20} color={palette.textPrimary} />
          <Text style={[styles.dockActionsBtnText, { color: palette.textPrimary }]}>Actions</Text>
        </TouchableOpacity>
      </View>

      {/* BILL DETAIL ACTIONS SHEET (Hidden Edit / Delete / Skip / Link / Share Hub) */}
      <ResponsiveBottomSheet
        visible={showActionSheet}
        animationType="slide"
        maxHeightRatio={0.78}
        backdropColor={isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)'}
        onRequestClose={() => setShowActionSheet(false)}
        sheetStyle={[
          styles.actionSheetContainer,
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
                    Manage Occurrence
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
                    {bill.name} · {selectedLabel || formatDueDate(activeBill.due_date)}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setShowActionSheet(false)}
                  accessibilityLabel="Close actions"
                  style={[styles.sheetCloseBtn, { backgroundColor: palette.surfaceSubtle }]}
                >
                  <MaterialCommunityIcons name="close" size={18} color={palette.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Two-Column Edit & Delete Tiles */}
              <View style={styles.actionTilesRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowActionSheet(false);
                    openEditBillOrOccurrence();
                  }}
                  style={[
                    styles.actionTile,
                    {
                      backgroundColor: palette.editBg,
                      borderColor: palette.editBorder,
                    },
                  ]}
                >
                  <View style={[styles.actionTileIconCircle, { backgroundColor: palette.cardBg }]}>
                    <Feather name="edit-2" size={18} color={palette.editIcon} />
                  </View>
                  <Text style={[styles.actionTileTitle, { color: palette.textPrimary }]}>
                    {isCreditCardBill(activeBill) ? 'Edit Bill' : 'Edit Cycle'}
                  </Text>
                  <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                    Update amount or date
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowActionSheet(false);
                    setConfirmAction('delete_occ');
                    setConfirmVisible(true);
                  }}
                  style={[
                    styles.actionTile,
                    {
                      backgroundColor: palette.deleteBg,
                      borderColor: palette.deleteBorder,
                    },
                  ]}
                >
                  <View style={[styles.actionTileIconCircle, { backgroundColor: palette.cardBg }]}>
                    <Feather name="trash-2" size={18} color={palette.deleteIcon} />
                  </View>
                  <Text style={[styles.actionTileTitle, { color: palette.deleteIcon }]}>
                    Delete Cycle
                  </Text>
                  <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                    Remove occurrence
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Quick Rows */}
              {!isPaidOrSkipped && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowActionSheet(false);
                    setShowSkipModal(true);
                  }}
                  style={[
                    styles.sheetActionStrip,
                    {
                      backgroundColor: palette.surfaceSubtle,
                      borderColor: palette.cardBorder,
                      marginBottom: 8,
                    },
                  ]}
                >
                  <View style={[styles.sheetStripIcon, { backgroundColor: palette.warningBg }]}>
                    <MaterialCommunityIcons
                      name="skip-next-circle-outline"
                      size={18}
                      color={palette.warning}
                    />
                  </View>
                  <View style={styles.sheetStripText}>
                    <Text style={[styles.sheetStripTitle, { color: palette.textPrimary }]}>
                      Skip This Period
                    </Text>
                    <Text style={[styles.sheetStripSub, { color: palette.textSecondary }]}>
                      Mark this cycle as intentionally skipped
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={palette.textMuted} />
                </TouchableOpacity>
              )}

              {activeBill.status === BILL_STATUS.SKIPPED && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowActionSheet(false);
                    setShowUnskipModal(true);
                  }}
                  style={[
                    styles.sheetActionStrip,
                    {
                      backgroundColor: palette.surfaceSubtle,
                      borderColor: palette.cardBorder,
                      marginBottom: 8,
                    },
                  ]}
                >
                  <View style={[styles.sheetStripIcon, { backgroundColor: palette.infoBg }]}>
                    <MaterialCommunityIcons name="undo" size={18} color={palette.info} />
                  </View>
                  <View style={styles.sheetStripText}>
                    <Text style={[styles.sheetStripTitle, { color: palette.textPrimary }]}>
                      Reactivate Cycle
                    </Text>
                    <Text style={[styles.sheetStripSub, { color: palette.textSecondary }]}>
                      Restore skipped bill back to due schedule
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={palette.textMuted} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setShowActionSheet(false);
                  setShowLinkModal(true);
                }}
                style={[
                  styles.sheetActionStrip,
                  {
                    backgroundColor: palette.surfaceSubtle,
                    borderColor: palette.cardBorder,
                    marginBottom: 8,
                  },
                ]}
              >
                <View style={[styles.sheetStripIcon, { backgroundColor: palette.positiveBg }]}>
                  <MaterialCommunityIcons name="link-variant" size={18} color={palette.positive} />
                </View>
                <View style={styles.sheetStripText}>
                  <Text style={[styles.sheetStripTitle, { color: palette.textPrimary }]}>
                    Link Payment Transaction
                  </Text>
                  <Text style={[styles.sheetStripSub, { color: palette.textSecondary }]}>
                    Attach an existing expense record
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={palette.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setShowActionSheet(false);
                  handleShareBill();
                }}
                style={[
                  styles.sheetActionStrip,
                  {
                    backgroundColor: palette.surfaceSubtle,
                    borderColor: palette.cardBorder,
                  },
                ]}
              >
                <View style={[styles.sheetStripIcon, { backgroundColor: palette.primarySoft }]}>
                  <MaterialCommunityIcons
                    name="share-variant-outline"
                    size={18}
                    color={palette.primary}
                  />
                </View>
                <View style={styles.sheetStripText}>
                  <Text style={[styles.sheetStripTitle, { color: palette.textPrimary }]}>
                    Share Bill Summary
                  </Text>
                  <Text style={[styles.sheetStripSub, { color: palette.textSecondary }]}>
                    Send due amount and schedule details
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={palette.textMuted} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </ResponsiveBottomSheet>

      {/* Credit Card Payment Source Picker */}
      <ResponsiveBottomSheet
        visible={showPaymentSourcePicker}
        animationType="slide"
        maxHeightRatio={0.74}
        backdropColor={isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)'}
        onRequestClose={() => {
          setShowPaymentSourcePicker(false);
          setSelectedCreditCard(null);
          setPaymentSourceSearch('');
          setIsMarkingPaid(false);
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
                  Choose the account to record this card payment
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowPaymentSourcePicker(false);
                  setSelectedCreditCard(null);
                  setPaymentSourceSearch('');
                  setIsMarkingPaid(false);
                }}
                activeOpacity={0.75}
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
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: Math.max(180, maxHeight - 150) }}
            >
              {filteredPaymentSources.map((sItem) => (
                <TouchableOpacity
                  key={sItem.id}
                  activeOpacity={0.75}
                  style={[styles.paymentSourceRow, { borderBottomColor: palette.divider }]}
                  onPress={async () => {
                    try {
                      setIsMarkingPaid(true);
                      const paymentId = await payCreditCardBill({
                        bill: activeBill,
                        card: selectedCreditCard,
                        paymentSourceId: sItem.id,
                      });
                      await markBillPaid(activeBill.id, {
                        createTransaction: false,
                        existingTransactionId: paymentId,
                      });
                      try {
                        await onStatementPaid(selectedCreditCard.id);
                      } catch (e) {
                        console.warn('[BillDetailScreen] onStatementPaid failed:', e);
                      }
                      setShowPaymentSourcePicker(false);
                      setSelectedCreditCard(null);
                      setPaymentSourceSearch('');
                      await load(activeBill.id, activeBill.due_date);
                      setToastMsg(`Bill paid for ${getBillMonthYear(activeBill)}`);
                      setToastVisible(true);
                    } catch (e) {
                      console.error('[BillDetail] Credit card payment failed:', e);
                      Alert.alert('Error', 'Unable to complete payment.');
                    } finally {
                      setIsMarkingPaid(false);
                    }
                  }}
                >
                  <View style={[styles.paymentSourceIconWrap, { backgroundColor: palette.positiveBg }]}>
                    <MaterialCommunityIcons
                      name={sItem.icon || 'wallet'}
                      size={20}
                      color={palette.positive}
                    />
                  </View>
                  <Text style={[styles.paymentSourceName, { color: palette.textPrimary }]}>
                    {sItem.name}
                  </Text>
                  <Feather name="chevron-right" size={18} color={palette.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ResponsiveBottomSheet>

      {isMarkingPaid && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <View
            style={[
              styles.loadingCard,
              {
                backgroundColor: palette.cardBg,
                borderColor: palette.cardBorder,
                borderWidth: 1,
              },
            ]}
          >
            <ActivityIndicator size="large" color={palette.positive} />
            <Text style={[styles.loadingText, { color: palette.textPrimary }]}>
              Processing payment...
            </Text>
          </View>
        </View>
      )}

      <Snackbar
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
        duration={3000}
        style={[styles.snackbar, { backgroundColor: palette.positive }]}
        action={{
          label: 'OK',
          textColor: '#FFFFFF',
          onPress: () => setToastVisible(false),
        }}
      >
        <Text style={styles.snackbarText}>{toastMsg}</Text>
      </Snackbar>

      <PageLoader visible={loaderVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },

  /* Sticky Top Bar */
  topBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 50,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  headerBackButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    marginLeft: 10,
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 35,
    height: 35,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Adaptive Hero Card */
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  heroCategoryGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  heroCategoryAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  heroHeaderTextCol: {
    marginLeft: 10,
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  heroSubMeta: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
    flexShrink: 0,
  },
  heroStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroMainTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 27,
    marginBottom: 4,
  },
  heroNotesText: {
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 10,
  },
  heroAmountBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 6,
    marginBottom: 12,
  },
  heroAmountCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  heroAmountDivider: {
    width: 1,
    marginHorizontal: 12,
  },
  heroAmountLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  heroAmountValue: {
    fontSize: 21,
    fontWeight: '900',
    marginTop: 3,
    letterSpacing: -0.4,
  },
  heroAmountSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 4,
  },
  heroAmountSubText: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  heroSettledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
    alignSelf: 'flex-start',
    marginTop: 5,
    gap: 4,
  },
  heroSettledBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  heroMetaItem: {
    width: '48.8%',
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMetaIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 9,
    flexShrink: 0,
  },
  heroMetaTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroMetaLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  heroMetaValue: {
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 1,
  },

  /* Section Card */
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  /* Linked Transactions */
  linkNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  linkNewBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyLinkedCard: {
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyLinkedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyLinkedTitle: {
    fontWeight: '800',
    fontSize: 14,
  },
  emptyLinkedSub: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 250,
  },
  linkedTxItem: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  linkedTxTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  txAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  txAvatarText: {
    fontSize: 11,
    fontWeight: '800',
  },
  txDetailsCol: {
    flex: 1,
    minWidth: 0,
    marginLeft: 11,
    marginRight: 8,
  },
  txTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  verifiedTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 5,
  },
  txDateText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  txBullet: {
    fontSize: 10,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    maxWidth: 110,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  txAmountText: {
    fontSize: 14.5,
    fontWeight: '900',
    marginTop: 4,
  },
  unlinkBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  /* Series Overview */
  seriesGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 7,
  },
  lifetimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    gap: 4,
  },
  lifetimeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  seriesCenterDisplay: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  seriesBigAmount: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  seriesSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 8,
  },
  seriesSubText: {
    fontSize: 12,
    fontWeight: '600',
  },
  seriesCyclesBadge: {
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  seriesCyclesBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  seriesMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  seriesMetricCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  seriesMetricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  seriesMetricVal: {
    fontSize: 15,
    fontWeight: '900',
  },
  seriesMetricLbl: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 2,
  },
  seriesProgressWrap: {
    marginTop: 14,
  },
  seriesProgressTrack: {
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  seriesProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  seriesProgressStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  settledSmallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  settledSmallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  settledSmallText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  settledDetailAmounts: {
    fontSize: 11.5,
    fontWeight: '600',
  },

  /* Billing History */
  historyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    gap: 4,
  },
  yearJumpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 11,
    borderWidth: 1,
    marginLeft: 4,
    gap: 4,
  },
  yearJumpPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  paginationGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  paginationBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginBottom: 10,
  },
  chartHintLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartHintText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  chartActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    gap: 5,
  },
  chartActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  chartActiveText: {
    fontSize: 11,
    fontWeight: '800',
  },
  chartContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  reconciliationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 6,
  },
  reconciledLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 6,
  },
  reconciledDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  reconciledText: {
    fontSize: 11.5,
    flex: 1,
  },
  reconciledBold: {
    fontWeight: '800',
  },
  viewAllCyclesText: {
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* Bottom Action Dock */
  bottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 50,
  },
  primaryPayButton: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryPayText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14.5,
  },
  dockActionsBtn: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dockActionsBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },

  /* Bottom Sheets & Action Tiles */
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
  sheetActionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  sheetStripIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sheetStripText: {
    flex: 1,
    minWidth: 0,
  },
  sheetStripTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  sheetStripSub: {
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

  /* Jump Modal */
  unlinkModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  unlinkModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  jumpModalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '84%',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'center',
  },
  jumpModalHeader: {
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  jumpIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  jumpModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 3,
  },
  jumpModalSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  jumpModalScroll: {
    width: '100%',
    flexShrink: 1,
    flexGrow: 0,
  },
  jumpModalScrollContent: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 4,
  },
  jumpShortcutsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  jumpShortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  jumpShortcutText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  jumpSectionWrap: {
    width: '100%',
    marginBottom: 12,
  },
  jumpSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
    marginBottom: 7,
  },
  jumpYearGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  yearGridBtn: {
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  yearGridBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  monthChipsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    paddingVertical: 2,
  },
  cycleCardBtn: {
    width: '48.5%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  cycleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  cycleCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 4,
  },
  monthStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  cycleMonthText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cycleCurrentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  cycleCurrentBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  cycleCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    width: '100%',
  },
  cycleAmountText: {
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1,
    marginRight: 4,
  },
  cycleStatusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  jumpCloseBtn: {
    width: '100%',
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  jumpCloseBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },

  /* Candidate Link Rows & Pickers */
  modalLoadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  modalLoadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCandidatesBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyCandidatesTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    marginTop: 8,
  },
  emptyCandidatesSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  candidateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  candidateBody: {
    flex: 1,
    minWidth: 0,
  },
  candidateNotes: {
    fontWeight: '700',
    fontSize: 13.5,
  },
  candidateMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  candidateDate: {
    fontSize: 11.5,
  },
  candidateSourceTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  candidateSourceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  candidateRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 6,
  },
  candidateAmount: {
    fontWeight: '800',
    fontSize: 14,
  },
  paymentSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  paymentSourceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentSourceName: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 28, 48, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  loadingCard: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  snackbar: {
    position: 'absolute',
    bottom: 84,
    left: 16,
    right: 16,
    borderRadius: 12,
  },
  snackbarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
