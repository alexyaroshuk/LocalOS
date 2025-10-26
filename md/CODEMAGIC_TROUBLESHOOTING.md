# Codemagic Troubleshooting - Common Issues

## ❌ Error: "No matching profiles found for bundle identifier"

### Full Error Message
```
No matching profiles found for bundle identifier "com.localosapp" and distribution type "ad_hoc"
```

### 🔍 Cause
Codemagic's automatic code signing hasn't generated the ad-hoc provisioning profile yet, OR you haven't registered any devices.

### ✅ Solution (Choose One)

---

## **Solution 1: Switch to Development Signing (Easiest)**

For testing, development signing is simpler and works immediately.

### Update `codemagic.yaml`:

```yaml
workflows:
  react-native-ios:
    environment:
      ios_signing:
        distribution_type: development  # ← Changed from ad_hoc
        bundle_identifier: com.localosapp
```

### What this does:
- ✅ Works immediately (no device registration needed)
- ✅ Can install on any device you add to Apple Developer
- ✅ Perfect for development/testing
- ⚠️ Expires every 7 days (need to rebuild)

### Steps:
1. Update `codemagic.yaml` (change `ad_hoc` to `development`)
2. Push to GitHub
3. In Codemagic: **iOS code signing** → **Fetch signing files** (refresh)
4. Start new build
5. Done! ✅

---

## **Solution 2: Register Test Devices (For Ad-Hoc)**

If you want ad-hoc distribution (better for sharing with testers):

### Step 1: Get Device UDID

**On iPhone:**
1. Connect to Mac
2. Open **Finder** → Select your iPhone
3. Click on **Serial Number** → Shows **UDID**
4. **Right-click** → Copy UDID

**Without Mac:**
1. Install **"UDID Calculator"** or **"Get UDID"** from App Store
2. Open app → Shows UDID
3. Copy it

**Alternative:**
1. Go to https://www.whatismyudid.com
2. Follow instructions to get UDID via profile

### Step 2: Register Device in Apple Developer

1. Go to https://developer.apple.com/account
2. Navigate to **Certificates, IDs & Profiles**
3. Click **Devices** (left sidebar)
4. Click **"+"** button
5. Select **iOS, tvOS, watchOS**
6. Enter:
   - **Device Name**: "My iPhone" (or your name)
   - **Device ID (UDID)**: Paste your UDID
7. Click **Continue** → **Register**

### Step 3: Refresh Provisioning Profile in Codemagic

1. Go to Codemagic → Your app → **iOS code signing**
2. Click **"Fetch signing files"** button
   - This regenerates the provisioning profile with your newly registered device
3. You should see:
   ```
   ✓ Certificate found
   ✓ Provisioning profile found (includes 1 device)
   ```

### Step 4: Rebuild

1. Go to Codemagic dashboard
2. Click **"Start new build"**
3. Build should succeed! ✅

---

## **Solution 3: Use App Store Distribution + TestFlight**

If you want easier distribution without device registration:

### Update `codemagic.yaml`:

```yaml
workflows:
  react-native-ios:
    name: React Native iOS Build (TestFlight)
    integrations:
      app_store_connect: codemagic  # ← Add this
    environment:
      ios_signing:
        distribution_type: app_store  # ← Changed from ad_hoc
        bundle_identifier: com.localosapp
    # ... rest of config ...
    publishing:
      email:
        recipients:
          - your-email@example.com
      app_store_connect:  # ← Add this
        auth: integration
        submit_to_testflight: true
        submit_to_app_store: false
```

### Additional Step: Create App in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click **"+"** → **New App**
3. Enter:
   - **Name**: "LocalOS"
   - **Language**: English
   - **Bundle ID**: Select `com.localosapp`
   - **SKU**: `localos-001`
4. Click **Create**

### What this does:
- ✅ No device registration needed
- ✅ Share via TestFlight links
- ✅ Up to 10,000 testers
- ⚠️ First upload takes 1-2 hours to process

---

## 🎯 Recommended Solution by Use Case

| Use Case | Solution | Pros | Cons |
|----------|----------|------|------|
| **Solo testing** | Development | ✅ Fast, no setup | ⏰ Expires in 7 days |
| **Small team (1-10)** | Ad-hoc | ✅ No expiry | 📱 Device registration |
| **Larger team** | TestFlight | ✅ Easy sharing | ⏳ 1-2 hour processing |
| **Production** | App Store | ✅ Public | 📝 Review required |

---

## 🔧 Quick Fix Commands

### Check Current Code Signing Settings

