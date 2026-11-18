import React, { useState, useMemo } from 'react';
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
import { formatLedgerAmount } from '../utils/paperLedgerUtils';

export default function PaperSavedSheetsModal({
  visible,
  sheets = [],
  activeSheetId = null,
  onClose,
  onSelectSheet,
  onTogglePin,
  onDeleteSheet,
  onNewSheet,
}) {
  const { isDarkMode, theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and sort sheets (pinned first, then updated_at DESC)
  const filteredSheets = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim();
    const list = (sheets || []).filter((s) =>
      !q || (s.title && s.title.toLowerCase().includes(q))
    );

    return list.sort((a, b) => {
      const aPinned = Number(a.is_pinned) === 1 ? 1 : 0;
      const bPinned = Number(b.is_pinned) === 1 ? 1 : 0;
      if (bPinned !== aPinned) {
        return bPinned - aPinned;
      }
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    });
  }, [sheets, searchQuery]);

  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const renderSheetCard = ({ item }) => {
    const isPinned = Number(item.is_pinned) === 1;
    const isActive = item.id === activeSheetId;
    const entriesCount = item.items ? item.items.length : 0;
    const netTotal = Number(item.net_total) || 0;

    return (
      <TouchableOpacity
        style={[
          styles.sheetCard,
          {
            backgroundColor: isDarkMode ? '#171E2B' : '#FFFFFF',
            borderColor: isActive
              ? Colors.primary
              : isPinned
              ? isDarkMode
                ? '#543B14'
                : '#FDE68A'
              : isDarkMode
              ? '#2A3447'
              : '#E2E8F0',
          },
        ]}
        onPress={() => {
          onSelectSheet(item);
          onClose();
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardMain}>
          {/* Title & Status Row */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.titleWrap}>
              {isPinned && (
                <MaterialCommunityIcons
                  name="pin"
                  size={15}
                  color="#F59E0B"
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                style={[
                  styles.sheetTitle,
                  { color: theme.textPrimary },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
            </View>

            {isActive && (
              <View style={[styles.activeBadge, { backgroundColor: isDarkMode ? '#1E3A5F' : '#DBEAFE' }]}>
                <Text style={[styles.activeBadgeText, { color: Colors.primary }]}>
                  Active
                </Text>
              </View>
            )}
          </View>

          {/* Details Row */}
          <View style={styles.detailsRow}>
            <View style={styles.statPill}>
              <MaterialCommunityIcons name="format-list-numbered" size={13} color={theme.textSecondary} />
              <Text style={[styles.statText, { color: theme.textSecondary }]}>
                {entriesCount} {entriesCount === 1 ? 'entry' : 'entries'}
              </Text>
            </View>

            <View
              style={[
                styles.netPill,
                {
                  backgroundColor:
                    netTotal > 0
                      ? isDarkMode ? '#0A3324' : '#E6F9F0'
                      : netTotal < 0
                      ? isDarkMode ? '#3B171C' : '#FEECEC'
                      : isDarkMode ? '#1E2533' : '#F1F5F9',
                },
              ]}
            >
              <Text
                style={[
                  styles.netPillText,
                  {
                    color:
                      netTotal > 0
                        ? '#10B981'
                        : netTotal < 0
                        ? '#EF4444'
                        : theme.textSecondary,
                  },
                ]}
              >
                {netTotal > 0 ? '+' : ''}{formatLedgerAmount(netTotal)}
              </Text>
            </View>
          </View>

          {/* Last updated timestamp */}
          <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
            Updated: {formatDate(item.updated_at)}
          </Text>
        </View>

        {/* Right Action Icons: Pin Toggle & Delete */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[
              styles.actionIconButton,
              {
                backgroundColor: isPinned
                  ? isDarkMode ? '#42280A' : '#FEF3C7'
                  : isDarkMode ? '#1A2332' : '#F8FAFC',
              },
            ]}
            onPress={() => onTogglePin && onTogglePin(item.id, isPinned)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={isPinned ? 'pin' : 'pin-outline'}
              size={18}
              color={isPinned ? '#F59E0B' : theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionIconButton, { backgroundColor: isDarkMode ? '#331B20' : '#FEE2E2' }]}
            onPress={() => onDeleteSheet && onDeleteSheet(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={17} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: isDarkMode ? '#131822' : '#F8FAFC',
                  borderColor: isDarkMode ? '#243044' : '#E2E8F0',
                },
              ]}
            >
              {/* Top Handle Bar */}
              <View style={styles.handleBar} />

              {/* Modal Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <MaterialCommunityIcons
                    name="book-open-outline"
                    size={22}
                    color={Colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.title, { color: theme.textPrimary }]}>
                    Saved Ledgers
                  </Text>
                  <View style={[styles.countBadge, { backgroundColor: isDarkMode ? '#1E283D' : '#E2E8F0' }]}>
                    <Text style={[styles.countBadgeText, { color: theme.textSecondary }]}>
                      {sheets.length}
                    </Text>
                  </View>
                </View>

                <View style={styles.headerRightActions}>
                  <TouchableOpacity
                    style={[styles.newSheetButton, { backgroundColor: Colors.primary }]}
                    onPress={() => {
                      onNewSheet && onNewSheet();
                      onClose();
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="plus" size={16} color="#FFF" style={{ marginRight: 2 }} />
                    <Text style={styles.newSheetButtonText}>New Sheet</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search Bar */}
              <View
                style={[
                  styles.searchContainer,
                  {
                    backgroundColor: isDarkMode ? '#1A2232' : '#FFFFFF',
                    borderColor: isDarkMode ? '#2E3D56' : '#E2E8F0',
                  },
                ]}
              >
                <MaterialCommunityIcons name="magnify" size={18} color={theme.textSecondary} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.searchInput, { color: theme.textPrimary }]}
                  placeholder="Search saved sheets by title..."
                  placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <MaterialCommunityIcons name="close-circle" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Saved Sheets List */}
              {filteredSheets.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons
                    name="book-search-outline"
                    size={48}
                    color={theme.textSecondary}
                    style={{ opacity: 0.5, marginBottom: 8 }}
                  />
                  <Text style={[styles.emptyStateTitle, { color: theme.textPrimary }]}>
                    {searchQuery ? 'No Matching Sheets' : 'No Saved Sheets Yet'}
                  </Text>
                  <Text style={[styles.emptyStateDesc, { color: theme.textSecondary }]}>
                    {searchQuery
                      ? 'Try another search term or clear the filter.'
                      : 'Save your current calculations using the "Save" button to access them here anytime.'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredSheets}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderSheetCard}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                />
              )}
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
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 28,
    maxHeight: '85%',
    minHeight: 400,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94A3B8',
    opacity: 0.4,
    alignSelf: 'center',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  newSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newSheetButtonText: {
    color: '#FFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  listContent: {
    paddingBottom: 16,
    gap: 10,
  },
  sheetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    gap: 8,
  },
  cardMain: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  sheetTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  activeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '500',
  },
  netPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  netPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timestampText: {
    fontSize: 10.5,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  actionIconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyStateDesc: {
    fontSize: 12.5,
    textAlign: 'center',
    maxWidth: 280,
  },
});
