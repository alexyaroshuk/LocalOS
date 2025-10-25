/**
 * Mock Memory Service for testing
 * Provides fake data to test UI and functionality before implementing real services
 */

import {Memory, MemoryMetadata, SearchResult, VaultStats} from '../types/memory';
import {generateId} from '../utils/helpers';

export class MockMemoryService {
  private static memories: Memory[] = [];
  private static initialized: boolean = false;

  /**
   * Initialize with fake data
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    this.memories = this.generateFakeMemories();
    this.initialized = true;
    console.log(`MockMemoryService initialized with ${this.memories.length} fake memories`);
  }

  /**
   * Generate fake memories for testing
   */
  private static generateFakeMemories(): Memory[] {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    return [
      {
        id: generateId(),
        title: 'React Native Best Practices',
        content: `# React Native Best Practices

Key principles to follow when building React Native apps:

1. **Performance Optimization**
   - Use FlatList for long lists
   - Avoid inline functions in render
   - Memoize expensive calculations
   - Use native drivers for animations

2. **State Management**
   - Keep component state minimal
   - Use Context for global state
   - Consider Redux for complex apps

3. **Code Organization**
   - Separate business logic from UI
   - Use custom hooks for reusable logic
   - Keep components focused and small`,
        filePath: 'Development/React Native Best Practices.md',
        tags: ['react-native', 'development', 'best-practices'],
        metadata: {
          category: 'Development',
          importance: 'high',
        },
        createdAt: now - 7 * dayInMs,
        updatedAt: now - 2 * dayInMs,
      },
      {
        id: generateId(),
        title: 'LocalOS Project Notes',
        content: `# LocalOS Project

Building a privacy-first AI chat app that runs entirely on-device.

## Current Features
- Local LLM inference using llama.rn
- Function calling with tools (datetime, web search)
- Streaming responses
- Model management

## Planned Features
- Memory system with vector search
- Obsidian integration for knowledge base
- Multi-modal support (images, audio)
- Graph view of linked memories

## Technical Stack
- React Native 0.82
- llama.rn for inference
- Transformers.js for embeddings
- SQLite for vector storage`,
        filePath: 'Projects/LocalOS.md',
        tags: ['project', 'ai', 'react-native', 'localos'],
        metadata: {
          status: 'in-progress',
          priority: 'high',
        },
        createdAt: now - 14 * dayInMs,
        updatedAt: now - 1 * dayInMs,
      },
      {
        id: generateId(),
        title: 'Vector Search Overview',
        content: `# Vector Search

Vector search (also called semantic search) finds similar items based on meaning rather than exact keyword matches.

## How It Works
1. Convert text to embeddings (dense vectors)
2. Store vectors in a database
3. Compare query vector to stored vectors using similarity metrics
4. Return most similar results

## Similarity Metrics
- **Cosine Similarity**: Measures angle between vectors (most common)
- **Euclidean Distance**: Measures straight-line distance
- **Dot Product**: Measures alignment

## Use Cases
- Semantic search in documents
- Recommendation systems
- Duplicate detection
- Question answering`,
        filePath: 'Learning/Vector Search.md',
        tags: ['ai', 'embeddings', 'search', 'learning'],
        metadata: {
          source: 'research',
        },
        createdAt: now - 10 * dayInMs,
        updatedAt: now - 5 * dayInMs,
      },
      {
        id: generateId(),
        title: 'Obsidian Workflow',
        content: `# My Obsidian Workflow

How I use Obsidian for personal knowledge management:

## Daily Notes
- Morning planning and goals
- Meeting notes throughout the day
- Evening reflection

## Project Notes
- One note per active project
- Link to related resources
- Track progress and next steps

## Permanent Notes
- Evergreen content that doesn't change
- Well-organized with tags
- Heavily linked to other notes

## Tags I Use
#fleeting - Quick captures
#permanent - Polished notes
#project - Active projects
#learning - Things I'm studying`,
        filePath: 'Meta/Obsidian Workflow.md',
        tags: ['obsidian', 'productivity', 'workflow'],
        metadata: {
          type: 'meta',
        },
        createdAt: now - 20 * dayInMs,
        updatedAt: now - 15 * dayInMs,
      },
      {
        id: generateId(),
        title: 'TypeScript Tips',
        content: `# TypeScript Tips

Useful TypeScript patterns and tricks:

## Type Guards
\`\`\`typescript
function isString(value: unknown): value is string {
  return typeof value === 'string';
}
\`\`\`

## Utility Types
- \`Partial<T>\`: Make all properties optional
- \`Required<T>\`: Make all properties required
- \`Pick<T, K>\`: Select specific properties
- \`Omit<T, K>\`: Exclude specific properties

## Generic Constraints
\`\`\`typescript
function getValue<T extends { id: string }>(obj: T): string {
  return obj.id;
}
\`\`\``,
        filePath: 'Development/TypeScript Tips.md',
        tags: ['typescript', 'development', 'programming'],
        metadata: {},
        createdAt: now - 5 * dayInMs,
        updatedAt: now - 3 * dayInMs,
      },
      {
        id: generateId(),
        title: 'Meeting: Q1 Planning',
        content: `# Q1 Planning Meeting - 2025

**Date:** January 10, 2025
**Attendees:** Team

## Key Decisions
1. Focus on memory system implementation
2. Launch beta by end of Q1
3. Weekly sprint cycles

## Action Items
- [ ] Complete Phase A (Vector DB) by Jan 20
- [ ] Design UI mockups by Jan 15
- [ ] Set up CI/CD pipeline

## Notes
Team is excited about the Obsidian integration feature. Users will love having their chat history searchable.`,
        filePath: 'Meetings/2025-Q1-Planning.md',
        tags: ['meeting', 'planning', 'q1'],
        metadata: {
          type: 'meeting',
          date: '2025-01-10',
        },
        createdAt: now - 15 * dayInMs,
        updatedAt: now - 15 * dayInMs,
      },
      {
        id: generateId(),
        title: 'AI Model Selection Guide',
        content: `# Choosing the Right AI Model

## For Mobile Devices
- **1B-3B parameters**: Best for on-device inference
- **Quantization**: Q4_K_M offers good balance
- **Context length**: 2048-4096 tokens typical

## Popular Models for LocalOS
1. **Llama 3.2 1B** - Fast, good for chat
2. **Qwen 2.5 1B** - Excellent reasoning
3. **Phi-3 Mini** - Microsoft's efficient model

## Considerations
- Model size vs available RAM
- Inference speed requirements
- Task specialization (chat, coding, function calling)`,
        filePath: 'Learning/AI Models.md',
        tags: ['ai', 'llm', 'models', 'learning'],
        metadata: {
          importance: 'high',
        },
        createdAt: now - 12 * dayInMs,
        updatedAt: now - 8 * dayInMs,
      },
      {
        id: generateId(),
        title: 'Personal Preferences',
        content: `# My Preferences

## Development
- Prefer React Native over Flutter for mobile
- TypeScript > JavaScript always
- Functional programming style
- TDD when possible

## Tools
- Editor: VS Code
- Terminal: iTerm2
- Version control: Git + GitHub
- Notes: Obsidian

## Learning Style
- Learn by building projects
- Reference documentation frequently
- Take notes in markdown
- Review notes weekly`,
        filePath: 'Personal/Preferences.md',
        tags: ['personal', 'preferences'],
        metadata: {
          private: true,
        },
        createdAt: now - 30 * dayInMs,
        updatedAt: now - 4 * dayInMs,
      },
      {
        id: generateId(),
        title: 'SQLite on Mobile',
        content: `# Using SQLite in React Native

## Libraries
- **@op-engineering/op-sqlite**: Fastest, JSI-based
- **react-native-sqlite-storage**: Older, stable
- **expo-sqlite**: For Expo apps

## Best Practices
1. Use transactions for multiple writes
2. Create indexes on frequently queried columns
3. Avoid storing large blobs
4. Use prepared statements

## Schema Migration
Always version your schema and handle migrations gracefully:

\`\`\`typescript
const SCHEMA_VERSION = 2;

async function migrate(db, currentVersion) {
  if (currentVersion < 2) {
    await db.execute('ALTER TABLE...');
  }
}
\`\`\``,
        filePath: 'Development/SQLite Mobile.md',
        tags: ['sqlite', 'react-native', 'database', 'development'],
        metadata: {},
        createdAt: now - 8 * dayInMs,
        updatedAt: now - 6 * dayInMs,
      },
      {
        id: generateId(),
        title: 'Reading List',
        content: `# Reading List

## Currently Reading
- "Designing Data-Intensive Applications" by Martin Kleppmann
- "The Pragmatic Programmer" (re-reading)

## Want to Read
- [ ] "Building Mobile Apps at Scale"
- [ ] "Staff Engineer" by Will Larson
- [ ] "A Philosophy of Software Design"

## Completed
- ✅ "Clean Code" by Robert Martin
- ✅ "React Native in Action"
- ✅ "Hands-On Machine Learning"`,
        filePath: 'Personal/Reading List.md',
        tags: ['books', 'learning', 'reading'],
        metadata: {},
        createdAt: now - 25 * dayInMs,
        updatedAt: now - 7 * dayInMs,
      },
    ];
  }

