import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {pick, types} from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import {ModelInfo, DownloadStatus} from '../types';
import {ModelStorageService} from '../services/ModelStorageService';
import {LlamaService} from '../services/LlamaService';
import {StorageService} from '../services/StorageService';
import {RECOMMENDED_MODELS} from '../utils/constants';
import {formatBytes} from '../utils/helpers';
import {Logger} from '../utils/Logger';

interface ModelsScreenProps {
  currentModel: ModelInfo | null;
  onModelLoaded: (model: ModelInfo) => void;
}

export const ModelsScreen: React.FC<ModelsScreenProps> = ({
  currentModel,
  onModelLoaded,
}) => {
  const [yourModels, setYourModels] = useState<ModelInfo[]>([]);
  const [downloadableModels, setDownloadableModels] = useState<ModelInfo[]>([]);
  const [downloadingModels, setDownloadingModels] = useState<
    Map<string, DownloadStatus>
  >(new Map());
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [availableSpace, setAvailableSpace] = useState<number>(0);
  const [showDownloadableModels, setShowDownloadableModels] = useState<boolean>(false);
  const [currentEmbeddingModel, setCurrentEmbeddingModel] = useState<ModelInfo | null>(null);

  useEffect(() => {
    initializeModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeModels = async () => {
    try {
      Logger.debug('📱 ModelsScreen: Initializing models...');

      // Initialize storage directory
      await ModelStorageService.initialize();

      // Check available space
      const space = await ModelStorageService.getAvailableSpace();
      setAvailableSpace(space);

      // Load saved models and check filesystem
      const savedModels = await StorageService.loadDownloadedModels();

      // Verify each saved model actually exists on filesystem
      Logger.debug('🔍 Verifying saved models exist on filesystem...');
      const verifiedModels = await Promise.all(
        savedModels.map(async model => {
          const exists = model.localPath
            ? await ModelStorageService.modelExists(model.filename)
            : false;
          return {
            ...model,
            downloaded: exists,
            localPath: exists ? model.localPath : undefined,
          };
        }),
      );

      // Deduplicate by path and filename
      Logger.debug('🧹 Deduplicating models...');
      const seenPaths = new Set<string>();
      const seenFilenames = new Set<string>();
      let duplicateCount = 0;

      const deduplicated = verifiedModels.filter(model => {
        const path = model.localPath || '';
        const filename = model.filename || '';

        if (path && seenPaths.has(path)) {
          Logger.debug(`Removing duplicate by path: ${model.name}`);
          duplicateCount++;
          return false;
        }
        if (filename && seenFilenames.has(filename)) {
          Logger.debug(`Removing duplicate by filename: ${model.name}`);
          duplicateCount++;
          return false;
        }

        if (path) seenPaths.add(path);
        if (filename) seenFilenames.add(filename);
        return true;
      });

      Logger.debug(`✅ Deduplicated from ${verifiedModels.length} to ${deduplicated.length} models (${duplicateCount} removed)`);

      // Separate into downloaded and available for download
      const downloaded = deduplicated.filter(m => m.downloaded);
      const available = deduplicated.filter(m => !m.downloaded);

      // Add RECOMMENDED_MODELS that aren't in the list yet
      const availableIds = new Set(available.map(m => m.id));
      const recommendedNotDownloaded = RECOMMENDED_MODELS.filter(
        m => !availableIds.has(m.id) && !downloaded.some(d => d.id === m.id),
      );

      setYourModels(downloaded);
      setDownloadableModels([...available, ...recommendedNotDownloaded]);

      // Load current embedding model state
      const {StorageService: StorageServiceImpl} = require('../services/StorageService');
      const embeddingModel = await StorageServiceImpl.loadEmbeddingModel();
      if (embeddingModel) {
        Logger.debug(`📦 Loaded embedding model state: ${embeddingModel.name}`);
        setCurrentEmbeddingModel(embeddingModel);
      }

      Logger.debug(`✅ ModelsScreen initialization complete: ${downloaded.length} your models, ${available.length + recommendedNotDownloaded.length} available for download`);
    } catch (error) {
      Logger.error('❌ Failed to initialize models:', error instanceof Error ? error.message : String(error));
      Alert.alert('Error', 'Failed to initialize model storage');
    }
  };

  const handleDownloadModel = async (model: ModelInfo) => {
    try {
      // Check if model is already downloaded
      if (model.downloaded) {
        Alert.alert('Already Downloaded', 'This model is already downloaded');
        return;
      }

      // Check available space
      const hasSpace = await ModelStorageService.hasEnoughSpace(model.size);
      if (!hasSpace) {
        Alert.alert(
          'Insufficient Storage',
          `Not enough space to download this model. Required: ${formatBytes(model.size)}`,
        );
        return;
      }

      // Confirm download
      Alert.alert(
        'Download Model',
        `Download ${model.name}?\nSize: ${formatBytes(model.size)}`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Download',
            onPress: async () => {
              const downloadUrl = ModelStorageService.getHuggingFaceDownloadUrl(
                model.huggingFaceRepo!,
                model.filename,
              );

              // Start download
              setDownloadingModels(prev =>
                new Map(prev).set(model.id, {
                  modelId: model.id,
                  progress: 0,
                  bytesDownloaded: 0,
                  totalBytes: model.size,
                  status: 'downloading',
                }),
              );

              try {
                await ModelStorageService.downloadModel(
                  downloadUrl,
                  model.filename,
                  status => {
                    setDownloadingModels(prev =>
                      new Map(prev).set(model.id, status),
                    );
                  },
                );

                // Update model info
                const updatedModel = {
                  ...model,
                  downloaded: true,
                  localPath: ModelStorageService.getModelPath(model.filename),
                };

                // Move from downloadable to your models
                setDownloadableModels(prev =>
                  prev.filter(m => m.id !== model.id),
                );
                setYourModels(prev => [...prev, updatedModel]);

                // Save to storage
                const allDownloadedModels = [...yourModels, updatedModel];
                await StorageService.saveDownloadedModels(allDownloadedModels);

                // Remove from downloading map
                setDownloadingModels(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(model.id);
                  return newMap;
                });

                Alert.alert('Success', 'Model downloaded successfully!');
              } catch (error) {
                console.error('Download failed:', error);
                setDownloadingModels(prev => {
                  const newMap = new Map(prev);
                  newMap.delete(model.id);
                  return newMap;
                });
                Alert.alert(
                  'Download Failed',
                  'Failed to download model. Please check your internet connection and try again.',
                );
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to start download');
    }
  };

  const handleLoadModel = async (model: ModelInfo) => {
    if (!model.downloaded || !model.localPath) {
      Alert.alert('Not Downloaded', 'Please download this model first');
      return;
    }

    try {
      setLoadingModel(model.id);

      // Validate file exists before attempting to load
      const fileExists = await ModelStorageService.modelExists(model.filename);
      if (!fileExists) {
        Logger.error('❌ Model file not found at:', model.localPath);
        // Update model list to reflect file is missing
        setYourModels(prev => prev.filter(m => m.id !== model.id));
        Alert.alert(
          'Model File Missing',
          `${model.name} was not found at ${model.localPath}.\n\nIt may have been deleted. Removing from your models.`,
        );
        return;
      }

      Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.info('🔄 LOADING CHAT MODEL');
      Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.info(`Model Name: ${model.name}`);
      Logger.info(`Model ID: ${model.id}`);
      Logger.info(`Model Path: ${model.localPath}`);
      Logger.info(`Model Size: ${formatBytes(model.size)}`);
      Logger.info(`Quantization: ${model.quantization}`);

      // TypeScript safety: model.localPath is guaranteed to be defined here due to check above
      await LlamaService.loadModel(model.localPath!, model.name);

      await StorageService.saveCurrentModel(model);

      onModelLoaded(model);

      Logger.info('✅ Chat model loaded successfully');
      Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      Alert.alert('Success', `${model.name} loaded as CHAT model!`);
    } catch (error) {
      Logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.error('❌ FAILED TO LOAD CHAT MODEL');
      Logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.error(`Model Name: ${model.name}`);
      Logger.error(`Model ID: ${model.id}`);
      Logger.error(`Model Path: ${model.localPath}`);
      Logger.error('Error Type:', error instanceof Error ? error.constructor.name : typeof error);
      Logger.error('Error Message:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        Logger.error('Stack Trace:', error.stack);
      }
      Logger.error('Full Error Object:', error);
      Logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert(
        'Failed to Load Model',
        `Error: ${errorMessage}\n\nPlease check the logs for more details.`,
      );
    } finally {
      setLoadingModel(null);
    }
  };

  const handleLoadEmbeddingModel = async (model: ModelInfo) => {
    if (!model.downloaded || !model.localPath) {
      Alert.alert('Not Downloaded', 'Please download this model first');
      return;
    }

    // Check if this looks like an embedding model
    const isEmbedModel = model.name.toLowerCase().includes('embed');
    if (!isEmbedModel) {
      Alert.alert(
        'Warning',
        'This doesn\'t look like an embedding model. Embedding models usually have "embed" in the name.\n\nContinue anyway?',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Load Anyway', onPress: () => loadEmbeddingModelConfirmed(model)},
        ]
      );
      return;
    }

    await loadEmbeddingModelConfirmed(model);
  };

  const loadEmbeddingModelConfirmed = async (model: ModelInfo) => {
    // Additional safety check
    if (!model.downloaded || !model.localPath) {
      Alert.alert('Error', 'Model not downloaded or path is invalid');
      return;
    }

    try {
      setLoadingModel(model.id);

      // Validate file exists before attempting to load
      const fileExists = await ModelStorageService.modelExists(model.filename);
      if (!fileExists) {
        Logger.error('❌ Embedding model file not found at:', model.localPath);
        Alert.alert(
          'Model File Missing',
          `${model.name} was not found at ${model.localPath}.\n\nIt may have been deleted.`,
        );
        return;
      }

      Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.info('🔢 LOADING EMBEDDING MODEL');
      Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.info(`Model Name: ${model.name}`);
      Logger.info(`Model ID: ${model.id}`);
      Logger.info(`Model Path: ${model.localPath}`);
      Logger.info(`Model Size: ${formatBytes(model.size)}`);
      Logger.info(`Quantization: ${model.quantization}`);

      // TypeScript safety: model.localPath is guaranteed to be defined here due to check above
      await LlamaService.loadEmbeddingModel(model.localPath!, model.name);

      // Save embedding model preference for auto-load on next startup
      await StorageService.saveEmbeddingModel(model);

      // Update current embedding model state for UI
      setCurrentEmbeddingModel(model);

      Logger.info('✅ Embedding model loaded successfully');
      Logger.info('🎉 DUAL INSTANCE MODE ACTIVE!');
      Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      Alert.alert(
        'Success',
        `${model.name} loaded as EMBEDDING model!\n\n🎉 Dual instance mode active!\nAgent can now use semantic search.`
      );
    } catch (error) {
      Logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.error('❌ FAILED TO LOAD EMBEDDING MODEL');
      Logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.error(`Model Name: ${model.name}`);
      Logger.error(`Model ID: ${model.id}`);
      Logger.error(`Model Path: ${model.localPath}`);
      Logger.error('Error Type:', error instanceof Error ? error.constructor.name : typeof error);
      Logger.error('Error Message:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        Logger.error('Stack Trace:', error.stack);
      }
      Logger.error('Full Error Object:', error);
      Logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert(
        'Failed to Load Embedding Model',
        `Error: ${errorMessage}\n\nPlease check the logs for more details.`,
      );
    } finally {
      setLoadingModel(null);
    }
  };

  const handleDeleteModel = (model: ModelInfo) => {
    Alert.alert(
      'Delete Model',
      `Are you sure you want to delete ${model.name}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ModelStorageService.deleteModel(model.filename);

              // Move from your models to downloadable
              setYourModels(prev => prev.filter(m => m.id !== model.id));

              // Add back to downloadable list (remove localPath)
              const undownloadedModel = {...model, downloaded: false, localPath: undefined};
              setDownloadableModels(prev => {
                // Check if it's already in downloadable
                const exists = prev.some(m => m.id === model.id);
                return exists ? prev : [...prev, undownloadedModel];
              });

              // Save to storage (only downloaded models)
              const remainingModels = yourModels.filter(m => m.id !== model.id);
              await StorageService.saveDownloadedModels(remainingModels);

              // Update available space
              const space = await ModelStorageService.getAvailableSpace();
              setAvailableSpace(space);

              Alert.alert('Success', 'Model deleted successfully');
            } catch (error) {
              console.error('Delete failed:', error);
              Alert.alert('Error', 'Failed to delete model');
            }
          },
        },
      ],
    );
  };

  const handleImportModel = async () => {
    try {
      const result = await pick({
        type: [types.allFiles],
        allowMultiSelection: false,
      });

      if (!result || result.length === 0) {
        return; // User cancelled
      }

      const file = result[0];

      console.log('File picker result:', JSON.stringify(file, null, 2));

      // Get filename from either name or uri
      const fileName = file.name || file.uri?.split('/').pop() || '';

      console.log('Extracted filename:', fileName);

      // Check if it's a GGUF file
      if (!fileName.toLowerCase().endsWith('.gguf')) {
        Alert.alert(
          'Invalid File',
          `Please select a .gguf model file.\n\nSelected: ${fileName || 'Unknown file'}`,
        );
        return;
      }

      // Extract model name from filename
      const modelName = fileName.replace(/\.gguf$/i, '');

      Alert.alert(
        'Import Model',
        `Import ${fileName}?\nSize: ${formatBytes(file.size || 0)}`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Import',
            onPress: async () => {
              try {
                setLoadingModel('import');

                // Copy file to app storage
                const destPath = await ModelStorageService.copyModelToStorage(
                  file.uri,
                  fileName,
                );

                // Get actual file size from copied file
                let actualSize = file.size || 0;
                try {
                  const stat = await RNFS.stat(destPath);
                  actualSize = Number(stat.size);
                  console.log('Actual file size:', actualSize);
                } catch (err) {
                  console.warn('Could not get file size, using picker size:', err);
                }

                // Check if model with this path already exists
                const existingModel = yourModels.find(m => m.localPath === destPath);
                if (existingModel) {
                  Logger.info('Model already exists in list, not adding duplicate');
                  Alert.alert(
                    'Model Already Exists',
                    `This model is already in your list: ${existingModel.name}`,
                  );
                  setLoadingModel(null);
                  return;
                }

                // Create model info
                const importedModel: ModelInfo = {
                  id: `imported-${Date.now()}`,
                  name: modelName,
                  filename: fileName,
                  size: actualSize,
                  quantization: 'Unknown',
                  downloaded: true,
                  localPath: destPath,
                };

                // Add to your models list and save
                const updatedModelsList = [...yourModels, importedModel];
                setYourModels(updatedModelsList);

                // Save to storage (use updated list, not stale state)
                await StorageService.saveDownloadedModels(updatedModelsList);

                // Update available space
                const space = await ModelStorageService.getAvailableSpace();
                setAvailableSpace(space);

                Alert.alert('Success', 'Model imported successfully!');
              } catch (error) {
                console.error('Import failed:', error);
                Alert.alert('Error', 'Failed to import model');
              } finally {
                setLoadingModel(null);
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error('File picker error:', error);
      Alert.alert('Error', 'Failed to open file picker');
    }
  };

  const renderModelCard = (model: ModelInfo, isDownloadable: boolean = false) => {
    const downloadStatus = downloadingModels.get(model.id);
    const isLoading = loadingModel === model.id;
    // Check if this is the current loaded chat model
    const isChatActive = !isDownloadable && currentModel?.id === model.id;
    // Check if this is the current embedding model
    const isEmbeddingActive = !isDownloadable && currentEmbeddingModel?.id === model.id;

    return (
      <View key={model.id} style={styles.modelCard}>
        <View style={styles.modelHeader}>
          <Text style={styles.modelName}>{model.name}</Text>
          <View style={styles.badgesContainer}>
            {isChatActive && <Text style={styles.currentBadge}>✓ Chat</Text>}
            {isEmbeddingActive && <Text style={styles.embeddingBadge}>✓ Embed</Text>}
          </View>
        </View>

        <Text style={styles.modelDetails}>
          Size: {formatBytes(model.size)} • {model.quantization}
        </Text>

        {downloadStatus ? (
          <View style={styles.downloadProgress}>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {width: `${downloadStatus.progress}%`},
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {downloadStatus.progress.toFixed(1)}% •{' '}
              {formatBytes(downloadStatus.bytesDownloaded)} /{' '}
              {formatBytes(downloadStatus.totalBytes)}
            </Text>
          </View>
        ) : (
          <View style={styles.buttonContainer}>
            {model.downloaded ? (
              <>
                <View style={styles.loadButtonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.loadButton]}
                    onPress={() => handleLoadModel(model)}
                    disabled={isLoading || isChatActive}>
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>
                        {isChatActive ? '✓ Chat' : '🤖 Chat'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.embedButton]}
                    onPress={() => handleLoadEmbeddingModel(model)}
                    disabled={isLoading || isEmbeddingActive}>
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>
                        {isEmbeddingActive ? '✓ Embed' : '🔢 Embed'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.button, styles.deleteButton]}
                  onPress={() => handleDeleteModel(model)}
                  disabled={isLoading || isChatActive || isEmbeddingActive}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.downloadButton]}
                onPress={() => handleDownloadModel(model)}>
                <Text style={styles.buttonText}>Download</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Models</Text>
          <TouchableOpacity
            style={styles.importButton}
            onPress={handleImportModel}
            disabled={loadingModel !== null}>
            <Text style={styles.importButtonText}>Import from Files</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.storageInfo}>
          Available: {formatBytes(availableSpace)}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Your Models</Text>
        {yourModels.length > 0 ? (
          yourModels.map(model => renderModelCard(model, false))
        ) : (
          <Text style={styles.emptyStateText}>
            No models yet. Import a model or download one.
          </Text>
        )}

        <View style={styles.sectionDivider} />

        <TouchableOpacity
          style={styles.expandableHeader}
          onPress={() => setShowDownloadableModels(!showDownloadableModels)}>
          <Text style={styles.sectionTitle}>Download Models</Text>
          <Text style={styles.expandIcon}>
            {showDownloadableModels ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>
        {showDownloadableModels && downloadableModels.length > 0 && (
          <>
            <Text style={styles.sectionSubtitle}>
              Available from Hugging Face
            </Text>
            {downloadableModels.map(model => renderModelCard(model, true))}
          </>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About Model Sizes</Text>
          <Text style={styles.infoText}>
            • Q4_K_M: Good quality, smaller size{'\n'}
            • Q5_K_M: Better quality, larger size{'\n'}
            • Recommended: 4-8GB RAM for smooth performance
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
  },
  importButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  storageInfo: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 20,
  },
  modelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  currentBadge: {
    backgroundColor: '#34C759',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  embeddingBadge: {
    backgroundColor: '#9C27B0',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  modelDetails: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  loadButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  loadButton: {
    flex: 1,
    backgroundColor: '#007AFF',
  },
  embedButton: {
    flex: 1,
    backgroundColor: '#9C27B0',
  },
  downloadButton: {
    backgroundColor: '#34C759',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
  downloadProgress: {
    gap: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#34C759',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  infoSection: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 20,
  },
  expandableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  expandIcon: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 12,
    paddingVertical: 16,
  },
});
