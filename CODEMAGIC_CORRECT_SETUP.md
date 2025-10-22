# Codemagic Correct Setup - React Native iOS (Like Flutter!)

## 🎯 Why Flutter Works But React Native Doesn't

**Flutter**: Codemagic handles signing automatically via UI settings
**React Native**: Requires **environment variables** in YAML (different approach!)

This is why your Flutter builds work but React Native needs extra setup.

---

## ✅ Correct Setup (10 Minutes)

### **Step 1: Get App Store Connect API Key**

You already have this from Apple Developer setup. If not:

1. Go to https://appstoreconnect.apple.com
2. **Users and Access** → **Keys** → **App Store Connect API**
3. Click **"+"** to create key
4. **Name**: "Codemagic"
5. **Access**: Developer
6. **Download** `.p8` file
7. **Note down**:
   - **Issuer ID** (UUID format, e.g., `69a6de9f-1234-47e3-e053-5b8c7c11a4d1`)
   - **Key ID** (10 chars, e.g., `2X9R4HXF34`)
   - **Private Key** (contents of .p8 file)

---

### **Step 2: Create Environment Variable Group in Codemagic**

This is the KEY difference from Flutter!

#### A. Go to Team Settings

1. Open Codemagic: https://app.codemagic.io
2. Click your **profile icon** (top right)
3. Select **Teams**
4. Click on your team name
5. Go to **Global variables and secrets**

#### B. Create Variable Group

1. Click **"+ Add variable group"**
2. **Group name**: `appstore_credentials`
3. Click **"Add variable"** for each of these:

   **Variable 1:**
   - **Key**: `APP_STORE_CONNECT_ISSUER_ID`
   - **Value**: Your Issuer ID (e.g., `69a6de9f-1234-47e3-e053-5b8c7c11a4d1`)
   - **Secure**: ✅ Checked

   **Variable 2:**
   - **Key**: `APP_STORE_CONNECT_KEY_IDENTIFIER`
   - **Value**: Your Key ID (e.g., `2X9R4HXF34`)
   - **Secure**: ✅ Checked

   **Variable 3:**
   - **Key**: `APP_STORE_CONNECT_PRIVATE_KEY`
   - **Value**: Contents of your `.p8` file (paste the entire file including header/footer)
   - **Secure**: ✅ Checked

4. Click **Save**

**Example .p8 file content:**
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgPaXyFvZfNydDEjxgjUCU
... (many lines) ...
jd8wEZe9r3b63P4KCQQ=
-----END PRIVATE KEY-----
```

---

### **Step 3: Register Certificate (One-Time Setup)**

#### Option A: Let Codemagic Create It (Recommended)

The YAML is already configured to auto-create certificates with `--create` flag:

```yaml
app-store-connect fetch-signing-files "$BUNDLE_ID" \
  --type IOS_APP_DEVELOPMENT \
  --create  ← This auto-creates certificates
```

No action needed! Codemagic will create everything on first build.

#### Option B: Use Existing Certificate

If you already have a certificate:

1. Download certificate from Apple Developer Portal
2. Export as `.p12` with password
3. In Codemagic: **Teams** → **Code signing identities**
4. Upload `.p12` file
5. Remove `--create` from YAML

---

### **Step 4: Update Email in codemagic.yaml**

```bash
cd localOS
```

Edit `codemagic.yaml` line 56:
```yaml
email:
  recipients:
    - your-email@example.com  # ← Change to your email
```

---

### **Step 5: Push and Build**

```bash
git add codemagic.yaml
git commit -m "Add correct React Native iOS config"
git push origin main
```

Then in Codemagic:
1. Go to dashboard
2. Click **"Start new build"**
3. Select **react-native-ios** workflow
4. Build!

---

## 📋 What the YAML Does (vs Flutter)

### Flutter Approach (UI-based):
```
Codemagic UI → Code Signing Settings → Auto-fetch files
```

### React Native Approach (Script-based):
```yaml
scripts:
  - keychain initialize           # Create temp keychain
  - fetch-signing-files --create  # Get certs from Apple
  - keychain add-certificates     # Add to keychain
  - xcode-project use-profiles    # Configure Xcode
  - build-ipa                     # Build
