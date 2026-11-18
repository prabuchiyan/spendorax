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

export default function PaperSaveSheetModal({
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[
                styles.card,
                {
                  backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                  borderColor: isDarkMode ? '#2E384D' : '#E2E8F0',
                },
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <MaterialCommunityIcons
                    name={isUpdating ? 'content-save-edit-outline' : 'content-save-outline'}
                    size={22}
                    color={Colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.title, { color: theme.textPrimary }]}>
                    {isUpdating ? 'Update Paper Ledger' : 'Save Paper Ledger'}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {isUpdating
                  ? 'Update this saved calculation sheet in your records.'
                  : 'Save this calculation sheet to your local records for future reference.'}
              </Text>

              {isUpdating && lastUpdated ? (
                <View style={[styles.lastUpdatedRow, { backgroundColor: isDarkMode ? '#151C28' : '#F1F5F9' }]}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.lastUpdatedText, { color: theme.textSecondary }]}>
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

              {/* Title Input */}
              <Text style={[styles.label, { color: theme.textSecondary, marginTop: 12 }]}>
                Sheet Name / Title
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDarkMode ? '#12161F' : '#F8FAFC',
                    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
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

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    { borderColor: isDarkMode ? '#334155' : '#CBD5E1' },
                  ]}
                  onPress={onClose}
                >
                  <Text style={[styles.cancelText, { color: theme.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                {isUpdating && (
                  <TouchableOpacity
                    style={[
                      styles.saveAsCopyBtn,
                      { borderColor: Colors.primary, backgroundColor: isDarkMode ? '#172544' : '#EFF6FF' },
                    ]}
                    onPress={() => handleSave(true)}
                  >
                    <Text style={[styles.saveAsCopyText, { color: Colors.primary }]}>
                      Save as Copy
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: Colors.primary }]}
                  onPress={() => handleSave(false)}
                >
                  <MaterialCommunityIcons name="check" size={18} color="#FFF" style={{ marginRight: 4 }} />
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  lastUpdatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 6,
    marginBottom: 6,
  },
  lastUpdatedText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
    flexWrap: 'wrap',
  },
  cancelButton: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  saveAsCopyBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  saveAsCopyText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
