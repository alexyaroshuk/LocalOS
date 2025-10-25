/**
 * Mock Database Service for testing the new memory architecture
 * Simulates SQLite operations without actual database
 */

import {generateId} from '../utils/helpers';

// Database types based on newplan.md schema

export interface CoreMemoryBlock {
  id: number;
  block_name: 'user_profile' | 'conversation_style' | 'current_focus' | 'relationship_context';
  content: string;
  last_updated: number;
}

export interface ArchiveMemory {
  id: number;
  content: string;
  category: 'fact' | 'event' | 'preference' | 'conversation';
  importance: number; // 1-10
  created_at: number;
  metadata: string; // JSON string
}

export interface Task {
  id: number;
  title: string;
  description: string;
  due_date: number | null;
  recurrence_rule: string | null; // 'daily', 'weekly', 'monthly', or cron-style
  status: 'pending' | 'completed' | 'cancelled';
  created_at: number;
  completed_at: number | null;
}

export interface ConversationSummary {
  id: number;
  summary: string;
  key_points: string; // JSON array
  date: number;
  message_count: number;
}

export interface UserFact {
  id: number;
  category: 'preference' | 'habit' | 'personality' | 'relationship';
  fact: string;
  confidence: number; // 0.0-1.0
  source_conversation_id: number | null;
  last_confirmed: number;
}

/**
 * Mock Database Service
 */
export class MockDatabaseService {
  private static coreMemory: CoreMemoryBlock[] = [];
  private static archiveMemories: ArchiveMemory[] = [];
  private static tasks: Task[] = [];
  private static conversations: ConversationSummary[] = [];
  private static userFacts: UserFact[] = [];
  private static initialized: boolean = false;
  private static nextId: number = 1;

