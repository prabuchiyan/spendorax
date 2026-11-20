import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Colors } from './Theme';

export default function SmartNotepadSaveSheetModal({
  visible,
  currentTitle = '',
  isUpdating = false,
  lastUpdated = null,
  onClose,
  onSave,
}) {
  const { isDarkMode, theme } = useTheme();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      if (currentTitle) {
        setTitle(currentTitle);
      } else {
        const dateStr = new Date().toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        setTitle(`Calculation - ${dateStr}`);
      }
      setError('');
    }
  }, [visible, currentTitle]);

  const handleSave = (asNew = false) => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Please enter a sheet name');
      return;
    }
    if (trimmed.length > 60) {
      setError('Sheet name cannot exceed 60 characters');
      return;
    }
    onSave(trimmed, asNew);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[
                styles.bottomSheet,
                {
                  backgroundColor: isDarkMode ? '#131926' : '#FFFFFF',
                  borderColor: isDarkMode ? '#283244' : '#E2E8F0',
                },
              ]}
            >
              {/* Drag Handle */}
              <View
                style={[
                  styles.dragHandle,
                  { backgroundColor: isDarkMode ? '#334155' : '#CBD5E1' },
                ]}
              />

              {/* Header */}
              <View style={styles.header}>
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isUpdating ? 'content-save-edit-outline' : 'content-save-outline'}
                    size={22}
                    color={Colors.primary || '#4B7CF3'}
                  />
                </View>

                <View style={styles.headerText}>
                  <Text style={[styles.title, { color: theme.textPrimary }]}>
                    {isUpdating ? 'Update Smart Notepad' : 'Save Smart Notepad'}
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                    {isUpdating
                      ? 'Update this saved notepad in your records'
                      : 'Save this notepad to your local records'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.closeBtn}
                >
                  <MaterialCommunityIcons name="close" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Form Card */}
              <View
                style={[
                  styles.formCard,
                  {
                    backgroundColor: isDarkMode ? '#182030' : '#F8FAFC',
                    borderColor: isDarkMode ? '#243044' : '#E2E8F0',
                  },
                ]}
              >
                {isUpdating && lastUpdated ? (
                  <View
                    style={[
                      styles.lastUpdatedRow,
                      { backgroundColor: isDarkMode ? '#101622' : '#EFF6FF' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={13}
                      color={isDarkMode ? '#60A5FA' : Colors.primary}
                    />
                    <Text
                      style={[
                        styles.lastUpdatedText,
                        { color: isDarkMode ? '#93C5FD' : '#2563EB' },
                      ]}
                    >
                      Last saved: {new Date(lastUpdated).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                ) : null}

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Sheet Name / Title
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDarkMode ? '#101622' : '#FFFFFF',
                      borderColor: error ? '#EF4444' : (isDarkMode ? '#334155' : '#CBD5E1'),
                      color: theme.textPrimary,
                    },
                  ]}
                  placeholder="e.g. November Household Expenses"
                  placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                  value={title}
                  onChangeText={(t) => {
                    setTitle(t);
                    if (error) setError('');
                  }}
                  autoFocus
                  maxLength={60}
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>

              {/* Footer Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    { borderColor: isDarkMode ? '#334155' : '#CBD5E1' },
                  ]}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelText, { color: theme.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                {isUpdating && (
                  <TouchableOpacity
                    style={[
                      styles.saveAsCopyBtn,
                      {
                        borderColor: Colors.primary || '#4B7CF3',
                        backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF',
                      },
                    ]}
                    onPress={() => handleSave(true)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="content-copy"
                      size={15}
                      color={Colors.primary || '#4B7CF3'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.saveAsCopyText, { color: Colors.primary || '#4B7CF3' }]}>
                      Save as Copy
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: Colors.primary || '#4B7CF3' },
                  ]}
                  onPress={() => handleSave(false)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="check" size={17} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={styles.saveButtonText}>
                    {isUpdating ? 'Update Sheet' : 'Save Sheet'}
                  </Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  formCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  lastUpdatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginBottom: 10,
  },
  lastUpdatedText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14.5,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11.5,
    marginTop: 5,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  saveAsCopyBtn: {
    flex: 1.3,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveAsCopyText: {
    fontSize: 13,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1.4,
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
