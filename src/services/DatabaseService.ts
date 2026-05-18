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
  UserFact,
} from './MockDatabaseService';
import {Logger} from '../utils/Logger';

// Re-export types for external use
export type {
  CoreMemoryBlock,
  ArchiveMemory,
  Task,
  ConversationSummary,
  UserFact,
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

    // User facts table
    this.db.executeSync(`
      CREATE TABLE IF NOT EXISTS user_facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        fact TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.5,
        source_conversation_id INTEGER,
        last_confirmed INTEGER NOT NULL,
        CHECK (category IN ('preference', 'habit', 'personality', 'relationship')),
        CHECK (confidence >= 0.0 AND confidence <= 1.0),
        FOREIGN KEY (source_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
      );
    `);

    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_user_facts_category ON user_facts(category);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_user_facts_confidence ON user_facts(confidence DESC);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_user_facts_last_confirmed ON user_facts(last_confirmed DESC);');

    // Vault chunks table — embedding index over user's vault markdown files.
    // Vault files on disk are source-of-truth; this table is a derived search index.
    this.db.executeSync(`
      CREATE TABLE IF NOT EXISTS vault_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vault_path TEXT NOT NULL,
        heading TEXT,
        chunk_text TEXT NOT NULL,
        embedding TEXT NOT NULL,
        mtime INTEGER NOT NULL,
        chunk_hash TEXT NOT NULL UNIQUE
      );
    `);
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_vault_chunks_path ON vault_chunks(vault_path);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_vault_chunks_mtime ON vault_chunks(mtime DESC);');

    // Vault links table — graph edges between vault files extracted from [[wiki links]].
    this.db.executeSync(`
      CREATE TABLE IF NOT EXISTS vault_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_path TEXT NOT NULL,
        target_name TEXT NOT NULL,
        resolved_path TEXT
      );
    `);
    this.db.executeSync('CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_links_unique ON vault_links(source_path, target_name);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_vault_links_source ON vault_links(source_path);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_vault_links_resolved ON vault_links(resolved_path);');

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

    // Migration 3 -> 4: Add vault_chunks table for vault embedding index
    if (currentVersion < 4) {
      console.log('[Database] Running migration 3 -> 4: Adding vault_chunks table...');
      try {
        this.db.executeSync(`
          CREATE TABLE IF NOT EXISTS vault_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vault_path TEXT NOT NULL,
            heading TEXT,
            chunk_text TEXT NOT NULL,
            embedding TEXT NOT NULL,
            mtime INTEGER NOT NULL,
            chunk_hash TEXT NOT NULL UNIQUE
          );
        `);
        this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_vault_chunks_path ON vault_chunks(vault_path);');
        this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_vault_chunks_mtime ON vault_chunks(mtime DESC);');
        this.db.executeSync('UPDATE schema_version SET version = 4, applied_at = ?;', [Date.now()]);
        console.log('[Database] Migration 3 -> 4 completed');
      } catch (error) {
        console.error('[Database] Migration 3 -> 4 failed:', error);
        throw error;
      }
    }

    // Migration 4 -> 5: Add vault_links table for wiki-link graph
    if (currentVersion < 5) {
      console.log('[Database] Running migration 4 -> 5: Adding vault_links table...');
      try {
        this.db.executeSync(`
          CREATE TABLE IF NOT EXISTS vault_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_path TEXT NOT NULL,
            target_name TEXT NOT NULL,
            resolved_path TEXT
          );
        `);
        this.db.executeSync('CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_links_unique ON vault_links(source_path, target_name);');
        this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_vault_links_source ON vault_links(source_path);');
        this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_vault_links_resolved ON vault_links(resolved_path);');
        this.db.executeSync('UPDATE schema_version SET version = 5, applied_at = ?;', [Date.now()]);
        console.log('[Database] Migration 4 -> 5 completed');
      } catch (error) {
        console.error('[Database] Migration 4 -> 5 failed:', error);
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
  static vectorToBase64(vector: number[] | Float32Array): string {
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
  static base64ToVector(base64: string): number[] {
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
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
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
    // CRITICAL: Always make a fresh copy of the query vector
    // The embedding model may return a shared buffer that gets reused
    const queryVector = Array.isArray(queryEmbedding)
      ? [...queryEmbedding]  // Copy regular arrays
      : Array.from(queryEmbedding);  // Copy Float32Array

    // Debug: Check total memories and those with embeddings
    const totalResult = this.db.executeSync('SELECT COUNT(*) as count FROM memories;');
    const totalCount = totalResult.rows?.[0]?.count || 0;
    console.log(`[Database] Total memories in DB: ${totalCount}`);

    const withEmbedResult = this.db.executeSync('SELECT COUNT(*) as count FROM memories WHERE embedding IS NOT NULL AND embedding != "";');
    const withEmbedCount = withEmbedResult.rows?.[0]?.count || 0;
    console.log(`[Database] Memories with non-empty embeddings: ${withEmbedCount}`);
    console.log(`[Database] Query vector dimensions: ${queryVector.length}D`);

    // Get all memories with embeddings
    const result = this.db.executeSync('SELECT id, content, category, importance, created_at, updated_at, metadata, embedding FROM memories WHERE embedding IS NOT NULL AND embedding != "";');
    const memories = result.rows || [];

    console.log(`[Database] Vector search: Found ${memories.length} memories with embeddings`);

    if (memories.length === 0) {
      console.log(`[Database] No memories with embeddings found`);
      return [];
    }

    // Check if all embeddings have same dimensions (important for consistency!)
    let dimensionMismatch = false;
    for (let i = 0; i < Math.min(3, memories.length); i++) {
      const embedding = this.base64ToVector(memories[i].embedding);
      if (embedding.length !== queryVector.length) {
        console.error(`[Database] ⚠️ DIMENSION MISMATCH! Memory ${memories[i].id} has ${embedding.length}D but query is ${queryVector.length}D`);
        dimensionMismatch = true;
      }
    }
    if (dimensionMismatch) {
      Logger.error('[Database] ❌ EMBEDDING CORRUPTION DETECTED! Database has embeddings from different models. Clear database and reload test data with current embedding model.');
    }

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
    const totalResult = this.db.executeSync('SELECT COUNT(*) as count FROM memories;');
    const embeddedResult = this.db.executeSync('SELECT COUNT(*) as count FROM memories WHERE embedding IS NOT NULL;');

    const total = totalResult.rows?.[0]?.count || 0;
    const withEmbeddings = embeddedResult.rows?.[0]?.count || 0;
    const percentage = total > 0 ? (withEmbeddings / total) * 100 : 0;

    // Check dimensions of existing embeddings
    let dimensions: number | null = null;
    let dimensionMismatch = false;

    if (withEmbeddings > 0) {
      const sampleResult = this.db.executeSync(
        'SELECT embedding FROM memories WHERE embedding IS NOT NULL LIMIT 10;'
      );
      const samples = sampleResult.rows || [];

      if (samples.length > 0) {
        const dims = new Set<number>();
        for (const sample of samples) {
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

  // ============== USER FACTS OPERATIONS ==============

  static async saveUserFact(
    category: UserFact['category'],
    fact: string,
    confidence: number,
    sourceConversationId?: number
  ): Promise<UserFact> {
    const result = this.db.executeSync(
      'INSERT INTO user_facts (category, fact, confidence, source_conversation_id, last_confirmed) VALUES (?, ?, ?, ?, ?);',
      [category, fact, confidence, sourceConversationId || null, Date.now()]
    );

    const insertId = result.insertId;
    const selectResult = this.db.executeSync('SELECT * FROM user_facts WHERE id = ?;', [insertId]);
    const userFact = selectResult.rows?.[0];
    console.log(`[Database] Saved user fact: ${fact.substring(0, 50)}...`);
    return userFact;
  }

  static async getUserFactsByCategory(category: UserFact['category']): Promise<UserFact[]> {
    const result = this.db.executeSync(
      'SELECT * FROM user_facts WHERE category = ? ORDER BY confidence DESC;',
      [category]
    );
    return result.rows || [];
  }

  static async getAllUserFacts(): Promise<UserFact[]> {
    const result = this.db.executeSync('SELECT * FROM user_facts ORDER BY confidence DESC;');
    return result.rows || [];
  }

  static async updateUserFactConfidence(id: number, confidence: number): Promise<UserFact | null> {
    this.db.executeSync(
      'UPDATE user_facts SET confidence = ?, last_confirmed = ? WHERE id = ?;',
      [confidence, Date.now(), id]
    );

    const result = this.db.executeSync('SELECT * FROM user_facts WHERE id = ?;', [id]);
    const fact = result.rows?.[0];
    console.log(`[Database] Updated user fact confidence: ${fact?.fact?.substring(0, 50)}...`);
    return fact || null;
  }

  static async updateUserFact(id: number, updates: Partial<UserFact>): Promise<UserFact | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.category !== undefined) {
      fields.push('category = ?');
      values.push(updates.category);
    }
    if (updates.fact !== undefined) {
      fields.push('fact = ?');
      values.push(updates.fact);
    }
    if (updates.confidence !== undefined) {
      fields.push('confidence = ?');
      values.push(updates.confidence);
    }

    fields.push('last_confirmed = ?');
    values.push(Date.now());
    values.push(id);

    if (fields.length > 1) {
      this.db.executeSync(`UPDATE user_facts SET ${fields.join(', ')} WHERE id = ?;`, values);
      console.log(`[Database] Updated user fact: ${id}`);

      const result = this.db.executeSync('SELECT * FROM user_facts WHERE id = ?;', [id]);
      return result.rows?.[0] || null;
    }

    return null;
  }

  static async deleteUserFact(id: number): Promise<boolean> {
    const result = this.db.executeSync('DELETE FROM user_facts WHERE id = ?;', [id]);
    console.log(`[Database] Deleted user fact ${id}`);
    return result.rowsAffected > 0;
  }

  // ============== UTILITY ==============

  static async clear(): Promise<void> {
    this.db.executeSync('DELETE FROM core_memory;');
    this.db.executeSync('DELETE FROM memories;');
    this.db.executeSync('DELETE FROM tasks;');
    this.db.executeSync('DELETE FROM conversations;');
    this.db.executeSync('DELETE FROM user_facts;');
    try {
      this.db.executeSync('DELETE FROM vault_chunks;');
    } catch (e) {
      // table may not exist on older DBs prior to migration
    }
    try {
      this.db.executeSync('DELETE FROM vault_links;');
    } catch (e) {
      // table may not exist on older DBs prior to migration
    }
    console.log('[Database] Database cleared');
  }

  // ============== VAULT CHUNK OPERATIONS ==============

  /**
   * Upsert a single vault chunk by chunk_hash. Idempotent — same content/path/heading
   * never produces a duplicate row.
   */
  static async upsertVaultChunk(params: {
    vaultPath: string;
    heading: string | null;
    chunkText: string;
    embedding: number[] | Float32Array;
    mtime: number;
    chunkHash: string;
  }): Promise<void> {
    const embeddingBase64 = this.vectorToBase64(params.embedding);
    this.db.executeSync(
      `INSERT INTO vault_chunks (vault_path, heading, chunk_text, embedding, mtime, chunk_hash)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(chunk_hash) DO UPDATE SET
         vault_path = excluded.vault_path,
         heading = excluded.heading,
         chunk_text = excluded.chunk_text,
         embedding = excluded.embedding,
         mtime = excluded.mtime;`,
      [params.vaultPath, params.heading, params.chunkText, embeddingBase64, params.mtime, params.chunkHash]
    );
  }

  /**
   * Remove all chunks for a given vault file path. Use before re-indexing a changed
   * file, or when the file is deleted from disk.
   */
  static async deleteVaultChunksForPath(vaultPath: string): Promise<number> {
    const result = this.db.executeSync(
      'DELETE FROM vault_chunks WHERE vault_path = ?;',
      [vaultPath]
    );
    return result.rowsAffected || 0;
  }

  /**
   * Get all chunk rows (without embeddings) for a given vault path. Used to check
   * whether a file has been indexed and at what mtime.
   */
  static async getVaultChunkMetaForPath(vaultPath: string): Promise<Array<{
    id: number; heading: string | null; chunk_text: string; mtime: number; chunk_hash: string;
  }>> {
    const result = this.db.executeSync(
      'SELECT id, heading, chunk_text, mtime, chunk_hash FROM vault_chunks WHERE vault_path = ?;',
      [vaultPath]
    );
    return (result.rows || []) as any;
  }

  /**
   * Vector similarity search over vault_chunks. Returns top-k chunks ranked by
   * cosine similarity, optionally with a recency boost from mtime.
   */
  static async searchVaultChunks(
    queryEmbedding: number[] | Float32Array,
    options: {topK?: number; minSimilarity?: number; recencyBoost?: boolean} = {}
  ): Promise<Array<{
    id: number;
    vaultPath: string;
    heading: string | null;
    chunkText: string;
    mtime: number;
    similarity: number;
  }>> {
    const topK = options.topK ?? 3;
    const minSim = options.minSimilarity ?? 0.0;
    const recency = options.recencyBoost ?? true;

    const queryVec = Array.isArray(queryEmbedding) ? queryEmbedding : Array.from(queryEmbedding);

    const result = this.db.executeSync(
      'SELECT id, vault_path, heading, chunk_text, mtime, embedding FROM vault_chunks;'
    );
    const rows = result.rows || [];
    if (rows.length === 0) {
      return [];
    }

    const now = Date.now();
    const scored = rows
      .map((row: any) => {
        const vec = this.base64ToVector(row.embedding);
        if (vec.length === 0 || vec.length !== queryVec.length) {
          return null;
        }
        let sim = this.cosineSimilarity(queryVec, vec);
        if (recency) {
          // Linear decay: fresh files (<7d) get up to +0.05 boost; older = no boost.
          const ageDays = Math.max(0, (now - row.mtime) / (1000 * 60 * 60 * 24));
          const boost = Math.max(0, 0.05 * (1 - ageDays / 7));
          sim += boost;
        }
        return {
          id: row.id as number,
          vaultPath: row.vault_path as string,
          heading: row.heading as string | null,
          chunkText: row.chunk_text as string,
          mtime: row.mtime as number,
          similarity: sim,
        };
      })
      .filter((r: any) => r !== null && r.similarity >= minSim) as Array<{
        id: number; vaultPath: string; heading: string | null;
        chunkText: string; mtime: number; similarity: number;
      }>;

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }

  /**
   * FTS-less keyword fallback over vault_chunks.chunk_text. Used when no
   * embedding model is loaded.
   */
  static async keywordSearchVaultChunks(query: string, topK: number = 3): Promise<Array<{
    id: number; vaultPath: string; heading: string | null; chunkText: string; mtime: number;
  }>> {
    const result = this.db.executeSync(
      `SELECT id, vault_path, heading, chunk_text, mtime FROM vault_chunks
       WHERE chunk_text LIKE ? OR heading LIKE ? OR vault_path LIKE ?
       ORDER BY mtime DESC LIMIT ?;`,
      [`%${query}%`, `%${query}%`, `%${query}%`, topK]
    );
    return (result.rows || []).map((row: any) => ({
      id: row.id,
      vaultPath: row.vault_path,
      heading: row.heading,
      chunkText: row.chunk_text,
      mtime: row.mtime,
    }));
  }

  static async getVaultChunkStats(): Promise<{totalChunks: number; uniqueFiles: number; embeddingDim: number | null}> {
    const totalRes = this.db.executeSync('SELECT COUNT(*) as count FROM vault_chunks;');
    const filesRes = this.db.executeSync('SELECT COUNT(DISTINCT vault_path) as count FROM vault_chunks;');
    const sampleRes = this.db.executeSync('SELECT embedding FROM vault_chunks LIMIT 1;');
    let dim: number | null = null;
    if (sampleRes.rows?.[0]?.embedding) {
      dim = this.base64ToVector(sampleRes.rows[0].embedding).length;
    }
    return {
      totalChunks: totalRes.rows?.[0]?.count || 0,
      uniqueFiles: filesRes.rows?.[0]?.count || 0,
      embeddingDim: dim,
    };
  }

  // ============== VAULT LINK OPERATIONS ==============

  static async upsertVaultLinks(
    sourcePath: string,
    links: Array<{targetName: string; resolvedPath: string | null}>,
  ): Promise<void> {
    this.db.executeSync('DELETE FROM vault_links WHERE source_path = ?;', [sourcePath]);
    for (const link of links) {
      this.db.executeSync(
        'INSERT INTO vault_links (source_path, target_name, resolved_path) VALUES (?, ?, ?);',
        [sourcePath, link.targetName, link.resolvedPath ?? null],
      );
    }
  }

  static async deleteVaultLinksForPath(sourcePath: string): Promise<number> {
    const result = this.db.executeSync(
      'DELETE FROM vault_links WHERE source_path = ?;',
      [sourcePath],
    );
    return result.rowsAffected || 0;
  }

  static async getForwardLinks(
    sourcePath: string,
  ): Promise<Array<{targetName: string; resolvedPath: string | null}>> {
    const result = this.db.executeSync(
      'SELECT target_name, resolved_path FROM vault_links WHERE source_path = ?;',
      [sourcePath],
    );
    return (result.rows || []).map((row: any) => ({
      targetName: row.target_name as string,
      resolvedPath: (row.resolved_path as string | null) ?? null,
    }));
  }

  static async getBacklinks(
    resolvedPath: string,
  ): Promise<Array<{sourcePath: string; targetName: string}>> {
    const result = this.db.executeSync(
      'SELECT source_path, target_name FROM vault_links WHERE resolved_path = ?;',
      [resolvedPath],
    );
    return (result.rows || []).map((row: any) => ({
      sourcePath: row.source_path as string,
      targetName: row.target_name as string,
    }));
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
    const userFacts = this.db.executeSync('SELECT COUNT(*) as count FROM user_facts;');

    return {
      coreMemoryBlocks: coreMemory.rows?.[0]?.count || 0,
      archiveMemories: memories.rows?.[0]?.count || 0,
      tasks: tasks.rows?.[0]?.count || 0,
      conversations: conversations.rows?.[0]?.count || 0,
      userFacts: userFacts.rows?.[0]?.count || 0,
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
}
