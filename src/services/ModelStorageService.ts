/**
 * Service for managing model storage and downloads
 */
import RNFS from 'react-native-fs';
import {DownloadStatus} from '../types';
import {MODEL_STORAGE_DIR} from '../utils/constants';
import {isValidModelPath} from '../utils/helpers';
import {Logger} from '../utils/Logger';

export class ModelStorageService {
  private static modelDir: string = `${RNFS.DocumentDirectoryPath}/${MODEL_STORAGE_DIR}`;

  /**
   * Initialize model storage directory
   */
  static async initialize(): Promise<void> {
    try {
      Logger.debug(`Checking model directory: ${this.modelDir}`);
      const exists = await RNFS.exists(this.modelDir);
      if (!exists) {
        Logger.debug('Model directory does not exist, creating...');
        await RNFS.mkdir(this.modelDir);
        Logger.debug('✅ Model directory created');
      } else {
        Logger.debug('✅ Model directory already exists');
      }
    } catch (error) {
      Logger.error('Failed to initialize model directory:', error instanceof Error ? error.message : String(error));
      console.error('Failed to initialize model directory:', error);
      throw error;
    }
  }

  /**
   * Get path to model storage directory
   */
  static getModelDirectory(): string {
    return this.modelDir;
  }

  /**
   * Get full path for a model file
   */
  static getModelPath(filename: string): string {
    return `${this.modelDir}/${filename}`;
  }

  /**
   * Check if model file exists
   */
  static async modelExists(filename: string): Promise<boolean> {
    const path = this.getModelPath(filename);
    return await RNFS.exists(path);
  }

  /**
   * Get model file size
   */
  static async getModelSize(filename: string): Promise<number> {
    try {
      const path = this.getModelPath(filename);
      const stat = await RNFS.stat(path);
      return Number(stat.size);
    } catch (error) {
      console.error('Failed to get model size:', error);
      return 0;
    }
  }

  /**
   * Get available storage space
   */
  static async getAvailableSpace(): Promise<number> {
    try {
      const freeSpace = await RNFS.getFSInfo();
      return freeSpace.freeSpace;
    } catch (error) {
      console.error('Failed to get available space:', error);
      return 0;
    }
  }

  /**
   * Check if there's enough space for a model
   */
  static async hasEnoughSpace(requiredBytes: number): Promise<boolean> {
    const available = await this.getAvailableSpace();
    // Add 500MB buffer
    const buffer = 500 * 1024 * 1024;
    return available >= requiredBytes + buffer;
  }

  /**
   * List all downloaded model files
   */
  static async listDownloadedModels(): Promise<string[]> {
    try {
      const exists = await RNFS.exists(this.modelDir);
      if (!exists) {
        await this.initialize();
        return [];
      }

      const files = await RNFS.readDir(this.modelDir);
      return files
        .filter(file => file.isFile() && isValidModelPath(file.name))
        .map(file => file.name);
    } catch (error) {
      console.error('Failed to list models:', error);
      return [];
    }
  }

  /**
   * Delete a model file
   */
  static async deleteModel(filename: string): Promise<void> {
    try {
      const path = this.getModelPath(filename);
      const exists = await RNFS.exists(path);
      if (exists) {
        await RNFS.unlink(path);
        console.log('Model deleted:', filename);
      }
    } catch (error) {
      console.error('Failed to delete model:', error);
      throw error;
    }
  }

  /**
   * Download model from URL with progress tracking
   */
  static async downloadModel(
    url: string,
    filename: string,
    onProgress?: (progress: DownloadStatus) => void,
  ): Promise<string> {
    const downloadPath = this.getModelPath(filename);

    try {
      // Check if file already exists
      const exists = await this.modelExists(filename);
      if (exists) {
        console.log('Model already downloaded:', filename);
        return downloadPath;
      }

      // Check available space (rough estimate)
      const hasSpace = await this.hasEnoughSpace(2 * 1024 * 1024 * 1024); // 2GB estimate
      if (!hasSpace) {
        throw new Error('Insufficient storage space');
      }

      console.log('Starting download:', url);
      console.log('Saving to:', downloadPath);

      const download = RNFS.downloadFile({
        fromUrl: url,
        toFile: downloadPath,
        progress: res => {
          const progress = (res.bytesWritten / res.contentLength) * 100;
          onProgress?.({
            modelId: filename,
            progress,
            bytesDownloaded: res.bytesWritten,
            totalBytes: res.contentLength,
            status: 'downloading',
          });
        },
        progressInterval: 1000, // Update every second
      });

      const result = await download.promise;

      if (result.statusCode === 200) {
        console.log('Download completed:', filename);
        onProgress?.({
          modelId: filename,
          progress: 100,
          bytesDownloaded: result.bytesWritten,
          totalBytes: result.bytesWritten,
          status: 'completed',
        });
        return downloadPath;
      } else {
        throw new Error(`Download failed with status: ${result.statusCode}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      // Clean up partial download
      try {
        const exists = await RNFS.exists(downloadPath);
        if (exists) {
          await RNFS.unlink(downloadPath);
        }
      } catch (cleanupError) {
        console.error('Failed to clean up partial download:', cleanupError);
      }

      onProgress?.({
        modelId: filename,
        progress: 0,
        bytesDownloaded: 0,
        totalBytes: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get Hugging Face direct download URL
   * Format: https://huggingface.co/{repo}/resolve/main/{filename}
   */
  static getHuggingFaceDownloadUrl(repo: string, filename: string): string {
    return `https://huggingface.co/${repo}/resolve/main/${filename}`;
  }

  /**
   * Copy model from external location (e.g., user-selected file)
   */
  static async copyModelToStorage(
    sourcePath: string,
    filename: string,
  ): Promise<string> {
    try {
      const destPath = this.getModelPath(filename);

      // Check if file already exists
      const exists = await this.modelExists(filename);
      if (exists) {
        console.log('Model already exists, skipping copy');
        return destPath;
      }

      await RNFS.copyFile(sourcePath, destPath);
      console.log('Model copied to storage:', filename);
      return destPath;
    } catch (error) {
      console.error('Failed to copy model:', error);
      throw error;
    }
  }
}
