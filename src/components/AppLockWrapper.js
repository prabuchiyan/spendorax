import React from 'react';
import { useAppLock } from '../context/AppLockContext';
import AppLockScreen from './AppLockScreen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Portal } from 'react-native-paper';
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
      <View
        style={[
          styles.childrenContainer,
          isLocked && styles.hiddenChildren,
        ]}
        pointerEvents={isLocked ? 'none' : 'auto'}
        accessibilityElementsHidden={isLocked}
        importantForAccessibility={isLocked ? 'no-hide-descendants' : 'auto'}
      >
        <Portal.Host>
          {children}
        </Portal.Host>
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
  hiddenChildren: {
    opacity: 0,
  },
  lockScreenContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: '#F9FBFA',
  },
});
