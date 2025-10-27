# Vault Tools for AI Agent

## Overview

The AI agent now has 4 tools to access and understand your Obsidian vault structure and content. These tools enable the agent to know where files are located, read their contents, and search across your notes.

## Tools

### 1. `list_vault_structure`

**Purpose:** Get the folder hierarchy of the vault

**Parameters:** None

**Returns:**
- `vault_name`: Name of the vault
- `total_folders`: Number of folders
- `total_files`: Number of markdown files
- `structure`: Object mapping parent folders to their subfolders
- `folders`: Array of all folders with their paths

**Example Response:**
```json
{
  "success": true,
  "vault_name": "sample-vault",
  "total_folders": 4,
  "total_files": 5,
  "structure": {
    "root": ["Development", "Learning", "Personal", "Projects"]
  },
  "folders": [
    {"name": "Development", "path": "Development", "parent": "root"},
    {"name": "Learning", "path": "Learning", "parent": "root"},
    {"name": "Personal", "path": "Personal", "parent": "root"},
    {"name": "Projects", "path": "Projects", "parent": "root"}
  ]
}
```

**When Agent Uses:**
- "What folders are in my vault?"
- "Show me the vault structure"
- "How is my vault organized?"

---

### 2. `list_vault_files`

**Purpose:** List all markdown files with their locations

**Parameters:**
- `folder` (optional): Filter by folder name

**Returns:**
- `total_files`: Number of files
- `files`: Array of files with name, path, folder, size, modified date

**Example Response:**
```json
{
  "success": true,
  "total_files": 1,
  "files": [
    {
      "name": "Vector Search",
      "full_name": "Vector Search.md",
      "path": "Learning/Vector Search.md",
      "folder": "Learning",
      "size": 4523,
      "modified": "2025-01-20T16:45:00Z"
    }
  ]
}
```

**When Agent Uses:**
- "List all my notes"
- "What files are in the Learning folder?"
- "Show me files in Projects"

---

### 3. `read_vault_file`

**Purpose:** Read the full content of a specific file

**Parameters:**
- `file_path` (required): File name or relative path

**Returns:**
- `file`: File metadata (name, path, folder, size, modified)
- `content`: Markdown content (without frontmatter)
- `frontmatter`: Parsed YAML metadata
- `tags`: Array of tags (from frontmatter and inline)
- `links`: Array of wiki-style links

**Example Response:**
```json
{
  "success": true,
  "file": {
    "name": "Vector Search",
    "path": "Learning/Vector Search.md",
    "folder": "Learning",
    "size": 4523,
    "modified": "2025-01-20T16:45:00Z"
  },
  "content": "# Vector Search\n\nVector search finds similar items...",
  "frontmatter": {
    "title": "Vector Search Overview",
    "tags": ["ai", "embeddings", "search"]
  },
  "tags": ["ai", "embeddings", "search", "vector-database"],
  "links": ["LocalOS Project", "AI Model Selection Guide"]
}
```

**When Agent Uses:**
- "Read Vector Search.md"
- "What does LocalOS.md contain?"
- "Show me the content of Preferences.md"

---

### 4. `search_vault`

**Purpose:** Search for files by name or content

**Parameters:**
- `query` (required): Search term

**Returns:**
- `search_type`: "name" or "content"
- `total_matches`: Number of matches
- `matches`: Array of matching files

**Example Response (Name Search):**
```json
{
  "success": true,
  "query": "vector",
  "search_type": "name",
  "total_matches": 1,
  "matches": [
    {
      "name": "Vector Search",
      "path": "Learning/Vector Search.md",
      "folder": "Learning",
      "size": 4523,
      "modified": "2025-01-20T16:45:00Z"
    }
  ]
}
```

**Example Response (Content Search):**
```json
{
  "success": true,
  "query": "embeddings",
  "search_type": "content",
  "total_matches": 2,
  "matches": [
    {
      "name": "Vector Search",
      "path": "Learning/Vector Search.md",
      "folder": "Learning",
      "snippet": "...Convert text to embeddings (dense vectors)...",
      "tags": ["ai", "embeddings", "search"]
    }
  ]
}
```

**When Agent Uses:**
- "Search vault for 'embeddings'"
- "Find notes about React Native"
- "Search for 'cosine similarity'"

---

## Testing the Tools

### Via ToolTestScreen

1. Open **Tools** tab in the app
2. Select a vault tool
3. Provide parameters (if needed)
4. Tap "Execute"
5. View the JSON result

### Via Chat with Test Prompts

1. Open **Chat** tab
2. Make sure a model is loaded and tools are enabled
3. Use the "🧪 Quick Tests" prompts:

**Vault - Structure:**
- "What folders are in my vault?"
- "Show me the vault structure"

**Vault - File Location:**
- "Where is Vector Search.md located?"
- "List files in Learning"

**Vault - Read Content:**
- "Read Vector Search.md"
- "What does LocalOS.md contain?"

