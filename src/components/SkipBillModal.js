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

export default function SkipBillModal({
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

  const warningCardBg = isDarkMode ? 'rgba(217, 119, 6, 0.12)' : '#FFFBEB';
  const warningCardBorder = isDarkMode ? 'rgba(245, 158, 11, 0.28)' : '#FDE68A';
  const warningTitleColor = isDarkMode ? '#FBBF24' : '#B45309';

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
                      ? 'rgba(217, 119, 6, 0.2)'
                      : '#FEF3C7',
                    borderColor: isDarkMode
                      ? 'rgba(245, 158, 11, 0.35)'
                      : '#FDE68A',
                  },
                ]}>
                <MaterialCommunityIcons
                  name="skip-next-circle"
                  size={32}
                  color="#D97706"
                />
              </View>

              <View style={styles.titleWrap}>
                <Text style={[styles.title, { color: textColor }]}>
                  Skip This Bill?
                </Text>
                <Text style={[styles.subtitle, { color: textMuted }]}>
                  You are about to skip the payment for this billing cycle.
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
                            ? 'rgba(217, 119, 6, 0.15)'
                            : '#FFFBEB',
                          borderColor: isDarkMode
                            ? 'rgba(245, 158, 11, 0.3)'
                            : '#FDE68A',
                        },
                      ]}>
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={12}
                        color="#D97706"
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
                  backgroundColor: warningCardBg,
                  borderColor: warningCardBorder,
                },
              ]}>
              <View style={styles.warningBoxHeader}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={19}
                  color="#D97706"
                />
                <Text
                  style={[styles.warningBoxTitle, { color: warningTitleColor }]}>
                  Important Notice Before Skipping
                </Text>
              </View>

              <View style={styles.noticeList}>
                {/* Point 1: Excluded from Dues */}
                <View style={styles.noticeItem}>
                  <View style={styles.noticeIconBullet}>
                    <MaterialCommunityIcons
                      name="calculator-off"
                      size={16}
                      color="#D97706"
                    />
                  </View>
                  <Text style={[styles.noticeText, { color: textColor }]}>
                    <Text style={styles.noticeBold}>Excluded from Dues:</Text>{' '}
                    The amount of {formattedAmount} will be omitted from your
                    pending bills and monthly cash flow totals.
                  </Text>
                </View>

                {/* Point 2: Reminders Muted */}
                <View style={styles.noticeItem}>
                  <View style={styles.noticeIconBullet}>
                    <MaterialCommunityIcons
                      name="bell-cancel-outline"
                      size={16}
                      color="#D97706"
                    />
                  </View>
                  <Text style={[styles.noticeText, { color: textColor }]}>
                    <Text style={styles.noticeBold}>Reminders Muted:</Text>{' '}
                    You will not receive upcoming or overdue alerts for this
                    billing cycle.
                  </Text>
                </View>

                {/* Point 3: Recurring Schedule Safe */}
                <View style={styles.noticeItem}>
                  <View style={styles.noticeIconBullet}>
                    <MaterialCommunityIcons
                      name="calendar-sync"
                      size={16}
                      color="#D97706"
                    />
                  </View>
                  <Text style={[styles.noticeText, { color: textColor }]}>
                    <Text style={styles.noticeBold}>
                      {isRecurring ? 'Schedule Preserved:' : 'Historical Record:'}
                    </Text>{' '}
                    {isRecurring
                      ? 'Your recurrence schedule remains active. The next cycle will generate normally.'
                      : 'This bill will remain recorded as skipped in your billing history.'}
                  </Text>
                </View>

                {/* Point 4: Easily Reversible */}
                <View style={styles.noticeItem}>
                  <View
                    style={[
                      styles.noticeIconBullet,
                      { backgroundColor: 'rgba(5, 150, 105, 0.12)' },
                    ]}>
                    <MaterialCommunityIcons
                      name="undo-variant"
                      size={16}
                      color="#059669"
                    />
                  </View>
                  <Text style={[styles.noticeText, { color: textColor }]}>
                    <Text style={[styles.noticeBold, { color: '#059669' }]}>
                      Easily Reversible:
                    </Text>{' '}
                    You can tap "Unskip" at any time from the Bill Details screen
                    to reactivate this bill.
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
                      name="skip-next"
                      size={19}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.confirmBtnText}>Skip Bill</Text>
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
    maxWidth: 500,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '90%',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
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
    marginTop: 2,
    lineHeight: 18,
  },
  billCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  billCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billIdentity: {
    flex: 1,
    marginRight: 12,
  },
  billName: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  recurrenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  dueBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  warningBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  warningBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  warningBoxTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    marginLeft: 7,
    letterSpacing: -0.1,
  },
  noticeList: {
    gap: 10,
  },
  noticeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noticeIconBullet: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(217, 119, 6, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  noticeBold: {
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1.3,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

