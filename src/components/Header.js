import React from 'react';
import { View, Text, Image } from 'react-native';
import { Colors, Spacing } from './Theme';

export default function Header({ title, subtitle }) {
  return (
    <View style={{ padding: Spacing.m, paddingTop: Spacing.xl, backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center' }}>
      <Image 
        source={require('../../assets/logo.png')} 
        style={{ width: 32, height: 32, marginRight: 12, borderRadius: 6 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>{title}</Text>
        {subtitle ? <Text style={{ color: '#fff', opacity: 0.9, marginTop: 4 }}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}
