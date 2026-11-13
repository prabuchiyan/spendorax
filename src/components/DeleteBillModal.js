import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency, formatDueDate } from '../services/billUtils';

function formatRecurrenceLabel(bill) {
  if (!bill) return 'Bill Occurrence';
  if (!bill.is_recurring) return 'One-time Bill';
  const type = (bill.recurrence_type || '').toUpperCase();
  switch (type) {
    case 'DAILY':
      return 'Daily Recurring';
    case 'WEEKLY':
      return 'Weekly Recurring';
    case 'BI_WEEKLY':
      return 'Bi-Weekly Recurring';
    case 'MONTHLY':
      return 'Monthly Recurring';
    case 'BI_MONTHLY':
      return 'Bi-Monthly Recurring';
    case 'QUARTERLY':
      return 'Quarterly Recurring';
    case 'HALF_YEARLY':
      return 'Half-Yearly Recurring';
    case 'YEARLY':
      return 'Yearly Recurring';
    default:
      return 'Recurring Bill';
  }
}

export default function DeleteBillModal({
  visible,
  bill,
  onCancel,
  onConfirm,
  loading: externalLoading = false,
}) {
  const { isDarkMode, theme } = useTheme();
  const [internalLoading, setInternalLoading] = useState(false);

  const loading = externalLoading || internalLoading;

  if (!visible && !loading) return null;

  const handleConfirm = async () => {
    if (loading) return;
    try {
      setInternalLoading(true);
      await onConfirm?.();
    } finally {
      setInternalLoading(false);
    }
  };

  const isRecurringOccurrence = Boolean(bill?.parent_bill_id);
  const billName = bill?.name || 'Selected Bill';
  const formattedAmount = formatCurrency(bill?.amount || 0);
  const formattedDate = bill?.due_date ? formatDueDate(bill.due_date) : 'N/A';
  const recurrenceLabel = formatRecurrenceLabel(bill);
  const isRecurring = Boolean(bill?.is_recurring);

  const modalBg = isDarkMode ? '#0F172A' : '#FFFFFF';
  const cardBg = isDarkMode ? '#1E293B' : '#F8FAFC';
  const cardBorder = isDarkMode ? '#334155' : '#E2E8F0';
  const textColor = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textMuted = isDarkMode ? '#94A3B8' : '#64748B';

  const dangerCardBg = isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2';
  const dangerCardBorder = isDarkMode ? 'rgba(239, 68, 68, 0.28)' : '#FECACA';
  const dangerTitleColor = isDarkMode ? '#F87171' : '#B91C1C';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!loading) onCancel?.();
      }}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!loading) onCancel?.();
          }}
        />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: modalBg,
              borderColor: cardBorder,
            },
          ]}>
          {/* Top Sheet Handle */}
          <View style={styles.handleWrap}>
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' },
              ]}
            />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Header Icon + Title */}
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: isDarkMode
                      ? 'rgba(239, 68, 68, 0.2)'
                      : '#FEE2E2',
                    borderColor: isDarkMode
                      ? 'rgba(239, 68, 68, 0.35)'
                      : '#FECACA',
                  },
                ]}>
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={32}
                  color="#DC2626"
                />
              </View>

              <View style={styles.titleWrap}>
                <Text style={[styles.title, { color: textColor }]}>
                  {isRecurringOccurrence ? 'Delete Occurrence?' : 'Delete Bill?'}
                </Text>
                <Text style={[styles.subtitle, { color: textMuted }]}>
                  {isRecurringOccurrence
                    ? 'Are you sure you want to remove this billing occurrence?'
                    : 'Are you sure you want to permanently delete this bill?'}
                </Text>
              </View>
            </View>

            {/* Bill Summary Card */}
            <View
              style={[
                styles.billCard,
                {
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                },
              ]}>
              <View style={styles.billCardHeader}>
                <View style={styles.billIdentity}>
                  <Text
                    numberOfLines={1}
                    style={[styles.billName, { color: textColor }]}>
                    {billName}
                  </Text>
                  <View style={styles.badgeRow}>
                    <View
                      style={[
                        styles.recurrenceBadge,
                        {
                          backgroundColor: isDarkMode
                            ? 'rgba(100, 116, 139, 0.2)'
                            : '#F1F5F9',
                          borderColor: isDarkMode ? '#475569' : '#E2E8F0',
                        },
                      ]}>
                      <MaterialCommunityIcons
                        name={isRecurring ? 'repeat' : 'calendar'}
                        size={12}
                        color={isDarkMode ? '#94A3B8' : '#475569'}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.recurrenceBadgeText,
                          { color: isDarkMode ? '#CBD5E1' : '#475569' },
                        ]}>
                        {recurrenceLabel}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.dueBadge,
                        {
                          backgroundColor: isDarkMode
                            ? 'rgba(239, 68, 68, 0.15)'
                            : '#FEF2F2',
                          borderColor: isDarkMode
                            ? 'rgba(239, 68, 68, 0.3)'
                            : '#FECACA',
                        },
                      ]}>
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={12}
                        color="#DC2626"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.dueBadgeText}>Due {formattedDate}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.amountCol}>
                  <Text style={[styles.amountLabel, { color: textMuted }]}>
                    Amount
                  </Text>
                  <Text style={[styles.amountValue, { color: textColor }]}>
                    {formattedAmount}
                  </Text>
                </View>
              </View>
            </View>

            {/* Detailed Warning Notice Card */}
            <View
              style={[
                styles.warningBox,
                {
                  backgroundColor: dangerCardBg,
                  borderColor: dangerCardBorder,
                },
              ]}>
              <View style={styles.warningBoxHeader}>
                <MaterialCommunityIcons
                  name="alert-octagon-outline"
                  size={19}
                  color="#DC2626"
                />
                <Text
                  style={[styles.warningBoxTitle, { color: dangerTitleColor }]}>
                  Permanent Action Warning
                </Text>
              </View>

              <View style={styles.noticeList}>
                {isRecurringOccurrence ? (
                  <>
                    {/* Point 1: Occurrence Removed */}
                    <View style={styles.noticeItem}>
                      <View style={styles.noticeIconBullet}>
                        <MaterialCommunityIcons
                          name="delete-outline"
                          size={16}
                          color="#DC2626"
                        />
                      </View>
                      <Text style={[styles.noticeText, { color: textColor }]}>
                        <Text style={styles.noticeBold}>Occurrence Removed:</Text>{' '}
                        This bill occurrence will be permanently removed from this cycle.
                      </Text>
                    </View>

                    {/* Point 2: Recurring Schedule Intact */}
                    <View style={styles.noticeItem}>
                      <View
                        style={[
                          styles.noticeIconBullet,
                          { backgroundColor: 'rgba(5, 150, 105, 0.12)' },
                        ]}>
                        <MaterialCommunityIcons
                          name="calendar-check"
                          size={16}
                          color="#059669"
                        />
                      </View>
                      <Text style={[styles.noticeText, { color: textColor }]}>
                        <Text style={[styles.noticeBold, { color: '#059669' }]}>
                          Schedule Preserved:
                        </Text>{' '}
                        Other recurring occurrences and future cycles will remain unaffected.
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.noticeItem}>
                    <View style={styles.noticeIconBullet}>
                      <MaterialCommunityIcons
                        name="delete-forever"
                        size={16}
                        color="#DC2626"
                      />
                    </View>
                    <Text style={[styles.noticeText, { color: textColor }]}>
                      <Text style={styles.noticeBold}>Permanent Removal:</Text>{' '}
                      The bill and all future schedule data will be permanently removed.
                    </Text>
                  </View>
                )}

                {/* Point 3: Linked Transactions Kept Safe */}
                <View style={styles.noticeItem}>
                  <View
                    style={[
                      styles.noticeIconBullet,
                      { backgroundColor: 'rgba(37, 99, 235, 0.12)' },
                    ]}>
                    <MaterialCommunityIcons
                      name="link-variant-off"
                      size={16}
                      color="#2563EB"
                    />
                  </View>
                  <Text style={[styles.noticeText, { color: textColor }]}>
                    <Text style={[styles.noticeBold, { color: '#2563EB' }]}>
                      Transactions Safe:
                    </Text>{' '}
                    Linked transactions will <Text style={styles.noticeBold}>NOT</Text> be deleted; they will simply be unlinked.
                  </Text>
                </View>

                {/* Point 4: Cannot be undone */}
                <View style={styles.noticeItem}>
                  <View style={styles.noticeIconBullet}>
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={16}
                      color="#DC2626"
                    />
                  </View>
                  <Text style={[styles.noticeText, { color: textColor }]}>
                    <Text style={[styles.noticeBold, { color: '#DC2626' }]}>
                      Cannot Be Undone:
                    </Text>{' '}
                    Once deleted, this action cannot be reversed.
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                    borderColor: cardBorder,
                  },
                ]}
                disabled={loading}
                activeOpacity={0.7}
                onPress={onCancel}>
                <Text style={[styles.cancelBtnText, { color: textColor }]}>
                  Keep Bill
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  loading && { opacity: 0.7 },
                ]}
                disabled={loading}
                activeOpacity={0.8}
                onPress={handleConfirm}>
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.confirmBtnContent}>
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={19}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.confirmBtnText}>Delete Permanently</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 18,
  },
  billCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  billCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  billIdentity: {
    flex: 1,
    paddingRight: 12,
  },
  billName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recurrenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  recurrenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  amountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  warningBox: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 22,
  },
  warningBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  warningBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  noticeList: {
    gap: 12,
  },
  noticeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noticeIconBullet: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
    flexShrink: 0,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  noticeBold: {
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1.3,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  confirmBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});

