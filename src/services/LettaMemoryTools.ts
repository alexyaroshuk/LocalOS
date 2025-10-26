/**
 * Letta-compatible memory tools
 * Based on Letta's memory architecture for maximum compatibility
 * See: dev/letta_tools for original schemas
 */

import {Tool} from '../types';
import MemoryService from './MemoryService';
import {DatabaseService} from './DatabaseService';

export class LettaMemoryTools {
  /**
   * Tool: core_memory_append
   * Append to the contents of core memory
   */
  static getCoreMemoryAppendTool(): Tool {
    return {
      name: 'core_memory_append',
      description:
        'Append to core memory (always in-context). ONLY for things that INFLUENCE YOUR BEHAVIOR: conversation style (concise/verbose), communication preferences, current context. NOT for facts (job, favorite color) - use archival_memory_insert.',
      parameters: [
        {
          name: 'label',
          type: 'string',
          description: 'Section of the memory to be edited',
          required: true,
          enum: [
            'user_profile',
            'conversation_style',
            'current_focus',
            'relationship_context',
          ],
        },
        {
          name: 'content',
          type: 'string',
          description:
            'Content to append to the memory. All unicode (including emojis) are supported.',
          required: true,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {label, content} = args;

          // Get current memory block
          const currentMemory = MemoryService.getCoreMemory();
          const currentContent =
            currentMemory[
              label as keyof typeof currentMemory
            ];

          // Append new content
          const newContent = currentContent
            ? `${currentContent}\n${content}`
            : content;

          await MemoryService.updateCoreMemoryBlock(
            label as any,
            newContent
          );

          return {
            success: true,
            message: `Appended to core memory '${label}'`,
            label,
            appended_content: content,
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to append to core memory',
          };
        }
      },
    };
  }

  /**
   * Tool: core_memory_replace
   * Replace the contents of core memory
   */
  static getCoreMemoryReplaceTool(): Tool {
    return {
      name: 'core_memory_replace',
      description:
        'Replace text in core memory (always in-context). ONLY for USER info. Use to update preferences/personality when they change.',
      parameters: [
        {
          name: 'label',
          type: 'string',
          description: 'Section of the memory to be edited',
          required: true,
          enum: [
            'user_profile',
            'conversation_style',
            'current_focus',
            'relationship_context',
          ],
        },
        {
          name: 'old_content',
          type: 'string',
          description: 'String to replace. Must be an exact match.',
          required: true,
        },
        {
          name: 'new_content',
          type: 'string',
          description:
            'Content to write to the memory. All unicode (including emojis) are supported.',
          required: true,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {label, old_content, new_content} = args;

          // Get current memory block
          const currentMemory = MemoryService.getCoreMemory();
          const currentContent =
            currentMemory[
              label as keyof typeof currentMemory
            ];

          // Check if old_content exists
          if (!currentContent.includes(old_content)) {
            return {
              success: false,
              error: `Could not find exact match for old_content in '${label}'`,
              old_content_preview: old_content.substring(0, 100),
              current_content_preview: currentContent.substring(0, 200),
            };
          }

          // Replace old content with new content
          const updatedContent = currentContent.replace(
            old_content,
            new_content
          );

          await MemoryService.updateCoreMemoryBlock(
            label as any,
            updatedContent
          );

          return {
            success: true,
            message: `Replaced content in core memory '${label}'`,
            label,
            old_content_length: old_content.length,
            new_content_length: new_content.length,
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to replace core memory',
          };
        }
      },
    };
  }

  /**
   * Tool: archival_memory_insert
   * Add to archival memory
   */
  static getArchivalMemoryInsertTool(): Tool {
    return {
      name: 'archival_memory_insert',
      description:
        'Add to archival memory (on-demand retrieval). Use for FACTS about the user: job, interests, preferences (favorite color, language preference), past events, conversations, tasks. Retrieved when needed.',
      parameters: [
        {
          name: 'content',
          type: 'string',
          description:
            'Content to write to the memory. All unicode (including emojis) are supported.',
          required: true,
        },
        {
          name: 'tags',
          type: 'array',
          description:
            'Optional list of tags to associate with this memory for better organization and filtering.',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {content, tags = []} = args;

          // Automatically assign importance based on content length and tags
          const importance = Math.min(
            10,
            Math.max(5, Math.ceil(content.length / 100) + tags.length)
          );

          const memory = await DatabaseService.saveMemory(
            content,
            'fact', // Default category
            importance,
            {tags}
          );

          return {
            success: true,
            message: 'Memory added to archival storage',
            memory_id: memory.id,
            content_length: content.length,
            tags,
            importance,
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to insert archival memory',
          };
        }
      },
    };
  }

