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

export class FileSystemService {
  /**
   * Get the Documents directory path
   * iOS: Uses app's Documents folder (no permissions needed)
   * Android: Uses app's Documents folder
   */
  static getDocumentsPath(): string {
    return RNFS.DocumentDirectoryPath;
  }

  /**
   * Create a test file in Documents directory
   */
  static async createTestFile(
    filename: string,
    content: string,
  ): Promise<FileOperationResult> {
    try {
      const documentsPath = this.getDocumentsPath();
      const filePath = `${documentsPath}/${filename}`;

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
   * Read a test file from Documents directory
   */
  static async readTestFile(filename: string): Promise<FileOperationResult> {
    try {
      const documentsPath = this.getDocumentsPath();
      const filePath = `${documentsPath}/${filename}`;

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
   * Append content to an existing file
   */
  static async appendToFile(
    filename: string,
    content: string,
  ): Promise<FileOperationResult> {
    try {
      const documentsPath = this.getDocumentsPath();
      const filePath = `${documentsPath}/${filename}`;

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
   * Delete a test file
   */
  static async deleteFile(filename: string): Promise<FileOperationResult> {
    try {
      const documentsPath = this.getDocumentsPath();
      const filePath = `${documentsPath}/${filename}`;

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
   * List all files in Documents directory
   */
  static async listFiles(): Promise<{success: boolean; files?: string[]; error?: string}> {
    try {
      const documentsPath = this.getDocumentsPath();

      Logger.info(`Listing files in: ${documentsPath}`);

      const items = await RNFS.readDir(documentsPath);

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
   * Get platform and storage info
   */
  static getPlatformInfo(): {
    platform: string;
    documentsPath: string;
    appCanWrite: boolean;
  } {
    return {
      platform: Platform.OS,
      documentsPath: this.getDocumentsPath(),
      appCanWrite: true, // App has full access to Documents directory
    };
  }
}
