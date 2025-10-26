# Obsidian + SQLite Integration Options

## Overview

SQLite and Obsidian vaults **don't directly integrate** - Obsidian works with **markdown files** in a folder structure, while SQLite stores data in a binary database file. However, there are several approaches:

## Option 1: **Hybrid Approach** (RECOMMENDED)

Use **both** SQLite and markdown files:

```
LocalOS/
├── database.db              # SQLite for structured data (tasks, facts, metadata)
└── vault/                   # Markdown files for Obsidian
    ├── memories/
    │   ├── 2025-01-26.md   # Daily notes
    │   └── preferences.md   # Topic-based notes
    └── archive/
        └── conversations.md
```

### How it works:
- **SQLite** stores: tasks, user facts with confidence scores, metadata, timestamps, search indices
- **Markdown files** store: actual memory content, conversations, notes
- Your app **syncs both ways**:
  - Memories saved in app → written to both DB (for search/metadata) and MD file (for Obsidian viewing)
  - MD files edited in Obsidian → watched/re-indexed into SQLite

### Pros:
- Best of both worlds: structured queries + human-readable files
- Obsidian can read/edit your memories
- SQLite provides fast search and relationships
- Can use Obsidian plugins (graph view, tags, backlinks)

### Cons:
- Need to maintain sync between DB and files
- More complex architecture
- Potential for sync conflicts

## Option 2: **Markdown-Only** (Obsidian-first)

Store everything as markdown files, use file system as database:

```
vault/
├── core-memory/
│   ├── user-profile.md
│   └── conversation-style.md
├── archive/
│   ├── preferences/
│   ├── facts/
│   └── events/
└── tasks/
    ├── daily.md
    └── 2025-01-26-tasks.md
```

### Pros:
- Everything is human-readable
- Full Obsidian compatibility
- Easy to backup/export
- No database to maintain

### Cons:
- Slower search (need to parse files)
- Harder to implement complex queries
- No built-in FTS or relationships
- Metadata stored in frontmatter (YAML)
- Mobile file I/O can be slow

## Option 3: **SQLite-Only with Export** (Database-first)

Use SQLite as source of truth, provide export to markdown:

```typescript
// Periodically export DB → Obsidian vault
async function exportToObsidian() {
  const memories = await db.getAllMemories();
  for (const memory of memories) {
    await writeMarkdownFile(`vault/memories/${memory.id}.md`, memory.content);
  }
}
```

### Pros:
- Fast queries and structured data
- Simple app architecture
- Can still view in Obsidian (read-only)

### Cons:
- Obsidian edits don't sync back
- One-way sync only
- Not true integration

## Recommended: Hybrid Approach Architecture

### Code Example:

```typescript
// Memory saved from AI
async saveMemory(content, category, importance) {
  // 1. Save to SQLite (for search/metadata)
  const id = await db.saveMemory(content, category, importance);

  // 2. Write to markdown file (for Obsidian)
  const filename = `${category}/${Date.now()}-${id}.md`;
  await writeMarkdownFile(filename, {
    frontmatter: {
      id,
      category,
      importance,
      created_at: Date.now(),
      tags: extractTags(content)
    },
    content
  });

  return id;
}
```

### Markdown File Example:

```markdown
---
id: 42
category: preference
importance: 8
created_at: 1706285432000
tags: [typescript, development, coding]
---

User prefers TypeScript over JavaScript for all projects
```

### Benefits for LocalOS:

1. **App uses SQLite** for fast queries, task management, search
2. **Obsidian can read** all your memories as markdown files
3. **File watcher** can detect Obsidian edits and update SQLite
4. **Future-proof**: Can switch to MD-only if needed
5. **Graph view** in Obsidian shows memory connections

## Implementation Path

If choosing the hybrid approach:

1. **Phase B1**: Implement SQLite database (3-4 hours)
   - Install `@op-engineering/op-sqlite`
   - Create DatabaseService with schema from database-schema.md
   - Migrate MockDatabaseService usage to real DatabaseService

2. **Phase B2**: Add markdown file writing alongside DB saves (2-3 hours)
   - Create MarkdownService for file I/O
   - Write MD files when memories are saved
   - Format with YAML frontmatter

3. **Phase B3** (optional): Add file watcher for Obsidian → DB sync (3-4 hours)
   - Watch vault directory for changes
   - Parse modified MD files
   - Update SQLite with changes

## Decision

**Status**: Proceeding with SQLite implementation first (Phase B1)
**Next Steps**: Install SQLite and create DatabaseService
**Future**: Add markdown export in Phase B2
