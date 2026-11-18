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
import { Colors } from './Theme';

export default function PaperConfirmModal({
  visible,
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  confirmIcon = 'check',
  confirmColor,
  isDestructive = false,
  onCancel,
  onConfirm,
}) {
  const { isDarkMode, theme } = useTheme();

  if (!visible) return null;

  const resolvedConfirmColor = confirmColor || (isDestructive ? '#EF4444' : Colors.primary);
  const iconBg = isDestructive
    ? (isDarkMode ? '#3B171C' : '#FEE2E2')
    : (isDarkMode ? '#132847' : '#DBEAFE');
  const iconColor = isDestructive ? '#EF4444' : (confirmColor || Colors.primary);

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
              {/* Icon Badge */}
              <View style={styles.iconContainer}>
                <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
                  <MaterialCommunityIcons
                    name={confirmIcon || (isDestructive ? 'trash-can-outline' : 'help-circle-outline')}
                    size={28}
                    color={iconColor}
                  />
                </View>
              </View>

              {/* Title & Message */}
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                {title}
              </Text>
              {message ? (
                <Text style={[styles.message, { color: theme.textSecondary }]}>
                  {message}
                </Text>
              ) : null}

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
                  style={[styles.confirmBtn, { backgroundColor: resolvedConfirmColor }]}
                  onPress={onConfirm}
                  activeOpacity={0.8}
                >
                  {confirmIcon ? (
                    <MaterialCommunityIcons
                      name={confirmIcon}
                      size={18}
                      color="#FFF"
                      style={{ marginRight: 6 }}
                    />
                  ) : null}
                  <Text style={styles.confirmBtnText}>
                    {confirmLabel}
                  </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
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
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

