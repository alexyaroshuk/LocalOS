# Dev Mode for Memory Viewer

## Summary

Added a developer mode to MemoryViewerScreen that displays all data in a table format for easy inspection and debugging.

## Features

### Dev Mode Toggle
- Located in the top-right corner of the Memory Viewer header
- Shows "📊 DEV" when active (default), "📱 UI" when inactive
- Blue background when active, gray when inactive

### Table View
When dev mode is active, all tabs show data in a structured table format:

**Table Features:**
- Fixed-width columns for proper alignment
- Column widths optimized per data type:
  - `id`: 60px
  - `content`, `description`: 300px
  - `embedding`: 200px
  - `properties`, `metadata`: 200px
  - `timestamps`: 100px
  - `category`, `status`, `importance`: 100px
  - `folder_path`, `path`: 200px
  - `name`, `title`: 150px
  - Default: 120px

- Horizontal and vertical scrolling
- Alternating row colors (white/light gray)
- Blue header with white text
- Monospace font for data cells
- Max 5 lines per cell with ellipsis

### Tabs Supported

1. **Core Memory** - Shows block_name and content
2. **Archive** - Shows all archive memory fields (id, content, category, importance, timestamps, etc.)
3. **Tasks** - Shows all task fields (id, title, status, deadline, etc.)
4. **Knowledge** - Shows all knowledge fields (id, name, folder_path, content, properties, embedding, timestamps)

## Usage

1. Open Memory Viewer screen
2. Dev mode is **enabled by default**
3. Click the toggle button in the top-right to switch between:
   - **Dev Mode** (📊): Table view for developers
   - **UI Mode** (📱): Card view for users

## Benefits for Development

- **Easy Database Inspection**: See raw data exactly as stored
- **Column Alignment**: All fields aligned vertically for comparison
- **JSON Inspection**: Object fields displayed as JSON strings
- **Full Data Visibility**: No truncation in card views
- **Quick Debugging**: Identify data issues at a glance

## Implementation Details

### Key Components

**State:**
```typescript
const [devMode, setDevMode] = useState(true);
```

**Render Function:**
```typescript
const renderDataTable = (data: any[], _title: string) => {
  // Calculates column widths based on field names
  // Renders headers and rows with fixed widths
  // Handles objects by JSON.stringify
}
```

**Updated Render Functions:**
```typescript
const renderCoreMemory = () => {
  if (devMode && coreMemory) {
    return renderDataTable(coreData, 'Core Memory');
  }
  return <NormalCardView />;
};
```

### Styles Added

- `tableContainer`: Wrapper with border
- `tableRow`: Horizontal flex container
- `tableRowEven`: Alternate row background
- `tableHeaderCell`: Blue header cells with padding
- `tableHeaderText`: Bold white uppercase text
- `tableCell`: Data cells with borders
- `tableCellText`: Monospace font for data

## Example Use Cases

### 1. Verify Embeddings Stored
Switch to Archive or Knowledge tab in dev mode, scroll right to see the `embedding` column with base64-encoded vectors.

### 2. Check Timestamps
Easily compare `created_at` and `updated_at` timestamps in table format.

### 3. Inspect Properties
See the full JSON of `properties` field for knowledge entries without needing to click into each card.

### 4. Debug Data Types
Quickly identify null values, empty strings, or unexpected data types across multiple entries.

## Future Enhancements

Potential additions:
- Click column headers to sort
- Filter rows by column values
- Copy cell contents to clipboard
- Export table to CSV
- Highlight specific data types (null, empty, errors)
- Column resize handles
- Column hide/show toggles
