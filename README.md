# LocalOS - Local AI Chat App

A React Native mobile application that runs AI language models completely offline using llama.cpp and optional Apple Intelligence integration on iOS 18+.

## Features

- **Completely Offline** - All inference happens on-device
- **Apple Intelligence** - Uses Neural Engine on iOS 18+ devices
- **Local Models** - Support for Llama 3.2, Phi-3, Gemma, and GGUF models
- **GPU Acceleration** - Metal (iOS) and OpenCL (Android)
- **Streaming Responses** - Token-by-token generation
- **Memory System** - Letta-style core + archival memory
- **Semantic Search** - Vector embeddings with FTS5 search
- **Tool Calling** - Function calling with Pythonic and XML formats

## Tech Stack

- **Framework**: React Native 0.82.1
- **AI Engine**: llama.cpp via llama.rn + Apple Intelligence
- **Database**: @op-engineering/op-sqlite with FTS5
- **AI SDK**: Vercel AI SDK (Apple Intelligence)
- **Language**: TypeScript

## Requirements

- Node.js 20+
- iOS 18+ (for Apple Intelligence) or iOS 14+
- Android device with 6GB+ RAM

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
├── services/            # Business logic
│   ├── AIService.ts            # Unified AI interface
│   ├── LlamaService.ts         # llama.cpp wrapper
│   ├── AppleIntelligenceService.ts
│   ├── MemoryService.ts        # Core memory blocks
│   ├── DatabaseService.ts      # SQLite + vector search
│   └── ToolService.ts          # Tool registry
├── screens/             # App screens
├── components/          # UI components
├── types/               # TypeScript definitions
└── utils/               # Helpers
```

## Documentation

See `md/README_LOCALOS.md` for detailed usage, troubleshooting, and project structure.

## License

MIT
