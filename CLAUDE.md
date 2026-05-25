# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LocalOS is a React Native mobile app for local AI inference. Supports on-device chat (llama.cpp via llama.rn), Apple Intelligence (iOS 18+), and LM Studio (OpenAI-compatible local server). Key features: Obsidian vault integration with semantic search, tool calling with multi-step orchestration, voice input via Whisper, and chat session persistence.

## Key Technologies

- **React Native 0.82.1** - Mobile framework (iOS & Android)
- **llama.rn** - llama.cpp bindings for React Native (local LLM inference)
- **@react-native-ai/apple** - Apple Intelligence integration (iOS 18+)
- **@op-engineering/op-sqlite** - SQLite database with FTS5 support
- **Vercel AI SDK** - For Apple Intelligence tool calling
- **TypeScript** - Type safety throughout

## Common Commands

**IMPORTANT**: Do not automatically run `npm start`, `npm run android`, `npm run ios`, or `npm run lint`. The user runs these manually.

### Development
```bash
# Start Metro bundler
npm start

# Run on Android (ensure emulator/device connected)
npm run android

# Run on iOS (requires pod install first)
npm run ios

# Type checking (without emitting)
npx tsc --noEmit --skipLibCheck

# Linting
npm run lint

# Reset Metro cache if needed
npx react-native start --reset-cache
```

### iOS Setup
```bash
# Install CocoaPods dependencies (required after npm install or dependency changes)
cd ios && pod install && cd ..
```

### Android Development
```bash
# Check connected devices
adb devices
```

## Architecture Overview

### Multi-Backend AI System

The app uses a unified `AIService` (src/services/AIService.ts) that auto-detects and routes to the best available backend:

1. **Apple Intelligence** (iOS 18+) - On-device Foundation Models via Neural Engine
2. **Llama.cpp** (cross-platform fallback) - Local GGUF models via llama.rn
3. **LM Studio** - OpenAI-compatible local server (`LMStudioService.ts`). Configure base URL in Settings.

**Important**: `LlamaService` supports **dual instances** - you can run a chat model AND a separate embedding model simultaneously. The embedding model runs alongside the chat model for semantic search.

### Service Architecture

- **AIService.ts** - Unified interface, auto-detects and routes to best backend
- **LlamaService.ts** - Manages llama.cpp contexts (chat + embedding dual instances)
- **LMStudioService.ts** - OpenAI-compatible client for LM Studio; configurable base URL
- **AppleIntelligenceService.ts** - Apple Intelligence wrapper using AI SDK
- **VaultService.ts** - Obsidian vault management: folder selection, disk scan, markdown parsing, wiki link extraction
- **VaultIndexService.ts** - Semantic index over vault files: chunk by heading, embed, store in `vault_chunks` SQLite table
- **OrchestrationService.ts** - Multi-step web search workflows: intent → search → evaluate → fetch → synthesize
- **SessionService.ts** - Chat session persistence in SQLite; one-time migration from AsyncStorage
- **ToolService.ts** - Function calling registry and execution
- **DatabaseService.ts** - SQLite persistence for vault index, sessions, facts, tasks
- **EmbeddingService.ts** - Embedding generation and backfill
- **PromptBuilder.ts** - Assembles system prompts from vault context and tool schemas
- **StorageService.ts** - AsyncStorage KV for model selection and app preferences

### Vault System

The Vault is the primary persistent knowledge layer. Users point the app at an Obsidian-style folder.

**VaultService.ts** — Scans folder tree, parses frontmatter, extracts `[[wiki links]]` and inline tags.

**VaultIndexService.ts** — Chunks each file by heading (~256 tokens), generates embeddings, stores in `vault_chunks` SQLite table. Link graph stored in `vault_links`. Index is idempotent (hash-based, rebuilt only on file change).

