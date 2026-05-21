/**
 * FolderPickerService - Handle folder selection with proper permission handling
 * Supports both native picker (if available) and fallback folder browser
 */

import {Platform, Alert, PermissionsAndroid} from 'react-native';
import DocumentPicker, {
  errorCodes,
  isErrorWithCode,
} from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import {Logger} from '../utils/Logger';

export class FolderPickerService {
  /**
   * Check if native directory picker is available
   */
  static isDirectoryPickerAvailable(): boolean {
    try {
      const available = typeof DocumentPicker.pickDirectory === 'function';
      Logger.info(`Directory picker available: ${available}`);
      return available;
    } catch (err) {
      Logger.info('Directory picker not available');
      return false;
    }
  }

  /**
   * Request storage permissions on iOS
   */
  static async requestiOSPermissions(): Promise<boolean> {
    try {
      Logger.info('iOS: Requesting file access permissions');
      // iOS grants permissions automatically when using UIDocumentPickerViewController
      // No explicit permission request needed
      return true;
    } catch (err) {
      Logger.error('Failed to request iOS permissions:', err);
      return false;
    }
  }

  /**
   * Request storage permissions on Android
   */
  static async requestAndroidPermissions(): Promise<boolean> {
    try {
      const androidVersion = Platform.Version as number;
      Logger.info(`Android version: ${androidVersion}`);

      if (androidVersion >= 30) {
        // Android 11+ - MANAGE_EXTERNAL_STORAGE
        Logger.info(
          'Android 11+: MANAGE_EXTERNAL_STORAGE needed for full access',
        );
        // We'll try to use DocumentPicker which has its own permissions flow
        return true;
      } else {
        // Android 10 and below
        Logger.info('Android <11: Requesting READ_EXTERNAL_STORAGE');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'LocalOS needs access to browse your folders and vaults.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      Logger.error('Failed to request Android permissions:', err);
      return false;
    }
  }

  /**
   * Pick a folder using native picker (iOS/Android)
   */
  static async pickFolder(): Promise<string | null> {
    try {
      Logger.info('Starting folder picker');

      // Check if native picker is available
      if (!this.isDirectoryPickerAvailable()) {
        Logger.warn('Native directory picker not available');
        Alert.alert(
          'Folder Picker Not Available',
          'The folder picker requires a specific version of the documents library.\n\n' +
            'Please use the fallback option to browse folders manually.',
        );
        return null;
      }

      // Request permissions first
      if (Platform.OS === 'ios') {
        const hasPermission = await this.requestiOSPermissions();
        if (!hasPermission) {
          Logger.error('iOS: Permission request failed');
          return null;
        }
      } else {
        const hasPermission = await this.requestAndroidPermissions();
        if (!hasPermission) {
          Logger.error('Android: Permission denied');
          Alert.alert(
            'Permission Required',
            'Please grant storage permission in Settings to access folders.',
          );
          return null;
        }
      }

      // Open directory picker
      Logger.info('Opening native directory picker');
      const result = await DocumentPicker.pickDirectory();

      if (result && result.uri) {
        Logger.info(`Folder selected: ${result.uri}`);
        return result.uri;
      } else {
        Logger.info('User cancelled folder picker');
        return null;
      }
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        Logger.info('User cancelled folder picker');
        return null;
      }

      Logger.error('Error picking folder:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);

      let userMessage = `Failed to pick folder: ${errorMsg}`;

      if (Platform.OS === 'android') {
        userMessage +=
          '\n\nFor Android 11+, make sure "All Files Access" is enabled in Settings → Apps → LocalOS → Permissions.';
      }

      Alert.alert('Error', userMessage);
      return null;
    }
  }

  /**
   * Test if a path is readable
   */
  static async testPathAccess(path: string): Promise<boolean> {
    try {
      Logger.info(`Testing access to path: ${path}`);
      const exists = await RNFS.exists(path);

      if (!exists) {
        Logger.warn(`Path does not exist: ${path}`);
        return false;
      }

      const stat = await RNFS.stat(path);
      Logger.info(`Path is accessible: ${stat.isDirectory() ? 'dir' : 'file'}`);
      return true;
    } catch (err) {
      Logger.error(`Cannot access path: ${err}`);
      return false;
    }
  }

  /**
   * Test folder access by trying to list contents
   */
  static async testFolderAccess(folderPath: string): Promise<{
    accessible: boolean;
    itemCount?: number;
    error?: string;
  }> {
    try {
      Logger.info(`Testing folder access: ${folderPath}`);

      // Check if folder exists
      const exists = await RNFS.exists(folderPath);
      if (!exists) {
        return {
          accessible: false,
          error: 'Folder does not exist',
        };
      }

      // Try to list contents
      const items = await RNFS.readDir(folderPath);
      Logger.info(`Folder is accessible, contains ${items.length} items`);

      return {
        accessible: true,
        itemCount: items.length,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      Logger.error(`Folder access test failed: ${errorMsg}`);

      return {
        accessible: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Get common vault locations to suggest to user
   */
  static getCommonVaultLocations(): string[] {
    const locations: string[] = [];

    if (Platform.OS === 'ios') {
      // iOS common locations
      locations.push(
        `${RNFS.DocumentDirectoryPath}/Obsidian`,
        `${RNFS.DocumentDirectoryPath}/Vault`,
        RNFS.DocumentDirectoryPath,
      );
    } else {
      // Android common locations
      locations.push(
        `${RNFS.ExternalStorageDirectoryPath}/Obsidian`,
        `${RNFS.ExternalStorageDirectoryPath}/Documents/Obsidian`,
        `${RNFS.ExternalStorageDirectoryPath}/Documents`,
        RNFS.ExternalStorageDirectoryPath,
      );
    }

    return locations;
  }

  /**
   * Get a friendly name for a folder path
   */
  static getFriendlyName(path: string): string {
    const parts = path.split('/').filter(p => p.length > 0);
    const lastPart = parts[parts.length - 1];

    if (path.includes('Obsidian')) {
      return 'Obsidian Vault';
    } else if (path.includes('Documents')) {
      return 'Documents';
    } else if (path.includes('Downloads')) {
      return 'Downloads';
    } else {
      return lastPart || path;
    }
  }
}
