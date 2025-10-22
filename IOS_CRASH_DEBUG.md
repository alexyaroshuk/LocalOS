# iOS App Crash on Launch - Debugging Guide

## 🔍 Get Crash Logs

### Method 1: Xcode Console (Best)

1. **Open Xcode**
2. **Window** → **Devices and Simulators**
3. Select your **Simulator**
4. Click **"Open Console"** button (bottom right)
5. **Run your app**
6. Watch logs in real-time
7. Look for **red error messages**

### Method 2: Terminal Logs

```bash
# Watch simulator logs in real-time
xcrun simctl spawn booted log stream --level=debug --predicate 'processImagePath contains "LocalOSApp"'
```

Or simpler:
```bash
# All simulator logs
xcrun simctl spawn booted log stream --level=debug
```

### Method 3: Crash Reports

```bash
# View crash logs
open ~/Library/Logs/DiagnosticReports/

# Or find specific crash
ls -lt ~/Library/Logs/DiagnosticReports/ | grep LocalOSApp | head -5
```

---

## 🚨 Common React Native Crash Causes

### 1. **Metro Bundler Not Running**

**Symptom**: Red screen or immediate crash

**Fix**:
```bash
# Terminal 1: Start Metro
npm start

# Terminal 2: Run app
npm run ios
```

### 2. **llama.rn Native Module Issue**

**Symptom**: Crash immediately on startup

**Possible causes**:
- llama.rn native frameworks not linked
- Missing CocoaPods install
- Architecture mismatch (simulator vs device)

**Fix**:
```bash
# Clean and reinstall
cd ios
rm -rf Pods Podfile.lock build
bundle exec pod install
cd ..

# Clean build
npm run ios -- --reset-cache
```

### 3. **Wrong SDK/Architecture**

**Symptom**: "dyld: Symbol not found" or instant crash

**Check**: Are you building for simulator but running on device (or vice versa)?

**Fix**: Make sure:
- Simulator build → Run on simulator
- Device build → Run on device

### 4. **Missing Permissions**

**Symptom**: Crash when accessing file system

**Fix**: Check `Info.plist` has required permissions

---

## 🔧 Quick Debugging Steps

### Step 1: Check if Metro is Running

```bash
# Should show "Metro is running"
curl http://localhost:8081/status
```

If not:
```bash
npm start
```

### Step 2: Clean Everything

```bash
# Clean React Native
npm start -- --reset-cache

# Clean iOS
cd ios
xcodebuild clean
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf build
cd ..
```

### Step 3: Rebuild from Scratch

```bash
# Reinstall pods
cd ios
bundle exec pod install
cd ..

# Run with verbose logging
npx react-native run-ios --verbose
```

### Step 4: Check Xcode Build Logs

1. Open `ios/LocalOSApp.xcworkspace` in Xcode
2. **Product** → **Clean Build Folder** (Cmd+Shift+K)
3. **Product** → **Build** (Cmd+B)
4. Look for **errors** in build log

---

## 🐛 llama.rn Specific Issues

### Issue: "Library not loaded: @rpath/rnllama.framework"

**Cause**: llama.rn framework not embedded

**Fix**:
```bash
cd ios
pod deintegrate
pod install
```

Then in Xcode:
1. Open project
2. **Target** → **LocalOSApp**
3. **General** tab
4. **Frameworks, Libraries, and Embedded Content**
5. Ensure `rnllama.framework` is **"Embed & Sign"**

### Issue: Crash in llama.cpp initialization

**Cause**: Trying to load model on startup, model doesn't exist

**Fix**: Check your code doesn't auto-load models:
```typescript
// DON'T do this on app start:
useEffect(() => {
  loadModel(); // ❌ Will crash if model doesn't exist
}, []);

// DO this instead:
useEffect(() => {
  // Only initialize storage
  initializeStorage();
}, []);
```

---

## 📱 If Default Flutter App Also Crashes

This suggests a **simulator/Xcode issue**, not your code:

### Fix 1: Reset Simulator

```bash
# List simulators
xcrun simctl list devices

# Erase specific simulator (e.g., iPhone 15)
xcrun simctl erase "iPhone 15"

# Or erase all
xcrun simctl erase all
```

### Fix 2: Update Xcode Command Line Tools

```bash
# Check current version
xcode-select --print-path

# Reset
sudo xcode-select --reset

# Or set manually
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

### Fix 3: Reinstall Simulator Runtime

1. Open **Xcode**
2. **Settings** → **Platforms**
3. Click **"+"** to download iOS runtime
4. Delete old runtime, download fresh

---

## 🔍 Analyze Crash Log

If you get a crash log, look for:

### Key Sections:

```
Exception Type: EXC_CRASH (SIGKILL)
Exception Codes: 0x0000000000000000, 0x0000000000000000
Termination Reason: DYLD 1 Library missing
```

**Common patterns**:

| Error | Meaning | Fix |
|-------|---------|-----|
| `DYLD ... Library missing` | Framework not found | `pod install` |
| `EXC_BAD_ACCESS` | Memory crash | Check native code |
| `SIGABRT` | Assertion failure | Check logs for assert |
| `SIGKILL` | iOS killed app | Too much memory/CPU |

---

## 💡 Pro Debugging Tips

### Enable Zombie Objects

In Xcode scheme:
1. **Product** → **Scheme** → **Edit Scheme**
2. **Run** → **Diagnostics**
3. Enable **"Zombie Objects"**
4. Enable **"Address Sanitizer"**
5. Run again - will show exact crash point

### Add Exception Breakpoint

In Xcode:
1. **Debug** → **Breakpoints** → **Create Exception Breakpoint**
2. Run app
3. Will pause exactly where crash happens

### Check React Native Console

```bash
# Open React Native debugger
npm start

# Then in app, shake device/simulator
# Press "Debug JS Remotely"
# Check browser console for JS errors
```

---

## 🚀 Quick Test: Minimal App

Create a minimal test to isolate issue:

Edit `App.tsx`:
```typescript
import React from 'react';
import {View, Text} from 'react-native';

function App() {
  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Text>Hello World</Text>
    </View>
  );
}

export default App;
```

If this works → Your app code has the issue
If this crashes → System/environment issue

---

## 📋 Checklist for Your Case

Since **both React Native AND Flutter crash**:

- [ ] Try different simulator (iPhone 14, 15, etc.)
- [ ] Reset simulator: `xcrun simctl erase all`
- [ ] Check Xcode version: Should be 16.1+
- [ ] Check macOS version: Should be Sonoma 14.0+
- [ ] Restart Mac (seriously, helps sometimes)
- [ ] Reinstall Xcode Command Line Tools
- [ ] Check disk space (need 20GB+ free)
- [ ] Check Activity Monitor for hung processes

---

## 🎯 Most Likely Causes for You

Since **Flutter also crashes**, this is **NOT** a React Native or llama.rn issue.

**Top suspects**:
1. **Simulator is corrupted** → Reset it
2. **Xcode installation issue** → Reinstall command line tools
3. **macOS issue** → Restart, check updates
4. **Disk space** → Need 20GB+ free

---

## 📞 Get Specific Crash Info

Run this and send me output:

```bash
# Get last crash log
ls -lt ~/Library/Logs/DiagnosticReports/ | head -3

# Or view directly
cat ~/Library/Logs/DiagnosticReports/LocalOSApp*.crash | head -100
```

**Send me**:
1. The crash log (first 50 lines)
2. Xcode console output
3. What simulator you're using
4. macOS version

Then I can give specific fix! 🔧
