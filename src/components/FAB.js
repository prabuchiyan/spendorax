import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Colors } from './Theme';

export default function FAB({ onPress, icon = '+', style }) {
  return (
    <TouchableOpacity onPress={onPress} style={[{
      position: 'absolute',
      right: 16,
      bottom: 24,
      backgroundColor: Colors.accent,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6
    }, style]}>
      <Text style={{ color: '#fff', fontSize: 28 }}>{icon}</Text>
    </TouchableOpacity>
  );
}
