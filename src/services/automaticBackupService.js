import { Platform, AppState } from 'react-native';
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
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_BACKUP_TASK).catch(() => {});
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
  await AsyncStorage.setItem(AUTO_BACKUP_CONFIG_KEY, JSON.stringify(config));
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
    lastStatus: 'IDLE'
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
      lastStatus: 'SUCCESS' 
    });
    console.log('[AutoBackup] Backup generated successfully');

    // 6. Delete previous automatic backup
    if (previousBackupPath && previousBackupPath !== newFilePath) {
      await deletePreviousAutomaticBackup(previousBackupPath);
    }

    return { success: true };
  } catch (error) {
    console.error('[AutoBackup] Backup generation failed. Reason:', error);
    console.log('[AutoBackup] Existing backup preserved');
    await updateStatus({ lastStatus: 'FAILED' });
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

export async function deletePreviousAutomaticBackup(filePath) {
  try {
    // Delete file using standard FileSystem or SAF
    if (filePath.startsWith('content://')) {
       await FileSystem.deleteAsync(filePath, { idempotent: true });
       console.log(`[AutoBackup] Deleted previous backup: ${filePath}`);
    } else {
       const info = await FileSystem.getInfoAsync(filePath);
       if (info.exists) {
         await FileSystem.deleteAsync(filePath, { idempotent: true });
         console.log(`[AutoBackup] Deleted previous backup: ${filePath}`);
       }
    }
  } catch (error) {
    console.error('[AutoBackup] Failed to delete previous backup', error);
  }
}
