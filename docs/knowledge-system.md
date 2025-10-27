# Flexible Knowledge System - Implementation Complete

## Overview

Implemented an Obsidian-style flexible knowledge management system that allows the agent to create hierarchical folders, store entries with custom properties, and link between entries using `[[Name]]` syntax.

## What Was Built

### 1. Database Schema (DatabaseService.ts)

**Three new tables:**

```sql
-- Folders: Store folder paths and optional schemas
CREATE TABLE folders (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE,             -- "archive/favorites/movies"
  schema TEXT,                  -- JSON: {rating: "number", year: "number"}
  created_at INTEGER
);

-- Knowledge: Flexible entries with custom properties
CREATE TABLE knowledge (
  id INTEGER PRIMARY KEY,
  folder_path TEXT,             -- "archive/favorites/movies"
  name TEXT UNIQUE,             -- "Batman" (globally unique)
  content TEXT,                 -- Main content, can include [[links]]
  properties TEXT,              -- JSON: {rating: 10, year: 2022, genre: "action"}
  embedding TEXT,               -- Base64 vector for semantic search
  created_at INTEGER,
  updated_at INTEGER
);

-- Links: Bidirectional links between knowledge entries
CREATE TABLE links (
  id INTEGER PRIMARY KEY,
  from_id INTEGER,              -- Source entry
  to_id INTEGER,                -- Target entry
  link_text TEXT,               -- The [[text]] used in link
  created_at INTEGER
);
```

**Key Features:**
- ✅ Hierarchical folder structure using paths
- ✅ Globally unique names for easy linking
- ✅ Custom JSON properties on any entry
- ✅ Auto-created folders when entries are created
- ✅ FTS5 full-text search support
- ✅ Vector embeddings for semantic search
- ✅ Automatic link extraction and backlink tracking

### 2. Knowledge CRUD Operations (DatabaseService.ts)

**Added 12 new methods:**

1. `createFolder(path, schema?)` - Create folder with optional schema
2. `getFolder(path)` - Get folder by path
3. `listFolders(parentPath?)` - List all folders or subfolders
4. `createKnowledge(path, content, properties?, embedding?)` - Create/update entry
5. `getKnowledge(name, includeBacklinks?)` - Get entry with optional backlinks
6. `searchKnowledge(query, folderPath?, limit?)` - FTS5 or LIKE search
7. `listKnowledge(folderPath, recursive?)` - List entries in folder
8. `moveKnowledge(name, newFolderPath)` - Move entry to different folder
9. `deleteKnowledge(name)` - Delete entry
10. `deleteFolder(path, recursive?)` - Delete folder
11. `updateKnowledgeEmbedding(name, embedding)` - Update embedding
12. `searchKnowledgeByVector(queryEmbedding, limit?, folderPath?)` - Semantic search

**Auto-features:**
- Folders auto-created when entries are saved
- Links auto-extracted from content using `[[Name]]` syntax
- Embeddings auto-generated if embedding model is loaded
- Backlinks automatically maintained

### 3. Agent Tools (KnowledgeTools.ts)

**7 new tools for the agent:**

1. **create_knowledge**
   - Create or update knowledge entry
   - Path: `"archive/favorites/movies/Batman"`
   - Supports custom properties and linking
   - Auto-generates embedding if model loaded

2. **search_knowledge**
   - Search using semantic or keyword search
   - Can filter by folder
   - Returns top N results with similarity scores

3. **get_knowledge**
   - Get specific entry by name
   - Optionally include backlinks (incoming/outgoing)

4. **move_knowledge**
   - Move entry to different folder
   - Auto-creates destination folder

5. **delete_knowledge**
   - Delete entry permanently

6. **create_folder**
   - Create folder with optional schema
   - Schema defines default properties for entries

7. **list_folders**
   - List all folders or subfolders under a path

### 4. System Prompts (SystemPrompts.ts)

Updated the custom prompt with comprehensive knowledge system guidance:

