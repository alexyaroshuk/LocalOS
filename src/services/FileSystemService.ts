/**
 * FileSystemService - Handle file read/write operations
 * Tested on iOS with proper permission handling
 */

import RNFS from 'react-native-fs';
import {Platform} from 'react-native';
import {Logger} from '../utils/Logger';

export interface FileOperationResult {
  success: boolean;
  path: string;
  content?: string;
  size?: number;
  error?: string;
  timestamp?: string;
}

export interface DeviceFile {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: Date;
}

export class FileSystemService {
  private static selectedBasePath: string | null = null;

  /**
   * Get the Documents directory path (app-specific)
   * iOS: Uses app's Documents folder (no permissions needed)
   * Android: Uses app's Documents folder
   */
  static getDocumentsPath(): string {
    return RNFS.DocumentDirectoryPath;
  }

  /**
   * Set a custom base path for file operations
   * Allows reading/writing outside app's Documents folder
   * Called after user selects a folder via DocumentPicker
   */
  static setBasePath(path: string): void {
    this.selectedBasePath = path;
    Logger.info(`Base path set to: ${path}`);
  }

  /**
   * Clear the custom base path and return to app Documents
   */
  static clearBasePath(): void {
    this.selectedBasePath = null;
    Logger.info('Base path cleared, using app Documents');
  }

  /**
   * Get the current base path (custom or default)
   */
  static getBasePath(): string {
    return this.selectedBasePath || this.getDocumentsPath();
  }

  /**
   * Get the active storage location info
   */
  static getStorageInfo(): {
    type: 'app' | 'device';
    path: string;
    platform: string;
  } {
    return {
      type: this.selectedBasePath ? 'device' : 'app',
      path: this.getBasePath(),
      platform: Platform.OS,
    };
  }

