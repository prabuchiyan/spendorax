import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { generateBackupData } from './backup';

const BACKGROUND_BACKUP_TASK = 'BACKGROUND_BACKUP_TASK';
const AUTO_BACKUP_CONFIG_KEY = '@auto_backup_config';
const AUTO_BACKUP_STATUS_KEY = '@auto_backup_status';

let backupInProgress = false;

// Define background task
TaskManager.defineTask(BACKGROUND_BACKUP_TASK, async () => {
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

export async function initializeAutomaticBackup() {
  try {
    const config = await getAutomaticBackupConfig();
    if (config && config.enabled) {
      await scheduleAutomaticBackup();
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
  await updateStatus({ lastAttemptDate: todayStr, lastStatus: 'RUNNING' });
  console.log('[AutoBackup] Starting backup...');

  try {
    // 1. Generate backup using existing logic
    const { backupJson } = await generateBackupData();
    if (!backupJson) throw new Error("Generated backup is empty");

    // 2. Write backup file
    const downloadDir = getDownloadDirectory();
    
    // Ensure directory exists on non-Android platforms
    if (Platform.OS !== 'android') {
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      }
    }

    const newFileName = `SpendoraX_AutoBackup_${todayStr}.json`;
    const newFilePath = `${downloadDir}${newFileName}`;

    await FileSystem.writeAsStringAsync(newFilePath, backupJson);

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
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists || info.size === 0) return false;
    
    // Read and parse to verify JSON structure
    const content = await FileSystem.readAsStringAsync(filePath);
    const parsed = JSON.parse(content);
    return parsed && parsed.version !== undefined && parsed.data !== undefined;
  } catch (e) {
    return false;
  }
}

export async function deletePreviousAutomaticBackup(filePath) {
  try {
    // Double check that we are only deleting automatic backups
    if (filePath.includes('SpendoraX_AutoBackup_') && filePath.endsWith('.json')) {
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
