# Vector Search Testing Guide

## Overview
This guide explains how to test the semantic vector search functionality in LocalOS.

## What is Vector Search?

**Traditional Keyword Search (FTS5):**
- Matches exact words or substrings
- Query: "programming" → Finds: "programming", but NOT "coding" or "development"

**Semantic Vector Search:**
- Understands meaning, not just words
- Query: "programming" → Finds: "coding", "development", "software engineering"
- Uses embeddings (numerical representations of meaning)

## Setup

### 1. Download an Embedding Model

You need a **separate embedding model** (different from your chat model):

**Recommended Models (GGUF format, llama.rn compatible):**

#### all-MiniLM-L6-v2 ⭐ (Recommended for starting)
- **Size:** ~25MB
- **Dimensions:** 384
- **Quality:** Good
- **Best for:** General-purpose, fast
- **Download:** https://huggingface.co/second-state/All-MiniLM-L6-v2-Embedding-GGUF

#### nomic-embed-text-v1.5
- **Size:** ~130MB
- **Dimensions:** 768
- **Quality:** Excellent
- **Best for:** High quality results
- **Download:** https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF

#### bge-small-en-v1.5
- **Size:** ~35MB
- **Dimensions:** 384
- **Quality:** Very Good
- **Best for:** Balanced quality/size
- **Download:** https://huggingface.co/second-state/bge-small-en-v1.5-Embedding-GGUF

#### gte-small
- **Size:** ~33MB
- **Dimensions:** 384
- **Quality:** Very Good
- **Best for:** General text embedding
- **Download:** https://huggingface.co/second-state/gte-small-Embedding-GGUF

**How to download:**
1. Click the link above
2. Go to the "Files and versions" tab
3. Download the `.gguf` file (not the `.bin` or other formats)

### 2. Load the Embedding Model

1. Open the **Models** tab
2. Add your downloaded embedding model
3. Load it (this replaces your chat model temporarily)

## Testing Steps

### Step 1: Load Test Dataset

1. Go to the **Vector** tab
2. Tap **"Load Test Dataset"**
   - This loads 10 sample memories with embeddings
   - Takes ~5-20 seconds depending on device
3. Check the stats:
   - Should show 10 memories with 100% embeddings

### Step 2: Try Semantic Search

Test these queries to see semantic understanding:

**Query 1: "What programming languages do I like?"**
- **Should find:**
  - ✅ "I love programming in TypeScript"
  - ✅ "I enjoy coding with TS"
  - ✅ "Python is my second favorite language"
- **Why:** Understands "programming languages" = "TypeScript", "Python"

**Query 2: "What do I build?"**
- **Should find:**
  - ✅ "I work on React Native applications"
  - ✅ "I build mobile apps using React Native"
- **Why:** Understands "build" is related to "work on" and "applications"

**Query 3: "What colors do I prefer?"**
- **Should find:**
  - ✅ "My favorite color is blue"
- **Why:** Understands "prefer" = "favorite"

### Step 3: Compare Search Types

Try the same query with different search types:

**Vector Search:**
- Pure semantic matching
- Best for understanding meaning
- Example: "coding" will find "programming"

**Keyword Search:**
- Traditional FTS5 search
- Exact word matching only
- Example: "coding" will NOT find "programming"

**Hybrid Search (Recommended):**
- Combines both approaches
- Uses keywords to narrow down, then ranks by semantic similarity
- Best of both worlds

### Step 4: Check Similarity Scores

Each result shows:
- **Rank**: Position in results
- **Similarity %**: How close the match is (0-100%)
- **Source**: How it was found (vector/keyword/hybrid)

**What good scores look like:**
- 90-100%: Very strong semantic match
- 70-90%: Good match, related concepts
- 50-70%: Somewhat related
- <50%: Weak match, consider filtering

## Expected Results

### Test Dataset
The test dataset includes these memories:

```typescript
1. "I love programming in TypeScript" (preference)
2. "I enjoy coding with TS" (preference)
3. "My favorite color is blue" (preference)
4. "I work on React Native applications" (fact)
5. "I build mobile apps using React Native" (fact)
6. "I prefer coffee over tea" (preference)
7. "I wake up early in the morning" (habit)
8. "Python is my second favorite language" (preference)
9. "I live in San Francisco" (fact)
10. "I like listening to jazz music" (preference)
```

### Example Test Results

**Query: "What programming languages do I like?"**

**Vector Search Results:**
```
#1 - 92.3% match - "I love programming in TypeScript"
#2 - 89.1% match - "Python is my second favorite language"
#3 - 84.7% match - "I enjoy coding with TS"
#4 - 71.2% match - "I work on React Native applications"
#5 - 68.5% match - "I build mobile apps using React Native"
```

**Keyword Search Results:**
```
#1 - "I love programming in TypeScript"
(Only finds exact word matches - misses semantic connections!)
```

## Performance Benchmarks

**Typical performance on modern phones:**
- Embedding generation: 50-200ms per text
- Vector search (10 memories): <5ms
- Vector search (100 memories): <20ms
- Vector search (1000 memories): <100ms

## Troubleshooting

### "Embedding model not loaded"
- You need to load an embedding model first
- Go to Models tab and load a model with "embed" in the name

### "No results found"
- Check if memories have embeddings (see stats)
- Try increasing similarity threshold (lower is more permissive)
- Use hybrid search for better coverage

### Search is slow
- Embedding generation is one-time per memory
- Pre-generate embeddings with "Backfill Embeddings" button
- Vector search itself is very fast

### Low similarity scores
- Different embedding models give different scores
- Some models are more sensitive than others
- Scores < 50% usually mean weak match

## Advanced Usage

### Backfill Embeddings
If you have existing memories without embeddings:
1. Load embedding model
2. Tap "Backfill Embeddings"
3. Waits for all memories to be processed

### Clear Database
Removes all memories for fresh testing.

### Custom Test Queries
Type your own queries to test semantic understanding:
- "What beverages do I enjoy?" → coffee
- "Where do I live?" → San Francisco
- "What music do I like?" → jazz

## Technical Details

### Vector Storage
- Embeddings stored as BLOB in SQLite
- Typically 384 or 768 dimensions
- ~1.5KB per 384-dim vector
- ~3KB per 768-dim vector

### Cosine Similarity
Formula: `similarity = dot(A, B) / (||A|| * ||B||)`
- Measures angle between vectors
- 1.0 = identical meaning
- 0.0 = unrelated
- -1.0 = opposite meaning

### Hybrid Search Algorithm
1. Use FTS5 to get top 15 candidates (3x limit)
2. Calculate vector similarity for each
3. Re-rank by similarity
4. Return top 5 results

## Next Steps

After testing:
1. **Integrate with chat:** Add semantic memory recall to AI conversations
2. **Automatic embeddings:** Generate embeddings for new memories automatically
3. **Better models:** Try larger embedding models for quality
4. **Tune parameters:** Adjust similarity thresholds and search multipliers

## Success Criteria

✅ **Vector search is working if:**
- Semantic queries find related content (not just exact words)
- "programming" matches "coding", "development", etc.
- Similarity scores make sense (related = high, unrelated = low)
- Hybrid search combines best of both approaches

## Resources

- [Sentence Transformers](https://www.sbert.net/) - Embedding models
- [GGUF Models on HuggingFace](https://huggingface.co/models?library=gguf)
- [llama.rn Documentation](https://github.com/mybigday/llama.rn)
