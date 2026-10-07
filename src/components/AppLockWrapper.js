import React from 'react';
import { useAppLock } from '../context/AppLockContext';
import AppLockScreen from './AppLockScreen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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

  return (
    <View style={styles.container}>
      <View style={styles.childrenContainer}>
        {children}
      </View>
      {isLocked && (
        <View style={styles.lockScreenContainer}>
          <AppLockScreen />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  childrenContainer: {
    flex: 1,
  },
  lockScreenContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  }
});
