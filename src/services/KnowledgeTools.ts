/**
 * Knowledge Tools for flexible, Obsidian-style knowledge management
 * Allows agent to create folders, entries, links, and manage hierarchical knowledge
 */

import {Tool} from '../types';
import {DatabaseService} from './DatabaseService';
import {LlamaService} from './LlamaService';
import {Logger} from '../utils/Logger';

export class KnowledgeTools {
  /**
   * Tool: create_knowledge
   * Create or update knowledge entry with optional properties and embedding
   */
  static getCreateKnowledgeTool(): Tool {
    return {
      name: 'create_knowledge',
      description:
        'Create or update a knowledge entry in the archive. Path format: "archive/category/subcategory/Name". Use this to save any information: movies, contacts, notes, projects, etc. Supports custom properties and linking with [[Name]].',
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Full path including name, e.g., "archive/favorites/movies/Batman"',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: 'Main content. Can include [[links]] to other entries.',
          required: true,
        },
        {
          name: 'properties',
          type: 'object',
          description: 'Custom properties as key-value pairs, e.g., {rating: 9, year: 2022, genre: "action"}',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {path, content, properties} = args;

          // Auto-generate embedding if embedding model is loaded
          let embedding: number[] | undefined;
          if (LlamaService.isEmbeddingModelLoaded()) {
            Logger.info('[KnowledgeTool] Auto-generating embedding for new knowledge entry');
            try {
              embedding = await LlamaService.generateEmbedding(content);
              Logger.info(`[KnowledgeTool] ✅ Embedding generated: ${embedding.length}D`);
            } catch (error) {
              Logger.error('[KnowledgeTool] Failed to generate embedding:', error);
            }
          }

          const entry = await DatabaseService.createKnowledge(
            path,
            content,
            properties,
            embedding
          );

          return {
            success: true,
            message: `Created/updated knowledge entry: ${entry.name}`,
            entry: {
              id: entry.id,
              name: entry.name,
              path: `${entry.folder_path}/${entry.name}`,
              content: entry.content,
              properties: entry.properties ? JSON.parse(entry.properties) : {},
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create knowledge',
          };
        }
      },
    };
  }

  /**
   * Tool: search_knowledge
   * Search knowledge entries by query and optional folder filter
   */
  static getSearchKnowledgeTool(): Tool {
    return {
      name: 'search_knowledge',
      description:
        'Search knowledge entries using semantic or keyword search. Can filter by folder. Use when user asks "what movies have I watched?", "show my contacts", etc.',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query',
          required: true,
        },
        {
          name: 'folder',
          type: 'string',
          description: 'Optional folder filter, e.g., "archive/favorites/movies"',
          required: false,
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum results (default 10)',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {query, folder, limit = 10} = args;

          let results: any[];

          // Use semantic search if embedding model is loaded
          if (LlamaService.isEmbeddingModelLoaded()) {
            Logger.info(`[KnowledgeTool] Using SEMANTIC SEARCH for: "${query}"`);
            const queryEmbedding = await LlamaService.generateEmbedding(query);
            results = await DatabaseService.searchKnowledgeByVector(
              queryEmbedding,
              limit,
              folder
            );
          } else {
            // Fallback to keyword search
            Logger.info(`[KnowledgeTool] Using KEYWORD SEARCH for: "${query}"`);
            results = await DatabaseService.searchKnowledge(query, folder, limit);
          }

          if (results.length === 0) {
            return {
              success: true,
              message: 'No knowledge entries found',
              results: [],
            };
          }

          return {
            success: true,
            message: `Found ${results.length} knowledge entries`,
            results: results.map(r => ({
              name: r.name,
              path: `${r.folder_path}/${r.name}`,
              content: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
              properties: r.properties ? JSON.parse(r.properties) : {},
              similarity: r.similarity?.toFixed(3),
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Search failed',
          };
        }
      },
    };
  }

  /**
   * Tool: get_knowledge
   * Get a specific knowledge entry by name with optional backlinks
   */
  static getGetKnowledgeTool(): Tool {
    return {
      name: 'get_knowledge',
      description:
        'Get a specific knowledge entry by name. Can include backlinks (which entries link to/from this one).',
      parameters: [
        {
          name: 'name',
          type: 'string',
          description: 'Unique name of the entry',
          required: true,
        },
        {
          name: 'include_backlinks',
          type: 'boolean',
          description: 'Include incoming and outgoing links (default false)',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {name, include_backlinks = false} = args;

          const entry = await DatabaseService.getKnowledge(name, include_backlinks);

          if (!entry) {
            return {
              success: false,
              error: `Knowledge entry "${name}" not found`,
            };
          }

          return {
            success: true,
            entry: {
              name: entry.name,
              path: `${entry.folder_path}/${entry.name}`,
              content: entry.content,
              properties: entry.properties ? JSON.parse(entry.properties) : {},
              created_at: new Date(entry.created_at).toLocaleString(),
              updated_at: entry.updated_at ? new Date(entry.updated_at).toLocaleString() : null,
              outgoing_links: entry.outgoing_links?.map((l: any) => l.name) || [],
              incoming_links: entry.incoming_links?.map((l: any) => l.name) || [],
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get knowledge',
          };
        }
      },
    };
  }

  /**
   * Tool: move_knowledge
   * Move knowledge entry to a different folder
   */
  static getMoveKnowledgeTool(): Tool {
    return {
      name: 'move_knowledge',
      description:
        'Move a knowledge entry to a different folder. Use when user says "move Batman to watched movies".',
      parameters: [
        {
          name: 'name',
          type: 'string',
          description: 'Name of the entry to move',
          required: true,
        },
        {
          name: 'new_folder',
          type: 'string',
          description: 'Destination folder path, e.g., "archive/watched/movies"',
          required: true,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {name, new_folder} = args;

          const entry = await DatabaseService.moveKnowledge(name, new_folder);

          if (!entry) {
            return {
              success: false,
              error: `Knowledge entry "${name}" not found`,
            };
          }

          return {
            success: true,
            message: `Moved "${name}" to ${new_folder}`,
            entry: {
              name: entry.name,
              new_path: `${entry.folder_path}/${entry.name}`,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to move knowledge',
          };
        }
      },
    };
  }

  /**
   * Tool: delete_knowledge
   * Delete a knowledge entry
   */
  static getDeleteKnowledgeTool(): Tool {
    return {
      name: 'delete_knowledge',
      description:
        'Delete a knowledge entry permanently. Use when user says "delete Batman" or "remove this entry".',
      parameters: [
        {
          name: 'name',
          type: 'string',
          description: 'Name of the entry to delete',
          required: true,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {name} = args;

          const deleted = await DatabaseService.deleteKnowledge(name);

          if (!deleted) {
            return {
              success: false,
              error: `Knowledge entry "${name}" not found`,
            };
          }

          return {
            success: true,
            message: `Deleted knowledge entry: ${name}`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete knowledge',
          };
        }
      },
    };
  }

  /**
   * Tool: create_folder
   * Create a folder with optional schema
   */
  static getCreateFolderTool(): Tool {
    return {
      name: 'create_folder',
      description:
        'Create a folder for organizing knowledge entries. Can specify default schema (property types) for entries in this folder.',
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Folder path, e.g., "archive/contacts" or "archive/projects"',
          required: true,
        },
        {
          name: 'schema',
          type: 'object',
          description: 'Optional default properties for entries in this folder, e.g., {name: "string", email: "string", phone: "string"}',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {path, schema} = args;

          await DatabaseService.createFolder(path, schema);

          return {
            success: true,
            message: `Created folder: ${path}`,
            folder: {
              path,
              schema: schema || {},
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create folder',
          };
        }
      },
    };
  }

  /**
   * Tool: list_folders
   * List all folders or folders under a parent path
   */
  static getListFoldersTool(): Tool {
    return {
      name: 'list_folders',
      description:
        'List all folders in the knowledge system. Can filter by parent path.',
      parameters: [
        {
          name: 'parent_path',
          type: 'string',
          description: 'Optional parent folder to list subfolders, e.g., "archive/favorites"',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const {parent_path} = args;

          const folders = await DatabaseService.listFolders(parent_path);

          return {
            success: true,
            message: `Found ${folders.length} folders`,
            folders: folders.map(f => ({
              path: f.path,
              schema: f.schema ? JSON.parse(f.schema) : {},
              created_at: new Date(f.created_at).toLocaleString(),
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list folders',
          };
        }
      },
    };
  }

  /**
   * Get all knowledge tools
   */
  static getAllTools(): Tool[] {
    return [
      this.getCreateKnowledgeTool(),
      this.getSearchKnowledgeTool(),
      this.getGetKnowledgeTool(),
      this.getMoveKnowledgeTool(),
      this.getDeleteKnowledgeTool(),
      this.getCreateFolderTool(),
      this.getListFoldersTool(),
    ];
  }
}
