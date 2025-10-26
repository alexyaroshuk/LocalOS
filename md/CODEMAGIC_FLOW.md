# Codemagic Build Flow Diagram

## 📊 Complete CI/CD Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR LOCAL MACHINE                          │
│                                                                 │
│  1. Write Code                                                  │
│     └─ LocalOSApp/                                             │
│        ├─ src/                                                 │
│        ├─ ios/                                                 │
│        ├─ android/                                             │
│        └─ codemagic.yaml                                       │
│                                                                 │
│  2. Commit & Push                                              │
│     └─ git push origin main                                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                        GITHUB                                   │
│                                                                 │
│  ✓ Repository: github.com/YOUR_USERNAME/localOS                │
│  ✓ Webhook triggers Codemagic on push                          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CODEMAGIC                                  │
│                                                                 │
│  Workflow Selection:                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ iOS Build    │  │Android Build │  │  Dev Build   │         │
│  │              │  │              │  │              │         │
│  │ Mac M1       │  │ Mac M1       │  │ Mac M1       │         │
│  │ Xcode 15.2   │  │ Java 17      │  │ Debug Mode   │         │
│  │ Node 20      │  │ Node 20      │  │ No Signing   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
│         │                  │                  │                 │
│    iOS STEPS          ANDROID STEPS       DEV STEPS            │
│    ═════════          ═══════════        ═════════             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    iOS BUILD PIPELINE                           │
│                                                                 │
│  Step 1: Setup Environment                                      │
│  ├─ Provision Mac M1 VM                                        │
│  ├─ Install Xcode 15.2                                         │
│  ├─ Install Node.js 20                                         │
│  └─ Install CocoaPods                                          │
│                                                                 │
│  Step 2: Install Dependencies                                   │
│  ├─ npm install                                                │
│  ├─ bundle install                                             │
│  ├─ bundle exec pod install                                    │
│  └─ Download llama.rn pre-built frameworks                     │
│                                                                 │
│  Step 3: Code Signing                                          │
│  ├─ Fetch certificates from Apple                             │
│  ├─ Fetch provisioning profiles                               │
│  ├─ Configure Xcode project                                   │
│  └─ Sign with distribution certificate                         │
│                                                                 │
│  Step 4: Build                                                 │
│  ├─ xcodebuild archive                        (~15 min)        │
│  ├─ Create IPA file                                           │
│  ├─ Generate dSYM symbols                                     │
│  └─ Validate build                                            │
│                                                                 │
│  Step 5: Publish Artifacts                                     │
│  ├─ Upload IPA to Codemagic storage                           │
│  ├─ Upload dSYM files                                         │
│  └─ Generate build logs                                       │
│                                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  APP STORE CONNECT                              │
│                                                                 │
│  Step 6: TestFlight Deployment                                 │
│  ├─ Upload IPA via App Store Connect API                      │
│  ├─ Process build (Apple validation)          (~1-2 hours)     │
│  ├─ Notify internal testers                                   │
│  └─ Available for testing                                     │
│                                                                 │
│  Optional: App Store Submission                                │
│  └─ Submit for App Review (if enabled)                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                  ANDROID BUILD PIPELINE                         │
│                                                                 │
│  Step 1: Setup Environment                                      │
│  ├─ Provision Mac M1 VM (or Linux)                            │
│  ├─ Install Java 17                                           │
│  ├─ Install Node.js 20                                         │
│  └─ Install Android SDK & NDK                                 │
│                                                                 │
│  Step 2: Install Dependencies                                   │
│  ├─ npm install                                                │
│  ├─ Set ANDROID_SDK_ROOT                                      │
│  └─ Download llama.rn pre-built libraries                     │
│                                                                 │
│  Step 3: Code Signing                                          │
│  ├─ Load keystore from Codemagic vault                        │
│  ├─ Configure gradle.properties                               │
│  └─ Set signing config                                        │
│                                                                 │
│  Step 4: Build                                                 │
│  ├─ ./gradlew assembleRelease             (~8 min)            │
│  ├─ ./gradlew bundleRelease               (~5 min)            │
│  ├─ Sign APK & AAB                                            │
│  └─ Zipalign & optimize                                       │
│                                                                 │
│  Step 5: Publish Artifacts                                     │
│  ├─ Upload APK to Codemagic storage                           │
│  ├─ Upload AAB to Codemagic storage                           │
│  └─ Generate build logs                                       │
│                                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GOOGLE PLAY CONSOLE                            │
│                                                                 │
│  Step 6: Play Store Deployment                                 │
│  ├─ Upload AAB via Play Console API                           │
│  ├─ Deploy to Internal Testing track          (immediate)      │
│  ├─ Notify internal testers                                   │
│  └─ Available for testing                                     │
│                                                                 │
│  Optional: Production Release                                   │
│  └─ Promote to Production (if enabled)                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    NOTIFICATIONS                                │
│                                                                 │
│  ✓ Email: Build completed successfully                         │
│  ✓ Slack: (optional) Build status updates                      │
│  ✓ Webhook: (optional) Custom integrations                     │
│                                                                 │
│  📥 Downloads:                                                  │
│  ├─ iOS: TestFlight link                                       │
│  ├─ Android: Play Console internal testing link                │
│  └─ Direct: APK/IPA files from Codemagic artifacts             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Build Frequency Options

