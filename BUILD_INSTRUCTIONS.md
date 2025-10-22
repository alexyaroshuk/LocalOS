# Build Instructions - Release Build (No Signing)

## ✅ What This Builds

- **iOS**: Release build for Simulator (optimized, no signing, no crashes)
- **Android**: Release APK (optimized, works on devices)
- **Xcode**: Latest version
- **Machine**: M2 Mac (faster)

---

## 🚀 How to Build

### 1. Update Email

Edit `codemagic.yaml` lines 49 and 80:
```yaml
recipients:
  - your-email@example.com  # ← YOUR EMAIL
```

### 2. Push

```bash
git add codemagic.yaml
git commit -m "Release build config"
git push origin main
```

### 3. Build in Codemagic

1. Go to https://app.codemagic.io
2. Click **"Start new build"**
3. Select: **react-native-ios-release**
4. Wait ~30 minutes

### 4. Download

- **Artifacts** tab → `LocalOSApp-Release.app.zip`

---

## 📱 Installing iOS Build

### For Mac with Xcode Simulator:

```bash
# Unzip
unzip LocalOSApp-Release.app.zip

# Drag to simulator or:
xcrun simctl install booted LocalOSApp.app
xcrun simctl launch booted com.localosapp
```

---

## 🔑 Key Features

- ✅ **Release configuration** (optimized, no debug logs)
- ✅ **Latest Xcode** (always up to date)
- ✅ **No signing** (zero setup needed)
- ✅ **No Apple Developer account needed**
- ✅ **No certificates**
- ✅ **No App Store Connect API**
- ✅ **Just build and test**

---

## 📊 Build Details

| iOS | Android |
|-----|---------|
| Configuration: Release | Configuration: Release |
| SDK: iphonesimulator | Build: assembleRelease |
| Signing: NO | Signing: Debug keystore |
| Device: Simulator only | Device: Real devices |
| Size: ~180MB | Size: ~150MB |
| Time: ~30 min | Time: ~15 min |

---

## 💡 Why Release vs Debug?

**Debug builds crash on simulator** because:
- Not optimized
- Missing dependencies
- llama.rn issues with debug mode

**Release builds work** because:
- Fully optimized
- All deps included properly
- Production configuration
- No debugging overhead

---

## 🎯 This Is Perfect For:

- ✅ Testing on Mac simulator
- ✅ Verifying release performance
- ✅ Demo builds
- ✅ Quick iteration
- ❌ NOT for real iOS devices (needs signing for that)

---

## 🚀 That's It!

**No environment variables. No signing. No Apple accounts. Just build.**

Push → Build → Download → Test in Simulator → Done. ✅
