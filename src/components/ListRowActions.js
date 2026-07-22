import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from './Theme';

export default function ListRowActions({ onEdit, onDelete, style }) {
  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
        <Feather name="edit-2" size={16} color={Colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete}>
        <Feather name="trash-2" size={16} color="#E46A6A" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginTop: 8,
  },
  editBtn: {
    marginRight: 10,
  },
});
