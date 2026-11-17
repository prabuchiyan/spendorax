import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { formatLedgerAmount } from '../utils/paperLedgerUtils';

export default function PaperDeleteConfirmModal({
  visible,
  item,
  onCancel,
  onConfirm,
}) {
  const { isDarkMode, theme } = useTheme();

  if (!item) return null;

  const isIncome = item.type === 'income';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                  borderColor: isDarkMode ? '#2E384D' : '#E2E8F0',
                },
              ]}
            >
              {/* Warning Icon Badge */}
              <View style={styles.iconContainer}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={28}
                    color="#EF4444"
                  />
                </View>
              </View>

              {/* Title & Warning Message */}
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                Delete Entry?
              </Text>
              <Text style={[styles.message, { color: theme.textSecondary }]}>
                Are you sure you want to remove this transaction from the calculation sheet?
              </Text>

              {/* Item Preview Card */}
              <View
                style={[
                  styles.itemPreview,
                  {
                    backgroundColor: isDarkMode ? '#141822' : '#F8FAFC',
                    borderColor: isDarkMode ? '#263042' : '#E2E8F0',
                  },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text
                    style={[styles.itemTitle, { color: theme.textPrimary }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[
                      styles.itemType,
                      { color: isIncome ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {isIncome ? 'Income (+)' : 'Expense (−)'}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.itemAmount,
                    { color: isIncome ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {isIncome ? '+' : '−'}
                  {formatLedgerAmount(item.amount)}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    {
                      borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                    },
                  ]}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelText, { color: theme.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={onConfirm}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={18}
                    color="#FFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
  },
  itemPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemType: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