**Vault tools** (registered in `ToolService.ts`):
- `vault_lookup` — find single best fact via semantic search
- `search_vault` — top-k semantic search with snippets
- `list_vault_files` — inventory with previews
- `read_vault_file` — open specific file by path
- `get_vault_connections` — forward/backlinks graph
- `vault_save` — write/append content to a vault file
- `update_vault_file` — full file overwrite

### Memory System (Removed)

> **Note:** A Letta-style core/archival memory system was previously scaffolded but never activated; it was removed. The Vault system is the primary persistent knowledge layer. The unused `core_memory` / `memories` SQLite tables remain as no-ops for backward compatibility.

### Tool Calling System

**Format Support**:
- **Pythonic format**: `[function_name(param="value", array=["a","b"])]` (default)
- **XML format**: `<tool_name param="value" array=["a","b"] />` (8B models with native support)

**Tool Detection Flow** (src/services/LlamaService.ts:886):
1. Layer 1: Model attempts tool call
2. Layer 2: Trigger word detection (bypasses model for keywords like "search", "news")
3. Layer 3: Refusal override (forces search if model refuses but user clearly wants it)

**Model-Specific Configurations** (src/types/modelConfig.ts):
- Different models have different tool calling capabilities
- 1B models need more examples in prompts
- 8B models have native tool support with XML format
- Context sizes vary (2048-8192 tokens)

**Registered Tools**:
- Time + Web: `get_current_datetime`, `search_web`, `fetch_web_page`
- Vault (read): `vault_lookup`, `search_vault`, `list_vault_files`, `read_vault_file`, `get_vault_connections`
- Vault (write): `vault_save`, `update_vault_file`

### Database Schema

SQLite database with FTS5 full-text search (schema v6):

**Tables**:
- `vault_chunks` - Semantic index chunks over vault markdown files (with embeddings)
- `vault_links` - Wiki link graph edges extracted from vault files
- `chat_sessions` - Persisted chat sessions as JSON blobs
- `conversations` - Past conversation summaries
- `user_facts` - Structured facts about the user
- `tasks` - Task tracking
- `core_memory` - Core memory blocks (inactive)
- `memories` - Archive memories with embeddings (inactive; was `archive_memories`)
- `memories_fts` - FTS5 virtual table for memories (inactive)

**Vector Search**: Cosine similarity on embeddings stored as base64-encoded TEXT columns.

### Screen Architecture

**Navigation** (App.tsx):
- Custom bottom tab. 4 always-visible tabs: Chat, Models, Vault, Settings
- 3 debug-only tabs (gated by `debugUI` toggle in Settings): Tools, Vector, Files
- ChatScreen stays mounted (opacity hide) to prevent interrupting ongoing generation
- Disabling `debugUI` while on a debug tab redirects to Chat

**Screens**:
- `ChatScreen.tsx` - Main chat interface; handles vault file deep-links
- `ModelsScreen.tsx` - Download/select chat + embedding models
- `VaultBrowserScreen.tsx` - Browse vault folder tree, read/write markdown
- `SettingsScreen.tsx` - `debugUI` toggle, LM Studio URL, inference params
- `DebugInfoScreen.tsx` - Diagnostics (accessible from Settings)
- `LogViewerScreen.tsx` - In-app logs (accessible from DebugInfoScreen)
- `ToolTestScreen.tsx` - Tool testing (debug only)
- `VectorSearchTestScreen.tsx` - Semantic search testing (debug only)
- `FileSystemTestScreen.tsx` - File system testing (debug only)

### Type System

Core types in `src/types/index.ts`:

- `Message` - Standard chat message
- `ActionMessage` - Tool/action tracking messages (shown in chat)
- `ChatItem` - Union of Message | ActionMessage
- `Tool` - Tool definition with parameters and execute function
- `ModelInfo` - Model metadata and download status
- `LlamaConfig` - Model inference configuration

Model-specific configs in `src/types/modelConfig.ts`:
- Detects model type from filename
- Provides context size, tool format, temperature presets
- Function: `getModelConfig(modelName: string): ModelConfig`

