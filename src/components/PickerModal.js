import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';

export default function PickerModal({
  visible,
  onClose,
  title,
  items = [],
  onSelect,
  labelKey = 'name',
  keyExtractor,
}) {
  const getKey = keyExtractor || ((item) => String(item.id));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView>
            {items.map((item) => (
              <TouchableOpacity
                key={getKey(item)}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={styles.optionItem}
              >
                <Text>{item[labelKey]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Button onPress={onClose}>Close</Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  title: {
    fontWeight: '700',
    marginBottom: 12,
  },
  optionItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
});