  /**
   * Initialize with fake data
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[MockDB] Initializing database...');

    // Initialize core memory blocks (these will be loaded by MemoryService)
    this.coreMemory = [
      {
        id: this.nextId++,
        block_name: 'user_profile',
        content: 'User is a software developer working on LocalOS. Interested in AI and privacy-focused apps.',
        last_updated: Date.now(),
      },
      {
        id: this.nextId++,
        block_name: 'conversation_style',
        content: 'Prefers concise, technical responses. Appreciates code examples and practical guidance.',
        last_updated: Date.now(),
      },
      {
        id: this.nextId++,
        block_name: 'current_focus',
        content: 'Currently implementing memory system with task management. Working on Phase A.',
        last_updated: Date.now(),
      },
      {
        id: this.nextId++,
        block_name: 'relationship_context',
        content: 'Working solo on LocalOS project. Active in React Native community.',
        last_updated: Date.now(),
      },
    ];

    // Initialize archive memories
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    this.archiveMemories = [
      {
        id: this.nextId++,
        content: 'User prefers TypeScript over JavaScript for all projects',
        category: 'preference',
        importance: 8,
        created_at: now - 10 * dayInMs,
        metadata: JSON.stringify({tags: ['development', 'languages'], confidence: 0.9}),
      },
      {
        id: this.nextId++,
        content: 'User mentioned they work best in the mornings',
        category: 'preference',
        importance: 6,
        created_at: now - 5 * dayInMs,
        metadata: JSON.stringify({tags: ['productivity', 'schedule']}),
      },
      {
        id: this.nextId++,
        content: 'Started working on LocalOS project two weeks ago',
        category: 'event',
        importance: 7,
        created_at: now - 14 * dayInMs,
        metadata: JSON.stringify({tags: ['project', 'milestone']}),
      },
      {
        id: this.nextId++,
        content: 'User discussed implementing Letta-style memory architecture',
        category: 'conversation',
        importance: 9,
        created_at: now - 1 * dayInMs,
        metadata: JSON.stringify({tags: ['memory', 'architecture', 'planning']}),
      },
    ];

    // Initialize tasks
    this.tasks = [
      {
        id: this.nextId++,
        title: 'Complete Phase A: Core Memory System',
        description: 'Implement MemoryService with core memory blocks management',
        due_date: now + 2 * dayInMs,
        recurrence_rule: null,
        status: 'pending',
        created_at: now - 1 * dayInMs,
        completed_at: null,
      },
      {
        id: this.nextId++,
        title: 'Daily standup notes',
        description: 'Write down progress and blockers',
        due_date: now,
        recurrence_rule: 'daily',
        status: 'pending',
        created_at: now - 7 * dayInMs,
        completed_at: null,
      },
      {
        id: this.nextId++,
        title: 'Review newplan.md',
        description: 'Go through implementation plan and refine if needed',
        due_date: now - 1 * dayInMs,
        recurrence_rule: null,
        status: 'completed',
        created_at: now - 2 * dayInMs,
        completed_at: now - 1 * dayInMs,
      },
      {
        id: this.nextId++,
        title: 'Weekly code review',
        description: 'Review all code changes from the week',
        due_date: now + 4 * dayInMs,
        recurrence_rule: 'weekly',
        status: 'pending',
        created_at: now - 7 * dayInMs,
        completed_at: null,
      },
    ];

    // Initialize conversation summaries
    this.conversations = [
      {
        id: this.nextId++,
        summary: 'Discussed implementation plan for memory system. Decided on Letta-style architecture.',
        key_points: JSON.stringify([
          'Core memory: in-context, always loaded',
          'Archive memory: on-demand from SQLite',
          'Task management with recurring tasks',
          'User fact tracking with confidence scores',
        ]),
        date: now - 1 * dayInMs,
        message_count: 15,
      },
      {
        id: this.nextId++,
        summary: 'Explored different approaches for vector search. Decided to start with keyword search.',
        key_points: JSON.stringify([
          'Vector embeddings can be added later',
          'SQLite FTS5 for keyword search initially',
          'Keep it simple for mobile performance',
        ]),
        date: now - 3 * dayInMs,
        message_count: 8,
      },
    ];

    // Initialize user facts
    this.userFacts = [
      {
        id: this.nextId++,
        category: 'preference',
        fact: 'Prefers React Native for mobile development',
        confidence: 0.95,
        source_conversation_id: 1,
        last_confirmed: now - 5 * dayInMs,
      },
      {
        id: this.nextId++,
        category: 'habit',
        fact: 'Codes primarily in the morning hours',
        confidence: 0.75,
        source_conversation_id: 2,
        last_confirmed: now - 5 * dayInMs,
      },
      {
        id: this.nextId++,
        category: 'personality',
        fact: 'Direct communicator who values clarity',
        confidence: 0.85,
        source_conversation_id: 1,
        last_confirmed: now - 1 * dayInMs,
      },
      {
        id: this.nextId++,
        category: 'relationship',
        fact: 'Solo developer on LocalOS, no team members',
        confidence: 0.9,
        source_conversation_id: 1,
        last_confirmed: now - 14 * dayInMs,
      },
    ];

    this.initialized = true;
    console.log('[MockDB] Database initialized with mock data');
    console.log(`  - Core memory blocks: ${this.coreMemory.length}`);
    console.log(`  - Archive memories: ${this.archiveMemories.length}`);
    console.log(`  - Tasks: ${this.tasks.length}`);
    console.log(`  - Conversations: ${this.conversations.length}`);
    console.log(`  - User facts: ${this.userFacts.length}`);
  }

  // ============== CORE MEMORY OPERATIONS ==============

  static async getCoreMemory(): Promise<CoreMemoryBlock[]> {
    return [...this.coreMemory];
  }

  static async getCoreMemoryBlock(blockName: string): Promise<CoreMemoryBlock | null> {
    return this.coreMemory.find(b => b.block_name === blockName) || null;
  }

  static async updateCoreMemoryBlock(blockName: string, content: string): Promise<void> {
    const block = this.coreMemory.find(b => b.block_name === blockName);
    if (block) {
      block.content = content;
      block.last_updated = Date.now();
      console.log(`[MockDB] Updated core memory block: ${blockName}`);
    }
  }

  // ============== ARCHIVE MEMORY OPERATIONS ==============

  static async saveMemory(
    content: string,
    category: ArchiveMemory['category'],
    importance: number,
    metadata?: Record<string, any>
  ): Promise<ArchiveMemory> {
    const memory: ArchiveMemory = {
      id: this.nextId++,
      content,
      category,
      importance,
      created_at: Date.now(),
      metadata: JSON.stringify(metadata || {}),
    };
    this.archiveMemories.push(memory);
    console.log(`[MockDB] Saved archive memory: ${content.substring(0, 50)}...`);
    return memory;
  }

  static async searchArchive(query: string, limit: number = 5): Promise<ArchiveMemory[]> {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simple keyword search
    const lowerQuery = query.toLowerCase();
    return this.archiveMemories
      .filter(m => m.content.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  static async getRecentMemories(limit: number = 10): Promise<ArchiveMemory[]> {
    return [...this.archiveMemories]
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit);
  }

  static async getMemoriesByCategory(category: ArchiveMemory['category']): Promise<ArchiveMemory[]> {
    return this.archiveMemories.filter(m => m.category === category);
  }

  // ============== TASK OPERATIONS ==============

  static async createTask(
    title: string,
    description: string,
    dueDate: number | null,
    recurrenceRule: string | null
  ): Promise<Task> {
    const task: Task = {
      id: this.nextId++,
      title,
      description,
      due_date: dueDate,
      recurrence_rule: recurrenceRule,
      status: 'pending',
      created_at: Date.now(),
      completed_at: null,
    };
    this.tasks.push(task);
    console.log(`[MockDB] Created task: ${title}`);
    return task;
  }

  static async updateTask(id: number, updates: Partial<Task>): Promise<Task | null> {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return null;

    Object.assign(task, updates);
    console.log(`[MockDB] Updated task: ${task.title}`);
    return task;
  }

  static async completeTask(id: number): Promise<Task | null> {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return null;

    task.status = 'completed';
    task.completed_at = Date.now();
    console.log(`[MockDB] Completed task: ${task.title}`);
    return task;
  }

  static async getTasks(status?: Task['status']): Promise<Task[]> {
    if (status) {
      return this.tasks.filter(t => t.status === status);
    }
    return [...this.tasks];
  }

  static async getTasksDueToday(): Promise<Task[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    return this.tasks.filter(
      t => t.status === 'pending' && t.due_date && t.due_date >= startOfDay && t.due_date < endOfDay
    );
  }

  static async getOverdueTasks(): Promise<Task[]> {
    const now = Date.now();
    return this.tasks.filter(t => t.status === 'pending' && t.due_date && t.due_date < now);
  }

  static async getUpcomingTasks(days: number = 7): Promise<Task[]> {
    const now = Date.now();
    const futureDate = now + days * 24 * 60 * 60 * 1000;

    return this.tasks.filter(
      t => t.status === 'pending' && t.due_date && t.due_date >= now && t.due_date <= futureDate
    );
  }

  // ============== CONVERSATION OPERATIONS ==============

  static async saveConversation(
    summary: string,
    keyPoints: string[],
    messageCount: number
  ): Promise<ConversationSummary> {
    const conversation: ConversationSummary = {
      id: this.nextId++,
      summary,
      key_points: JSON.stringify(keyPoints),
      date: Date.now(),
      message_count: messageCount,
    };
    this.conversations.push(conversation);
    console.log(`[MockDB] Saved conversation summary`);
    return conversation;
  }

  static async getRecentConversations(limit: number = 10): Promise<ConversationSummary[]> {
    return [...this.conversations]
      .sort((a, b) => b.date - a.date)
      .slice(0, limit);
  }

  // ============== USER FACTS OPERATIONS ==============

  static async saveUserFact(
    category: UserFact['category'],
    fact: string,
    confidence: number,
    sourceConversationId?: number
  ): Promise<UserFact> {
    const userFact: UserFact = {
      id: this.nextId++,
      category,
      fact,
      confidence,
      source_conversation_id: sourceConversationId || null,
      last_confirmed: Date.now(),
    };
    this.userFacts.push(userFact);
    console.log(`[MockDB] Saved user fact: ${fact.substring(0, 50)}...`);
    return userFact;
  }

  static async getUserFactsByCategory(category: UserFact['category']): Promise<UserFact[]> {
    return this.userFacts
      .filter(f => f.category === category)
      .sort((a, b) => b.confidence - a.confidence);
  }

  static async getAllUserFacts(): Promise<UserFact[]> {
    return [...this.userFacts].sort((a, b) => b.confidence - a.confidence);
  }

  static async updateUserFactConfidence(id: number, confidence: number): Promise<UserFact | null> {
    const fact = this.userFacts.find(f => f.id === id);
    if (!fact) return null;

    fact.confidence = confidence;
    fact.last_confirmed = Date.now();
    console.log(`[MockDB] Updated user fact confidence: ${fact.fact.substring(0, 50)}...`);
    return fact;
  }

  // ============== UTILITY ==============

  static async clear(): Promise<void> {
    this.coreMemory = [];
    this.archiveMemories = [];
    this.tasks = [];
    this.conversations = [];
    this.userFacts = [];
    this.nextId = 1;
    this.initialized = false;
    console.log('[MockDB] Database cleared');
  }

  static async getStats() {
    return {
      coreMemoryBlocks: this.coreMemory.length,
      archiveMemories: this.archiveMemories.length,
      tasks: this.tasks.length,
      conversations: this.conversations.length,
      userFacts: this.userFacts.length,
    };
  }
}
