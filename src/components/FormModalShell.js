import React from 'react';
import { Modal, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import formModalStyles from './formModalStyles';

export default function FormModalShell({
  visible,
  onClose,
  icon,
  iconColor = '#4B7CF3',
  iconSize = 22,
  title,
  subtitle,
  children,
  actions,
  animationType = 'slide',
  footer,
}) {
  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <View style={formModalStyles.overlay}>
        <View style={formModalStyles.container}>
          <View style={formModalStyles.header}>
            <View style={[formModalStyles.iconContainer, { backgroundColor: iconColor }]}>
              <MaterialCommunityIcons name={icon} size={iconSize} color="#fff" />
            </View>
            <View style={formModalStyles.headerText}>
              <Text style={formModalStyles.title}>{title}</Text>
              {subtitle ? <Text style={formModalStyles.subtitle}>{subtitle}</Text> : null}
            </View>
          </View>

          <View style={formModalStyles.formCard}>{children}</View>

          {actions ? <View style={formModalStyles.actions}>{actions}</View> : null}
        </View>
        {footer}
      </View>
    </Modal>
  );
}
