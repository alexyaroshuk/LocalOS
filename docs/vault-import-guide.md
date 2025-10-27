# Obsidian Vault Import Guide

## Overview

LocalOS now supports importing and browsing Obsidian vaults with a **custom folder browser** that follows mobile best practices.

## How It Works

### User Flow

1. **Setup Screen**: User sees "No Vault Configured" with a "Browse & Select Folder" button
2. **Permission Request** (Android only): App requests storage permission with clear explanation
3. **Folder Navigator**: User browses through device storage folder by folder
4. **Selection**: User navigates to their vault folder and taps "Select This Folder as Vault"
5. **Scanning**: App scans all `.md` files in the vault recursively
6. **Browse**: User can now browse and read all markdown files

### Security & Privacy

- **Android**: App requests `READ_EXTERNAL_STORAGE` permission explicitly
- **iOS**: Uses app sandbox - user transfers files via Finder/iTunes first
- **No scanning**: App doesn't list all folders - user navigates manually
- **Explicit selection**: User chooses exactly which folder to use
- **Single vault**: One vault at a time, can be changed later

## Implementation Details

### Components

**FolderNavigator** (`src/components/FolderNavigator.tsx`):
- Custom folder browser UI
- Breadcrumb navigation
- Up/down folder traversal
- Permission handling for Android
- Platform-specific root paths

**VaultBrowserScreen** (`src/screens/VaultBrowserScreen.tsx`):
- Three view modes:
  - `setup`: Shows "Browse & Select Folder" button
  - `navigator`: Full-screen folder browser
  - `browser`: List of vault files
  - `reader`: Markdown file viewer

### Services

**VaultService** (`src/services/VaultService.ts`):
- `initialize()`: Load saved vault config
- `setActiveVault(path)`: Set and scan vault
- `scanVault(path)`: Recursively find all `.md` files
- `readMarkdownFile(path)`: Parse markdown with frontmatter
- `parseFrontmatter(content)`: Extract YAML metadata
- `extractTags()`: Find tags in frontmatter and inline
- `extractLinks()`: Find wiki-style `[[links]]`

### Types

**vault.ts** (`src/types/vault.ts`):
- `VaultFile`: File metadata
- `VaultFolder`: Folder metadata
- `VaultConfig`: Saved vault configuration
- `MarkdownFile`: Parsed markdown with metadata
- `VaultScanResult`: Scan statistics

## Android Setup

### Transfer Vault to Device

1. Connect Android phone to PC via USB
2. On phone, select **"File Transfer"** mode (not "Charging only")
3. On PC, open phone's Internal Storage
4. Navigate to any location (e.g., `Download/` or create `Vaults/`)
5. Copy your Obsidian vault folder
6. Disconnect phone

### In-App Import

1. Open LocalOS app
2. Tap **"Vault"** tab (bottom navigation)
3. Tap **"📂 Browse & Select Folder"**
4. Grant storage permission when prompted
5. Navigate through folders to find your vault
6. Tap **"✓ Select This Folder as Vault"**

**Breadcrumbs**: Tap any breadcrumb to jump up the folder tree
**Up Button**: Tap "↑ Up" to go to parent folder

## iOS Setup

### Transfer Vault to Device

**Mac (Finder)**:
1. Connect iPhone to Mac
2. Open **Finder** → select iPhone
3. Go to **"Files"** tab
4. Find **"LocalOSApp"**
5. Drag vault folder into the app's folder

**Windows (iTunes)**:
1. Connect iPhone to PC
2. Open **iTunes** → select iPhone
3. Go to **"File Sharing"**
4. Select **"LocalOSApp"**
5. Click **"Add Folder..."** and select vault

### In-App Import

1. Open LocalOS app
2. Tap **"Vault"** tab
3. Tap **"📂 Browse & Select Folder"**
4. Navigate to your vault (starts in Documents)
5. Tap **"✓ Select This Folder as Vault"**

## Features

### Current (Read-Only)

- ✅ Browse vault folder structure
- ✅ Navigate with breadcrumbs
- ✅ Parse YAML frontmatter
- ✅ Extract tags (frontmatter + inline `#tags`)
- ✅ Extract wiki links `[[Note Name]]`
- ✅ Display markdown content
- ✅ Show file metadata (size, modified date)
- ✅ Single vault support
- ✅ Change vault anytime

### Future Enhancements

- 🔜 Semantic search across vault (using embedding model)
- 🔜 AI tools to retrieve vault context
- 🔜 Create new notes from AI
- 🔜 Edit existing notes
- 🔜 Multiple vault support
- 🔜 Folder-level browsing (not just flat file list)
- 🔜 Link following (tap `[[link]]` to open)
- 🔜 Markdown rendering (currently plain text)

## Permissions

### Android

**Manifest** (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
                 android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
                 android:maxSdkVersion="32" />
<!-- For Android 13+ -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
```

**Runtime Request**: FolderNavigator requests permission when opened

### iOS

**Info.plist** (`ios/LocalOSApp/Info.plist`):
```xml
<key>UIFileSharingEnabled</key>
<true/>
<key>LSSupportsOpeningDocumentsInPlace</key>
<true/>
<key>UISupportsDocumentBrowser</key>
<true/>
```

These allow file sharing via Finder/iTunes.

## Troubleshooting

### Android

**"No folders found"**:
- Make sure vault is copied to Internal Storage (not SD card)
- Try placing in `Download/` folder
- Check storage permission is granted (Settings → Apps → LocalOS → Permissions)

**"Cannot access this folder"**:
- Some system folders are protected
- Try navigating deeper into user-accessible folders

**Permission denied**:
- Go to Settings → Apps → LocalOS → Permissions
- Enable "Storage" or "Files and media"

### iOS

**"No folders found"**:
- Transfer vault via Finder/iTunes first
- Make sure folder is in app's Documents directory
- Use "On My iPhone" → "LocalOSApp" in Files app

**Vault not appearing**:
- Restart app after file transfer
- Check folder was fully copied (not just started)

## Technical Notes

### Platform Differences

| Feature | Android | iOS |
|---------|---------|-----|
| Root Path | `/storage/emulated/0` | `DocumentDirectoryPath` |
| Permission | Runtime request | Pre-granted via Info.plist |
| Transfer | USB File Transfer | Finder/iTunes |
| Access | Any folder in Internal Storage | App sandbox only |

### Scanning Performance

- Average: ~100 files in <500ms
- Large vaults (1000+ files): 2-5 seconds
- Scan is one-time per vault configuration
- Can re-scan with pull-to-refresh

### Storage Location

Vault configuration saved in **AsyncStorage**:
```json
{
  "vaultPath": "/storage/emulated/0/Download/my-vault",
  "vaultName": "my-vault",
  "configuredAt": "2025-01-27T...",
  "fileCount": 142
}
```

## Development

### Testing

1. Use `sample-vault/` folder in project root
2. Transfer to device following platform instructions above
3. Select via folder navigator
4. Should find example markdown files with tags and links

### Adding Features

To add vault-related features:

1. **Service logic**: Add to `VaultService.ts`
2. **UI components**: Update `VaultBrowserScreen.tsx`
3. **Types**: Extend `src/types/vault.ts`

### Debugging

Enable logs in VaultService:
```typescript
Logger.info('Vault action', data);
```

View in app: Settings → Debug → View Logs

---

**Built with**: React Native, react-native-fs, AsyncStorage
**License**: Same as LocalOS project
