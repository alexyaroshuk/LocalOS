/**
 * Types for Obsidian vault management
 */

/**
 * Represents a file in the vault
 */
export interface VaultFile {
  /** Full path to the file */
  path: string;
  /** Relative path from vault root */
  relativePath: string;
  /** File name with extension */
  name: string;
  /** File name without extension */
  basename: string;
  /** Parent folder path */
  folder: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  mtime: Date;
  /** Whether this is a markdown file */
  isMarkdown: boolean;
}

/**
 * Represents a folder in the vault
 */
export interface VaultFolder {
  /** Full path to the folder */
  path: string;
  /** Relative path from vault root */
  relativePath: string;
  /** Folder name */
  name: string;
  /** Parent folder path */
  parent: string;
  /** Number of files in this folder (non-recursive) */
  fileCount: number;
  /** Number of subfolders */
  folderCount: number;
}

/**
 * Parsed markdown file with metadata
 */
export interface MarkdownFile {
  /** File metadata */
  file: VaultFile;
  /** Raw markdown content (without frontmatter) */
  content: string;
  /** Parsed frontmatter metadata */
  frontmatter: Record<string, any>;
  /** Tags from frontmatter and inline */
  tags: string[];
  /** Wiki-style links found in content */
  links: string[];
}

/**
 * Vault configuration stored in AsyncStorage
 */
export interface VaultConfig {
  /** Path to the active vault folder */
  vaultPath: string;
  /** Vault name (derived from folder name) */
  vaultName: string;
  /** When the vault was first configured */
  configuredAt: string;
  /** Last time vault was scanned */
  lastScanned?: string;
  /** Number of markdown files in vault */
  fileCount?: number;
}

/**
 * Result of scanning a vault
 */
export interface VaultScanResult {
  /** All markdown files found */
  files: VaultFile[];
  /** All folders found */
  folders: VaultFolder[];
  /** Total markdown files */
  totalFiles: number;
  /** Total folders */
  totalFolders: number;
  /** Scan duration in milliseconds */
  scanDuration: number;
  /** Any errors encountered during scan */
  errors: string[];
}
