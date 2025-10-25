# Memory Management & Vector Search Integration Plan

**Project:** LocalOS - Local AI Chat App
**Phase:** Phase 2 - Memory System
**Last Updated:** January 2025

## Overview

Implement a complete memory system that allows your local LLM to:
- Store and retrieve memories in Obsidian-compatible markdown files
- Perform semantic search using vector embeddings (offline)
- Read from and write to a local knowledge base
- Execute memory operations via function calling (similar to your current tool system)

## Architecture Components

### 1. Vector Storage Layer (SQLite + Vector Extension)

**Technology:** `@op-engineering/op-sqlite`

- Fastest SQLite library for React Native
- Store embeddings as vectors alongside metadata
- Support hybrid search (semantic + keyword)
- 100% offline, no external services required

**Schema Design:**
```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding BLOB NOT NULL,      -- 384-dim float32 vector
  file_path TEXT NOT NULL,       -- Path to markdown file
  title TEXT,
  tags TEXT,                     -- JSON array of tags
  metadata TEXT,                 -- JSON metadata (frontmatter)
  chunk_index INTEGER,           -- For multi-chunk documents
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_memories_created ON memories(created_at);
CREATE INDEX idx_memories_file ON memories(file_path);
```

**Vector Similarity Search:**
- Use cosine similarity for semantic search
- Implement k-nearest neighbors (kNN) algorithm
- Support filtering by tags, date ranges
- Hybrid search: combine semantic + keyword matching

### 2. Embedding Generation (Transformers.js)

**Technology:** `@xenova/transformers`

**Model:** `Xenova/all-MiniLM-L6-v2`
- Size: ~23MB (quantized ONNX format)
- Dimensions: 384
- Speed: ~100-200ms per chunk on device
- Quality: Excellent for general-purpose semantic search

**Implementation Strategy:**
```typescript
import { pipeline } from '@xenova/transformers';

// Initialize once at app startup
const embedder = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2'
);

// Generate embeddings
const embedding = await embedder(text, {
  pooling: 'mean',
  normalize: true
});
```

**Text Chunking:**
- Max chunk size: 512 tokens (~2000 characters)
- Overlap: 50 tokens between chunks
- Smart splitting: Preserve sentence boundaries
- Metadata preservation: Track chunk source and position

**Performance Optimizations:**
- Cache embeddings in memory (LRU cache, max 100 entries)
- Batch processing for multiple texts
- Background processing to avoid UI blocking
- Progressive indexing for large vaults

### 3. Obsidian Vault Service (React Native FS)

**Technology:** `react-native-fs` (already installed)

**Vault Structure:**
```
ObsidianVault/
├── Daily Notes/
│   └── 2025-01-15.md
├── Projects/
│   └── LocalOS.md
├── People/
│   └── John Doe.md
└── .obsidian/
    └── config.json
```

**Markdown File Format:**
```markdown
---
title: Memory Title
tags: [ai, research, important]
created: 2025-01-15T10:30:00Z
updated: 2025-01-15T14:20:00Z
---

# Memory Title

Main content goes here with **markdown formatting**.

Links: [[Related Note]], [[Another Note]]

#tags can also be inline
```

**Service Responsibilities:**
- Read/write markdown files
- Parse YAML frontmatter
- Extract wikilinks `[[note]]` and tags `#tag`
- Chunk content into semantic sections
- Watch for file changes (auto-reindex)
- Handle folder structure and organization

**File Operations:**
```typescript
interface ObsidianService {
  // Vault management
  setVaultPath(path: string): Promise<void>;
  getVaultPath(): string | null;

  // File operations
  readNote(path: string): Promise<MarkdownNote>;
  writeNote(path: string, content: string, frontmatter?: object): Promise<void>;
  deleteNote(path: string): Promise<void>;

  // Querying
  listNotes(folder?: string): Promise<string[]>;
  searchFiles(query: string): Promise<string[]>;

  // Links and tags
  getBacklinks(notePath: string): Promise<string[]>;
  getAllTags(): Promise<string[]>;
  getNotesWithTag(tag: string): Promise<string[]>;
}
```

