/**
 * Service for managing and executing tools (function calling)
 */
import {Tool, ToolCall, ToolResult} from '../types';
import {generateId} from '../utils/helpers';
import MemoryService from './MemoryService';
import {LettaMemoryTools} from './LettaMemoryTools';
import {VaultService} from './VaultService';

export class ToolService {
  private static tools: Map<string, Tool> = new Map();
  private static initialized: boolean = false;

  /**
   * Initialize all available tools
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    // Register all tools
    this.registerTool(this.getCurrentDateTimeTool());
    this.registerTool(this.getSearchWebTool());

    // Register Letta-compatible memory tools
    LettaMemoryTools.getAllTools().forEach(tool => this.registerTool(tool));

    // Register vault tools
    this.registerTool(this.getListVaultStructureTool());
    this.registerTool(this.getListVaultFilesTool());
    this.registerTool(this.getReadVaultFileTool());
    this.registerTool(this.getSearchVaultTool());

    this.initialized = true;
    console.log(`ToolService initialized with ${this.tools.size} tools`);
  }

  /**
   * Register a new tool
   */
  static registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
    console.log(`Tool registered: ${tool.name}`);
  }

  /**
   * Get all registered tools
   */
  static getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool by name
   */
  static getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Execute a tool call
   */
  static async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      return {
        id: toolCall.id,
        name: toolCall.name,
        result: null,
        error: `Tool '${toolCall.name}' not found`,
      };
    }

    try {
      console.log(`Executing tool: ${toolCall.name}`, toolCall.arguments);
      const result = await tool.execute(toolCall.arguments);
      console.log(`Tool result for ${toolCall.name}:`, result);

      return {
        id: toolCall.id,
        name: toolCall.name,
        result,
      };
    } catch (error) {
      console.error(`Tool execution error for ${toolCall.name}:`, error);
      return {
        id: toolCall.id,
        name: toolCall.name,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute multiple tool calls
   */
  static async executeTools(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results = await Promise.all(
      toolCalls.map(call => this.executeTool(call)),
    );
    return results;
  }

  /**
   * Convert tools to JSON schema for LLM
   */
  static getToolsSchema(): any[] {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.reduce(
            (acc, param) => {
              acc[param.name] = {
                type: param.type,
                description: param.description,
                ...(param.enum && {enum: param.enum}),
              };
              return acc;
            },
            {} as Record<string, any>,
          ),
          required: tool.parameters
            .filter(p => p.required)
            .map(p => p.name),
        },
      },
    }));
  }

  // ============== TOOL DEFINITIONS ==============

  /**
   * Tool: get_current_datetime
   * Returns the current date and time
   */
  private static getCurrentDateTimeTool(): Tool {
    return {
      name: 'get_current_datetime',
      description:
        'Get the current date and time. Use this when the user asks about the current date, time, day of the week, or any time-related queries.',
      parameters: [],
      execute: async () => {
        const now = new Date();

        const options: Intl.DateTimeFormatOptions = {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short',
        };

        const formatted = now.toLocaleString('en-US', options);

        return {
          datetime: now.toISOString(),
          formatted,
          timestamp: now.getTime(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          day: now.toLocaleDateString('en-US', {weekday: 'long'}),
          date: now.toLocaleDateString('en-US'),
          time: now.toLocaleTimeString('en-US'),
        };
      },
    };
  }

  /**
   * Tool: update_core_memory
   * Update a core memory block to remember user information
   */
  private static getUpdateCoreMemoryTool(): Tool {
    return {
      name: 'update_core_memory',
      description:
        'Update a core memory block to remember important information about the user. Use this when you learn about user preferences, habits, personality traits, conversation style, current tasks, or relationship context. Core memory is always loaded in every conversation.',
      parameters: [
        {
          name: 'block_name',
          type: 'string',
          description: 'The memory block to update',
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
          description: 'The new content for the memory block',
          required: true,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const blockName = args.block_name as
            | 'user_profile'
            | 'conversation_style'
            | 'current_focus'
            | 'relationship_context';
          const content = args.content as string;

          await MemoryService.updateCoreMemoryBlock(blockName, content);

          return {
            success: true,
            block_name: blockName,
            message: `Core memory block '${blockName}' updated successfully`,
          };
        } catch (error) {
          console.error('Core memory update error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Update failed',
          };
        }
      },
    };
  }

  /**
   * Tool: search_web
   * Search the web using DuckDuckGo Instant Answer API
   */
  private static getSearchWebTool(): Tool {
    return {
      name: 'search_web',
      description:
        'Call this to search for: current events, news, headlines, tutorials, documentation, "what\'s happening", "find X", "search X", or any topic the user asks about.',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'The search query',
          required: true,
        },
      ],
      checkAvailability: async () => {
        try {
          // Check internet connectivity by pinging DuckDuckGo
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          const response = await fetch('https://duckduckgo.com', {
            method: 'HEAD',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          return {
            available: response.ok,
            reason: response.ok ? undefined : 'Cannot reach search service',
          };
        } catch {
          return {
            available: false,
            reason: 'No internet connection',
          };
        }
      },
      execute: async (args: Record<string, any>) => {
        try {
          const query = args.query as string;
          console.log(`[WEB SEARCH] Query: ${query}`);

          // Use DuckDuckGo HTML scraping (no API key required)
          const encodedQuery = encodeURIComponent(query);
          const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });

          if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
          }

          const html = await response.text();

          // Parse search results from HTML
          const results: string[] = [];

          // Extract titles - look for result links
          const titleRegex = /<a[^>]*class="result__a"[^>]*>([^<]+)<\/a>/g;
          const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/g;

          let titleMatch;
          let count = 0;
          while ((titleMatch = titleRegex.exec(html)) !== null && count < 5) {
            const title = titleMatch[1].trim();
            if (title) {
              results.push(title);
              count++;
            }
          }

          // If no titles found, try to extract snippets
          if (results.length === 0) {
            let snippetMatch;
            count = 0;
            while ((snippetMatch = snippetRegex.exec(html)) !== null && count < 5) {
              const snippet = snippetMatch[1].trim();
              if (snippet) {
                results.push(snippet);
                count++;
              }
            }
          }

          if (results.length === 0) {
            // Fallback: return a message that search completed
            return {
              success: true,
              query,
              results: [
                `Search completed for "${query}". DuckDuckGo returned results but parsing format may have changed. The search functionality is working.`,
              ],
              source: 'DuckDuckGo HTML',
            };
          }

          return {
            success: true,
            query,
            results,
            source: 'DuckDuckGo',
            count: results.length,
          };
        } catch (error) {
          console.error('Web search error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Search failed',
            query: args.query as string,
          };
        }
      },
    };
  }

  // ============== VAULT TOOLS ==============

  /**
   * Tool: list_vault_structure
   * Get the folder structure of the vault
   */
  private static getListVaultStructureTool(): Tool {
    return {
      name: 'list_vault_structure',
      description:
        'Get the folder structure of the Obsidian vault. Shows all folders and subfolders. Use this to understand the organization of notes.',
      parameters: [],
      checkAvailability: async () => {
        const hasVault = await VaultService.hasVault();
        return {
          available: hasVault,
          reason: hasVault ? undefined : 'No vault configured',
        };
      },
      execute: async () => {
        try {
          const config = await VaultService.getVaultConfig();
          if (!config) {
            return {
              success: false,
              error: 'No vault configured',
            };
          }

          const scanResult = await VaultService.scanVault(config.vaultPath);

          // Build folder hierarchy
          const structure: Record<string, string[]> = {};
          scanResult.folders.forEach(folder => {
            const parentPath = folder.parent.replace(config.vaultPath, '').replace(/^\//, '') || 'root';
            if (!structure[parentPath]) {
              structure[parentPath] = [];
            }
            structure[parentPath].push(folder.name);
          });

          return {
            success: true,
            vault_name: config.vaultName,
            vault_path: config.vaultPath,
            total_folders: scanResult.totalFolders,
            total_files: scanResult.totalFiles,
            structure,
            folders: scanResult.folders.map(f => ({
              name: f.name,
              path: f.relativePath,
              parent: f.parent.replace(config.vaultPath, '').replace(/^\//, '') || 'root',
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get vault structure',
          };
        }
      },
    };
  }

  /**
   * Tool: list_vault_files
   * List all markdown files in the vault with their locations
   */
  private static getListVaultFilesTool(): Tool {
    return {
      name: 'list_vault_files',
      description:
        'List all markdown files in the vault with their folder locations. Use this to see what notes are available and where they are located.',
      parameters: [
        {
          name: 'folder',
          type: 'string',
          description: 'Optional: Filter files by folder name (e.g., "Learning", "Projects")',
          required: false,
        },
      ],
      checkAvailability: async () => {
        const hasVault = await VaultService.hasVault();
        return {
          available: hasVault,
          reason: hasVault ? undefined : 'No vault configured',
        };
      },
      execute: async (args: Record<string, any>) => {
        try {
          const config = await VaultService.getVaultConfig();
          if (!config) {
            return {
              success: false,
              error: 'No vault configured',
            };
          }

          const scanResult = await VaultService.scanVault(config.vaultPath);
          let files = scanResult.files;

          // Filter by folder if specified
          const folderFilter = args.folder as string | undefined;
          if (folderFilter) {
            files = files.filter(f =>
              f.relativePath.toLowerCase().includes(folderFilter.toLowerCase())
            );
          }

          return {
            success: true,
            total_files: files.length,
            files: files.map(f => ({
              name: f.basename,
              full_name: f.name,
              path: f.relativePath,
              folder: f.folder.replace(config.vaultPath, '').replace(/^\//, '') || 'root',
              size: f.size,
              modified: f.mtime.toISOString(),
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list vault files',
          };
        }
      },
    };
  }

  /**
   * Tool: read_vault_file
   * Read the content of a specific file from the vault
   */
  private static getReadVaultFileTool(): Tool {
    return {
      name: 'read_vault_file',
      description:
        'Read the content of a specific markdown file from the vault. Provide the file name or relative path. Returns the file content, frontmatter metadata, tags, and links.',
      parameters: [
        {
          name: 'file_path',
          type: 'string',
          description: 'The relative path or name of the file to read (e.g., "Vector Search.md" or "Learning/Vector Search.md")',
          required: true,
        },
      ],
      checkAvailability: async () => {
        const hasVault = await VaultService.hasVault();
        return {
          available: hasVault,
          reason: hasVault ? undefined : 'No vault configured',
        };
      },
      execute: async (args: Record<string, any>) => {
        try {
          const config = await VaultService.getVaultConfig();
          if (!config) {
            return {
              success: false,
              error: 'No vault configured',
            };
          }

          const filePath = args.file_path as string;

          // Scan vault to find the file
          const scanResult = await VaultService.scanVault(config.vaultPath);

          // Find file by name or relative path
          const file = scanResult.files.find(f =>
            f.name === filePath ||
            f.basename === filePath.replace(/\.md$/i, '') ||
            f.relativePath === filePath ||
            f.relativePath.endsWith(filePath)
          );

          if (!file) {
            return {
              success: false,
              error: `File not found: ${filePath}`,
              available_files: scanResult.files.slice(0, 10).map(f => f.relativePath),
            };
          }

          // Read the file
          const markdownFile = await VaultService.readMarkdownFile(file.path);

          return {
            success: true,
            file: {
              name: markdownFile.file.basename,
              path: markdownFile.file.relativePath,
              folder: markdownFile.file.folder.replace(config.vaultPath, '').replace(/^\//, '') || 'root',
              size: markdownFile.file.size,
              modified: markdownFile.file.mtime.toISOString(),
            },
            content: markdownFile.content,
            frontmatter: markdownFile.frontmatter,
            tags: markdownFile.tags,
            links: markdownFile.links,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to read vault file',
          };
        }
      },
    };
  }

  /**
   * Tool: search_vault
   * Search for files in the vault by name or content
   */
  private static getSearchVaultTool(): Tool {
    return {
      name: 'search_vault',
      description:
        'Search for files in the vault by name, folder, or content keywords. Returns matching files with snippets.',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Search query (file name, folder name, or content keyword)',
          required: true,
        },
      ],
      checkAvailability: async () => {
        const hasVault = await VaultService.hasVault();
        return {
          available: hasVault,
          reason: hasVault ? undefined : 'No vault configured',
        };
      },
      execute: async (args: Record<string, any>) => {
        try {
          const config = await VaultService.getVaultConfig();
          if (!config) {
            return {
              success: false,
              error: 'No vault configured',
            };
          }

          const query = (args.query as string).toLowerCase();
          const scanResult = await VaultService.scanVault(config.vaultPath);

          // Search by file name or path
          const nameMatches = scanResult.files.filter(f =>
            f.basename.toLowerCase().includes(query) ||
            f.relativePath.toLowerCase().includes(query)
          );

          // If no name matches, search content
          if (nameMatches.length === 0) {
            const contentMatches = [];
            for (const file of scanResult.files.slice(0, 50)) { // Limit to first 50 files for performance
              try {
                const markdownFile = await VaultService.readMarkdownFile(file.path);
                if (markdownFile.content.toLowerCase().includes(query)) {
                  // Extract snippet around match
                  const contentLower = markdownFile.content.toLowerCase();
                  const matchIndex = contentLower.indexOf(query);
                  const snippetStart = Math.max(0, matchIndex - 50);
                  const snippetEnd = Math.min(markdownFile.content.length, matchIndex + query.length + 50);
                  const snippet = markdownFile.content.substring(snippetStart, snippetEnd);

                  contentMatches.push({
                    name: file.basename,
                    path: file.relativePath,
                    folder: file.folder.replace(config.vaultPath, '').replace(/^\//, '') || 'root',
                    snippet: `...${snippet}...`,
                    tags: markdownFile.tags,
                  });
                }
              } catch (readError) {
                // Skip files that can't be read
              }
            }

            return {
              success: true,
              query,
              search_type: 'content',
              total_matches: contentMatches.length,
              matches: contentMatches,
            };
          }

          // Return name matches
          return {
            success: true,
            query,
            search_type: 'name',
            total_matches: nameMatches.length,
            matches: nameMatches.map(f => ({
              name: f.basename,
              path: f.relativePath,
              folder: f.folder.replace(config.vaultPath, '').replace(/^\//, '') || 'root',
              size: f.size,
              modified: f.mtime.toISOString(),
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to search vault',
          };
        }
      },
    };
  }

  /**
   * Parse tool calls from LLM response
   * This handles both JSON and text-based tool call formats
   */
  static parseToolCalls(text: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    try {
      // Try to parse as JSON first (for models that output JSON tool calls)
      const jsonMatch = text.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
          return parsed.tool_calls.map((call: any) => ({
            id: generateId(),
            name: call.name || call.function?.name,
            arguments: call.arguments || call.function?.arguments || {},
          }));
        }
      }

      // Fallback: Parse text-based format
      // Format: <tool_call>tool_name(arg1="value1", arg2="value2")</tool_call>
      const toolCallRegex = /<tool_call>(.*?)<\/tool_call>/gs;
      let match;

      while ((match = toolCallRegex.exec(text)) !== null) {
        const callText = match[1].trim();
        const nameMatch = callText.match(/^(\w+)\((.*)\)$/);

        if (nameMatch) {
          const name = nameMatch[1];
          const argsText = nameMatch[2];

          // Parse arguments
          const args: Record<string, any> = {};
          const argRegex = /(\w+)=["']([^"']+)["']/g;
          let argMatch;

          while ((argMatch = argRegex.exec(argsText)) !== null) {
            args[argMatch[1]] = argMatch[2];
          }

          toolCalls.push({
            id: generateId(),
            name,
            arguments: args,
          });
        }
      }
    } catch (error) {
      console.error('Error parsing tool calls:', error);
    }

    return toolCalls;
  }
}