**Decision Tree:**
1. User talks about specific things → `create_knowledge`
2. User talks about themselves → `archival_memory_insert`
3. User asks about things they mentioned → `search_knowledge`
4. User asks about themselves → `archival_memory_search`
5. User wants to edit/move/delete → appropriate knowledge tool
6. User asks general questions → Use model knowledge

**Examples added:**
- "I watched Batman" → Create knowledge entry
- "Show my contacts" → Search knowledge
- "Move Batman to watched movies" → Move knowledge
- "Update rating to 10" → Update knowledge

### 5. Test Prompts (DebugTestPrompts.tsx)

Added 8 new test categories:
1. **Knowledge - Create Entries** (5 prompts)
2. **Knowledge - With Properties** (4 prompts)
3. **Knowledge - Edit/Update** (4 prompts)
4. **Knowledge - Move** (3 prompts)
5. **Knowledge - Delete** (3 prompts)
6. **Knowledge - Linking** (3 prompts)
7. **Knowledge - Search & Query** (5 prompts)
8. **Knowledge - Folders & Schema** (3 prompts)

Total: **30 new test prompts** covering all knowledge operations

### 6. Bug Fixes

- Fixed `btoa`/`atob` compatibility (added pure JS implementation)
- Fixed `vectorToBlob` typo → `vectorToBase64`
- Fixed Logger.info multiple arguments issue
- Fixed regex iterator compatibility (Array.from wrapper)

## How It Works

### Example 1: Create Entry

**User**: "I watched Batman and really liked it"

**Agent calls**:
```typescript
create_knowledge({
  path: "archive/favorites/movies/Batman",
  content: "Great movie with dark atmosphere. Really enjoyed it!",
  properties: {rating: 10, year: 2022, genre: "action"}
})
```

**Behind the scenes**:
1. Parse path → folder: `"archive/favorites/movies"`, name: `"Batman"`
2. Auto-create folder if doesn't exist
3. Check if "Batman" already exists (update) or create new
4. Auto-generate embedding if embedding model loaded
5. Extract `[[links]]` from content
6. Insert into database

### Example 2: Search

**User**: "What movies have I watched?"

**Agent calls**:
```typescript
search_knowledge({
  query: "movies watched",
  folder: "archive/favorites/movies",
  limit: 10
})
```

**Behind the scenes**:
1. If embedding model loaded → semantic search
2. Otherwise → FTS5 keyword search
3. Filter by folder if specified
4. Return top N results with similarity scores

### Example 3: Linking

**User**: "Batman reminds me of The Dark Knight"

**Agent calls**:
```typescript
create_knowledge({
  path: "archive/favorites/movies/Batman",
  content: "Great movie! Reminds me of [[The Dark Knight]] in many ways.",
  properties: {rating: 10}
})
```

**Behind the scenes**:
1. Create "Batman" entry
2. Extract link: `[[The Dark Knight]]`
3. Find "The Dark Knight" entry by name
4. Create bidirectional link record
5. Can now query backlinks on either entry

## Key Design Decisions

### 1. Globally Unique Names
**Decision**: Names must be unique across all folders

**Rationale**:
- Simpler linking (`[[Name]]` instead of `[[folder/Name]]`)
- No ambiguity when resolving links
- Matches Obsidian's behavior

**Trade-off**: Can't have "Batman" in both movies and books

### 2. Path-Based Folder Storage
**Decision**: Store full path as string, not parent_id tree

**Rationale**:
- Faster queries (no recursive CTEs needed)
- Human-readable paths
- Easy to export to filesystem
- Compatible with Obsidian format

**Trade-off**: Renaming folders requires updating all children

### 3. Auto-Folder Creation
**Decision**: Folders auto-created when entries are saved

