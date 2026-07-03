import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { TextInput as PaperInput, Button as PaperButton, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Card from './Card';
import IconButton from './IconButton';
import IconPicker from './IconPicker';
import ColorPickerModal from './ColorPickerModal';
import { createCategory, updateCategory } from '../services/categories';
import { Spacing } from './Theme';

export default function CategoryCreateModal({ visible, onClose, onCategoryCreated, onSave, editData, currentType = 'expense' }) {
  const [action, setAction] = useState('');
  const [submitText, setSubmitText] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState(currentType);
  const [selectedIcon, setSelectedIcon] = useState('tag');
  const [selectedColor, setSelectedColor] = useState('#4B7CF3');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [nameError, setNameError] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      if (editData) {
        setAction('Edit Category');
        setSubmitText('Save');
        setName(editData.name || '');
        setType(editData.type || 'expense');
        setSelectedIcon(editData.icon || 'tag');
        setSelectedColor(editData.color || '#4B7CF3');
      } else {
        setAction('Create New Category');
        setSubmitText('Create');
        setName('');
        setType(currentType);
        setSelectedIcon('tag');
        setSelectedColor('#4B7CF3');
      }
      setNameError(false);
    }
  }, [visible, editData, currentType]);

  // Simple icon suggestion based on name, similar to CategoriesScreen
  function suggestIconForText(text) {
    if (!text) return 'tag';
    const t = text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = t.split(/\s+/).filter(Boolean);
    const suggestions = {
      gym: 'dumbbell', fitness: 'dumbbell', snack: 'food-apple', food: 'food', coffee: 'coffee', tea: 'coffee',
      veg: 'leaf', vegetable: 'leaf', non: 'food-drumstick', meat: 'food-drumstick', dinner: 'silverware-fork-knife',
      lunch: 'silverware-fork-knife', breakfast: 'silverware-fork-knife', rent: 'home', grocer: 'shopping',
      grocery: 'shopping', salary: 'cash', income: 'cash', transport: 'car', travel: 'car', movie: 'movie', music: 'music'
    };

    const glyph = MaterialCommunityIcons && MaterialCommunityIcons.glyphMap ? MaterialCommunityIcons.glyphMap : {};
    const isValid = (ic) => !!glyph[ic];
    const fallbackList = ['tag', 'shopping', 'home', 'cash', 'credit-card', 'wallet', 'food', 'gift', 'account'];
    function chooseValid(ic) {
      if (isValid(ic)) return ic;
      for (const f of fallbackList) if (isValid(f)) return f;
      return 'tag';
    }

    for (const token of tokens) { if (suggestions[token]) return chooseValid(suggestions[token]); }
    for (const key of Object.keys(suggestions)) {
      try { const re = new RegExp('\\b' + key + '\\b'); if (re.test(t)) return chooseValid(suggestions[key]); } catch (e) { }
    }
    for (const token of tokens) { for (const key of Object.keys(suggestions)) if (token.includes(key) || key.includes(token)) return chooseValid(suggestions[key]); }
    return chooseValid('tag');
  }

  useEffect(() => {
    if (!editData) {
      setSelectedIcon(suggestIconForText(name));
    }
  }, [name, editData]);

  const handleCreateCategory = async () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);

    try {
      if (editData && editData.id) {
        await updateCategory(editData.id, {
          name: name.trim(),
          type,
          icon: selectedIcon,
          color: selectedColor,
          is_active: editData.is_active !== undefined ? editData.is_active : 1,
        });
        if (onSave) onSave({ id: editData.id, name: name.trim(), type, icon: selectedIcon, color: selectedColor });
        if (onCategoryCreated) onCategoryCreated({ id: editData.id, name: name.trim(), type, icon: selectedIcon, color: selectedColor });
      } else {
        const newCategory = await createCategory({
          name: name.trim(),
          type,
          icon: selectedIcon,
          color: selectedColor,
        });
        const categoryResult = { id: newCategory, name: name.trim(), type, icon: selectedIcon, color: selectedColor };
        if (onCategoryCreated) onCategoryCreated(categoryResult);
        if (onSave) onSave(categoryResult);
      }
      onClose();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category. Please try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>

          {/* HEADER (same as source modal) */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: selectedColor }]}>
              <MaterialCommunityIcons name={selectedIcon} size={22} color="#fff" />
            </View>

            <View style={{ marginLeft: 12 }}>
              <Text style={styles.title}>{action}</Text>
              <Text style={styles.subtitle}>Manage your category</Text>
            </View>
          </View>

          {/* FORM */}
          <View style={styles.formCard}>

            <PaperInput
              label="Category Name"
              value={name}
              onChangeText={(text) => { setName(text); setNameError(false); }}
              mode="outlined"
              style={styles.input}
              error={nameError}
            />

            {nameError && (
              <Text style={{ color: '#E46A6A', marginBottom: 8 }}>
                Category name is required
              </Text>
            )}

            {/* TYPE SWITCH */}
            <View style={styles.typeRow}>
              <PaperButton
                mode={type === 'income' ? 'contained' : 'outlined'}
                onPress={() => setType('income')}
                style={{ marginRight: 8 }}
              >
                Income
              </PaperButton>

              <PaperButton
                mode={type === 'expense' ? 'contained' : 'outlined'}
                onPress={() => setType('expense')}
              >
                Expense
              </PaperButton>
            </View>

            {/* ICON + COLOR */}
            <View style={styles.controls}>
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => setShowIconPicker(true)}
              >
                <MaterialCommunityIcons name="image" size={18} color="#444" />
                <Text style={styles.controlText}>Icon</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => setShowColorPicker(true)}
              >
                <MaterialCommunityIcons name="palette" size={18} color="#444" />
                <Text style={styles.controlText}>Color</Text>
              </TouchableOpacity>
            </View>

          </View>

          {/* ACTIONS */}
          <View style={styles.actions}>
            <PaperButton mode="outlined" onPress={onClose} style={{ marginRight: 8 }}>
              Cancel
            </PaperButton>

            <PaperButton mode="contained" onPress={handleCreateCategory}>
              {submitText}
            </PaperButton>
          </View>

        </View>

        {/* PICKERS */}
        <IconPicker
          visible={showIconPicker}
          onClose={() => setShowIconPicker(false)}
          onSelect={setSelectedIcon}
        />

        <ColorPickerModal
          visible={showColorPicker}
          onClose={() => setShowColorPicker(false)}
          onSelect={setSelectedColor}
          currentColor={selectedColor}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },

  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
  },

  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },

  subtitle: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },

  // FORM
  formCard: {
    backgroundColor: '#fafafa',
    borderRadius: 14,
    padding: 12,
  },

  input: {
    marginBottom: 10,
    backgroundColor: '#fff',
  },

  typeRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },

  // CONTROLS
  controls: {
    flexDirection: 'row',
    marginTop: 6,
  },

  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },

  controlText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#444',
    fontWeight: '500',
  },

  // ACTIONS
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
});