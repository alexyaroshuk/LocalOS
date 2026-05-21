# LocalOS

A React Native app that runs large language models entirely on-device. No cloud, no API keys — inference runs locally via llama.cpp on Android/iOS, or Apple's Neural Engine on iOS 18+.

**What it does:** Chat with a local AI that can read, search, and write your Obsidian vault — semantic search via local embeddings, tool calling, multi-step web research.

## Highlights

- **Three inference backends** — llama.cpp, Apple Intelligence (Neural Engine), LM Studio
- **Obsidian vault integration** — chunk, embed, and semantically search markdown notes on-device
- **Tool calling with orchestration** — web search → fetch → synthesize in one response
- **Dual-model support** — run chat and embedding models simultaneously (Llama 3.1 8B + Nomic Embed)
- **Voice input** — speech-to-text via Whisper (ggml-base)
- **GPU acceleration** — Metal (iOS) and OpenCL (Android)
- **Chat sessions** — conversation history persisted in SQLite

## Tech Stack

- **Framework**: React Native 0.82.1
- **AI Engine**: llama.cpp via llama.rn + Apple Intelligence (iOS 18+)
- **Database**: SQLite (op-sqlite) with FTS5 + cosine similarity vector search
- **AI SDK**: Vercel AI SDK (Apple Intelligence tool calling)
- **Language**: TypeScript

## Requirements

- Node.js 20+
- iOS 18+ (for Apple Intelligence) or iOS 14+
- Android device with 6GB+ RAM recommended

## Quick Start

```bash
# Install dependencies
npm install

# iOS (install pods first)
cd ios && pod install && cd ..
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Architecture

```
src/
├── services/
│   ├── AIService.ts            # Unified AI interface (llama / Apple / LM Studio)
│   ├── LlamaService.ts         # llama.cpp wrapper with dual-instance support
│   ├── LMStudioService.ts      # LM Studio OpenAI-compatible client
│   ├── AppleIntelligenceService.ts
│   ├── VaultService.ts         # Obsidian vault scanning and markdown parsing
│   ├── VaultIndexService.ts    # Semantic search index (vault_chunks)
│   ├── DatabaseService.ts      # SQLite + FTS5 + vector search
│   ├── SessionService.ts       # Chat session persistence
│   ├── ToolService.ts          # Tool registry and execution
│   ├── OrchestrationService.ts # Multi-step web search workflows
│   └── EmbeddingService.ts     # Embedding generation and backfill
├── screens/             # App screens
├── components/          # UI components
├── types/               # TypeScript definitions
└── utils/               # Helpers
```

## Documentation

See `md/README_LOCALOS.md` for detailed usage, troubleshooting, and project structure.

## License

MIT
