import React, { useEffect, useState } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { createSource, updateSource } from '../services/sources';
import IconPicker from './IconPicker';
import ColorPickerModal from './ColorPickerModal';
import IconButton from './IconButton';

export default function SourceCreateModal({ visible, onClose, onSave, editData }) {

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
      is_active: 1
    };

    if (editData) {
      await updateSource(editData.id, payload);
    } else {
      await createSource(payload);
    }

    onSave();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>

          {/* HEADER */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: color }]}>
              <MaterialCommunityIcons name={icon} size={24} color="#fff" />
            </View>

            <View style={{ marginLeft: 12 }}>
              <Text style={styles.title}>
                {editData ? 'Edit Account' : 'New Account'}
              </Text>
              <Text style={styles.subtitle}>
                Manage your source details
              </Text>
            </View>
          </View>

          {/* FORM CARD */}
          <View style={styles.formCard}>

            <TextInput
              label="Source Name"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Initial Balance"
              value={initial}
              onChangeText={setInitial}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
            />

            {/* ICON / COLOR */}
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
            <Button onPress={onClose} textColor="#666">Cancel</Button>

            <Button
              mode="contained"
              onPress={handleSave}
              style={[styles.saveBtn, { backgroundColor: color }]}
            >
              {editData ? 'Update' : 'Create'}
            </Button>
          </View>

        </View>
      </View>

      {/* Pickers */}
      <IconPicker
        visible={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelect={(i) => setIcon(i)}
      />

      <ColorPickerModal
        visible={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        onSelect={setColor}
        currentColor={color}
      />
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

  // CONTROLS
  controls: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
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

  saveBtn: {
    borderRadius: 10,
    marginLeft: 8,
  },
});