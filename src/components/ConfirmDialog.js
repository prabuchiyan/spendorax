import React from 'react';
import { View } from 'react-native';
import { Portal, Dialog, Paragraph, Button } from 'react-native-paper';

export default function ConfirmDialog({ visible, title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel}>
        {title ? <Dialog.Title>{title}</Dialog.Title> : null}
        <Dialog.Content>
          <Paragraph>{message}</Paragraph>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel}>{cancelLabel}</Button>
          <Button onPress={onConfirm}>{confirmLabel}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
