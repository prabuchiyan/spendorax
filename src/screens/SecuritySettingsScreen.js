import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { List, Switch, Divider, Title, Button, Portal, Dialog, TextInput, Text } from 'react-native-paper';
import { Colors, Spacing } from '../components/Theme';
import {
  getSecuritySettings,
  saveSecuritySettings,
  setPasscode,
  verifyPasscode,
  deletePasscode,
  hasPasscode,
  isBiometricSupported,
  isSecuritySupported
} from '../services/authService';

export default function SecuritySettingsScreen() {
  const [settings, setSettings] = useState({
    appLockEnabled: false,
    biometricEnabled: false,
    autoLockDelay: 0,
  });
  const [hasPasscodeSet, setHasPasscodeSet] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  const [setupDialogVisible, setSetupDialogVisible] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [setupError, setSetupError] = useState('');

  const [authDialogVisible, setAuthDialogVisible] = useState(false);
  const [authPasscode, setAuthPasscode] = useState('');
  const [authError, setAuthError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (!isSecuritySupported()) {
      setIsSupported(false);
      return;
    }
    const currentSettings = await getSecuritySettings();
    setSettings(currentSettings);
    
    const isPasscodeSet = await hasPasscode();
    setHasPasscodeSet(isPasscodeSet);

    const bioAvailable = await isBiometricSupported();
    setBiometricAvailable(bioAvailable);
  };

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveSecuritySettings(newSettings);
  };

  const requireAuth = (action) => {
    setPendingAction(() => action);
    setAuthPasscode('');
    setAuthError('');
    setAuthDialogVisible(true);
  };

  const handleAuth = async () => {
    const isValid = await verifyPasscode(authPasscode);
    if (isValid) {
      setAuthDialogVisible(false);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      setAuthError('Incorrect passcode');
    }
  };

  const toggleAppLock = (value) => {
    if (value) {
      // Enabling App Lock
      if (!hasPasscodeSet) {
        setSetupDialogVisible(true);
      } else {
        updateSetting('appLockEnabled', true);
      }
    } else {
      // Disabling App Lock
      requireAuth(() => {
        updateSetting('appLockEnabled', false);
      });
    }
  };

  const toggleBiometric = (value) => {
    if (value) {
      updateSetting('biometricEnabled', true);
    } else {
      requireAuth(() => {
        updateSetting('biometricEnabled', false);
      });
    }
  };

  const handleSetupPasscode = async () => {
    if (newPasscode.length < 4) {
      setSetupError('Passcode must be at least 4 digits');
      return;
    }
    if (newPasscode !== confirmPasscode) {
      setSetupError('Passcodes do not match');
      return;
    }
    
    await setPasscode(newPasscode);
    setHasPasscodeSet(true);
    await updateSetting('appLockEnabled', true);
    setSetupDialogVisible(false);
    setNewPasscode('');
    setConfirmPasscode('');
    
    Alert.alert("Success", "App lock has been enabled.");
  };

  const handleChangePasscode = () => {
    requireAuth(() => {
      setSetupDialogVisible(true);
    });
  };

  if (!isSupported) {
    return (
      <View style={styles.container}>
        <Text style={styles.unsupportedText}>
          Security features are not supported on this platform.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <List.Section>
        <List.Subheader>App Lock</List.Subheader>
        <List.Item
          title="Enable App Lock"
          description="Require passcode or biometric to open the app"
          right={() => (
            <Switch
              value={settings.appLockEnabled}
              onValueChange={toggleAppLock}
              color={Colors.primary}
            />
          )}
        />
        
        {settings.appLockEnabled && (
          <>
            <Divider />
            <List.Item
              title="Change Passcode"
              description="Update your numeric app passcode"
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={handleChangePasscode}
            />
          </>
        )}
      </List.Section>

      {settings.appLockEnabled && biometricAvailable && (
        <List.Section>
          <List.Subheader>Biometrics</List.Subheader>
          <List.Item
            title="Use Fingerprint / Face ID"
            description="Unlock the app using device biometrics"
            right={() => (
              <Switch
                value={settings.biometricEnabled}
                onValueChange={toggleBiometric}
                color={Colors.primary}
              />
            )}
          />
        </List.Section>
      )}

      {settings.appLockEnabled && (
        <List.Section>
          <List.Subheader>Auto-Lock</List.Subheader>
          <List.Item
            title="Immediately"
            description="Lock as soon as app goes to background"
            right={props => settings.autoLockDelay === 0 ? <List.Icon {...props} icon="check" color={Colors.primary} /> : null}
            onPress={() => updateSetting('autoLockDelay', 0)}
          />
          <Divider />
          <List.Item
            title="After 1 minute"
            right={props => settings.autoLockDelay === 60 ? <List.Icon {...props} icon="check" color={Colors.primary} /> : null}
            onPress={() => updateSetting('autoLockDelay', 60)}
          />
          <Divider />
          <List.Item
            title="After 5 minutes"
            right={props => settings.autoLockDelay === 300 ? <List.Icon {...props} icon="check" color={Colors.primary} /> : null}
            onPress={() => updateSetting('autoLockDelay', 300)}
          />
        </List.Section>
      )}

      {/* Setup Passcode Dialog */}
      <Portal>
        <Dialog visible={setupDialogVisible} onDismiss={() => setSetupDialogVisible(false)}>
          <Dialog.Title>Set Passcode</Dialog.Title>
          <Dialog.Content>
            {setupError ? <Text style={styles.errorText}>{setupError}</Text> : null}
            <TextInput
              label="New Passcode"
              value={newPasscode}
              onChangeText={(text) => { setNewPasscode(text.replace(/[^0-9]/g, '')); setSetupError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={styles.input}
            />
            <TextInput
              label="Confirm Passcode"
              value={confirmPasscode}
              onChangeText={(text) => { setConfirmPasscode(text.replace(/[^0-9]/g, '')); setSetupError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={styles.input}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setSetupDialogVisible(false); setNewPasscode(''); setConfirmPasscode(''); }}>Cancel</Button>
            <Button onPress={handleSetupPasscode}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Authenticate Dialog */}
      <Portal>
        <Dialog visible={authDialogVisible} onDismiss={() => setAuthDialogVisible(false)}>
          <Dialog.Title>Enter Passcode</Dialog.Title>
          <Dialog.Content>
            {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
            <TextInput
              label="Passcode"
              value={authPasscode}
              onChangeText={(text) => { setAuthPasscode(text.replace(/[^0-9]/g, '')); setAuthError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              style={styles.input}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAuthDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleAuth}>Verify</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  unsupportedText: {
    textAlign: 'center',
    marginTop: 50,
    color: Colors.muted,
    fontSize: 16,
  },
  input: {
    marginBottom: Spacing.sm,
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#E46A6A',
    marginBottom: 8,
  }
});
