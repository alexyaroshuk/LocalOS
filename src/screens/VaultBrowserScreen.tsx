import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import {VaultService} from '../services/VaultService';
import {VaultIndexService} from '../services/VaultIndexService';
import {LlamaService} from '../services/LlamaService';
import {DatabaseService} from '../services/DatabaseService';
import {SampleVaultService} from '../services/SampleVaultService';
import {FolderNavigator} from '../components/FolderNavigator';
import {
  VaultFolder,
  VaultFile,
  VaultConfig,
  MarkdownFile,
} from '../types/vault';
import {Logger} from '../utils/Logger';
import {formatBytes} from '../utils/helpers';

type ViewMode = 'setup' | 'browser' | 'reader' | 'navigator';

export const VaultBrowserScreen: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('setup');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [sampleVaultProgress, setSampleVaultProgress] = useState<string>('');

  // Setup mode state
  const [vaultConfig, setVaultConfig] = useState<VaultConfig | null>(null);

  // Browser mode state
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>('');
  const [folderHierarchy, setFolderHierarchy] = useState<string[]>([]);

  // Reader mode state
  const [selectedFile, setSelectedFile] = useState<MarkdownFile | null>(null);

  // Index state
  const [indexing, setIndexing] = useState<boolean>(false);
  const [indexProgress, setIndexProgress] = useState<string>('');
  const [indexStats, setIndexStats] = useState<{totalChunks: number; uniqueFiles: number; embeddingDim: number | null} | null>(null);

  const refreshIndexStats = useCallback(async () => {
    try {
      const stats = await DatabaseService.getVaultChunkStats();
      setIndexStats(stats);
    } catch (err) {
      Logger.warn('Failed to load index stats', err);
    }
  }, []);

  const handleReindexVault = async () => {
    if (indexing) return;
    if (!LlamaService.isEmbeddingModelLoaded()) {
      Alert.alert(
        'Embedding Model Required',
        'Load an embedding model from the Models screen before indexing the vault.',
      );
      return;
    }
    try {
      setIndexing(true);
      setIndexProgress('Starting…');
      const result = await VaultIndexService.indexFullVault((done, total, path) => {
        const name = path.split('/').pop() || path;
        setIndexProgress(`Indexing ${done + 1}/${total}: ${name}`);
      });
      setIndexProgress(
        `Indexed ${result.filesIndexed} files, ${result.chunksIndexed} chunks (${result.durationMs}ms, ${result.skipped} skipped)`,
      );
      await refreshIndexStats();
    } catch (err) {
      Logger.error('Reindex failed', err);
      Alert.alert('Reindex failed', err instanceof Error ? err.message : String(err));
      setIndexProgress('');
    } finally {
      setIndexing(false);
    }
  };

  useEffect(() => {
    initializeVaultBrowser();
    refreshIndexStats();
  }, [refreshIndexStats]);

  const initializeVaultBrowser = async () => {
    try {
      setLoading(true);
      await VaultService.initialize();

      const config = await VaultService.getVaultConfig();
      if (config) {
        setVaultConfig(config);
        await loadVaultContents(config.vaultPath);
        setViewMode('browser');
      } else {
        setViewMode('setup');
      }
    } catch (error) {
      Logger.error('Failed to initialize vault browser:', error);
      Alert.alert('Error', 'Failed to initialize vault browser');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFolderNavigator = () => {
    setViewMode('navigator');
  };

  const handleFolderSelected = async (folderPath: string) => {
    try {
      setLoading(true);
      setViewMode('setup'); // Close navigator

      Logger.info(`Setting vault path: ${folderPath}`);

      // Debug: Check what's actually in the folder
      try {
        const debugItems = await VaultService.debugListDirectory(folderPath);
        Logger.info(`Debug: Root contains ${debugItems.length} items`);

        // If there are subfolders, check the first one
        const firstFolder = debugItems.find(item => item.isDirectory);
        if (firstFolder) {
          Logger.info(`Debug: Checking subfolder ${firstFolder.name}`);
          await VaultService.debugListDirectory(firstFolder.path);
        }
      } catch (debugError) {
        Logger.warn('Debug check failed:', debugError);
      }

      await VaultService.setActiveVault(folderPath);

      const config = await VaultService.getVaultConfig();
      setVaultConfig(config);

      await loadVaultContents(folderPath);
      setViewMode('browser');

      const fileCount = config?.fileCount || 0;
      const message = fileCount > 0
        ? `Vault configured successfully!\n\n${fileCount} markdown files found.`
        : 'Vault configured, but no markdown files found.\n\nMake sure the folder contains .md files.';

      Alert.alert('Success', message);
    } catch (error) {
      Logger.error('Failed to set vault:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert(
        'Error',
        `Failed to configure vault:\n\n${errorMessage}\n\nMake sure the folder is accessible and contains markdown files.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelNavigator = () => {
    setViewMode('setup');
  };

  const handleLoadSampleVault = async () => {
    try {
      setLoading(true);
      setSampleVaultProgress('Starting...');

      await SampleVaultService.createAndSetSampleVault(msg => {
        setSampleVaultProgress(msg);
      });

      const config = await VaultService.getVaultConfig();
      setVaultConfig(config);
      await loadVaultContents(SampleVaultService.vaultPath);
      setViewMode('browser');

      Alert.alert(
        'Sample Vault Loaded',
        `${SampleVaultService.fileCount} markdown files created.\n\nYou can now ask the AI about your vault, e.g. "What folders are in my vault?" or "Tell me about my Tokyo trip".`,
      );
    } catch (error) {
      Logger.error('Failed to load sample vault:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to create sample vault:\n\n${errorMessage}`);
    } finally {
      setLoading(false);
      setSampleVaultProgress('');
    }
  };

  const loadVaultContents = async (vaultPath: string, folder?: string) => {
    try {
      Logger.info(`Loading vault contents from: ${vaultPath}`);
      const scanResult = await VaultService.scanVault(vaultPath);

      Logger.info(
        `Scan complete: ${scanResult.totalFiles} files, ${scanResult.totalFolders} folders, ${scanResult.errors.length} errors`,
      );

      // Log any errors that occurred during scanning
      if (scanResult.errors.length > 0) {
        Logger.warn('Errors during scan:', scanResult.errors);
        // Show first few errors to user
        const errorSummary = scanResult.errors.slice(0, 3).join('\n');
        Alert.alert(
          'Scan Warnings',
          `Found ${scanResult.totalFiles} files, but encountered ${scanResult.errors.length} errors:\n\n${errorSummary}${
            scanResult.errors.length > 3 ? '\n\n...and more' : ''
          }`,
        );
      }

      // Filter files by current folder if specified
      let filteredFiles = scanResult.files;
      if (folder) {
        filteredFiles = scanResult.files.filter(f =>
          f.path.startsWith(folder),
        );
      }

      setFiles(filteredFiles);
      setCurrentFolder(folder || vaultPath);

      Logger.info(
        `Loaded ${filteredFiles.length} files from vault (${scanResult.scanDuration}ms)`,
      );
    } catch (error) {
      Logger.error('Failed to load vault contents:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Error', `Failed to load vault contents:\n\n${errorMessage}`);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!vaultConfig) return;

    setRefreshing(true);
    try {
      await loadVaultContents(vaultConfig.vaultPath, currentFolder);
    } finally {
      setRefreshing(false);
    }
  }, [vaultConfig, currentFolder]);

  const handleOpenFile = async (file: VaultFile) => {
    try {
      setLoading(true);
      const markdownFile = await VaultService.readMarkdownFile(file.path);
      setSelectedFile(markdownFile);
      setViewMode('reader');
    } catch (error) {
      Logger.error('Failed to read file:', error);
      Alert.alert('Error', 'Failed to read file');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedFile(null);
    setViewMode('browser');
  };

  const handleChangeVault = async () => {
    Alert.alert(
      'Change Vault',
      'Are you sure you want to change the vault? This will clear the current configuration.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Change',
          style: 'destructive',
          onPress: async () => {
            try {
              await VaultService.clearVault();
              setVaultConfig(null);
              setFiles([]);
              setViewMode('setup');
            } catch (error) {
              Logger.error('Failed to clear vault:', error);
              Alert.alert('Error', 'Failed to clear vault');
            }
          },
        },
      ],
    );
  };

  const renderSetupView = () => {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Setup Vault</Text>
          <Text style={styles.headerSubtitle}>
            Choose your Obsidian vault folder
          </Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.centerContent}>
          <View style={styles.setupCard}>
            <Text style={styles.setupIcon}>📁</Text>
            <Text style={styles.setupTitle}>No Vault Configured</Text>
            <Text style={styles.setupDescription}>
              Select your Obsidian vault folder from your device storage.{'\n\n'}
              You'll be able to browse through folders and pick the one containing your markdown notes.
            </Text>

            <TouchableOpacity
              style={styles.selectFolderButton}
              onPress={handleOpenFolderNavigator}>
              <Text style={styles.selectFolderButtonText}>
                📂 Browse & Select Folder
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sampleVaultButton}
              onPress={handleLoadSampleVault}>
              <Text style={styles.sampleVaultButtonText}>
                🧪 Load Sample Vault
              </Text>
            </TouchableOpacity>

            {sampleVaultProgress !== '' && (
              <Text style={styles.sampleVaultProgress}>
                {sampleVaultProgress}
              </Text>
            )}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>💡 Where is my vault?</Text>
            <Text style={styles.infoText}>
              <Text style={styles.bold}>Android:</Text> If you don't see your vault,
              connect your phone to PC via USB, enable "File Transfer", and copy
              your vault folder to Internal Storage or Download folder.{'\n\n'}
              <Text style={styles.bold}>iOS:</Text> Use Finder (Mac) or iTunes
              (Windows) to transfer your vault folder to the device first.{'\n\n'}
              <Text style={styles.bold}>Tip:</Text> Your vault can be in any folder,
              including subfolders. Use the folder browser to navigate to it.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderBrowserView = () => {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>
              {vaultConfig?.vaultName || 'Vault'}
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.reindexButton, indexing && styles.reindexButtonDisabled]}
                onPress={handleReindexVault}
                disabled={indexing}>
                {indexing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.reindexButtonText}>Reindex</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={handleChangeVault}>
                <Text style={styles.changeButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            {files.length} markdown files
            {indexStats && ` • ${indexStats.totalChunks} chunks indexed${indexStats.embeddingDim ? ` (${indexStats.embeddingDim}D)` : ''}`}
          </Text>
          {indexProgress ? (
            <Text style={styles.indexProgress}>{indexProgress}</Text>
          ) : null}
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }>
          {files.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No markdown files found in this vault.
              </Text>
            </View>
          ) : (
            files.map(file => (
              <TouchableOpacity
                key={file.path}
                style={styles.fileCard}
                onPress={() => handleOpenFile(file)}>
                <View style={styles.fileHeader}>
                  <Text style={styles.fileIcon}>📄</Text>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName}>{file.basename}</Text>
                    <Text style={styles.fileDetails}>
                      {file.relativePath} • {formatBytes(file.size)} •{' '}
                      {file.mtime.toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  };

  const renderReaderView = () => {
    if (!selectedFile) return null;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToList}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedFile.file.basename}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.content}>
          {/* Metadata section */}
          {(Object.keys(selectedFile.frontmatter).length > 0 ||
            selectedFile.tags.length > 0) && (
            <View style={styles.metadataCard}>
              <Text style={styles.metadataTitle}>Metadata</Text>

              {Object.entries(selectedFile.frontmatter).map(([key, value]) => (
                <Text key={key} style={styles.metadataItem}>
                  <Text style={styles.metadataKey}>{key}:</Text>{' '}
                  {Array.isArray(value) ? value.join(', ') : String(value)}
                </Text>
              ))}

              {selectedFile.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {selectedFile.tags.map(tag => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              {selectedFile.links.length > 0 && (
                <View style={styles.linksSection}>
                  <Text style={styles.metadataKey}>Links:</Text>
                  {selectedFile.links.map((link, idx) => (
                    <Text key={idx} style={styles.linkText}>
                      [[{link}]]
                    </Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Content section */}
          <View style={styles.contentCard}>
            <Text style={styles.markdownContent}>{selectedFile.content}</Text>
          </View>

          {/* File info */}
          <View style={styles.fileInfoCard}>
            <Text style={styles.fileInfoText}>
              Path: {selectedFile.file.relativePath}
            </Text>
            <Text style={styles.fileInfoText}>
              Size: {formatBytes(selectedFile.file.size)}
            </Text>
            <Text style={styles.fileInfoText}>
              Modified: {selectedFile.file.mtime.toLocaleString()}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading vault...</Text>
      </View>
    );
  }

  if (viewMode === 'navigator') {
    return (
      <FolderNavigator
        onSelectFolder={handleFolderSelected}
        onCancel={handleCancelNavigator}
      />
    );
  }

  if (viewMode === 'setup') {
    return renderSetupView();
  } else if (viewMode === 'reader') {
    return renderReaderView();
  } else {
    return renderBrowserView();
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  setupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    marginHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  setupIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  setupTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  setupDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  selectFolderButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  selectFolderButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  sampleVaultButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center',
    marginTop: 12,
  },
  sampleVaultButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  sampleVaultProgress: {
    marginTop: 10,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  folderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  folderIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  folderLocation: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  folderDetails: {
    fontSize: 13,
    color: '#666',
  },
  fileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  fileDetails: {
    fontSize: 12,
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
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  changeButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  changeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  reindexButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  reindexButtonDisabled: {
    opacity: 0.6,
  },
  reindexButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  indexProgress: {
    marginTop: 6,
    fontSize: 12,
    color: '#666',
  },
  backButton: {
    paddingRight: 12,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  metadataCard: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  metadataTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  metadataItem: {
    fontSize: 13,
    color: '#856404',
    marginBottom: 4,
  },
  metadataKey: {
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    backgroundColor: '#856404',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  linksSection: {
    marginTop: 12,
  },
  linkText: {
    fontSize: 13,
    color: '#007AFF',
    marginTop: 4,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  markdownContent: {
    fontSize: 15,
    color: '#000',
    lineHeight: 24,
  },
  fileInfoCard: {
    backgroundColor: '#F1F3F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  fileInfoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});
