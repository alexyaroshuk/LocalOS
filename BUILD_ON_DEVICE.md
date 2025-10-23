# Building on Physical Android Device

## Current Issue

The build is trying to use a Flutter emulator, but this is a **React Native** app. You should build directly on a **physical Android device** for better performance, especially for running LLM models.

---

## Prerequisites

### 1. Enable Developer Options on Your Android Phone

1. Open **Settings** on your Android device
2. Go to **About Phone**
3. Tap **Build Number** 7 times (you'll see "You are now a developer!")
4. Go back to **Settings** → **System** → **Developer Options**
5. Enable **USB Debugging**
6. Enable **Stay Awake** (optional, keeps screen on while charging)

### 2. Install ADB Drivers (Windows)

If you're on Windows and `adb devices` shows nothing when phone is connected:

1. Download **Google USB Driver**: https://developer.android.com/studio/run/win-usb
2. Or install via Android Studio: **SDK Manager** → **SDK Tools** → **Google USB Driver**
3. Connect phone via USB
4. Install driver when Windows prompts

---

## Step-by-Step: Build on Device

### Step 1: Connect Your Phone

1. Connect your Android phone to your computer via USB cable
2. On your phone, allow **USB Debugging** when prompted
3. Select **File Transfer** or **MTP** mode (not just charging)

### Step 2: Verify Connection

Open terminal and run:

```bash
adb devices
```

**Expected output:**
```
List of devices attached
1234567890ABCDEF    device
```

If you see `unauthorized`:
- Check your phone for authorization prompt
- Tap "Always allow from this computer"
- Run `adb devices` again

If you see nothing:
- Try different USB cable (some cables are charge-only)
- Try different USB port
- Restart ADB: `adb kill-server` then `adb devices`
- Install ADB drivers (Windows)

### Step 3: Build and Deploy

Once device is connected and shows as `device`:

```bash
npm run android
```

That's it! React Native will automatically:
- Detect your connected device
- Build the APK
- Install on your phone
- Launch the app

---

## Alternative: Manual Build

If `npm run android` doesn't work:

### Option 1: Build Debug APK
```bash
cd android
./gradlew assembleDebug
cd ..
```

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option 2: Install Manually
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Option 3: Build & Install
```bash
cd android
./gradlew installDebug
cd ..
```

---

## Why Build on Physical Device?

### ✅ Benefits:

1. **Better Performance**: Real CPU/GPU, not emulated
2. **Accurate Testing**: Real hardware, real sensors
3. **LLM Performance**: iPhone 16 will run Llama 3.2 3B faster than emulator
4. **Battery Testing**: See actual battery drain
5. **No Emulator Overhead**: Saves RAM on your computer

### ❌ Emulator Issues:

1. **Slow**: Emulated ARM on x86 is very slow
2. **No GPU**: LLM inference will be painfully slow
3. **Memory**: Emulators use 2-4GB RAM
4. **Inaccurate**: Different from real device behavior

---

## Troubleshooting

### Issue: `adb: command not found`

**Solution**: Add Android SDK platform-tools to PATH

**Windows**:
1. Find platform-tools: `C:\Users\<YourName>\AppData\Local\Android\Sdk\platform-tools`
2. Add to PATH: System → Advanced → Environment Variables → Path → New
3. Restart terminal

**Mac/Linux**:
```bash
export PATH=$PATH:~/Library/Android/sdk/platform-tools  # Mac
export PATH=$PATH:~/Android/Sdk/platform-tools          # Linux
```

### Issue: Device not detected

**Check USB cable**: Try a different cable (must support data transfer)

**Check USB mode**: On phone, swipe down → tap USB notification → select "File Transfer"

**Restart ADB**:
```bash
adb kill-server
adb start-server
adb devices
```

**Windows driver issue**:
1. Open Device Manager
2. Look for Android device with yellow warning
3. Right-click → Update Driver
4. Browse → Select Google USB Driver folder

### Issue: Build fails with "No connected devices"

Make sure:
1. Phone shows in `adb devices` as `device` (not `unauthorized`)
2. Developer options enabled
3. USB debugging enabled
4. Phone is unlocked

### Issue: App installs but won't open

**Check Metro bundler is running**:
```bash
# Terminal 1: Start Metro
npm start

# Terminal 2: Build and install
npm run android
```

---

## Quick Reference Commands

```bash
# Check connected devices
adb devices

# Restart ADB
adb kill-server && adb start-server

# Build and install on device
npm run android

# Just build
cd android && ./gradlew assembleDebug && cd ..

# Install existing APK
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Uninstall app
adb uninstall com.localosapp

# View logs
adb logcat | grep ReactNative

# Clear app data
adb shell pm clear com.localosapp
```

---

## For iOS (iPhone 16)

If you want to build on your iPhone 16:

### Step 1: Install CocoaPods
```bash
cd ios
pod install
cd ..
```

### Step 2: Open Xcode
```bash
open ios/LocalOSApp.xcworkspace
```

### Step 3: Connect iPhone via USB

### Step 4: Select Device
- In Xcode, top bar, select your iPhone from device dropdown

### Step 5: Build
- Press **Cmd + R** or click the Play button

### Step 6: Trust Developer
- On iPhone: Settings → General → Device Management → Trust your developer certificate

---

## Performance Expectations

### On Physical Device (iPhone 16):
- Llama 3.2 3B: **~10-20 tokens/sec** ⚡
- Smooth UI, responsive
- Tool calls: 1-3 seconds

### On Android Emulator:
- Llama 3.2 3B: **~1-2 tokens/sec** 🐌
- Laggy UI
- Tool calls: 10-30 seconds
- May run out of memory

**Bottom line**: Always test on real device for LLM apps!

---

## Summary

1. **Enable USB Debugging** on your Android phone
2. **Connect via USB** to your computer
3. **Verify with** `adb devices`
4. **Run** `npm run android`
5. App installs and launches on your phone!

No emulators needed. React Native will automatically detect and use your connected device.

---

*Note: This is a React Native app, NOT Flutter. If you see Flutter references anywhere, they're incorrect.*
