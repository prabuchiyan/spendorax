import React from 'react';
import CommonBottomSheetModal from './CommonBottomSheetModal';

export default function ExitConfirmationModal({ visible, onCancel, onExit }) {
  return (
    <CommonBottomSheetModal
      visible={visible}
      type="warning"
      icon="exit-to-app"
      title="Exit SpendoraX?"
      subtitle="Are you sure you want to close the application?"
      confirmLabel="Exit App"
      cancelLabel="Cancel"
      confirmIcon="exit-to-app"
      warningTitle="Closing Application"
      warnings={[
        {
          title: 'Session Ending',
          text: 'SpendoraX will close and return to your home screen.',
        },
        {
          title: 'Unsaved Progress',
          text: 'Ensure all pending transactions or bill edits have been saved.',
        },
      ]}
      onCancel={onCancel}
      onConfirm={onExit}
    />
  );
}
