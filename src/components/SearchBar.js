import React from 'react';
import { View } from 'react-native';
import { Searchbar } from 'react-native-paper';
import { Spacing } from './Theme';

const searchStyle = {
  elevation: 0,
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#eee',
};

export default function SearchBar({
  placeholder,
  value,
  onChangeText,
  style,
  containerStyle,
  padding = Spacing.xs,
  ...rest
}) {
  return (
    <View style={[{ padding, paddingBottom: 0 }, containerStyle]}>
      <Searchbar
        placeholder={placeholder}
        onChangeText={onChangeText}
        value={value}
        style={[searchStyle, style]}
        inputStyle={{ fontSize: 14 }}
        {...rest}
      />
    </View>
  );
}
