# Embedding Models Quick Reference

## GGUF-Compatible Embedding Models for llama.rn

All models below are compatible with LocalOS and llama.rn. Download the `.gguf` file.

---

## ⭐ Recommended: all-MiniLM-L6-v2

**Best for beginners - small, fast, good quality**

- **Size:** 25MB
- **Dimensions:** 384
- **Quality:** Good (77.0 on MTEB)
- **Speed:** Very Fast (~50ms per embedding on mobile)
- **Use case:** General-purpose semantic search
- **Download:** [All-MiniLM-L6-v2-Embedding-GGUF](https://huggingface.co/second-state/All-MiniLM-L6-v2-Embedding-GGUF)

---

## 🏆 Best Quality: nomic-embed-text-v1.5

**Best results - larger but higher quality**

- **Size:** 130MB
- **Dimensions:** 768
- **Quality:** Excellent (62.4 on MTEB)
- **Speed:** Medium (~150ms per embedding on mobile)
- **Use case:** When quality matters more than speed
- **Download:** [nomic-embed-text-v1.5-GGUF](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF)

---

## ⚖️ Balanced: bge-small-en-v1.5

**Good balance of size and quality**

- **Size:** 35MB
- **Dimensions:** 384
- **Quality:** Very Good (62.2 on MTEB)
- **Speed:** Fast (~70ms per embedding on mobile)
- **Use case:** Production use with good quality
- **Download:** [bge-small-en-v1.5-Embedding-GGUF](https://huggingface.co/second-state/bge-small-en-v1.5-Embedding-GGUF)

---

## 🔧 Alternative: gte-small

**Another solid option**

- **Size:** 33MB
- **Dimensions:** 384
- **Quality:** Very Good (61.4 on MTEB)
- **Speed:** Fast (~70ms per embedding on mobile)
- **Use case:** General text embedding
- **Download:** [gte-small-Embedding-GGUF](https://huggingface.co/second-state/gte-small-Embedding-GGUF)

---

## Comparison Table

| Model | Size | Dims | Quality | Speed | Best For |
|-------|------|------|---------|-------|----------|
| **all-MiniLM-L6-v2** | 25MB | 384 | Good | ⚡⚡⚡ | Getting started |
| **nomic-embed-text** | 130MB | 768 | Excellent | ⚡ | Best results |
| **bge-small-en** | 35MB | 384 | Very Good | ⚡⚡ | Production |
| **gte-small** | 33MB | 384 | Very Good | ⚡⚡ | Alternative |

---

## How to Download

1. Click the model link above
2. Go to **"Files and versions"** tab
3. Download the **`.gguf`** file
4. Save to your device (e.g., Downloads folder)

---

## How to Load in LocalOS

1. Open LocalOS app
2. Go to **Models** tab
3. Tap **"Add Model"**
4. Select the downloaded `.gguf` file
5. Give it a name (e.g., "MiniLM Embeddings")
6. Tap **"Load Model"**

---

## Model Requirements

✅ **Must be GGUF format** (not safetensors, pytorch, etc.)
✅ **Must be an embedding model** (not a chat/completion model)
✅ **Compatible with llama.cpp** (the underlying engine)

❌ **Will NOT work:**
- Chat models (Llama, Mistral, etc.)
- Non-GGUF formats (.bin, .safetensors, .pth)
- Quantized chat models (even if GGUF)

---

## Storage Requirements

**Per 1000 memories:**

| Model Dimensions | Storage per Memory | Storage per 1000 |
|-----------------|-------------------|------------------|
| 384 (small) | ~1.5KB | ~1.5MB |
| 768 (large) | ~3KB | ~3MB |

**Example:** With 10,000 memories using 384-dim embeddings = ~15MB of embedding storage

---

## Performance Benchmarks

**Typical mobile performance (iPhone/Android mid-range):**

| Operation | all-MiniLM | bge-small | nomic-embed |
|-----------|------------|-----------|-------------|
| Generate embedding | 50ms | 70ms | 150ms |
| Search 100 vectors | <5ms | <5ms | <10ms |
| Search 1000 vectors | <50ms | <50ms | <100ms |

---

## Quality Metrics (MTEB Benchmark)

Higher is better (0-100 scale):

- **nomic-embed-text-v1.5:** 62.4 (Best)
- **bge-small-en-v1.5:** 62.2
- **gte-small:** 61.4
- **all-MiniLM-L6-v2:** 58.8

*Note: Even the "lowest" quality model is very good for most use cases!*

---

## Which Model Should I Choose?

### Choose **all-MiniLM-L6-v2** if:
- 🆕 You're just testing
- ⚡ You want fastest performance
- 📱 You have limited storage
- 🎯 General-purpose search is enough

### Choose **bge-small-en-v1.5** if:
- 🏭 You're deploying to production
- ⚖️ You want best balance
- 💪 You need better quality than MiniLM
- 📦 You can spare 35MB

### Choose **nomic-embed-text-v1.5** if:
- 🏆 You need the best quality
- 🔍 Your use case demands high accuracy
- 💾 You have 130MB to spare
- ⏱️ Extra 100ms per embedding is acceptable

### Choose **gte-small** if:
- 🔄 You want an alternative to bge-small
- 🧪 You're testing different models
- 📊 You're comparing performance

---

## Troubleshooting

### "Model failed to load"
- ✅ Ensure it's a `.gguf` file
- ✅ Check if it's an embedding model (not chat)
- ✅ Verify file isn't corrupted (re-download)

### "Embeddings not working"
- ✅ Make sure you loaded an embedding model
- ✅ Check model name contains "embed"
- ✅ Try the recommended all-MiniLM-L6-v2 first

### "Too slow"
- ✅ Use a smaller model (all-MiniLM)
- ✅ Use 384-dim instead of 768-dim
- ✅ Pre-generate embeddings (backfill)

---

## Additional Resources

- **MTEB Leaderboard:** https://huggingface.co/spaces/mteb/leaderboard
- **Sentence Transformers:** https://www.sbert.net/
- **GGUF Format Spec:** https://github.com/ggerganov/ggml/blob/master/docs/gguf.md
- **llama.rn Documentation:** https://github.com/mybigday/llama.rn

---

## Last Updated

2025-10-26 - Phase A Vector Search Implementation
