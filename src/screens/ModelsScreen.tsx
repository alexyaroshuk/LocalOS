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
import DocumentPicker from 'react-native-document-picker';
import {ModelInfo, DownloadStatus} from '../types';
import {ModelStorageService} from '../services/ModelStorageService';
import {LlamaService} from '../services/LlamaService';
import {StorageService} from '../services/StorageService';
import {RECOMMENDED_MODELS} from '../utils/constants';
import {formatBytes} from '../utils/helpers';

interface ModelsScreenProps {
  currentModel: ModelInfo | null;
  onModelLoaded: (model: ModelInfo) => void;
}

export const ModelsScreen: React.FC<ModelsScreenProps> = ({
  currentModel,
  onModelLoaded,
}) => {
  const [models, setModels] = useState<ModelInfo[]>(RECOMMENDED_MODELS);
  const [downloadingModels, setDownloadingModels] = useState<
    Map<string, DownloadStatus>
  >(new Map());
  const [loadingModel, setLoadingModel] = useState<string | null>(null);
  const [availableSpace, setAvailableSpace] = useState<number>(0);

  useEffect(() => {
    initializeModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeModels = async () => {
    try {
      // Initialize storage directory
      await ModelStorageService.initialize();

      // Check available space
      const space = await ModelStorageService.getAvailableSpace();
      setAvailableSpace(space);

      // Load saved model info
      const savedModels = await StorageService.loadDownloadedModels();

      // Check which models are actually downloaded
      const updatedModels = await Promise.all(
        RECOMMENDED_MODELS.map(async model => {
          const exists = await ModelStorageService.modelExists(model.filename);
          const savedInfo = savedModels.find(m => m.id === model.id);

          return {
            ...model,
            downloaded: exists,
            localPath: exists
              ? ModelStorageService.getModelPath(model.filename)
              : undefined,
            ...savedInfo,
          };
        }),
      );

      setModels(updatedModels);

      // Auto-load last used model if available
      const lastModel = await StorageService.loadCurrentModel();
      if (lastModel && lastModel.downloaded) {
        const modelInfo = updatedModels.find(m => m.id === lastModel.id);
        if (modelInfo) {
          await handleLoadModel(modelInfo);
        }
      }
    } catch (error) {
      console.error('Failed to initialize models:', error);
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

                setModels(prev =>
                  prev.map(m => (m.id === model.id ? updatedModel : m)),
                );

                // Save to storage
                const allModels = models.map(m =>
                  m.id === model.id ? updatedModel : m,
                );
                await StorageService.saveDownloadedModels(allModels);

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

      await LlamaService.loadModel(model.localPath, model.name);

      await StorageService.saveCurrentModel(model);
      onModelLoaded(model);

      Alert.alert('Success', `${model.name} loaded successfully!`);
    } catch (error) {
      console.error('Failed to load model:', error);
      Alert.alert('Error', 'Failed to load model. Please try again.');
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

              const updatedModel = {...model, downloaded: false, localPath: undefined};
              setModels(prev =>
                prev.map(m => (m.id === model.id ? updatedModel : m)),
              );

              await StorageService.saveDownloadedModels(
                models.map(m => (m.id === model.id ? updatedModel : m)),
              );

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
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });

      const file = result[0];

      // Check if it's a GGUF file
      if (!file.name?.endsWith('.gguf')) {
        Alert.alert('Invalid File', 'Please select a .gguf model file');
        return;
      }

      // Extract model name from filename
      const modelName = file.name.replace('.gguf', '');

      Alert.alert(
        'Import Model',
        `Import ${file.name}?\nSize: ${formatBytes(file.size || 0)}`,
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
                  file.name!,
                );

                // Create model info
                const importedModel: ModelInfo = {
                  id: `imported-${Date.now()}`,
                  name: modelName,
                  filename: file.name!,
                  size: file.size || 0,
                  quantization: 'Unknown',
                  downloaded: true,
                  localPath: destPath,
                };

                // Add to models list
                setModels(prev => [...prev, importedModel]);

                // Save to storage
                await StorageService.saveDownloadedModels([...models, importedModel]);

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
      if (DocumentPicker.isCancel(error)) {
        // User cancelled
        return;
      }
      console.error('File picker error:', error);
      Alert.alert('Error', 'Failed to open file picker');
    }
  };

  const renderModelCard = (model: ModelInfo) => {
    const downloadStatus = downloadingModels.get(model.id);
    const isLoading = loadingModel === model.id;
    const isCurrent = currentModel?.id === model.id;

    return (
      <View key={model.id} style={styles.modelCard}>
        <View style={styles.modelHeader}>
          <Text style={styles.modelName}>{model.name}</Text>
          {isCurrent && <Text style={styles.currentBadge}>ACTIVE</Text>}
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
                <TouchableOpacity
                  style={[styles.button, styles.loadButton]}
                  onPress={() => handleLoadModel(model)}
                  disabled={isLoading || isCurrent}>
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>
                      {isCurrent ? 'Loaded' : 'Load'}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.deleteButton]}
                  onPress={() => handleDeleteModel(model)}
                  disabled={isLoading || isCurrent}>
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
        <Text style={styles.sectionTitle}>Recommended Models</Text>
        {models.map(renderModelCard)}

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
    marginBottom: 12,
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
  currentBadge: {
    backgroundColor: '#34C759',
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
    flexDirection: 'row',
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
  loadButton: {
    backgroundColor: '#007AFF',
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
});
