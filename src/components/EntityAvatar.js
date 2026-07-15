import React from 'react';
import { Avatar } from 'react-native-paper';
import { Colors } from './Theme';

export default function EntityAvatar({
  icon = 'tag',
  color,
  size = 40,
  style,
  iconColor,
}) {
  const resolvedColor = color || Colors.primary;
  const resolvedIconColor = iconColor || resolvedColor;

  return (
    <Avatar.Icon
      size={size}
      icon={icon}
      style={[
        { backgroundColor: `${resolvedColor}15`, marginRight: 12 },
        style,
      ]}
      color={resolvedIconColor}
    />
  );
}
