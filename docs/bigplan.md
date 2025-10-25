# Memory Management & Vector Search Integration Plan

## Overview

Implement a complete memory system that allows your local LLM to:

- Store and retrieve memories in Obsidian-compatible markdown files
- Perform semantic search using vector embeddings (offline)
- Read from and write to a local knowledge base
- Execute memory operations via function calling (similar to your current tool system)

## Architecture Components

### 1. Vector Storage Layer (SQLite + Vector Extension)

- Use `@op-engineering/op-sqlite` - fastest SQLite library for React Native
- Store embeddings as vectors alongside metadata
- Support hybrid search (semantic + keyword)
- ~100% offline, no external services

### 2. Embedding Generation (Transformers.js)

- Use `@xenova/transformers` for on-device embeddings
- Model: `Xenova/all-MiniLM-L6-v2` (~23MB, runs offline)
- Generate 384-dimensional embeddings for text chunks
- Cache embeddings to avoid recomputation

### 3. Obsidian Vault Service (React Native FS)

- Read/write markdown files using `react-native-fs`
- Parse frontmatter metadata (YAML)
- Chunk markdown into semantic sections
- Maintain bidirectional links between notes
- Support folder structure and tags

### 4. Memory Service Layer

- Semantic search across memories
- Save new memories (creates markdown files)
- Update existing memories (edits markdown)
- Retrieve context for LLM queries
- Auto-index new/modified files

### 5. Memory Tools for LLM

Add 4 new tools to ToolService:

- `search_memory` - Find relevant memories semantically
- `save_memory` - Create new memory/note
- `update_memory` - Modify existing note
- `get_recent_memories` - Retrieve recent activity

## Implementation Steps

### Phase A: Vector Database Setup

1. Install dependencies: `@op-engineering/op-sqlite`, `@xenova/transformers`
2. Create `VectorDatabaseService.ts` with SQLite initialization
3. Set up schema: `memories` table (id, content, embedding, metadata, created_at)
4. Implement vector similarity search using cosine similarity

### Phase B: Embedding Service

1. Create `EmbeddingService.ts`
2. Initialize Transformers.js with MiniLM model
3. Implement text chunking (512 tokens max)
4. Cache embeddings in memory for performance
5. Add batch processing for multiple texts

### Phase C: Obsidian Integration

1. Create `ObsidianService.ts` for file operations
2. Configure vault path (user selects via document picker)
3. Implement markdown parser (frontmatter + content)
4. Build file watcher for auto-indexing changes
5. Support tags, links, and folder structure

### Phase D: Memory Tools

1. Extend `ToolService.ts` with 4 memory tools
2. Integrate with LlamaService function calling
3. Add UI indicators for memory operations
4. Create `MemoryScreen.tsx` for browsing memories

### Phase E: LLM Integration

1. Update system prompts to include memory tools
2. Test memory recall during conversations
3. Implement automatic memory saving for important info
4. Add context retrieval before each response

## File Structure

```
src/
├── services/
│   ├── VectorDatabaseService.ts    # SQLite + vector search
│   ├── EmbeddingService.ts         # Transformers.js embeddings
│   ├── ObsidianService.ts          # Markdown file operations
│   └── MemoryService.ts            # High-level memory API
├── screens/
│   └── MemoryScreen.tsx            # Browse/manage memories
└── types/
    └── memory.ts                   # Memory-related types
```

## Key Technical Decisions

### Why SQLite over other vector DBs?

- Native performance on mobile
- Proven reliability with op-sqlite
- No network dependency
- Hybrid search capabilities

### Why Transformers.js over API embeddings?

- 100% offline operation
- No API costs or rate limits
- Privacy-preserving (data never leaves device)
- Fast enough for mobile (MiniLM is optimized)

### Why Obsidian format?

- Human-readable markdown
- Portable across devices
- Ecosystem of compatible tools
- Future-proof (plain text)

## Success Criteria

- ✅ Generate embeddings offline in <2 seconds
- ✅ Search 1000+ memories in <500ms
- ✅ Save/update markdown files reliably
- ✅ LLM successfully uses memory tools
- ✅ Works without internet connection
- ✅ Compatible with Obsidian desktop app

## Estimated Effort

- Phase A (Vector DB): 4-6 hours
- Phase B (Embeddings): 3-4 hours
- Phase C (Obsidian): 5-7 hours
- Phase D (Memory Tools): 3-4 hours
- Phase E (LLM Integration): 2-3 hours

**Total: 17-24 hours** of development + testing
