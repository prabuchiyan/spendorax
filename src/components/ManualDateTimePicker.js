import React, { useState } from 'react';
import { View } from 'react-native';
import { TextInput as PaperTextInput, Button as PaperButton } from 'react-native-paper';

export default function ManualDateTimePicker({ year, month, day, hour, minute, onChange, onClose }) {
  const [y, setY] = useState(String(year || new Date().getFullYear()));
  const [m, setM] = useState(String(month || 1));
  const [d, setD] = useState(String(day || 1));
  const [h, setH] = useState(String(hour || 0));
  const [mi, setMi] = useState(String(minute || 0));

  return (
    <View>
      <View style={{flexDirection:'row',marginBottom:8}}>
        <PaperTextInput label="Year" value={y} onChangeText={setY} mode="outlined" style={{flex:1,marginRight:8}} />
        <PaperTextInput label="Month" value={m} onChangeText={setM} mode="outlined" style={{width:100,marginRight:8}} />
        <PaperTextInput label="Day" value={d} onChangeText={setD} mode="outlined" style={{width:100}} />
      </View>
      <View style={{flexDirection:'row',marginBottom:8}}>
        <PaperTextInput label="Hour" value={h} onChangeText={setH} mode="outlined" style={{width:120,marginRight:8}} />
        <PaperTextInput label="Minute" value={mi} onChangeText={setMi} mode="outlined" style={{width:120}} />
      </View>
      <View style={{flexDirection:'row'}}>
        <PaperButton onPress={() => { const ny = parseInt(y)||year; const nm = Math.max(1,Math.min(12,parseInt(m)||month)); const nd = Math.max(1,Math.min(31,parseInt(d)||day)); const nh = Math.max(0,Math.min(23,parseInt(h)||hour)); const nmin = Math.max(0,Math.min(59,parseInt(mi)||minute)); onChange && onChange(ny, nm, nd, nh, nmin); onClose && onClose(); }}>Apply</PaperButton>
        <View style={{width:8}} />
        <PaperButton mode="outlined" onPress={() => onClose && onClose()}>Cancel</PaperButton>
      </View>
    </View>
  );
}
