# LocalOS Memory System - Technical Specification

## 1. Executive Summary

This document specifies the technical design and implementation details for the LocalOS intelligent memory system. The system enables the AI assistant to remember user information, manage tasks, and learn user preferences over time.

**Key Features:**
- Letta-style core + archive memory architecture
- SQLite-based persistence (offline-first)
- Task management with recurring tasks
- User fact tracking with confidence scores
- Keyword-based search (extensible to vector search)

**Implementation Time:** 19-25 hours across 5 phases

---

## 2. System Architecture

### 2.1 Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        LLM Context                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │             CORE MEMORY (In-Context)               │   │
│  │  - user_profile                                    │   │
│  │  - conversation_style                              │   │
│  │  - current_focus                                   │   │
│  │  - relationship_context                            │   │
│  └────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐   │
│  │              AVAILABLE TOOLS                       │   │
│  │  - update_core_memory                              │   │
│  │  - search_archive                                  │   │
│  │  - save_memory                                     │   │
│  │  - create_task / update_task / get_tasks          │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ calls tools
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Memory Service Layer                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Memory     │  │    Task      │  │   Archive    │    │
│  │   Service    │  │   Service    │  │   Service    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ reads/writes
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   SQLite Database                            │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │   core_    │  │  memories  │  │   tasks    │          │
│  │   memory   │  │  (FTS5)    │  │            │          │
│  └────────────┘  └────────────┘  └────────────┘          │
│                                                              │
│  ┌────────────┐  ┌────────────┐                           │
│  │ conversa-  │  │   user_    │                           │
│  │   tions    │  │   facts    │                           │
│  └────────────┘  └────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Core Memory (In-Context)

**Purpose:** Always-loaded memory blocks that provide immediate context to the AI.

**Implementation:**
- Stored in SQLite but loaded on every conversation
- Injected into system prompt via `MemoryService.getFormattedCoreMemory()`
- Editable by AI using `update_core_memory` tool

**Blocks:**

1. **user_profile**
   - Name, occupation, interests
   - Goals and motivations
   - Key personality traits
   - Example: "User is a software developer named John working on LocalOS. Interested in AI and privacy. Values simplicity and performance."

2. **conversation_style**
   - How user prefers to communicate
   - Tone preferences (formal, casual, technical)
   - Response length preferences
   - Example: "Prefers concise, technical responses. Appreciates code examples. Dislikes verbose explanations."

3. **current_focus**
   - Active projects/tasks
   - Recent important events
   - Current priorities
   - Example: "Currently implementing memory system Phase A. Deadline in 2 days. Next: Add task management."

4. **relationship_context**
   - Relationships mentioned by user
   - Work context (team, company)
   - Personal context (family, location)
   - Example: "Solo developer. Active in React Native community. Lives in San Francisco."

**Size Limit:** ~500-1000 characters per block (total ~2-4 KB)

### 2.3 Archive Memory (Database)

**Purpose:** Long-term storage for memories that are retrieved on-demand.

**Types:**

1. **Memories (General Archive)**
   - Facts, events, preferences, conversation highlights
   - Importance-weighted (1-10 score)
   - Categorized for filtering
   - Searchable via FTS5

2. **Tasks**
   - One-time and recurring tasks
   - Due dates and statuses
   - Completion tracking

3. **Conversation Summaries**
   - Summaries of past conversations
   - Key points extracted
   - Message count tracking

4. **User Facts**
   - Learned preferences with confidence scores
   - Habits and patterns
   - Personality traits
   - Relationships

**Retrieval Strategy:**
- Keyword search via SQLite FTS5
- Importance-based ranking
- Recency-based filtering
- (Future: Vector similarity search)

---

## 3. Tool Specifications

### 3.1 Core Memory Tools

#### update_core_memory

Update a core memory block with new information.

**Parameters:**
- `block_name` (string, required): One of ['user_profile', 'conversation_style', 'current_focus', 'relationship_context']
- `content` (string, required): New content for the block

**Returns:**
```json
{
  "success": true,
  "block_name": "user_profile",
  "message": "Core memory block 'user_profile' updated successfully"
}
```

**Example Usage:**
```
User: "I prefer TypeScript over JavaScript for all my projects"
AI: [update_core_memory(block_name="user_profile", content="User is a software developer working on LocalOS. Prefers TypeScript for all projects. Interested in AI and privacy-focused apps.")]
```

