import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Colors } from './Theme';
import ResponsiveBottomSheet from './ResponsiveBottomSheet';

export default function SearchableItemPickerModal({
  visible,
  onClose,
  title,
  items = [],
  selectedId = null,
  onSelect,
  allLabel = 'All',
  allIcon = 'tag-multiple-outline',
  placeholder = 'Search...',
  showAllOption = true,
  defaultIcon = 'tag',
  itemSingular = 'item',
  itemPlural = 'items',
  frequentItems = [],
  frequentLabel = '',
  onCreateNew = null,
  createLabel = '+ New',
  createAccentColor = Colors.primary,
  emptyText = 'No items found',
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
  const searchBorder = isDarkMode ? '#334155' : '#E2E8F0';
  const itemSurfaceBg = isDarkMode ? '#1E293B' : '#F8FAFC';

  return (
    <ResponsiveBottomSheet
      visible={visible}
      avoidKeyboard
      animationType="slide"
      maxHeightRatio={0.82}
      onRequestClose={onClose}
      sheetStyle={[styles.sheetContainer, { backgroundColor: cardBg }]}
    >
      {({ maxHeight, viewportWidth }) => {
        const horizontalPad = 16;
        const gridGap = 8;
        const tileWidth = Math.max(
          84,
          Math.floor((viewportWidth - horizontalPad * 2 - gridGap * 2) / 3)
        );
        const showFrequent = !searchText.trim() && Array.isArray(frequentItems) && frequentItems.length > 0;
        const scrollMaxHeight = Math.max(80, maxHeight - 135);
        const countWord = filteredItems.length === 1 ? itemSingular : itemPlural;

        return (
          <View style={{ paddingHorizontal: horizontalPad, flexShrink: 1, maxHeight }}>
            {/* DRAG HANDLE */}
            <View style={styles.handleContainer}>
              <View style={[styles.handle, { backgroundColor: isDarkMode ? '#475569' : '#CBD5E1' }]} />
            </View>

            {/* HEADER */}
            <View style={styles.header}>
              <View style={styles.headerTextWrap}>
                <Text numberOfLines={1} style={[styles.title, { color: textPrimary }]}>
                  {title}
                </Text>
                <Text numberOfLines={1} style={[styles.subtitle, { color: textSecondary }]}>
                  {filteredItems.length} {countWord} available
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: searchBg }]}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="close" size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            {/* SEARCH INPUT (always pinned above scrollable content) */}
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

            {/* SCROLLABLE CONTENT: Frequent Chips + Items Grid */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0, flexShrink: 1, maxHeight: scrollMaxHeight }}
              contentContainerStyle={styles.scrollContent}
            >
              {showFrequent && (
                <View style={styles.frequentSection}>
                  {!!frequentLabel && (
                    <Text style={[styles.subHeaderLabel, { color: textSecondary }]}>
                      {frequentLabel}
                    </Text>
                  )}
                  <View style={styles.quickChipsWrap}>
                    {frequentItems.map((fItem) => {
                      const isFreqSel = selectedId !== null && selectedId !== undefined && String(selectedId) === String(fItem.id);
                      const fColor = fItem.color || Colors.primary;
                      return (
                        <TouchableOpacity
                          key={`freq-${String(fItem.id)}`}
                          onPress={() => {
                            onSelect(fItem.id);
                            onClose();
                          }}
                          activeOpacity={0.8}
                          style={[
                            styles.frequentChip,
                            {
                              backgroundColor: isFreqSel ? fColor : searchBg,
                              borderColor: isFreqSel ? fColor : searchBorder,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={fItem.icon || defaultIcon}
                            size={14}
                            color={isFreqSel ? '#FFFFFF' : fColor}
                            style={{ marginRight: 6 }}
                          />
                          <Text
                            style={[
                              styles.frequentChipText,
                              { color: isFreqSel ? '#FFFFFF' : textPrimary },
                            ]}
                          >
                            {fItem.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ITEMS GRID */}
              <View style={[styles.grid, { gap: gridGap }]}>
                {/* OPTIONAL "ALL" OPTION */}
                {showAllOption && (
                  <TouchableOpacity
                    onPress={() => {
                      onSelect(null);
                      onClose();
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.itemCard,
                      {
                        width: tileWidth,
                        backgroundColor: selectedId === null ? Colors.primary : itemSurfaceBg,
                        borderColor: selectedId === null ? Colors.primary : searchBorder,
                      }
                    ]}
                  >
                    <View
                      style={[
                        styles.itemIconCircle,
                        {
                          backgroundColor: selectedId === null
                            ? 'rgba(255,255,255,0.25)'
                            : Colors.primary,
                        }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={allIcon}
                        size={18}
                        color="#FFFFFF"
                      />
                    </View>
                    <Text
                      style={[
                        styles.itemLabel,
                        {
                          color: selectedId === null ? '#FFFFFF' : textPrimary,
                          fontWeight: selectedId === null ? '700' : '600',
                        }
                      ]}
                    >
                      {allLabel}
                    </Text>
                    {selectedId === null && (
                      <View style={styles.checkBadge}>
                        <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {/* OPTIONAL "+ NEW" CREATE CARD IN GRID */}
                {typeof onCreateNew === 'function' && (
                  <TouchableOpacity
                    onPress={() => onCreateNew(searchText.trim())}
                    activeOpacity={0.8}
                    style={[
                      styles.itemCard,
                      {
                        width: tileWidth,
                        backgroundColor: itemSurfaceBg,
                        borderStyle: 'dashed',
                        borderColor: createAccentColor,
                      }
                    ]}
                  >
                    <View
                      style={[
                        styles.itemIconCircle,
                        { backgroundColor: createAccentColor }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="plus"
                        size={18}
                        color="#FFFFFF"
                      />
                    </View>
                    <Text
                      style={[
                        styles.itemLabel,
                        { color: createAccentColor, fontWeight: '800' }
                      ]}
                    >
                      {createLabel}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* FILTERED ITEMS */}
                {filteredItems.map((item) => {
                  const isSelected = selectedId !== null && selectedId !== undefined && String(selectedId) === String(item.id);
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
                          width: tileWidth,
                          backgroundColor: isSelected ? itemColor : itemSurfaceBg,
                          borderColor: isSelected ? itemColor : searchBorder,
                        }
                      ]}
                    >
                      <View
                        style={[
                          styles.itemIconCircle,
                          {
                            backgroundColor: isSelected
                              ? 'rgba(255,255,255,0.25)'
                              : itemColor,
                          }
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={item.icon || defaultIcon}
                          size={18}
                          color="#FFFFFF"
                        />
                      </View>
                      <Text
                        style={[
                          styles.itemLabel,
                          {
                            color: isSelected ? '#FFFFFF' : textPrimary,
                            fontWeight: isSelected ? '700' : '600',
                          }
                        ]}
                      >
                        {item.name}
                      </Text>
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <MaterialCommunityIcons name="check" size={10} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {filteredItems.length === 0 && !showAllOption && (
                <View style={styles.emptyBox}>
                  <Text style={[styles.emptyText, { color: textSecondary }]}>
                    {emptyText}
                  </Text>
                  {typeof onCreateNew === 'function' && searchText.trim().length > 0 && (
                    <TouchableOpacity
                      onPress={() => onCreateNew(searchText.trim())}
                      activeOpacity={0.85}
                      style={[styles.emptyCreateBtn, { backgroundColor: createAccentColor }]}
                    >
                      <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                      <Text style={styles.emptyCreateBtnText}>
                        Create "{searchText.trim()}"
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        );
      }}
    </ResponsiveBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    paddingVertical: 0,
  },
  frequentSection: {
    marginBottom: 12,
  },
  subHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: '100%',
  },
  frequentChipText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    marginTop: 2,
  },
  itemCard: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    position: 'relative',
  },
  itemIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemLabel: {
    width: '100%',
    textAlign: 'center',
    fontSize: 11.5,
    lineHeight: 14.5,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  emptyCreateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
