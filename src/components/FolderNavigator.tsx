import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import RNFS from 'react-native-fs';
import DocumentPicker from '@react-native-documents/picker';
import {Logger} from '../utils/Logger';

interface FolderNavigatorProps {
  onSelectFolder: (folderPath: string) => void;
  onCancel: () => void;
}

interface FolderItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

export const FolderNavigator: React.FC<FolderNavigatorProps> = ({
  onSelectFolder,
  onCancel,
}) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);

  useEffect(() => {
    Logger.info('FolderNavigator mounted, initializing...');
    initializeNavigator().catch(err => {
      Logger.error('initializeNavigator failed:', err);
      setLoading(false);
      Alert.alert('Error', `Failed to initialize folder navigator: ${err}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeNavigator = async () => {
    // On iOS, we use document picker instead of folder navigation
    if (Platform.OS === 'ios') {
      setLoading(false);
      return;
    }

    // Android: Request storage permissions
    try {
      // Check Android version
      const androidVersion = Platform.Version as number;
      Logger.info(`Android version: ${androidVersion}`);

      if (androidVersion >= 30) {
        // Android 11+ - MANAGE_EXTERNAL_STORAGE must be granted manually
        // We can't programmatically check if it's granted, so just try to proceed
        Logger.info('Android 11+ detected - proceeding with file access');
        Logger.info('If access fails, user needs to grant "All Files Access" in Settings');
      } else {
        // Android 10 and below - Use normal permission
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'LocalOS needs access to browse your folders and select your vault.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission Required',
            'Storage permission is required to browse folders. Please grant permission in settings.',
          );
          onCancel();
          return;
        }
      }
    } catch (err) {
      Logger.error('Permission request error:', err);
      Alert.alert('Error', 'Failed to request storage permission');
      onCancel();
      return;
    }

    // Start at Internal Storage root on Android
    const rootPath = RNFS.ExternalStorageDirectoryPath; // /storage/emulated/0
    Logger.info(`Starting navigation at: ${rootPath}`);
    await navigateToFolder(rootPath);
  };

  const handlePickFolderIOS = async () => {
    try {
      Logger.info('Opening iOS document picker for folder selection');
      setLoading(true);

      const result = await DocumentPicker.pickDirectory();
      Logger.info('Folder picked:', result.uri);

      // DocumentPicker returns a URI, we need to use this directly
      // The URI is already accessible to the app
      if (result && result.uri) {
        onSelectFolder(result.uri);
      }
    } catch (err) {
      setLoading(false);
      if (DocumentPicker.isCancel(err)) {
        Logger.info('User cancelled folder picker');
      } else {
        Logger.error('Error picking folder:', err);
        Alert.alert('Error', `Failed to pick folder: ${err}`);
      }
    }
  };

  const navigateToFolder = async (folderPath: string) => {
    try {
      setLoading(true);
      Logger.info(`Navigating to: ${folderPath}`);

      // Check if path exists and is accessible
      Logger.info('Checking if path exists...');
      const exists = await RNFS.exists(folderPath);
      Logger.info(`Path exists: ${exists}`);

      if (!exists) {
        setLoading(false);
        Alert.alert('Error', 'This folder does not exist or is not accessible');
        return;
      }

      // Read directory contents
      Logger.info('Reading directory contents...');
      const items = await RNFS.readDir(folderPath);
      Logger.info(`Got ${items.length} items`);

      // Filter to only show directories, exclude hidden folders
      const folderItems: FolderItem[] = items
        .filter(item => item.isDirectory() && !item.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(item => ({
          name: item.name,
          path: item.path,
          isDirectory: true,
        }));

      setFolders(folderItems);
      setCurrentPath(folderPath);

      // Build breadcrumbs
      const parts = folderPath.split('/').filter(p => p.length > 0);
      setBreadcrumbs(parts);

      Logger.info(`Found ${folderItems.length} folders in ${folderPath}`);
    } catch (error) {
      Logger.error('Failed to navigate to folder:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error('Error details:', errorMsg);

      setLoading(false);
      Alert.alert(
        'Error',
        `Cannot access this folder: ${errorMsg}\n\nFor Android 11+, make sure "All Files Access" is enabled in Settings → Apps → LocalOS → Permissions.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFolderPress = (folderPath: string) => {
    navigateToFolder(folderPath);
  };

  const handleGoUp = () => {
    if (currentPath === '/' || currentPath === RNFS.ExternalStorageDirectoryPath) {
      Alert.alert('Info', 'Already at root directory');
      return;
    }

    // Go up one level
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
    if (parentPath) {
      navigateToFolder(parentPath);
    }
  };

  const handleSelectCurrent = () => {
    Alert.alert(
      'Select This Folder',
      `Use "${breadcrumbs[breadcrumbs.length - 1]}" as your vault?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Select',
          onPress: () => onSelectFolder(currentPath),
        },
      ],
    );
  };

  const handleBreadcrumbPress = (index: number) => {
    // Navigate to a specific breadcrumb level
    const pathParts = currentPath.split('/').filter(p => p.length > 0);
    const targetPath = '/' + pathParts.slice(0, index + 1).join('/');
    navigateToFolder(targetPath);
  };

  const getDisplayPath = () => {
    // Simplify path display for better UX
    if (Platform.OS === 'android') {
      return currentPath
        .replace('/storage/emulated/0', 'Internal Storage')
        .replace('/sdcard', 'Internal Storage');
    }
    return currentPath.replace(RNFS.DocumentDirectoryPath, 'Documents');
  };

  // iOS: Show document picker button
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Vault Folder</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.iosInstructionsContainer}>
          <Text style={styles.iosInstructionsTitle}>
            📁 Select Your Obsidian Vault
          </Text>
          <Text style={styles.iosInstructionsText}>
            Tap the button below to browse and select your vault folder from:
          </Text>
          <Text style={styles.iosInstructionsBullet}>• Files app</Text>
          <Text style={styles.iosInstructionsBullet}>• iCloud Drive</Text>
          <Text style={styles.iosInstructionsBullet}>• On My iPhone</Text>
          <Text style={styles.iosInstructionsBullet}>
            • Any other accessible location
          </Text>
          <Text style={styles.iosInstructionsNote}>
            The app will be able to access all files and folders within your selected
            vault.
          </Text>
        </View>

        {/* Pick Folder Button */}
        <View style={styles.iosPickerContainer}>
          <TouchableOpacity
            style={styles.iosPickButton}
            onPress={handlePickFolderIOS}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.iosPickButtonText}>📂 Browse & Select Folder</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Android: Show folder navigator
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Vault Folder</Text>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Breadcrumbs */}
      <View style={styles.breadcrumbsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={styles.breadcrumbButton} onPress={handleGoUp}>
            <Text style={styles.breadcrumbText}>↑ Up</Text>
          </TouchableOpacity>
          {breadcrumbs.map((crumb, index) => (
            <TouchableOpacity
              key={index}
              style={styles.breadcrumbButton}
              onPress={() => handleBreadcrumbPress(index)}>
              <Text
                style={[
                  styles.breadcrumbText,
                  index === breadcrumbs.length - 1 && styles.breadcrumbTextActive,
                ]}>
                {crumb}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Current Path Display */}
      <View style={styles.pathDisplay}>
        <Text style={styles.pathText}>{getDisplayPath()}</Text>
      </View>

      {/* Folder List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading folders...</Text>
        </View>
      ) : (
        <ScrollView style={styles.folderList}>
          {folders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No subfolders in this directory.{'\n\n'}
                This might be your vault folder, or go up to find it.
              </Text>
            </View>
          ) : (
            folders.map(folder => (
              <TouchableOpacity
                key={folder.path}
                style={styles.folderItem}
                onPress={() => handleFolderPress(folder.path)}>
                <Text style={styles.folderIcon}>📁</Text>
                <Text style={styles.folderName}>{folder.name}</Text>
                <Text style={styles.folderArrow}>→</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Select Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={handleSelectCurrent}
          disabled={loading}>
          <Text style={styles.selectButtonText}>
            ✓ Select This Folder as Vault
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  breadcrumbsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  breadcrumbButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    marginRight: 8,
  },
  breadcrumbText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '500',
  },
  breadcrumbTextActive: {
    fontWeight: '700',
    color: '#0D47A1',
  },
  pathDisplay: {
    padding: 12,
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE69C',
  },
  pathText: {
    fontSize: 13,
    color: '#856404',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  folderList: {
    flex: 1,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  folderIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  folderName: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  folderArrow: {
    fontSize: 18,
    color: '#999',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  selectButton: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  iosInstructionsContainer: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iosInstructionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
    textAlign: 'center',
  },
  iosInstructionsText: {
    fontSize: 15,
    color: '#333',
    marginBottom: 12,
    lineHeight: 22,
  },
  iosInstructionsBullet: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    marginBottom: 6,
    lineHeight: 20,
  },
  iosInstructionsNote: {
    fontSize: 13,
    color: '#999',
    marginTop: 16,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  iosPickerContainer: {
    padding: 16,
    marginTop: 'auto',
  },
  iosPickButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  iosPickButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
