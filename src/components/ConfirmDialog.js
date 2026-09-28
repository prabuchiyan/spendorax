import React from 'react';

import { Portal, Dialog, Paragraph, Button } from 'react-native-paper';

export default function ConfirmDialog({ visible, title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', onConfirm, onCancel, loading = false }) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={() => { if (!loading) onCancel(); }}>
        {title ? <Dialog.Title>{title}</Dialog.Title> : null}
        <Dialog.Content>
          <Paragraph>{message}</Paragraph>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button onPress={onConfirm} loading={loading} disabled={loading}>{confirmLabel}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>);

}