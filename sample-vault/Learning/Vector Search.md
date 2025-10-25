---
title: Vector Search Overview
tags: [ai, embeddings, search, learning]
source: research
created: 2025-01-05T14:00:00Z
updated: 2025-01-20T16:45:00Z
---

# Vector Search

Vector search (also called semantic search) finds similar items based on **meaning** rather than exact keyword matches.

## How It Works

1. **Convert text to embeddings** (dense vectors)
   - Use a pre-trained model (e.g., sentence-transformers)
   - Each text becomes a point in high-dimensional space
   - Similar texts have similar vectors

2. **Store vectors in a database**
   - SQLite with vector extension
   - Specialized vector DBs (Pinecone, Weaviate, Qdrant)
   - In-memory indexes

3. **Compare query vector to stored vectors**
   - Calculate similarity metrics
   - Rank results by similarity score

4. **Return most similar results**
   - Top-k nearest neighbors
   - Optional filtering by metadata

## Similarity Metrics

### Cosine Similarity (Most Common)

Measures the angle between vectors. Range: -1 to 1 (higher is more similar).

```
similarity = (A · B) / (||A|| * ||B||)
```

**Pros:**
- Normalized (length-independent)
- Works well for text embeddings
- Efficient to compute

**Use for:** Text search, document similarity

### Euclidean Distance

Measures straight-line distance between points.

```
distance = sqrt(Σ(A_i - B_i)²)
```

**Pros:**
- Intuitive geometric meaning
- Good for spatial data

**Use for:** Image embeddings, spatial queries

### Dot Product

Measures alignment between vectors.

```
similarity = A · B = Σ(A_i * B_i)
```

**Pros:**
- Fastest to compute
- Works if vectors are normalized

**Use for:** When speed is critical

## Embedding Models

### Popular Models

| Model | Dimensions | Size | Use Case |
|-------|-----------|------|----------|
| all-MiniLM-L6-v2 | 384 | 23MB | General purpose |
| all-mpnet-base-v2 | 768 | 420MB | High quality |
| text-embedding-ada-002 | 1536 | API | OpenAI API |
| multilingual-e5-base | 768 | 560MB | Multi-language |

### For Mobile (LocalOS)

We use `all-MiniLM-L6-v2`:
- Small size (23MB)
- Fast inference (~100-200ms)
- Good quality for general use
- Runs offline with Transformers.js

## Use Cases

### Semantic Search in Documents

```typescript
// Example: Search technical documentation
query: "how to optimize performance"

// Traditional keyword search might miss:
doc: "improving app speed and responsiveness"

// Vector search finds it because:
// "optimize performance" ≈ "improving speed"
```

### Recommendation Systems

Find similar items based on content:
- "Users who liked X also liked Y"
- Content-based filtering
- Personalized feeds

### Duplicate Detection

Identify near-duplicate content:
- Plagiarism detection
- Deduplication of documents
- Finding variations of same question

### Question Answering

Find relevant context for questions:
- RAG (Retrieval-Augmented Generation)
- Chatbots with knowledge base
- FAQ systems

## Implementation in LocalOS

See [[LocalOS Project]] for our implementation using:
- SQLite for storage (@op-engineering/op-sqlite)
- Transformers.js for embeddings
- Cosine similarity for search

## Challenges & Solutions

### Challenge: High Dimensionality
**Solution:** Use dimensionality reduction (PCA, UMAP) or smaller models

### Challenge: Index Size
**Solution:** Vector quantization, product quantization

### Challenge: Query Speed
**Solution:** Approximate nearest neighbor (ANN) algorithms like HNSW

### Challenge: Cold Start
**Solution:** Hybrid search (combine with keyword search)

## Further Reading

- [[AI Model Selection Guide]]
- [[SQLite on Mobile]]
- Sentence Transformers documentation
- FAISS library for large-scale search

#ai #embeddings #search #vector-database
