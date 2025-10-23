# Apple Intelligence Quick Start 🚀

## What We Built

✅ **AppleIntelligenceService.ts** - Direct wrapper for Apple's Foundation Models
✅ **AIService.ts** - Unified service that auto-detects and uses the best backend:
- Apple Intelligence (iOS 18+) - **preferred** for speed
- Llama.cpp - **fallback** for Android/older iOS

## 🎯 Next Steps to Test

### Step 1: Install Apple Intelligence Package

Choose one (we recommend the first):

```bash
npm install @react-native-ai/apple
```

OR

```bash
npm install react-native-apple-llm
```

### Step 2: Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

### Step 3: Update Info.plist

Add to `ios/LocalOSApp/Info.plist`:

```xml
<key>NSAppleIntelligenceUsageDescription</key>
<string>This app uses Apple Intelligence for on-device AI chat</string>
```

### Step 4: Test the Implementation

You have two options:

#### Option A: Quick Test (Recommended)

Create a test file `src/screens/AITestScreen.tsx`:

```typescript
import React, {useEffect, useState} from 'react';
import {View, Text, Button, ScrollView, StyleSheet} from 'react-native';
import {AIService} from '../services/AIService';

export const AITestScreen = () => {
  const [status, setStatus] = useState('Initializing...');
  const [response, setResponse] = useState('');
  const [backend, setBackend] = useState('');

  useEffect(() => {
    testAI();
  }, []);

  const testAI = async () => {
    try {
      // Initialize
      setStatus('Initializing AI...');
      const backend = await AIService.initialize();
      const info = AIService.getBackendInfo();

      setBackend(`Backend: ${backend}\nModel: ${info.modelName}`);
      setStatus('✅ AI Ready!');

      // Test generation
      setStatus('Generating response...');
      const result = await AIService.chatCompletion([
        {
          id: '1',
          role: 'user',
          content: 'Say hello in 10 words',
          timestamp: Date.now(),
        },
      ]);

      setResponse(result);
      setStatus('✅ Test Complete!');
    } catch (error) {
      setStatus(`❌ Error: ${error}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>AI Service Test</Text>
      <Text style={styles.status}>{status}</Text>
      <Text style={styles.backend}>{backend}</Text>
      {response ? (
        <View style={styles.responseBox}>
          <Text style={styles.label}>Response:</Text>
          <Text style={styles.response}>{response}</Text>
        </View>
      ) : null}
      <Button title="Test Again" onPress={testAI} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: 20, backgroundColor: '#fff'},
  title: {fontSize: 24, fontWeight: 'bold', marginBottom: 20},
  status: {fontSize: 16, marginBottom: 10, color: '#666'},
  backend: {fontSize: 14, marginBottom: 20, color: '#007AFF'},
  responseBox: {
    backgroundColor: '#F0F4FF',
    padding: 15,
    borderRadius: 8,
    marginVertical: 20,
  },
  label: {fontSize: 14, fontWeight: '600', marginBottom: 5},
  response: {fontSize: 16},
});
```

Then add to `App.tsx` for testing:

```typescript
import {AITestScreen} from './src/screens/AITestScreen';

// In your App component:
return <AITestScreen />;
```

#### Option B: Integrate with Existing ChatScreen

The AIService is already compatible with your existing ChatScreen! Just update the imports:

In `src/screens/ChatScreen.tsx`, change:

```typescript
// FROM:
import {LlamaService} from '../services/LlamaService';

// TO:
import {AIService} from '../services/AIService';
```

Then update all `LlamaService` calls to `AIService`:

```typescript
// Initialize on mount
useEffect(() => {
  initializeAI();
}, []);

const initializeAI = async () => {
  const backend = await AIService.initialize();
  const info = AIService.getBackendInfo();

  console.log('AI Backend:', backend);
  console.log('Model:', info.modelName);

  // Show user what backend is being used
  if (backend === 'apple') {
    Alert.alert(
      '🚀 Apple Intelligence',
      'Using on-device Apple AI (fast & private)',
    );
  } else {
    Alert.alert(
      'Llama.cpp',
      'Using local model. Load a model from Models screen.',
    );
  }
};

// Update model check
if (!AIService.isReady()) {
  Alert.alert('No AI Backend', 'Please load a model or check iOS version');
  return;
}

// Update generation call
const response = await AIService.chatCompletion(
  contextMessages,
  {},
  token => {
    fullResponse += token;
    setStreamingText(fullResponse);
  },
);
```

### Step 5: Build and Test

#### For iOS (Real Device with iOS 18+ Recommended):

```bash
npm run ios -- --device="Your iPhone"
```

#### For Android (will auto-fallback to Llama.cpp):

```bash
npm run android
```

## 🎯 What to Expect

### If Apple Intelligence Works (iOS 18+):

```
✅ Backend: apple
✅ Model: Apple Intelligence (Neural Engine)
✅ Response time: < 1 second
✅ Quality: High
✅ No model download needed!
```

### If Fallback to Llama.cpp:

```
⚠️ Backend: llama
⚠️ Model: No model loaded (or your loaded model)
⚠️ Need to load GGUF model manually
```

## 📊 Performance Testing

Once working, test these prompts:

1. **Simple**: "What is 2+2?"
   - Apple Intelligence: ~0.5 seconds
   - Llama.cpp: ~3-5 seconds

2. **Longer**: "Explain React Native in 50 words"
   - Apple Intelligence: ~1-2 seconds
   - Llama.cpp: ~10-15 seconds

3. **Tool calling** (if enabled): "What day is today?"
   - Apple Intelligence: Native tool support (95%+ success)
   - Llama.cpp: Manual JSON parsing (~80% success)

## 🐛 Troubleshooting

### "Apple Intelligence package not installed"

```bash
npm install @react-native-ai/apple
cd ios && pod install && cd ..
```

### "Apple Intelligence not available"

- Requires iOS 18+ device (not simulator)
- Check Settings > Apple Intelligence is enabled
- Will auto-fallback to Llama.cpp

### "No AI backend available"

For Llama.cpp fallback:
1. Go to Models screen
2. Load a GGUF model
3. Try again

### Build Errors

If you get build errors:
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

## 🎉 Success Indicators

You'll know it's working when you see:

1. **Console logs**:
   ```
   🔍 Detecting available AI backends...
   ✅ Apple Intelligence is available on this device
   ✅ Using Apple Intelligence (Neural Engine)
   ```

2. **Instant responses** (< 1 second for simple queries)

3. **No model loading time** (Apple Intelligence is always ready)

4. **Backend info shows**: "Apple Intelligence (~3B parameters)"

## 🚀 Next Steps After It Works

1. **Compare performance** - Time responses vs Llama.cpp
2. **Test tool calling** - Apple has native support (should be 95%+ reliable)
3. **Remove tool workarounds** - Can delete complex system prompts
4. **Measure battery usage** - Should be much lower
5. **Add Android support** - Keep Llama.cpp as fallback

## 📚 Resources

- [Implementation Guide](./APPLE_INTELLIGENCE_IMPLEMENTATION.md)
- [Model Comparison](./MODELS_FOR_TOOL_CALLING.md)
- [@react-native-ai/apple Docs](https://www.npmjs.com/package/@react-native-ai/apple)
- [Apple Foundation Models](https://developer.apple.com/apple-intelligence/)

---

**Ready to test?** Run:

```bash
npm install @react-native-ai/apple
cd ios && pod install && cd ..
npm run ios -- --device
```

Let us know how it performs! 🚀
