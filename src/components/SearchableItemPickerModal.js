import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Colors } from './Theme';

export default function SearchableItemPickerModal({
  visible,
  onClose,
  title,
  items = [],
  selectedId = null,
  onSelect,
  allLabel = 'All',
  allIcon = 'tag-multiple-outline',
  placeholder = 'Search...'
}) {
  const { isDarkMode, theme } = useTheme();
  const [searchText, setSearchText] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setSearchText('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 200);
    }
  }, [visible]);

  const filteredItems = useMemo(() => {
    if (!searchText.trim()) return items;
    const lower = searchText.trim().toLowerCase();
    return items.filter(item => (item.name || '').toLowerCase().includes(lower));
  }, [items, searchText]);

  const cardBg = isDarkMode ? (theme?.cardBg || '#1E232A') : '#FFFFFF';
  const textPrimary = isDarkMode ? '#F3F4F6' : '#111827';
  const textSecondary = isDarkMode ? '#9CA3AF' : '#6B7280';
  const searchBg = isDarkMode ? '#282F39' : '#F3F4F6';
  const searchBorder = isDarkMode ? '#374151' : '#E5E7EB';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheetContainer, { backgroundColor: cardBg }]}>
          {/* DRAG HANDLE */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: isDarkMode ? '#4B5563' : '#D1D5DB' }]} />
          </View>

          {/* HEADER */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: textPrimary }]}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close" size={20} color={textSecondary} />
            </TouchableOpacity>
          </View>

          {/* SEARCH INPUT */}
          <View style={[styles.searchBar, { backgroundColor: searchBg, borderColor: searchBorder }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              ref={searchInputRef}
              value={searchText}
              onChangeText={setSearchText}
              placeholder={placeholder}
              placeholderTextColor={textSecondary}
              style={[styles.searchInput, { color: textPrimary }]}
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')} activeOpacity={0.7}>
                <MaterialCommunityIcons name="close-circle" size={18} color={textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* COUNTER */}
          <View style={styles.counterRow}>
            <Text style={[styles.counterText, { color: textSecondary }]}>
              {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
            </Text>
          </View>

          {/* ITEMS GRID */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.grid}>
              {/* "ALL" OPTION */}
              <TouchableOpacity
                onPress={() => {
                  onSelect(null);
                  onClose();
                }}
                activeOpacity={0.8}
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: selectedId === null ? Colors.primary : (isDarkMode ? '#374151' : '#E2E8F0'),
                    borderWidth: selectedId === null ? 2 : 1,
                    borderColor: selectedId === null ? Colors.primary : (isDarkMode ? '#4B5563' : '#CBD5E1')
                  }
                ]}
              >
                <MaterialCommunityIcons
                  name={allIcon}
                  size={20}
                  color={selectedId === null ? '#FFFFFF' : textPrimary}
                />
                {selectedId === null && (
                  <View style={styles.checkBadge}>
                    <MaterialCommunityIcons name="check" size={11} color="#15803D" />
                  </View>
                )}
                <Text
                  numberOfLines={2}
                  style={[
                    styles.itemLabel,
                    { color: selectedId === null ? '#FFFFFF' : textPrimary, fontWeight: selectedId === null ? '700' : '600' }
                  ]}
                >
                  {allLabel}
                </Text>
              </TouchableOpacity>

              {/* FILTERED ITEMS */}
              {filteredItems.map((item) => {
                const isSelected = String(selectedId) === String(item.id);
                const itemColor = item.color || Colors.primary;
                return (
                  <TouchableOpacity
                    key={String(item.id)}
                    onPress={() => {
                      onSelect(item.id);
                      onClose();
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: itemColor,
                        borderWidth: isSelected ? 2 : 0,
                        borderColor: isSelected ? '#FFFFFF' : 'transparent',
                        shadowColor: itemColor,
                        shadowOpacity: isSelected ? 0.35 : 0.15,
                        shadowRadius: 4,
                        elevation: isSelected ? 4 : 2
                      }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.icon || 'tag'}
                      size={20}
                      color="#FFFFFF"
                    />
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <MaterialCommunityIcons name="check" size={11} color="#15803D" />
                      </View>
                    )}
                    <Text
                      numberOfLines={2}
                      style={[styles.itemLabel, { color: '#FFFFFF', fontWeight: isSelected ? '800' : '600' }]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '82%',
    minHeight: '40%',
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  counterRow: {
    marginBottom: 12,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
  },
  itemCard: {
    width: (Dimensions.get('window').width - 40 - 30) / 4,
    height: 72,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemLabel: {
    textAlign: 'center',
    marginTop: 5,
    fontSize: 11,
    lineHeight: 14,
  },
});