### 3.2 Archive Memory Tools

#### save_memory

Save information to long-term archive memory.

**Parameters:**
- `content` (string, required): Information to save
- `category` (string, required): One of ['fact', 'event', 'preference', 'conversation']
- `importance` (number, required): 1-10 score

**Returns:**
```json
{
  "success": true,
  "message": "Memory saved to archive",
  "memory_id": 42
}
```

**Example Usage:**
```
User: "I usually work best in the mornings"
AI: [save_memory(content="User works best in the mornings", category="habit", importance=6)]
```

#### search_archive

Search archive memory for relevant information.

**Parameters:**
- `query` (string, required): Search query
- `limit` (number, optional): Max results (default 5)

**Returns:**
```json
{
  "success": true,
  "message": "Found 3 relevant memories",
  "memories": [
    {
      "content": "User prefers TypeScript over JavaScript",
      "category": "preference",
      "importance": 8,
      "created_at": "1/15/2025"
    }
  ]
}
```

**Example Usage:**
```
User: "What did I say about TypeScript?"
AI: [search_archive(query="TypeScript", limit=5)]
```

### 3.3 Task Management Tools

#### create_task

Create a new task (one-time or recurring).

**Parameters:**
- `title` (string, required): Task title
- `description` (string, optional): Detailed description
- `due_date` (string, optional): ISO date (e.g., "2025-01-20")
- `recurrence` (string, optional): One of ['daily', 'weekly', 'monthly']

**Returns:**
```json
{
  "success": true,
  "message": "Task created: Complete Phase A",
  "task": {
    "id": 5,
    "title": "Complete Phase A",
    "due_date": "1/20/2025",
    "recurrence": "One-time"
  }
}
```

**Example Usage:**
```
User: "Remind me to review the code every week"
AI: [create_task(title="Review code", recurrence="weekly")]
```

#### update_task

Update or complete a task.

**Parameters:**
- `task_id` (number, required): Task ID
- `status` (string, optional): One of ['pending', 'completed', 'cancelled']
- `title` (string, optional): New title
- `description` (string, optional): New description

**Returns:**
```json
{
  "success": true,
  "message": "Task updated: Complete Phase A",
  "task": {
    "id": 5,
    "title": "Complete Phase A",
    "status": "completed"
  }
}
```

**Example Usage:**
```
User: "I finished Phase A"
AI: [update_task(task_id=5, status="completed")]
```

#### get_tasks

Retrieve tasks based on filter criteria.

**Parameters:**
- `filter` (string, optional): One of ['today', 'overdue', 'upcoming', 'all', 'completed']

**Returns:**
```json
{
  "success": true,
  "message": "Found 3 today tasks",
  "tasks": [
    {
      "id": 1,
      "title": "Daily standup notes",
      "description": "Write down progress",
      "due_date": "1/15/2025",
      "recurrence": "daily",
      "status": "pending"
    }
  ]
}
```

**Example Usage:**
```
User: "What do I need to do today?"
AI: [get_tasks(filter="today")]
```

---

## 4. Service Layer Architecture

### 4.1 MemoryService

**File:** `src/services/MemoryService.ts`

**Responsibilities:**
- Manage core memory blocks
- Load/save core memory from AsyncStorage
- Format core memory for system prompt
- Provide update_core_memory tool

**Key Methods:**
```typescript
class MemoryService {
  async initialize(): Promise<void>
  getCoreMemory(): CoreMemoryBlocks
  async updateCoreMemoryBlock(blockName, content): Promise<void>
  getFormattedCoreMemory(): string
  async resetCoreMemory(): Promise<void>
}
```

**Integration Point:** LlamaService calls `getFormattedCoreMemory()` in system prompt.

### 4.2 DatabaseService (Future)

**File:** `src/services/DatabaseService.ts`

**Responsibilities:**
- Initialize SQLite database
- Create tables and indices
- Provide CRUD operations for all tables
- Handle schema migrations

