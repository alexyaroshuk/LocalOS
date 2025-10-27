# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LocalOS is a React Native mobile application that runs local AI models on-device using llama.cpp (via llama.rn). The app supports both Android and iOS, with optional Apple Intelligence integration on iOS 18+. It features a chat interface with tool calling, memory management (inspired by Letta), vector embeddings, and semantic search.

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
2. **Llama.cpp** (fallback) - Local GGUF models via llama.rn

**Important**: `LlamaService` supports **dual instances** - you can run a chat model AND a separate embedding model simultaneously. The embedding model runs alongside the chat model for semantic search.

### Service Architecture

- **AIService.ts** - Unified interface, auto-detects backend (Apple Intelligence vs Llama.cpp)
- **LlamaService.ts** - Manages llama.cpp contexts (chat + embedding dual instances)
- **AppleIntelligenceService.ts** - Apple Intelligence wrapper using AI SDK
- **ToolService.ts** - Function calling registry and execution
- **MemoryService.ts** - Core memory blocks (in-context memory)
- **DatabaseService.ts** - SQLite persistence for archival memory, facts, tasks
- **EmbeddingService.ts** - Semantic search via local embedding models

### Memory System (Letta-Inspired)

The app implements a Letta-style memory architecture:

**Core Memory** (src/services/MemoryService.ts):
- Always loaded in system prompt
- 4 blocks: `user_profile`, `conversation_style`, `current_focus`, `relationship_context`
- Stored in AsyncStorage
- Updated via `core_memory_append` / `core_memory_replace` tools

**Archival Memory** (src/services/DatabaseService.ts):
- Long-term facts, events, preferences stored in SQLite
- Vector embeddings for semantic search (requires embedding model loaded)
- Tools: `archival_memory_insert`, `archival_memory_search`

**Conversation Search** (src/services/DatabaseService.ts):
- Past conversations stored with summaries
- Full-text search via SQLite FTS5
- Tool: `conversation_search`

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

### Database Schema

SQLite database with FTS5 full-text search:

**Tables**:
- `core_memory` - Core memory blocks
- `archive_memories` - Long-term memories with embeddings
- `user_facts` - Structured facts about the user
- `tasks` - Task tracking
- `conversation_summaries` - Past conversation summaries
- `archive_memories_fts` - FTS5 virtual table for text search

**Vector Search**: Cosine similarity search on embeddings stored as JSON arrays.

### Screen Architecture

**Navigation** (App.tsx):
- Bottom tab navigation with 5 screens
- ChatScreen stays mounted (prevents generation interruption)
- Other screens mount/unmount on navigation

**Screens**:
- `ChatScreen.tsx` - Main chat interface
- `ModelsScreen.tsx` - Model download/selection
- `ToolTestScreen.tsx` - Tool testing UI
- `MemoryViewerScreen.tsx` - View/manage memory
- `VectorSearchTestScreen.tsx` - Test semantic search

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

**Context Sizes**:
- 1B models: 2048 tokens
- 3B models: 4096 tokens
- 8B models: 8192 tokens

**Tool Detection Settings**:
- 1B: High temp (1.2), needs examples in prompt
- 8B: Lower temp (0.6), XML format, no examples needed

Auto-detected from model filename via `getModelConfig()`.

## Database Initialization

App.tsx initializes in order:
1. ModelStorageService - Model registry
2. MemoryService - Core memory blocks
3. DatabaseService - SQLite with schema creation
4. Load last used model (if any)

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
