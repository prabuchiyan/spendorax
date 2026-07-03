import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import Card from './Card';
import IconButton from './IconButton';
import { Spacing } from './Theme';

const EXTENDED_COLORS = ['#4B7CF3', '#3B82F6', '#2563EB', '#6366F1', '#8B5CF6', '#A78BFA', '#F97316', '#FB923C', '#F59E0B', '#FBBF24', '#16A34A', '#22C55E', '#A3E635', '#84CC16', '#DC2626', '#EF4444', '#F43F5E', '#DB2777', '#0EA5A4', '#14B8A6', '#06B6D4', '#0891B2', '#334155', '#475569', '#64748B'];

export default function ColorPickerModal({ visible, onClose, onSelect, currentColor }) {
  const [customColorInput, setCustomColorInput] = useState('');

  const handleApplyCustomColor = () => {
    const hex = customColorInput.trim();
    if (/^#([0-9A-Fa-f]{6})$/.test(hex)) {
      onSelect(hex);
      onClose();
      setCustomColorInput('');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: Spacing.m }}>
        <Card style={{ padding: Spacing.m }}>
          <Text style={{ fontSize: 16, marginBottom: Spacing.s }}>Choose color</Text>
          <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {EXTENDED_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => { onSelect(c); onClose(); }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: c,
                  margin: 6,
                  borderWidth: currentColor === c ? 2 : 0,
                  borderColor: '#222'
                }}
              />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', marginTop: Spacing.s, alignItems: 'center' }}>
            <TextInput
              placeholder="#rrggbb"
              value={customColorInput}
              onChangeText={setCustomColorInput}
              style={{ flex: 1, borderWidth: 1, borderColor: '#eee', padding: 8, borderRadius: 8 }}
            />
            <View style={{ width: Spacing.s }} />
            <IconButton label="Apply" icon="check" onPress={handleApplyCustomColor} />
          </View>
          <View style={{ height: Spacing.s }} />
          <IconButton label="Close" icon="x" onPress={onClose} />
        </Card>
      </View>
    </Modal>
  );
}