# Codemagic Setup - Quick Guide

## 📦 What You Get

**Simple artifact builds - No App Store or Play Store publishing**

- ✅ **iOS**: `.ipa` file for ad-hoc distribution
- ✅ **Android**: `.apk` file for direct installation
- ✅ **Email notifications** with download links
- ❌ No automatic App Store submission
- ❌ No TestFlight uploads (unless you enable it)

---

## 🚀 Three-Step Setup

### **1. Setup Apple Developer (Required for iOS)**

- Enroll at https://developer.apple.com ($99/year)
- Create App Store Connect API key
- Register App ID: `com.localosapp`

### **2. Connect Codemagic**

- Go to https://app.codemagic.io
- Connect your GitHub repo
- Add App Store Connect integration
- Configure code signing (automatic, ad-hoc)

### **3. Build!**

- Push to GitHub (or manual trigger)
- Wait ~25 minutes
- Download `.ipa` from artifacts
- Install via Diawi or Xcode

---

## 📖 Documentation

Choose your path:

### **🎯 Just Want Artifacts? (Recommended)**
👉 **[CODEMAGIC_ARTIFACT_ONLY.md](./CODEMAGIC_ARTIFACT_ONLY.md)**
- Simple setup
- No store publishing
- Direct downloads
- Ad-hoc distribution

### **📚 Full CI/CD with Store Publishing**
👉 **[CODEMAGIC_SETUP.md](./CODEMAGIC_SETUP.md)**
- TestFlight uploads
- Play Store internal testing
- Complete workflows
- Advanced features

### **⚡ Quick Reference**
👉 **[CODEMAGIC_QUICKREF.md](./CODEMAGIC_QUICKREF.md)**
- Command cheat sheet
- Common issues
- Build triggers

### **🔄 Build Pipeline Diagram**
👉 **[CODEMAGIC_FLOW.md](./CODEMAGIC_FLOW.md)**
- Visual workflow
- Build times
- Cost breakdown

---

## 🎯 Configuration File

[codemagic.yaml](./codemagic.yaml) - Three workflows:

1. **`react-native-ios`** - Builds iOS IPA (ad-hoc)
2. **`react-native-android`** - Builds Android APK/AAB
3. **`react-native-dev`** - Development builds (no signing)

**Key change from default**:
- `distribution_type: ad_hoc` instead of `app_store`
- No `app_store_connect` publishing section
- Artifacts only via email

---

## 💾 Where to Find Your Builds

After build completes:

```
Codemagic Dashboard
└── Your build
    └── Artifacts tab
        ├── LocalOSApp.ipa  (~180MB)  ← iOS app
        ├── app-release.apk  (~150MB)  ← Android app
        └── *.dSYM.zip  ← Debug symbols
```

---

## 📱 Installing Builds

### **iOS (.ipa)**

**Option 1: Diawi (Easiest)**
1. Go to https://www.diawi.com
2. Upload `.ipa`
3. Share link with testers
4. Open on iPhone → Install

**Option 2: Xcode**
1. Connect iPhone via USB
2. Xcode → Devices and Simulators
3. Drag `.ipa` file

⚠️ **Device must be registered** in Apple Developer Portal

### **Android (.apk)**

1. Transfer `.apk` to Android device
2. Enable "Install unknown apps"
3. Tap file → Install

---

## 💰 Cost Summary

| Service | Cost | Usage |
|---------|------|-------|
| **Codemagic Free** | $0 | 500 min/month |
| **Apple Developer** | $99/year | iOS signing (required) |
| **Google Play** | $25 one-time | Android (optional) |
| **Total** | **$99-124** | One-time + annual |

**Build times:**
- iOS: ~25 min → ~20 builds/month free
- Android: ~15 min → ~33 builds/month free

---

## 🔧 Customization

### **Change Email Recipient**

Edit `codemagic.yaml`:
```yaml
email:
  recipients:
    - your-email@example.com  # ← Change this
```

### **Auto-Build on Push**

Add to any workflow in `codemagic.yaml`:
```yaml
triggering:
  events:
    - push
  branch_patterns:
    - pattern: 'main'
      include: true
```

### **Enable TestFlight (Optional)**

Change in `codemagic.yaml`:
```yaml
ios_signing:
  distribution_type: app_store  # Changed from ad_hoc

publishing:
  app_store_connect:
    auth: integration
    submit_to_testflight: true
```

---

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| "Code signing failed" | Re-fetch signing files in Codemagic |
| "Pod install failed" | Clear CocoaPods cache, rebuild |
| "IPA won't install" | Check device UDID is registered |
| "Build timeout" | Normal for first build, retry |
| "Large app size" | Expected (~180MB due to llama.cpp) |

---

## ✅ Quick Checklist

Before first build:

- [ ] Apple Developer account
- [ ] App Store Connect API key
- [ ] App ID registered
- [ ] GitHub repo connected to Codemagic
- [ ] iOS code signing configured
- [ ] Email updated in `codemagic.yaml`
- [ ] Test device UDID registered

**You're ready!** 🚀

---

## 📞 Get Help

- **Start here**: [CODEMAGIC_ARTIFACT_ONLY.md](./CODEMAGIC_ARTIFACT_ONLY.md)
- **Codemagic docs**: https://docs.codemagic.io
- **Support**: support@codemagic.io
- **Slack**: https://codemagic.io/slack

---

## 🎉 Summary

**Simple workflow:**
```
Code → GitHub → Codemagic → IPA/APK → Email → Download → Install
```

**No complexity:**
- ❌ No App Store submission
- ❌ No review process
- ❌ No screenshots needed
- ❌ No app listing required

**Just builds:**
- ✅ Download artifacts
- ✅ Install on devices
- ✅ Test immediately
- ✅ Iterate quickly

**Perfect for side projects, internal tools, and beta testing!**
