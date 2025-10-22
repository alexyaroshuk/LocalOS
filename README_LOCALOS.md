# LocalOS - Local AI Chat App

A React Native application that runs AI language models completely offline using llama.rn and llama.cpp.

## Features

✅ **Completely Offline** - All inference happens on-device
✅ **Multiple Models** - Support for Llama 3.2, Phi-3, Gemma, and more
✅ **GPU Acceleration** - Metal (iOS) and OpenCL (Android) support
✅ **Streaming Responses** - Token-by-token generation display
✅ **Chat History** - Persistent conversation storage
✅ **Model Management** - Download, load, and manage GGUF models
✅ **Memory Efficient** - Optimized for mobile devices

## Tech Stack

- **Framework**: React Native 0.82.1
- **AI Engine**: llama.rn 0.8.0 (llama.cpp bindings)
- **Storage**: AsyncStorage + react-native-fs
- **Language**: TypeScript
- **Platform**: iOS & Android

## Requirements

### Hardware
- **iOS**: iPhone 12 or newer (recommended 6GB+ RAM)
- **Android**: Device with 6GB+ RAM, Snapdragon 8 Gen 1+ or equivalent
- **Storage**: 2-4GB free space per model

### Software
- Node.js 20+
- React Native CLI
- Xcode 14+ (for iOS)
- Android Studio (for Android)

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. iOS Setup

```bash
cd ios
bundle install
bundle exec pod install
cd ..
```

### 3. Android Setup

No additional setup needed - dependencies are auto-linked.

## Running the App

### iOS

```bash
npm run ios
```

Or open `ios/LocalOSApp.xcworkspace` in Xcode and run.

### Android

```bash
npm run android
```

Or open the `android` folder in Android Studio and run.

## Usage

### First Time Setup

1. **Launch the app** - You'll see the Chat screen
2. **Go to Models tab** - Tap "Models" in the bottom navigation
3. **Download a model**:
   - Tap "Download" on any model (Llama 3.2 3B recommended)
   - Wait for download to complete (2-4GB, takes a few minutes)
4. **Load the model** - Tap "Load" after download completes
5. **Start chatting** - Go back to Chat tab and start a conversation!

### Recommended Models

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| **Llama 3.2 3B (Q4)** | ~2GB | Fast | Excellent | General chat, recommended |
| **Phi-3 Mini (Q4)** | ~2.3GB | Fast | Very Good | Reasoning, code |
| **Gemma 2B (Q4)** | ~1.5GB | Very Fast | Good | Quick responses |

## Project Structure

```
src/
├── components/          # UI components
│   ├── ChatMessage.tsx
│   └── TypingIndicator.tsx
├── screens/             # Main screens
│   ├── ChatScreen.tsx
│   └── ModelsScreen.tsx
├── services/            # Business logic
│   ├── LlamaService.ts         # llama.cpp wrapper
│   ├── ModelStorageService.ts  # File management
│   └── StorageService.ts       # Data persistence
├── types/               # TypeScript definitions
│   └── index.ts
└── utils/               # Helper functions
    ├── constants.ts
    └── helpers.ts
```

## Configuration

### Llama Configuration

Edit `src/utils/constants.ts` to adjust model parameters:

```typescript
export const DEFAULT_LLAMA_CONFIG = {
  contextSize: 2048,      // Context window size
  temperature: 0.7,       // Randomness (0.0-2.0)
  topP: 0.9,             // Nucleus sampling
  topK: 40,              // Top-K sampling
  maxTokens: 512,        // Max response length
  repeatPenalty: 1.1,    // Repetition penalty
  nGpuLayers: 99,        // GPU layers (auto)
};
```

## Performance Tips

1. **Use Q4 quantization** - Best balance of speed and quality
2. **Close background apps** - Free up RAM for the model
3. **Keep context short** - Fewer messages = faster generation
4. **Lower temperature** - 0.6-0.7 for faster, more focused responses

## Troubleshooting

### Model won't load
- Check available storage (need 500MB buffer)
- Ensure model download completed successfully
- Try restarting the app

### Slow generation
- Your device may have insufficient RAM
- Try a smaller model (Gemma 2B)
- Reduce `contextSize` in constants.ts

### Out of memory
- Close other apps
- Clear app data and restart
- Use a smaller model

## Roadmap

- [ ] System prompts customization
- [ ] Export/import conversations
- [ ] Voice input support
- [ ] Multi-modal models (vision)
- [ ] Custom model import
- [ ] Settings screen for advanced config
- [ ] Dark mode

## Acknowledgments

- [llama.cpp](https://github.com/ggerganov/llama.cpp) - The amazing C++ LLM inference engine
- [llama.rn](https://github.com/mybigday/llama.rn) - React Native bindings for llama.cpp
- Model creators: Meta (Llama), Microsoft (Phi), Google (Gemma)

---

**Made with ❤️ for offline AI enthusiasts**
