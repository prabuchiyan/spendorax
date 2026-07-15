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

  useEffect(() => {
    if (editData) {
      setName(editData.name || '');
      setInitial(String(editData.initial_balance || 0));
      setIcon(editData.icon || 'cash');
      setColor(editData.color || '#4B7CF3');
    } else {
      setName('');
      setInitial('0');
      setIcon('cash');
      setColor('#4B7CF3');
    }
  }, [editData]);

  async function handleSave() {
    if (!name) return;

    const payload = {
      name,
      initial_balance: parseFloat(initial) || 0,
      icon,
      color,
      is_active: 1,
    };

    if (editData) {
      await updateSource(editData.id, payload);
    } else {
      await createSource(payload);
    }

    if (onSourceCreated) {
      onSourceCreated();
    } else if (onSave) {
      onSave();
    }
  }

  return (
    <FormModalShell
      visible={visible}
      onClose={onClose}
      icon={icon}
      iconColor={color}
      iconSize={24}
      title={editData ? 'Edit Account' : 'New Account'}
      subtitle="Manage your source details"
      actions={
        <>
          <Button onPress={onClose} textColor="#666">Cancel</Button>
          <Button
            mode="contained"
            onPress={handleSave}
            style={[formModalStyles.saveBtn, { backgroundColor: color }]}
          >
            {editData ? 'Update' : 'Create'}
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
      />

      <TextInput
        label="Initial Balance"
        value={initial}
        onChangeText={setInitial}
        keyboardType="numeric"
        mode="outlined"
        style={formModalStyles.input}
      />

      <View style={formModalStyles.controls}>
        <FormControlButton icon="image" label="Icon" onPress={() => setShowIconPicker(true)} />
        <FormControlButton icon="palette" label="Color" onPress={() => setShowColorPicker(true)} />
      </View>
    </FormModalShell>
  );
}
