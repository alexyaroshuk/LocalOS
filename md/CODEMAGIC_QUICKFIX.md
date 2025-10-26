# Quick Fix: "No matching profiles found"

## ❌ Error You're Seeing

```
No matching profiles found for bundle identifier "com.localosapp"
and distribution type "ad_hoc"
```

---

## ✅ 5-Minute Fix (Already Done!)

I've updated your `codemagic.yaml` to use **development** signing instead of **ad-hoc**.

### What Changed:

```yaml
# Before (ad-hoc - requires device registration):
distribution_type: ad_hoc  ❌

# After (development - works immediately):
distribution_type: development  ✅
```

---

## 🚀 What To Do Now

### **Step 1: Refresh Code Signing in Codemagic**

1. Go to https://app.codemagic.io
2. Open your **LocalOS** app
3. Click **App settings** → **iOS code signing**
4. In the dropdown, change **Distribution** to **Development**
5. Click **"Fetch signing files"** button
6. Wait for ✅ success message

### **Step 2: Rebuild**

1. Go back to **Dashboard**
2. Click **"Start new build"**
3. Select workflow: **react-native-ios**
4. Click **"Start new build"**

### **Step 3: Download IPA**

- After ~25 minutes, build will complete
- Go to **Artifacts** tab
- Download `LocalOSApp.ipa`
- Install using Xcode or Diawi

---

## 📱 Installing the IPA

### **Option 1: Using Xcode (if you have a Mac)**

1. Connect your iPhone via USB
2. Open **Xcode**
3. Go to **Window** → **Devices and Simulators**
4. Select your iPhone
5. Drag `LocalOSApp.ipa` into the **Installed Apps** section
6. App appears on your iPhone! ✅

### **Option 2: Using Diawi (no Mac needed)**

1. Go to https://www.diawi.com
2. Upload `LocalOSApp.ipa`
3. Get shareable link
4. Open link on iPhone
5. Tap **Install**
6. Go to **Settings** → **General** → **VPN & Device Management**
7. Trust the developer certificate
8. Open LocalOS app! ✅

---

## 🔄 Development vs Ad-Hoc Signing

| Feature | Development (NEW) | Ad-Hoc (OLD) |
|---------|-------------------|--------------|
| Device registration | ❌ Not required | ✅ Required |
| Works immediately | ✅ Yes | ❌ No |
| Certificate expiry | 7 days | 1 year |
| Max devices | 100 | 100 |
| Setup time | 0 minutes | 5 minutes |
| Best for | Quick testing | Beta distribution |

**Why development is better for you:**
- ✅ Builds work immediately
- ✅ No device registration hassle
- ✅ Can add devices anytime via Apple Developer
- ⚠️ Need to rebuild every 7 days (free on Codemagic)

---

## 🎯 If You Want Ad-Hoc Later

When you have specific test devices and want longer-lasting builds:

### Step 1: Register Device UDID

1. Get UDID from iPhone:
   - Connect to Mac → Finder → Click serial number
   - OR use "UDID Calculator" app
   - OR visit https://www.whatismyudid.com

2. Register in Apple Developer:
   - https://developer.apple.com/account
   - **Devices** → **"+"**
   - Enter UDID
   - Register

### Step 2: Update codemagic.yaml

```yaml
ios_signing:
  distribution_type: ad_hoc  # Change back to ad_hoc
```

### Step 3: Refresh & Rebuild

1. Push changes to GitHub
2. Codemagic → **Fetch signing files**
3. Rebuild

---

## 📋 Troubleshooting Checklist

If build still fails:

- [ ] Changed `distribution_type: development` in codemagic.yaml
- [ ] Pushed changes to GitHub
- [ ] Went to Codemagic iOS code signing settings
- [ ] Changed dropdown to **Development**
- [ ] Clicked **"Fetch signing files"**
- [ ] Saw success message ✅
- [ ] Started new build

Still stuck? See [CODEMAGIC_TROUBLESHOOTING.md](./CODEMAGIC_TROUBLESHOOTING.md)

---

## 💡 Pro Tip

### Use Both Workflows

Create two workflows for different purposes:

```yaml
# Quick daily testing (development)
react-native-ios-dev:
  environment:
    ios_signing:
      distribution_type: development

# Beta releases (ad-hoc)
react-native-ios-beta:
  environment:
    ios_signing:
      distribution_type: ad_hoc
```

Then choose the right workflow when building!

---

## 🎉 Summary

**Problem**: Ad-hoc requires device registration
**Solution**: Use development signing instead
**Action**:
1. ✅ Code already updated
2. Refresh signing in Codemagic
3. Rebuild
4. Download & install

**Time to working build**: 30 minutes (including build time)

---

**Ready to build?** Go to Codemagic and follow Step 1 above! 🚀
