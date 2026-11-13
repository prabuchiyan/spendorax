import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { generateBackupData } from './backup';

const BACKGROUND_BACKUP_TASK = 'BACKGROUND_BACKUP_TASK';
const AUTO_BACKUP_CONFIG_KEY = '@auto_backup_config';
const AUTO_BACKUP_STATUS_KEY = '@auto_backup_status';

let backupInProgress = false;
let foregroundTimer = null;
let appStateSubscription = null;

// Define background task
TaskManager.defineTask(BACKGROUND_BACKUP_TASK, async () => {
  if (Platform.OS === 'web') return BackgroundFetch.BackgroundFetchResult.NoData;
  try {
    const { success } = await performAutomaticBackup();
    return success ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('[AutoBackup] Task failed', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

function getDownloadDirectory() {
  if (Platform.OS === 'android') {
    return 'file:///storage/emulated/0/Download/';
  }
  return FileSystem.documentDirectory;
}

function calculateMsUntilNextBackup(backupTimeStr) {
  const now = new Date();
  const [targetHour, targetMinute] = (backupTimeStr || '23:00').split(':').map(Number);

  const targetDate = new Date();
  targetDate.setHours(targetHour, targetMinute, 0, 0);

  if (now.getTime() >= targetDate.getTime()) {
    // Time has already passed today, schedule for tomorrow
    targetDate.setDate(targetDate.getDate() + 1);
  }

  return targetDate.getTime() - now.getTime();
}

export async function initializeAutomaticBackup() {
  if (Platform.OS === 'web') return;
  try {
    const config = await getAutomaticBackupConfig();

    // Clear any existing timer/listeners
    if (foregroundTimer) {
      clearTimeout(foregroundTimer);
      foregroundTimer = null;
    }
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }

    if (config && config.enabled) {
      await scheduleAutomaticBackup();

      const msUntilBackup = calculateMsUntilNextBackup(config.backupTime);

      // 1. Schedule a precise one-off timeout for when the app is left open
      if (msUntilBackup > 0) {
        foregroundTimer = setTimeout(async () => {
          await performAutomaticBackup();
          // Re-initialize to schedule for the next day
          initializeAutomaticBackup();
        }, msUntilBackup);
      }

      // 2. Add AppState listener to check immediately when coming to foreground
      appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
        if (nextAppState === 'active') {
          await performAutomaticBackup();
        }
      });

      // Also try immediately in case we just passed the time
      await performAutomaticBackup();
    } else {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_BACKUP_TASK).catch(() => { });
    }
  } catch (e) {
    console.error('[AutoBackup] Initialization failed', e);
  }
}

export async function getAutomaticBackupConfig() {
  const configStr = await AsyncStorage.getItem(AUTO_BACKUP_CONFIG_KEY);
  return configStr ? JSON.parse(configStr) : { enabled: false, backupTime: '23:00' };
}

export async function setAutomaticBackupConfig(config) {
  const prevConfig = await getAutomaticBackupConfig();
  await AsyncStorage.setItem(AUTO_BACKUP_CONFIG_KEY, JSON.stringify(config));

  // If directoryUri changed, reset last successful path to avoid stale paths from previous folders
  if (config.directoryUri !== prevConfig.directoryUri) {
    await updateStatus({ lastSuccessfulBackupPath: null });
  }

  await initializeAutomaticBackup();
}

export async function scheduleAutomaticBackup() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_BACKUP_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_BACKUP_TASK, {
        minimumInterval: 60 * 60, // Check hourly
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (e) {
    console.error('[AutoBackup] Scheduling failed', e);
  }
}

export async function getAutomaticBackupStatus() {
  const statusStr = await AsyncStorage.getItem(AUTO_BACKUP_STATUS_KEY);
  return statusStr ? JSON.parse(statusStr) : {
    lastAttemptDate: null,
    lastSuccessfulBackupDate: null,
    lastSuccessfulBackupPath: null,
    lastStatus: 'IDLE',
    lastErrorMessage: null
  };
}

