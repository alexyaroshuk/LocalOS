/**
 * Mock Memory Tools for LLM Function Calling
 * Integrates MockMemoryService with ToolService
 */

import {Tool} from '../types';
import {MockMemoryService} from './MockMemoryService';

export class MockMemoryTools {
  /**
   * Register all mock memory tools with ToolService
   */
  static registerTools(): Tool[] {
    return [
      this.getSearchMemoryTool(),
      this.getSaveMemoryTool(),
      this.getUpdateMemoryTool(),
      this.getRecentMemoriesTool(),
    ];
  }

  /**
   * Tool: search_memory
   */
  private static getSearchMemoryTool(): Tool {
    return {
      name: 'search_memory',
      description:
        'Search through stored memories and knowledge using semantic search. Use this when you need to recall information, find related notes, or retrieve context about previous conversations or saved information.',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'The search query to find relevant memories',
          required: true,
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const query = args.query as string;
          const limit = (args.limit as number) || 5;

          console.log(`[SEARCH_MEMORY] Query: "${query}", Limit: ${limit}`);

          const results = await MockMemoryService.searchSemantic(query, limit);

          if (results.length === 0) {
            return {
              success: true,
              message: `No memories found for "${query}"`,
              count: 0,
              results: [],
            };
          }

          return {
            success: true,
            count: results.length,
            results: results.map(r => ({
              title: r.memory.title,
              content: r.memory.content.substring(0, 500) + '...',
              similarity: r.similarity.toFixed(2),
              tags: r.memory.tags,
              filePath: r.memory.filePath,
            })),
          };
        } catch (error) {
          console.error('search_memory error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Search failed',
          };
        }
      },
    };
  }

  /**
   * Tool: save_memory
   */
  private static getSaveMemoryTool(): Tool {
    return {
      name: 'save_memory',
      description:
        'Save new information or create a new note in the knowledge base. Use this when the user shares important information that should be remembered for future conversations.',
      parameters: [
        {
          name: 'content',
          type: 'string',
          description: 'The content to save as a memory',
          required: true,
        },
        {
          name: 'title',
          type: 'string',
          description: 'Title for the memory/note',
          required: false,
        },
        {
          name: 'tags',
          type: 'string',
          description:
            'Comma-separated tags (e.g., "important,ai,research")',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const content = args.content as string;
          const title = (args.title as string) || 'Untitled';
          const tagsString = (args.tags as string) || '';
          const tags = tagsString
            ? tagsString.split(',').map(t => t.trim())
            : [];

          console.log(`[SAVE_MEMORY] Title: "${title}", Tags: ${tags.join(', ')}`);

          const memory = await MockMemoryService.saveMemory(content, {
            title,
            tags,
          });

          return {
            success: true,
            message: `Memory saved: "${memory.title}"`,
            id: memory.id,
            filePath: memory.filePath,
          };
        } catch (error) {
          console.error('save_memory error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Save failed',
          };
        }
      },
    };
  }

  /**
   * Tool: update_memory
   */
  private static getUpdateMemoryTool(): Tool {
    return {
      name: 'update_memory',
      description:
        'Update an existing memory or note with new information. Use this to modify or add to previously saved memories.',
      parameters: [
        {
          name: 'memory_id',
          type: 'string',
          description: 'ID of the memory to update',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: 'New content for the memory',
          required: true,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const memoryId = args.memory_id as string;
          const content = args.content as string;

          console.log(`[UPDATE_MEMORY] ID: ${memoryId}`);

          const memory = await MockMemoryService.updateMemory(
            memoryId,
            content,
          );

          return {
            success: true,
            message: `Memory updated: "${memory.title}"`,
            id: memory.id,
            filePath: memory.filePath,
          };
        } catch (error) {
          console.error('update_memory error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Update failed',
          };
        }
      },
    };
  }

  /**
   * Tool: get_recent_memories
   */
  private static getRecentMemoriesTool(): Tool {
    return {
      name: 'get_recent_memories',
      description:
        'Retrieve recently created or modified memories. Use this to see what information was recently saved or updated.',
      parameters: [
        {
          name: 'limit',
          type: 'number',
          description:
            'Number of recent memories to retrieve (default: 10)',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const limit = (args.limit as number) || 10;

          console.log(`[GET_RECENT_MEMORIES] Limit: ${limit}`);

          const memories = await MockMemoryService.getRecentMemories(limit);

          return {
            success: true,
            count: memories.length,
            memories: memories.map(m => ({
              id: m.id,
              title: m.title,
              content: m.content.substring(0, 300) + '...',
              tags: m.tags,
              filePath: m.filePath,
              updatedAt: new Date(m.updatedAt).toISOString(),
            })),
          };
        } catch (error) {
          console.error('get_recent_memories error:', error);
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to get recent memories',
          };
        }
      },
    };
  }
}