Additional type files:
- `src/types/memory.ts` - `Memory`, `MarkdownNote`, `SearchResult`, `VaultStats`
- `src/types/vault.ts` - `VaultFile`, `VaultFolder`, `VaultConfig`, `VaultScanResult`

## Important Patterns

### Loading Models

**Chat Model**:
```typescript
await LlamaService.loadModel(modelPath, modelName);
```

**Embedding Model** (runs alongside chat):
```typescript
await LlamaService.loadEmbeddingModel(embedModelPath, embedModelName);
```

### Switching Backends

```typescript
// Force switch to Apple Intelligence (iOS 18+ only)
await AIService.switchBackend('apple');

// Switch to Llama.cpp
await AIService.switchBackend('llama');

// Switch to LM Studio (configure base URL in Settings first)
await AIService.switchBackend('lmstudio');
```

### Tool Calling

```typescript
// Enable tools (uses all registered tools)
LlamaService.enableTools();

// Or enable specific tools
LlamaService.enableTools([tool1, tool2]);

// Chat with tools
const result = await AIService.chatCompletionWithTools(
  messages,
  tools,
  config,
  onToken,
  onToolUsage
);
```

### System Prompts

Multiple prompt variants for testing (src/services/SystemPrompts.ts):
- `letta` - Letta-style memory-focused (default)
- `concise` - Minimal prompting
- `verbose` - Detailed with many examples

Switch prompts:
```typescript
LlamaService.setPromptType('concise');
```

## Model Configuration

**Featured models** (defined in `src/utils/constants.ts`):
- Chat: `meta-llama-3.1-8b-instruct-abliterated.Q4_K_M.gguf` (~4.9GB) — `mlabonne/Meta-Llama-3.1-8B-Instruct-abliterated-GGUF`
- Embedding: `nomic-embed-text-v1.5.Q8_0.gguf` (~130MB) — `nomic-ai/nomic-embed-text-v1.5-GGUF`
- Speech (Whisper): `ggml-base.bin` (~147MB) — `ggerganov/whisper.cpp`

**Context Sizes** (auto-detected via `getModelConfig()`):
- 1B models: 2048 tokens
- 3B models: 4096 tokens
- 8B models: 8192 tokens

**Tool Detection Settings**:
- 1B: High temp (1.2), needs examples in prompt
- 8B: Lower temp (0.6), XML format, no examples needed

## Database Initialization

App.tsx initializes in order:
1. ModelStorageService - Model registry
2. DatabaseService - SQLite with schema creation and migrations (v1-v6)
3. SessionService - Chat session persistence; one-time migration from AsyncStorage
4. ToolService - Registers all tools
5. VaultService - Loads vault config, sets active vault path
6. Load last used chat model (if any)
7. Load last used embedding model (if any)

## Debugging

**Logging**:
- `Logger.info/debug/error/warn()` - Centralized logging (src/utils/Logger.ts)
- Logs viewable in app via LogViewerScreen (accessible from DebugInfoScreen)

**Type Checking**:
```bash
npx tsc --noEmit --skipLibCheck
```

**Common Issues**:
- Model fails to load: Check context size matches model capabilities
- Tool calling not working: Verify tools enabled via `LlamaService.enableTools()`
- Embedding fails: Ensure embedding model loaded separately from chat model

## File Locations

- **Services**: `src/services/`
- **Screens**: `src/screens/`
- **Components**: `src/components/`
- **Types**: `src/types/`
- **Utils**: `src/utils/`
- **Models**: Downloaded to app Documents directory

## Platform Differences

**iOS**:
- Requires `pod install` after dependency changes
- Apple Intelligence available on iOS 18+ devices
- Better Neural Engine performance

**Android**:
- Uses llama.cpp only (no Apple Intelligence)
- Check `adb devices` for connected devices
- GPU acceleration via nGpuLayers config

## Testing Tools

Use ToolTestScreen and VectorSearchTestScreen to:
- Test individual tools in isolation
- Test semantic search with different queries
- Debug tool parameter parsing
- Verify embedding model functionality
