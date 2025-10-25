# LocalOS Database Schema

## Overview

SQLite database for LocalOS memory system. Optimized for mobile performance with proper indices and constraints.

## Tables

### 1. core_memory
Stores core memory blocks that are always loaded into context.

```sql
CREATE TABLE IF NOT EXISTS core_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_name TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  last_updated INTEGER NOT NULL,

  CHECK (block_name IN ('user_profile', 'conversation_style', 'current_focus', 'relationship_context'))
);

CREATE INDEX idx_core_memory_block_name ON core_memory(block_name);
```

**Fields:**
- `id`: Auto-incrementing primary key
- `block_name`: Name of the memory block (one of 4 predefined types)
- `content`: The actual memory content (text)
- `last_updated`: Unix timestamp of last update

### 2. memories (Archive Memory)
Long-term archive memory, searched on-demand.

```sql
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

CREATE INDEX idx_memories_category ON memories(category);
CREATE INDEX idx_memories_importance ON memories(importance DESC);
CREATE INDEX idx_memories_created_at ON memories(created_at DESC);

-- Full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  content,
  content=memories,
  content_rowid=id
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
  DELETE FROM memories_fts WHERE rowid = old.id;
END;

CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
  UPDATE memories_fts SET content = new.content WHERE rowid = old.id;
END;
```

**Fields:**
- `id`: Auto-incrementing primary key
- `content`: The memory content (text)
- `category`: Type of memory (fact, event, preference, conversation)
- `importance`: Importance score 1-10
- `created_at`: Unix timestamp of creation
- `updated_at`: Unix timestamp of last update (optional)
- `metadata`: JSON string for additional data (tags, entities, etc.)

**Indices:**
- Category for filtering by type
- Importance (DESC) for retrieving most important memories
- Created_at (DESC) for recent memories
- FTS5 virtual table for fast full-text search

### 3. tasks
Task management with support for recurring tasks.

```sql
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

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status_due_date ON tasks(status, due_date);
```

**Fields:**
- `id`: Auto-incrementing primary key
- `title`: Task title
- `description`: Detailed description (optional)
- `due_date`: Unix timestamp of due date (optional)
- `recurrence_rule`: Recurrence pattern (daily, weekly, monthly, or null for one-time)
- `status`: Current status (pending, completed, cancelled)
- `created_at`: Unix timestamp of creation
- `completed_at`: Unix timestamp of completion (optional)

**Indices:**
- Status for filtering active/completed tasks
- Due_date for finding tasks by date
- Composite status+due_date for efficient queries like "pending tasks due today"

### 4. conversations
Conversation summaries for context and history.

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary TEXT NOT NULL,
  key_points TEXT,
  date INTEGER NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,

  CHECK (message_count >= 0)
);

CREATE INDEX idx_conversations_date ON conversations(date DESC);
```

**Fields:**
- `id`: Auto-incrementing primary key
- `summary`: Brief summary of the conversation
- `key_points`: JSON array of important points discussed
- `date`: Unix timestamp of the conversation
- `message_count`: Number of messages in the conversation

**Indices:**
- Date (DESC) for retrieving recent conversations

### 5. user_facts
User preferences, habits, personality traits with confidence scores.

```sql
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

CREATE INDEX idx_user_facts_category ON user_facts(category);
CREATE INDEX idx_user_facts_confidence ON user_facts(confidence DESC);
CREATE INDEX idx_user_facts_last_confirmed ON user_facts(last_confirmed DESC);
```

**Fields:**
- `id`: Auto-incrementing primary key
- `category`: Type of fact (preference, habit, personality, relationship)
- `fact`: The actual fact/statement
- `confidence`: Confidence score 0.0-1.0 (how sure we are)
- `source_conversation_id`: Reference to conversation where this was learned (optional)
- `last_confirmed`: Unix timestamp of last confirmation

**Indices:**
- Category for filtering by type
- Confidence (DESC) for retrieving most confident facts
- Last_confirmed (DESC) for finding recently updated facts

## Schema Versioning

```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (1, ?);
```

Current version: **1**

## Migration Strategy

When schema changes are needed:

1. Increment version number
2. Create migration function in DatabaseService
3. Check current version on initialization
4. Apply migrations sequentially if needed

Example:
```typescript
async function migrateToV2(db: DB) {
  await db.execute('ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 5');
  await db.execute('UPDATE schema_version SET version = 2');
}
```

## Performance Considerations

### Optimizations Applied:
1. **Indices on frequently queried columns** (status, due_date, category, importance)
2. **Composite indices** for common query patterns (status + due_date)
3. **FTS5 virtual table** for fast full-text search
4. **Constraints** to ensure data integrity
5. **Triggers** to keep FTS index synchronized

### Query Examples:

```sql
-- Get today's pending tasks (uses composite index)
SELECT * FROM tasks
WHERE status = 'pending'
AND due_date >= ? AND due_date < ?
ORDER BY due_date ASC;

-- Search archive memories (uses FTS5)
SELECT m.*, rank FROM memories_fts
JOIN memories m ON memories_fts.rowid = m.id
WHERE memories_fts MATCH ?
ORDER BY rank
LIMIT 5;

-- Get most important facts about user preferences
SELECT * FROM user_facts
WHERE category = 'preference' AND confidence > 0.7
ORDER BY confidence DESC, last_confirmed DESC
LIMIT 10;

-- Get recent high-importance memories
SELECT * FROM memories
WHERE importance >= 7
ORDER BY created_at DESC
LIMIT 10;
```

## Storage Estimates

Typical memory usage per record (approximate):

- **Core memory block**: 100-500 bytes (4 blocks = ~1 KB total)
- **Archive memory**: 200-2000 bytes per entry
- **Task**: 100-500 bytes per task
- **Conversation summary**: 300-1000 bytes per conversation
- **User fact**: 100-300 bytes per fact

For 1000 archive memories, 100 tasks, 50 conversations, and 100 user facts:
**Total size: ~2-3 MB** (very reasonable for mobile)

## Future Enhancements (Phase 2+)

When needed, we can add:

1. **Vector embeddings** table for semantic search:
```sql
CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY,
  memory_id INTEGER NOT NULL,
  embedding BLOB NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);
```

2. **Memory links** for graph relationships:
```sql
CREATE TABLE IF NOT EXISTS memory_links (
  from_memory_id INTEGER NOT NULL,
  to_memory_id INTEGER NOT NULL,
  link_type TEXT,
  PRIMARY KEY (from_memory_id, to_memory_id),
  FOREIGN KEY (from_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY (to_memory_id) REFERENCES memories(id) ON DELETE CASCADE
);
```

3. **Conversation messages** for full history:
```sql
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

---

**Status**: Schema finalized for Phase A-D implementation
**Next Step**: Implement DatabaseService with this schema
