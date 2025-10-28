/**
 * VaultService - Manages Obsidian vault operations
 * Handles vault selection, scanning, and reading markdown files
 */

import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import {
  VaultFile,
  VaultFolder,
  VaultConfig,
  VaultScanResult,
  MarkdownFile,
} from '../types/vault';
import {Logger} from '../utils/Logger';

const VAULT_CONFIG_KEY = '@vault_config';

export class VaultService {
  private static activeVaultPath: string | null = null;

  /**
   * Initialize the vault service and load saved vault config
   */
  static async initialize(): Promise<void> {
    try {
      const config = await this.getVaultConfig();
      if (config) {
        this.activeVaultPath = config.vaultPath;
        Logger.info(`Vault service initialized with vault: ${config.vaultName}`);
      } else {
        Logger.info('No vault configured yet');
      }
    } catch (error) {
      Logger.error('Failed to initialize vault service:', error);
    }
  }

  /**
   * List all folders from multiple storage locations
   * These are potential vaults that users can select
   */
  static async listAvailableFolders(): Promise<VaultFolder[]> {
    try {
      const folders: VaultFolder[] = [];

      // Define paths to search based on platform
      const searchPaths: string[] = [RNFS.DocumentDirectoryPath];

      if (Platform.OS === 'android') {
        // Add Android public storage locations
        searchPaths.push(
          RNFS.ExternalStorageDirectoryPath, // /sdcard/ (internal storage root)
          RNFS.DownloadDirectoryPath,        // /sdcard/Download/
        );

        Logger.info('Scanning Android storage locations:', searchPaths);
      }

      // Scan each path
      for (const basePath of searchPaths) {
        try {
          const exists = await RNFS.exists(basePath);
          if (!exists) {
            Logger.warn(`Path does not exist: ${basePath}`);
            continue;
          }

          const items = await RNFS.readDir(basePath);

          for (const item of items) {
            if (item.isDirectory()) {
              // Skip hidden folders and system folders
              if (item.name.startsWith('.') || item.name === 'Android') {
                continue;
              }

              try {
                // Count files and subfolders
                const contents = await RNFS.readDir(item.path);
                const fileCount = contents.filter(f => f.isFile()).length;
                const folderCount = contents.filter(f => f.isDirectory()).length;

                folders.push({
                  path: item.path,
                  relativePath: item.path.replace(basePath + '/', ''),
                  name: item.name,
                  parent: basePath,
                  fileCount,
                  folderCount,
                });
              } catch (readError) {
                // Skip folders we can't read (permissions)
                Logger.warn(`Cannot read folder ${item.path}:`, readError);
              }
            }
          }
        } catch (pathError) {
          Logger.warn(`Error scanning path ${basePath}:`, pathError);
        }
      }

      Logger.info(`Found ${folders.length} folders across all storage locations`);
      return folders;
    } catch (error) {
      Logger.error('Failed to list available folders:', error);
      throw error;
    }
  }

