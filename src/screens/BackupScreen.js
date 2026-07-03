import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
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
  ProgressBar
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { exportBackup, pickBackupFile, restoreBackup } from '../services/backup';
import { Colors, Spacing } from '../components/Theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_BACKUP_KEY = 'mm_last_backup_time';

export default function BackupScreen() {
  const [loading, setLoading] = useState(false);
  const [progressPercentage, setProgressPercentage] = useState(-1);
  const [progressMessage, setProgressMessage] = useState('');
  const [lastBackupTime, setLastBackupTime] = useState(null);
  const [backupData, setBackupData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [restoreMode, setRestoreMode] = useState(null); // 'merge' or 'replace'

  useEffect(() => {
    loadLastBackupTime();
  }, []);

  async function loadLastBackupTime() {
    try {
      const time = await AsyncStorage.getItem(LAST_BACKUP_KEY);
      if (time) setLastBackupTime(time);
    } catch (e) {}
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
    setLoading(true);
    setProgressPercentage(0);
    setProgressMessage('Initializing restore...');
    try {
      await restoreBackup(backupData, restoreMode, (percentage, message) => {
        setProgressPercentage(percentage);
        setProgressMessage(message);
      });
      // Wait 100ms for React to render the 100% progress state before the blocking alert appears
      await new Promise(resolve => setTimeout(resolve, 100));
      Alert.alert('Success', `Data ${restoreMode === 'replace' ? 'replaced' : 'merged'} successfully`);
      setBackupData(null);
    } catch (error) {
      Alert.alert('Error', 'Restore failed: ' + error.message);
    } finally {
      setLoading(false);
      setProgressPercentage(-1);
      setProgressMessage('');
    }
  }

  const renderStats = (data) => {
    if (!data || !data.data) return null;
    const { transactions, categories, sources, budgets, bills } = data.data;
    return (
      <View style={styles.statsContainer}>
        <List.Item title="Transactions" right={() => <Text>{transactions.length}</Text>} />
        <Divider />
        <List.Item title="Categories" right={() => <Text>{categories.length}</Text>} />
        <Divider />
        <List.Item title="Sources" right={() => <Text>{sources.length}</Text>} />
        <Divider />
        <List.Item title="Budgets" right={() => <Text>{budgets.length}</Text>} />
        <Divider />
        <List.Item title="Bills" right={() => <Text>{bills.length}</Text>} />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={{ padding: Spacing.m }}>
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>
              <MaterialCommunityIcons name="cloud-upload" size={24} color={Colors.primary} /> Export Data
            </Title>
            <Paragraph style={styles.description}>
              Create a backup of all your transactions, categories, sources, budgets, and bills.
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

        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.cardTitle}>
              <MaterialCommunityIcons name="cloud-download" size={24} color={Colors.accent} /> Import Data
            </Title>
            <Paragraph style={styles.description}>
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
      </ScrollView>

      {/* Preview Dialog */}
      <Portal>
        <Dialog visible={showPreview} onDismiss={() => setShowPreview(false)} style={styles.dialog}>
          <Dialog.Title>Backup Content Preview</Dialog.Title>
          <Dialog.Content>
            <Paragraph>Backup Date: {backupData ? new Date(backupData.timestamp).toLocaleString() : ''}</Paragraph>
            <Divider style={{ marginVertical: 8 }} />
            {renderStats(backupData)}
            <Divider style={{ marginVertical: 8 }} />
            <Text style={styles.warning}>Choose restore mode:</Text>
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
        <Dialog visible={showConfirmRestore} onDismiss={() => setShowConfirmRestore(false)}>
          <Dialog.Title>Confirm Restore</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
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
        <Surface style={styles.loadingOverlay} elevation={4}>
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
    marginBottom: Spacing.m,
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
  statsContainer: {
    backgroundColor: '#f8f8f8',
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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  }
});
