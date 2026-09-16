import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PASSCODE_KEY = 'spendorax_app_passcode';
const SECURITY_SETTINGS_KEY = 'spendorax_security_settings';

const DEFAULT_SETTINGS = {
  appLockEnabled: false,
  biometricEnabled: false,
  autoLockDelay: 0, // 0 = immediately
};

/**
 * Checks if the current environment supports native security features
 * (Web doesn't support SecureStore or LocalAuthentication natively in the same way)
 */
export const isSecuritySupported = () => {
  return Platform.OS !== 'web';
};

// --- Passcode Management ---

export const setPasscode = async (passcode) => {
  if (!isSecuritySupported()) return;
  await SecureStore.setItemAsync(PASSCODE_KEY, passcode);
};

export const verifyPasscode = async (passcode) => {
  if (!isSecuritySupported()) return true;
  const storedPasscode = await SecureStore.getItemAsync(PASSCODE_KEY);
  return storedPasscode === passcode;
};

export const hasPasscode = async () => {
  if (!isSecuritySupported()) return false;
  const storedPasscode = await SecureStore.getItemAsync(PASSCODE_KEY);
  return storedPasscode !== null;
};

export const deletePasscode = async () => {
  if (!isSecuritySupported()) return;
  await SecureStore.deleteItemAsync(PASSCODE_KEY);
};

// --- Biometric Management ---

export const isBiometricSupported = async () => {
  if (!isSecuritySupported()) return false;
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
};

export const authenticateBiometric = async (promptMessage = 'Authenticate to access SpendoraX') => {
  if (!isSecuritySupported()) return { success: true };
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: 'Use Passcode',
    disableDeviceFallback: true, // We handle our own passcode fallback
  });
  return result;
};

// --- Security Settings Management ---

export const getSecuritySettings = async () => {
  try {
    const stored = await AsyncStorage.getItem(SECURITY_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Failed to load security settings', e);
  }
  return DEFAULT_SETTINGS;
};

export const saveSecuritySettings = async (settings) => {
  try {
    await AsyncStorage.setItem(SECURITY_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save security settings', e);
  }
};
