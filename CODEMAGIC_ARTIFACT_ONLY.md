# Codemagic - Build Artifacts Only (No App Store/Play Store)

Simple guide to build IPA and APK artifacts using Codemagic **without publishing to stores**.

---

## 🎯 What You'll Get

- **iOS**: `.ipa` file you can install on registered devices
- **Android**: `.apk` and `.aab` files you can distribute directly
- **No store publishing**: Just downloadable build artifacts
- **No review process**: Immediate access after build completes

---

## ⚡ Quick Setup (15 Minutes)

### **Step 1: Create Apple Developer Account**

You still need this for iOS code signing (even without App Store):

1. Go to https://developer.apple.com
2. Enroll in Apple Developer Program ($99/year)
3. Wait for approval (~24 hours)

### **Step 2: Get App Store Connect API Key**

Even though we're not publishing, we need this for automatic code signing:

1. Go to https://appstoreconnect.apple.com
2. **Users and Access** → **Keys** → **App Store Connect API**
3. Click **"+"** to create new key
4. **Name**: "Codemagic"
5. **Access**: Developer
6. **Download** the `.p8` file
7. **Save** these values:
   - Issuer ID
   - Key ID

### **Step 3: Register App ID**

1. Go to https://developer.apple.com/account
2. **Certificates, IDs & Profiles** → **Identifiers**
3. Click **"+"** → **App IDs** → **App**
4. **Description**: "LocalOS"
5. **Bundle ID**: `com.localosapp` (Explicit)
6. Click **Register**

### **Step 4: Connect to Codemagic**

1. Go to https://app.codemagic.io
2. Sign up with GitHub
3. Click **"Add application"**
4. Select **GitHub** → Your **localOS** repo
5. Choose **React Native** project type
6. Done! (Codemagic detects `codemagic.yaml`)

### **Step 5: Add App Store Connect Integration**

1. In Codemagic: **Teams** → **Integrations**
2. Click **App Store Connect**
3. Click **"+ Add key"**
4. Enter:
   - **Issuer ID**: (from Step 2)
   - **Key ID**: (from Step 2)
   - **API Key**: Upload `.p8` file
5. Click **Save**

### **Step 6: Configure iOS Code Signing**

1. In your Codemagic app: **App settings**
2. Go to **iOS code signing**
3. Select **Automatic code signing**
4. Choose your App Store Connect integration
5. **Distribution type**: Select **Ad-hoc**
6. **Bundle identifier**: `com.localosapp`
7. Click **Fetch signing files**
8. Codemagic will auto-generate certificates and profiles

### **Step 7: (Optional) Android Keystore**

Only if you want to build Android:

1. Generate keystore on your machine:
   ```bash
   keytool -genkeypair -v -storetype PKCS12 \
     -keystore localos.keystore \
     -alias localos \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Upload to Codemagic:
   - **App settings** → **Android code signing**
   - Upload keystore file + passwords
   - Reference name: `keystore_reference`

### **Step 8: Update Email in codemagic.yaml**

```bash
cd localOS
```

Edit `codemagic.yaml` and replace:
```yaml
email:
  recipients:
    - your-email@example.com  # ← Change this to your email
