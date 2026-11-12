import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import {
  Text,
  Button,
  Card,
  Title,
  Paragraph,
  Divider,
  Portal,
  Dialog,
  ActivityIndicator,
  List,
  Surface,
  ProgressBar,
  Switch,
  TouchableRipple
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { exportBackup, pickBackupFile, restoreBackup } from '../services/backup';
import { useTheme } from '../context/ThemeContext';
import { Colors, Spacing } from '../components/Theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAutomaticBackupConfig, setAutomaticBackupConfig, getAutomaticBackupStatus } from '../services/automaticBackupService';
import MuiDateTimePicker from '../components/MuiDateTimePicker';

const LAST_BACKUP_KEY = 'mm_last_backup_time';

export default function BackupScreen() {
  const { isDarkMode, theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [progressPercentage, setProgressPercentage] = useState(-1);
  const [progressMessage, setProgressMessage] = useState('');
  const [lastBackupTime, setLastBackupTime] = useState(null);
  const [backupData, setBackupData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [restoreMode, setRestoreMode] = useState(null); // 'merge' or 'replace'

  const [autoConfig, setAutoConfig] = useState({ enabled: false, backupTime: '23:00' });
  const [autoStatus, setAutoStatus] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadLastBackupTime();
    loadAutoBackupSettings();
  }, []);

  async function loadAutoBackupSettings() {
    const config = await getAutomaticBackupConfig();
    const status = await getAutomaticBackupStatus();
    setAutoConfig(config);
    setAutoStatus(status);
  }

  async function toggleAutoBackup(newValue) {
    if (newValue && Platform.OS === 'android') {
      try {
        Alert.alert(
          "Select Backup Folder",
          "Please create or select a specific folder (e.g., 'Spendorax') inside your Documents.\n\nNote: Android prevents saving directly to the root 'Downloads' folder.",
          [
            { text: "Cancel", style: "cancel", onPress: () => setAutoConfig({ ...autoConfig, enabled: false }) },
            {
              text: "Choose Folder",
              onPress: async () => {
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                if (!permissions.granted) {
                  Alert.alert("Permission Required", "You must select a folder to save automatic backups.");
                  setAutoConfig({ ...autoConfig, enabled: false });
                  return;
                }
                const newConfig = { ...autoConfig, enabled: true, directoryUri: permissions.directoryUri };
                setAutoConfig(newConfig);
                await setAutomaticBackupConfig(newConfig);
              }
            }
          ]
        );
      } catch (e) {
        Alert.alert("Error", "Could not request folder permissions.");
        console.error(e);
      }
    } else {
      const newConfig = { ...autoConfig, enabled: newValue };
      setAutoConfig(newConfig);
      await setAutomaticBackupConfig(newConfig);
    }
  }

  async function handleTimeChange(date) {
    setShowTimePicker(false);
    if (!date) return;
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const newTime = `${hours}:${minutes}`;
    const newConfig = { ...autoConfig, backupTime: newTime };
    setAutoConfig(newConfig);
    await setAutomaticBackupConfig(newConfig);
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(h, 10));
    date.setMinutes(parseInt(m, 10));
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  async function loadLastBackupTime() {
    try {
      const time = await AsyncStorage.getItem(LAST_BACKUP_KEY);
      if (time) setLastBackupTime(time);
    } catch (e) { }
  }

  async function handleExport() {
    setLoading(true);
    setProgressMessage('Generating backup...');
    try {
      const result = await exportBackup();
      if (result.success) {
        setLastBackupTime(result.timestamp);
        await AsyncStorage.setItem(LAST_BACKUP_KEY, result.timestamp);
        Alert.alert('Success', 'Backup exported successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export backup: ' + error.message);
    } finally {
      setLoading(false);
      setProgressMessage('');
    }
  }

  async function handlePickFile() {
    try {
      const data = await pickBackupFile();
      if (data) {
        setBackupData(data);
        setShowPreview(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to read backup file: ' + error.message);
    }
  }

  async function handleRestore() {
    setShowConfirmRestore(false);
    setShowPreview(false);

    // Show loader first
    setLoading(true);
    setProgressPercentage(0);
    setProgressMessage('Initializing restore...');

    // Force React to render the loading dialog BEFORE starting restore
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      await restoreBackup(
        backupData,
        restoreMode,
        (percentage, message) => {
          // Schedule UI update on next frame
          requestAnimationFrame(() => {
            setProgressPercentage(percentage);
            setProgressMessage(message);
          });
        }
      );

      requestAnimationFrame(() => {
        setProgressPercentage(100);
        setProgressMessage('Restore completed successfully!');
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      setLoading(false);

      Alert.alert(
        'Success',
        `Data ${restoreMode === 'replace'
          ? 'replaced'
          : 'merged'
        } successfully`
      );

      setBackupData(null);
    } catch (error) {
      setLoading(false);

      Alert.alert(
        'Error',
        'Restore failed: ' + error.message
      );
    } finally {
      setProgressPercentage(-1);
      setProgressMessage('');
    }
  }

  const renderStats = (data) => {
    if (!data || !data.data) return null;
    const {
      transactions = [],
      categories = [],
      sources = [],
      budgets = [],
      category_budgets = [],
      categoryBudgets = [],
      bills = [],
      bill_deleted_occurrences = [],
      loans = [],
      loan_payments = [],
      credit_cards = [],
      credit_card_statements = [],
      credit_card_payments = []
    } = data.data;

    const catBudgetsCount = category_budgets.length || categoryBudgets.length;
    const dividerColor = theme.border || (isDarkMode ? '#333' : '#e0e0e0');
    const countStyle = { color: theme.textSecondary, alignSelf: 'center', fontWeight: '600' };

    return (
      <View style={[styles.statsContainer, { backgroundColor: isDarkMode ? (theme.surfaceVariant || '#1E232A') : '#f8f8f8' }]}>
        <List.Item
          title="Transactions"
          titleStyle={{ color: theme.textPrimary }}
          right={() => <Text style={countStyle}>{transactions.length}</Text>}
        />
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item
          title="Categories"
          titleStyle={{ color: theme.textPrimary }}
          right={() => <Text style={countStyle}>{categories.length}</Text>}
        />
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item
          title="Sources"
          titleStyle={{ color: theme.textPrimary }}
          right={() => <Text style={countStyle}>{sources.length}</Text>}
        />
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item
          title="Budgets"
          titleStyle={{ color: theme.textPrimary }}
          right={() => <Text style={countStyle}>{budgets.length}</Text>}
        />
        {catBudgetsCount > 0 && (
          <>
            <Divider style={{ backgroundColor: dividerColor }} />
            <List.Item
              title="Category Budgets"
              titleStyle={{ color: theme.textPrimary }}
              right={() => <Text style={countStyle}>{catBudgetsCount}</Text>}
            />
          </>
        )}
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item
          title="Bills"
          titleStyle={{ color: theme.textPrimary }}
          right={() => <Text style={countStyle}>{bills.length}</Text>}
        />
        {bill_deleted_occurrences.length > 0 && (
          <>
            <Divider style={{ backgroundColor: dividerColor }} />
            <List.Item
              title="Bill Deleted Occurrences"
              titleStyle={{ color: theme.textPrimary }}
              right={() => <Text style={countStyle}>{bill_deleted_occurrences.length}</Text>}
            />
          </>
        )}
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item
          title="Loans"
          titleStyle={{ color: theme.textPrimary }}
          right={() => <Text style={countStyle}>{loans.length}</Text>}
        />
        <Divider style={{ backgroundColor: dividerColor }} />
        <List.Item
          title="Loan payments"
          titleStyle={{ color: theme.textPrimary }}
          right={() => <Text style={countStyle}>{loan_payments.length}</Text>}
        />
        {credit_cards.length > 0 && (
          <>
            <Divider style={{ backgroundColor: dividerColor }} />
            <List.Item
              title="Credit Cards"
              titleStyle={{ color: theme.textPrimary }}
              right={() => <Text style={countStyle}>{credit_cards.length}</Text>}
            />
          </>
        )}
        {credit_card_statements.length > 0 && (
          <>
            <Divider style={{ backgroundColor: dividerColor }} />
            <List.Item
              title="Credit Card Statements"
              titleStyle={{ color: theme.textPrimary }}
              right={() => <Text style={countStyle}>{credit_card_statements.length}</Text>}
            />
          </>
        )}
        {credit_card_payments.length > 0 && (
          <>
            <Divider style={{ backgroundColor: dividerColor }} />
            <List.Item
              title="Credit Card Payments"
              titleStyle={{ color: theme.textPrimary }}
              right={() => <Text style={countStyle}>{credit_card_payments.length}</Text>}
            />
          </>
        )}
      </View>
    );
  };

  const cardDynamicStyle = {
    backgroundColor: theme.cardBg,
    borderColor: theme.border,
    borderWidth: isDarkMode ? 1 : 0
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.xs }}>
        <Card style={[styles.card, cardDynamicStyle]}>
          <Card.Content>
            <Title style={[styles.cardTitle, { color: theme.textPrimary }]}>
              <MaterialCommunityIcons name="cloud-upload" size={24} color={Colors.primary} /> Export Data
            </Title>
            <Paragraph style={[styles.description, { color: theme.textSecondary }]}>
              Create a backup of all your transactions, categories, sources, budgets, category budgets, bills, loans, and credit cards.
            </Paragraph>
            <Button
              mode="contained"
              onPress={handleExport}
              style={styles.button}
              icon="share-variant"
            >
              Generate & Share Backup
            </Button>
            {lastBackupTime && (
              <Text style={styles.timestamp}>
                Last backup: {new Date(lastBackupTime).toLocaleString()}
              </Text>
            )}
          </Card.Content>
        </Card>

        <Card style={[styles.card, cardDynamicStyle]}>
          <Card.Content>
            <Title style={[styles.cardTitle, { color: theme.textPrimary }]}>
              <MaterialCommunityIcons name="cloud-download" size={24} color={Colors.accent} /> Import Data
            </Title>
            <Paragraph style={[styles.description, { color: theme.textSecondary }]}>
              Restore your data from a previously saved backup file.
            </Paragraph>
            <Button
              mode="outlined"
              onPress={handlePickFile}
              style={styles.button}
              textColor={Colors.accent}
              icon="file-search"
            >
              Select Backup File
            </Button>
          </Card.Content>
        </Card>

        <Card style={[styles.card, cardDynamicStyle]}>
          <Card.Content>
            <Title style={[styles.cardTitle, { color: theme.textPrimary }]}>
              <MaterialCommunityIcons name="calendar-clock" size={24} color={Colors.primary} /> Automatic Backup
            </Title>
            <Paragraph style={[styles.description, { color: theme.textSecondary }]}>
              Automatically backup your data every day to your device's Download folder.
            </Paragraph>

            <View style={styles.rowItem}>
              <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Enable Automatic Backup</Text>
              <Switch
                value={autoConfig.enabled}
                onValueChange={toggleAutoBackup}
                color={Colors.primary}
              />
            </View>
            <Divider style={{ marginVertical: 8, backgroundColor: theme.border }} />

            <TouchableRipple onPress={() => setShowTimePicker(true)} disabled={!autoConfig.enabled}>
              <View style={[styles.rowItem, { opacity: autoConfig.enabled ? 1 : 0.5 }]}>
                <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Backup Time</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.timeValue}>{formatTime(autoConfig.backupTime)}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.muted} />
                </View>
              </View>
            </TouchableRipple>

            {autoStatus && autoStatus.lastAttemptDate && (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.timestamp, { color: autoStatus.lastStatus === 'FAILED' ? '#E46A6A' : Colors.muted }]}>
                  Last attempted: {autoStatus.lastAttemptDate} ({autoStatus.lastStatus})
                </Text>
                {autoStatus.lastStatus === 'FAILED' && autoStatus.lastErrorMessage && (
                  <Text style={[styles.timestamp, { color: '#E46A6A', marginTop: 4 }]}>
                    Error: {autoStatus.lastErrorMessage}
                  </Text>
                )}
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <MuiDateTimePicker
        visible={showTimePicker}
        initialDate={(() => {
          const d = new Date();
          const [h, m] = autoConfig.backupTime.split(':');
          d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
          return d;
        })()}
        onClose={() => setShowTimePicker(false)}
        onSelect={handleTimeChange}
        hideDate={true}
      />

      {/* Preview Dialog */}
      <Portal>
        <Dialog visible={showPreview} onDismiss={() => setShowPreview(false)} style={[styles.dialog, { backgroundColor: theme.cardBg }]}>
          <Dialog.Title style={{ color: theme.textPrimary }}>Backup Content Preview</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ color: theme.textSecondary }}>Backup Date: {backupData ? new Date(backupData.timestamp).toLocaleString() : ''}</Paragraph>
            <Divider style={{ marginVertical: 8, backgroundColor: theme.border }} />
            <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={true}>
              {renderStats(backupData)}
            </ScrollView>
            <Divider style={{ marginVertical: 8, backgroundColor: theme.border }} />
            <Text style={[styles.warning, { color: theme.textPrimary }]}>Choose restore mode:</Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => { setRestoreMode('merge'); setShowConfirmRestore(true); }}
              textColor={Colors.primary}
            >
              Merge (Append)
            </Button>
            <Button
              onPress={() => { setRestoreMode('replace'); setShowConfirmRestore(true); }}
              textColor="#E46A6A"
            >
              Replace (Clear All)
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Final Confirmation Dialog */}
        <Dialog visible={showConfirmRestore} onDismiss={() => setShowConfirmRestore(false)} style={{ backgroundColor: theme.cardBg, borderRadius: 16 }}>
          <Dialog.Title style={{ color: theme.textPrimary }}>Confirm Restore</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ color: theme.textSecondary }}>
              {restoreMode === 'replace'
                ? 'WARNING: This will CLEAR ALL your current data and replace it with the backup content. This action CANNOT be undone.'
                : 'This will add all records from the backup to your current data. Duplicates will be skipped.'}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowConfirmRestore(false)}>Cancel</Button>
            <Button onPress={handleRestore} textColor={restoreMode === 'replace' ? "#E46A6A" : Colors.primary}>
              Proceed
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {loading && (
        <Surface style={[styles.loadingOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)' }]} elevation={4}>
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 15 }} />
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 10, color: Colors.primary }}>
            {progressMessage || 'Processing Backup...'}
          </Text>
          {progressPercentage >= 0 && (
            <View style={{ width: '80%', alignItems: 'center' }}>
              <ProgressBar
                progress={progressPercentage / 100}
                color={Colors.primary}
                style={{ height: 8, borderRadius: 4, width: '100%' }}
              />
              <Text style={{ marginTop: 5, fontSize: 12, color: Colors.muted }}>
                {progressPercentage}%
              </Text>
            </View>
          )}
        </Surface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.xs,
    elevation: 2,
    borderRadius: 12,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  description: {
    color: Colors.muted,
    marginBottom: 16,
  },
  button: {
    marginVertical: 8,
    borderRadius: 8,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  dialog: {
    borderRadius: 16,
  },
  dialogActions: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: {
    fontSize: 16,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.primary,
    marginRight: 8,
  },
  statsContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  warning: {
    marginTop: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  }
});