**Key Methods:**
```typescript
class DatabaseService {
  async initialize(): Promise<void>

  // Core memory
  async getCoreMemoryBlocks(): Promise<CoreMemoryBlock[]>
  async updateCoreMemoryBlock(blockName, content): Promise<void>

  // Archive memory
  async saveMemory(content, category, importance, metadata?): Promise<Memory>
  async searchArchive(query, limit): Promise<Memory[]>
  async getRecentMemories(limit): Promise<Memory[]>

  // Tasks
  async createTask(title, description, dueDate, recurrence): Promise<Task>
  async updateTask(id, updates): Promise<Task>
  async getTasks(status?): Promise<Task[]>
  async getTasksDueToday(): Promise<Task[]>
  async getOverdueTasks(): Promise<Task[]>

  // Conversations
  async saveConversation(summary, keyPoints, messageCount): Promise<Conversation>
  async getRecentConversations(limit): Promise<Conversation[]>

  // User facts
  async saveUserFact(category, fact, confidence, sourceId?): Promise<UserFact>
  async getUserFactsByCategory(category): Promise<UserFact[]>
  async updateFactConfidence(id, confidence): Promise<UserFact>
}
```

### 4.3 ArchiveMemoryTools

**File:** `src/services/ArchiveMemoryTools.ts`

**Responsibilities:**
- Provide tool definitions for archive memory and tasks
- Execute tool calls by invoking DatabaseService

**Integration:** Register tools in ToolService during initialization.

---

## 5. Implementation Phases

### Phase A: Core Memory System ✅ COMPLETE

**Time:** 4-6 hours

**Deliverables:**
- [x] MemoryService with core memory blocks
- [x] Core memory persistence via AsyncStorage
- [x] Integration with LlamaService system prompt
- [x] update_core_memory tool
- [x] App initialization of MemoryService

**Files Created:**
- `src/services/MemoryService.ts`
- Updated `src/services/ToolService.ts`
- Updated `src/services/LlamaService.ts`
- Updated `App.tsx`

**Testing:**
- Core memory loads on app start
- Core memory appears in system prompt
- AI can update core memory using tool
- Core memory persists across app restarts

### Phase B: SQLite Database Setup

**Time:** 3-4 hours

**Tasks:**
1. Install `@op-engineering/op-sqlite`
2. Create `DatabaseService.ts`
3. Implement schema from `database-schema.md`
4. Add database initialization to App.tsx
5. Test CRUD operations

**Deliverables:**
- DatabaseService with all tables
- FTS5 search configured
- Schema versioning support
- Migration system in place

### Phase C: Archive Memory & Search

**Time:** 4-5 hours

**Tasks:**
1. Implement save_memory tool
2. Implement search_archive tool
3. Add automatic importance scoring logic
4. Create conversation summarization (basic)
5. Register tools in ToolService

**Deliverables:**
- AI can save memories to archive
- AI can search archive
- Keyword search via FTS5 working
- Memories have importance scores

### Phase D: Task Management

**Time:** 5-6 hours

**Tasks:**
1. Implement create_task tool
2. Implement update_task tool
3. Implement get_tasks tool
4. Add task reminder logic (check at start of conversation)
5. Handle recurring task creation

**Deliverables:**
- AI can create tasks
- AI can update/complete tasks
- AI can retrieve tasks by filter
- Recurring tasks supported
- Task reminders work

### Phase E: Intelligence Layer

**Time:** 3-4 hours

**Tasks:**
1. Add automatic core memory updates
2. Implement user fact learning
3. Build conversation style adaptation
4. Add proactive memory saving
5. Test end-to-end intelligent behavior

**Deliverables:**
- AI learns without explicit "remember" commands
- AI adapts its tone to user
- User facts tracked with confidence
- Full intelligent assistant experience

---

## 6. Data Flow Examples

### 6.1 User Shares Preference

**User:** "I prefer TypeScript over JavaScript"

**Flow:**
1. LLM processes message with core memory in context
2. LLM decides to update core memory
3. Tool call: `update_core_memory(block_name="user_profile", content="...")`
4. MemoryService updates block
5. Block persisted to AsyncStorage
6. LLM also saves to archive: `save_memory(content="User prefers TypeScript over JavaScript", category="preference", importance=8)`
7. Archive memory saved to SQLite

**Result:**
- Core memory updated (always in context)
- Archive memory created (searchable later)

### 6.2 User Asks About Task

**User:** "What do I need to do today?"