### 4. Memory Service Layer

**High-Level API** that orchestrates vector DB, embeddings, and Obsidian:

```typescript
interface MemoryService {
  // Initialization
  initialize(vaultPath: string): Promise<void>;
  indexVault(): Promise<void>;

  // Search
  searchSemantic(query: string, limit?: number): Promise<Memory[]>;
  searchKeyword(query: string): Promise<Memory[]>;
  searchHybrid(query: string, limit?: number): Promise<Memory[]>;

  // CRUD operations
  saveMemory(content: string, metadata?: MemoryMetadata): Promise<Memory>;
  updateMemory(id: string, content: string): Promise<Memory>;
  deleteMemory(id: string): Promise<void>;
  getMemory(id: string): Promise<Memory | null>;

  // Context retrieval
  getRelevantContext(query: string, maxTokens: number): Promise<string>;
  getRecentMemories(limit: number): Promise<Memory[]>;

  // Indexing
  indexFile(filePath: string): Promise<void>;
  reindexAll(): Promise<void>;
}
```

**Memory Data Structure:**
```typescript
interface Memory {
  id: string;
  content: string;
  title?: string;
  filePath: string;
  tags: string[];
  metadata: Record<string, any>;
  chunkIndex?: number;
  similarity?: number;  // For search results
  createdAt: number;
  updatedAt: number;
}

interface MemoryMetadata {
  title?: string;
  tags?: string[];
  folder?: string;
  links?: string[];
  [key: string]: any;
}
```

### 5. Memory Tools for LLM Function Calling

**Extend ToolService with 4 new tools:**

#### Tool 1: `search_memory`
```typescript
{
  name: 'search_memory',
  description: 'Search through stored memories and knowledge using semantic search. Use this when you need to recall information, find related notes, or retrieve context.',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: 'The search query to find relevant memories',
      required: true
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of results to return (default: 5)',
      required: false
    }
  ],
  execute: async (args) => {
    const results = await MemoryService.searchSemantic(
      args.query,
      args.limit || 5
    );
    return {
      success: true,
      results: results.map(m => ({
        title: m.title,
        content: m.content.substring(0, 500),
        similarity: m.similarity,
        tags: m.tags
      }))
    };
  }
}
```

#### Tool 2: `save_memory`
```typescript
{
  name: 'save_memory',
  description: 'Save new information or create a new note in the knowledge base. Use this when the user shares important information that should be remembered.',
  parameters: [
    {
      name: 'content',
      type: 'string',
      description: 'The content to save as a memory',
      required: true
    },
    {
      name: 'title',
      type: 'string',
      description: 'Title for the memory/note',
      required: false
    },
    {
      name: 'tags',
      type: 'string',
      description: 'Comma-separated tags (e.g., "important,ai,research")',
      required: false
    }
  ],
  execute: async (args) => {
    const tags = args.tags ? args.tags.split(',').map(t => t.trim()) : [];
    const memory = await MemoryService.saveMemory(args.content, {
      title: args.title,
      tags
    });
    return {
      success: true,
      id: memory.id,
      message: `Memory saved: ${memory.title || 'Untitled'}`
    };
  }
}
```

#### Tool 3: `update_memory`
```typescript
{
  name: 'update_memory',
  description: 'Update an existing memory or note with new information',
  parameters: [
    {
      name: 'memory_id',
      type: 'string',
      description: 'ID of the memory to update',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      description: 'New content for the memory',
      required: true
    }
  ],
  execute: async (args) => {
    const memory = await MemoryService.updateMemory(
      args.memory_id,
      args.content
    );
    return {
      success: true,
      message: `Memory updated: ${memory.title || memory.id}`
    };
  }
}
```

