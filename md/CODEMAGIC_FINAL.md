# Codemagic - Release Build Setup (FINAL)

## ✅ What This Does

- **iOS**: Release IPA with latest Xcode (works on real devices)
- **Android**: Release APK + AAB (production ready)
- **Signing**: Automatic via App Store Connect API
- **Machine**: M2 Mac (faster builds)

---

## 🔑 Required Setup (One Time)

### Step 1: Create App Store Connect API Key

1. Go to https://appstoreconnect.apple.com
2. **Users and Access** → **Keys**
3. Click **"+"**
4. Name: `Codemagic`
5. Access: **Developer**
6. Download `.p8` file
7. **Save these**:
   - Issuer ID (UUID)
   - Key ID (10 chars)
   - Private Key (`.p8` file contents)

### Step 2: Create Environment Variables in Codemagic

1. Go to https://app.codemagic.io
2. Click profile → **Teams**
3. Select your team → **Global variables and secrets**
4. Click **"+ Add variable group"**
5. Name: `appstore_credentials`
6. Add 3 variables:

```
Variable 1:
Key: APP_STORE_CONNECT_ISSUER_ID
Value: <your-issuer-id>
Secure: ✅

Variable 2:
Key: APP_STORE_CONNECT_KEY_IDENTIFIER
Value: <your-key-id>
Secure: ✅

Variable 3:
Key: APP_STORE_CONNECT_PRIVATE_KEY
Value: <entire .p8 file contents including BEGIN/END>
Secure: ✅
```

7. Click **Save**

### Step 3: Register App ID (If Not Done)

1. Go to https://developer.apple.com/account
2. **Certificates, IDs & Profiles** → **Identifiers**
3. Click **"+"** → **App IDs** → **App**
4. Bundle ID: `com.localosapp`
5. Register

### Step 4: (Android Only) Create Keystore

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore localos.keystore \
  -alias localos \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then upload to Codemagic:
- **App settings** → **Android code signing**
- Upload keystore + passwords
- Reference name: `keystore_reference`

---

## 🚀 Build Steps

### 1. Update Email

Edit `codemagic.yaml` line 51 and 90:
```yaml
recipients:
  - your-email@example.com  # ← YOUR EMAIL
```

### 2. Push Code

```bash
git add codemagic.yaml
git commit -m "Add release build config"
git push origin main
```

### 3. Start Build

1. Go to Codemagic dashboard
2. Click **"Start new build"**
3. Select workflow:
   - **react-native-ios-release** (for iOS)
   - **react-native-android-release** (for Android)
4. Build!

### 4. Wait

- **iOS**: ~25-30 minutes
- **Android**: ~15 minutes

### 5. Download

- Go to **Artifacts** tab
- Download `.ipa` or `.apk`

---

## 📱 Installing Builds

### iOS IPA

**Method 1: Xcode**
```bash
# Connect iPhone via USB
# Open Xcode → Devices and Simulators
# Drag IPA to device
```

**Method 2: Diawi**
```bash
# Upload to https://www.diawi.com
# Get link
# Open on iPhone → Install
```

⚠️ **Device must be registered** in Apple Developer Portal (UDID)

### Android APK

```bash
# Transfer to Android device
# Enable "Install unknown apps"
# Tap file → Install
```

---

## 🔧 Key Changes from Previous Config

| Aspect | Before | Now |
|--------|--------|-----|
| Build type | Debug | **Release** |
| Xcode version | 16.1 | **latest** |
| Machine | M1 | **M2** (faster) |
| Signing | None | **Automatic** |
| iOS output | Simulator | **Device IPA** |
| Config | Debug | **Release** |

---

## ✅ What Gets Built

### iOS Release IPA:
- ✅ Optimized/minified
- ✅ Works on real devices
- ✅ Code signed
- ✅ ~180MB (llama.cpp included)
- ✅ Development certificate (100 devices max)

### Android Release APK:
- ✅ Signed with your keystore
- ✅ Optimized/minified
- ✅ Works on all devices
- ✅ ~150MB

---

## 🐛 Troubleshooting

### "Environment variable group not found"

**Fix**: Create `appstore_credentials` group with exact name

### "Invalid API key"

**Fix**: Copy entire `.p8` file including:
```
-----BEGIN PRIVATE KEY-----
...content...
-----END PRIVATE KEY-----
```

### "No devices registered"

**Fix**: Register device UDID at developer.apple.com

### Build times out

**Normal for first build** - llama.rn is large. Second build is cached.

---

## 💰 Cost

- **Codemagic Free**: 500 min/month
- **iOS build**: ~30 min
- **Android build**: ~15 min
- **Result**: ~16 iOS builds or ~33 Android builds/month free

---

## 🎉 Summary

**Setup once** (10 minutes):
1. Create API key
2. Add environment variables
3. Upload keystore (Android)

**Then forever**:
```bash
git push → Build → Download IPA → Install
```

**No Mac needed. Latest Xcode. Release builds. Done.** ✅
