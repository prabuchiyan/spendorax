import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
  Alert,
  Platform,
  StyleSheet,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getBillsForTransaction,
  unlinkBillFromTransaction,
  linkBillToTransaction,
  getAvailableBillsForTransactionLink,
  getTransferInfoForTransaction,
} from '../services/bills';
import { Colors } from './Theme';
import { useTheme } from '../context/ThemeContext';
import { formatDueDate, getBillDisplayStatus } from '../services/billUtils';
import CurrencyText from './CurrencyText';

export default function LinkedBillCard({
  transactionId,
  onPressBill,
  onBillsChanged,
}) {
  const [bills, setBills] = useState([]);
  const [transferInfo, setTransferInfo] = useState(null);
  const [selectedLeg, setSelectedLeg] = useState('expense');
  const [loading, setLoading] = useState(true);
  const { isDarkMode, theme } = useTheme();

  // Unlinking confirmation state
  const [unlinkingBill, setUnlinkingBill] = useState(null);
  const [unlinking, setUnlinking] = useState(false);

  // Link Bill Modal state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [linkingId, setLinkingId] = useState(null);

  const loadBills = useCallback(() => {
    if (!transactionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      getBillsForTransaction(transactionId, true),
      getTransferInfoForTransaction(transactionId),
    ])
      .then(([result, tInfo]) => {
        setBills(result || []);
        setTransferInfo(tInfo);
        setSelectedLeg('expense');
      })
      .catch((err) => {
        console.warn('[LinkedBillCard] Error loading bills:', err);
        setBills([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [transactionId]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  // Load available bills when modal opens
  useEffect(() => {
    if (!showLinkModal || !transactionId) return;
    setLoadingCandidates(true);
    setSearchText('');
    getAvailableBillsForTransactionLink(transactionId)
      .then((list) => {
        setCandidates(list || []);
      })
      .catch((err) => {
        console.warn('[LinkedBillCard] Error loading candidate bills:', err);
        setCandidates([]);
      })
      .finally(() => {
        setLoadingCandidates(false);
      });
  }, [showLinkModal, transactionId]);

  // Confirm and execute unlinking
  const handleConfirmUnlink = async () => {
    if (!unlinkingBill || !transactionId) return;
    try {
      setUnlinking(true);
      await unlinkBillFromTransaction(unlinkingBill.id, transactionId);
      setUnlinkingBill(null);
      loadBills();
      if (onBillsChanged) onBillsChanged();
    } catch (err) {
      console.error('[LinkedBillCard] Failed to unlink bill:', err);
      Alert.alert('Unlink Failed', err?.message || 'Could not unlink the bill.');
    } finally {
      setUnlinking(false);
    }
  };

  // Link selected candidate bill
  const handleSelectBillToLink = async (bill) => {
    if (!bill || !transactionId) return;
    try {
      setLinkingId(bill.id);
      await linkBillToTransaction(bill.id, transactionId, selectedLeg);
      setShowLinkModal(false);
      loadBills();
      if (onBillsChanged) onBillsChanged();
    } catch (err) {
      console.error('[LinkedBillCard] Failed to link bill:', err);
      Alert.alert('Link Failed', err?.message || 'Could not link the bill.');
    } finally {
      setLinkingId(null);
    }
  };

  // Filter candidates by search text
  const filteredCandidates = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((b) => {
      const name = String(b.name || '').toLowerCase();
      const amount = String(b.amount || '').toLowerCase();
      const remaining = String(b.remaining_amount != null ? b.remaining_amount : '').toLowerCase();
      const totalPaid = String(b.total_paid != null ? b.total_paid : '').toLowerCase();
      const notes = String(b.notes || '').toLowerCase();
      return (
        name.includes(q) ||
        amount.includes(q) ||
        remaining.includes(q) ||
        totalPaid.includes(q) ||
        notes.includes(q)
      );
    });
  }, [candidates, searchText]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: theme.isDark ? 1 : 0 }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <MaterialCommunityIcons
            name="file-document-outline"
            size={16}
            color={Colors.primary}
          />
          <Text style={[styles.headerText, { color: theme.textPrimary }]}>
            Linked Bill{bills.length > 1 ? 's' : ''}
          </Text>
          {bills.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{bills.length}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowLinkModal(true)}
          style={styles.linkHeaderBtn}
        >
          <MaterialCommunityIcons
            name="link-plus"
            size={14}
            color="#ffffff"
            style={{ marginRight: 3 }}
          />
          <Text style={styles.linkHeaderBtnText}>Link Bill</Text>
        </TouchableOpacity>
      </View>

      {/* Empty State */}
      {bills.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: theme.isDark ? "#1E293B" : "#FFFFFF", borderColor: theme.border }]}>
          <MaterialCommunityIcons
            name="link-variant-off"
            size={22}
            color="#94A3B8"
            style={{ marginRight: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.emptyText}>No bill currently linked</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowLinkModal(true)}
            style={[styles.emptyLinkBtn, { backgroundColor: theme.isDark ? "#1E293B" : "#EEF2FF" }]}
          >
            <Text style={styles.emptyLinkBtnText}>+ Link to Bill</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Bills List */
        bills.map((bill) => {
          const isDeleted =
            bill.is_deleted ||
            bill.status === 'deleted' ||
            Boolean(bill.deleted_at);
          const display = isDeleted
            ? { label: 'Deleted', color: '#EF4444' }
            : getBillDisplayStatus(bill);

          return (
            <View
              key={bill.id}
              style={[
                styles.billRow, { backgroundColor: theme.isDark ? "#1E293B" : "#FFFFFF" },
                { borderLeftColor: display.color },
                isDeleted && styles.billRowDeleted,
              ]}
            >
              <TouchableOpacity
                activeOpacity={onPressBill && !isDeleted ? 0.7 : 1}
                onPress={() => {
                  if (isDeleted) {
                    Alert.alert(
                      'Deleted Bill',
                      'This bill was previously deleted. Tap the unlink button on the right to remove its link.',
                    );
                    return;
                  }
                  if (onPressBill) onPressBill(bill);
                }}
                style={styles.billContentArea}
              >
                {/* Status dot */}
                <View
                  style={[styles.dot, { backgroundColor: display.color }]}
                />

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Text style={[styles.billName, { color: theme.textPrimary }]} numberOfLines={1}>
                      {bill.name}
                    </Text>
                    {isDeleted && (
                      <View style={styles.deletedTag}>
                        <Text style={styles.deletedTagText}>Deleted</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.billSub, { color: theme.textSecondary }]}>
                    {isDeleted
                      ? `Due ${formatDueDate(bill.due_date)}  ·  Deleted Bill`
                      : bill.is_partially_paid || (Number(bill.paid_amount || 0) > 0 && Number(bill.paid_amount || 0) < Number(bill.amount || 0))
                      ? `Due ${formatDueDate(bill.due_date)}  ·  ₹${Number(bill.paid_amount || 0).toLocaleString()} of ₹${Number(bill.amount || 0).toLocaleString()} paid`
                      : `Due ${formatDueDate(bill.due_date)}${
                          bill.linked_tx_count > 1
                            ? `  ·  ${bill.linked_tx_count} payments linked`
                            : bill.is_recurring
                            ? `  ·  ${bill.recurrence_type}`
                            : ''
                        }`}
                  </Text>
                </View>

                {/* Amount + status badge */}
                <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                  <CurrencyText
                    style={[styles.billAmount, { color: display.color }]}
                    amount={bill.amount}
                  />
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: `${display.color}20` },
                    ]}
                  >
                    <Text
                      style={[styles.badgeText, { color: display.color }]}
                    >
                      {display.label}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Unlink Action Button */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setUnlinkingBill(bill)}
                style={styles.unlinkBtn}
                accessibilityLabel="Unlink Bill"
              >
                <MaterialCommunityIcons
                  name="link-variant-off"
                  size={18}
                  color="#E11D48"
                />
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {/* Premium Unlink Confirmation Modal */}
      <Modal
        visible={!!unlinkingBill}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!unlinking) setUnlinkingBill(null);
        }}
      >
        <Pressable
          style={styles.unlinkModalOverlay}
          onPress={() => {
            if (!unlinking) setUnlinkingBill(null);
          }}
        >
          <Pressable
            style={[styles.unlinkModalCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: theme.isDark ? 1 : 0 }]}
            onPress={(e) => {
              if (e && e.stopPropagation) e.stopPropagation();
            }}
          >
            {/* Top decorative danger badge */}
            <View style={styles.unlinkIconCircle}>
              <MaterialCommunityIcons
                name="link-variant-off"
                size={28}
                color="#EF4444"
              />
            </View>

            {/* Title & Subtitle */}
            <Text style={[styles.unlinkModalTitle, { color: theme.textPrimary }]}>
              {unlinkingBill?.is_deleted || unlinkingBill?.deleted_at
                ? 'Unlink Deleted Bill?'
                : 'Unlink Bill?'}
            </Text>

            <Text style={[styles.unlinkModalSubtitle, { color: theme.textSecondary }]}>
              {unlinkingBill?.is_deleted || unlinkingBill?.deleted_at
                ? 'This bill was previously deleted. Unlinking will remove the link from this transaction.'
                : 'Are you sure you want to unlink this bill? The bill will be returned to pending status.'}
            </Text>

            {/* Bill Details Preview Card */}
            {unlinkingBill && (
              <View style={[styles.unlinkBillPreview, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <View style={styles.unlinkBillIconWrap}>
                  <MaterialCommunityIcons
                    name={
                      unlinkingBill.notes?.startsWith('Statement ')
                        ? 'credit-card-outline'
                        : 'file-document-outline'
                    }
                    size={20}
                    color="#EF4444"
                  />
                </View>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.unlinkBillPreviewName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {unlinkingBill.name}
                  </Text>
                  <Text style={[styles.unlinkBillPreviewSub, { color: theme.textSecondary }]}>
                    {unlinkingBill.due_date
                      ? `Due ${formatDueDate(unlinkingBill.due_date)}`
                      : 'No due date'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.unlinkBillPreviewAmount, { color: theme.textPrimary }]}>
                    <CurrencyText amount={Number(unlinkingBill.amount || 0)} />
                  </Text>
                  {unlinkingBill.is_deleted || unlinkingBill.deleted_at ? (
                    <View style={styles.unlinkDeletedTag}>
                      <Text style={styles.unlinkDeletedTagText}>Deleted</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}

            {/* Warning Note Pill */}
            <View style={styles.unlinkWarningBox}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={16}
                color="#D97706"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.unlinkWarningText}>
                {unlinkingBill?.is_deleted || unlinkingBill?.deleted_at
                  ? 'Transaction link will be cleared.'
                  : 'Bill will be marked as unpaid & statements will sync.'}
              </Text>
            </View>

            {/* Action Buttons Row */}
            <View style={styles.unlinkActionRow}>
              <TouchableOpacity
                style={[styles.unlinkCancelBtn, { backgroundColor: theme.isDark ? '#334155' : '#F1F5F9' }]}
                activeOpacity={0.7}
                onPress={() => setUnlinkingBill(null)}
                disabled={unlinking}
              >
                <Text style={[styles.unlinkCancelBtnText, { color: theme.isDark ? '#F3F4F6' : '#475569' }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.unlinkConfirmBtn}
                activeOpacity={0.8}
                onPress={handleConfirmUnlink}
                disabled={unlinking}
              >
                {unlinking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="link-variant-off"
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.unlinkConfirmBtnText}>Unlink</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Link Bill Modal */}
      <Modal
        visible={showLinkModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLinkModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: theme.cardBg }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalHeaderTitle, { color: theme.textPrimary }]}>Link to a Bill</Text>
                <Text style={[styles.modalHeaderSubtitle, { color: theme.textSecondary }]}>
                  Select an active bill to associate with this transaction
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowLinkModal(false)}
                activeOpacity={0.7}
                style={styles.modalCloseBtn}
              >
                <MaterialCommunityIcons name="close" size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Transfer Leg Option Selector */}
            {transferInfo && (
              <View style={[styles.transferLegBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Text style={[styles.transferLegBoxLabel, { color: theme.textSecondary }]}>Link Bill To:</Text>
                <View style={styles.transferLegRow}>
                  <TouchableOpacity
                    style={[
                      styles.transferLegChip,
                      selectedLeg === 'expense' && styles.transferLegChipActiveExpense,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedLeg('expense')}
                  >
                    <MaterialCommunityIcons
                      name={selectedLeg === 'expense' ? 'radiobox-marked' : 'radiobox-blank'}
                      size={16}
                      color={selectedLeg === 'expense' ? '#DC2626' : '#64748b'}
                      style={{ marginRight: 6 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.transferLegChipTitle, { color: theme.textPrimary },
                          selectedLeg === 'expense' && styles.transferLegChipTitleActiveExpense,
                        ]}
                      >
                        Expense ({transferInfo.expenseSourceName || 'Source Account'})
                      </Text>
                      <Text style={[styles.transferLegChipSub, { color: theme.textSecondary }]}>Outflow payment (Recommended)</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.transferLegChip,
                      selectedLeg === 'credit' && styles.transferLegChipActiveCredit,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedLeg('credit')}
                  >
                    <MaterialCommunityIcons
                      name={selectedLeg === 'credit' ? 'radiobox-marked' : 'radiobox-blank'}
                      size={16}
                      color={selectedLeg === 'credit' ? '#16A34A' : '#64748b'}
                      style={{ marginRight: 6 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.transferLegChipTitle,
                          selectedLeg === 'credit' && styles.transferLegChipTitleActiveCredit,
                        ]}
                      >
                        Credit ({transferInfo.creditSourceName || 'Destination Account'})
                      </Text>
                      <Text style={[styles.transferLegChipSub, { color: theme.textSecondary }]}>Inflow receipt</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Search Input */}
            <View style={[styles.searchContainer, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color="#7c839b"
                style={{ marginLeft: 10, marginRight: 8 }}
              />
              <TextInput
                placeholder="Search bills by name or amount..."
                value={searchText}
                onChangeText={setSearchText}
                style={[styles.searchInput, { color: theme.textPrimary }]}
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
              />
              {searchText ? (
                <TouchableOpacity
                  onPress={() => setSearchText('')}
                  style={{ padding: 6, marginRight: 4 }}
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color="#94a3b8"
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Candidates List */}
            {loadingCandidates ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>
                  Finding available bills...
                </Text>
              </View>
            ) : filteredCandidates.length === 0 ? (
              <View style={styles.emptyCandidatesBox}>
                <MaterialCommunityIcons
                  name="file-search-outline"
                  size={40}
                  color="#94a3b8"
                />
                <Text style={[styles.emptyCandidatesTitle, { color: theme.textPrimary }]}>
                  No matching bills found
                </Text>
                <Text style={[styles.emptyCandidatesSub, { color: theme.textSecondary }]}>
                  {searchText
                    ? 'Try adjusting your search criteria'
                    : 'All active bills are already linked or no pending bills exist.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredCandidates}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 380 }}
                renderItem={({ item }) => {
                  const display = getBillDisplayStatus(item);
                  const isLinking = linkingId === item.id;

                  return (
                    <TouchableOpacity
                      style={[styles.candidateRow, { borderBottomColor: theme.border }]}
                      activeOpacity={0.7}
                      disabled={isLinking}
                      onPress={() => handleSelectBillToLink(item)}
                    >
                      <View
                        style={[styles.dot, { backgroundColor: display.color }]}
                      />
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.candidateName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.candidateSub, { color: theme.textSecondary }]}>
                          Due {formatDueDate(item.due_date)}
                          {item.is_partially_paid
                            ? ` · ₹${Number(item.total_paid || 0).toLocaleString()} of ₹${Number(item.amount || 0).toLocaleString()} paid`
                            : item.is_completely_paid
                            ? ' · Fully Settled'
                            : item.is_recurring
                            ? ` · ${item.recurrence_type}`
                            : ''}
                        </Text>
                      </View>
                      <View
                        style={{ alignItems: 'flex-end', marginRight: 10 }}
                      >
                        <CurrencyText
                          style={[styles.billAmount, { color: display.color }]}
                          amount={item.is_partially_paid && item.remaining_amount != null ? item.remaining_amount : item.amount}
                        />
                        {item.is_partially_paid ? (
                          <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '500', marginTop: -2, marginBottom: 2 }}>
                            remaining
                          </Text>
                        ) : null}
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: `${display.color}20` },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              { color: display.color },
                            ]}
                          >
                            {display.label}
                          </Text>
                        </View>
                      </View>
                      {isLinking ? (
                        <ActivityIndicator
                          size="small"
                          color={Colors.primary}
                        />
                      ) : (
                        <View style={styles.linkActionBadge}>
                          <MaterialCommunityIcons
                            name="link-plus"
                            size={16}
                            color={Colors.primary}
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D6E0FF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    marginLeft: 6,
    fontWeight: '700',
    fontSize: 13,
    color: Colors.primary,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  linkHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  linkHeaderBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyLinkBtn: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  emptyLinkBtnText: {
    color: Colors.primary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 8,
    paddingLeft: 10,
    marginTop: 4,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  billRowDeleted: {
    backgroundColor: '#FEF2F2',
    borderLeftColor: '#EF4444',
  },
  billContentArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  billName: {
    fontWeight: '700',
    fontSize: 13.5,
    color: '#111',
  },
  deletedTag: {
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },
  deletedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  billSub: {
    fontSize: 11.5,
    color: '#777',
    marginTop: 2,
  },
  billAmount: {
    fontWeight: '800',
    fontSize: 13.5,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 3,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  unlinkBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  /* ── Modal Styles ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 28, 48, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d9e6',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalHeaderSubtitle: {
    color: '#7c839b',
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 10,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    paddingVertical: 8,
  },
  emptyCandidatesBox: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyCandidatesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
  },
  emptyCandidatesSub: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5fa',
  },
  candidateName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  candidateSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 2,
  },
  linkActionBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  legBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  transferLegBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  transferLegBoxLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  transferLegRow: {
    flexDirection: 'column',
    gap: 6,
  },
  transferLegChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  transferLegChipActiveExpense: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  transferLegChipActiveCredit: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  transferLegChipTitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
  },
  transferLegChipTitleActiveExpense: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  transferLegChipTitleActiveCredit: {
    color: '#15803D',
    fontWeight: '700',
  },
  transferLegChipSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },

  /* ── Unlink Confirmation Modal Styles ── */
  unlinkModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  unlinkModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  unlinkIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  unlinkModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  unlinkModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  unlinkBillPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
    width: '100%',
  },
  unlinkBillIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  unlinkBillPreviewName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  unlinkBillPreviewSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  unlinkBillPreviewAmount: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  unlinkDeletedTag: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 3,
  },
  unlinkDeletedTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  unlinkWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 18,
    width: '100%',
  },
  unlinkWarningText: {
    fontSize: 11.5,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  unlinkActionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  unlinkCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlinkCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  unlinkConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  unlinkConfirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