**Rationale**:
- Better UX for agent
- Less cognitive load (agent doesn't need to check if folder exists)
- Matches user expectations

**Trade-off**: Can create unused folders if agent makes mistakes

### 4. SQLite + Markdown Export (Hybrid)
**Decision**: Store in SQLite, export to markdown as needed

**Rationale**:
- SQLite: Fast queries, vector search, transactions
- Markdown: Human-readable, portable, Obsidian-compatible
- Best of both worlds

**Implementation**: Future feature - export all knowledge to `.md` files

## Performance Characteristics

### Storage
- **Average entry**: ~500 bytes (without embedding)
- **With embedding**: ~2KB (384D float32 vector)
- **1000 entries**: ~2MB (without embeddings), ~2GB (with embeddings)
- **Indices**: 7 indices for fast lookups (name, folder_path, created_at, links)

### Query Speed
- **Get by name**: O(1) - indexed
- **Search by folder**: O(log n) - indexed
- **FTS5 search**: O(log n) - full-text index
- **Vector search**: O(n) - must compare all vectors (no HNSW yet)

### Link Resolution
- **Extract links**: O(m) where m = number of `[[links]]` in content
- **Find target**: O(1) per link - indexed by name
- **Get backlinks**: O(log n) - indexed by from_id and to_id

## Testing Strategy

### Manual Testing Steps

1. **Create entries** using test prompts
2. **Search** for entries
3. **Move** entries between folders
4. **Delete** entries
5. **Create links** using `[[Name]]` syntax
6. **Query backlinks** to verify bidirectional linking
7. **Test semantic search** with embedding model loaded
8. **Test folder schemas** (create folder with properties, add entries)

### Success Criteria

✅ Agent creates entries in correct folder structure
✅ Agent adds appropriate properties based on context
✅ Agent uses search before saying "I don't have that info"
✅ Agent can move/delete entries when asked
✅ Links are correctly extracted and stored
✅ Backlinks work bidirectionally
✅ Semantic search returns relevant results
✅ No duplicate names allowed (enforced by DB)

## Future Enhancements

### Phase 2 (Optional)

1. **Obsidian Markdown Export**
   - Export all knowledge to `.md` files
   - Frontmatter YAML for properties
   - Maintain folder structure
   - Sync changes bidirectionally

2. **Advanced Search**
   - Hybrid search (FTS5 + vector + properties)
   - Filter by properties (e.g., `rating > 8`)
   - Date range filtering
   - Tag-based filtering

3. **Graph Visualization**
   - KnowledgeGraphScreen.tsx
   - Visual representation of links
   - Interactive node exploration
   - Force-directed layout

4. **Schema Validation**
   - Validate properties against folder schema
   - Type checking (string, number, date, etc.)
   - Required vs optional properties
   - Default values

5. **Batch Operations**
   - Bulk import from markdown files
   - Bulk export
   - Batch move/delete
   - Merge duplicate entries

6. **Memory Consolidation**
   - Auto-merge similar entries
   - Deduplicate content
   - Update confidence scores
   - Archive old entries

## Files Modified

### Created
- `src/services/KnowledgeTools.ts` (400+ lines)
- `docs/knowledge-system.md` (this file)

### Modified
- `src/services/DatabaseService.ts` (added 350+ lines)
  - New tables schema
  - Knowledge CRUD operations
  - Link extraction and management
- `src/services/LettaMemoryTools.ts` (2 lines)
  - Import KnowledgeTools
  - Add to getAllTools()
- `src/services/SystemPrompts.ts` (50+ lines)
  - Updated decision tree
  - Added knowledge system examples
  - New mandatory behaviors
- `src/components/DebugTestPrompts.tsx` (70+ lines)
  - 8 new test categories
  - 30 new test prompts

### Total Lines Added: ~900 lines

## Summary

We've successfully implemented a flexible, Obsidian-style knowledge management system that:

1. **Allows hierarchical organization** via folder paths
2. **Supports custom properties** on any entry
3. **Enables linking** between entries using `[[Name]]` syntax
4. **Provides semantic search** when embedding model is loaded
5. **Auto-manages** folders, links, and embeddings
6. **Gives agent full control** to create, search, move, and delete
7. **Maintains compatibility** with existing memory systems

The agent can now organize information naturally, just like in Obsidian, with full flexibility to add new categories, properties, and relationships as needed.

**Next step**: Test the system end-to-end using the test prompts in DebugTestPrompts.tsx!
