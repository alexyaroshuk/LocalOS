# How to Load the Embedding Model

## TL;DR - Quick Steps

1. **Models tab** → Find your embedding model
2. Tap **"🔢 Embed"** button (NOT "🤖 Chat"!)
3. See success: "🎉 Dual instance mode active!"
4. **Tools tab** → Tap "🔄 Refresh Status" → See both models loaded

## Detailed Guide

### What You'll See in Models Tab

Each downloaded model now has **TWO buttons**:

```
┌─────────────────────────────────────┐
│  nomic-embed-text-v1.5-Q4_K_M       │
│  81 MB • GGUF                        │
│                                      │
│  [🤖 Chat]  [🔢 Embed]              │
│  [Delete]                            │
└─────────────────────────────────────┘
```

**🤖 Chat Button:**
- Loads model as **chat/conversation** model
- Replaces current chat model
- Used for agent conversations

**🔢 Embed Button:**
- Loads model as **embedding** model
- Creates a **second instance** alongside chat model
- Used for semantic search
- **THIS IS WHAT YOU WANT for dual instance mode!**

### Step-by-Step

#### 1. Load Chat Model First

**Find your chat model** (e.g., Llama 3.2 1B):
```
Llama-3.2-1B-Instruct-Q4_K_M
730 MB • GGUF

[🤖 Chat]  [🔢 Embed]
```

**Tap "🤖 Chat"** → Wait ~5-10 seconds

**Success Alert:**
```
Success
Llama-3.2-1B-Instruct-Q4_K_M loaded as CHAT model!
```

**Logs show:**
```
🔄 LOADING CHAT MODEL
Model Name: Llama-3.2-1B-Instruct-Q4_K_M
✅ Chat model loaded successfully
```

#### 2. Load Embedding Model

**Find your embedding model** (e.g., Nomic Embed):
```
nomic-embed-text-v1.5-Q4_K_M
81 MB • GGUF

[🤖 Chat]  [🔢 Embed]
```

**Tap "🔢 Embed"** (NOT Chat!) → Wait ~3-5 seconds

**Success Alert:**
```
Success
nomic-embed-text-v1.5-Q4_K_M loaded as EMBEDDING model!

🎉 Dual instance mode active!
Agent can now use semantic search.
```

**Logs show:**
```
🔢 LOADING EMBEDDING MODEL
Model Name: nomic-embed-text-v1.5-Q4_K_M
✅ Embedding model loaded successfully
🎉 DUAL INSTANCE MODE ACTIVE!
```

### How to Verify It's Working

#### Method 1: Tools Tab (Recommended)

1. Go to **Tools** tab
2. Scroll to **"🔢 Embedding Model Debug"** section
3. Tap **"🔄 Refresh Status"**
4. Should see:
   ```
   🤖 Chat Model: ✅ Llama-3.2-1B-Instruct-Q4_K_M
   🔢 Embedding Model: ✅ nomic-embed-text-v1.5-Q4_K_M
   🎉 DUAL INSTANCE MODE ACTIVE!
   ```

#### Method 2: Vector Tab

1. Go to **Vector** tab
2. Check **"Model Status"** section
3. Should show both models loaded

#### Method 3: Test Embedding Generation

In **Tools** tab:
1. Find **"🔢 Embedding Model Debug"**
2. Tap **"🧪 Test Embedding"**
3. Should see:
   ```
   Success
   Embedding generated!
   Dimensions: 384
   Time: 82ms
   ```

#### Method 4: Test Memory Search

In **Tools** tab:
1. Tap **"🔍 Test Memory Search Tool"**
2. Should see:
   ```
   Search Result
   Search type: SEMANTIC
   Time: 85ms
   Memories: 3
   ```
3. Check logs: `[MemoryTool] Using SEMANTIC SEARCH`

### Common Mistakes

❌ **Wrong: Tapping "🤖 Chat" for embedding model**
- This loads it as chat model (replaces current chat model)
- No dual instance
- No semantic search

✅ **Right: Tapping "🔢 Embed" for embedding model**
- Creates second instance
- Both models active
- Semantic search works!

---

❌ **Wrong: Loading embedding model first**
- Works, but chat model will be missing
- Agent won't have conversational abilities

✅ **Right: Load chat model, THEN embedding model**
- Both instances active
- Full functionality

