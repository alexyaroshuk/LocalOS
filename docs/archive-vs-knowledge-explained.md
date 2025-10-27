# Archive vs Knowledge: What's the Difference?

## TL;DR
- **Archive** = OLD system (memories table) - still exists for backward compatibility
- **Knowledge** = NEW system (knowledge table) - Obsidian-style with folders and linking

## Memory Architecture

### Core Memory (Always in Context)
**Database**: `core_memory` table
**Purpose**: Essential user information that's ALWAYS loaded
**Content**:
- user_profile: Name, location, occupation, basic facts
- conversation_style: Communication preferences
- current_focus: Active projects/goals
- relationship_context: How we interact

**Example Core Memory Entry**:
```
block_name: user_profile
content: "User is John Doe, lives in San Francisco, works as a software engineer at Acme Corp.
          Prefers being called John. Email: john@example.com"
```

### Archive Memory (OLD - Searchable Storage)
**Database**: `memories` table
**Purpose**: General searchable memories from old system
**Features**:
- FTS5 keyword search
- Vector embeddings for semantic search
- Categories: fact, event, preference, conversation
- Importance scores (1-10)

**Use Case**: Generic memories that don't fit the new knowledge structure. This exists for backward compatibility.

**Example Archive Memory**:
```
content: "User mentioned they love TypeScript"
category: "preference"
importance: 7
```

### Knowledge (NEW - Obsidian-style)
**Database**: `knowledge` + `folders` + `links` tables
**Purpose**: Structured, organized knowledge with folders and linking
**Features**:
- Hierarchical folder structure (archive/tech/languages/TypeScript)
- Globally unique names for [[linking]]
- Custom properties per entry (rating, date, tags, etc.)
- Automatic backlinks
- Vector embeddings for semantic search

**Use Case**: Specific things user mentions - movies, contacts, projects, code snippets, etc.

**Example Knowledge Entries**:
```
path: archive/tech/languages/TypeScript
name: TypeScript
content: "Love programming in TypeScript. Great type safety and tooling."
properties: {rating: 10, type: "programming", learned: "2019"}

path: archive/contacts/work/Sarah
name: Sarah
content: "Sarah from work. Great at design. Works on the UI team. Knows [[Figma]] well."
properties: {role: "designer", team: "UI", email: "sarah@company.com"}
```

## When to Use What?

### Core Memory 👤
Use for **personal facts about the user**:
- ✅ "I live in San Francisco"
- ✅ "My name is John"
- ✅ "I prefer coffee over tea"
- ✅ "I like being called by my first name"

### Archive Memory 📦 (OLD)
Use for **general memories** (backward compatibility):
- ✅ "User mentioned they had a great weekend"
- ✅ "User discussed their project yesterday"
- ✅ "User expressed frustration with bugs"

### Knowledge 📚 (NEW)
Use for **specific structured things**:
- ✅ Movies: "I watched Batman and loved it"
- ✅ Contacts: "Sarah works on the UI team"
- ✅ Projects: "LocalOS is my AI agent app"
- ✅ Code snippets: "My auth implementation"
- ✅ Books: "The Hobbit by Tolkien"
- ✅ Preferences: "Favorite color is blue"

## Test Data Location

### What VectorSearchTestScreen Does Now ✅

**Test Data**: Loads into **Knowledge system** with folder structure:
```typescript
{path: 'archive/tech/languages/TypeScript', content: '...', properties: {...}}
{path: 'archive/preferences/drinks/Coffee', content: '...', properties: {...}}
{path: 'archive/preferences/music/Jazz', content: '...', properties: {...}}
```

**Search**: Searches BOTH Archive AND Knowledge, combines results

### Why Both Systems Exist

1. **Archive**: Legacy system, still useful for unstructured memories
2. **Knowledge**: New system, better for organized structured data

Over time, we can migrate Archive entries to Knowledge when they have clear structure.

## Example: "I live in San Francisco"

### ❌ WRONG - Don't put in Knowledge
```
path: archive/location/San Francisco
content: "I live in San Francisco"
```

### ✅ CORRECT - Put in Core Memory
```
UPDATE core_memory
SET content = "User is John Doe. Lives in San Francisco, CA. Software engineer..."
WHERE block_name = 'user_profile'
```

**Why?** Personal facts about the user should be in Core Memory because:
1. Always needed in context
2. Changes infrequently
3. Fundamental to understanding user

## Migration Path

No migration needed! The database schema already has both systems:
- `memories` table (Archive)
- `knowledge` + `folders` + `links` tables (Knowledge)

Both work in parallel. Agent can use both.

## Summary

| System | Table | Use Case | Example |
|--------|-------|----------|---------|
| Core | core_memory | User facts (always in context) | "I live in SF" |
| Archive | memories | Unstructured memories | "Had a great weekend" |
| Knowledge | knowledge | Structured data with folders | "Batman movie, rating: 9" |

## For Agent Developers

When the agent hears:
- "My name is X" → Update core_memory
- "I watched Batman" → Create knowledge at archive/movies/Batman
- "I had a rough day yesterday" → Save to archive (unstructured)
- "Sarah works with me" → Create knowledge at archive/contacts/work/Sarah
