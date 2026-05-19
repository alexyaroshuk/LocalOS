import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Core Memory Blocks that live in-context (system prompt)
 */
export interface CoreMemoryBlocks {
  user_profile: string;
  conversation_style: string;
  current_focus: string;
  relationship_context: string;
}

/**
 * Default core memory when user first starts
 */
const DEFAULT_CORE_MEMORY: CoreMemoryBlocks = {
  user_profile: 'New user — learning their preferences.',
  conversation_style: 'Cool, efficient agent. Zero formal bullshit. Straight to the point. One short sentence default. Lowercase fine. No "I apologize / I\'m happy to / Based on the information / It seems that".',
  current_focus: 'Getting to know the user.',
  relationship_context: 'No context yet.',
};

const CORE_MEMORY_STORAGE_KEY = '@localOS:core_memory';

/**
 * MemoryService manages core memory blocks that are loaded into every conversation.
 * This is the "working memory" that the AI always has access to.
 */
class MemoryService {
  private coreMemory: CoreMemoryBlocks | null = null;

  /**
   * Initialize the memory service and load core memory
   */
  async initialize(): Promise<void> {
    await this.loadCoreMemory();
  }

  /**
   * Load core memory from persistent storage
   */
  private async loadCoreMemory(): Promise<CoreMemoryBlocks> {
    try {
      const stored = await AsyncStorage.getItem(CORE_MEMORY_STORAGE_KEY);
      if (stored) {
        this.coreMemory = JSON.parse(stored);
        console.log('[MemoryService] Core memory loaded from storage');
      } else {
        this.coreMemory = DEFAULT_CORE_MEMORY;
        await this.saveCoreMemory();
        console.log('[MemoryService] Initialized with default core memory');
      }
      return this.coreMemory as CoreMemoryBlocks;
    } catch (error) {
      console.error('[MemoryService] Failed to load core memory:', error);
      this.coreMemory = DEFAULT_CORE_MEMORY;
      return this.coreMemory as CoreMemoryBlocks;
    }
  }

  /**
   * Save core memory to persistent storage
   */
  private async saveCoreMemory(): Promise<void> {
    if (!this.coreMemory) return;

    try {
      await AsyncStorage.setItem(
        CORE_MEMORY_STORAGE_KEY,
        JSON.stringify(this.coreMemory)
      );
      console.log('[MemoryService] Core memory saved to storage');
    } catch (error) {
      console.error('[MemoryService] Failed to save core memory:', error);
    }
  }

  /**
   * Get current core memory blocks
   */
  getCoreMemory(): CoreMemoryBlocks {
    if (!this.coreMemory) {
      return DEFAULT_CORE_MEMORY;
    }
    return this.coreMemory;
  }

  /**
   * Update a specific core memory block
   * @param blockName The name of the block to update
   * @param content The new content for the block
   */
  async updateCoreMemoryBlock(
    blockName: keyof CoreMemoryBlocks,
    content: string
  ): Promise<void> {
    if (!this.coreMemory) {
      throw new Error('MemoryService not initialized');
    }

    this.coreMemory[blockName] = content;
    await this.saveCoreMemory();
    console.log(`[MemoryService] Updated core memory block: ${blockName}`);
  }

  /**
   * Get the formatted core memory as a string for inclusion in the system prompt
   */
  getFormattedCoreMemory(): string {
    const memory = this.getCoreMemory();

    return `
# CORE MEMORY

## User Profile
${memory.user_profile}

## Conversation Style
${memory.conversation_style}

## Current Focus
${memory.current_focus}

## Relationship Context
${memory.relationship_context}

---
You can update these memory blocks using the update_core_memory tool when you learn new information about the user.
`.trim();
  }

  /**
   * Reset core memory to defaults (useful for testing)
   */
  async resetCoreMemory(): Promise<void> {
    this.coreMemory = DEFAULT_CORE_MEMORY;
    await this.saveCoreMemory();
    console.log('[MemoryService] Core memory reset to defaults');
  }
}

export default new MemoryService();
