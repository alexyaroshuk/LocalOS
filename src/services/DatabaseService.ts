/**
 * SQLite Database Service for LocalOS Memory System
 * Implements schema from docs/database-schema.md
 */

import {open} from '@op-engineering/op-sqlite';
import type {
  CoreMemoryBlock,
  ArchiveMemory,
  Task,
  ConversationSummary,
} from './MockDatabaseService';

// React Native compatible base64 encoding/decoding
// Simple implementation without external dependencies
const btoa = (str: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';

  for (let i = 0; i < str.length; i += 3) {
    const byte1 = str.charCodeAt(i);
    const byte2 = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
    const byte3 = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;

    const enc1 = byte1 >> 2;
    const enc2 = ((byte1 & 3) << 4) | (byte2 >> 4);
    const enc3 = ((byte2 & 15) << 2) | (byte3 >> 6);
    const enc4 = byte3 & 63;

    if (i + 1 >= str.length) {
      output += chars.charAt(enc1) + chars.charAt(enc2) + '==';
    } else if (i + 2 >= str.length) {
      output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + '=';
    } else {
      output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
    }
  }

  return output;
};

const atob = (str: string): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';

  str = str.replace(/=+$/, '');

  for (let i = 0; i < str.length; i += 4) {
    const enc1 = chars.indexOf(str.charAt(i));
    const enc2 = chars.indexOf(str.charAt(i + 1));
    const enc3 = chars.indexOf(str.charAt(i + 2));
    const enc4 = chars.indexOf(str.charAt(i + 3));

    const byte1 = (enc1 << 2) | (enc2 >> 4);
    const byte2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const byte3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(byte1);
    if (enc3 !== 64) output += String.fromCharCode(byte2);
    if (enc4 !== 64) output += String.fromCharCode(byte3);
  }

  return output;
};

// Re-export types for external use
export type {
  CoreMemoryBlock,
  ArchiveMemory,
  Task,
  ConversationSummary,
};

/**
 * Database Service - SQLite implementation
 */
export class DatabaseService {
  private static db: any = null;
  private static initialized: boolean = false;

  /**
   * Initialize database and create tables
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[Database] Initializing SQLite database...');

    try {
      // Open database (uses default location)
      this.db = open({
        name: 'localos.db',
      });

      console.log('[Database] Database opened successfully');

      // Create tables
      await this.createTables();

      // Run migrations
      await this.runMigrations();

      // Initialize with default data if empty
      await this.initializeDefaultData();

      this.initialized = true;
      console.log('[Database] Database initialized successfully');
    } catch (error) {
      console.error('[Database] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Create all tables and indices
   */
  private static async createTables(): Promise<void> {
    console.log('[Database] Creating tables...');

    // Schema version table
    this.db.executeSync(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);

    // Insert initial version
    const versionResult = this.db.executeSync('SELECT version FROM schema_version LIMIT 1;');
    if (versionResult.rows?.length === 0) {
      this.db.executeSync('INSERT INTO schema_version (version, applied_at) VALUES (1, ?);', [Date.now()]);
    }

    // Core memory table
    this.db.executeSync(`
      CREATE TABLE IF NOT EXISTS core_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_name TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        last_updated INTEGER NOT NULL,
        CHECK (block_name IN ('user_profile', 'conversation_style', 'current_focus', 'relationship_context'))
      );
    `);

    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_core_memory_block_name ON core_memory(block_name);');

    // Archive memories table
    this.db.executeSync(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        importance INTEGER NOT NULL DEFAULT 5,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        metadata TEXT,
        embedding TEXT,
        CHECK (category IN ('fact', 'event', 'preference', 'conversation')),
        CHECK (importance >= 1 AND importance <= 10)
      );
    `);

    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);');

    // Try to create FTS5 virtual table (may not be available on all platforms)
    try {
      this.db.executeSync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
          content,
          content=memories,
          content_rowid=id
        );
      `);

      // Triggers to keep FTS index in sync
      this.db.executeSync(`
        CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
          INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
        END;
      `);

      this.db.executeSync(`
        CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
          DELETE FROM memories_fts WHERE rowid = old.id;
        END;
      `);

      this.db.executeSync(`
        CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
          UPDATE memories_fts SET content = new.content WHERE rowid = old.id;
        END;
      `);