### Option 1: Manual Trigger
```
Developer → Codemagic Dashboard → "Start new build" → Select branch
```

### Option 2: Automatic on Push
```yaml
triggering:
  events:
    - push
  branch_patterns:
    - pattern: 'main'
```
```
Developer → git push → Auto-build starts
```

### Option 3: Scheduled Builds
```yaml
triggering:
  events:
    - schedule
  schedule:
    cron: "0 2 * * 1"  # Every Monday at 2 AM
```

### Option 4: Pull Request Builds
```yaml
triggering:
  events:
    - pull_request
```
```
Developer → Create PR → Build & test → Merge if passed
```

---

## ⏱️ Typical Build Times

| Platform | Stage | Time | Total |
|----------|-------|------|-------|
| **iOS** | Setup | 2 min | |
| | Dependencies | 5 min | |
| | Code Signing | 1 min | |
| | Build | 15 min | |
| | Publish | 2 min | **~25 min** |
| | | | |
| **Android** | Setup | 1 min | |
| | Dependencies | 3 min | |
| | Build APK | 8 min | |
| | Build AAB | 3 min | **~15 min** |

---

## 💾 Artifact Storage

### iOS Artifacts
```
build/ios/ipa/
├── LocalOSApp.ipa              (~180 MB - includes llama.cpp)
├── LocalOSApp.app.dSYM.zip     (~50 MB)
└── LocalOSApp-symbols.zip      (~50 MB)
```

### Android Artifacts
```
android/app/build/outputs/
├── apk/release/
│   └── app-release.apk         (~150 MB - includes llama.cpp)
└── bundle/release/
    └── app-release.aab         (~140 MB)
```

**Note**: Large size is expected due to llama.cpp native libraries and pre-built binaries.

---

## 🔐 Security Best Practices

1. **Never commit secrets** to git
   - Use Codemagic environment variables
   - Store in Codemagic vault

2. **Keystore & Certificates**
   - Upload directly to Codemagic
   - Don't include in repository

3. **API Keys**
   - Set as environment variables
   - Mark as "Secure" in Codemagic

4. **Access Control**
   - Limit team member permissions
   - Use separate keys for CI/CD

---

## 🎯 Success Indicators

After successful build, you should see:

✅ **iOS**
- Green checkmark in Codemagic
- IPA file in artifacts
- Build appears in TestFlight (1-2 hours)
- Email notification received

✅ **Android**
- Green checkmark in Codemagic
- APK & AAB files in artifacts
- Build appears in Play Console Internal Testing
- Email notification received

---

## 🐛 Debugging Failed Builds

### Where to Look
1. **Codemagic Dashboard** → Select build → **View logs**
2. Search for "❌" or "error" in logs
3. Check specific step that failed
4. Read error message carefully

### Common Patterns
```
Error pattern: "Code signing failed"
→ Fix: Re-fetch signing files in iOS code signing settings

Error pattern: "Pod install failed"
→ Fix: Clear CocoaPods cache, rebuild

Error pattern: "Gradle build failed"
→ Fix: Check Java version, Gradle version

Error pattern: "llama.rn build failed"
→ Fix: Ensure using pre-built binaries (default)
```

---

## 📊 Cost Breakdown

### Codemagic (Free Tier)
- 500 minutes/month
- iOS: 25 min/build
- Android: 15 min/build
- **Result**: ~12-15 builds/month free

### Apple
- Developer Program: $99/year
- App Store Connect API: Free

### Google
- Play Console: $25 one-time

### Total Year 1
- $124 (with free Codemagic tier)

---

## 🚀 Pro Tips

1. **Cache Dependencies**
   ```yaml
   cache:
     cache_paths:
       - $CM_BUILD_DIR/node_modules
       - $HOME/Library/Caches/CocoaPods
   ```
   Saves ~3-5 minutes per build

2. **Build Only What Changed**
   ```yaml
   triggering:
     branch_patterns:
       - pattern: 'main'
         include: true
       - pattern: 'feature/*'
         include: false
   ```

3. **Parallel Builds**
   - Build iOS & Android simultaneously
   - Uses 2x minutes but faster results

4. **Build Variants**
   ```yaml
   # Create dev, staging, prod workflows
   react-native-ios-dev:
     # Debug build, faster
   react-native-ios-staging:
     # Beta testing
   react-native-ios-prod:
     # Production release
   ```

---

**See [CODEMAGIC_SETUP.md](./CODEMAGIC_SETUP.md) for detailed setup instructions**
