---
title: LocalOS Project
tags: [project, ai, react-native, localos]
status: in-progress
priority: high
created: 2025-01-01T10:00:00Z
updated: 2025-01-24T14:30:00Z
---

# LocalOS Project

Building a privacy-first AI chat app that runs entirely on-device.

## Overview

LocalOS is a React Native mobile app that provides an AI assistant powered by local LLM inference. No data leaves your device.

## Current Features

- ✅ Local LLM inference using llama.rn
- ✅ Function calling with tools (datetime, web search)
- ✅ Streaming responses
- ✅ Model management
- ✅ Chat history

## Planned Features

- [ ] Memory system with vector search
- [ ] Obsidian integration for knowledge base
- [ ] Multi-modal support (images, audio)
- [ ] Graph view of linked memories
- [ ] Conversation summarization

## Technical Stack

**Frontend:**
- React Native 0.82
- TypeScript
- React Hooks

**AI/ML:**
- llama.rn for inference
- Transformers.js for embeddings
- SQLite for vector storage

**Storage:**
- @op-engineering/op-sqlite
- react-native-fs
- AsyncStorage

## Architecture

See [[Architecture Overview]] for detailed technical architecture.

## Related Notes

- [[React Native Best Practices]]
- [[Vector Search Overview]]
- [[AI Model Selection Guide]]

#project #ai #react-native #mobile
