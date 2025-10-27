# Testing Guide - Agent Memory Search Improvements

## Changes Made

### 1. Agent Search Intelligence (Fixed)

**Problem**: Agent was not searching archival memory when asked questions like "Where do I live?"

**Solution**: Updated system prompts and tool descriptions to make the agent intelligently discern between:
- Questions about the USER (search archival memory first)
- General knowledge questions (use model knowledge)
- Current events (use web search)

**Files Changed**:
- [src/services/SystemPrompts.ts](../src/services/SystemPrompts.ts) - Added decision tree for tool selection
- [src/services/ArchiveMemoryTools.ts](../src/services/ArchiveMemoryTools.ts) - Improved `search_archive` tool description

**Key Changes**:
```
DECISION TREE - CHOOSE THE RIGHT TOOL:

1. User TELLS you personal info → archival_memory_insert
2. User ASKS about THEMSELVES (my/I/me) → archival_memory_search FIRST
3. User asks about GENERAL knowledge → Use your knowledge, then search_web
4. User asks about ANYTHING ELSE → archival_memory_search first, then fallback
```

### 2. ChatScreen UI Rework

**Changes**:
- Replaced model name with "Model Loaded" / "Model Not Loaded" status
- Added expandable arrow to show/hide model details
- Added embedding model status display
- Removed Apple/Llama backend switch button
- Cleaner, more organized header layout

**Files Changed**:
- [src/screens/ChatScreen.tsx](../src/screens/ChatScreen.tsx)

**Before**:
```
[Model Name]  [Apple AI Badge]
[🔄 → Llama]  [Tools ON/OFF]  [📋 Logs]  [Clear]
```

**After**:
```
▶ ✅ Model Loaded          [Tools ON/OFF]  [📋 Logs]  [Clear]
  ⚪ Embedding Not Loaded

(Click arrow to expand and see model names)

▼ ✅ Model Loaded
    Meta-Llama-3.1-8B-Instruct-Q4_K_M
  ✅ Embedding Loaded
    mxbai-embed-large-v1-q4f16_1
```

## Testing Instructions

### Phase 1: Test Agent Memory Search

Use the comprehensive test file: [dev/test_queries.md](./test_queries.md)

**Setup**:
1. Open the app
2. Make sure a model is loaded (Llama 3.1 8B recommended)
3. Enable Tools in ChatScreen

**Test Sequence**:

1. **Insert user data** (should use `archival_memory_insert`):
   - "My name is Alex"
   - "I live in Seattle, Washington"
   - "My favorite color is blue"
   - "I work as a software engineer"
   - "My email is alex@example.com"

2. **Ask about user** (should use `archival_memory_search`):
   - "Where do I live?" → Should find "Seattle, Washington"
   - "What's my email?" → Should find "alex@example.com"
   - "What's my favorite color?" → Should find "blue"
   - "What do you know about me?" → Should list all stored info

3. **Ask general questions** (should NOT use tools):
   - "What is the capital of France?" → Should answer "Paris" directly
   - "What is React Native?" → Should explain without tools
   - "Who invented the telephone?" → Should answer directly

4. **Edge cases**:
   - "Where is Seattle?" → Should answer without searching memory (general knowledge)
   - "What's my phone number?" → Should search, find nothing, say "I don't have that yet"

**Success Criteria**:
- ✅ Agent searches archival memory for user questions
- ✅ Agent uses built-in knowledge for general questions
- ✅ Agent doesn't hallucinate information
- ✅ Agent says "I don't have that yet" for missing info (after searching)

**Check Logs**:
View logs in the app (📋 Logs button) or at [dev/logs.txt](./logs.txt)

Look for:
- `✅ TOOL CALL DETECTED: archival_memory_search` when asking about user
- `❌ NO TOOL CALL DETECTED` for general knowledge questions

### Phase 2: Test ChatScreen UI

**Test Steps**:

1. **Model Status Display**:
   - Open ChatScreen
   - Without loading a model, should show: `❌ Model Not Loaded`
   - Load a model from Models screen
   - Should now show: `✅ Model Loaded`

2. **Expand/Collapse**:
   - Click the arrow (▶) next to model status
   - Should expand to show model name
   - Click again (▼) to collapse

3. **Embedding Status**:
   - If no embedding model loaded: `⚪ Embedding Not Loaded`
   - Load an embedding model from Models screen
   - Should update to: `✅ Embedding Loaded`
   - When expanded, should show embedding model name

4. **Backend Switch Removed**:
   - Verify the "🔄 → Apple/Llama" button is gone
   - Only Tools, Logs, and Clear buttons remain

**Success Criteria**:
- ✅ Status shows correct model loaded/not loaded state
- ✅ Arrow expands/collapses model details
- ✅ Embedding status updates when model is loaded
- ✅ Model names are shown when expanded
- ✅ Backend switch button is removed

## Logs & Debugging

### Log Files
- Main logs: [dev/logs.txt](./logs.txt)
- View in-app: Tap "📋 Logs" button in ChatScreen

### Key Log Lines to Look For

**Tool Detection**:
```
✅ TOOL CALL DETECTED: {"name":"archival_memory_search",...}
❌ NO TOOL CALL DETECTED
🔧 Tool execution result: {...}
```

**Model Info**:
```
✅ AI Backend: llama
✅ Model: Meta-Llama-3.1-8B-Instruct-Q4_K_M
🔢 [EmbedDebug] Embedding model loaded: true
```

## Known Issues

### Issue: Model doesn't search for user info
**Symptoms**: Agent says "I don't know" without calling `archival_memory_search`

**Solution**:
1. Make sure you're using the "Custom (Force Tool Use)" prompt (switch in ToolTestScreen)
2. Check logs to see if tool detection is working
3. Try rephrasing the question to be more explicit: "Search your memory for where I live"

### Issue: Agent searches for general knowledge
**Symptoms**: Agent calls `archival_memory_search` for questions like "What is Python?"

**Solution**:
- This is expected behavior for the first search (the decision tree says "try memory first")
- Agent should then fallback to using its knowledge
- If it continues to over-search, we may need to tune the prompt further

## Performance Notes

- **Embedding model**: Improves search quality significantly when loaded
- **Tool accuracy**: Llama 3.1 8B has ~80% tool calling accuracy
- **Context window**: Monitor the token usage meter in ChatScreen
- **Search performance**: Semantic search is much better than keyword search

## Next Steps

1. Test with different models (1B, 3B, 8B variants)
2. Test with and without embedding model
3. Gather data on search accuracy
4. Consider fine-tuning prompt based on results
5. Add more test cases for edge scenarios
