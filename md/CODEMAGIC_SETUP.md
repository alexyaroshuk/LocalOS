# Codemagic Setup Guide for LocalOS React Native App

Complete guide to build iOS and Android apps using Codemagic CI/CD without a Mac.

---

## 🎯 Overview

Codemagic will:
- ✅ Build iOS IPA files on macOS machines
- ✅ Build Android APK/AAB files
- ✅ Handle code signing automatically
- ✅ Deploy to TestFlight / App Store / Play Store
- ✅ Run tests and linting

---

## 📋 Prerequisites

### 1. **GitHub Repository**
- Push your LocalOSApp code to GitHub
- Make sure `codemagic.yaml` is in the root directory

### 2. **Codemagic Account**
- Sign up at https://codemagic.io
- Connect your GitHub account
- Free tier: 500 build minutes/month

### 3. **Apple Developer Account** (for iOS)
- Enrolled in Apple Developer Program ($99/year)
- Access to App Store Connect

### 4. **Google Play Console** (for Android)
- Developer account ($25 one-time)

---

## 🚀 Step-by-Step Setup

### **Part 1: Initial Codemagic Setup**

#### 1. Connect GitHub Repository

1. Log in to https://app.codemagic.io
2. Click **"Add application"**
3. Select **GitHub** as source
4. Choose your **localOS** repository
5. Select **React Native** as project type
6. Codemagic will detect `codemagic.yaml` automatically

#### 2. Choose Workflow

After adding the app, you'll see three workflows:
- **react-native-ios**: Production iOS builds
- **react-native-android**: Production Android builds
- **react-native-dev**: Development/testing builds

---

### **Part 2: iOS Setup**

#### 1. **Create App Store Connect API Key**

1. Go to https://appstoreconnect.apple.com
2. Navigate to **Users and Access** → **Keys** → **App Store Connect API**
3. Click **"+"** to generate a new key
4. **Name**: "Codemagic CI"
5. **Access**: **Developer** (or App Manager)
6. Download the `.p8` file (keep it safe!)
7. Note down:
   - **Issuer ID** (UUID format)
   - **Key ID** (10 characters)

#### 2. **Add App Store Connect Integration to Codemagic**

1. In Codemagic, go to **Teams** → **Integrations**
2. Click **App Store Connect**
3. Click **"+ Add key"**
4. Enter:
   - **Key name**: "LocalOS App Store Key"
   - **Issuer ID**: (from step 1)
   - **Key ID**: (from step 1)
   - **API Key**: Upload your `.p8` file
5. Click **Save**

#### 3. **Create App ID in Apple Developer**

1. Go to https://developer.apple.com/account
2. Navigate to **Certificates, IDs & Profiles** → **Identifiers**
3. Click **"+"** to create new App ID
4. Select **App IDs** → **App** → Continue
5. Enter:
   - **Description**: "LocalOS - Local AI Chat"
   - **Bundle ID**: `com.localosapp` (Explicit)
   - **Capabilities**: Enable any needed (e.g., iCloud, Push Notifications)
6. Click **Register**

#### 4. **Create App in App Store Connect**

1. Go to https://appstoreconnect.apple.com
2. Click **"+"** → **New App**
3. Enter:
   - **Platform**: iOS
   - **Name**: "LocalOS"
   - **Primary Language**: English
   - **Bundle ID**: Select `com.localosapp`
   - **SKU**: `localos-001` (unique identifier)
4. Click **Create**

#### 5. **Configure Code Signing in Codemagic**

1. In your Codemagic app settings, select **iOS code signing**
2. Choose **Automatic code signing**
3. Select your **App Store Connect integration**
4. Enter **Bundle ID**: `com.localosapp`
5. Click **Fetch signing files** (Codemagic will auto-generate certificates)

---

### **Part 3: Android Setup**

#### 1. **Create Upload Keystore**

On your local machine:

```bash
cd LocalOSApp/android/app

# Generate keystore
keytool -genkeypair -v -storetype PKCS12 \
  -keystore localos-upload-key.keystore \
  -alias localos-key-alias \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_STRONG_PASSWORD \
  -keypass YOUR_STRONG_PASSWORD \
  -dname "CN=Your Name, OU=LocalOS, O=Your Company, L=City, ST=State, C=US"
```