  /**
   * Tool: archival_memory_search
   * Search archival memory using semantic search
   */
  static getArchivalMemorySearchTool(): Tool {
    return {
      name: 'archival_memory_search',
      description:
        'Search long-term memory to recall information about the user (preferences, habits, facts). Use this when the user asks "what do you know about me" or similar questions. NOT for web search or current events.',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'String to search for using semantic similarity',
          required: true,
        },
        {
          name: 'tags',
          type: 'array',
          description:
            'Optional list of tags to filter search results. Only passages with these tags will be returned.',
          required: false,
        },
        {
          name: 'top_k',
          type: 'number',
          description:
            'Maximum number of results to return. Uses system default (5) if not specified.',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {query, tags = [], top_k = 5} = args;

          // Search archive
          let memories = await DatabaseService.searchArchive(
            query,
            top_k
          );

          // Filter by tags if provided
          if (tags.length > 0) {
            memories = memories.filter(m => {
              const memoryMetadata = JSON.parse(m.metadata || '{}');
              const memoryTags = memoryMetadata.tags || [];
              return tags.some((tag: string) =>
                memoryTags.includes(tag)
              );
            });
          }

          if (memories.length === 0) {
            return {
              success: true,
              message: `No results found for query: "${query}"`,
              query,
              results: [],
              count: 0,
            };
          }

          return {
            success: true,
            message: `Found ${memories.length} results for query: "${query}"`,
            query,
            count: memories.length,
            results: memories.map(m => {
              const metadata = JSON.parse(m.metadata || '{}');
              return {
                content: m.content,
                category: m.category,
                importance: m.importance,
                created_at: new Date(m.created_at).toISOString(),
                tags: metadata.tags || [],
              };
            }),
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to search archival memory',
          };
        }
      },
    };
  }

  /**
   * Tool: conversation_search
   * Search past conversations
   */
  static getConversationSearchTool(): Tool {
    return {
      name: 'conversation_search',
      description:
        'Recall what was discussed in previous conversations with the user. Use this to remember past discussions, not for web search or current events.',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'What to search for in past conversations',
          required: true,
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum number of conversations to return (default 5)',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {query, limit = 5} = args;

          const conversations =
            await DatabaseService.getRecentConversations(limit);

          // Simple keyword search in summaries
          const lowerQuery = query.toLowerCase();
          const matches = conversations.filter(
            c =>
              c.summary.toLowerCase().includes(lowerQuery) ||
              JSON.parse(c.key_points || '[]').some((kp: string) =>
                kp.toLowerCase().includes(lowerQuery)
              )
          );

          if (matches.length === 0) {
            return {
              success: true,
              message: `No past conversations found matching "${query}"`,
              query,
              results: [],
            };
          }

          return {
            success: true,
            message: `Found ${matches.length} past conversations`,
            query,
            results: matches.map(c => ({
              summary: c.summary,
              key_points: JSON.parse(c.key_points || '[]'),
              date: new Date(c.date).toLocaleDateString(),
              message_count: c.message_count,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to search conversations',
          };
        }
      },
    };
  }

  /**
   * Tool: core_memory_clear
   * Clear/reset a core memory block
   */
  static getCoreMemoryClearTool(): Tool {
    return {
      name: 'core_memory_clear',
      description:
        'Clear/reset a specific core memory block. Use this to remove all content from a memory section.',
      parameters: [
        {
          name: 'label',
          type: 'string',
          description: 'Section of the memory to be cleared',
          required: true,
          enum: [
            'user_profile',
            'conversation_style',
            'current_focus',
            'relationship_context',
          ],
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {label} = args;

          await MemoryService.updateCoreMemoryBlock(label as any, '');

          return {
            success: true,
            message: `Cleared core memory '${label}'`,
            label,
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to clear core memory',
          };
        }
      },
    };
  }

  /**
   * Tool: archival_memory_delete
   * Delete a specific memory from archival storage by ID
   */
  static getArchivalMemoryDeleteTool(): Tool {
    return {
      name: 'archival_memory_delete',
      description:
        'Delete a specific memory from archival storage. Use this to remove outdated or incorrect information.',
      parameters: [
        {
          name: 'id',
          type: 'number',
          description: 'ID of the memory to delete',
          required: true,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {id} = args;

          // Delete from mock database
          const result = await DatabaseService.deleteArchiveMemory(id);

          if (result) {
            return {
              success: true,
              message: `Deleted archival memory with ID ${id}`,
              id,
            };
          } else {
            return {
              success: false,
              error: `Memory with ID ${id} not found`,
            };
          }
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to delete archival memory',
          };
        }
      },
    };
  }

  /**
   * Get all Letta-compatible memory tools
   */
  static getAllTools(): Tool[] {
    return [
      this.getCoreMemoryAppendTool(),
      this.getCoreMemoryReplaceTool(),
      this.getCoreMemoryClearTool(),
      this.getArchivalMemoryInsertTool(),
      this.getArchivalMemorySearchTool(),
      this.getArchivalMemoryDeleteTool(),
      this.getConversationSearchTool(),
    ];
  }
}