  /**
   * Set the active vault and save to AsyncStorage
   */
  static async setActiveVault(vaultPath: string): Promise<void> {
    try {
      // Verify the path exists
      const exists = await RNFS.exists(vaultPath);
      if (!exists) {
        throw new Error(`Vault path does not exist: ${vaultPath}`);
      }

      const stat = await RNFS.stat(vaultPath);
      if (!stat.isDirectory()) {
        throw new Error(`Vault path is not a directory: ${vaultPath}`);
      }

      // Extract vault name from path
      const vaultName = vaultPath.split('/').pop() || 'Unknown';

      // Count markdown files
      const scanResult = await this.scanVault(vaultPath);

      const config: VaultConfig = {
        vaultPath,
        vaultName,
        configuredAt: new Date().toISOString(),
        lastScanned: new Date().toISOString(),
        fileCount: scanResult.totalFiles,
      };

      await AsyncStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(config));
      this.activeVaultPath = vaultPath;

      Logger.info(`Vault configured: ${vaultName} (${scanResult.totalFiles} files)`);
    } catch (error) {
      Logger.error('Failed to set active vault:', error);
      throw error;
    }
  }

  /**
   * Get the current vault configuration
   */
  static async getVaultConfig(): Promise<VaultConfig | null> {
    try {
      const json = await AsyncStorage.getItem(VAULT_CONFIG_KEY);
      if (!json) {
        return null;
      }
      return JSON.parse(json) as VaultConfig;
    } catch (error) {
      Logger.error('Failed to get vault config:', error);
      return null;
    }
  }

  /**
   * Clear the active vault configuration
   */
  static async clearVault(): Promise<void> {
    try {
      await AsyncStorage.removeItem(VAULT_CONFIG_KEY);
      this.activeVaultPath = null;
      Logger.info('Vault configuration cleared');
    } catch (error) {
      Logger.error('Failed to clear vault:', error);
      throw error;
    }
  }

  /**
   * Scan a vault directory recursively for all markdown files
   */
  static async scanVault(vaultPath: string): Promise<VaultScanResult> {
    const startTime = Date.now();
    const files: VaultFile[] = [];
    const folders: VaultFolder[] = [];
    const errors: string[] = [];

    try {
      await this.scanDirectoryRecursive(
        vaultPath,
        vaultPath,
        files,
        folders,
        errors,
      );

      const scanDuration = Date.now() - startTime;
      Logger.info(
        `Vault scan complete: ${files.length} files, ${folders.length} folders in ${scanDuration}ms`,
      );

      return {
        files,
        folders,
        totalFiles: files.length,
        totalFolders: folders.length,
        scanDuration,
        errors,
      };
    } catch (error) {
      Logger.error('Failed to scan vault:', error);
      throw error;
    }
  }

  /**
   * Recursively scan a directory for files and folders
   */
  private static async scanDirectoryRecursive(
    dirPath: string,
    vaultRoot: string,
    files: VaultFile[],
    folders: VaultFolder[],
    errors: string[],
  ): Promise<void> {
    try {
      const items = await RNFS.readDir(dirPath);

      // Count files and folders in this directory
      let fileCount = 0;
      let folderCount = 0;

      for (const item of items) {
        try {
          if (item.isDirectory()) {
            // Skip hidden folders (start with .)
            if (item.name.startsWith('.')) {
              continue;
            }

            folderCount++;

            // Calculate relative path properly
            const relativePath = item.path.replace(vaultRoot, '').replace(/^\//, '');

            folders.push({
              path: item.path,
              relativePath: relativePath || item.name,
              name: item.name,
              parent: dirPath,
              fileCount: 0, // Will be updated after scanning
              folderCount: 0,
            });

            // Recursively scan subfolder
            await this.scanDirectoryRecursive(
              item.path,
              vaultRoot,
              files,
              folders,
              errors,
            );
          } else if (item.isFile()) {
            fileCount++;

            // Only include markdown files
            if (item.name.endsWith('.md')) {
              const basename = item.name.replace(/\.md$/i, '');
              const relativePath = item.path.replace(vaultRoot, '').replace(/^\//, '');

              files.push({
                path: item.path,
                relativePath: relativePath || item.name,
                name: item.name,
                basename,
                folder: dirPath,
                size: Number(item.size),
                mtime: item.mtime ? new Date(item.mtime) : new Date(),
                isMarkdown: true,
              });
            }
          }
        } catch (itemError) {
          const errorMsg = `Error processing ${item.path}: ${itemError}`;
          errors.push(errorMsg);
          Logger.error(errorMsg);
        }
      }

      // Update the folder counts
      const folderIndex = folders.findIndex(f => f.path === dirPath);
      if (folderIndex >= 0) {
        folders[folderIndex].fileCount = fileCount;
        folders[folderIndex].folderCount = folderCount;
      }
    } catch (error) {
      const errorMsg = `Error scanning directory ${dirPath}: ${error}`;
      errors.push(errorMsg);
      Logger.error(errorMsg, error);
      throw error; // Re-throw to ensure scanning stops on critical errors
    }
  }

  /**
   * Read a markdown file and parse its content
   */
  static async readMarkdownFile(filePath: string): Promise<MarkdownFile> {
    try {
      const content = await RNFS.readFile(filePath, 'utf8');
      const stat = await RNFS.stat(filePath);

      // Parse frontmatter and content
      const {frontmatter, content: markdownContent} =
        this.parseFrontmatter(content);

      // Extract tags from frontmatter and inline
      const tags = this.extractTags(frontmatter, markdownContent);

      // Extract wiki-style links
      const links = this.extractLinks(markdownContent);

      const fileName = filePath.split('/').pop() || '';
      const basename = fileName.replace(/\.md$/i, '');
      const folder = filePath.substring(0, filePath.lastIndexOf('/'));

      const vaultRoot = this.activeVaultPath || RNFS.DocumentDirectoryPath;
      const relativePath = filePath.replace(vaultRoot + '/', '');

      return {
        file: {
          path: filePath,
          relativePath,
          name: fileName,
          basename,
          folder,
          size: Number(stat.size),
          mtime: new Date(stat.mtime),
          isMarkdown: true,
        },
        content: markdownContent,
        frontmatter,
        tags,
        links,
      };
    } catch (error) {
      Logger.error('Failed to read markdown file:', error);
      throw error;
    }
  }

  /**
   * Parse YAML frontmatter from markdown content
   */
  static parseFrontmatter(content: string): {
    frontmatter: Record<string, any>;
    content: string;
  } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return {frontmatter: {}, content};
    }

    const yamlContent = match[1];
    const markdownContent = match[2];

    // Simple YAML parser (handles basic key: value pairs)
    const frontmatter: Record<string, any> = {};
    const lines = yamlContent.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        let value: any = line.substring(colonIndex + 1).trim();

        // Remove quotes
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        // Handle arrays (tags: [tag1, tag2])
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value
            .slice(1, -1)
            .split(',')
            .map((v: string) => v.trim().replace(/['"]/g, ''))
            .filter((v: string) => v.length > 0);
        }

        frontmatter[key] = value;
      }
    }

    return {frontmatter, content: markdownContent};
  }

  /**
   * Extract tags from frontmatter and inline #tags
   */
  private static extractTags(
    frontmatter: Record<string, any>,
    content: string,
  ): string[] {
    const tags = new Set<string>();

    // Get tags from frontmatter
    if (frontmatter.tags) {
      if (Array.isArray(frontmatter.tags)) {
        frontmatter.tags.forEach(tag => tags.add(tag));
      } else if (typeof frontmatter.tags === 'string') {
        tags.add(frontmatter.tags);
      }
    }

    // Extract inline #tags
    const inlineTagRegex = /#([a-zA-Z0-9_-]+)/g;
    let match;
    while ((match = inlineTagRegex.exec(content)) !== null) {
      tags.add(match[1]);
    }

    return Array.from(tags);
  }

  /**
   * Extract wiki-style [[links]] from content
   */
  private static extractLinks(content: string): string[] {
    const links: string[] = [];
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      links.push(match[1]);
    }

    return links;
  }

  /**
   * Get the active vault path
   */
  static getActiveVaultPath(): string | null {
    return this.activeVaultPath;
  }

  /**
   * Check if a vault is configured
   */
  static async hasVault(): Promise<boolean> {
    const config = await this.getVaultConfig();
    return config !== null;
  }

  /**
   * Debug: List raw contents of a directory
   */
  static async debugListDirectory(dirPath: string): Promise<any[]> {
    try {
      // Check if directory exists first
      const exists = await RNFS.exists(dirPath);
      Logger.info(`Debug: Path exists? ${exists}`);

      // Try to get stats
      try {
        const stat = await RNFS.stat(dirPath);
        Logger.info(`Debug: Path stats: ${JSON.stringify(stat)}`);
      } catch (statError) {
        Logger.error('Debug: Failed to stat path:', statError);
      }

      // Try readDir
      Logger.info(`Debug: Calling RNFS.readDir on ${dirPath}`);
      const items = await RNFS.readDir(dirPath);
      Logger.info(`Debug: RNFS.readDir returned ${items.length} items`);
      Logger.info(`Debug: Raw items array: ${JSON.stringify(items)}`);

      const itemDetails = items.map(item => ({
        name: item.name,
        path: item.path,
        size: item.size,
        isDirectory: item.isDirectory(),
        isFile: item.isFile(),
        mtime: item.mtime,
      }));

      itemDetails.forEach(item => {
        Logger.info(`Debug item: ${JSON.stringify(item)}`);
      });

      // Try readDirAssets as alternative (if it exists)
      try {
        Logger.info('Debug: Trying readdir (lowercase) if available');
        const altItems = await (RNFS as any).readdir(dirPath);
        Logger.info(`Debug: readdir returned: ${JSON.stringify(altItems)}`);
      } catch (altError) {
        Logger.info('Debug: readdir not available or failed');
      }

      return itemDetails;
    } catch (error) {
      Logger.error('Debug: Failed to list directory:', error);
      throw error;
    }
  }

  /**
   * Ensure a directory path exists, creating it if necessary
   */
  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      const exists = await RNFS.exists(dirPath);
      if (!exists) {
        await RNFS.mkdir(dirPath, {
          // Create parent directories if they don't exist
          NSURLIsExcludedFromBackupKey: false,
        });
        Logger.info(`Created directory: ${dirPath}`);
      }
    } catch (error) {
      Logger.error('Failed to ensure directory exists:', error);
      throw error;
    }
  }

  /**
   * Write a markdown file to the vault
   * Creates parent directories if they don't exist
   */
  static async writeFile(
    relativePath: string,
    content: string,
  ): Promise<VaultFile> {
    try {
      const config = await this.getVaultConfig();
      if (!config) {
        throw new Error('No vault configured');
      }

      // Construct full path
      const fullPath = `${config.vaultPath}/${relativePath}`;

      // Ensure the file ends with .md
      const finalPath = fullPath.endsWith('.md') ? fullPath : `${fullPath}.md`;

      // Ensure parent directory exists
      const dirPath = finalPath.substring(0, finalPath.lastIndexOf('/'));
      await this.ensureDirectoryExists(dirPath);

      // Write file
      await RNFS.writeFile(finalPath, content, 'utf8');
      Logger.info(`Wrote file: ${finalPath}`);

      // Get file stats
      const stat = await RNFS.stat(finalPath);
      const fileName = finalPath.split('/').pop() || '';
      const basename = fileName.replace(/\.md$/i, '');

      const vaultFile: VaultFile = {
        path: finalPath,
        relativePath: relativePath.endsWith('.md') ? relativePath : `${relativePath}.md`,
        name: fileName,
        basename,
        folder: dirPath,
        size: Number(stat.size),
        mtime: new Date(stat.mtime),
        isMarkdown: true,
      };

      return vaultFile;
    } catch (error) {
      Logger.error('Failed to write file:', error);
      throw error;
    }
  }

  /**
   * Update an existing file in the vault
   */
  static async updateFile(
    relativePath: string,
    content: string,
  ): Promise<VaultFile> {
    try {
      const config = await this.getVaultConfig();
      if (!config) {
        throw new Error('No vault configured');
      }

      // Construct full path
      const fullPath = `${config.vaultPath}/${relativePath}`;

      // Check if file exists
      const exists = await RNFS.exists(fullPath);
      if (!exists) {
        throw new Error(`File does not exist: ${relativePath}`);
      }

      // Write file
      await RNFS.writeFile(fullPath, content, 'utf8');
      Logger.info(`Updated file: ${fullPath}`);

      // Get file stats
      const stat = await RNFS.stat(fullPath);
      const fileName = fullPath.split('/').pop() || '';
      const basename = fileName.replace(/\.md$/i, '');
      const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));

      const vaultFile: VaultFile = {
        path: fullPath,
        relativePath,
        name: fileName,
        basename,
        folder: dirPath,
        size: Number(stat.size),
        mtime: new Date(stat.mtime),
        isMarkdown: true,
      };

      return vaultFile;
    } catch (error) {
      Logger.error('Failed to update file:', error);
      throw error;
    }
  }
}