```

### **Step 9: Push to GitHub**

```bash
git add .
git commit -m "Configure Codemagic for artifact builds"
git push origin main
```

### **Step 10: Start Build!**

1. Go to Codemagic dashboard
2. Select workflow: **react-native-ios**
3. Click **"Start new build"**
4. Wait ~25-30 minutes
5. Download `.ipa` from **Artifacts** section

---

## 📥 How to Download & Install Artifacts

### **iOS (.ipa file)**

After build completes:

1. Go to Codemagic → Your build → **Artifacts**
2. Download `LocalOSApp.ipa`
3. **Install options**:

   **Option A: Using Diawi** (easiest)
   - Go to https://www.diawi.com
   - Upload your `.ipa`
   - Get download link
   - Open link on iPhone → Install

   **Option B: Using Xcode**
   - Connect iPhone via USB
   - Open Xcode → **Window** → **Devices and Simulators**
   - Drag `.ipa` to your device

   **Option C: Using TestFlight** (if you enable it)
   - See advanced section below

⚠️ **Important**: Your device UDID must be registered in the ad-hoc provisioning profile!

### **Android (.apk file)**

After build completes:

1. Go to Codemagic → Your build → **Artifacts**
2. Download `app-release.apk`
3. **Install**:
   - Transfer to Android device
   - Enable **Settings** → **Security** → **Install unknown apps**
   - Tap APK file → Install

---

## 📱 Register Devices for iOS

Ad-hoc distribution requires registering device UDIDs:

### **Get Device UDID**

**On iPhone:**
1. Connect to Mac
2. Open Finder → Select iPhone
3. Click on serial number → Shows UDID
4. Copy UDID

**Without Mac:**
- Install "UDID+" app from App Store
- Open app → Shows UDID

### **Register in Apple Developer**

1. Go to https://developer.apple.com/account
2. **Certificates, IDs & Profiles** → **Devices**
3. Click **"+"**
4. **Name**: "My iPhone"
5. **UDID**: Paste UDID
6. Click **Continue** → **Register**

### **Rebuild with New Device**

After registering new devices:
1. Go to Codemagic → **iOS code signing**
2. Click **Fetch signing files** (refreshes provisioning profile)
3. Start new build
4. New `.ipa` will work on newly registered devices

---

## 🔄 Build Workflow

```
┌─────────────────┐
│  Push to GitHub │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Codemagic     │
│                 │
│  • Install deps │
│  • Sign code    │
│  • Build IPA    │
│  • ~25 minutes  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Artifacts     │
│                 │
│  📦 .ipa file   │
│  📦 .dSYM file  │
│  📧 Email sent  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Download & Use  │
│                 │
│  • Diawi link   │
│  • Direct DL    │
│  • Install      │
└─────────────────┘
```

---

## 💰 Costs

| Service | Cost | Required For |
|---------|------|--------------|
| Apple Developer | $99/year | iOS builds (required) |
| Codemagic Free | $0 (500 min/mo) | CI/CD (sufficient) |
| Google Play | $25 one-time | Android only (optional) |
| **Total** | **$99-124/year** | |

**Build Usage:**
- iOS: ~25 min/build
- Android: ~15 min/build
- Free tier: ~15-20 builds/month

---

## 🚀 Advanced: Enable TestFlight (Optional)

If you want TestFlight instead of ad-hoc:

### **1. Create App in App Store Connect**

1. Go to https://appstoreconnect.apple.com
2. **Apps** → **"+"** → **New App**
3. Enter app details
4. **Bundle ID**: `com.localosapp`
5. Create

### **2. Update codemagic.yaml**

Change distribution type:
```yaml
ios_signing:
  distribution_type: app_store  # Changed from ad_hoc
```

Add publishing:
```yaml
publishing:
  email:
    # ... existing email config
  app_store_connect:
    auth: integration
    submit_to_testflight: true
    submit_to_app_store: false
```

### **3. Rebuild**

- Push changes
- New build will upload to TestFlight
- Available in 1-2 hours
- No device registration needed!

---

## 🐛 Troubleshooting

### **"No signing certificate found"**

**Solution**:
1. Codemagic → iOS code signing
2. Click "Fetch signing files" again
3. Rebuild

### **"IPA won't install on device"**

**Causes**:
1. Device UDID not registered → Register device
2. Wrong distribution type → Use ad-hoc
3. Expired certificate → Refresh in Codemagic

### **"Build failed at pod install"**

**Solution**:
```yaml
# Add to scripts before pod install:
- name: Clear CocoaPods cache
  script: |
    cd LocalOSApp/ios
    rm -rf Pods Podfile.lock
    bundle exec pod install
```

### **"Large IPA size (~200MB)"**

**This is normal!** llama.cpp includes large native binaries:
- ARM64 library: ~150MB
- Model support files: ~20MB
- App code: ~30MB

---

## 📋 Checklist Before First Build

- [ ] Apple Developer account created
- [ ] App Store Connect API key downloaded
- [ ] App ID registered (`com.localosapp`)
- [ ] GitHub repo pushed
- [ ] Codemagic connected to GitHub
- [ ] App Store Connect integration added
- [ ] iOS code signing configured (ad-hoc)
- [ ] Email address updated in `codemagic.yaml`
- [ ] Device UDID registered (for testing)

**Ready to build!** 🎉

---

## 📞 Support

- **Codemagic Docs**: https://docs.codemagic.io
- **Codemagic Slack**: https://codemagic.io/slack
- **Email**: support@codemagic.io

---

## ✅ Summary

**What you get**:
- ✅ IPA file from Codemagic artifacts
- ✅ No App Store submission
- ✅ No review process
- ✅ Direct device installation
- ✅ Fast iteration (25 min builds)

**What you don't need**:
- ❌ App Store listing
- ❌ App screenshots/descriptions
- ❌ App review waiting
- ❌ Production release setup

**Perfect for**:
- Internal testing
- Beta testing with friends
- Development builds
- Demo versions
- Side-loading apps

🎯 **Just build → Download → Install → Done!**
