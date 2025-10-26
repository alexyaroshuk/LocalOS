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
        CHECK (category IN ('fact', 'event', 'preference', 'conversation')),
        CHECK (importance >= 1 AND importance <= 10)
      );
    `);

    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);');
    this.db.executeSync('CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);');

    // FTS5 virtual table for full-text search
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

    console.log('[Database] Tables created successfully');
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

  // ============== ARCHIVE MEMORY OPERATIONS ==============

  static async saveMemory(
    content: string,
    category: ArchiveMemory['category'],
    importance: number,
    metadata?: Record<string, any>
  ): Promise<ArchiveMemory> {
    const now = Date.now();
    const result = this.db.executeSync(
      'INSERT INTO memories (content, category, importance, created_at, metadata) VALUES (?, ?, ?, ?, ?);',
      [content, category, importance, now, JSON.stringify(metadata || {})]
    );

    const insertId = result.insertId;
    const selectResult = this.db.executeSync('SELECT * FROM memories WHERE id = ?;', [insertId]);
    const memory = selectResult.rows?.[0];
    console.log(`[Database] Saved archive memory: ${content.substring(0, 50)}...`);
    return memory;
  }

  static async searchArchive(query: string, limit: number = 5): Promise<ArchiveMemory[]> {
    // Use FTS5 for full-text search
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
    console.log('[Database] Database cleared');
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
