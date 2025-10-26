# Codemagic Quick Reference Card

## 🚀 Getting Started (5 Minutes)

### 1. Push to GitHub
```bash
cd LocalOSApp
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/localOS.git
git push -u origin main
```

### 2. Connect to Codemagic
1. Go to https://app.codemagic.io
2. Click **"Add application"**
3. Select **GitHub** → Choose **localOS** repo
4. Select **React Native** project type
5. Done! Codemagic will detect `codemagic.yaml`

---

## 📱 iOS Build Setup

### Required Items Checklist
- [ ] Apple Developer account ($99/year)
- [ ] App Store Connect API key (.p8 file)
- [ ] App ID created (Bundle: `com.localosapp`)
- [ ] App created in App Store Connect

### Quick Setup
1. **Codemagic** → **Teams** → **Integrations** → **App Store Connect**
2. Upload `.p8` key file + Issuer ID + Key ID
3. **App settings** → **iOS code signing** → **Automatic**
4. Enter Bundle ID: `com.localosapp`
5. Click **Fetch signing files**
6. Done!

---

## 🤖 Android Build Setup

### Required Items Checklist
- [ ] Google Play Developer account ($25 one-time)
- [ ] Upload keystore generated
- [ ] Google Play service account JSON
- [ ] App created in Play Console

### Quick Setup

#### 1. Generate Keystore
```bash
cd LocalOSApp/android/app
keytool -genkeypair -v -storetype PKCS12 \
  -keystore localos-upload-key.keystore \
  -alias localos-key-alias \
  -keyalg RSA -keysize 2048 -validity 10000
```

#### 2. Upload to Codemagic
1. **App settings** → **Android code signing** → **Add key**
2. Upload keystore + passwords
3. Reference name: `keystore_reference`

#### 3. Google Play Integration
1. **Teams** → **Integrations** → **Google Play**
2. Upload service account JSON
3. Done!

---

## 🏗️ Trigger Build

### Option 1: Manual Build
1. Go to Codemagic dashboard
2. Select workflow: `react-native-ios` or `react-native-android`
3. Click **"Start new build"**
4. Wait ~20-30 minutes

### Option 2: Auto Build (on push)
Add to `codemagic.yaml`:
```yaml
triggering:
  events:
    - push
  branch_patterns:
    - pattern: 'main'
      include: true
```

Push to GitHub → Build starts automatically!

---

## 📦 Where to Find Builds

### iOS
- **TestFlight**: 1-2 hours after build completes
- **Artifacts**: Codemagic dashboard → Build → Artifacts → `.ipa`

### Android
- **Play Console**: Internal Testing track (immediate)
- **Artifacts**: Codemagic dashboard → Build → Artifacts → `.apk` / `.aab`

---

## 🔑 Important Files

```
localOS/
├── LocalOSApp/
│   ├── codemagic.yaml          ← CI/CD configuration
│   ├── ios/
│   │   └── LocalOSApp.xcworkspace
│   └── android/
│       └── app/
│           └── build.gradle
```

---

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| Code signing failed | Re-fetch signing files in Codemagic |
| Pod install failed | Clear cache, rebuild |
| Gradle build failed | Check Java version (need 17) |
| Build timeout | Increase `max_build_duration: 120` |
| Large app size | Normal! llama.cpp binaries are ~150MB |

---

## 💰 Free Tier Limits

- **500 minutes/month** free
- **iOS build**: ~30 min
- **Android build**: ~15 min
- **Result**: ~15-20 builds/month free

---

## 📞 Support

- **Codemagic Docs**: https://docs.codemagic.io
- **Codemagic Slack**: https://codemagic.io/slack
- **Email**: support@codemagic.io

---

## ✅ Final Check Before First Build

- [ ] `codemagic.yaml` in repo root
- [ ] Pushed to GitHub
- [ ] App Store Connect API key added to Codemagic
- [ ] iOS code signing configured
- [ ] Android keystore uploaded
- [ ] Apps created in App Store Connect & Play Console
- [ ] Email notifications configured

**Ready to build!** 🎉

---

## 🎯 Build Commands (Local Testing)

Test before pushing to Codemagic:

```bash
# iOS
npm install
cd ios && bundle exec pod install && cd ..
npx react-native run-ios

# Android
npm install
npx react-native run-android

# Lint
npm run lint
```

---

**For detailed setup, see [CODEMAGIC_SETUP.md](./CODEMAGIC_SETUP.md)**
