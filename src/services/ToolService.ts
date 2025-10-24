/**
 * Service for managing and executing tools (function calling)
 */
import {Tool, ToolCall, ToolResult} from '../types';
import {generateId} from '../utils/helpers';

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
      execute: async (args: {query: string}) => {
        try {
          // Use DuckDuckGo Instant Answer API (free, no key required)
          const encodedQuery = encodeURIComponent(args.query);
          const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'LocalOSApp/1.0',
            },
          });

          if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
          }

          const data = await response.json();

          // Format the response
          let results: string[] = [];

          // Add abstract if available
          if (data.Abstract) {
            results.push(data.Abstract);
          }

          // Add related topics
          if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            const topics = data.RelatedTopics
              .filter((t: any) => t.Text)
              .slice(0, 5)
              .map((t: any) => t.Text);
            results = [...results, ...topics];
          }

          if (results.length === 0) {
            return {
              success: false,
              message: 'No results found. Try rephrasing your query.',
              query: args.query,
            };
          }

          return {
            success: true,
            query: args.query,
            results,
            source: 'DuckDuckGo',
          };
        } catch (error) {
          console.error('Web search error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Search failed',
            query: args.query,
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