**⚠️ Important**: Save these securely:
- Keystore file: `localos-upload-key.keystore`
- Store password: `YOUR_STRONG_PASSWORD`
- Key alias: `localos-key-alias`
- Key password: `YOUR_STRONG_PASSWORD`

#### 2. **Upload Keystore to Codemagic**

1. In Codemagic app settings, go to **Android code signing**
2. Click **"+ Add key"**
3. Enter:
   - **Keystore reference name**: `keystore_reference`
   - **Keystore file**: Upload `localos-upload-key.keystore`
   - **Keystore password**: Your store password
   - **Key alias**: `localos-key-alias`
   - **Key password**: Your key password
4. Click **Save**

#### 3. **Create Google Play Service Account**

1. Go to https://play.google.com/console
2. Navigate to **Setup** → **API access**
3. Click **"Create new service account"**
4. Follow link to **Google Cloud Console**
5. Create service account:
   - **Name**: "Codemagic CI"
   - **Role**: None (skip)
6. Create JSON key:
   - Click on created service account
   - **Keys** tab → **Add Key** → **Create new key**
   - **Type**: JSON
   - Download the JSON file
7. Back in Play Console, click **Done**
8. Grant permissions:
   - Find "Codemagic CI" service account
   - Click **Grant access**
   - Select **Admin (all permissions)** or specific permissions
   - Save

#### 4. **Add Google Play Integration to Codemagic**

1. In Codemagic **Teams** → **Integrations**
2. Click **Google Play**
3. Click **"+ Add key"**
4. Enter:
   - **Name**: "LocalOS Play Store"
   - **Service account credentials**: Upload your JSON file
5. Click **Save**

#### 5. **Create App in Google Play Console**

1. Go to https://play.google.com/console
2. Click **"Create app"**
3. Enter:
   - **App name**: "LocalOS"
   - **Default language**: English (United States)
   - **App or game**: App
   - **Free or paid**: Free
4. Complete **Dashboard** setup requirements:
   - App access
   - Ads
   - Content rating
   - Target audience
   - Data safety
   - App category
5. Create **Internal testing** release (required before production)

---

### **Part 4: Update codemagic.yaml**

Update the `codemagic.yaml` file in your repo:

```yaml
# Replace in codemagic.yaml:

workflows:
  react-native-ios:
    # ... existing config ...
    environment:
      ios_signing:
        distribution_type: app_store
        bundle_identifier: com.localosapp  # ✅ Your Bundle ID
      vars:
        BUNDLE_ID: "com.localosapp"  # ✅ Your Bundle ID
    publishing:
      email:
        recipients:
          - your-email@example.com  # ✅ Your email
      app_store_connect:
        auth: integration
        submit_to_testflight: true  # Auto-submit to TestFlight

  react-native-android:
    # ... existing config ...
    environment:
      vars:
        PACKAGE_NAME: "com.localosapp"  # ✅ Your package name
      groups:
        - google_play  # ✅ Create this environment variable group
    publishing:
      email:
        recipients:
          - your-email@example.com  # ✅ Your email
      google_play:
        credentials: $GCLOUD_SERVICE_ACCOUNT_CREDENTIALS
        track: internal  # Deploy to internal testing track
```

#### Create Environment Variable Group

1. In Codemagic, go to **Teams** → **Global variables and secrets**
2. Click **"+ Add variable group"**
3. Name: `google_play`
4. Add variable:
   - **Key**: `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`
   - **Value**: Paste contents of Google Play service account JSON
   - **Secure**: ✅ Checked
5. Click **Save**

---

### **Part 5: Trigger Your First Build**

#### 1. **Push to GitHub**

```bash
cd LocalOSApp
git add .
git commit -m "Add Codemagic configuration"
git push origin main
```

#### 2. **Start Build in Codemagic**

1. Go to your app in Codemagic
2. Select workflow: **react-native-ios** or **react-native-android**
3. Click **"Start new build"**
4. Select branch: **main**
5. Click **"Start new build"**

#### 3. **Monitor Build Progress**

- Watch the live log in Codemagic dashboard
- Build takes ~15-30 minutes for iOS, ~10-15 minutes for Android
- You'll receive email notification when complete

---

## 📦 Build Outputs

### **iOS**
- **IPA file**: Distributed to TestFlight automatically
- **dSYM files**: For crash symbolication
- **Logs**: Available in Codemagic dashboard