async function updateStatus(updates) {
  const status = await getAutomaticBackupStatus();
  const newStatus = { ...status, ...updates };
  await AsyncStorage.setItem(AUTO_BACKUP_STATUS_KEY, JSON.stringify(newStatus));
}

export async function performAutomaticBackup() {
  if (Platform.OS === 'web') return { success: false };

  if (backupInProgress) {
    console.log('[AutoBackup] Already running, skip');
    return { success: false };
  }

  const config = await getAutomaticBackupConfig();
  if (!config.enabled) return { success: false };

  const todayStr = new Date().toISOString().split('T')[0];
  const status = await getAutomaticBackupStatus();
  const now = new Date();
  const [targetHour, targetMinute] = (config.backupTime || '23:00').split(':').map(Number);

  if (status.lastSuccessfulBackupDate === todayStr) {
    return { success: false };
  }

  // Check if we reached the scheduled time
  if (now.getHours() < targetHour || (now.getHours() === targetHour && now.getMinutes() < targetMinute)) {
    return { success: false };
  }

  backupInProgress = true;
  const dateTimeStr = now.toLocaleString();
  await updateStatus({ lastAttemptDate: dateTimeStr, lastStatus: 'RUNNING' });
  console.log('[AutoBackup] Starting backup...');

  try {
    // 1. Generate backup using existing logic
    const { backupJson } = await generateBackupData();
    if (!backupJson) throw new Error("Generated backup is empty");

    // 2. Write backup file
    const newFileName = `SpendoraX_AutoBackup_${todayStr}.json`;
    let newFilePath;

    if (Platform.OS === 'android') {
      if (!config.directoryUri) throw new Error("No directory URI configured for Android");
      // Use SAF to create file in the selected directory
      newFilePath = await FileSystem.StorageAccessFramework.createFileAsync(config.directoryUri, newFileName, 'application/json');
      await FileSystem.writeAsStringAsync(newFilePath, backupJson);
    } else {
      const downloadDir = getDownloadDirectory();
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      }
      newFilePath = `${downloadDir}${newFileName}`;
      await FileSystem.writeAsStringAsync(newFilePath, backupJson);
    }

    // 3 & 4. Verify file exists and is accessible
    const isVerified = await verifyAutomaticBackup(newFilePath);
    if (!isVerified) {
      throw new Error("Backup file verification failed");
    }

    const previousBackupPath = status.lastSuccessfulBackupPath;

    // 5. Mark backup successful
    await updateStatus({
      lastSuccessfulBackupDate: todayStr,
      lastSuccessfulBackupPath: newFilePath,
      lastStatus: 'SUCCESS',
      lastErrorMessage: null
    });
    console.log('[AutoBackup] Backup generated successfully');

    // 6. Safely clean up older automatic backups inside the backup directory (keeping up to 3 newest)
    await cleanupOldAutomaticBackups(config, newFilePath);

    return { success: true };
  } catch (error) {
    console.error('[AutoBackup] Backup generation failed. Reason:', error);
    console.log('[AutoBackup] Existing backup preserved');
    const errorMsg = error.message || error.toString();
    await updateStatus({ lastStatus: 'FAILED', lastErrorMessage: errorMsg });

    // Alert the user via Push Notification so they are aware
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Automatic Backup Failed \u26A0\uFE0F",
        body: `We couldn't create your backup: ${errorMsg}. Please open Backup settings to fix the folder permission.`,
        sound: true,
      },
      trigger: null,
    }).catch(e => console.error("Failed to send error notification", e));

    return { success: false };
  } finally {
    backupInProgress = false;
  }
}

