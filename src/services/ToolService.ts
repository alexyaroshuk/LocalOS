/**
 * Service for managing and executing tools (function calling)
 */
import {Tool, ToolCall, ToolResult, Message} from '../types';
import {generateId} from '../utils/helpers';
import MemoryService from './MemoryService';
import {LettaMemoryTools} from './LettaMemoryTools';
import {VaultService} from './VaultService';
import {VaultIndexService} from './VaultIndexService';
import {DatabaseService} from './DatabaseService';
import {LlamaService} from './LlamaService';
import {AIService} from './AIService';

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
    this.registerTool(this.getFetchWebPageTool());

    // Register Letta-compatible memory tools
    LettaMemoryTools.getAllTools().forEach(tool => this.registerTool(tool));

    // Register vault tools
    this.registerTool(this.getListVaultStructureTool());
    this.registerTool(this.getListVaultFilesTool());
    this.registerTool(this.getReadVaultFileTool());
    this.registerTool(this.getSearchVaultTool());
    this.registerTool(this.getVaultLookupTool());
    this.registerTool(this.getVaultConnectionsTool());
    this.registerTool(this.getVaultWriteProposalTool());
    this.registerTool(this.getVaultCommitWriteTool());
    this.registerTool(this.getVaultSaveTool());

    // Register vault write tools
    this.registerTool(this.getSuggestJournalEntryTool());
    this.registerTool(this.getSaveVaultFileTool());
    this.registerTool(this.getUpdateVaultFileTool());

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
        'READ. Get the current real-world date and time. Examples: "what time is it", "what day is today", "what\'s the date", "what year is it", "is it morning", "what day of the week is it". Always use this — never guess time.',
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
        'READ. Search the public web for current events, news, headlines, public facts, tutorials, or documentation. Examples: "latest AI news", "what\'s trending on Twitter", "search for React Native tutorials", "current weather in NYC", "who won the game". Do NOT use this for info about the user themselves — that\'s vault_lookup.',
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
          const results: Array<{title: string; url: string; snippet?: string}> = [];

          // Extract results with URLs and titles
          // DuckDuckGo result structure: <a href="URL" class="result__a">Title</a>
          const resultRegex = /<a[^>]*href="([^"]+)"[^>]*class="result__a"[^>]*>([^<]+)<\/a>/g;

          let match;
          let count = 0;
          while ((match = resultRegex.exec(html)) !== null && count < 5) {
            const rawUrl = match[1].trim();
            const title = match[2].trim();

            if (title && rawUrl) {
              // Decode URL entities
              const url = rawUrl
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");

              results.push({
                title,
                url,
              });
              count++;
            }
          }

          // If no results found, try alternative parsing
          if (results.length === 0) {
            // Try to find any <a> tags with href that might be results
            const altRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/g;
            count = 0;
            while ((match = altRegex.exec(html)) !== null && count < 5) {
              const rawUrl = match[1].trim();
              const title = match[2].trim();

              // Filter out navigation and empty links
              if (title && rawUrl && rawUrl.length > 5 && !rawUrl.startsWith('javascript:')) {
                const url = rawUrl
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'");

                results.push({title, url});
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
                {
                  title: `Search completed for "${query}"`,
                  url: 'https://duckduckgo.com/?q=' + encodeURIComponent(query),
                  snippet: 'DuckDuckGo returned results but parsing format may have changed. Try the link to see results directly.',
                },
              ],
              source: 'DuckDuckGo',
              count: 1,
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

  /**
   * Tool: fetch_web_page
   * Fetch and summarize content from a specific URL
   */
  private static getFetchWebPageTool(): Tool {
    return {
      name: 'fetch_web_page',
      description:
        'Fetch the actual content from a webpage URL and get a summary. Use this after search_web to read the full content of search results. Pass a URL and optional prompt for what information to extract. Returns the page content or summary.',
      parameters: [
        {
          name: 'url',
          type: 'string',
          description: 'The URL to fetch',
          required: true,
        },
        {
          name: 'extract_prompt',
          type: 'string',
          description:
            'Optional: What information to extract from the page (e.g., "summarize the main points", "find the news headline")',
          required: false,
        },
      ],
      execute: async (args: Record<string, any>) => {
        try {
          const urlStr = args.url as string;
          const extractPrompt = (args.extract_prompt as string) || 'Provide a concise summary of the main content in 2-3 sentences.';

          console.log(`[FETCH PAGE] URL: ${urlStr}`);
          console.log(`[FETCH PAGE] Extraction prompt: ${extractPrompt}`);

          // Validate URL
          let url: URL;
          try {
            url = new URL(urlStr);
          } catch {
            return {
              success: false,
              error: `Invalid URL: ${urlStr}`,
              url: urlStr,
            };
          }

          // Fetch the page with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            return {
              success: false,
              error: `Failed to fetch: HTTP ${response.status}`,
              url: urlStr,
            };
          }

          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('text/html')) {
            return {
              success: false,
              error: 'URL does not return HTML content',
              url: urlStr,
            };
          }

          let html = await response.text();

          // Extract title from meta tags or title tag
          let pageTitle = '';
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) {
            pageTitle = titleMatch[1].trim();
          } else {
            const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            if (h1Match) {
              pageTitle = h1Match[1].trim();
            }
          }

          // Remove scripts, styles, nav, footer, header, ads
          html = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

          // Convert HTML to readable text
          const plainText = html
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();

          // Limit content to 2000 chars for LLM processing (balance: enough context, manageable tokens)
          const contentForExtraction = plainText.substring(0, 2000);

          console.log(`[FETCH PAGE] Content fetched: ${contentForExtraction.length} characters`);

          // Use local LLM to extract/summarize
          console.log(`[FETCH PAGE] Calling local LLM for intelligent extraction...`);

          const extractionMessages: Message[] = [
            {
              id: generateId(),
              role: 'user',
              content: `Please analyze this webpage content and ${extractPrompt}\n\nWebpage URL: ${urlStr}\nPage Title: ${pageTitle}\n\nContent:\n${contentForExtraction}`,
              timestamp: Date.now(),
            },
          ];

          const extractionResult = await AIService.chatCompletion(
            extractionMessages,
            {
              temperature: 0.7,
              maxTokens: 300,
            }
          );

          const summary = extractionResult.response || extractionResult.message || '';

          console.log(`[FETCH PAGE] ✅ Extraction complete`);

          return {
            success: true,
            url: urlStr,
            title: pageTitle || 'Untitled',
            summary,
            full_content: plainText,
            content_length: plainText.length,
            extraction_method: 'local_llm',
            note: contentForExtraction.length === 2000 ? 'Content truncated to 2000 characters for processing' : undefined,
          };
        } catch (error) {
          console.error('Fetch page error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch page',
            url: args.url as string,
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
        'READ. List all folders and subfolders in the vault (structure only, no file contents). Examples: "what folders do I have", "show me my vault structure", "list folders in my vault". Use vault_lookup or search_vault for actual content.',
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
        'READ. List all markdown files in the vault with their folder locations. Examples: "list all my notes", "show me every file in my vault", "what files do I have in Learning folder". Optional folder filter. For finding specific content, use vault_lookup or search_vault instead.',
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
        'READ. Open and return the full contents of a specific markdown file when you already know its name or path. Examples: "read Vector Search.md", "open Learning/LocalOS.md", "show me the content of Preferences.md". Returns content, frontmatter, tags, and links. Use search_vault or vault_lookup if you don\'t know the exact filename.',
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
        'READ. Search the vault for multiple matching notes by topic or keyword. Use when you need several results, not just one best match. Examples: "find notes about React Native", "search for productivity notes", "what have I written about embeddings", "show me journal entries about fitness". Returns top-K matching files with snippets and similarity scores. For a single best match, use vault_lookup instead.',
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
            return {success: false, error: 'No vault configured'};
          }

          const query = String(args.query || '').trim();
          if (!query) {
            return {success: false, error: 'Empty query'};
          }

          // Tier 1: semantic top-k via VaultIndexService (uses keyword fallback
          // internally when embedding model is not loaded).
          const hits = await VaultIndexService.searchChunks(query, {topK: 3});
          if (hits.length > 0) {
            // Enrich top-1 with full file content so the agent can answer
            // directly when the best match is sufficient. Lower-ranked hits
            // stay as snippets to keep token cost bounded.
            let topFullContent: string | undefined;
            try {
              const md = await VaultService.readMarkdownFile(hits[0].path);
              topFullContent = md.content;
              const MAX = 4000;
              if (topFullContent.length > MAX) {
                topFullContent = topFullContent.substring(0, MAX) + '\n…[truncated]';
              }
            } catch {}

            return {
              success: true,
              query,
              search_type: LlamaService.isEmbeddingModelLoaded() ? 'semantic' : 'keyword_index',
              total_matches: hits.length,
              matches: hits.map((h, i) => ({
                path: h.path.replace(config.vaultPath, '').replace(/^\//, ''),
                heading: h.heading,
                snippet: h.snippet,
                full_content: i === 0 ? topFullContent : undefined,
                similarity: Number(h.similarity.toFixed(3)),
                modified: new Date(h.mtime).toISOString(),
              })),
            };
          }

          // Tier 2: filename-only grep fallback (index empty or vault unscanned).
          const scanResult = await VaultService.scanVault(config.vaultPath);
          const q = query.toLowerCase();
          const nameMatches = scanResult.files.filter(f =>
            f.basename.toLowerCase().includes(q) ||
            f.relativePath.toLowerCase().includes(q)
          );
          return {
            success: true,
            query,
            search_type: 'filename_grep',
            total_matches: nameMatches.length,
            matches: nameMatches.slice(0, 10).map(f => ({
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

  // ============== STRUCTURED VAULT TOOLS (lookup / propose / commit) ==============

  /**
   * Tool: vault_lookup
   * Convenience semantic search returning the best single match. Used by the
   * assistant to answer "do we have X?" before deciding whether to write.
   */
  private static getVaultLookupTool(): Tool {
    return {
      name: 'vault_lookup',
      description:
        'READ. Find one piece of info the user previously stored. Use whenever the user asks about themselves, their preferences, habits, beliefs, possessions, locations, passwords, or recalls anything they told you before. Examples: "what beverages do I enjoy", "what languages do I use", "where do I live", "what music do I like", "what\'s my Amazon password", "do I have a dentist", "am I vegetarian". Returns the best single match (path, heading, snippet, similarity) or {found: false}.',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'Topic or key to look up. Example: "bank password", "amazon login", "dark mode preference".',
          required: true,
        },
      ],
      checkAvailability: async () => {
        const hasVault = await VaultService.hasVault();
        return {available: hasVault, reason: hasVault ? undefined : 'No vault configured'};
      },
      execute: async (args: Record<string, any>) => {
        try {
          const config = await VaultService.getVaultConfig();
          if (!config) {
            return {success: false, error: 'No vault configured'};
          }
          const query = String(args.query || '').trim();
          if (!query) {
            return {success: false, error: 'Empty query'};
          }
          const hits = await VaultIndexService.searchChunks(query, {topK: 1});
          if (hits.length === 0) {
            return {success: true, query, found: false};
          }
          const best = hits[0];

          // Load full file content so the agent has the surrounding context
          // for the matched chunk, not just a 200-char snippet. Critical for
          // accurate narration — snippets alone often miss the exact answer.
          let fullContent: string | undefined;
          try {
            const md = await VaultService.readMarkdownFile(best.path);
            fullContent = md.content;
            // Hard cap to keep tool result under the result-truncation budget.
            // Chunks are 256 tokens (~1000 chars); files are usually a few KB.
            const MAX = 4000;
            if (fullContent.length > MAX) {
              fullContent = fullContent.substring(0, MAX) + '\n…[truncated]';
            }
          } catch (readErr) {
            // Best-effort — if read fails, still return the snippet
          }

          return {
            success: true,
            query,
            found: true,
            path: best.path.replace(config.vaultPath, '').replace(/^\//, ''),
            heading: best.heading,
            snippet: best.snippet,
            full_content: fullContent,
            similarity: Number(best.similarity.toFixed(3)),
            modified: new Date(best.mtime).toISOString(),
          };
        } catch (err) {
          return {success: false, error: err instanceof Error ? err.message : 'lookup failed'};
        }
      },
    };
  }

  /**
   * Tool: get_vault_connections
   * Returns forward links and backlinks for a vault file from the link graph.
   */
  private static getVaultConnectionsTool(): Tool {
    return {
      name: 'get_vault_connections',
      description:
        'READ. Get the link graph for a vault file — what it links to (forward links) and what links back to it (backlinks). Use when user asks "what connects to X", "what does X reference", "what notes mention X", "find related notes to X", or when following [[wiki link]] chains.',
      parameters: [
        {
          name: 'file_path',
          type: 'string',
          description:
            'Relative path or basename of the file. Examples: "Fitness Goals.md", "personal/finance/bank_info.md". Parameter name is file_path (not path).',
          required: true,
        },
      ],
      checkAvailability: async () => {
        const hasVault = await VaultService.hasVault();
        return {available: hasVault, reason: hasVault ? undefined : 'No vault configured'};
      },
      execute: async (args: Record<string, any>) => {
        try {
          const config = await VaultService.getVaultConfig();
          if (!config) {
            return {success: false, error: 'No vault configured'};
          }

          const filePath = String(args.file_path || args.path || '').trim();
          if (!filePath) {
            return {success: false, error: 'file_path is required'};
          }

          const scanResult = await VaultService.scanVault(config.vaultPath);
          const file = scanResult.files.find(
            f =>
              f.name === filePath ||
              f.basename === filePath.replace(/\.md$/i, '') ||
              f.relativePath === filePath ||
              f.relativePath.endsWith('/' + filePath) ||
              f.relativePath.endsWith(filePath),
          );

          if (!file) {
            return {
              success: false,
              error: `File not found: ${filePath}`,
              available_files: scanResult.files.slice(0, 10).map(f => f.relativePath),
            };
          }

          const [forwardLinks, backlinks] = await Promise.all([
            DatabaseService.getForwardLinks(file.path),
            DatabaseService.getBacklinks(file.path),
          ]);

          const vaultPrefix = config.vaultPath.endsWith('/')
            ? config.vaultPath
            : config.vaultPath + '/';

          const stripVaultRoot = (p: string) =>
            p.startsWith(vaultPrefix) ? p.slice(vaultPrefix.length) : p;

          return {
            success: true,
            file: file.relativePath,
            forward_links: forwardLinks.map(l => ({
              target_name: l.targetName,
              resolved_path: l.resolvedPath ? stripVaultRoot(l.resolvedPath) : null,
              dangling: l.resolvedPath === null,
            })),
            backlinks: backlinks.map(l => ({
              source_path: stripVaultRoot(l.sourcePath),
              link_text: l.targetName,
            })),
            total_connections: forwardLinks.length + backlinks.length,
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : 'get_vault_connections failed',
          };
        }
      },
    };
  }

  /**
   * Tool: vault_write_proposal
   * Build a write proposal — never writes to disk. Compares against existing
   * content at the suggested path so the assistant can surface diffs to the
   * user before any commit.
   */
  private static getVaultWriteProposalTool(): Tool {
    return {
      name: 'vault_write_proposal',
      description:
        'CREATE/UPDATE. Propose saving new info to the vault. Use when the user volunteers a new fact, preference, password, or note. Examples: "remember my X is Y", "save this note", "store my preference for Z", "I prefer dark mode". Returns a diff against existing content. NEVER writes to disk — user must approve via vault_commit_write next.',
      parameters: [
        {
          name: 'suggested_path',
          type: 'string',
          description: 'Relative path under the vault root. Convention: category/subcategory/topic.md (e.g. "personal/passwords/bank.md").',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: 'Full markdown content to write or append.',
          required: true,
        },
        {
          name: 'mode',
          type: 'string',
          description: 'One of "create" (new file), "update" (overwrite), "append" (add to existing).',
          required: false,
        },
      ],
      checkAvailability: async () => {
        const hasVault = await VaultService.hasVault();
        return {available: hasVault, reason: hasVault ? undefined : 'No vault configured'};
      },
      execute: async (args: Record<string, any>) => {
        try {
          const config = await VaultService.getVaultConfig();
          if (!config) {
            return {success: false, error: 'No vault configured'};
          }
          const relPath = String(args.suggested_path || '').replace(/^\//, '').replace(/\.\.\//g, '');
          if (!relPath || !relPath.endsWith('.md')) {
            return {success: false, error: 'suggested_path must be a relative .md path'};
          }
          const content = String(args.content || '');
          if (!content.trim()) {
            return {success: false, error: 'content is empty'};
          }
          const requestedMode = String(args.mode || '').toLowerCase();
          const absPath = `${config.vaultPath}/${relPath}`;

          const RNFS = require('react-native-fs');
          const exists = await RNFS.exists(absPath);
          if (!exists) {
            return {
              success: true,
              action: 'create',
              suggested_path: relPath,
              proposed_content: content,
              note: 'File does not exist. Ask the user to approve creation, then call vault_commit_write with mode="create".',
            };
          }

          const existing = await RNFS.readFile(absPath, 'utf8');
          const sameContent = existing.trim() === content.trim();
          if (sameContent) {
            return {
              success: true,
              action: 'already_exists_same',
              suggested_path: relPath,
              existing_content: existing,
              note: 'Identical content already saved. No write needed.',
            };
          }

          const action = requestedMode === 'append' ? 'append' : 'diff';
          return {
            success: true,
            action,
            suggested_path: relPath,
            existing_content: existing,
            proposed_content: content,
            note:
              action === 'append'
                ? 'Existing file present. Ask the user to approve appending, then call vault_commit_write with mode="append".'
                : 'Existing file content differs from the proposed content. Surface the difference to the user and ask which to keep. On approval, call vault_commit_write with mode="update".',
          };
        } catch (err) {
          return {success: false, error: err instanceof Error ? err.message : 'proposal failed'};
        }
      },
    };
  }

  /**
   * Tool: vault_commit_write
   * Commits an approved write. Should only be called AFTER vault_write_proposal
   * and explicit user approval. Re-indexes the affected file.
   */
  private static getVaultCommitWriteTool(): Tool {
    return {
      name: 'vault_commit_write',
      description:
        'Write a markdown file to the vault. Use after vault_lookup confirms the write is needed. mode="create" for new files, "append" to add to existing, "update" to overwrite.',
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'Relative vault path of the file to write (same as suggested_path from the proposal).',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: 'Final markdown content to write (or append).',
          required: true,
        },
        {
          name: 'mode',
          type: 'string',
          description: 'One of "create", "update", "append".',
          required: true,
        },
      ],
      checkAvailability: async () => {
        const hasVault = await VaultService.hasVault();
        return {available: hasVault, reason: hasVault ? undefined : 'No vault configured'};
      },
      execute: async (args: Record<string, any>) => {
        try {
          const config = await VaultService.getVaultConfig();
          if (!config) {
            return {success: false, error: 'No vault configured'};
          }
          const relPath = String(args.path || '').replace(/^\//, '').replace(/\.\.\//g, '');
          const content = String(args.content || '');
          const mode = String(args.mode || '').toLowerCase();
          if (!relPath || !relPath.endsWith('.md')) {
            return {success: false, error: 'path must be a relative .md path'};
          }
          if (!['create', 'update', 'append'].includes(mode)) {
            return {success: false, error: 'mode must be create | update | append'};
          }
          if (!content.trim()) {
            return {success: false, error: 'content is empty'};
          }

          const RNFS = require('react-native-fs');
          const absPath = `${config.vaultPath}/${relPath}`;
          const folder = absPath.substring(0, absPath.lastIndexOf('/'));
          await RNFS.mkdir(folder);

          const exists = await RNFS.exists(absPath);
          if (mode === 'create' && exists) {
            return {success: false, error: 'File already exists — use mode="update" instead'};
          }

          let finalContent = content;
          if (mode === 'append' && exists) {
            const existing = await RNFS.readFile(absPath, 'utf8');
            finalContent = existing.replace(/\s+$/, '') + '\n\n' + content + '\n';
          } else if (!finalContent.endsWith('\n')) {
            finalContent = finalContent + '\n';
          }

          await RNFS.writeFile(absPath, finalContent, 'utf8');

          // Re-index this file so the new content is searchable immediately.
          try {
            await VaultIndexService.indexVaultFile(absPath);
          } catch (idxErr) {
            // Non-fatal — write succeeded.
          }

          return {
            success: true,
            path: relPath,
            mode,
            bytes_written: finalContent.length,
            note: 'Write committed and re-indexed.',
          };
        } catch (err) {
          return {success: false, error: err instanceof Error ? err.message : 'commit failed'};
        }
      },
    };
  }

  // ============== VAULT SAVE (single-shot write) ==============

  /**
   * Tool: vault_save
   * One-shot save: lookup + write in a single call. No chaining needed.
   */
  private static getVaultSaveTool(): Tool {
    return {
      name: 'vault_save',
      description:
        'Save a fact, credential, or preference to the vault. Handles lookup and write automatically — no need to call vault_lookup or vault_commit_write separately. Use for any persistent user info: passwords, PINs, card numbers, preferences, habits, contact info. PATH CONVENTION: personal/passwords/<topic>.md | personal/financial/<topic>.md | personal/contact/<topic>.md | personal/preferences/<topic>.md | personal/notes/<topic>.md',
      parameters: [
        {
          name: 'topic',
          type: 'string',
          description: 'Short label for what is being saved (e.g. "bank password", "credit card", "email").',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: 'Full markdown content to write. Use format: "# <topic>\\n\\n<topic> = <value>\\n"',
          required: true,
        },
        {
          name: 'path',
          type: 'string',
          description: 'Relative vault path (e.g. "personal/passwords/bank.md"). Must end in .md.',
          required: true,
        },
      ],
      checkAvailability: async () => {
        const hasVault = await VaultService.hasVault();
        return {available: hasVault, reason: hasVault ? undefined : 'No vault configured'};
      },
      execute: async (args: Record<string, any>) => {
        try {
          const config = await VaultService.getVaultConfig();
          if (!config) {return {success: false, error: 'No vault configured'};}

          const topic = String(args.topic || '').trim();
          const content = String(args.content || '').trim();
          const relPath = String(args.path || '').replace(/^\//, '').replace(/\.\.\//g, '');

          if (!relPath.endsWith('.md')) {
            return {success: false, error: 'path must end in .md'};
          }
          if (!content) {
            return {success: false, error: 'content is empty'};
          }

          const RNFS = require('react-native-fs');
          const absPath = `${config.vaultPath}/${relPath}`;

          // Check for existing file
          const exists = await RNFS.exists(absPath);
          if (exists) {
            const existing = await RNFS.readFile(absPath, 'utf8');
            if (existing.trim() === content.trim()) {
              return {success: true, action: 'already_exists', path: relPath, message: `Already saved at ${relPath}`};
            }
            // Append new value
            const folder = absPath.substring(0, absPath.lastIndexOf('/'));
            await RNFS.mkdir(folder);
            await RNFS.appendFile(absPath, `\n${content}`, 'utf8');
            // Re-index
            VaultIndexService.indexVaultFile(absPath).catch(() => {});
            return {success: true, action: 'updated', path: relPath, message: `Updated ${relPath} with new value for "${topic}"`};
          }

          // Create new file
          const folder = absPath.substring(0, absPath.lastIndexOf('/'));
          await RNFS.mkdir(folder);
          await RNFS.writeFile(absPath, content, 'utf8');
          // Re-index
          VaultIndexService.indexVaultFile(absPath).catch(() => {});
          return {success: true, action: 'created', path: relPath, message: `Saved "${topic}" to ${relPath}`};
        } catch (err) {
          return {success: false, error: err instanceof Error ? err.message : 'vault_save failed'};
        }
      },
    };
  }

  // ============== VAULT WRITE TOOLS ==============

  /**
   * Tool: suggest_journal_entry
   * Analyze user's daily update and propose a structured journal entry
   */
  private static getSuggestJournalEntryTool(): Tool {
    return {
      name: 'suggest_journal_entry',
      description:
        'REQUIRED when user shares daily updates, activities, or experiences. Creates a structured journal entry proposal with markdown formatting. Use for: books read, work done, meals, social events, exercise, learning, or any daily activities. CRITICAL: You MUST provide complete, well-formatted markdown content in the content parameter. DO NOT call this tool with empty or placeholder content. The user will review and edit before saving.',
      parameters: [
        {
          name: 'date',
          type: 'string',
          description: 'The date for the journal entry (YYYY-MM-DD format)',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: 'REQUIRED: The complete, well-formatted markdown content for the journal entry. Must include proper headings (## or **) and bullet points. DO NOT use placeholder text - provide the actual journal entry content.',
          required: true,
        },
        {
          name: 'folder',
          type: 'string',
          description: 'The folder path where the entry should be saved (e.g., "Personal/Journal/2024")',
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
          const date = args.date as string;
          const content = args.content as string;
          const folder = (args.folder as string) || 'Personal/Journal';

          // Validate required parameters
          if (!date) {
            return {
              success: false,
              error: 'Missing required parameter: date (YYYY-MM-DD format)',
            };
          }

          if (!content || content.trim().length === 0) {
            return {
              success: false,
              error: 'Missing required parameter: content (must be a complete markdown journal entry)',
            };
          }

          // Extract year from date for folder organization
          const year = date.substring(0, 4);
          const folderPath = `${folder}/${year}`;
          const fileName = `${date}.md`;

          return {
            success: true,
            proposal: {
              title: fileName,
              folder: folderPath,
              relativePath: `${folderPath}/${fileName}`,
              content,
              date,
            },
            message: 'Journal entry proposal created. Review and save when ready.',
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create proposal',
          };
        }
      },
    };
  }

  /**
   * Tool: save_vault_file
   * Save a new file to the vault
   */
  private static getSaveVaultFileTool(): Tool {
    return {
      name: 'save_vault_file',
      description:
        'Save a new markdown file to the vault. Creates the file and any necessary parent directories.',
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'The relative path where to save the file (e.g., "Personal/Journal/2024/2024-10-28.md")',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: 'The markdown content to write to the file',
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
          const relativePath = args.path as string;
          const content = args.content as string;

          const vaultFile = await VaultService.writeFile(relativePath, content);

          return {
            success: true,
            file: {
              name: vaultFile.basename,
              path: vaultFile.relativePath,
              size: vaultFile.size,
            },
            message: `File saved successfully: ${vaultFile.relativePath}`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to save file',
          };
        }
      },
    };
  }

  /**
   * Tool: update_vault_file
   * Update an existing file in the vault
   */
  private static getUpdateVaultFileTool(): Tool {
    return {
      name: 'update_vault_file',
      description:
        'Update an existing markdown file in the vault with new content.',
      parameters: [
        {
          name: 'path',
          type: 'string',
          description: 'The relative path of the file to update',
          required: true,
        },
        {
          name: 'content',
          type: 'string',
          description: 'The new markdown content',
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
          const relativePath = args.path as string;
          const content = args.content as string;

          const vaultFile = await VaultService.updateFile(relativePath, content);

          return {
            success: true,
            file: {
              name: vaultFile.basename,
              path: vaultFile.relativePath,
              size: vaultFile.size,
            },
            message: `File updated successfully: ${vaultFile.relativePath}`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update file',
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
