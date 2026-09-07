import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TextInput as PaperTextInput, Button as PaperButton, Searchbar, Avatar, Chip } from 'react-native-paper';
import IconPicker from '../components/IconPicker';
import ConfirmDialog from '../components/ConfirmDialog';
import ColorPickerModal from '../components/ColorPickerModal';
import { getCategories, softDeleteCategory, updateCategory } from '../services/categories';
import Card from '../components/Card';
import IconButton from '../components/IconButton';
import { Colors, Spacing } from '../components/Theme';
import CategoryCreateModal from '../components/CategoryCreateModal';
import FAB from '../components/FAB';

export default function CategoriesScreen({ route, navigation }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [type, setType] = useState('expense');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('expense');
  const [selectedIcon, setSelectedIcon] = useState('tag');
  const [selectedColor, setSelectedColor] = useState('#4B7CF3');
  const [editIcon, setEditIcon] = useState('tag');
  const [editColor, setEditColor] = useState('#4B7CF3');
  const [showIconPickerForAdd, setShowIconPickerForAdd] = useState(false);
  const [showIconPickerForEdit, setShowIconPickerForEdit] = useState(false);
  const [userPickedIconAdd, setUserPickedIconAdd] = useState(false);
  const [userPickedIconEdit, setUserPickedIconEdit] = useState(false);
  const [showColorPickerForAdd, setShowColorPickerForAdd] = useState(false);
  const [showColorPickerForEdit, setShowColorPickerForEdit] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('Are you sure you want to delete this item?');
  const [searchQuery, setSearchQuery] = useState('');

  async function load() {
    const rows = await getCategories(true);
    setItems(rows);
  }

  useEffect(() => { load(); }, []);

  // If navigated with an editId param, start editing that category
  useEffect(() => {
    if (route && route.params && route.params.editId) {
      const id = route.params.editId;
      const item = items.find(i => i.id === id);
      if (item) startEdit(item);
    }
  }, [route, items]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item =>
      (item.name || '').toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  async function startEdit(item) {
    setEditingId(item.id);
    setEditName(item.name || '');
    setEditType(item.type || 'expense');
    setEditIcon(item.icon || 'tag');
    setEditColor(item.color || '#4B7CF3');
    setUserPickedIconEdit(false);
  }

  function handleEditNameChange(t) {
    setEditName(t);
    if (userPickedIconEdit) setUserPickedIconEdit(false);
  }

  async function saveEdit() {
    await updateCategory(editingId, { name: editName, type: editType, icon: editIcon, color: editColor, is_active: 1 });
    setEditingId(null);
    setEditName('');
    setEditType('expense');
    setEditIcon('tag');
    setEditColor('#4B7CF3');
    setUserPickedIconEdit(false);
    load();
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditType('expense');
  }

  async function remove(id) {
    await softDeleteCategory(id);
    load();
  }

  // Simple suggestions map: keyword -> preferred icon
  function suggestIconForText(text) {
    if (!text) return 'tag';
    const t = text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = t.split(/\s+/).filter(Boolean);
    const suggestions = {
      gym: 'dumbbell',
      fitness: 'dumbbell',
      snack: 'food-apple',
      food: 'food',
      coffee: 'coffee',
      tea: 'coffee',
      veg: 'leaf',
      vegetable: 'leaf',
      non: 'food-drumstick',
      meat: 'food-drumstick',
      dinner: 'silverware-fork-knife',
      lunch: 'silverware-fork-knife',
      breakfast: 'silverware-fork-knife',
      rent: 'home',
      grocer: 'shopping',
      grocery: 'shopping',
      salary: 'cash',
      income: 'cash',
      transport: 'car',
      travel: 'car',
      movie: 'movie',
      music: 'music'
    };

    const glyph = MaterialCommunityIcons && MaterialCommunityIcons.glyphMap ? MaterialCommunityIcons.glyphMap : {};
    const isValid = (ic) => !!glyph[ic];
    const fallbackList = ['tag', 'shopping', 'home', 'cash', 'credit-card', 'wallet', 'food', 'gift', 'account'];
    function chooseValid(ic) {
      if (isValid(ic)) return ic;
      for (const f of fallbackList) if (isValid(f)) return f;
      return 'tag';
    }

    // 1) exact token lookup
    for (const token of tokens) {
      if (suggestions[token]) return chooseValid(suggestions[token]);
    }
    // 2) whole text word-boundary lookup
    for (const key of Object.keys(suggestions)) {
      try {
        const re = new RegExp('\\b' + key + '\\b');
        if (re.test(t)) return chooseValid(suggestions[key]);
      } catch (e) { }
    }
    // 3) fuzzy token contains
    for (const token of tokens) {
      for (const key of Object.keys(suggestions)) if (token.includes(key) || key.includes(token)) return chooseValid(suggestions[key]);
    }

    // fallback to a safe default
    return chooseValid('tag');
  }

  // Auto-suggest icon while typing (unless user manually picked one)
  React.useEffect(() => {
    if (!userPickedIconAdd) {
      const s = suggestIconForText(name);
      setSelectedIcon(s);
    }
  }, [name, userPickedIconAdd]);

  React.useEffect(() => {
    if (!userPickedIconEdit && editName) {
      const s = suggestIconForText(editName);
      setEditIcon(s);
    }
  }, [editName, userPickedIconEdit]);

  return (
    <View style={styles.container}>
      {/* ───────────── Header / Summary ───────────── */}
      <View style={styles.headerSection}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.pageTitle}>Categories</Text>
            <Text style={styles.pageSubtitle}>
              Organize your income & expenses
            </Text>
          </View>

          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeNumber}>
              {items.length}
            </Text>
            <Text style={styles.totalBadgeLabel}>
              TOTAL
            </Text>
          </View>
        </View>

        {/* Summary stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.expenseStat]}>
            <View style={styles.statIconExpense}>
              <MaterialCommunityIcons
                name="arrow-down"
                size={16}
                color="#E46A6A"
              />
            </View>

            <View>
              <Text style={styles.statValue}>
                {items.filter(i => i.type === 'expense').length}
              </Text>
              <Text style={styles.statLabel}>
                Expenses
              </Text>
            </View>
          </View>

          <View style={[styles.statCard, styles.incomeStat]}>
            <View style={styles.statIconIncome}>
              <MaterialCommunityIcons
                name="arrow-up"
                size={16}
                color="#36B37E"
              />
            </View>

            <View>
              <Text style={styles.statValue}>
                {items.filter(i => i.type === 'income').length}
              </Text>
              <Text style={styles.statLabel}>
                Income
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ───────────── Search ───────────── */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search categories"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          iconColor="#7A8794"
          placeholderTextColor="#9AA5B1"
        />
      </View>

      {/* ───────────── Category List ───────────── */}
      <FlatList
        data={filteredItems}
        keyExtractor={(i) => String(i.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          filteredItems.length === 0 && styles.emptyListContent
        ]}
        ListHeaderComponent={
          filteredItems.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                All Categories
              </Text>

              <Text style={styles.listCount}>
                {filteredItems.length}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <MaterialCommunityIcons
                name="tag-multiple-outline"
                size={38}
                color="#9AA5B1"
              />
            </View>

            <Text style={styles.emptyTitle}>
              No categories found
            </Text>

            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try searching with a different name'
                : 'Create your first category to get started'}
            </Text>
          </View>
        }
        initialNumToRender={15}
        windowSize={10}
        renderItem={({ item }) => (
          <Card style={styles.categoryCard}>
            {editingId === item.id ? (
              <View>
                {/* Edit Preview */}
                <View
                  style={[
                    styles.editPreview,
                    {
                      backgroundColor:
                        editType === 'expense'
                          ? '#FFF7F7'
                          : '#F3FCF8'
                    }
                  ]}
                >
                  <View style={styles.editPreviewLeft}>
                    <View
                      style={[
                        styles.editPreviewIcon,
                        {
                          backgroundColor:
                            (editColor || '#4B7CF3') + '18'
                        }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={editIcon || 'tag'}
                        size={21}
                        color={editColor || '#4B7CF3'}
                      />
                    </View>

                    <View>
                      <Text style={styles.editPreviewCaption}>
                        EDITING CATEGORY
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={[
                          styles.editPreviewName,
                          {
                            color:
                              editType === 'expense'
                                ? '#E46A6A'
                                : '#36B37E'
                          }
                        ]}
                      >
                        {editName || 'Category'}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          editType === 'expense'
                            ? '#FEECEC'
                            : '#E6F8EF'
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        {
                          color:
                            editType === 'expense'
                              ? '#D95D5D'
                              : '#2F9B6D'
                        }
                      ]}
                    >
                      {editType === 'expense'
                        ? 'EXPENSE'
                        : 'INCOME'}
                    </Text>
                  </View>
                </View>

                <PaperTextInput
                  value={editName}
                  onChangeText={handleEditNameChange}
                  mode="outlined"
                  style={styles.editInput}
                  label="Category Name"
                  outlineColor="#E2E7EC"
                  activeOutlineColor="#4B7CF3"
                />

                <View style={styles.editTypeRow}>
                  <Chip
                    mode={
                      editType === 'expense'
                        ? 'flat'
                        : 'outlined'
                    }
                    selected={editType === 'expense'}
                    onPress={() => setEditType('expense')}
                    style={[
                      styles.typeChip,
                      editType === 'expense' &&
                      styles.expenseChipActive
                    ]}
                    selectedColor="#D95D5D"
                  >
                    Expense
                  </Chip>

                  <Chip
                    mode={
                      editType === 'income'
                        ? 'flat'
                        : 'outlined'
                    }
                    selected={editType === 'income'}
                    onPress={() => setEditType('income')}
                    style={[
                      styles.typeChip,
                      editType === 'income' &&
                      styles.incomeChipActive
                    ]}
                    selectedColor="#2F9B6D"
                  >
                    Income
                  </Chip>
                </View>

                <View style={styles.customizationRow}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() =>
                      setShowIconPickerForEdit(true)
                    }
                    style={[
                      styles.iconSelector,
                      {
                        backgroundColor:
                          (editColor || '#4B7CF3') + '15',
                        borderColor:
                          (editColor || '#4B7CF3') + '30'
                      }
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={editIcon || 'tag'}
                      size={24}
                      color={editColor || '#4B7CF3'}
                    />
                  </TouchableOpacity>

                  <IconButton
                    label="Colors"
                    icon="droplet"
                    onPress={() =>
                      setShowColorPickerForEdit(true)
                    }
                  />

                  <IconButton
                    label="Icon"
                    icon="image"
                    onPress={() =>
                      setShowIconPickerForEdit(true)
                    }
                  />
                </View>

                <View style={styles.editButtonsRow}>
                  <PaperButton
                    mode="contained"
                    onPress={saveEdit}
                    style={[
                      styles.saveButton,
                      {
                        backgroundColor:
                          editType === 'expense'
                            ? '#E46A6A'
                            : '#36B37E'
                      }
                    ]}
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.saveButtonLabel}
                  >
                    Save
                  </PaperButton>

                  <View style={{ width: 10 }} />

                  <PaperButton
                    mode="outlined"
                    onPress={cancelEdit}
                    style={styles.cancelButton}
                    contentStyle={styles.buttonContent}
                  >
                    Cancel
                  </PaperButton>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  const parent = navigation.getParent();

                  parent?.navigate('CategoriesDetails', {
                    categoryId: item.id,
                    categoryName: item.name
                  });
                }}
              >
                <View style={styles.categoryRow}>
                  {/* Left */}
                  <View style={styles.categoryLeft}>
                    <View
                      style={[
                        styles.categoryIconWrapper,
                        {
                          backgroundColor:
                            (item.color || '#4B7CF3') + '15'
                        }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon || 'tag'}
                        size={22}
                        color={item.color || '#4B7CF3'}
                      />
                    </View>

                    <View style={styles.categoryInfo}>
                      <Text
                        numberOfLines={1}
                        style={styles.categoryName}
                      >
                        {item.name}
                      </Text>

                      <View style={styles.categoryMeta}>
                        <View
                          style={[
                            styles.smallTypeDot,
                            {
                              backgroundColor:
                                item.type === 'income'
                                  ? '#36B37E'
                                  : '#E46A6A'
                            }
                          ]}
                        />

                        <Text style={styles.categoryType}>
                          {item.type === 'income'
                            ? 'Income'
                            : 'Expense'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Right */}
                  <View style={styles.categoryRight}>
                    <View
                      style={[
                        styles.typeBadge,
                        {
                          backgroundColor:
                            item.type === 'income'
                              ? '#E8F8F0'
                              : '#FDEDED'
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeBadgeText,
                          {
                            color:
                              item.type === 'income'
                                ? '#2F9B6D'
                                : '#D95D5D'
                          }
                        ]}
                      >
                        {item.type === 'income'
                          ? 'INCOME'
                          : 'EXPENSE'}
                      </Text>
                    </View>

                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          setEditCategory(item);
                          setShowModal(true);
                        }}
                        style={styles.actionButton}
                      >
                        <Feather
                          name="edit-2"
                          size={15}
                          color={Colors.primary}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          setConfirmTargetId(item.id);
                          setConfirmMessage(
                            `Delete "${item.name}"?`
                          );
                          setConfirmVisible(true);
                        }}
                        style={[
                          styles.actionButton,
                          styles.deleteActionButton
                        ]}
                      >
                        <Feather
                          name="trash-2"
                          size={15}
                          color="#E46A6A"
                        />
                      </TouchableOpacity>

                      <View style={styles.arrowContainer}>
                        <Feather
                          name="chevron-right"
                          size={17}
                          color="#B5BEC8"
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </Card>
        )}
      />

      {/* ───────────── Delete Confirmation ───────────── */}
      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Category"
        message={confirmMessage}
        onCancel={() => {
          setConfirmVisible(false);
          setConfirmTargetId(null);
        }}
        onConfirm={async () => {
          if (confirmTargetId) {
            await remove(confirmTargetId);
          }

          setConfirmVisible(false);
          setConfirmTargetId(null);
        }}
      />

      {/* ───────────── Add Icon Picker ───────────── */}
      <IconPicker
        visible={showIconPickerForAdd}
        onClose={() =>
          setShowIconPickerForAdd(false)
        }
        onSelect={(name) => {
          setSelectedIcon(name);
          setUserPickedIconAdd(true);
        }}
      />

      {/* ───────────── Edit Icon Picker ───────────── */}
      <IconPicker
        visible={showIconPickerForEdit}
        onClose={() =>
          setShowIconPickerForEdit(false)
        }
        onSelect={(name) => {
          setEditIcon(name);
          setUserPickedIconEdit(true);
        }}
      />

      {/* ───────────── Add Color Picker ───────────── */}
      <ColorPickerModal
        visible={showColorPickerForAdd}
        onClose={() =>
          setShowColorPickerForAdd(false)
        }
        onSelect={setSelectedColor}
        currentColor={selectedColor}
      />

      {/* ───────────── Edit Color Picker ───────────── */}
      <ColorPickerModal
        visible={showColorPickerForEdit}
        onClose={() =>
          setShowColorPickerForEdit(false)
        }
        onSelect={setEditColor}
        currentColor={editColor}
      />

      {/* ───────────── Create / Edit Modal ───────────── */}
      <CategoryCreateModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        editData={editCategory}
        onSave={() => {
          setShowModal(false);
          load();
        }}
      />

      {/* ───────────── FAB ───────────── */}
      <FAB
        onPress={() => {
          setEditCategory(null);
          setShowModal(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FB',
  },

  /* Header */
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  pageTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#24313D',
    letterSpacing: -0.4,
  },

  pageSubtitle: {
    fontSize: 12,
    color: '#8A96A3',
    marginTop: 3,
  },

  totalBadge: {
    minWidth: 55,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#EAF5EF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  totalBadgeNumber: {
    fontSize: 19,
    fontWeight: '900',
    color: '#3F8F6B',
    lineHeight: 21,
  },

  totalBadgeLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#6DA68A',
    letterSpacing: 0.8,
    marginTop: 2,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  statCard: {
    flex: 1,
    minHeight: 62,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  expenseStat: {
    backgroundColor: '#FFF3F3',
  },

  incomeStat: {
    backgroundColor: '#EFFAF5',
  },

  statIconExpense: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#FFE3E3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  statIconIncome: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#DDF6EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  statValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#263440',
  },

  statLabel: {
    fontSize: 10,
    color: '#8B97A3',
    marginTop: 1,
    fontWeight: '600',
  },

  /* Search */
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },

  searchBar: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E7EBEF',
  },

  searchInput: {
    fontSize: 13,
    color: '#354250',
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 110,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 9,
    paddingHorizontal: 2,
  },

  listTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#42515E',
  },

  listCount: {
    marginLeft: 7,
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#E9EDF1',
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 10,
    fontWeight: '800',
    color: '#778491',
  },

  /* Category Card */
  categoryCard: {
    marginBottom: 9,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 17,
    overflow: 'hidden',
  },

  categoryRow: {
    minHeight: 76,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  categoryLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  categoryIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  categoryInfo: {
    flex: 1,
    minWidth: 0,
  },

  categoryName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#293743',
  },

  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  smallTypeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },

  categoryType: {
    fontSize: 11,
    color: '#8A96A2',
    fontWeight: '600',
  },

  categoryRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },

  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  typeBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },

  actionButton: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: '#F0F5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },

  deleteActionButton: {
    backgroundColor: '#FFF1F1',
  },

  arrowContainer: {
    width: 25,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },

  /* Edit */
  editPreview: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  editPreviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },

  editPreviewIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  editPreviewCaption: {
    fontSize: 8,
    fontWeight: '900',
    color: '#9AA4AE',
    letterSpacing: 0.7,
    marginBottom: 2,
  },

  editPreviewName: {
    fontSize: 15,
    fontWeight: '900',
    maxWidth: 150,
  },

  editInput: {
    marginBottom: 9,
    backgroundColor: '#fff',
  },

  editTypeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },

  typeChip: {
    marginRight: 7,
    height: 36,
  },

  expenseChipActive: {
    backgroundColor: '#FEE4E4',
  },

  incomeChipActive: {
    backgroundColor: '#DDF6EA',
  },

  customizationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  iconSelector: {
    width: 48,
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 9,
  },

  editButtonsRow: {
    flexDirection: 'row',
  },

  saveButton: {
    flex: 1,
    borderRadius: 11,
  },

  cancelButton: {
    flex: 1,
    borderRadius: 11,
    borderColor: '#D8DEE4',
  },

  buttonContent: {
    paddingVertical: 3,
  },

  saveButtonLabel: {
    color: '#fff',
    fontWeight: '800',
  },

  /* Empty */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingTop: 65,
  },

  emptyIconContainer: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#EDF1F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#465461',
  },

  emptySubtitle: {
    fontSize: 12,
    color: '#9AA5AF',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});