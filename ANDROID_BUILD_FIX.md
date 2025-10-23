# Android Build Error Fix

## The Problem

Android build was failing with this error:

```
error: cannot find symbol
import com.facebook.react.bridge.GuardedResultAsyncTask;
^
symbol:   class GuardedResultAsyncTask
location: package com.facebook.react.bridge
```

**Root Cause**: The old `react-native-document-picker` package uses `GuardedResultAsyncTask`, which was removed from React Native in version 0.78+. Since we're using React Native 0.82.1, this class no longer exists.

---

## The Solution

Replaced the **deprecated** `react-native-document-picker` with the **new** `@react-native-documents/picker` package.

### What Changed:

#### 1. Package Replacement

**package.json**:
```diff
- "react-native-document-picker": "^9.3.1"
+ "@react-native-documents/picker": "^10.1.7"
```

#### 2. Import Update

**ModelsScreen.tsx**:
```diff
- import DocumentPicker from 'react-native-document-picker';
+ import {pick, types} from '@react-native-documents/picker';
```

#### 3. API Usage Update

**Before** (old API):
```typescript
const result = await DocumentPicker.pick({
  type: [DocumentPicker.types.allFiles],
});
const file = result[0];

if (DocumentPicker.isCancel(error)) {
  // Handle cancel
}
```

**After** (new API):
```typescript
const result = await pick({
  type: [types.allFiles],
  allowMultiSelection: false,
});

if (!result || result.length === 0) {
  return; // User cancelled
}

const file = result[0];
```

---

## Changes Made

### Files Modified:

1. **[package.json](package.json)**
   - Removed: `react-native-document-picker`
   - Added: `@react-native-documents/picker@^10.1.7`

2. **[src/screens/ModelsScreen.tsx](src/screens/ModelsScreen.tsx)**
   - Updated import statement
   - Updated `handleImportModel()` function to use new API
   - Simplified error handling (no more `.isCancel()` check)

---

## API Changes Summary

| Old API (react-native-document-picker) | New API (@react-native-documents/picker) |
|----------------------------------------|-------------------------------------------|
| `import DocumentPicker from '...'` | `import {pick, types} from '...'` |
| `DocumentPicker.pick({...})` | `pick({...})` |
| `DocumentPicker.types.allFiles` | `types.allFiles` |
| `DocumentPicker.isCancel(error)` | Check if `result` is empty |

---

## Why This Package?

### @react-native-documents/picker Benefits:

✅ **Compatible with React Native 0.78+** (including 0.82.1)
✅ **No GuardedResultAsyncTask** - uses modern React Native bridge
✅ **Actively maintained** - Latest version 10.1.7 (Oct 2025)
✅ **Backward compatible** - Same functionality, similar API
✅ **TypeScript support** - Better type definitions

### Old Package Issues:

❌ **Deprecated** - No longer updated for RN 0.78+
❌ **Build errors** on Android with modern React Native
❌ **Uses removed APIs** - GuardedResultAsyncTask doesn't exist

---

## Installation & Build

### Install Dependencies:
```bash
npm install
```

### For Android:
```bash
# Clean build
cd android
./gradlew clean
cd ..

# Build and run
npm run android
```

### For iOS:
```bash
cd ios
pod install
cd ..
npm run ios
```

---

## Testing the Fix

### Test Model Import Feature:

1. Launch the app
2. Go to **Models** tab
3. Tap **"Import from Files"** button
4. Select a `.gguf` model file
5. Confirm import
6. Model should be imported successfully

**Expected**: File picker opens, file imports without errors
**Before Fix**: Build would fail, app wouldn't compile

---

## Additional Notes

### No Breaking Changes:

The new API is very similar to the old one, so the user experience remains identical. The only changes are:

- Different package name
- Slightly different method signatures
- Simplified error handling

### Future Compatibility:

The new `@react-native-documents/picker` package is designed for React Native 0.78+ and will continue to work with future versions. It doesn't rely on deprecated APIs.

---

## Troubleshooting

### If build still fails:

1. **Clean build artifacts**:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

2. **Clear npm cache**:
   ```bash
   rm -rf node_modules
   rm package-lock.json
   npm install
   ```

3. **Clear Android build cache**:
   ```bash
   cd android
   ./gradlew cleanBuildCache
   cd ..
   ```

4. **Rebuild**:
   ```bash
   npm run android
   ```

---

## Summary

**Problem**: `GuardedResultAsyncTask` not found in React Native 0.82.1

**Cause**: Old `react-native-document-picker` uses deprecated APIs

**Solution**: Migrated to `@react-native-documents/picker@^10.1.7`

**Result**: ✅ Android build now works properly

---

*Fixed: October 23, 2025*
*React Native 0.82.1 compatible*
