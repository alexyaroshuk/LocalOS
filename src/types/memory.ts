/**
 * Type definitions for the Memory System
 */

export interface Memory {
  id: string;
  content: string;
  title?: string;
  filePath: string;
  tags: string[];
  metadata: Record<string, any>;
  chunkIndex?: number;
  similarity?: number; // For search results
  createdAt: number;
  updatedAt: number;
}

export interface MemoryMetadata {
  title?: string;
  tags?: string[];
  folder?: string;
  links?: string[];
  [key: string]: any;
}

export interface MarkdownNote {
  path: string;
  frontmatter: Record<string, any>;
  content: string;
  links: string[];
  tags: string[];
}

export interface SearchResult {
  memory: Memory;
  similarity: number;
  highlights?: string[];
}

export interface VaultStats {
  totalNotes: number;
  totalMemories: number;
  totalTags: number;
  vaultPath: string | null;
  lastIndexed: number | null;
}
