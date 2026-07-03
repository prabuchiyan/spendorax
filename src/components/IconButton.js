import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from './Theme';

export default function IconButton({ onPress, label, icon = 'circle', style, iconSize = 18 }) {
  return (
    <TouchableOpacity onPress={onPress} style={[{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: Colors.card
    }, style]}>
      <View style={{ marginRight: 8 }}>
        <Feather name={icon} size={iconSize} color={Colors.primary} />
      </View>
      <Text style={{ color: Colors.text, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}