In Codemagic dashboard:
1. Go to **App settings** → **iOS code signing**
2. Verify:
   - ✅ Integration selected
   - ✅ Bundle ID matches: `com.localosapp`
   - ✅ Distribution type selected
   - ✅ "Fetch signing files" clicked recently

### Force Refresh Signing

If build still fails:

1. **Delete existing certificates** (in Codemagic):
   - iOS code signing → **Delete** old certificates
2. **Re-fetch**:
   - Click **"Fetch signing files"**
   - Wait for success message
3. **Rebuild**:
   - Start new build

---

## 📋 Comparison Table

### Development vs Ad-Hoc vs App Store

| Feature | Development | Ad-Hoc | App Store |
|---------|-------------|---------|-----------|
| Device limit | 100 | 100 | Unlimited |
| Registration | Team members only | Must register UDID | None |
| Expiry | 7 days | 1 year | Permanent |
| Distribution | Local install | Link/file sharing | TestFlight/App Store |
| Setup time | Instant | 5 minutes | 30 minutes |
| Best for | Testing | Beta testers | Public release |

---

## ✅ Step-by-Step Fix (Development Distribution)

The fastest way to get building:

### 1. Update codemagic.yaml

```yaml
# Change this line:
distribution_type: ad_hoc

# To this:
distribution_type: development
```

### 2. Commit and Push

```bash
git add codemagic.yaml
git commit -m "Switch to development signing"
git push origin main
```

### 3. Refresh Signing in Codemagic

1. Go to Codemagic → **iOS code signing**
2. Change **Distribution** dropdown to **Development**
3. Click **"Fetch signing files"**
4. Wait for success ✅

### 4. Rebuild

1. Dashboard → **"Start new build"**
2. Should succeed in ~25 minutes
3. Download IPA from artifacts

### 5. Install on Device

**Using Xcode:**
1. Connect iPhone to Mac
2. Open Xcode → **Window** → **Devices and Simulators**
3. Drag IPA file to your device
4. Done! ✅

---

## 🔍 Verify Your Setup

Run this checklist:

- [ ] Apple Developer account active
- [ ] App Store Connect API key added to Codemagic
- [ ] App ID registered (`com.localosapp`)
- [ ] Codemagic integration configured
- [ ] Distribution type matches device registration:
  - Development: Any team device ✅
  - Ad-hoc: Devices must be registered
  - App Store: App created in ASC
- [ ] "Fetch signing files" clicked recently
- [ ] Bundle ID matches in all places

---

## 💡 Pro Tips

### Tip 1: Check Which Devices Are in Profile

After fetching signing files:
1. Download the provisioning profile from Codemagic
2. Open in text editor
3. Search for `<key>ProvisionedDevices</key>`
4. See list of UDIDs included

### Tip 2: Use Multiple Workflows

Create different workflows for different purposes:

```yaml
workflows:
  # For your testing
  react-native-ios-dev:
    environment:
      ios_signing:
        distribution_type: development

  # For beta testers
  react-native-ios-beta:
    environment:
      ios_signing:
        distribution_type: ad_hoc

  # For production
  react-native-ios-prod:
    environment:
      ios_signing:
        distribution_type: app_store
```

### Tip 3: Auto-Register Devices

You can't auto-register, but you can:
1. Keep a shared doc with tester UDIDs
2. Register in batches
3. Set up automated reminders to refresh profiles monthly

---

## 📞 Still Having Issues?

### Check Build Logs

1. Codemagic → Your build → **Logs**
2. Search for "Signing"
3. Look for:
   ```
   ✓ Certificate: Found
   ✓ Profile: Found
   ✓ Devices: 3 registered
   ```

### Common Log Messages

**"No devices found in profile"**
→ Register at least one device in Apple Developer Portal

**"Certificate not trusted"**
→ Delete and re-fetch signing files

**"Bundle ID mismatch"**
→ Check `com.localosapp` in all configs

### Get Help

- **Codemagic Slack**: https://codemagic.io/slack
- **Email**: support@codemagic.io
- **Docs**: https://docs.codemagic.io/yaml-code-signing/signing-ios/

---

## 🎉 Quick Summary

**Error**: No matching profiles found

**Fastest Fix**:
1. Change to `distribution_type: development` in `codemagic.yaml`
2. Push to GitHub
3. Codemagic → Fetch signing files
4. Rebuild
5. Done! ✅

**Alternative**: Register device UDID, refresh profile, rebuild

**Best Practice**: Use development for testing, ad-hoc for beta, TestFlight for wider testing

---

**Need immediate help?** Use Solution 1 (Development signing) - works in 5 minutes! 🚀
