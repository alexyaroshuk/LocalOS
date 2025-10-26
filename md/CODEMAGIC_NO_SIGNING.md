# Codemagic - Debug Builds Only (NO SIGNING, NO APPSTORE)

## 🎯 What This Does

**Builds debug versions for local testing ONLY**

- ✅ iOS: Simulator build (no device, no signing)
- ✅ Android: Debug APK (install directly)
- ❌ No code signing bullshit
- ❌ No App Store
- ❌ No certificates
- ❌ No provisioning profiles

---

## 🚀 Setup (2 Minutes)

### Step 1: Update Email

Edit `codemagic.yaml` line 47 and 78:
```yaml
email:
  recipients:
    - your-email@example.com  # ← YOUR EMAIL
```

### Step 2: Push

```bash
git add codemagic.yaml
git commit -m "Add debug builds"
git push origin main
```

### Step 3: Build

1. Go to https://app.codemagic.io
2. Click **"Start new build"**
3. Select: **react-native-ios-debug** or **react-native-android-debug**
4. Build!

**NO OTHER SETUP NEEDED**

---

## 📱 What You Get

### iOS Build
- **File**: `LocalOSApp-Debug.app.zip`
- **Type**: Simulator build
- **Use**:
  - Unzip
  - Drag to iOS Simulator on Mac
  - **NOT for real devices** (no signing)

### Android Build
- **File**: `app-debug.apk`
- **Type**: Debug APK
- **Use**:
  - Install directly on Android device
  - Enable "Install unknown apps"
  - Works immediately

---

## ⚡ No Setup Required

**iOS**:
- ❌ No Apple Developer account needed
- ❌ No certificates
- ❌ No provisioning profiles
- ❌ No device registration
- ✅ Just builds for simulator

**Android**:
- ❌ No keystore
- ❌ No signing
- ✅ Just builds debug APK

---

## 🎉 Summary

**Push code → Build → Download → Test**

No signing. No App Store. No bullshit.

Just debug builds for local testing.

---

## 💡 When You Need Real Device Testing

If you actually need to test on a real iPhone (not simulator), THEN you need:
- Apple Developer account
- Code signing
- Device registration

But for now? **This is all you need**.

Android APK works on real devices already (debug mode).

---

**Want real device iOS testing? Let me know and I'll add that workflow separately.**

For now: Push, build, test. Done. ✅