export async function verifyAutomaticBackup(filePath) {
  try {
    if (!filePath.startsWith('content://')) {
      const info = await FileSystem.getInfoAsync(filePath);
      if (!info.exists || info.size === 0) return false;
    }

    // Read and parse to verify JSON structure
    const content = await FileSystem.readAsStringAsync(filePath);
    const parsed = JSON.parse(content);
    return parsed && parsed.version !== undefined && parsed.data !== undefined;
  } catch (e) {
    console.error('[AutoBackup] verify error:', e);
    return false;
  }
}

export async function cleanupOldAutomaticBackups(config, currentFilePath, keepCount = 3) {
  try {
    if (Platform.OS === 'android') {
      if (!config || !config.directoryUri) return;

      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(config.directoryUri);
      if (!Array.isArray(files) || files.length === 0) return;

      // Filter only files that are SpendoraX automatic backups and NOT the directory itself
      const autoBackupFiles = files.filter(fileUri => {
        if (!fileUri || fileUri === config.directoryUri || fileUri === currentFilePath) return false;
        const decoded = decodeURIComponent(fileUri);
        // STRICT SAFETY CHECKS:
        // 1. Must contain '/document/' (proves it is a child document, never a tree root)
        // 2. Must contain 'SpendoraX_AutoBackup_'
        // 3. Must contain '.json'
        return decoded.includes('/document/') &&
          decoded.includes('SpendoraX_AutoBackup_') &&
          (decoded.endsWith('.json') || decoded.includes('.json'));
      });

      // Sort descending by name/date so newest files are first
      autoBackupFiles.sort((a, b) => {
        const decodedA = decodeURIComponent(a);
        const decodedB = decodeURIComponent(b);
        return decodedB.localeCompare(decodedA);
      });

      // Keep up to keepCount backups (the ones beyond keepCount - 1 are deleted,
      // since currentFilePath is already excluded and kept)
      const toDelete = autoBackupFiles.slice(Math.max(0, keepCount - 1));

      for (const fileUri of toDelete) {
        try {
          const decoded = decodeURIComponent(fileUri);
          // Redundant safety check: NEVER delete if it could be the directory or the current file
          if (fileUri !== config.directoryUri &&
            fileUri !== currentFilePath &&
            decoded.includes('/document/') &&
            decoded.includes('SpendoraX_AutoBackup_')) {
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
            console.log(`[AutoBackup] Safely deleted old backup file: ${fileUri}`);
          }
        } catch (delErr) {
          console.warn(`[AutoBackup] Failed to delete old backup file: ${fileUri}`, delErr);
        }
      }
    } else {
      const downloadDir = getDownloadDirectory();
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (!dirInfo.exists) return;

      const files = await FileSystem.readDirectoryAsync(downloadDir);
      const autoBackupFiles = files.filter(f => f.startsWith('SpendoraX_AutoBackup_') && f.endsWith('.json') && `${downloadDir}${f}` !== currentFilePath);

      autoBackupFiles.sort((a, b) => b.localeCompare(a));
      const toDelete = autoBackupFiles.slice(Math.max(0, keepCount - 1));

      for (const f of toDelete) {
        const fullPath = `${downloadDir}${f}`;
        try {
          await FileSystem.deleteAsync(fullPath, { idempotent: true });
          console.log(`[AutoBackup] Safely deleted old backup file: ${fullPath}`);
        } catch (delErr) {
          console.warn(`[AutoBackup] Failed to delete old backup file: ${fullPath}`, delErr);
        }
      }
    }
  } catch (error) {
    console.warn('[AutoBackup] Error cleaning up old backups (skipped to protect directory):', error);
  }
}

export async function deletePreviousAutomaticBackup(filePath) {
  // Legacy function: directly deleting arbitrary SAF URIs via FileSystem.deleteAsync is unsafe
  // because Expo's getNearestSAFFile falls back to DocumentFile.fromTreeUri and deletes the entire folder
  // when a file is missing.
  // We safely neutralize this function; automatic cleanup is handled safely by cleanupOldAutomaticBackups().
  console.log(`[AutoBackup] deletePreviousAutomaticBackup safely bypassed: ${filePath}`);
}