#### Tool 4: `get_recent_memories`
```typescript
{
  name: 'get_recent_memories',
  description: 'Retrieve recently created or modified memories',
  parameters: [
    {
      name: 'limit',
      type: 'number',
      description: 'Number of recent memories to retrieve (default: 10)',
      required: false
    }
  ],
  execute: async (args) => {
    const memories = await MemoryService.getRecentMemories(args.limit || 10);
    return {
      success: true,
      count: memories.length,
      memories: memories.map(m => ({
        title: m.title,
        content: m.content.substring(0, 300),
        tags: m.tags,
        updatedAt: new Date(m.updatedAt).toISOString()
      }))
    };
  }
}
```

## Implementation Phases

### Phase A: Vector Database Setup (4-6 hours)

**Tasks:**
1. Install dependencies:
   ```bash
   npm install @op-engineering/op-sqlite
   ```

2. Create `src/services/VectorDatabaseService.ts`
   - Initialize SQLite database
   - Create schema for memories table
   - Implement CRUD operations
   - Build cosine similarity function
   - Add vector search with kNN

3. Add utility functions:
   - Vector serialization/deserialization
   - Similarity scoring
   - Result ranking

4. Write unit tests for vector operations

**Deliverables:**
- ✅ VectorDatabaseService with full CRUD
- ✅ Working vector similarity search
- ✅ Performance benchmarks (search <500ms for 1000 entries)

### Phase B: Embedding Service (3-4 hours)

**Tasks:**
1. Install dependencies:
   ```bash
   npm install @xenova/transformers
   ```

2. Create `src/services/EmbeddingService.ts`
   - Initialize Transformers.js pipeline
   - Implement text chunking algorithm
   - Add embedding generation
   - Build LRU cache for embeddings
   - Add batch processing support

3. Handle edge cases:
   - Model download on first run
   - Offline model storage
   - Error handling and fallbacks

4. Performance optimization:
   - Background processing (Web Worker if possible)
   - Progress callbacks for large batches
   - Memory management

**Deliverables:**
- ✅ EmbeddingService with caching
- ✅ Sub-2-second embedding generation
- ✅ Batch processing for multiple texts

### Phase C: Obsidian Integration (5-7 hours)

**Tasks:**
1. Create `src/services/ObsidianService.ts`
   - Vault path configuration (AsyncStorage)
   - Markdown file reader/writer
   - YAML frontmatter parser
   - Wikilink extraction
   - Tag extraction

2. Implement file operations:
   - List all markdown files
   - Read note with metadata
   - Write note with frontmatter
   - Delete note
   - Move/rename note

3. Add advanced features:
   - Backlink resolution
   - Tag indexing
   - Folder structure support
   - File watching (optional for Phase 2)

4. Create type definitions in `src/types/memory.ts`

5. Build UI for vault selection:
   - Use `react-native-document-picker` for folder selection
   - Display vault status and stats
   - Show recent files

**Deliverables:**
- ✅ ObsidianService with full file operations
- ✅ Markdown parsing with frontmatter
- ✅ Vault configuration UI
- ✅ Compatible with Obsidian desktop app

### Phase D: Memory Tools Integration (3-4 hours)

**Tasks:**
1. Create `src/services/MemoryService.ts`
   - Orchestrate VectorDB + Embeddings + Obsidian
   - Implement high-level memory API
   - Add indexing pipeline
   - Build search functions (semantic, keyword, hybrid)

2. Extend `src/services/ToolService.ts`:
   - Register 4 new memory tools
   - Implement tool execution handlers
   - Add availability checks
   - Handle errors gracefully

3. Update `src/types/index.ts`:
   - Add memory-related types
   - Extend Tool interface if needed

4. Add UI indicators:
   - Show memory tool usage in chat
   - Display indexing progress
   - Memory statistics

**Deliverables:**
- ✅ MemoryService high-level API
- ✅ 4 memory tools registered and working
- ✅ UI shows tool usage

### Phase E: LLM Integration & UI (2-3 hours)

**Tasks:**
1. Update `src/services/LlamaService.ts`:
   - Add memory tools to system prompt
   - Enable memory tools by default (optional)
   - Update tool prompting examples

2. Create `src/screens/MemoryScreen.tsx`:
   - Browse memories by recency
   - Search interface
   - Memory detail view
   - Statistics (total memories, storage used)
   - Vault management

