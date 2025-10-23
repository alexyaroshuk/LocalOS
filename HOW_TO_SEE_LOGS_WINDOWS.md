# How to See Logs on Windows with iPhone Connected

## Problem: Can't See JavaScript Console Logs

You're seeing **iOS system logs** but not **JavaScript console logs**. They're different!

---

## ✅ Solution 1: In-App Debug Screen (EASIEST)

I created a special debug screen that shows all the info **directly in your app's UI**!

### How to Use It:

**Option A: Temporary - Replace ChatScreen**

Edit `App.tsx`:

```typescript
// At the top, add:
import {DebugInfoScreen} from './src/screens/DebugInfoScreen';

// In your App component, temporarily replace ChatScreen with:
return <DebugInfoScreen />;
```

**Option B: Add as a Tab**

If you have navigation, add it as a new screen/tab.

### What You'll See:

```
🔍 Debug Information                [Refresh]

=== DEVICE INFO ===
Platform: ios
Version: 17.5

=== AI BACKEND DETECTION ===
✓ Running on iOS

Checking Apple Intelligence...
❌ Apple Intelligence: NOT AVAILABLE
   Reason: iOS 17.5 < iOS 18

Initializing AI Service...
✅ Backend initialized: llama
   Model: No model loaded
   Ready: false

=== RECOMMENDATIONS ===
Your iOS version is too old for Apple Intelligence
Current: iOS 17.5
Required: iOS 18.0+

Recommendation: Use Llama.cpp
Load a GGUF model from Models screen
```

---

## ✅ Solution 2: Metro Bundler Terminal

When you run `npm run ios`, a terminal window shows Metro bundler. **JavaScript logs appear there!**

### Steps:

**Terminal 1 (Metro Bundler):**
```bash
cd d:\dev\projects\localOS
npm start
```
☝️ **WATCH THIS WINDOW** - logs appear here!

**Terminal 2 (Run App):**
```bash
cd d:\dev\projects\localOS
npm run ios
```

### What to Look For in Terminal 1:

```
 LOG  ==================================================
 LOG  🔍 AI BACKEND DETECTION
 LOG  ==================================================
 LOG  Platform: ios
 LOG  Platform Version: 17.5
 LOG  --------------------------------------------------
 LOG  ✓ Running on iOS - checking Apple Intelligence...
 LOG    → Checking Apple Intelligence availability...
 LOG    ✓ Platform is iOS
 LOG    ✓ iOS Version: 17.5
 LOG    ✗ Apple Intelligence package NOT loaded
```

---

## ✅ Solution 3: React Native Debugger (Windows)

Best debugging experience on Windows!

### Install:

**Download from GitHub:**
https://github.com/jhen0409/react-native-debugger/releases

Get: `rn-debugger-windows-x64.zip`

### Use:

1. Launch React Native Debugger
2. In Metro terminal, press `Ctrl+D` (or shake iPhone)
3. Select "Debug"
4. All console.logs appear in debugger window

---

## ✅ Solution 4: VS Code Debug Console

### Install Extension:

```bash
code --install-extension msjsdiag.vscode-react-native
```

### Use:

1. Open project in VS Code
2. Press `F5` → Select "React Native: iOS"
3. Logs appear in "Debug Console" tab at bottom

---

## 🎯 Quick Start: Use In-App Debug Screen

**Right now, do this:**

1. **Edit `App.tsx`** - Find the main return statement

2. **Add this import** at the top:
```typescript
import {DebugInfoScreen} from './src/screens/DebugInfoScreen';
```

3. **Temporarily replace the content** with:
```typescript
return <DebugInfoScreen />;
```

4. **Save and reload app** (shake iPhone → Reload, or press `r` in Metro)

5. **You'll see the debug info on screen!**

---

## 📱 What's the Difference?

| Log Type | Where It Goes | What You See |
|----------|--------------|--------------|
| **System logs** | Device logs (sideloader) | iOS system messages, app lifecycle |
| **JavaScript logs** | Metro bundler terminal | console.log(), console.error() |
| **Native logs** | Xcode console | NSLog, Swift print() |

Your `logs.txt` shows **system logs** only. JavaScript logs are in **Metro terminal**.

---

## 🔍 Expected Output

Once you see the logs (in Metro terminal or Debug screen), you'll see one of:

### If iOS < 18:
```
❌ Apple Intelligence: NOT AVAILABLE
   Reason: iOS 17.5 < iOS 18
```
**Solution:** Use Llama.cpp (load GGUF model)

### If iOS 18+ but package not installed:
```
❌ Apple Intelligence: NOT AVAILABLE
   Reason: Package not installed
```
**Solution:**
```bash
npm install @react-native-ai/apple
cd ios && pod install && cd ..
```

### If iOS 18+ with package:
```
✅ Apple Intelligence: AVAILABLE
```
**Success!** 🎉

---

## 🚀 Quickest Way (Right Now)

1. Add debug screen to App.tsx
2. Reload app
3. Take a screenshot of the debug screen
4. Share it - we'll know exactly what's wrong!

The debug screen shows everything we need to diagnose the issue.
