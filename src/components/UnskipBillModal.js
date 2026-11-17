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

export default function UnskipBillModal({
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

  const infoCardBg = isDarkMode ? 'rgba(37, 99, 235, 0.12)' : '#EFF6FF';
  const infoCardBorder = isDarkMode ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE';
  const infoTitleColor = isDarkMode ? '#60A5FA' : '#1D4ED8';

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
            {/* Header Icon & Titles */}
            <View style={styles.headerSection}>
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: isDarkMode
                      ? 'rgba(37, 99, 235, 0.18)'
                      : 'rgba(37, 99, 235, 0.1)',
                    borderColor: isDarkMode
                      ? 'rgba(59, 130, 246, 0.4)'
                      : 'rgba(37, 99, 235, 0.25)',
                  },
                ]}>
                <MaterialCommunityIcons
                  name="undo-variant"
                  size={30}
                  color="#2563EB"
                />
              </View>

              <Text style={[styles.mainTitle, { color: textColor }]}>
                Unskip Bill Occurrence
              </Text>
              <Text style={[styles.subTitle, { color: textMuted }]}>
                Reactivate this skipped cycle back to active status
              </Text>
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
                            ? 'rgba(37, 99, 235, 0.15)'
                            : '#EFF6FF',
                          borderColor: isDarkMode
                            ? 'rgba(59, 130, 246, 0.3)'
                            : '#BFDBFE',
                        },
                      ]}>
                      <MaterialCommunityIcons
                        name="calendar-clock"
                        size={12}
                        color="#2563EB"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.dueBadgeText}>Cycle {formattedDate}</Text>
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

            {/* Information Notice Card */}
            <View
              style={[
                styles.infoBox,
                {
                  backgroundColor: infoCardBg,
                  borderColor: infoCardBorder,
                },
              ]}>
              <View style={styles.infoBoxHeader}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={19}
                  color="#2563EB"
                />
                <Text
                  style={[styles.infoBoxTitle, { color: infoTitleColor }]}>
                  Reactivation Information
                </Text>
              </View>

              <View style={styles.noticeList}>
                {/* Point 1: Restores Active Due Status */}
                <View style={styles.noticeItem}>
                  <View style={styles.noticeIconBullet}>
                    <MaterialCommunityIcons
                      name="check-circle-outline"
                      size={16}
                      color="#2563EB"
                    />
                  </View>
                  <Text style={[styles.noticeText, { color: textColor }]}>
                    <Text style={styles.noticeBold}>Restores Active Status:</Text>{' '}
                    This bill cycle will return to your pending dues and appear in upcoming bill reminders.
                  </Text>
                </View>

                {/* Point 2: Ready for Payment Tracking */}
                <View style={styles.noticeItem}>
                  <View style={styles.noticeIconBullet}>
                    <MaterialCommunityIcons
                      name="cash-multiple"
                      size={16}
                      color="#2563EB"
                    />
                  </View>
                  <Text style={[styles.noticeText, { color: textColor }]}>
                    <Text style={styles.noticeBold}>Payment Linking:</Text>{' '}
                    You can record manual payments or link transactions to settle this bill occurrence.
                  </Text>
                </View>

                {/* Point 3: History & Schedule Intact */}
                <View style={styles.noticeItem}>
                  <View style={styles.noticeIconBullet}>
                    <MaterialCommunityIcons
                      name="calendar-sync"
                      size={16}
                      color="#2563EB"
                    />
                  </View>
                  <Text style={[styles.noticeText, { color: textColor }]}>
                    <Text style={styles.noticeBold}>Schedule Intact:</Text>{' '}
                    Your recurrence cadence and other bill occurrences remain completely unaffected.
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
                  Keep Skipped
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
                      name="undo-variant"
                      size={18}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.confirmBtnText}>Unskip Bill</Text>
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
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Plus Jakarta Sans',
    textAlign: 'center',
    marginBottom: 4,
  },
  subTitle: {
    fontSize: 13,
    fontFamily: 'Inter',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  billCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  billCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  billIdentity: {
    flex: 1,
    marginRight: 10,
  },
  billName: {
    fontSize: 15.5,
    fontWeight: '700',
    fontFamily: 'Plus Jakarta Sans',
    marginBottom: 6,
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
    fontFamily: 'Inter',
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
    color: '#2563EB',
    fontFamily: 'Inter',
  },
  amountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'Inter',
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Plus Jakarta Sans',
  },
  infoBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  infoBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoBoxTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: 'Plus Jakarta Sans',
    marginLeft: 8,
  },
  noticeList: {
    gap: 10,
  },
  noticeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noticeIconBullet: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: 'Inter',
  },
  noticeBold: {
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  confirmBtn: {
    flex: 1.3,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
});

