import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {
  TextInput as PaperInput,
  Button as PaperButton,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import IconPicker from './IconPicker';
import ColorPickerModal from './ColorPickerModal';
import FormModalShell from './FormModalShell';
import FormControlButton from './FormControlButton';
import formModalStyles from './formModalStyles';
import { createCategory, updateCategory } from '../services/categories';
import { suggestIconForText } from '../utils/iconSuggest';

export default function CategoryCreateModal({
  visible,
  onClose,
  onCategoryCreated,
  onSave,
  editData,
  currentType = 'expense',
}) {
  const [action, setAction] = useState('');
  const [submitText, setSubmitText] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState(currentType);
  const [selectedIcon, setSelectedIcon] = useState('tag');
  const [selectedColor, setSelectedColor] = useState('#4B7CF3');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);

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
      setSaving(false);
    }
  }, [visible, editData, currentType]);

  useEffect(() => {
    if (!editData) {
      setSelectedIcon(suggestIconForText(name));
    }
  }, [name, editData]);

  const handleCreateCategory = async () => {
    if (saving) {
      return;
    }
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setSaving(true);

    try {
      if (editData && editData.id) {
        await updateCategory(editData.id, {
          name: name.trim(),
          type,
          icon: selectedIcon,
          color: selectedColor,
          is_active:
            editData.is_active !== undefined
              ? editData.is_active
              : 1,
        });

        if (onSave) {
          onSave({
            id: editData.id,
            name: name.trim(),
            type,
            icon: selectedIcon,
            color: selectedColor,
          });
        }
        if (onCategoryCreated) {
          onCategoryCreated({
            id: editData.id,
            name: name.trim(),
            type,
            icon: selectedIcon,
            color: selectedColor,
          });
        }
      } else {
        const newCategory = await createCategory({
          name: name.trim(),
          type,
          icon: selectedIcon,
          color: selectedColor,
        });
        const categoryResult = {
          id: newCategory,
          name: name.trim(),
          type,
          icon: selectedIcon,
          color: selectedColor,
        };
        if (onCategoryCreated) {
          onCategoryCreated(categoryResult);
        }
        if (onSave) {
          onSave(categoryResult);
        }
      }
      onClose();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const isIncome = type === 'income';
  return (
    <FormModalShell
      visible={visible}
      onClose={saving ? undefined : onClose}
      icon={selectedIcon}
      iconColor={selectedColor}
      title={action}
      subtitle={
        editData
          ? 'Update your category details'
          : 'Create a category for your finances'
      }
      actions={
        <View style={styles.footerActions}>
          <PaperButton
            mode="outlined"
            onPress={onClose}
            disabled={saving}
            style={styles.cancelButton}
            contentStyle={styles.actionContent}
            labelStyle={styles.cancelLabel}
          >
            Cancel
          </PaperButton>
          <PaperButton
            mode="contained"
            onPress={handleCreateCategory}
            loading={saving}
            disabled={saving}
            style={[
              styles.submitButton,
              {
                backgroundColor: isIncome
                  ? '#36B37E'
                  : '#4B7CF3',
              },
            ]}
            contentStyle={styles.actionContent}
            labelStyle={styles.submitLabel}
          >
            {saving ? '' : submitText}
          </PaperButton>
        </View>
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
      {/* ───────────── Live Preview ───────────── */}
      <View
        style={[
          styles.previewCard,
          {
            backgroundColor: selectedColor + '0D',
            borderColor: selectedColor + '25',
          },
        ]}
      >
        <View
          style={[
            styles.previewIcon,
            {
              backgroundColor: selectedColor + '20',
            },
          ]}
        >
          <MaterialCommunityIcons
            name={selectedIcon || 'tag'}
            size={30}
            color={selectedColor}
          />
        </View>

        <View style={styles.previewInfo}>
          <Text style={styles.previewLabel}>
            CATEGORY PREVIEW
          </Text>

          <Text
            numberOfLines={1}
            style={styles.previewName}
          >
            {name.trim() || 'Category name'}
          </Text>

          <View style={styles.previewTypeRow}>
            <View
              style={[
                styles.previewDot,
                {
                  backgroundColor: isIncome
                    ? '#36B37E'
                    : '#E46A6A',
                },
              ]}
            />

            <Text style={styles.previewType}>
              {isIncome ? 'Income' : 'Expense'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.previewTypeBadge,
            {
              backgroundColor: isIncome
                ? '#E5F8EF'
                : '#FDECEC',
            },
          ]}
        >
          <Text
            style={[
              styles.previewTypeBadgeText,
              {
                color: isIncome
                  ? '#2F9B6D'
                  : '#D95D5D',
              },
            ]}
          >
            {isIncome ? 'INCOME' : 'EXPENSE'}
          </Text>
        </View>
      </View>

      {/* ───────────── Category Name ───────────── */}
      <Text style={styles.sectionLabel}>
        CATEGORY NAME
      </Text>

      <PaperInput
        label="Category Name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setNameError(false);
        }}
        mode="outlined"
        style={styles.input}
        outlineColor={
          nameError ? '#E46A6A' : '#E1E6EB'
        }
        activeOutlineColor={selectedColor}
        error={nameError}
        disabled={saving}
        left={
          <PaperInput.Icon
            icon="tag-outline"
            color="#9AA5B1"
          />
        }
      />

      {nameError && (
        <Text style={styles.errorText}>
          Category name is required
        </Text>
      )}

      {/* ───────────── Category Type ───────────── */}
      <Text style={styles.sectionLabel}>
        CATEGORY TYPE
      </Text>

      <View style={styles.typeSelector}>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={saving}
          onPress={() => setType('expense')}
          style={[
            styles.typeOption,
            type === 'expense' && styles.expenseActive,
          ]}
        >
          <View
            style={[
              styles.typeIcon,
              {
                backgroundColor:
                  type === 'expense'
                    ? '#FFE2E2'
                    : '#F3F5F7',
              },
            ]}
          >
            <MaterialCommunityIcons
              name="arrow-down"
              size={17}
              color={
                type === 'expense'
                  ? '#E46A6A'
                  : '#8995A0'
              }
            />
          </View>

          <View style={styles.typeTextContainer}>
            <Text
              style={[
                styles.typeTitle,
                type === 'expense' && {
                  color: '#D95D5D',
                },
              ]}
            >
              Expense
            </Text>

            <Text style={styles.typeSubtitle}>
              Money going out
            </Text>
          </View>

          {type === 'expense' && (
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color="#E46A6A"
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={saving}
          onPress={() => setType('income')}
          style={[
            styles.typeOption,
            type === 'income' && styles.incomeActive,
          ]}
        >
          <View
            style={[
              styles.typeIcon,
              {
                backgroundColor:
                  type === 'income'
                    ? '#DDF6EA'
                    : '#F3F5F7',
              },
            ]}
          >
            <MaterialCommunityIcons
              name="arrow-up"
              size={17}
              color={
                type === 'income'
                  ? '#36B37E'
                  : '#8995A0'
              }
            />
          </View>

          <View style={styles.typeTextContainer}>
            <Text
              style={[
                styles.typeTitle,
                type === 'income' && {
                  color: '#2F9B6D',
                },
              ]}
            >
              Income
            </Text>

            <Text style={styles.typeSubtitle}>
              Money coming in
            </Text>
          </View>

          {type === 'income' && (
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color="#36B37E"
            />
          )}
        </TouchableOpacity>
      </View>

      {/* ───────────── Appearance ───────────── */}
      <View style={styles.appearanceHeader}>
        <Text style={styles.sectionLabel}>
          APPEARANCE
        </Text>

        <Text style={styles.appearanceHint}>
          Customize
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={saving}
          onPress={() => setShowIconPicker(true)}
          style={styles.controlCard}
        >
          <View
            style={[
              styles.controlIcon,
              {
                backgroundColor:
                  selectedColor + '15',
              },
            ]}
          >
            <MaterialCommunityIcons
              name={selectedIcon || 'tag'}
              size={21}
              color={selectedColor}
            />
          </View>

          <View style={styles.controlText}>
            <Text style={styles.controlTitle}>
              Icon
            </Text>

            <Text style={styles.controlSubtitle}>
              Choose icon
            </Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={19}
            color="#A4ADB6"
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          disabled={saving}
          onPress={() => setShowColorPicker(true)}
          style={styles.controlCard}
        >
          <View
            style={[
              styles.colorPreview,
              {
                backgroundColor: selectedColor,
              },
            ]}
          />

          <View style={styles.controlText}>
            <Text style={styles.controlTitle}>
              Color
            </Text>

            <Text style={styles.controlSubtitle}>
              Choose color
            </Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={19}
            color="#A4ADB6"
          />
        </TouchableOpacity>
      </View>
    </FormModalShell>
  );
}

const styles = {
  previewCard: {
    minHeight: 88,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  previewIcon: {
    width: 56,
    height: 56,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  previewInfo: {
    flex: 1,
    minWidth: 0,
  },

  previewLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#9AA5AF',
    letterSpacing: 0.8,
    marginBottom: 3,
  },

  previewName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#293743',
  },

  previewTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  previewType: {
    fontSize: 10,
    color: '#8995A0',
    fontWeight: '600',
  },

  previewTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 8,
  },

  previewTypeBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#7F8B96',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#FFFFFF',
    marginBottom: 4,
  },

  errorText: {
    color: '#E46A6A',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    marginBottom: 9,
  },

  typeSelector: {
    gap: 9,
    marginBottom: 18,
  },

  typeOption: {
    minHeight: 62,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E5E9ED',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },

  expenseActive: {
    borderColor: '#F1BABA',
    backgroundColor: '#FFF8F8',
  },

  incomeActive: {
    borderColor: '#A9DFC6',
    backgroundColor: '#F5FCF8',
  },

  typeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  typeTextContainer: {
    flex: 1,
  },

  typeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#45525E',
  },

  typeSubtitle: {
    fontSize: 10,
    color: '#9AA5AF',
    marginTop: 2,
  },

  appearanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  appearanceHint: {
    fontSize: 10,
    color: '#A0AAB4',
    marginBottom: 8,
  },

  controls: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 4,
  },

  controlCard: {
    flex: 1,
    minHeight: 64,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E5E9ED',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  controlIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  colorPreview: {
    width: 25,
    height: 25,
    borderRadius: 9,
    marginHorizontal: 5,
    marginRight: 14,
  },

  controlText: {
    flex: 1,
    minWidth: 0,
  },

  controlTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3D4B57',
  },

  controlSubtitle: {
    fontSize: 9,
    color: '#9AA5AF',
    marginTop: 2,
  },

  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  cancelButton: {
    borderRadius: 11,
    borderColor: '#DCE2E7',
    marginRight: 8,
  },

  submitButton: {
    borderRadius: 11,
  },

  actionContent: {
    paddingVertical: 3,
    paddingHorizontal: 7,
  },

  cancelLabel: {
    color: '#66737F',
    fontWeight: '700',
  },

  submitLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
};