  /**
   * Create a file (uses base path - Documents or selected device folder)
   */
  static async createFile(
    filename: string,
    content: string,
  ): Promise<FileOperationResult> {
    try {
      const basePath = this.getBasePath();
      const filePath = `${basePath}/${filename}`;

      Logger.info(`Creating test file: ${filePath}`);

      // Write file
      await RNFS.writeFile(filePath, content, 'utf8');

      // Verify by reading stats
      const stat = await RNFS.stat(filePath);

      Logger.info(`✅ File created successfully: ${filePath}`);

      return {
        success: true,
        path: filePath,
        size: Number(stat.size),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error('Failed to create test file:', errorMsg);

      return {
        success: false,
        path: '',
        error: errorMsg,
      };
    }
  }

  /**
   * Backwards compatibility - alias for createFile
   */
  static async createTestFile(
    filename: string,
    content: string,
  ): Promise<FileOperationResult> {
    return this.createFile(filename, content);
  }

  /**
   * Read a file (uses base path - Documents or selected device folder)
   */
  static async readFile(filename: string): Promise<FileOperationResult> {
    try {
      const basePath = this.getBasePath();
      const filePath = `${basePath}/${filename}`;

      Logger.info(`Reading file: ${filePath}`);

      // Check if file exists
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return {
          success: false,
          path: filePath,
          error: `File not found: ${filename}`,
        };
      }

      // Read file
      const content = await RNFS.readFile(filePath, 'utf8');
      const stat = await RNFS.stat(filePath);

      Logger.info(`✅ File read successfully: ${filePath}`);

      return {
        success: true,
        path: filePath,
        content,
        size: Number(stat.size),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error('Failed to read test file:', errorMsg);

      return {
        success: false,
        path: '',
        error: errorMsg,
      };
    }
  }

  /**
   * Backwards compatibility - alias for readFile
   */
  static async readTestFile(filename: string): Promise<FileOperationResult> {
    return this.readFile(filename);
  }

  /**
   * Append content to an existing file
   */
  static async appendToFile(
    filename: string,
    content: string,
  ): Promise<FileOperationResult> {
    try {
      const basePath = this.getBasePath();
      const filePath = `${basePath}/${filename}`;

      Logger.info(`Appending to file: ${filePath}`);

      // Read existing content
      const existing = await RNFS.readFile(filePath, 'utf8');

      // Append new content
      const updated = `${existing}\n\n${content}`;
      await RNFS.writeFile(filePath, updated, 'utf8');

      const stat = await RNFS.stat(filePath);

      Logger.info(`✅ Content appended successfully`);

      return {
        success: true,
        path: filePath,
        size: Number(stat.size),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error('Failed to append to file:', errorMsg);

      return {
        success: false,
        path: '',
        error: errorMsg,
      };
    }
  }

  /**
   * Delete a file
   */
  static async deleteFile(filename: string): Promise<FileOperationResult> {
    try {
      const basePath = this.getBasePath();
      const filePath = `${basePath}/${filename}`;

      Logger.info(`Deleting file: ${filePath}`);

      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return {
          success: false,
          path: filePath,
          error: 'File does not exist',
        };
      }

      await RNFS.unlink(filePath);

      Logger.info(`✅ File deleted successfully`);

      return {
        success: true,
        path: filePath,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error('Failed to delete file:', errorMsg);

      return {
        success: false,
        path: '',
        error: errorMsg,
      };
    }
  }

  /**
   * List all files in current base path
   */
  static async listFiles(): Promise<{success: boolean; files?: string[]; error?: string}> {
    try {
      const basePath = this.getBasePath();

      Logger.info(`Listing files in: ${basePath}`);

      const items = await RNFS.readDir(basePath);

      // Filter for files only (not directories)
      const files = items
        .filter(item => item.isFile())
        .map(item => item.name)
        .sort();

      Logger.info(`✅ Found ${files.length} files`);

      return {
        success: true,
        files,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error('Failed to list files:', errorMsg);

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * List directory contents with details (files and folders)
   */
  static async listDirectory(
    dirPath?: string,
  ): Promise<{success: boolean; items?: DeviceFile[]; error?: string}> {
    try {
      const fullPath = dirPath || this.getBasePath();

      Logger.info(`Listing directory: ${fullPath}`);

      // Check if path exists
      const exists = await RNFS.exists(fullPath);
      if (!exists) {
        return {
          success: false,
          error: `Directory not found: ${fullPath}`,
        };
      }

      const items = await RNFS.readDir(fullPath);

      const deviceFiles: DeviceFile[] = items
        .map(item => ({
          name: item.name,
          path: item.path,
          isDirectory: item.isDirectory(),
          size: item.size ? Number(item.size) : undefined,
          modified: item.mtime ? new Date(item.mtime) : undefined,
        }))
        .sort((a, b) => {
          // Directories first, then files
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

      Logger.info(`✅ Found ${deviceFiles.length} items in directory`);

      return {
        success: true,
        items: deviceFiles,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error('Failed to list directory:', errorMsg);

      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Read a file from an absolute path (not restricted to base path)
   * Useful for accessing files anywhere on the device
   */
  static async readFileFromPath(filePath: string): Promise<FileOperationResult> {
    try {
      Logger.info(`Reading file from path: ${filePath}`);

      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return {
          success: false,
          path: filePath,
          error: `File not found: ${filePath}`,
        };
      }

      const content = await RNFS.readFile(filePath, 'utf8');
      const stat = await RNFS.stat(filePath);

      Logger.info(`✅ File read successfully: ${filePath}`);

      return {
        success: true,
        path: filePath,
        content,
        size: Number(stat.size),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error('Failed to read file from path:', errorMsg);

      return {
        success: false,
        path: filePath,
        error: errorMsg,
      };
    }
  }

  /**
   * Write a file to an absolute path (not restricted to base path)
   * Useful for writing files anywhere on the device
   */
  static async writeFileToPath(
    filePath: string,
    content: string,
  ): Promise<FileOperationResult> {
    try {
      Logger.info(`Writing file to path: ${filePath}`);

      // Ensure parent directory exists
      const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
      const dirExists = await RNFS.exists(dirPath);
      if (!dirExists) {
        await RNFS.mkdir(dirPath);
      }

      // Write file
      await RNFS.writeFile(filePath, content, 'utf8');
      const stat = await RNFS.stat(filePath);

      Logger.info(`✅ File written successfully: ${filePath}`);

      return {
        success: true,
        path: filePath,
        size: Number(stat.size),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      Logger.error('Failed to write file to path:', errorMsg);

      return {
        success: false,
        path: filePath,
        error: errorMsg,
      };
    }
  }

  /**
   * Get platform and storage info
   */
  static getPlatformInfo(): {
    platform: string;
    documentsPath: string;
    currentBasePath: string;
    storageType: 'app' | 'device';
    appCanWrite: boolean;
  } {
    return {
      platform: Platform.OS,
      documentsPath: this.getDocumentsPath(),
      currentBasePath: this.getBasePath(),
      storageType: this.selectedBasePath ? 'device' : 'app',
      appCanWrite: true,
    };
  }
}