**Flow:**
1. LLM processes message
2. Tool call: `get_tasks(filter="today")`
3. DatabaseService queries: `SELECT * FROM tasks WHERE status='pending' AND due_date >= ? AND due_date < ?`
4. Results returned to LLM
5. LLM formats response: "You have 2 tasks today: 1) Daily standup notes, 2) Review PR #42"

### 6.3 Conversation Start with Reminders

**User:** Opens app and starts new conversation

**Flow:**
1. App initializes MemoryService
2. Core memory loaded from AsyncStorage
3. LlamaService includes core memory in system prompt
4. (Future) DatabaseService checks for overdue tasks
5. (Future) System message added: "Reminder: You have 1 overdue task"
6. LLM sees reminder in context and mentions it proactively

---

## 7. Performance Targets

### 7.1 Response Times

- Core memory load: < 50ms
- Archive memory search: < 200ms
- Task queries: < 100ms
- Memory save: < 150ms

### 7.2 Storage

- Core memory: ~1-4 KB (always in memory)
- Archive memory: ~200-2000 bytes per entry
- Target: Support 1000+ archive memories (~2-3 MB)

### 7.3 Search Quality

- Keyword search recall: > 90% for exact matches
- FTS5 relevance ranking: Good enough for 5-10 results
- (Future) Vector search precision: > 80% for semantic queries

---

## 8. Security & Privacy

### 8.1 Data Storage

- All data stored locally in SQLite
- No cloud sync (Phase 1)
- No analytics or telemetry
- User owns their data

### 8.2 Data Access

- Only accessible by the app
- SQLite database in app's private directory
- AsyncStorage in app's secure storage

### 8.3 Data Deletion

- User can reset core memory
- User can clear archive (Future UI)
- Uninstall removes all data

---

## 9. Testing Strategy

### 9.1 Unit Tests

- MemoryService: Core memory CRUD
- DatabaseService: All CRUD operations
- Tools: Each tool execution

### 9.2 Integration Tests

- Core memory → System prompt
- Tool calls → Database updates
- Task recurrence logic

### 9.3 E2E Tests

- User shares preference → Memory updated → Preference recalled later
- User creates task → Task appears in "today" list → User completes task
- User has conversation → Conversation summarized → Summary searchable

### 9.4 Mock Testing (Current)

- MockDatabaseService provides fake data
- ArchiveMemoryTools test tool logic
- Test UI flows without real database

---

## 10. Future Enhancements (Phase 2+)

### 10.1 Vector Embeddings

- Add embeddings table
- Use Transformers.js or server-based embeddings
- Implement vector similarity search
- Migrate from FTS5 to hybrid search (keyword + vector)

### 10.2 Memory Consolidation

- Merge similar memories
- Remove duplicate facts
- Increase confidence of reinforced facts
- Decay old, unconfirmed facts

### 10.3 Advanced Task Management

- Task dependencies
- Priority levels
- Categories/tags
- Time tracking
- Snooze/reschedule

### 10.4 Conversation History

- Full message history storage
- Conversation threading
- Export conversations
- Search within conversations

### 10.5 Multi-User Support

- User profiles
- Separate memory per user
- Shared memories (family/team)

### 10.6 Cloud Sync (Optional)

- End-to-end encrypted sync
- Privacy-preserving architecture
- User controls sync settings

---

## 11. API Reference

See `database-schema.md` for SQL schema details.

### 11.1 Tool Call Format

All tools follow this pattern:

**Request:**
```
[tool_name(param1="value1", param2="value2")]
```

**Response:**
```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { /* tool-specific data */ }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```

### 11.2 Core Memory Format

Injected into system prompt as:

```
# CORE MEMORY

## User Profile
[content]

## Conversation Style
[content]

## Current Focus
[content]

## Relationship Context
[content]

---
You can update these memory blocks using the update_core_memory tool.
```

---

## 12. Success Criteria

The memory system is successful when:

1. ✅ AI remembers user preferences across sessions
2. ✅ AI adapts conversation style to match user
3. ✅ AI creates and manages tasks without explicit commands
4. ✅ AI recalls past conversations accurately
5. ✅ Memory operations are fast (< 200ms)
6. ✅ Storage is efficient (< 5 MB for typical usage)
7. ✅ User feels they're talking to a "real" assistant

---

**Document Version:** 1.0
**Last Updated:** January 2025
**Status:** Ready for implementation
**Next Steps:** Begin Phase B (SQLite Database Setup)