**Vault - Search:**
- "Search vault for 'embeddings'"
- "Find notes about AI"

### Expected Behavior

**Agent Should:**
1. Recognize the need to use vault tools
2. Call the appropriate tool with correct parameters
3. Parse the JSON response
4. Provide a natural language answer citing the vault data

**Example:**
```
User: "Where is Vector Search.md located?"

Agent: [Uses list_vault_files or search_vault]
Response: "Vector Search.md is located in the Learning folder. It's 4.5KB and was last modified on January 20, 2025."
```

---

## Implementation Details

### Tool Availability

All vault tools check availability via:
```typescript
checkAvailability: async () => {
  const hasVault = await VaultService.hasVault();
  return {
    available: hasVault,
    reason: hasVault ? undefined : 'No vault configured',
  };
}
```

If no vault is configured, tools will show as unavailable in the ToolTestScreen.

### Performance Considerations

**`search_vault` (content search):**
- Limited to first 50 files to avoid long scan times
- Only searches content if no name matches found
- Extracts 100-character snippet around match

**`list_vault_structure` and `list_vault_files`:**
- Scan vault on each call (no caching yet)
- Fast for vaults < 100 files (~50-100ms)
- May be slow for large vaults (1000+ files)

**Future Optimization:**
- Cache vault structure in AsyncStorage
- Invalidate cache on vault changes
- Add incremental scanning

---

## Integration with AI

### System Prompt Context

When tools are enabled, the agent receives:
```
You have access to vault tools:
- list_vault_structure: Get folder organization
- list_vault_files: List all markdown files
- read_vault_file: Read file content
- search_vault: Search by name or content

Use these when users ask about their notes, vault structure, or want to retrieve information from their knowledge base.
```

### Tool Calling Format

**Pythonic (default for most models):**
```python
[list_vault_structure()]
[list_vault_files(folder="Learning")]
[read_vault_file(file_path="Vector Search.md")]
[search_vault(query="embeddings")]
```

**XML (for 8B models with native support):**
```xml
<tool_call>list_vault_structure()</tool_call>
<tool_call>list_vault_files(folder="Learning")</tool_call>
<tool_call>read_vault_file(file_path="Vector Search.md")</tool_call>
<tool_call>search_vault(query="embeddings")</tool_call>
```

---

## Use Cases

### 1. Knowledge Retrieval

**User:** "What do my notes say about embeddings?"

**Agent:**
1. Calls `search_vault(query="embeddings")`
2. Finds "Vector Search.md" in Learning folder
3. Calls `read_vault_file(file_path="Learning/Vector Search.md")`
4. Summarizes the content about embeddings

### 2. Note Navigation

**User:** "What's in my Learning folder?"

**Agent:**
1. Calls `list_vault_files(folder="Learning")`
2. Lists all files in that folder
3. Provides organized list with file names and dates

### 3. Context for Conversation

**User:** "Explain vector search to me"

**Agent:**
1. Calls `search_vault(query="vector search")`
2. Finds relevant note
3. Calls `read_vault_file(file_path="...")`
4. Uses note content to provide detailed, personalized answer

### 4. Note Discovery

**User:** "What did I write about React Native?"

**Agent:**
1. Calls `search_vault(query="React Native")`
2. Finds matching files
3. Lists them with snippets
4. Offers to read specific files if user wants details

---

## Future Enhancements

### Semantic Search
- Use embedding model to find notes by meaning, not just keywords
- Enable RAG (Retrieval-Augmented Generation)

### Write Operations
- `create_vault_note`: Create new markdown files
- `update_vault_note`: Edit existing files
- `append_to_note`: Add content to end of file

### Advanced Queries
- Filter by tags: `list_vault_files(tags=["ai", "learning"])`
- Filter by date: `list_vault_files(modified_after="2025-01-01")`
- Follow links: `get_linked_notes(file_path="...")`

### Caching
- Cache vault structure to speed up repeated queries
- Watch for file system changes to invalidate cache

---

## Troubleshooting

### Tool Not Available

**Error:** "No vault configured"

**Solution:**
1. Go to **Vault** tab
2. Tap "Browse & Select Folder"
3. Navigate to and select your vault
4. Return to Chat and try again

### File Not Found

**Error:** "File not found: XYZ.md"

**Solution:**
- Check file name spelling
- Use `list_vault_files()` to see available files
- Try using full relative path: "Learning/Vector Search.md"

### Search Returns No Results

**Possible Causes:**
1. File names don't match query (try content search)
2. Content doesn't contain search term (try different keywords)
3. Vault has no files

**Debug:**
- Use `list_vault_files()` to verify files exist
- Try broader search terms
- Check if vault is correctly configured

---

**Last Updated:** 2025-01-27
**Tools Added:** 4 (list_vault_structure, list_vault_files, read_vault_file, search_vault)
**Total Tools Available:** 13 (datetime, web_search, memory tools x7, vault tools x4)
