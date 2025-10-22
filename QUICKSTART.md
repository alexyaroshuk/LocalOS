# LocalOS - Quick Start Guide

Get your local AI chat app running in minutes!

## Prerequisites

- ✅ Node.js 20+ installed
- ✅ Android Studio (for Android) OR Xcode (for iOS)
- ✅ Physical device with 6GB+ RAM recommended (emulators work but slower)

## 1. Installation (5 minutes)

```bash
# Navigate to the app directory
cd LocalOSApp

# Install dependencies
npm install

# iOS only: Install CocoaPods
cd ios
bundle install
bundle exec pod install
cd ..
```

## 2. Run the App (2 minutes)

### Android
```bash
# Connect your Android device or start emulator
npm run android
```

### iOS
```bash
# Start iOS simulator or connect device
npm run ios
```

## 3. Download & Load a Model (5-10 minutes)

1. **Open the app** - You'll see the Chat screen
2. **Tap "Models"** at the bottom
3. **Choose a model** - Recommended: Llama 3.2 3B (2GB)
4. **Tap "Download"** - Confirm and wait (~5 min on good wifi)
5. **Tap "Load"** - After download completes
6. **Tap "Chat"** - Go back to chat screen
7. **Start chatting!** - Type a message and send

## 4. Test It Out

Try these prompts:
- "Hello! What can you help me with?"
- "Explain quantum computing in simple terms"
- "Write a haiku about coding"
- "What's the capital of France?"

## Troubleshooting

### App won't start
```bash
# Clear caches and reinstall
cd LocalOSApp
rm -rf node_modules
npm install

# iOS: Clear pods
cd ios
rm -rf Pods
bundle exec pod install
cd ..
```

### Model download fails
- Check internet connection
- Ensure 3GB+ free storage
- Try again (it will resume)

### Slow generation
- Close background apps
- Try Gemma 2B (smaller, faster)
- Restart the app

## Performance Tips

| Device RAM | Recommended Model | Expected Speed |
|------------|-------------------|----------------|
| 4-6GB | Gemma 2B Q4 | 3-7 tokens/sec |
| 6-8GB | Llama 3.2 3B Q4 | 8-15 tokens/sec |
| 8GB+ | Any model | 10-20 tokens/sec |

## What's Next?

- Try different models (Phi-3 is great for code)
- Start multiple conversations
- Adjust temperature in `src/utils/constants.ts`
- Build for production (see README_LOCALOS.md)

## File Locations

- **Models**: Stored in app's document directory
- **Chats**: Saved in AsyncStorage
- **Config**: `src/utils/constants.ts`

## Need Help?

- Check [README_LOCALOS.md](./LocalOSApp/README_LOCALOS.md) for detailed docs
- Review [plan.md](./plan.md) for implementation details
- Check llama.rn issues: https://github.com/mybigday/llama.rn/issues

---

🎉 **Congrats! You now have a fully offline AI assistant running on your device!**
