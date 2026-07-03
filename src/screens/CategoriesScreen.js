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
    <View style={{ flex: 1 }}>
      <View style={{ padding: Spacing.m, paddingBottom: 0 }}>
        <Searchbar
          placeholder="Search Categories..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ elevation: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' }}
          inputStyle={{ fontSize: 14 }}
        />
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: Spacing.m, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#ccc" />
            <Text style={{ color: Colors.muted, marginTop: 12 }}>No categories found</Text>
          </View>
        }
        initialNumToRender={15}
        windowSize={10}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: Spacing.s }}>
            {editingId === item.id ? (
              <View>
                <View style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                  <View
                    style={{
                      backgroundColor: editType === 'expense' ? '#FFF6F6' : '#F6FFFA',
                      padding: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: (editColor || '#4B7CF3') + '20',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 10
                        }}
                      >
                        <MaterialCommunityIcons name={editIcon || 'tag'} size={18} color={editColor || '#4B7CF3'} />
                      </View>
                      <Text
                        style={{
                          color: editType === 'expense' ? '#E46A6A' : '#36B37E',
                          fontWeight: '700'
                        }}
                      >
                        {editType.toUpperCase()}
                      </Text>
                    </View>

                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 16,
                        fontWeight: '800',
                        color: editType === 'expense' ? '#E46A6A' : '#36B37E',
                        maxWidth: '55%'
                      }}
                    >
                      {editName || 'Category'}
                    </Text>
                  </View>
                </View>

                <PaperTextInput
                  value={editName}
                  onChangeText={handleEditNameChange}
                  mode="outlined"
                  style={{ marginBottom: 8, backgroundColor: '#fff' }}
                  label="Category Name"
                />

                <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                  <Chip
                    mode={editType === 'expense' ? 'flat' : 'outlined'}
                    selected={editType === 'expense'}
                    onPress={() => setEditType('expense')}
                    style={{
                      marginRight: 8,
                      backgroundColor: editType === 'expense' ? '#FEE2E2' : 'transparent'
                    }}
                    selectedColor="#E46A6A"
                  >
                    Expense
                  </Chip>

                  <Chip
                    mode={editType === 'income' ? 'flat' : 'outlined'}
                    selected={editType === 'income'}
                    onPress={() => setEditType('income')}
                    style={{
                      backgroundColor: editType === 'income' ? '#D1FAE5' : 'transparent'
                    }}
                    selectedColor="#36B37E"
                  >
                    Income
                  </Chip>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => setShowIconPickerForEdit(true)}
                    style={[
                      styles.iconSelector,
                      {
                        backgroundColor: (editColor || '#4B7CF3') + '15',
                        marginRight: 10
                      }
                    ]}
                  >
                    <MaterialCommunityIcons name={editIcon} size={24} color={editColor} />
                  </TouchableOpacity>

                  <IconButton label="Colors" icon="droplet" onPress={() => setShowColorPickerForEdit(true)} />
                  <IconButton label="Icon" icon="image" onPress={() => setShowIconPickerForEdit(true)} />
                </View>

                <View style={{ flexDirection: 'row' }}>
                  <PaperButton
                    mode="contained"
                    onPress={saveEdit}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      backgroundColor: editType === 'expense' ? '#E46A6A' : '#36B37E'
                    }}
                    contentStyle={{ paddingVertical: 4 }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                  >
                    Save
                  </PaperButton>

                  <View style={{ width: 8 }} />

                  <PaperButton
                    mode="outlined"
                    onPress={cancelEdit}
                    style={{ flex: 1, borderRadius: 10 }}
                    contentStyle={{ paddingVertical: 4 }}
                  >
                    Cancel
                  </PaperButton>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  const parent = navigation.getParent();
                  parent?.navigate('CategoriesDetails', {
                    categoryId: item.id,
                    categoryName: item.name
                  });
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Avatar.Icon
                      size={40}
                      icon={item.icon || 'tag'}
                      style={{
                        backgroundColor: (item.color || '#eee') + '15',
                        marginRight: 12
                      }}
                      color={item.color || '#999'}
                    />

                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontWeight: '700', fontSize: 15, color: Colors.text }}
                      >
                        {item.name}
                      </Text>

                      <Text style={{ color: Colors.muted, fontSize: 12, marginTop: 2 }}>
                        {item.type === 'income' ? 'Income' : 'Expense'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                    <Text
                      style={{
                        fontWeight: '800',
                        fontSize: 16,
                        color: item.type === 'expense' ? '#E46A6A' : '#36B37E'
                      }}
                    >
                      {item.type === 'income' ? 'Income' : 'Expense'}
                    </Text>

                    <Text style={{ color: Colors.muted, fontSize: 10, marginTop: 2 }}>
                      Category
                    </Text>

                    <View style={{ flexDirection: 'row', marginTop: 8 }}>
                      <TouchableOpacity
                        onPress={() => { setEditCategory(item); setShowModal(true); }}
                        style={{ marginRight: 10 }}
                      >
                        <Feather name="edit-2" size={16} color={Colors.primary} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setConfirmTargetId(item.id);
                          setConfirmMessage(`Delete "${item.name}"?`);
                          setConfirmVisible(true);
                        }}
                      >
                        <Feather name="trash-2" size={16} color="#E46A6A" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </Card>
        )}
      />

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Category"
        message={confirmMessage}
        onCancel={() => { setConfirmVisible(false); setConfirmTargetId(null); }}
        onConfirm={async () => {
          if (confirmTargetId) {
            await remove(confirmTargetId);
          }
          setConfirmVisible(false);
          setConfirmTargetId(null);
        }}
      />

      <IconPicker
        visible={showIconPickerForAdd}
        onClose={() => setShowIconPickerForAdd(false)}
        onSelect={(name) => { setSelectedIcon(name); setUserPickedIconAdd(true); }}
      />

      <IconPicker
        visible={showIconPickerForEdit}
        onClose={() => setShowIconPickerForEdit(false)}
        onSelect={(name) => { setEditIcon(name); setUserPickedIconEdit(true); }}
      />

      <ColorPickerModal
        visible={showColorPickerForAdd}
        onClose={() => setShowColorPickerForAdd(false)}
        onSelect={setSelectedColor}
        currentColor={selectedColor}
      />

      <ColorPickerModal
        visible={showColorPickerForEdit}
        onClose={() => setShowColorPickerForEdit(false)}
        onSelect={setEditColor}
        currentColor={editColor}
      />

      <CategoryCreateModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        editData={editCategory}
        onSave={() => {
          setShowModal(false);
          load();
        }}
      />

      <FAB onPress={() => { setEditCategory(null); setShowModal(true); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconSelector: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
});