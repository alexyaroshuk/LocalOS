# LocalOS Memory System - Implementation Plan

## Vision

Build an intelligent AI assistant that remembers user details (habits, preferences, personality), adapts throughout conversations, and manages tasks like a real human companion.

## Architecture: Letta-Style Core + Archive Memory

### Core Memory (In-Context)
Lives in the system prompt and is always loaded. Contains 2-4 editable blocks:

- **user_profile**: Name, preferences, personality traits
- **conversation_style**: How user talks, prefers to be addressed
- **current_focus**: Active tasks, recent important events
- **relationship_context**: Key facts about user's relationships, work, etc.

### Archive Memory (Database)
SQLite database with on-demand retrieval. Stores:

- Historical memories (facts, events, preferences)
- Task management (one-time and recurring)
- Conversation summaries
- User facts with confidence scores

## Primary Use Cases

1. Create daily tasks, update daily tasks, remind about them (recurring and one-time)
2. Remember what was done before, and suggest next tasks
3. Remember what was said before (if relevant for current conversation)
4. Learn user habits, preferences, personality
5. Adapt conversation style to match the user

## Database Schema

```sql
-- Core memory (loaded into every conversation)
CREATE TABLE core_memory (
  id INTEGER PRIMARY KEY,
  block_name TEXT UNIQUE, -- 'user_profile', 'conversation_style', etc.
  content TEXT,
  last_updated INTEGER
);

-- Archive memory (searched on-demand)
CREATE TABLE memories (
  id INTEGER PRIMARY KEY,
  content TEXT,
  category TEXT, -- 'fact', 'event', 'preference', 'conversation'
  importance INTEGER, -- 1-10 scale
  created_at INTEGER,
  metadata TEXT -- JSON: {tags, entities, related_ids}
);

-- Task management
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  title TEXT,
  description TEXT,
  due_date INTEGER,
  recurrence_rule TEXT, -- 'daily', 'weekly', 'monthly', or cron-style
  status TEXT, -- 'pending', 'completed', 'cancelled'
  created_at INTEGER,
  completed_at INTEGER
);

-- Conversation summaries
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY,
  summary TEXT,
  key_points TEXT, -- JSON array
  date INTEGER,
  message_count INTEGER
);

-- User facts (for preference learning)
CREATE TABLE user_facts (
  id INTEGER PRIMARY KEY,
  category TEXT, -- 'preference', 'habit', 'personality', 'relationship'
  fact TEXT,
  confidence REAL, -- 0.0-1.0
  source_conversation_id INTEGER,
  last_confirmed INTEGER
);
```

## Memory Tools for LLM

The AI will have access to these tools:

1. **update_core_memory** - Edit core memory blocks (user_profile, conversation_style, etc.)
2. **search_archive** - Semantic search in archive (keyword-based initially)
3. **save_memory** - Store important information to archive
4. **create_task** - Add new task (one-time or recurring)
5. **update_task** - Mark complete, reschedule, edit
6. **get_tasks** - Retrieve tasks (today, overdue, upcoming)

## Implementation Phases

### Phase A: Core Memory System (4-6 hours)

**Goal**: Get core memory working in-context with persistence

1. Create `MemoryService.ts` with core memory blocks management
2. Update LlamaService system prompt to include core memory
3. Implement `update_core_memory` tool
4. Test core memory persistence across sessions

**Deliverables**:
- Core memory blocks loaded into every conversation
- AI can update its own memory of the user
- Memory persists between app restarts

### Phase B: SQLite Database Setup (3-4 hours)

**Goal**: Set up local database infrastructure

1. Install `@op-engineering/op-sqlite`
2. Create database schema (memories, tasks, conversations, user_facts)
3. Build `DatabaseService.ts` with CRUD operations
4. Add keyword-based search (defer vector embeddings)

**Deliverables**:
- SQLite database initialized on app start
- All tables created with proper indices
- Basic CRUD operations working

### Phase C: Archive Memory & Search (4-5 hours)

**Goal**: Enable AI to store and retrieve long-term memories

1. Implement `save_memory` tool
2. Implement `search_archive` tool (keyword-based FTS5)
3. Build automatic memory importance scoring
4. Add conversation summarization

**Deliverables**:
- AI can save important facts to archive
- AI can search archive for relevant memories
- Conversations are automatically summarized

### Phase D: Task Management (5-6 hours)

**Goal**: Full task management system with reminders

1. Create task schema with recurrence support
2. Implement `create_task`, `update_task`, `get_tasks` tools
3. Build task reminder logic
4. Add task status tracking

**Deliverables**:
- AI can create and manage tasks
- Recurring tasks work (daily, weekly, monthly)
- Task reminders appear in conversations
- AI suggests next tasks based on history

### Phase E: Intelligence Layer (3-4 hours)

**Goal**: Make the AI learn and adapt automatically

1. Add automatic core memory updates based on conversation
2. Implement learning mechanisms (user preferences, habits)
3. Build conversation style adaptation
4. Test end-to-end memory flow

**Deliverables**:
- AI learns about user without being told to remember
- AI adapts its tone and style to match user
- AI proactively updates its memory
- Full intelligent assistant experience

**Total Estimated Time**: 19-25 hours

## Technology Stack

- **Database**: `@op-engineering/op-sqlite` (fast, reliable, offline-first)
- **Search**: SQLite FTS5 (Full-Text Search) for keyword-based retrieval
- **LLM**: Llama 3.2 3B (already integrated)
- **Storage**: Local SQLite file (no cloud, full privacy)

## What We're NOT Doing (Simplification)

- ❌ Obsidian integration (using DB instead of markdown files)
- ❌ Transformers.js embeddings (too slow on mobile, keyword search is enough initially)
- ❌ File watchers (not needed for DB approach)
- ❌ Complex vector databases (can add later if needed)

## Future Enhancements (Phase 2+)

When the DB grows large or when we need better semantic search:

- Add vector embeddings (Transformers.js or server-based)
- Implement memory consolidation (merge similar memories)
- Add memory decay (reduce importance of old, unreinforced facts)
- Multi-user support
- Cloud sync (optional, privacy-preserving)

## Key Design Principles

1. **Simplicity First**: Start with keyword search, add complexity only when needed
2. **Mobile Performance**: SQLite is blazing fast on mobile
3. **Privacy**: Everything stays on device
4. **Intelligence**: Core + archive mirrors human memory (working + long-term)
5. **Scalability**: Architecture supports future enhancements

## Success Criteria

The system is successful when:

1. AI remembers user details across conversations
2. AI adapts its personality to match the user
3. AI manages tasks without user prompting
4. AI proactively suggests relevant tasks
5. Memory retrieval is fast (<100ms)
6. User feels like talking to a real assistant

---

**Status**: Ready for implementation
**Next Step**: Begin Phase A - Core Memory System
