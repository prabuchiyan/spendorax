import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Colors } from './Theme';

function formatMonthLabel(monthYearStr) {
  if (!monthYearStr) return '';
  const parts = monthYearStr.split('-');
  if (parts.length < 2) return monthYearStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[monthIdx] || parts[1]} ${year}`;
}

export default function PaperMonthPickerModal({
  visible,
  months = [],
  loading = false,
  onClose,
  onSelectMonth,
  onSelectAll,
}) {
  const { isDarkMode, theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
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
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <MaterialCommunityIcons
                    name="calendar-month-outline"
                    size={22}
                    color={Colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.title, { color: theme.textPrimary }]}>
                    Import Transactions
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Choose a month to copy its transactions to your paper calculation book.
              </Text>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                    Loading available months...
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
                  {/* Option: Import All */}
                  {months.length > 0 && onSelectAll && (
                    <TouchableOpacity
                      style={[
                        styles.monthItem,
                        styles.allMonthsItem,
                        {
                          backgroundColor: isDarkMode ? '#182844' : '#EFF6FF',
                          borderColor: Colors.primary + '50',
                        },
                      ]}
                      onPress={() => {
                        onSelectAll();
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.monthItemLeft}>
                        <MaterialCommunityIcons
                          name="folder-multiple-outline"
                          size={20}
                          color={Colors.primary}
                          style={{ marginRight: 10 }}
                        />
                        <Text style={[styles.monthText, { color: Colors.primary, fontWeight: '700' }]}>
                          Import All Months
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="plus-circle-outline" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  )}

                  {/* Individual Month Items */}
                  {months.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <MaterialCommunityIcons
                        name="calendar-blank-outline"
                        size={40}
                        color={theme.textMuted}
                        style={{ marginBottom: 8 }}
                      />
                      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                        No past transaction months found.
                      </Text>
                    </View>
                  ) : (
                    months.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.monthItem,
                          {
                            backgroundColor: isDarkMode ? '#151922' : '#F8FAFC',
                            borderColor: isDarkMode ? '#273142' : '#E2E8F0',
                          },
                        ]}
                        onPress={() => {
                          onSelectMonth(m);
                          onClose();
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.monthItemLeft}>
                          <MaterialCommunityIcons
                            name="calendar-outline"
                            size={18}
                            color={theme.textSecondary}
                            style={{ marginRight: 10 }}
                          />
                          <Text style={[styles.monthText, { color: theme.textPrimary }]}>
                            {formatMonthLabel(m)}
                          </Text>
                        </View>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={18}
                          color={theme.textSecondary}
                        />
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}

              {/* Close Button */}
              <TouchableOpacity
                style={[
                  styles.closeButton,
                  {
                    backgroundColor: isDarkMode ? '#273142' : '#F1F5F9',
                  },
                ]}
                onPress={onClose}
              >
                <Text style={[styles.closeButtonText, { color: theme.textPrimary }]}>Close</Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: 520,
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
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    marginTop: 8,
  },
  listContainer: {
    maxHeight: 320,
    marginBottom: 16,
  },
  monthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  allMonthsItem: {
    borderWidth: 1.5,
  },
  monthItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
