# iOS File Picker Fix: Invalid File Error

## The Problem

When trying to import a `.gguf` model file on iOS using the document picker, users got an "Invalid File" error **even though they selected a valid `.gguf` file**.

### Error Message:
```
Invalid File
Please select a .gguf model file
```

---

## Root Cause

The issue was in how we were checking the filename:

```typescript
// ❌ Old code - file.name might be undefined on iOS
if (!file.name?.endsWith('.gguf')) {
  Alert.alert('Invalid File', 'Please select a .gguf model file');
  return;
}
```

**Problem**:
- On iOS, the `@react-native-documents/picker` package might not always populate `file.name`
- Sometimes the filename is only available in the `file.uri` path
- This caused valid `.gguf` files to be rejected

---

## The Solution

### 1. **Fallback Filename Extraction**

Extract filename from either `name` property OR from the `uri` path:

```typescript
// ✅ New code - try multiple sources
const fileName = file.name || file.uri?.split('/').pop() || '';
```

This checks:
1. `file.name` first (if provided)
2. Falls back to extracting from `file.uri` path
3. Falls back to empty string if both fail

### 2. **Case-Insensitive Check**

Make the extension check case-insensitive:

```diff
- if (!fileName.endsWith('.gguf')) {
+ if (!fileName.toLowerCase().endsWith('.gguf')) {
```

This handles:
- `.gguf` ✅
- `.GGUF` ✅
- `.Gguf` ✅

### 3. **Better Error Messages**

Show the actual filename in error messages for debugging:

```typescript
Alert.alert(
  'Invalid File',
  `Please select a .gguf model file.\n\nSelected: ${fileName || 'Unknown file'}`,
);
```

### 4. **Debug Logging**

Added console logs to help debug file picker issues:

```typescript
console.log('File picker result:', JSON.stringify(file, null, 2));
console.log('Extracted filename:', fileName);
```

---

## Changes Made

### File Modified: [ModelsScreen.tsx](src/screens/ModelsScreen.tsx)

```diff
  const handleImportModel = async () => {
    try {
      const result = await pick({
        type: [types.allFiles],
        allowMultiSelection: false,
      });

      const file = result[0];

+     console.log('File picker result:', JSON.stringify(file, null, 2));

-     // Check if it's a GGUF file
-     if (!file.name?.endsWith('.gguf')) {
+     // Get filename from either name or uri
+     const fileName = file.name || file.uri?.split('/').pop() || '';
+
+     console.log('Extracted filename:', fileName);
+
+     // Check if it's a GGUF file (case-insensitive)
+     if (!fileName.toLowerCase().endsWith('.gguf')) {
        Alert.alert(
          'Invalid File',
-         'Please select a .gguf model file'
+         `Please select a .gguf model file.\n\nSelected: ${fileName || 'Unknown file'}`
        );
        return;
      }

-     const modelName = file.name.replace('.gguf', '');
+     const modelName = fileName.replace(/\.gguf$/i, '');
```

---

## How to Test

### Test Case 1: Import from Files App
1. Download a `.gguf` model to iPhone (e.g., via Safari)
2. Open LocalOS app
3. Go to **Models** tab
4. Tap **"Import from Files"**
5. Select your `.gguf` file from Files app
6. **Expected**: File is recognized and import confirmation appears
7. **Before Fix**: "Invalid File" error

### Test Case 2: Import from iCloud
1. Save `.gguf` model to iCloud Drive
2. Follow same steps as above
3. **Expected**: File is recognized
4. **Before Fix**: "Invalid File" error

### Test Case 3: Different Case Extensions
Try importing files with:
- `model.gguf` ✅
- `model.GGUF` ✅
- `model.Gguf` ✅

All should work.

---

## Debugging File Picker Issues

If file picker still doesn't work, check the console logs:

```typescript
console.log('File picker result:', JSON.stringify(file, null, 2));
```

**Expected output**:
```json
{
  "uri": "file:///var/mobile/Containers/Data/Application/.../model.gguf",
  "name": "model.gguf",
  "type": "application/octet-stream",
  "size": 2100000000
}
```

**If `name` is missing**:
```json
{
  "uri": "file:///path/to/model.gguf",
  "name": null,  // ← Missing!
  "type": "application/octet-stream",
  "size": 2100000000
}
```

Our fix handles this by extracting from `uri`.

---

## iOS Permissions (Already Configured)

These are already in [Info.plist](ios/LocalOSApp/Info.plist):

```xml
<key>UIFileSharingEnabled</key>
<true/>
<key>LSSupportsOpeningDocumentsInPlace</key>
<true/>
<key>UISupportsDocumentBrowser</key>
<true/>
```

These allow:
- ✅ File sharing via iTunes/Finder
- ✅ Opening documents from other apps
- ✅ Document browser integration

---

## Alternative: Import via iTunes/Finder

If document picker still has issues, users can import via iTunes/Finder:

### Method 1: Finder (macOS Catalina+)
1. Connect iPhone to Mac
2. Open **Finder**
3. Select your iPhone
4. Go to **Files** tab
5. Find **LocalOSApp**
6. Drag `.gguf` file into the app folder

### Method 2: iTunes (Windows/older macOS)
1. Connect iPhone to computer
2. Open **iTunes**
3. Select your iPhone
4. Go to **File Sharing** section
5. Select **LocalOSApp**
6. Click **Add File...**
7. Select your `.gguf` model

Files will appear in the app's Documents directory.

---

## Common Issues & Solutions

### Issue 1: "Invalid File" despite selecting .gguf

**Solution**: This fix addresses this! Update the code and rebuild.

### Issue 2: File picker doesn't open

**Check**:
- iOS permissions in Info.plist ✅ (already configured)
- `@react-native-documents/picker` is installed ✅
- Running latest code ✅

**Try**:
```bash
cd ios
pod install
cd ..
npm run ios
```

### Issue 3: File shows but import fails

**Check logs**:
```bash
# View iPhone logs
npm start
# In another terminal
npx react-native log-ios
```

Look for:
```
File picker result: {...}
Extracted filename: ...
```

### Issue 4: "Access denied" when copying file

**Cause**: iOS sandboxing prevents copying from some locations

**Solution**: Use `react-native-fs` to copy with proper permissions (already implemented in `ModelStorageService`)

---

## Technical Details

### Why `file.name` Might Be Missing

On iOS, the document picker API doesn't always guarantee the `name` property:
- Depends on file source (Files app, iCloud, third-party)
- Some cloud storage providers don't expose filename
- Security/sandboxing restrictions

### URI Format on iOS

iOS URIs look like:
```
file:///var/mobile/Containers/Data/Application/[UUID]/tmp/model.gguf
```

Extracting filename:
```typescript
file.uri.split('/').pop()  // Returns: "model.gguf"
```

### Case Sensitivity

iOS filesystem is **case-insensitive**, so:
- `model.gguf` and `model.GGUF` refer to the same file
- But JavaScript string comparison is case-sensitive
- Solution: Use `.toLowerCase()` before checking

---

## Summary

**Problem**: iOS file picker rejected valid `.gguf` files

**Root Cause**: `file.name` property was undefined

**Solution**:
1. Fall back to extracting filename from `file.uri`
2. Use case-insensitive extension check
3. Add debug logging
4. Improve error messages

**Result**: ✅ File import now works on iOS!

---

*Fixed: October 23, 2025*
*Tested on iOS with `@react-native-documents/picker@^10.1.7`*