3. Add navigation tab in `App.tsx`:
   - Memory tab icon
   - Badge showing memory count

4. Test integration:
   - Ask LLM to save memories
   - Query memories during conversation
   - Update existing memories
   - Verify persistence

5. Add settings for memory system:
   - Enable/disable auto-save
   - Configure vault path
   - Reindex vault
   - Clear index

**Deliverables:**
- ✅ LLM successfully uses memory tools
- ✅ MemoryScreen for browsing
- ✅ End-to-end testing complete
- ✅ Documentation updated

## Technical Decisions & Rationale

### Why SQLite over other vector databases?

**Options considered:**
- ✅ **SQLite (@op-engineering/op-sqlite)** - CHOSEN
- ❌ Pinecone - Requires cloud/API
- ❌ Chroma - Not React Native compatible
- ❌ Qdrant - Too heavy for mobile
- ❌ Milvus - Designed for servers

**Rationale:**
1. Native performance on mobile (written in C++)
2. Proven reliability and battle-tested
3. Zero network dependency (100% offline)
4. Hybrid search capabilities (semantic + SQL)
5. No additional services to run
6. Small footprint (<1MB library)

### Why Transformers.js over API embeddings?

**Options considered:**
- ✅ **Transformers.js (all-MiniLM-L6-v2)** - CHOSEN
- ❌ OpenAI Embeddings API - Requires internet + costs money
- ❌ Sentence-BERT native - No React Native support
- ❌ Custom ONNX models - More complex integration

**Rationale:**
1. 100% offline operation (privacy-preserving)
2. No API costs or rate limits
3. Data never leaves device (security)
4. Fast enough for mobile (~100-200ms per chunk)
5. MiniLM is optimized for size and speed
6. Works on both iOS and Android

### Why Obsidian format over custom format?

**Options considered:**
- ✅ **Obsidian Markdown** - CHOSEN
- ❌ JSON files - Less human-readable
- ❌ Custom binary format - Not portable
- ❌ Notion API - Requires cloud sync

**Rationale:**
1. Human-readable and editable (plain text)
2. Portable across devices and platforms
3. Rich ecosystem of compatible tools
4. Future-proof (markdown will always be readable)
5. Supports rich metadata (frontmatter)
6. Desktop Obsidian app for power users
7. Bidirectional links and graph view

## File Structure

```
src/
├── services/
│   ├── VectorDatabaseService.ts    # SQLite vector storage
│   ├── EmbeddingService.ts         # Transformers.js embeddings
│   ├── ObsidianService.ts          # Markdown file operations
│   ├── MemoryService.ts            # High-level memory API
│   ├── LlamaService.ts             # (Updated) Add memory tools
│   └── ToolService.ts              # (Updated) Register memory tools
├── screens/
│   ├── ChatScreen.tsx              # (Existing)
│   ├── ModelsScreen.tsx            # (Existing)
│   └── MemoryScreen.tsx            # NEW: Browse/search memories
├── types/
│   ├── index.ts                    # (Updated)
│   └── memory.ts                   # NEW: Memory-related types
└── utils/
    └── markdown-parser.ts          # NEW: Parse frontmatter & content
```

## Success Criteria

### Performance Benchmarks
- ✅ Generate embeddings: <2 seconds per chunk
- ✅ Search 1000+ memories: <500ms
- ✅ Save/update markdown: <100ms
- ✅ Index 100 notes: <30 seconds
- ✅ App startup overhead: <1 second

### Functionality Requirements
- ✅ LLM successfully calls memory tools
- ✅ Semantic search returns relevant results
- ✅ Markdown files compatible with Obsidian desktop
- ✅ Works 100% offline (no internet required)
- ✅ Handles 1000+ notes without performance issues
- ✅ Auto-indexing of new/modified files
- ✅ Bidirectional links preserved

### User Experience
- ✅ Intuitive vault setup (folder picker)
- ✅ Visual feedback for indexing progress
- ✅ Memory tool usage visible in chat
- ✅ Browse memories with search/filter
- ✅ Error handling with helpful messages

