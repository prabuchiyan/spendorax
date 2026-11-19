import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Colors } from './Theme';
import {
  formatLedgerAmount,
  selectAllCandidates,
  deselectAllCandidates,
  toggleCandidateSelection,
  filterSelectedCandidates,
  filterCandidatesBySearch,
} from '../utils/paperLedgerUtils';

export default function PaperImportSelectModal({
  visible,
  candidates = [],
  monthLabel = '',
  onClose,
  onConfirmImport,
}) {
  const { isDarkMode, theme } = useTheme();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Whenever candidates or visibility changes, pre-select all candidates
  useEffect(() => {
    if (visible && candidates.length > 0) {
      setSelectedIds(selectAllCandidates(candidates));
      setSearchQuery('');
    }
  }, [visible, candidates]);

  const filteredCandidates = useMemo(() => {
    return filterCandidatesBySearch(candidates, searchQuery);
  }, [candidates, searchQuery]);

  const allSelected = useMemo(() => {
    if (!candidates.length) return false;
    return candidates.every((c) => selectedIds.has(String(c.id)));
  }, [candidates, selectedIds]);

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(deselectAllCandidates());
    } else {
      setSelectedIds(selectAllCandidates(candidates));
    }
  };

  const handleToggleItem = (id) => {
    setSelectedIds((prev) => toggleCandidateSelection(prev, id));
  };

  const handleConfirm = () => {
    const selectedItems = filterSelectedCandidates(candidates, selectedIds);
    if (selectedItems.length > 0 && onConfirmImport) {
      onConfirmImport(selectedItems);
    }
  };

  const selectedCount = selectedIds.size;

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
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[
                styles.modalCard,
                {
                  backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                  borderColor: isDarkMode ? '#334155' : '#E2E8F0',
                },
              ]}
            >
              {/* Header */}
              <View
                style={[
                  styles.headerRow,
                  { borderBottomColor: isDarkMode ? '#334155' : '#E2E8F0' },
                ]}
              >
                <View style={styles.headerTitleWrap}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: theme.primary ? `${theme.primary}20` : '#0D948820' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="file-import-outline"
                      size={20}
                      color={theme.primary || '#0D9488'}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text
                      style={[
                        styles.headerTitle,
                        { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                      ]}
                    >
                      Select Transactions to Import
                    </Text>
                    <Text
                      style={[
                        styles.headerSubtitle,
                        { color: isDarkMode ? '#94A3B8' : '#64748B' },
                      ]}
                      numberOfLines={1}
                    >
                      {monthLabel ? `${monthLabel} • ` : ''}
                      {candidates.length} available
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={22}
                    color={isDarkMode ? '#94A3B8' : '#64748B'}
                  />
                </TouchableOpacity>
              </View>

              {/* Search & Select All Bar */}
              <View style={styles.controlsRow}>
                <View
                  style={[
                    styles.searchWrap,
                    {
                      backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                      borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="magnify"
                    size={18}
                    color={isDarkMode ? '#64748B' : '#94A3B8'}
                  />
                  <TextInput
                    style={[
                      styles.searchInput,
                      { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                    ]}
                    placeholder="Search by note or category..."
                    placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <MaterialCommunityIcons
                        name="close-circle"
                        size={16}
                        color={isDarkMode ? '#64748B' : '#94A3B8'}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.selectAllBtn,
                    {
                      backgroundColor: allSelected
                        ? (theme.primary ? `${theme.primary}20` : '#0D948820')
                        : (isDarkMode ? '#0F172A' : '#F1F5F9'),
                      borderColor: allSelected
                        ? (theme.primary || '#0D9488')
                        : (isDarkMode ? '#334155' : '#CBD5E1'),
                    },
                  ]}
                  onPress={handleToggleSelectAll}
                >
                  <MaterialCommunityIcons
                    name={allSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={16}
                    color={allSelected ? (theme.primary || '#0D9488') : (isDarkMode ? '#94A3B8' : '#64748B')}
                  />
                  <Text
                    style={[
                      styles.selectAllText,
                      {
                        color: allSelected
                          ? (theme.primary || '#0D9488')
                          : (isDarkMode ? '#E2E8F0' : '#475569'),
                      },
                    ]}
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Status bar */}
              <View style={styles.statusBar}>
                <Text
                  style={[
                    styles.statusText,
                    { color: isDarkMode ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  Selected {selectedCount} of {candidates.length} transactions
                </Text>
              </View>

              {/* Candidate Items List */}
              <FlatList
                data={filteredCandidates}
                keyExtractor={(item) => String(item.id)}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const isChecked = selectedIds.has(String(item.id));
                  const isIncome = item.type === 'income';

                  return (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleToggleItem(item.id)}
                      style={[
                        styles.candidateRow,
                        {
                          backgroundColor: isChecked
                            ? (isDarkMode ? '#0F172A80' : '#F8FAFC')
                            : 'transparent',
                          borderColor: isChecked
                            ? (theme.primary ? `${theme.primary}50` : '#0D948850')
                            : (isDarkMode ? '#33415550' : '#E2E8F0'),
                        },
                      ]}
                    >
                      <View style={styles.checkIconWrap}>
                        <MaterialCommunityIcons
                          name={isChecked ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                          size={22}
                          color={
                            isChecked
                              ? (theme.primary || '#0D9488')
                              : (isDarkMode ? '#64748B' : '#94A3B8')
                          }
                        />
                      </View>

                      {/* Title: wraps entirely without truncation */}
                      <View style={styles.itemInfoWrap}>
                        <Text
                          style={[
                            styles.candidateTitle,
                            { color: isDarkMode ? '#F8FAFC' : '#0F172A' },
                          ]}
                        >
                          {item.title}
                        </Text>
                      </View>

                      {/* Amount pill */}
                      <View
                        style={[
                          styles.amountPill,
                          {
                            backgroundColor: isIncome
                              ? 'rgba(16, 185, 129, 0.12)'
                              : 'rgba(239, 68, 68, 0.12)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.amountText,
                            { color: isIncome ? '#10B981' : '#EF4444' },
                          ]}
                        >
                          {isIncome ? '+' : '-'} {formatLedgerAmount(item.amount)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons
                      name="file-search-outline"
                      size={40}
                      color={isDarkMode ? '#475569' : '#CBD5E1'}
                    />
                    <Text
                      style={[
                        styles.emptyText,
                        { color: isDarkMode ? '#94A3B8' : '#64748B' },
                      ]}
                    >
                      No transactions found matching "{searchQuery}"
                    </Text>
                  </View>
                }
              />

              {/* Bottom Actions */}
              <View
                style={[
                  styles.footerRow,
                  { borderTopColor: isDarkMode ? '#334155' : '#E2E8F0' },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    {
                      borderColor: isDarkMode ? '#475569' : '#CBD5E1',
                    },
                  ]}
                  onPress={onClose}
                >
                  <Text
                    style={[
                      styles.cancelBtnText,
                      { color: isDarkMode ? '#94A3B8' : '#64748B' },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    {
                      backgroundColor:
                        selectedCount > 0
                          ? (theme.primary || '#0D9488')
                          : (isDarkMode ? '#334155' : '#CBD5E1'),
                    },
                  ]}
                  disabled={selectedCount === 0}
                  onPress={handleConfirm}
                >
                  <MaterialCommunityIcons
                    name="arrow-right-circle"
                    size={18}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.confirmBtnText}>
                    Import Selected ({selectedCount})
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
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '85%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    marginLeft: 6,
    paddingVertical: 0,
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBar: {
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  list: {
    flexGrow: 1,
    maxHeight: 380,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkIconWrap: {
    marginRight: 12,
  },
  itemInfoWrap: {
    flex: 1,
    paddingRight: 8,
  },
  candidateTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  amountPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 13,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
