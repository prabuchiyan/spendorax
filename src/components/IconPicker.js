import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, FlatList, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Spacing, Colors } from './Theme';

export default function IconPicker({ visible, onClose, onSelect }) {
  const [query, setQuery] = useState('');

  const allIcons = useMemo(() => {
    const map = MaterialCommunityIcons.glyphMap || {};
    return Object.keys(map);
  }, []);

  const popular = [
    'tag','shopping','store','home','credit-card','cash','wallet','account','account-cash','food','silverware-fork-knife','coffee','heart','gift','calendar','bell','car','bus','bike','movie','music'
  ];

  const list = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return popular.concat(allIcons.filter(i => !popular.includes(i))).slice(0, 200);
    return allIcons.filter(i => i.includes(q)).slice(0, 400);
  }, [query, allIcons]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{flex:1, padding: Spacing.m, backgroundColor: Colors.background}}>
        <View style={{flexDirection:'row', alignItems:'center', marginBottom: Spacing.m}}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search icons" style={{flex:1, borderWidth:1, borderColor:'#ddd', padding:8, borderRadius:8}} />
          <TouchableOpacity onPress={onClose} style={{marginLeft:8}}>
            <Text style={{color: Colors.primary, fontWeight:'600'}}>Close</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={list}
          keyExtractor={(i) => i}
          numColumns={6}
          renderItem={({item}) => (
            <TouchableOpacity onPress={() => { onSelect(item); onClose(); }} style={{width:'16.66%', padding:6, alignItems:'center'}}>
              <MaterialCommunityIcons name={item} size={28} color={Colors.primary} />
              <Text style={{fontSize:10, color:'#444', marginTop:6, textAlign:'center'}} numberOfLines={1}>{item.replace(/-/g,' ')}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}
