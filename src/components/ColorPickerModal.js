import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, SafeAreaView } from 'react-native';
import IconButton from './IconButton';
import { Colors, Spacing } from './Theme';
import ColorPicker from 'react-native-wheel-color-picker';

const EXTENDED_COLORS = [
  '#4B7CF3', '#3B82F6', '#2563EB', '#6366F1', '#8B5CF6', '#A78BFA', '#F97316', '#FB923C', 
  '#F59E0B', '#FBBF24', '#16A34A', '#22C55E', '#A3E635', '#84CC16', '#DC2626', '#EF4444', 
  '#F43F5E', '#DB2777', '#0EA5A4', '#14B8A6', '#06B6D4', '#0891B2', '#334155', '#475569', '#64748B'
];

export default function ColorPickerModal({ visible, onClose, onSelect, currentColor }) {
  const [mode, setMode] = useState('palette'); // 'palette' | 'custom'
  const [customColorInput, setCustomColorInput] = useState(currentColor || '#4B7CF3');

  const handleApplyCustomColor = () => {
    onSelect(customColorInput);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: Spacing.m, backgroundColor: Colors.primary }}>
          <IconButton label="" icon="arrow-left" onPress={onClose} style={{ marginRight: Spacing.m, backgroundColor: 'transparent' }} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', flex: 1 }}>Select Color</Text>
        </View>

        <View style={{ flexDirection: 'row', padding: Spacing.m, justifyContent: 'center' }}>
          <TouchableOpacity 
            onPress={() => setMode('palette')}
            style={{ 
              paddingVertical: 8, paddingHorizontal: 24, 
              backgroundColor: mode === 'palette' ? Colors.primary : '#E2E8F0',
              borderTopLeftRadius: 20, borderBottomLeftRadius: 20
            }}>
            <Text style={{ color: mode === 'palette' ? '#fff' : Colors.text, fontWeight: '600' }}>Palette</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setMode('custom')}
            style={{ 
              paddingVertical: 8, paddingHorizontal: 24, 
              backgroundColor: mode === 'custom' ? Colors.primary : '#E2E8F0',
              borderTopRightRadius: 20, borderBottomRightRadius: 20
            }}>
            <Text style={{ color: mode === 'custom' ? '#fff' : Colors.text, fontWeight: '600' }}>Custom</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, padding: Spacing.m }}>
          {mode === 'palette' ? (
            <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              {EXTENDED_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => { onSelect(c); onClose(); }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: c,
                    margin: 8,
                    borderWidth: currentColor === c ? 3 : 0,
                    borderColor: '#222',
                    elevation: 2,
                    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }
                  }}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={{ flex: 1, marginBottom: Spacing.l }}>
                <ColorPicker
                  color={customColorInput}
                  onColorChangeComplete={(color) => setCustomColorInput(color)}
                  thumbSize={30}
                  sliderSize={30}
                  noSnap={true}
                  row={false}
                  swatches={false}
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.m }}>
                <Text style={{ fontSize: 16, fontWeight: '600', marginRight: Spacing.m, color: Colors.text }}>HEX Code:</Text>
                <TextInput
                  value={customColorInput}
                  onChangeText={setCustomColorInput}
                  style={{ flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, color: Colors.text, backgroundColor: '#fff' }}
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity 
                onPress={handleApplyCustomColor}
                style={{ backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Apply Color</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}