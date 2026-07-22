import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from './Theme';

export default function EmptyState({
  icon = 'clipboard-text-outline',
  message = 'No items found',
  style,
  iconSize = 48,
  iconColor = '#ccc',
}) {
  return (
    <View style={[styles.container, style]}>
      <MaterialCommunityIcons name={icon} size={iconSize} color={iconColor} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 60,
  },
  message: {
    color: Colors.muted,
    marginTop: 12,
  },
});
