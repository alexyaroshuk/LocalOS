# Sample Vault - LocalOS Test Data

This is a comprehensive sample vault for testing the LocalOS app's vault integration features. It mimics a real person's knowledge base with multi-layered directory structure and realistic content.

## Vault Structure

```
sample-vault/
├── Personal/
│   ├── Journal/
│   │   ├── 2024/                    # Daily reflections, thoughts
│   │   └── 2023/
│   ├── Health/                       # Fitness, meditation, wellness
│   ├── Hobbies/
│   │   ├── Photography/              # Camera gear, favorite shots
│   │   └── Cooking/                  # Recipes, restaurants
│   └── Contacts/                     # Professional network, friends
│
├── Work/
│   ├── Career/                       # Goals, skills, planning
│   ├── Jobs/
│   │   ├── Current-TechCorp/         # Active projects, team notes
│   │   └── Past/
│   │       └── Asia-Remote-2021/     # Digital nomad experience
│   ├── Projects/
│   │   └── LocalOS/                  # Architecture, features, bugs
│   └── Learning/                     # Tutorials, courses, notes
│
├── Travel/
│   ├── Asia/
│   │   ├── Japan/                    # Tokyo trip notes
│   │   ├── Thailand/                 # Bangkok food guide
│   │   └── Vietnam/                  # Future trip planning
│   ├── Europe/
│   │   ├── France/                   # Paris 2022
│   │   └── Italy/                    # Rome, Florence
│   └── Bucket List.md               # Dream destinations
│
├── Media/
│   ├── Books/
│   │   ├── Book-Notes/              # Detailed book summaries
│   │   ├── Favorites.md             # Top books, ratings
│   │   ├── Currently Reading.md
│   │   └── To Read.md
│   ├── Movies/                       # Film ratings, watchlist
│   ├── TV-Shows/                     # Series tracking
│   └── Podcasts/                     # Subscriptions
│
├── Knowledge/
│   ├── Quotes.md                    # Favorite quotes
│   ├── Ideas.md
│   └── Resources/                    # Tools, websites
│
└── README.md                        # This file
```

## Features Demonstrated

### Multi-Level Directories
- **3-4 levels deep** in many areas (e.g., `Work/Jobs/Past/Asia-Remote-2021/`)
- **Realistic nesting** - personal/jobs/asia as requested
- Mix of shallow and deep hierarchies

### Rich Content
- **Frontmatter tags** - All files have YAML frontmatter
- **Internal links** - Cross-references between notes
- **Lists and checklists** - To-dos, goals, ratings
- **Metadata** - Dates, ratings, statuses
- **Formatted text** - Code blocks, quotes, tables

### Realistic Data
- **Personal journal entries** - Thoughts, reflections, goals
- **Travel documentation** - Trip notes, food guides, bucket lists
- **Work projects** - Career planning, remote work experience
- **Media tracking** - Books, movies with ratings and notes
- **Knowledge base** - Quotes, ideas, resources

### Test Scenarios

#### Vault Tool Testing
1. **list_vault_structure** - Should show multi-level folder hierarchy
2. **list_vault_files** - Filter by folder (e.g., "Travel/Asia/Japan")
3. **read_vault_file** - Read specific notes with frontmatter
4. **search_vault** - Find files by name or content keywords

#### Sample Queries
- "What folders are in my vault?"
- "List files in the Travel folder"
- "Read my Tokyo travel notes"
- "Search for anything about photography"
- "Show me my book notes"
- "What's in my Work/Jobs folder?"

## Content Highlights

### Personal
- **Journal**: Dated entries with mood tracking, reflections
- **Health**: Fitness routines, meditation practice
- **Hobbies**: Photography gear, cooking recipes
- **Contacts**: Professional network with context

### Work
- **Career Goals**: Technical skills, leadership, progression
- **Current Job**: TechCorp projects, React Native migration
- **Past Jobs**: Asia remote work experience (2021)
- **Projects**: LocalOS feature ideas, architecture notes

### Travel
- **Asia**: Tokyo 2023 trip, Bangkok food guide
- **Europe**: Paris and Italy experiences
- **Planning**: Vietnam 2025, bucket list destinations

### Media
- **Books**: Favorites with ratings, detailed notes on "Atomic Habits"
- **Movies**: Top 20 all-time favorites by genre
- **Tracking**: Currently reading/watching, wishlists

### Knowledge
- **Quotes**: Categorized by theme (productivity, tech, life)
- **Resources**: Tools, learning materials

## Usage in LocalOS

### Testing Vault Integration
1. Import this vault in LocalOS settings
2. Test vault tools in ToolTestScreen
3. Ask the AI assistant about vault contents
4. Verify multi-level folder navigation works

### Example Conversations
```
User: "What folders are in my vault?"
AI: [Uses list_vault_structure tool]

User: "Tell me about my Japan trip"
AI: [Uses search_vault or read_vault_file for Tokyo 2023.md]

User: "What books have I read?"
AI: [Reads Media/Books/Favorites.md]

User: "Show me my work on LocalOS"
AI: [Navigates to Work/Projects/LocalOS/]
```

## File Characteristics

- **Format**: All files are Markdown (.md)
- **Frontmatter**: YAML metadata with tags, dates, ratings
- **Links**: Internal links using [[WikiLink]] syntax
- **Content**: Mix of lists, paragraphs, code blocks, quotes
- **Length**: Varies from brief notes to detailed articles

---

**Version**: 2.0 - Comprehensive Sample Vault
**Last Updated**: October 2024
**Purpose**: Testing LocalOS vault integration and tool calling