```

**Why different?**
- Flutter uses Codemagic's UI abstraction
- React Native uses raw Xcode commands (more control)

---

## 🔍 Key Differences from Your Flutter Setup

| Aspect | Flutter | React Native |
|--------|---------|--------------|
| **Code signing UI** | ✅ Yes | ❌ No |
| **Environment vars** | Optional | ✅ Required |
| **YAML config** | Simple | Detailed scripts |
| **Certificate handling** | Automatic | Manual scripts |
| **Setup time** | 5 min | 10 min |

---

## ✅ Verification Checklist

Before building:

- [ ] App Store Connect API key created
- [ ] Issuer ID copied
- [ ] Key ID copied
- [ ] Private key (.p8) downloaded
- [ ] Environment variable group `appstore_credentials` created in Codemagic
- [ ] All 3 variables added (ISSUER_ID, KEY_IDENTIFIER, PRIVATE_KEY)
- [ ] Variables marked as "Secure"
- [ ] Email updated in codemagic.yaml
- [ ] Changes pushed to GitHub

---

## 🐛 Common Issues

### "Environment variable group not found"

**Error**: `appstore_credentials` group not found

**Fix**:
1. Go to **Teams** → **Global variables and secrets**
2. Verify group name is exactly `appstore_credentials` (no spaces, lowercase)
3. Check variables are inside this group

### "Invalid API key"

**Error**: Failed to authenticate with App Store Connect

**Fix**:
1. Verify you copied the ENTIRE .p8 file content (including BEGIN/END lines)
2. Check Issuer ID and Key ID are correct
3. Make sure API key has "Developer" access (not just "App Manager")

### "Certificate not found"

**Error**: No signing certificate found

**Fix**: First build with `--create` flag will auto-generate. Wait for it to complete.

### "Build hangs at pod install"

**Fix**: Normal for first build with llama.rn (large frameworks). Can take 10-15 minutes.

---

## 🎉 After First Successful Build

You'll see:
```
✓ Keychain initialized
✓ Signing files fetched from Apple
✓ Certificate created: Apple Development
✓ Provisioning profile created
✓ Build succeeded
✓ IPA created: LocalOSApp.ipa
```

Then:
1. Download IPA from **Artifacts**
2. Install via Xcode or Diawi
3. Future builds will be faster (reuses certificate)

---

## 💡 Pro Tips

### Tip 1: Reuse for All React Native Apps

This same setup works for all your React Native apps:
- Same environment variable group
- Just change `BUNDLE_ID` in each project's YAML

### Tip 2: Switch Between Development/Distribution

For TestFlight/App Store:
```yaml
--type IOS_APP_DEVELOPMENT  # For testing

# Change to:
--type IOS_APP_STORE        # For App Store/TestFlight
```

### Tip 3: Cache CocoaPods

Add to YAML to speed up builds:
```yaml
cache:
  cache_paths:
    - $HOME/Library/Caches/CocoaPods
```

---

## 📞 Still Not Working?

### Check Environment Variables

In Codemagic build logs, search for:
```
APP_STORE_CONNECT_ISSUER_ID: ***  (hidden)
APP_STORE_CONNECT_KEY_IDENTIFIER: ***  (hidden)
APP_STORE_CONNECT_PRIVATE_KEY: ***  (hidden)
```

Should show as `***` (secure). If empty, variables not set correctly.

### Check Certificate Creation

Look for in logs:
```
Creating new certificate...
Certificate created: Apple Development
```

If you see "Certificate already exists", that's fine!

---

## 🎯 Summary

**Why it's different from Flutter:**
- Flutter: UI-based code signing (easy but less flexible)
- React Native: Script-based (more setup but more control)

**Key requirement:**
- Environment variable group `appstore_credentials` with 3 variables

**One-time setup:**
1. Create API key
2. Add environment variables
3. Push YAML
4. Build works! ✅

**Just like Flutter:**
- First build takes longer
- Future builds are faster
- Download IPA from artifacts
- Install and use!

---

**Now it will work exactly like your Flutter builds!** 🚀
