import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { TextInput as PaperInput, Button as PaperButton } from 'react-native-paper';
import IconPicker from './IconPicker';
import ColorPickerModal from './ColorPickerModal';
import FormModalShell from './FormModalShell';
import FormControlButton from './FormControlButton';
import formModalStyles from './formModalStyles';
import { createCategory, updateCategory } from '../services/categories';
import { suggestIconForText } from '../utils/iconSuggest';

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
    <FormModalShell
      visible={visible}
      onClose={onClose}
      icon={selectedIcon}
      iconColor={selectedColor}
      title={action}
      subtitle="Manage your category"
      actions={
        <>
          <PaperButton mode="outlined" onPress={onClose} style={{ marginRight: 8 }}>
            Cancel
          </PaperButton>
          <PaperButton mode="contained" onPress={handleCreateCategory}>
            {submitText}
          </PaperButton>
        </>
      }
      footer={
        <>
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
        </>
      }
    >
      <PaperInput
        label="Category Name"
        value={name}
        onChangeText={(text) => { setName(text); setNameError(false); }}
        mode="outlined"
        style={formModalStyles.input}
        error={nameError}
      />

      {nameError && (
        <Text style={{ color: '#E46A6A', marginBottom: 8 }}>
          Category name is required
        </Text>
      )}

      <View style={formModalStyles.typeRow}>
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

      <View style={formModalStyles.controls}>
        <FormControlButton icon="image" label="Icon" onPress={() => setShowIconPicker(true)} />
        <FormControlButton icon="palette" label="Color" onPress={() => setShowColorPicker(true)} />
      </View>
    </FormModalShell>
  );
}