## Dependencies to Install

```bash
# Vector storage
npm install @op-engineering/op-sqlite

# Embeddings (on-device ML)
npm install @xenova/transformers

# Already installed:
# - react-native-fs (file operations)
# - @react-native-async-storage/async-storage (config storage)
# - react-native-document-picker (folder selection)
```

## Estimated Effort

| Phase | Description | Time Estimate |
|-------|-------------|---------------|
| **A** | Vector Database Setup | 4-6 hours |
| **B** | Embedding Service | 3-4 hours |
| **C** | Obsidian Integration | 5-7 hours |
| **D** | Memory Tools | 3-4 hours |
| **E** | LLM Integration & UI | 2-3 hours |
| | **Total Development** | **17-24 hours** |
| | Testing & Refinement | 4-6 hours |
| | Documentation | 2-3 hours |
| | **Grand Total** | **23-33 hours** |

## Example Usage Flow

### User Conversation:
```
User: "Remember that I prefer React Native over Flutter for mobile development"
Assistant: [Uses save_memory tool]
Assistant: "Got it! I've saved that preference to your memory."

---

User: "What mobile framework do I prefer?"
Assistant: [Uses search_memory tool with query "mobile framework preference"]
Assistant: "Based on your saved memories, you prefer React Native over Flutter
           for mobile development."

---

User: "What have I been working on lately?"
Assistant: [Uses get_recent_memories tool]
Assistant: "Looking at your recent memories, you've been working on:
           1. LocalOS - Local AI Chat App with function calling
           2. Implementing web search tools
           3. Planning memory and vector search integration"
```

### Automatic Context Retrieval:
```typescript
// Before generating each response
const context = await MemoryService.getRelevantContext(
  userMessage.content,
  maxTokens: 2000
);

// Add to system prompt
const systemPrompt = `
You have access to the user's memory. Here's relevant context:

${context}

Use this information to provide more personalized responses.
`;
```

## Future Enhancements (Post-Phase 2)

### Advanced Features
- [ ] Multi-modal memories (images, audio notes)
- [ ] Graph view of linked notes
- [ ] Automatic tagging using LLM
- [ ] Smart summarization of long notes
- [ ] Periodic memory consolidation
- [ ] Export/import memory database
- [ ] Cloud sync (optional, encrypted)

### Performance Optimizations
- [ ] Incremental indexing (only changed files)
- [ ] Vector quantization for smaller storage
- [ ] Web Worker for embeddings (non-blocking)
- [ ] Lazy loading for large vaults
- [ ] Memory compaction/pruning

### Integration Ideas
- [ ] Calendar integration (temporal context)
- [ ] Location-based memories
- [ ] Conversation summarization to memories
- [ ] Weekly review generator
- [ ] Knowledge graph visualization

## References & Resources

### Libraries
- **op-sqlite**: https://github.com/OP-Engineering/op-sqlite
- **Transformers.js**: https://huggingface.co/docs/transformers.js
- **all-MiniLM-L6-v2**: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
- **React Native FS**: https://github.com/itinance/react-native-fs

### Tutorials & Articles
- "Local JavaScript Vector Database" (RxDB): https://rxdb.info/articles/javascript-vector-database.html
- "Vector Search on Mobile with libSQL" (Turso): https://turso.tech/blog/building-vector-search-and-personal-knowledge-graphs-on-mobile-with-libsql-and-react-native
- "RAG Pipeline with Obsidian": https://orellazri.com/posts/rag-pipeline-chat-with-my-obsidian-vault/

### Obsidian Resources
- Obsidian Plugin API: https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- Dataview Plugin (inspiration): https://github.com/blacksmithgu/obsidian-dataview
- Vector Search Plugin: https://github.com/ashwin271/obsidian-vector-search

---

**Document Version:** 1.0
**Last Updated:** January 2025
**Status:** Ready for Implementation
**Next Step:** Begin Phase A - Vector Database Setup
