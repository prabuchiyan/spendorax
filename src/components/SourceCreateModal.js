import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { createSource, updateSource } from '../services/sources';
import IconPicker from './IconPicker';
import ColorPickerModal from './ColorPickerModal';
import FormModalShell from './FormModalShell';
import FormControlButton from './FormControlButton';
import formModalStyles from './formModalStyles';

export default function SourceCreateModal({
  visible,
  onClose,
  onSave,
  onSourceCreated,
  editData,
}) {
  const [name, setName] = useState('');
  const [initial, setInitial] = useState('0');
  const [icon, setIcon] = useState('cash');
  const [color, setColor] = useState('#4B7CF3');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Only initialize/reset when the modal is opened
    if (!visible) {
      return;
    }
    if (editData) {
      // EDIT MODE
      setName(editData.name || '');
      setInitial(String(editData.initial_balance || 0));
      setIcon(editData.icon || 'cash');
      setColor(editData.color || '#4B7CF3');
    } else {
      // CREATE MODE - always start completely fresh
      setName('');
      setInitial('0');
      setIcon('cash');
      setColor('#4B7CF3');
    }
    setSaving(false);
    setShowIconPicker(false);
    setShowColorPicker(false);
  }, [visible, editData]);

  async function handleSave() {
    // Prevent duplicate taps
    if (saving) {
      return;
    }
    if (!name.trim()) {
      return;
    }

    const payload = {
      name: name.trim(),
      initial_balance: parseFloat(initial) || 0,
      icon,
      color,
      is_active: 1,
    };
    setSaving(true);
    try {
      if (editData && editData.id) {
        // EDIT
        await updateSource(editData.id, payload);
      } else {
        // CREATE
        await createSource(payload);
      }
      if (onSourceCreated) {
        onSourceCreated();
      } else if (onSave) {
        onSave();
      }
    } catch (error) {
      console.error('Error saving source:', error);
      alert('Failed to save source. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModalShell
      visible={visible}
      onClose={saving ? undefined : onClose}
      icon={icon}
      iconColor={color}
      iconSize={24}
      title={editData ? 'Edit Account' : 'New Account'}
      subtitle="Manage your source details"
      actions={
        <>
          <Button
            onPress={onClose}
            textColor="#666"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={[
              formModalStyles.saveBtn,
              { backgroundColor: color },
            ]}
          >
            {saving ? '' : editData ? 'Update' : 'Create'}
          </Button>
        </>
      }
      footer={
        <>
          <IconPicker
            visible={showIconPicker}
            onClose={() => setShowIconPicker(false)}
            onSelect={setIcon}
          />
          <ColorPickerModal
            visible={showColorPicker}
            onClose={() => setShowColorPicker(false)}
            onSelect={setColor}
            currentColor={color}
          />
        </>
      }
    >
      <TextInput
        label="Source Name"
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={formModalStyles.input}
        disabled={saving}
      />

      <TextInput
        label="Initial Balance"
        value={initial}
        onChangeText={setInitial}
        keyboardType="numeric"
        mode="outlined"
        style={formModalStyles.input}
        disabled={saving}
      />

      <View style={formModalStyles.controls}>
        <FormControlButton
          icon="image"
          label="Icon"
          onPress={() => setShowIconPicker(true)}
          disabled={saving}
        />
        <FormControlButton
          icon="palette"
          label="Color"
          onPress={() => setShowColorPicker(true)}
          disabled={saving}
        />
      </View>
    </FormModalShell>
  );
}