---

❌ **Wrong: Loading chat model as embedding**
- Model may not support embeddings
- Will likely fail or produce bad embeddings

✅ **Right: Load embedding-specific model as embedding**
- Model optimized for embeddings
- High quality vectors

### What If I Make a Mistake?

**If you accidentally loaded a model wrong:**

1. Just load it again with the correct button
2. Each button call **replaces** that specific instance
3. Chat button → replaces chat instance
4. Embed button → replaces embed instance

**Example recovery:**
```
Oops, I tapped "Chat" for nomic-embed!
→ Go back to Models tab
→ Find Llama 3.2 1B
→ Tap "🤖 Chat" (restore chat model)
→ Find nomic-embed
→ Tap "🔢 Embed" (correct this time!)
→ Now both loaded correctly
```

### Model Compatibility

**Works as Chat Model:**
- ✅ Llama 3.2 (all sizes)
- ✅ Llama 3.1
- ✅ Qwen 2.5
- ✅ Mistral
- ✅ Phi models

**Works as Embedding Model:**
- ✅ nomic-embed-text
- ✅ all-MiniLM-L6-v2
- ✅ bge-small-en
- ✅ gte-small
- ❌ Chat models (not optimized for embeddings)

**Safety Check:**
If you try to load a non-embedding model as embedding:
```
Warning
This doesn't look like an embedding model.
Embedding models usually have "embed" in the name.

Continue anyway?
[Cancel] [Load Anyway]
```

### Troubleshooting

**"Failed to Load Embedding Model"**

**Possible causes:**
1. Model file corrupted → Re-download
2. Out of memory → Close apps, restart phone
3. Wrong model type → Check it's an embedding model

**Solution:**
1. Check logs for specific error
2. Verify file is valid GGUF
3. Try smaller embedding model (all-MiniLM-L6-v2)

---

**"Only one model showing as loaded"**

**Possible causes:**
1. Used "Chat" button for both
2. Model loading failed silently

**Solution:**
1. Go to Tools tab → "🔄 Refresh Status"
2. Check which model is missing
3. Load missing model with correct button

---

**"Search still using keyword, not semantic"**

**Possible causes:**
1. Embedding model not actually loaded
2. Need to generate embeddings for memories

**Solution:**
1. Verify in Tools tab: Shows "DUAL INSTANCE MODE"?
2. If yes: Vector tab → "Load Test Dataset"
3. Test with pre-embedded memories first

### Advanced: Loading from Files

If you imported a custom GGUF model:

1. Models tab → "Import from Files"
2. Select your `.gguf` file
3. After import, use same button logic:
   - Chat model → **"🤖 Chat"**
   - Embedding model → **"🔢 Embed"**

### Memory Usage

When both models loaded:

**Typical Setup:**
```
Llama 3.2 1B Q4_K_M:     ~730 MB
nomic-embed Q4_K_M:      ~81 MB
System overhead:         ~100 MB
─────────────────────────────────
Total RAM usage:         ~911 MB
```

**Requires:**
- 6GB+ RAM (comfortable)
- 4GB+ RAM (tight but works)
- <4GB RAM (use lighter models)

### What Happens When You Load

**When you tap "🤖 Chat":**
```typescript
LlamaService.loadModel(path, name)
→ releaseModel() // Release old chat model
→ initLlama({ model: path }) // Create new chat context
→ context = newContext // Store as chat model
```

**When you tap "🔢 Embed":**
```typescript
LlamaService.loadEmbeddingModel(path, name)
→ releaseEmbeddingModel() // Release old embed model
→ initLlama({ model: path, embedding: true }) // Create embed context
→ embeddingContext = newContext // Store as embed model
```

**Both contexts coexist!** Different `contextId` values in llama.rn.

### Summary

✅ **Two buttons per model:**
- 🤖 Chat = Conversation model
- 🔢 Embed = Semantic search model

✅ **Loading order:**
1. Chat model with 🤖 button
2. Embed model with 🔢 button

✅ **Verification:**
- Tools tab → "Embedding Model Debug"
- See both models ✅
- See "DUAL INSTANCE MODE"

✅ **Testing:**
- 🧪 Test Embedding → Should work
- 🔍 Test Memory Search → Should use SEMANTIC

**Now your agent can use semantic search during conversations!** 🎉