      console.log('[Database] FTS5 full-text search enabled');
    } catch (ftsError) {
      console.warn('[Database] FTS5 not available, using LIKE search fallback');
    }

    // Tasks table
    this.db.executeSync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        due_date INTEGER,
        recurrence_rule TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        completed_at INTEGER,
        CHECK (status IN ('pending', 'completed', 'cancelled')),
        CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('daily', 'weekly', 'monthly'))
      );
    `);

    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_tasks_status_due_date ON tasks(status, due_date);');

    // Conversations table
    this.db.executeSync(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        summary TEXT NOT NULL,
        key_points TEXT,
        date INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        CHECK (message_count >= 0)
      );
    `);

    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_conversations_date ON conversations(date DESC);');

    // ============== KNOWLEDGE SYSTEM TABLES ==============
    // Flexible, Obsidian-style knowledge management

    // Folders table - stores folder paths and optional schemas
    this.db.executeSync(`
      CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        schema TEXT,
        created_at INTEGER NOT NULL
      );
    `);

    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);');

    // Knowledge entries table - replaces rigid "memories" with flexible entries
    this.db.executeSync(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_path TEXT NOT NULL,
        name TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        properties TEXT,
        embedding TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        FOREIGN KEY (folder_path) REFERENCES folders(path) ON DELETE CASCADE
      );
    `);

    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_knowledge_folder_path ON knowledge(folder_path);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_knowledge_name ON knowledge(name);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_knowledge_created_at ON knowledge(created_at DESC);');

    // FTS5 for knowledge full-text search
    try {
      this.db.executeSync(`
        CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
          content,
          content=knowledge,
          content_rowid=id
        );
      `);

      // Triggers to keep FTS index in sync
      this.db.executeSync(`
        CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge BEGIN
          INSERT INTO knowledge_fts(rowid, content) VALUES (new.id, new.content);
        END;
      `);

      this.db.executeSync(`
        CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge BEGIN
          DELETE FROM knowledge_fts WHERE rowid = old.id;
        END;
      `);

      this.db.executeSync(`
        CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON knowledge BEGIN
          UPDATE knowledge_fts SET content = new.content WHERE rowid = old.id;
        END;
      `);

      console.log('[Database] Knowledge FTS5 full-text search enabled');
    } catch {
      console.warn('[Database] Knowledge FTS5 not available, using LIKE search fallback');
    }

    // Links table - bidirectional links between knowledge entries
    this.db.executeSync(`
      CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id INTEGER NOT NULL,
        to_id INTEGER NOT NULL,
        link_text TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (from_id) REFERENCES knowledge(id) ON DELETE CASCADE,
        FOREIGN KEY (to_id) REFERENCES knowledge(id) ON DELETE CASCADE
      );
    `);

    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_links_from_id ON links(from_id);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_links_to_id ON links(to_id);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_links_both ON links(from_id, to_id);');

    console.log('[Database] Tables created successfully');
  }

  /**
   * Run database migrations
   */
  private static async runMigrations(): Promise<void> {
    const versionResult = this.db.executeSync('SELECT version FROM schema_version LIMIT 1;');
    const currentVersion = versionResult.rows?.[0]?.version || 1;

    console.log(`[Database] Current schema version: ${currentVersion}`);

    // Migration 1 -> 2: Add embedding column to memories table
    if (currentVersion < 2) {
      console.log('[Database] Running migration 1 -> 2: Adding embedding column...');
      try {
        // Check if column already exists
        const tableInfo = this.db.executeSync('PRAGMA table_info(memories);');
        const hasEmbedding = tableInfo.rows?.some((row: any) => row.name === 'embedding');

        if (!hasEmbedding) {
          this.db.executeSync('ALTER TABLE memories ADD COLUMN embedding TEXT;');
          console.log('[Database] Added embedding TEXT column to memories table');
        } else {
          console.log('[Database] Embedding column already exists');
        }

        // Update schema version
        this.db.executeSync('UPDATE schema_version SET version = 2, applied_at = ?;', [Date.now()]);
        console.log('[Database] Migration 1 -> 2 completed');
      } catch (error) {
        console.error('[Database] Migration 1 -> 2 failed:', error);
        throw error;
      }
    }

    // Migration 2 -> 3: Change embedding from BLOB to TEXT (for op-sqlite compatibility)
    if (currentVersion < 3) {
      console.log('[Database] Running migration 2 -> 3: Converting embedding to TEXT...');
      try {
        // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
        // But if the column was just added as TEXT in migration 2, we're fine
        const tableInfo = this.db.executeSync('PRAGMA table_info(memories);');
        const embeddingCol = tableInfo.rows?.find((row: any) => row.name === 'embedding');

        if (embeddingCol && embeddingCol.type === 'BLOB') {
          console.log('[Database] Recreating memories table with TEXT embedding...');

          // Create new table with TEXT embedding
          this.db.executeSync(`
            CREATE TABLE memories_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              content TEXT NOT NULL,
              category TEXT NOT NULL,
              importance INTEGER NOT NULL DEFAULT 5,
              created_at INTEGER NOT NULL,
              updated_at INTEGER,
              metadata TEXT,
              embedding TEXT,
              CHECK (category IN ('fact', 'event', 'preference', 'conversation')),
              CHECK (importance >= 1 AND importance <= 10)
            );
          `);

          // Copy non-embedding data (embeddings in BLOB format are incompatible)
          this.db.executeSync(`
            INSERT INTO memories_new (id, content, category, importance, created_at, updated_at, metadata)
            SELECT id, content, category, importance, created_at, updated_at, metadata FROM memories;
          `);

          // Drop old table
          this.db.executeSync('DROP TABLE memories;');

          // Rename new table
          this.db.executeSync('ALTER TABLE memories_new RENAME TO memories;');

          // Recreate indexes
          this.db.executeSync('CREATE INDEX idx_memories_category ON memories(category);');
          this.db.executeSync('CREATE INDEX idx_memories_importance ON memories(importance DESC);');
          this.db.executeSync('CREATE INDEX idx_memories_created_at ON memories(created_at DESC);');

          console.log('[Database] Table recreated with TEXT embedding (old BLOB embeddings dropped)');
        } else {
          console.log('[Database] Embedding is already TEXT or newly created');
        }

        // Update schema version
        this.db.executeSync('UPDATE schema_version SET version = 3, applied_at = ?;', [Date.now()]);
        console.log('[Database] Migration 2 -> 3 completed');
      } catch (error) {
        console.error('[Database] Migration 2 -> 3 failed:', error);
        throw error;
      }
    }

    console.log('[Database] All migrations completed');
  }

  /**
   * Initialize with default data
   */
  private static async initializeDefaultData(): Promise<void> {
    // Check if core memory already exists
    const result = this.db.executeSync('SELECT COUNT(*) as count FROM core_memory;');
    const count = result.rows?.[0]?.count || 0;

    if (count > 0) {
      console.log('[Database] Data already exists, skipping initialization');
      return;
    }

    console.log('[Database] Initializing default data...');
    const now = Date.now();

    // Initialize core memory blocks
    const coreMemoryBlocks = [
      {
        block_name: 'user_profile',
        content: 'New user. Learning about preferences and personality.',
        last_updated: now,
      },
      {
        block_name: 'conversation_style',
        content: 'Neutral tone. Adjusting based on user interactions.',
        last_updated: now,
      },
      {
        block_name: 'current_focus',
        content: 'Getting to know the user. No active tasks yet.',
        last_updated: now,
      },
      {
        block_name: 'relationship_context',
        content: 'New relationship. Building rapport.',
        last_updated: now,
      },
    ];

    for (const block of coreMemoryBlocks) {
      this.db.executeSync(
        'INSERT INTO core_memory (block_name, content, last_updated) VALUES (?, ?, ?);',
        [block.block_name, block.content, block.last_updated]
      );
    }

    console.log('[Database] Default data initialized');
  }

  // ============== CORE MEMORY OPERATIONS ==============

  static async getCoreMemory(): Promise<CoreMemoryBlock[]> {
    const result = await this.db.executeSync('SELECT * FROM core_memory;');
    return result.rows || [];
  }

  static async getCoreMemoryBlock(blockName: string): Promise<CoreMemoryBlock | null> {
    const result = await this.db.executeSync('SELECT * FROM core_memory WHERE block_name = ?;', [blockName]);
    return result.rows?.[0] || null;
  }

  static async updateCoreMemoryBlock(blockName: string, content: string): Promise<void> {
    this.db.executeSync(
      'UPDATE core_memory SET content = ?, last_updated = ? WHERE block_name = ?;',
      [content, Date.now(), blockName]
    );
    console.log(`[Database] Updated core memory block: ${blockName}`);
  }

  // ============== VECTOR UTILITIES ==============

  /**
   * Convert Float32Array or number[] to base64 TEXT for SQLite storage
   * NOTE: Using TEXT instead of BLOB due to op-sqlite BLOB bugs
   */
  private static vectorToBase64(vector: number[] | Float32Array): string {
    const float32Array = vector instanceof Float32Array ? vector : new Float32Array(vector);
    const uint8Array = new Uint8Array(float32Array.buffer);

    // Convert to base64
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 TEXT from SQLite to number array
   */
  private static base64ToVector(base64: string): number[] {
    if (!base64 || typeof base64 !== 'string') {
      return [];
    }

    try {
      // Decode base64 to binary string
      const binary = atob(base64);
      const len = binary.length;
      const uint8Array = new Uint8Array(len);

      for (let i = 0; i < len; i++) {
        uint8Array[i] = binary.charCodeAt(i);
      }

      // Convert to Float32Array
      const float32Array = new Float32Array(uint8Array.buffer);
      return Array.from(float32Array);
    } catch (error) {
      console.error('[Database] base64ToVector error:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * Returns value between -1 (opposite) and 1 (identical)
   */
  private static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      console.error(
        `[Database] Vector dimension mismatch: ${vecA.length}D vs ${vecB.length}D. ` +
        `This means you have embeddings from different models in your database. ` +
        `Clear your database and reload test data with the current embedding model.`
      );
      throw new Error(
        `Vectors must have same dimensions (${vecA.length}D vs ${vecB.length}D). ` +
        `Clear database and reload with current model.`
      );
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  // ============== ARCHIVE MEMORY OPERATIONS ==============

  static async saveMemory(
    content: string,
    category: ArchiveMemory['category'],
    importance: number,
    metadata?: Record<string, any>,
    embedding?: number[] | Float32Array
  ): Promise<ArchiveMemory> {
    const now = Date.now();

    let result;
    if (embedding) {
      console.log(`[Database] Saving memory WITH embedding (${embedding.length}D)...`);
      const embeddingBase64 = this.vectorToBase64(embedding);
      console.log(`[Database] Converted to base64: ${embeddingBase64.length} chars`);

      result = this.db.executeSync(
        'INSERT INTO memories (content, category, importance, created_at, metadata, embedding) VALUES (?, ?, ?, ?, ?, ?);',
        [content, category, importance, now, JSON.stringify(metadata || {}), embeddingBase64]
      );
      console.log(`[Database] Inserted with ID: ${result.insertId}`);
    } else {
      console.log(`[Database] Saving memory WITHOUT embedding...`);
      result = this.db.executeSync(
        'INSERT INTO memories (content, category, importance, created_at, metadata) VALUES (?, ?, ?, ?, ?);',
        [content, category, importance, now, JSON.stringify(metadata || {})]
      );
    }

    const insertId = result.insertId;

    // NOTE: op-sqlite has issues with BLOB columns in SELECT *
    // We need to avoid selecting the BLOB, then attach the embedding we just saved
    const selectResult = this.db.executeSync(
      'SELECT id, content, category, importance, created_at, updated_at, metadata FROM memories WHERE id = ?;',
      [insertId]
    );
    const memory = selectResult.rows?.[0];

    console.log(`[Database] Retrieved memory ${insertId} (without BLOB)`);

    // If we had an embedding, attach it back from our original data
    // (Since we just inserted it, we know what it was)
    if (embedding) {
      memory.embedding = Array.isArray(embedding) ? embedding : Array.from(embedding);
      console.log(`[Database] Attached original embedding: ${memory.embedding.length}D`);
    }

    console.log(`[Database] Saved archive memory: ${content.substring(0, 50)}...`);
    return memory;
  }

  static async searchArchive(query: string, limit: number = 5): Promise<ArchiveMemory[]> {
    // Try FTS5 first, fallback to LIKE search
    try {
      const result = this.db.executeSync(
        `
        SELECT m.* FROM memories_fts
        JOIN memories m ON memories_fts.rowid = m.id
        WHERE memories_fts MATCH ?
        ORDER BY m.importance DESC, m.created_at DESC
        LIMIT ?;
        `,
        [query, limit]
      );
      return result.rows || [];
    } catch (error) {
      // Fallback to LIKE search if FTS5 not available
      const result = this.db.executeSync(
        `
        SELECT * FROM memories
        WHERE content LIKE ?
        ORDER BY importance DESC, created_at DESC
        LIMIT ?;
        `,
        [`%${query}%`, limit]
      );
      return result.rows || [];
    }
  }

  static async getRecentMemories(limit: number = 10): Promise<ArchiveMemory[]> {
    const result = this.db.executeSync(
      'SELECT * FROM memories ORDER BY created_at DESC LIMIT ?;',
      [limit]
    );
    return result.rows || [];
  }

  static async getMemoriesByCategory(category: ArchiveMemory['category']): Promise<ArchiveMemory[]> {
    const result = this.db.executeSync('SELECT * FROM memories WHERE category = ? ORDER BY importance DESC;', [category]);
    return result.rows || [];
  }

  /**
   * Update embedding for an existing memory
   */
  static async updateMemoryEmbedding(id: number, embedding: number[] | Float32Array): Promise<void> {
    const embeddingBase64 = this.vectorToBase64(embedding);
    this.db.executeSync('UPDATE memories SET embedding = ? WHERE id = ?;', [embeddingBase64, id]);
    console.log(`[Database] Updated embedding for memory ${id}`);
  }

  /**
   * Vector similarity search
   * Finds memories most similar to the query embedding
   */
  static async searchByVector(
    queryEmbedding: number[] | Float32Array,
    limit: number = 5,
    minSimilarity: number = 0.0
  ): Promise<Array<ArchiveMemory & {similarity: number}>> {
    // Debug: Check total memories and those with embeddings
    const totalResult = this.db.executeSync('SELECT COUNT(*) as count FROM memories;');
    const totalCount = totalResult.rows?.[0]?.count || 0;
    console.log(`[Database] Total memories in DB: ${totalCount}`);

    const withEmbedResult = this.db.executeSync('SELECT COUNT(*) as count FROM memories WHERE embedding IS NOT NULL AND embedding != "";');
    const withEmbedCount = withEmbedResult.rows?.[0]?.count || 0;
    console.log(`[Database] Memories with non-empty embeddings: ${withEmbedCount}`);

    // Get all memories with embeddings
    const result = this.db.executeSync('SELECT id, content, category, importance, created_at, updated_at, metadata, embedding FROM memories WHERE embedding IS NOT NULL AND embedding != "";');
    const memories = result.rows || [];

    console.log(`[Database] Vector search: Found ${memories.length} memories with embeddings`);

    if (memories.length === 0) {
      console.log(`[Database] No memories with embeddings found`);
      return [];
    }

    // Convert query to array if needed
    const queryVector = Array.isArray(queryEmbedding) ? queryEmbedding : Array.from(queryEmbedding);
    console.log(`[Database] Query vector dimensions: ${queryVector.length}D`);

    // Calculate similarity for each memory
    const memoriesWithSimilarity = memories
      .map((memory: any, index: number) => {
        if (!memory.embedding) {
          console.warn(`[Database] Memory ${memory.id} has NULL embedding despite WHERE clause!`);
          return null;
        }

        // Convert base64 string to vector
        const embedding = this.base64ToVector(memory.embedding);

        // Debug first embedding
        if (index === 0) {
          console.log(`[Database] First memory embedding: base64 string (${memory.embedding.length} chars) -> ${embedding.length}D vector`);
        }

        if (embedding.length === 0) {
          console.error(`[Database] Memory ${memory.id} has 0D embedding after conversion!`);
          return null;
        }

        const similarity = this.cosineSimilarity(queryVector, embedding);

        // Log first few similarities for debugging
        if (index < 3) {
          console.log(`[Database] Memory ${memory.id} similarity: ${similarity.toFixed(4)}, content: "${memory.content.substring(0, 50)}..."`);
        }

        return {
          ...memory,
          embedding, // Convert to array for return
          similarity,
        };
      })
      .filter((m: any) => m !== null && m.similarity >= minSimilarity)
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, limit);

    console.log(`[Database] Vector search found ${memoriesWithSimilarity.length} results`);
    if (memoriesWithSimilarity.length > 0) {
      console.log(`[Database] Top result: similarity=${memoriesWithSimilarity[0].similarity.toFixed(4)}, content="${memoriesWithSimilarity[0].content.substring(0, 50)}..."`);
      console.log(`[Database] Last result: similarity=${memoriesWithSimilarity[memoriesWithSimilarity.length - 1].similarity.toFixed(4)}`);
    }
    return memoriesWithSimilarity;
  }

  /**
   * Hybrid search: Combines FTS5 keyword search with vector similarity
   * 1. Use FTS5 to narrow down to top candidates
   * 2. Re-rank by vector similarity
   */
  static async searchHybrid(
    query: string,
    queryEmbedding: number[] | Float32Array,
    limit: number = 5,
    ftsMultiplier: number = 3
  ): Promise<Array<ArchiveMemory & {similarity?: number; source: 'vector' | 'keyword' | 'hybrid'}>> {
    // Step 1: Get FTS5 candidates (3x the limit to have a good pool)
    const ftsResults = await this.searchArchive(query, limit * ftsMultiplier);

    if (ftsResults.length === 0) {
      // If no FTS results, fall back to pure vector search
      const vectorResults = await this.searchByVector(queryEmbedding, limit);
      return vectorResults.map(r => ({...r, source: 'vector' as const}));
    }

    // Step 2: Get embeddings for FTS results and calculate similarity
    const queryVector = Array.isArray(queryEmbedding) ? queryEmbedding : Array.from(queryEmbedding);
    const resultsWithSimilarity = ftsResults
      .map((memory: any) => {
        if (!memory.embedding) {
          return {...memory, similarity: 0, source: 'keyword' as const};
        }
        // Check if embedding is already an array or needs conversion
        const embedding = Array.isArray(memory.embedding)
          ? memory.embedding
          : this.base64ToVector(memory.embedding);
        const similarity = this.cosineSimilarity(queryVector, embedding);
        return {...memory, embedding, similarity, source: 'hybrid' as const};
      })
      .sort((a: any, b: any) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, limit);

    console.log(`[Database] Hybrid search: ${ftsResults.length} FTS candidates -> ${resultsWithSimilarity.length} final results`);
    return resultsWithSimilarity;
  }

  /**
   * Get count of memories with embeddings and dimension info
   */
  static async getEmbeddingStats(): Promise<{
    total: number;
    withEmbeddings: number;
    percentage: number;
    dimensions: number | null;
    dimensionMismatch: boolean;
  }> {
    // Count both memories (archive) and knowledge tables
    const memoryTotalResult = this.db.executeSync('SELECT COUNT(*) as count FROM memories;');
    const memoryEmbeddedResult = this.db.executeSync('SELECT COUNT(*) as count FROM memories WHERE embedding IS NOT NULL;');

    const knowledgeTotalResult = this.db.executeSync('SELECT COUNT(*) as count FROM knowledge;');
    const knowledgeEmbeddedResult = this.db.executeSync('SELECT COUNT(*) as count FROM knowledge WHERE embedding IS NOT NULL;');

    const total = (memoryTotalResult.rows?.[0]?.count || 0) + (knowledgeTotalResult.rows?.[0]?.count || 0);
    const withEmbeddings = (memoryEmbeddedResult.rows?.[0]?.count || 0) + (knowledgeEmbeddedResult.rows?.[0]?.count || 0);
    const percentage = total > 0 ? (withEmbeddings / total) * 100 : 0;

    // Check dimensions of existing embeddings from both tables
    let dimensions: number | null = null;
    let dimensionMismatch = false;

    if (withEmbeddings > 0) {
      const dims = new Set<number>();

      // Check memories table
      const memorySampleResult = this.db.executeSync(
        'SELECT embedding FROM memories WHERE embedding IS NOT NULL LIMIT 5;'
      );
      const memorySamples = memorySampleResult.rows || [];

      for (const sample of memorySamples) {
        if (sample.embedding) {
          const vec = this.base64ToVector(sample.embedding);
          dims.add(vec.length);
        }
      }

      // Check knowledge table
      const knowledgeSampleResult = this.db.executeSync(
        'SELECT embedding FROM knowledge WHERE embedding IS NOT NULL LIMIT 5;'
      );
      const knowledgeSamples = knowledgeSampleResult.rows || [];

      for (const sample of knowledgeSamples) {
        if (sample.embedding) {
          const vec = this.base64ToVector(sample.embedding);
          dims.add(vec.length);
        }
      }

      if (dims.size > 1) {
        dimensionMismatch = true;
        console.warn(`[Database] Found embeddings with different dimensions: ${Array.from(dims).join(', ')}D`);
      }

      dimensions = Array.from(dims)[0] || null;
    }

    return {total, withEmbeddings, percentage, dimensions, dimensionMismatch};
  }

  static async updateArchiveMemory(id: number, updates: Partial<ArchiveMemory>): Promise<ArchiveMemory | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }
    if (updates.category !== undefined) {
      fields.push('category = ?');
      values.push(updates.category);
    }
    if (updates.importance !== undefined) {
      fields.push('importance = ?');
      values.push(updates.importance);
    }
    if (updates.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(updates.metadata);
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    if (fields.length > 1) {
      this.db.executeSync(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?;`, values);
      console.log(`[Database] Updated archive memory: ${id}`);

      const result = this.db.executeSync('SELECT * FROM memories WHERE id = ?;', [id]);
      return result.rows?.[0] || null;
    }

    return null;
  }

  static async deleteArchiveMemory(id: number): Promise<boolean> {
    const result = this.db.executeSync('DELETE FROM memories WHERE id = ?;', [id]);
    console.log(`[Database] Deleted archive memory ${id}`);
    return result.rowsAffected > 0;
  }

  /**
   * Clear all archive memories (useful when switching embedding models)
   */
  static async clearAllMemories(): Promise<void> {
    this.db.executeSync('DELETE FROM memories;');
    console.log('[Database] Cleared all archive memories');
  }

  // ============== TASK OPERATIONS ==============

  static async createTask(
    title: string,
    description: string,
    dueDate: number | null,
    recurrenceRule: string | null
  ): Promise<Task> {
    const now = Date.now();
    const result = this.db.executeSync(
      'INSERT INTO tasks (title, description, due_date, recurrence_rule, status, created_at) VALUES (?, ?, ?, ?, ?, ?);',
      [title, description, dueDate, recurrenceRule, 'pending', now]
    );

    const insertId = result.insertId;
    const selectResult = this.db.executeSync('SELECT * FROM tasks WHERE id = ?;', [insertId]);
    const task = selectResult.rows?.[0];
    console.log(`[Database] Created task: ${title}`);
    return task;
  }

  static async updateTask(id: number, updates: Partial<Task>): Promise<Task | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.due_date !== undefined) {
      fields.push('due_date = ?');
      values.push(updates.due_date);
    }
    if (updates.recurrence_rule !== undefined) {
      fields.push('recurrence_rule = ?');
      values.push(updates.recurrence_rule);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
      if (updates.status === 'completed' && updates.completed_at === undefined) {
        fields.push('completed_at = ?');
        values.push(Date.now());
      }
    }
    if (updates.completed_at !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completed_at);
    }

    values.push(id);

    if (fields.length > 0) {
      this.db.executeSync(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?;`, values);
      console.log(`[Database] Updated task: ${id}`);

      const result = this.db.executeSync('SELECT * FROM tasks WHERE id = ?;', [id]);
      return result.rows?.[0] || null;
    }

    return null;
  }

  static async completeTask(id: number): Promise<Task | null> {
    return this.updateTask(id, {status: 'completed', completed_at: Date.now()});
  }

  static async getTasks(status?: Task['status']): Promise<Task[]> {
    if (status) {
      const result = this.db.executeSync('SELECT * FROM tasks WHERE status = ? ORDER BY due_date ASC;', [status]);
      return result.rows || [];
    }
    const result = this.db.executeSync('SELECT * FROM tasks ORDER BY due_date ASC;');
    return result.rows || [];
  }

  static async getTasksDueToday(): Promise<Task[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    const result = this.db.executeSync(
      'SELECT * FROM tasks WHERE status = ? AND due_date >= ? AND due_date < ? ORDER BY due_date ASC;',
      ['pending', startOfDay, endOfDay]
    );
    return result.rows || [];
  }

  static async getOverdueTasks(): Promise<Task[]> {
    const now = Date.now();
    const result = this.db.executeSync(
      'SELECT * FROM tasks WHERE status = ? AND due_date < ? ORDER BY due_date ASC;',
      ['pending', now]
    );
    return result.rows || [];
  }

  static async getUpcomingTasks(days: number = 7): Promise<Task[]> {
    const now = Date.now();
    const futureDate = now + days * 24 * 60 * 60 * 1000;

    const result = this.db.executeSync(
      'SELECT * FROM tasks WHERE status = ? AND due_date >= ? AND due_date <= ? ORDER BY due_date ASC;',
      ['pending', now, futureDate]
    );
    return result.rows || [];
  }

  static async deleteTask(id: number): Promise<boolean> {
    const result = this.db.executeSync('DELETE FROM tasks WHERE id = ?;', [id]);
    console.log(`[Database] Deleted task ${id}`);
    return result.rowsAffected > 0;
  }

  // ============== CONVERSATION OPERATIONS ==============

  static async saveConversation(
    summary: string,
    keyPoints: string[],
    messageCount: number
  ): Promise<ConversationSummary> {
    const result = this.db.executeSync(
      'INSERT INTO conversations (summary, key_points, date, message_count) VALUES (?, ?, ?, ?);',
      [summary, JSON.stringify(keyPoints), Date.now(), messageCount]
    );

    const insertId = result.insertId;
    const selectResult = this.db.executeSync('SELECT * FROM conversations WHERE id = ?;', [insertId]);
    const conversation = selectResult.rows?.[0];
    console.log('[Database] Saved conversation summary');
    return conversation;
  }

  static async getRecentConversations(limit: number = 10): Promise<ConversationSummary[]> {
    const result = this.db.executeSync('SELECT * FROM conversations ORDER BY date DESC LIMIT ?;', [limit]);
    return result.rows || [];
  }

  // ============== UTILITY ==============

  static async clear(): Promise<void> {
    this.db.executeSync('DELETE FROM core_memory;');
    this.db.executeSync('DELETE FROM memories;');
    this.db.executeSync('DELETE FROM tasks;');
    this.db.executeSync('DELETE FROM conversations;');
    this.db.executeSync('DELETE FROM knowledge;');
    this.db.executeSync('DELETE FROM folders;');
    this.db.executeSync('DELETE FROM links;');
    console.log('[Database] Database cleared');
  }

  /**
   * Manually run migrations (useful for development)
   */
  static async migrate(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    console.log('[Database] Running migrations manually...');
    await this.runMigrations();
    console.log('[Database] Manual migration completed');
  }

  static async getStats() {
    const coreMemory = this.db.executeSync('SELECT COUNT(*) as count FROM core_memory;');
    const memories = this.db.executeSync('SELECT COUNT(*) as count FROM memories;');
    const tasks = this.db.executeSync('SELECT COUNT(*) as count FROM tasks;');
    const conversations = this.db.executeSync('SELECT COUNT(*) as count FROM conversations;');
    const knowledge = this.db.executeSync('SELECT COUNT(*) as count FROM knowledge;');
    const folders = this.db.executeSync('SELECT COUNT(*) as count FROM folders;');
    const links = this.db.executeSync('SELECT COUNT(*) as count FROM links;');

    return {
      coreMemoryBlocks: coreMemory.rows?.[0]?.count || 0,
      archiveMemories: memories.rows?.[0]?.count || 0,
      tasks: tasks.rows?.[0]?.count || 0,
      conversations: conversations.rows?.[0]?.count || 0,
      knowledgeEntries: knowledge.rows?.[0]?.count || 0,
      folders: folders.rows?.[0]?.count || 0,
      links: links.rows?.[0]?.count || 0,
    };
  }

  static async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      console.log('[Database] Database closed');
    }
  }

  // ============== KNOWLEDGE SYSTEM OPERATIONS ==============

  /**
   * Create or update folder
   */
  static async createFolder(path: string, schema?: Record<string, any>): Promise<void> {
    const now = Date.now();
    this.db.executeSync(
      'INSERT INTO folders (path, schema, created_at) VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET schema = ?;',
      [path, JSON.stringify(schema || {}), now, JSON.stringify(schema || {})]
    );
    console.log(`[Database] Created/updated folder: ${path}`);
  }

  /**
   * Get folder by path
   */
  static async getFolder(path: string): Promise<any | null> {
    const result = this.db.executeSync('SELECT * FROM folders WHERE path = ?;', [path]);
    return result.rows?.[0] || null;
  }

  /**
   * List all folders
   */
  static async listFolders(parentPath?: string): Promise<any[]> {
    if (parentPath) {
      const result = this.db.executeSync(
        'SELECT * FROM folders WHERE path LIKE ? ORDER BY path;',
        [`${parentPath}/%`]
      );
      return result.rows || [];
    }
    const result = this.db.executeSync('SELECT * FROM folders ORDER BY path;');
    return result.rows || [];
  }

  /**
   * Parse path into folder and name
   * e.g., "archive/favorites/movies/Batman" → {folder: "archive/favorites/movies", name: "Batman"}
   */
  private static parsePath(fullPath: string): {folderPath: string; name: string} {
    const parts = fullPath.split('/');
    const name = parts.pop() || '';
    const folderPath = parts.join('/') || 'archive';
    return {folderPath, name};
  }

  /**
   * Create or update knowledge entry
   */
  static async createKnowledge(
    path: string,
    content: string,
    properties?: Record<string, any>,
    embedding?: number[] | Float32Array
  ): Promise<any> {
    const {folderPath, name} = this.parsePath(path);

    if (!name) {
      throw new Error('Knowledge entry must have a name');
    }

    // Auto-create folder if doesn't exist
    await this.createFolder(folderPath);

    const now = Date.now();

    // Check if entry already exists
    const existing = this.db.executeSync('SELECT id FROM knowledge WHERE name = ?;', [name]);

    if (existing.rows && existing.rows.length > 0) {
      // Update existing entry
      const id = existing.rows[0].id;

      if (embedding) {
        const embeddingBase64 = this.vectorToBase64(embedding);
        this.db.executeSync(
          'UPDATE knowledge SET folder_path = ?, content = ?, properties = ?, embedding = ?, updated_at = ? WHERE id = ?;',
          [folderPath, content, JSON.stringify(properties || {}), embeddingBase64, now, id]
        );
      } else {
        this.db.executeSync(
          'UPDATE knowledge SET folder_path = ?, content = ?, properties = ?, updated_at = ? WHERE id = ?;',
          [folderPath, content, JSON.stringify(properties || {}), now, id]
        );
      }

      console.log(`[Database] Updated knowledge: ${name}`);
      const result = this.db.executeSync('SELECT * FROM knowledge WHERE id = ?;', [id]);
      return result.rows?.[0];
    } else {
      // Create new entry
      let result;
      if (embedding) {
        const embeddingBase64 = this.vectorToBase64(embedding);
        result = this.db.executeSync(
          'INSERT INTO knowledge (folder_path, name, content, properties, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?);',
          [folderPath, name, content, JSON.stringify(properties || {}), embeddingBase64, now]
        );
      } else {
        result = this.db.executeSync(
          'INSERT INTO knowledge (folder_path, name, content, properties, created_at) VALUES (?, ?, ?, ?, ?);',
          [folderPath, name, content, JSON.stringify(properties || {}), now]
        );
      }

      const insertId = result.insertId;
      console.log(`[Database] Created knowledge: ${name} (ID: ${insertId})`);

      // Parse links in content
      await this.extractAndCreateLinks(insertId, content);

      const selectResult = this.db.executeSync('SELECT * FROM knowledge WHERE id = ?;', [insertId]);
      return selectResult.rows?.[0];
    }
  }

  /**
   * Extract [[Name]] links from content and create link records
   */
  private static async extractAndCreateLinks(fromId: number, content: string): Promise<void> {
    // Match [[Name]] patterns
    const linkPattern = /\[\[([^\]]+)\]\]/g;
    const matches = Array.from(content.matchAll(linkPattern));

    for (const match of matches) {
      const linkText = match[1];

      // Find knowledge entry by name
      const result = this.db.executeSync('SELECT id FROM knowledge WHERE name = ?;', [linkText]);

      if (result.rows && result.rows.length > 0) {
        const toId = result.rows[0].id;

        // Check if link already exists
        const existingLink = this.db.executeSync(
          'SELECT id FROM links WHERE from_id = ? AND to_id = ?;',
          [fromId, toId]
        );

        if (!existingLink.rows || existingLink.rows.length === 0) {
          // Create link
          this.db.executeSync(
            'INSERT INTO links (from_id, to_id, link_text, created_at) VALUES (?, ?, ?, ?);',
            [fromId, toId, linkText, Date.now()]
          );
          console.log(`[Database] Created link: ${fromId} -> ${toId} (${linkText})`);
        }
      }
    }
  }

  /**
   * Get knowledge entry by name
   */
  static async getKnowledge(name: string, includeBacklinks: boolean = false): Promise<any | null> {
    const result = this.db.executeSync('SELECT * FROM knowledge WHERE name = ?;', [name]);
    const entry = result.rows?.[0] || null;

    if (entry && includeBacklinks) {
      // Get outgoing links (from this entry)
      const outgoing = this.db.executeSync(
        `SELECT k.id, k.name, k.content, l.link_text
         FROM links l
         JOIN knowledge k ON l.to_id = k.id
         WHERE l.from_id = ?;`,
        [entry.id]
      );

      // Get incoming links (to this entry)
      const incoming = this.db.executeSync(
        `SELECT k.id, k.name, k.content, l.link_text
         FROM links l
         JOIN knowledge k ON l.from_id = k.id
         WHERE l.to_id = ?;`,
        [entry.id]
      );

      entry.outgoing_links = outgoing.rows || [];
      entry.incoming_links = incoming.rows || [];
    }

    return entry;
  }

  /**
   * Search knowledge entries
   */
  static async searchKnowledge(query: string, folderPath?: string, limit: number = 10): Promise<any[]> {
    // Try FTS5 first, fallback to LIKE search
    try {
      let sql = `
        SELECT k.* FROM knowledge_fts
        JOIN knowledge k ON knowledge_fts.rowid = k.id
        WHERE knowledge_fts MATCH ?
      `;
      const params: any[] = [query];

      if (folderPath) {
        sql += ` AND k.folder_path LIKE ?`;
        params.push(`${folderPath}%`);
      }

      sql += ` ORDER BY k.created_at DESC LIMIT ?;`;
      params.push(limit);

      const result = this.db.executeSync(sql, params);
      return result.rows || [];
    } catch {
      // Fallback to LIKE search
      let sql = 'SELECT * FROM knowledge WHERE content LIKE ?';
      const params: any[] = [`%${query}%`];

      if (folderPath) {
        sql += ` AND folder_path LIKE ?`;
        params.push(`${folderPath}%`);
      }

      sql += ` ORDER BY created_at DESC LIMIT ?;`;
      params.push(limit);

      const result = this.db.executeSync(sql, params);
      return result.rows || [];
    }
  }

  /**
   * List knowledge entries in a folder
   */
  static async listKnowledge(folderPath: string, recursive: boolean = false): Promise<any[]> {
    const pattern = recursive ? `${folderPath}%` : folderPath;
    const result = this.db.executeSync(
      'SELECT * FROM knowledge WHERE folder_path LIKE ? ORDER BY created_at DESC;',
      [pattern]
    );
    return result.rows || [];
  }

  /**
   * Move knowledge entry to different folder
   */
  static async moveKnowledge(name: string, newFolderPath: string): Promise<any | null> {
    // Auto-create destination folder if doesn't exist
    await this.createFolder(newFolderPath);

    this.db.executeSync(
      'UPDATE knowledge SET folder_path = ?, updated_at = ? WHERE name = ?;',
      [newFolderPath, Date.now(), name]
    );

    console.log(`[Database] Moved knowledge: ${name} -> ${newFolderPath}`);

    const result = this.db.executeSync('SELECT * FROM knowledge WHERE name = ?;', [name]);
    return result.rows?.[0] || null;
  }

  /**
   * Delete knowledge entry
   */
  static async deleteKnowledge(name: string): Promise<boolean> {
    const result = this.db.executeSync('DELETE FROM knowledge WHERE name = ?;', [name]);
    console.log(`[Database] Deleted knowledge: ${name}`);
    return result.rowsAffected > 0;
  }

  /**
   * Delete folder and all its contents
   */
  static async deleteFolder(path: string, recursive: boolean = false): Promise<number> {
    if (recursive) {
      // Delete all knowledge entries in this folder and subfolders
      const result = this.db.executeSync('DELETE FROM knowledge WHERE folder_path LIKE ?;', [`${path}%`]);
      const deletedEntries = result.rowsAffected;

      // Delete folder and subfolders
      this.db.executeSync('DELETE FROM folders WHERE path LIKE ?;', [`${path}%`]);

      console.log(`[Database] Deleted folder recursively: ${path} (${deletedEntries} entries)`);
      return deletedEntries;
    } else {
      // Only delete if empty
      const entries = this.db.executeSync('SELECT COUNT(*) as count FROM knowledge WHERE folder_path = ?;', [path]);
      const count = entries.rows?.[0]?.count || 0;

      if (count > 0) {
        throw new Error(`Cannot delete folder "${path}": contains ${count} entries`);
      }

      this.db.executeSync('DELETE FROM folders WHERE path = ?;', [path]);
      console.log(`[Database] Deleted empty folder: ${path}`);
      return 0;
    }
  }

  /**
   * Update knowledge entry embedding
   */
  static async updateKnowledgeEmbedding(name: string, embedding: number[] | Float32Array): Promise<void> {
    const embeddingBase64 = this.vectorToBase64(embedding);
    this.db.executeSync('UPDATE knowledge SET embedding = ?, updated_at = ? WHERE name = ?;', [embeddingBase64, Date.now(), name]);
    console.log(`[Database] Updated embedding for knowledge: ${name}`);
  }

  /**
   * Search knowledge by vector similarity
   */
  static async searchKnowledgeByVector(
    queryEmbedding: number[] | Float32Array,
    limit: number = 5,
    folderPath?: string
  ): Promise<Array<any & {similarity: number}>> {
    // Get all knowledge with embeddings
    let sql = 'SELECT * FROM knowledge WHERE embedding IS NOT NULL AND embedding != ""';
    const params: any[] = [];

    if (folderPath) {
      sql += ' AND folder_path LIKE ?';
      params.push(`${folderPath}%`);
    }

    const result = this.db.executeSync(sql, params);
    const entries = result.rows || [];

    if (entries.length === 0) {
      return [];
    }

    const queryVector = Array.isArray(queryEmbedding) ? queryEmbedding : Array.from(queryEmbedding);

    // Calculate similarity for each entry
    const entriesWithSimilarity = entries
      .map((entry: any) => {
        if (!entry.embedding) return null;

        const embedding = this.base64ToVector(entry.embedding);
        if (embedding.length === 0) return null;

        const similarity = this.cosineSimilarity(queryVector, embedding);

        return {
          ...entry,
          embedding,
          similarity,
        };
      })
      .filter((e: any) => e !== null)
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, limit);

    return entriesWithSimilarity;
  }
}