### **Android**
- **APK file**: For direct distribution
- **AAB file**: Uploaded to Play Console internal track
- **Logs**: Available in Codemagic dashboard

---

## 🔧 Advanced Configuration

### **Build Triggers**

Add to `codemagic.yaml` to auto-build on push:

```yaml
workflows:
  react-native-ios:
    triggering:
      events:
        - push
        - tag
        - pull_request
      branch_patterns:
        - pattern: 'main'
          include: true
          source: true
        - pattern: 'release/*'
          include: true
          source: true
```

### **Environment Variables**

Add secrets in Codemagic UI:
1. Go to **app settings** → **Environment variables**
2. Add variables like API keys:
   - `HUGGING_FACE_TOKEN`
   - `SENTRY_DSN`
   - etc.

### **Caching Dependencies**

Add to `codemagic.yaml`:

```yaml
workflows:
  react-native-ios:
    cache:
      cache_paths:
        - $CM_BUILD_DIR/node_modules
        - $HOME/.pub-cache
        - $HOME/Library/Caches/CocoaPods
```

### **Version Bumping**

Add script to auto-increment version:

```yaml
scripts:
  - name: Bump version
    script: |
      cd ios
      agvtool new-version -all $(($(agvtool what-version -terse) + 1))
      cd ..
```

---

## 🐛 Troubleshooting

### **iOS Build Issues**

**Problem**: "Code signing error"
- **Solution**: Re-fetch signing files in Codemagic code signing settings

**Problem**: "Pod install failed"
- **Solution**: Clear cache and rebuild:
  ```yaml
  - name: Clean CocoaPods cache
    script: |
      cd ios
      rm -rf Pods Podfile.lock
      bundle exec pod install
  ```

**Problem**: "Xcode build failed"
- **Solution**: Check Xcode version compatibility. llama.rn requires Xcode 14+

### **Android Build Issues**

**Problem**: "Gradle build failed"
- **Solution**: Check Java version (should be 17)

**Problem**: "Signing failed"
- **Solution**: Verify keystore credentials in Codemagic settings

**Problem**: "Out of memory"
- **Solution**: Increase Gradle memory:
  ```gradle
  # android/gradle.properties
  org.gradle.jvmargs=-Xmx4096m -XX:MaxPermSize=512m
  ```

### **llama.rn Specific Issues**

**Problem**: "Native module build failed"
- **Solution**: llama.rn includes pre-built binaries. If building from source, increase build timeout:
  ```yaml
  max_build_duration: 120  # 2 hours
  ```

**Problem**: "Large IPA/APK size"
- **Solution**: Expected! AI models and llama.cpp binaries are large. Final app will be 150-200MB.

---

## 💰 Cost Considerations

### **Codemagic Pricing**

**Free Tier**:
- 500 build minutes/month
- Unlimited team members
- All features included

**Each Build Uses**:
- iOS: ~25-35 minutes
- Android: ~10-15 minutes

**Example**: ~15-20 builds/month on free tier

**Paid Plans**: Starting at $40/month for 1000 minutes

### **Other Costs**

- Apple Developer: $99/year
- Google Play: $25 one-time
- App Store Connect API: Free

---

## 📚 Additional Resources

- **Codemagic Docs**: https://docs.codemagic.io/yaml-quick-start/building-a-react-native-app/
- **React Native iOS**: https://docs.codemagic.io/yaml-basic-configuration/yaml-getting-started/
- **Code Signing**: https://docs.codemagic.io/yaml-code-signing/signing-ios/
- **Publishing**: https://docs.codemagic.io/yaml-publishing/app-store-connect/

---

## ✅ Final Checklist

Before your first build:

- [ ] GitHub repo connected to Codemagic
- [ ] `codemagic.yaml` in repo root
- [ ] App Store Connect API key added
- [ ] iOS code signing configured
- [ ] Android keystore uploaded
- [ ] Google Play service account added
- [ ] App created in App Store Connect
- [ ] App created in Google Play Console
- [ ] Email notifications configured
- [ ] Environment variables set

**You're ready to build!** 🚀

---

## 🎉 Success!

After your first successful build:
- **iOS**: Check TestFlight for your build (1-2 hours processing)
- **Android**: Check Play Console internal testing track

**No Mac required!** Codemagic handles everything in the cloud.