  /**
   * Search memories semantically (mock implementation)
   */
  static async searchSemantic(
    query: string,
    limit: number = 5,
  ): Promise<SearchResult[]> {
    // Simulate delay
    await new Promise<void>(resolve => setTimeout(resolve, 300));

    // Simple mock: filter by keyword match and assign random similarity scores
    const lowerQuery = query.toLowerCase();
    const results = this.memories
      .filter(
        m =>
          m.content.toLowerCase().includes(lowerQuery) ||
          m.title?.toLowerCase().includes(lowerQuery) ||
          m.tags.some(t => t.toLowerCase().includes(lowerQuery)),
      )
      .slice(0, limit)
      .map(memory => ({
        memory,
        similarity: 0.7 + Math.random() * 0.3, // Mock similarity 0.7-1.0
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return results;
  }

  /**
   * Search by keyword
   */
  static async searchKeyword(query: string): Promise<Memory[]> {
    await new Promise<void>(resolve => setTimeout(resolve, 200));

    const lowerQuery = query.toLowerCase();
    return this.memories.filter(
      m =>
        m.content.toLowerCase().includes(lowerQuery) ||
        m.title?.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * Save a new memory
   */
  static async saveMemory(
    content: string,
    metadata?: MemoryMetadata,
  ): Promise<Memory> {
    await new Promise<void>(resolve => setTimeout(resolve, 100));

    const now = Date.now();
    const memory: Memory = {
      id: generateId(),
      content,
      title: metadata?.title || 'Untitled',
      filePath: metadata?.folder
        ? `${metadata.folder}/${metadata.title || 'Untitled'}.md`
        : `${metadata?.title || 'Untitled'}.md`,
      tags: metadata?.tags || [],
      metadata: metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    this.memories.unshift(memory);
    console.log('Memory saved:', memory.title);
    return memory;
  }

  /**
   * Update existing memory
   */
  static async updateMemory(id: string, content: string): Promise<Memory> {
    await new Promise<void>(resolve => setTimeout(resolve, 100));

    const index = this.memories.findIndex(m => m.id === id);
    if (index === -1) {
      throw new Error(`Memory not found: ${id}`);
    }

    this.memories[index] = {
      ...this.memories[index],
      content,
      updatedAt: Date.now(),
    };

    console.log('Memory updated:', this.memories[index].title);
    return this.memories[index];
  }

  /**
   * Delete memory
   */
  static async deleteMemory(id: string): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, 100));

    const index = this.memories.findIndex(m => m.id === id);
    if (index === -1) {
      throw new Error(`Memory not found: ${id}`);
    }

    this.memories.splice(index, 1);
    console.log('Memory deleted:', id);
  }

  /**
   * Get memory by ID
   */
  static async getMemory(id: string): Promise<Memory | null> {
    await new Promise<void>(resolve => setTimeout(resolve, 50));
    return this.memories.find(m => m.id === id) || null;
  }

  /**
   * Get recent memories
   */
  static async getRecentMemories(limit: number = 10): Promise<Memory[]> {
    await new Promise<void>(resolve => setTimeout(resolve, 100));

    return [...this.memories]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  /**
   * Get all memories
   */
  static async getAllMemories(): Promise<Memory[]> {
    await new Promise<void>(resolve => setTimeout(resolve, 50));
    return [...this.memories];
  }

  /**
   * Get memories by tag
   */
  static async getMemoriesByTag(tag: string): Promise<Memory[]> {
    await new Promise<void>(resolve => setTimeout(resolve, 100));

    return this.memories.filter(m =>
      m.tags.some(t => t.toLowerCase() === tag.toLowerCase()),
    );
  }

  /**
   * Get all unique tags
   */
  static async getAllTags(): Promise<string[]> {
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    const tagSet = new Set<string>();
    this.memories.forEach(m => {
      m.tags.forEach(tag => tagSet.add(tag));
    });

    return Array.from(tagSet).sort();
  }

  /**
   * Get vault statistics
   */
  static async getVaultStats(): Promise<VaultStats> {
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    const tags = await this.getAllTags();

    return {
      totalNotes: this.memories.length,
      totalMemories: this.memories.length,
      totalTags: tags.length,
      vaultPath: '/mock/vault/path',
      lastIndexed: Date.now() - 60000, // 1 minute ago
    };
  }

  /**
   * Get relevant context for a query (for LLM)
   */
  static async getRelevantContext(
    query: string,
    maxTokens: number = 2000,
  ): Promise<string> {
    const results = await this.searchSemantic(query, 3);

    if (results.length === 0) {
      return '';
    }

    let context = 'Relevant memories:\n\n';
    let tokenCount = 0;

    for (const result of results) {
      const memoryText = `## ${result.memory.title}\n${result.memory.content}\n\n`;
      const estimatedTokens = Math.ceil(memoryText.length / 4);

      if (tokenCount + estimatedTokens > maxTokens) {
        break;
      }

      context += memoryText;
      tokenCount += estimatedTokens;
    }

    return context;
  }
}
