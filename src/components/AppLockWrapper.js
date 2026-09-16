import React from 'react';
import { useAppLock } from '../context/AppLockContext';
import AppLockScreen from './AppLockScreen';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from './Theme';

export default function AppLockWrapper({ children }) {
  const { isLocked, isReady } = useAppLock();

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (isLocked) {
    return <AppLockScreen />;
  }

  return children;
}
