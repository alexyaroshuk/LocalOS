/**
 * Service for managing llama.cpp model inference
 */
import {initLlama, LlamaContext, releaseContext} from 'llama.rn';
import {LlamaConfig, Message, Tool} from '../types';
import {DEFAULT_LLAMA_CONFIG} from '../utils/constants';
import {getChatTemplate, generateId} from '../utils/helpers';
import {ToolService} from './ToolService';
import {Logger} from '../utils/Logger';

export class LlamaService {
  private static context: LlamaContext | null = null;
  private static currentModelPath: string | null = null;
  private static currentModelName: string | null = null;
  private static isInitialized: boolean = false;
  private static toolsEnabled: boolean = false;
  private static availableTools: Tool[] = [];
  private static useLangchainPrompt: boolean = true; // Default to Langchain mode

  /**
   * Initialize and load a model
   */
  static async loadModel(
    modelPath: string,
    modelName: string,
    config: Partial<LlamaConfig> = {},
  ): Promise<void> {
    try {
      // Release existing context if any
      await this.releaseModel();

      Logger.info('Loading model from:', modelPath);

      const llamaConfig = {
        ...DEFAULT_LLAMA_CONFIG,
        ...config,
      };

      // Initialize llama context
      this.context = await initLlama({
        model: modelPath,
        n_ctx: llamaConfig.contextSize,
        n_gpu_layers: llamaConfig.nGpuLayers,
        use_mlock: true, // Keep model in RAM
        use_mmap: true, // Use memory mapping
      });

      this.currentModelPath = modelPath;
      this.currentModelName = modelName;
      this.isInitialized = true;

      Logger.info('✅ Model loaded successfully:', modelName);
    } catch (error) {
      Logger.error('Failed to load model:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Release the current model and free resources
   */
  static async releaseModel(): Promise<void> {
    if (this.context) {
      try {
        await releaseContext(this.context.id);
        Logger.info('Model context released');
      } catch (error) {
        Logger.error('Failed to release context:', error);
      }
      this.context = null;
      this.currentModelPath = null;
      this.currentModelName = null;
      this.isInitialized = false;
    }
  }

  /**
   * Check if model is loaded and ready
   */
  static isModelLoaded(): boolean {
    return this.isInitialized && this.context !== null;
  }

  /**
   * Get current model info
   */
  static getCurrentModel(): {path: string; name: string} | null {
    if (!this.currentModelPath || !this.currentModelName) {
      return null;
    }
    return {
      path: this.currentModelPath,
      name: this.currentModelName,
    };
  }

  /**
   * Generate completion for a prompt
   */
  static async completion(
    prompt: string,
    config: Partial<LlamaConfig> = {},
    onToken?: (token: string) => void,
  ): Promise<string> {
    if (!this.context) {
      throw new Error('Model not loaded');
    }

    try {
      const llamaConfig = {
        ...DEFAULT_LLAMA_CONFIG,
        ...config,
      };

      Logger.debug('Starting completion with config:', llamaConfig);

      let fullResponse = '';

      // Use completion API with streaming
      const result = await this.context.completion(
        {
          prompt,
          n_predict: llamaConfig.maxTokens,
          temperature: llamaConfig.temperature,
          top_p: llamaConfig.topP,
          top_k: llamaConfig.topK,
          repeat_penalty: llamaConfig.repeatPenalty,
          stop: llamaConfig.stopSequences,
        },
        data => {
          // Token callback for streaming
          if (data.token && onToken) {
            onToken(data.token);
            fullResponse += data.token;
          }
        },
      );

      // If streaming didn't capture the response, use the result
      if (!fullResponse && result.text) {
        fullResponse = result.text;
      }

      Logger.debug('Completion finished');
      return fullResponse.trim();
    } catch (error) {
      Logger.error('Completion error:', error);
      throw error;
    }
  }

  /**
   * Generate chat completion with message history
   */
  static async chatCompletion(
    messages: Message[],
    config: Partial<LlamaConfig> = {},
    onToken?: (token: string) => void,
  ): Promise<string> {
    if (!this.context || !this.currentModelName) {
      throw new Error('Model not loaded');
    }

    try {
      // Convert messages to the appropriate chat template
      const chatMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const prompt = getChatTemplate(this.currentModelName, chatMessages);
      Logger.debug('Generated prompt template for:', this.currentModelName);

      // Use the completion method with the formatted prompt
      return await this.completion(prompt, config, onToken);
    } catch (error) {
      Logger.error('Chat completion error:', error);
      throw error;
    }
  }

  /**
   * Stop ongoing generation
   */
  static async stopGeneration(): Promise<void> {
    if (this.context) {
      try {
        await this.context.stopCompletion();
        Logger.info('Generation stopped');
      } catch (error) {
        Logger.error('Failed to stop generation:', error);
      }
    }
  }

  /**
   * Get model metadata
   */
  static async getModelInfo(): Promise<any> {
    if (!this.context) {
      return null;
    }

    try {
      // Get model metadata if available
      return {
        name: this.currentModelName,
        path: this.currentModelPath,
        // Add more metadata if llama.rn exposes it
      };
    } catch (error) {
      Logger.error('Failed to get model info:', error);
      return null;
    }
  }

  /**
   * Tokenize text (useful for counting tokens)
   */
  static async tokenize(text: string): Promise<number[]> {
    if (!this.context) {
      throw new Error('Model not loaded');
    }

    try {
      const result = await this.context.tokenize(text);
      return result.tokens;
    } catch (error) {
      Logger.error('Tokenization error:', error);
      throw error;
    }
  }

  /**
   * Get token count for text
   */
  static async getTokenCount(text: string): Promise<number> {
    try {
      const tokens = await this.tokenize(text);
      return tokens.length;
    } catch (error) {
      Logger.error('Failed to count tokens:', error);
      // Rough estimate: ~4 characters per token
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Enable function calling with tools
   */
  static enableTools(tools?: Tool[]): void {
    this.toolsEnabled = true;
    if (tools) {
      this.availableTools = tools;
    } else {
      // Use all registered tools from ToolService
      ToolService.initialize();
      this.availableTools = ToolService.getAllTools();
    }
    Logger.info(`🔧 Tools enabled: ${this.availableTools.length} tools available`);
  }

  /**
   * Disable function calling
   */
  static disableTools(): void {
    this.toolsEnabled = false;
    this.availableTools = [];
    Logger.info('Tools disabled');
  }

  /**
   * Check if tools are enabled
   */
  static areToolsEnabled(): boolean {
    return this.toolsEnabled;
  }

  /**
   * Set the prompting mode for tool calling
   */
  static setLangchainMode(enabled: boolean): void {
    this.useLangchainPrompt = enabled;
    Logger.info(`Tool prompt mode: ${enabled ? 'Langchain' : 'Legacy'}`);
  }

  /**
   * Get current prompting mode
   */
  static isLangchainMode(): boolean {
    return this.useLangchainPrompt;
  }

  /**
   * Get system prompt with tool definitions
   * Format compatible with Llama 3.2 1B Function Calling model
   * Based on: nguyenthanhthuan/Llama-3.2-1B-Instruct-function-calling-v2
   */
  private static getToolSystemPrompt(): string {
    if (!this.toolsEnabled || this.availableTools.length === 0) {
      return '';
    }

    // Use legacy or langchain mode based on toggle
    return this.useLangchainPrompt
      ? this.getLangchainToolPrompt()
      : this.getLegacyToolPrompt();
  }

  /**
   * Langchain-style tool prompt (new format)
   * Uses JSON schema format similar to Langchain's bind_tools
   */
  private static getLangchainToolPrompt(): string {
    // Create JSON schema format (like Langchain's bind_tools)
    const toolSchemas = this.availableTools.map(tool => {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      tool.parameters.forEach(p => {
        properties[p.name] = {
          type: p.type,
          description: p.description,
        };
        if (p.required) {
          required.push(p.name);
        }
      });

      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        },
      };
    });

    const toolsJson = JSON.stringify(toolSchemas, null, 2);

    return `You have access to the following tools:

${toolsJson}

ABSOLUTE MANDATORY RULES:
If user says ANY of these words, you MUST call search_web immediately:
"search", "find", "news", "latest", "headlines", "trending", "about", "what's happening", "current events"

DO NOT say "I don't have access" - YOU HAVE THE SEARCH TOOL
DO NOT answer from memory - USE THE TOOL
DO NOT refuse - CALL THE TOOL NOW

Format: [tool_name(param="value")]

EXAMPLES - Learn these patterns:
User: "What time is it?" → [get_current_datetime()]
User: "Latest headlines" → [search_web(query="headlines today")]
User: "News about Trump" → [search_web(query="Trump news")]
User: "Latest news about canada" → [search_web(query="canada news")]
User: "What's trending on Twitter" → [search_web(query="Twitter trending")]
User: "Search for React Native" → [search_web(query="React Native")]
User: "Find React tutorials" → [search_web(query="React tutorials")]
User: "What's on the news" → [search_web(query="latest news")]
User: "Latest news about biden" → [search_web(query="biden news")]
User: "What's happening with AI" → [search_web(query="AI news")]
User: "Search for Trump Canada" → [search_web(query="Trump Canada")]
User: "What's trending" → [search_web(query="trending topics")]`;
  }

  /**
   * Legacy Pydantic-style tool prompt (old format)
   * Uses simpler tool list format without Pydantic schemas
   */
  private static getLegacyToolPrompt(): string {
    // Simplified tool descriptions
    const toolList = this.availableTools
      .map(tool => {
        const params = tool.parameters
          .map(p => `${p.name}: ${p.type}`)
          .join(', ');
        return `- ${tool.name}(${params}): ${tool.description}`;
      })
      .join('\n');

    return `You are an AI assistant with tool calling abilities. You have access to these tools:

${toolList}

ABSOLUTE MANDATORY RULES:
If user says ANY of these words, you MUST call search_web immediately:
"search", "find", "news", "latest", "headlines", "trending", "about", "what's happening", "current events"

DO NOT say "I don't have access" - YOU HAVE THE SEARCH TOOL
DO NOT answer from memory - USE THE TOOL
DO NOT refuse - CALL THE TOOL NOW

Format: [function_name(param="value")]

EXAMPLES - Learn these patterns:
User: "What time is it?" → [get_current_datetime()]
User: "Latest headlines" → [search_web(query="headlines today")]
User: "News about Trump" → [search_web(query="Trump news")]
User: "Latest news about canada" → [search_web(query="canada news")]
User: "What's trending on Twitter" → [search_web(query="Twitter trending")]
User: "Search for React Native" → [search_web(query="React Native")]
User: "Find React tutorials" → [search_web(query="React tutorials")]
User: "What's on the news" → [search_web(query="latest news")]
User: "Latest news about biden" → [search_web(query="biden news")]
User: "What's happening with AI" → [search_web(query="AI news")]
User: "Search for Trump Canada" → [search_web(query="Trump Canada")]
User: "What's trending" → [search_web(query="trending topics")]`;
  }

  /**
   * Filter out function call from text (Pythonic format)
   */
  private static filterToolJson(text: string): string {
    // Remove Pythonic function calls: [function_name(params)]
    let cleaned = text.replace(/\[[\w_]+\([^\]]*\)\]/g, '').trim();

    // Remove old XML format for backwards compatibility
    cleaned = cleaned.replace(/<function_call>[\s\S]*?<\/function_call>/g, '').trim();

    // Remove old JSON format for backwards compatibility
    cleaned = cleaned.replace(/\{[\s\S]*?"(tool|name)"[\s\S]*?\}/g, '').trim();

    // If the result is empty or just punctuation, return empty
    if (!cleaned || /^[\s\{\}\[\],.:;!?<>-]*$/.test(cleaned)) {
      return '';
    }

    return cleaned;
  }

  /**
   * Extract function call from response
   * Supports Pythonic format: [function_name(param="value")]
   */
  private static extractToolCall(text: string): string | null {
    // Try to extract Pythonic format: [function_name(param1="val1", param2="val2")]
    const pythonicPattern = /\[([\w_]+)\(([^\]]*)\)\]/;
    const pythonicMatch = pythonicPattern.exec(text);

    if (pythonicMatch) {
      const functionName = pythonicMatch[1];
      const argsString = pythonicMatch[2];

      // Parse arguments: param="value" or param=value
      const args: Record<string, any> = {};
      if (argsString.trim()) {
        // Match: param="value" or param='value'
        const argPattern = /([\w_]+)\s*=\s*["']([^"']*)["']/g;
        let argMatch;
        while ((argMatch = argPattern.exec(argsString)) !== null) {
          args[argMatch[1]] = argMatch[2];
        }
      }

      // Convert to JSON format
      return JSON.stringify({name: functionName, arguments: args});
    }

    // Fall back to old XML format for backwards compatibility
    const tagPattern = /<function_call>\s*(\{[\s\S]*?\})\s*<\/function_call>/;
    const tagMatch = tagPattern.exec(text);
    if (tagMatch) {
      return tagMatch[1];
    }

    // Fall back to raw JSON (old format)
    const jsonPattern = /\{[\s\S]*?"(tool|name)"[\s\S]*?\}/;
    const jsonMatch = jsonPattern.exec(text);
    return jsonMatch ? jsonMatch[0] : null;
  }

  /**
   * Chat completion with tool support
   */
  static async chatCompletionWithTools(
    messages: Message[],
    config: Partial<LlamaConfig> = {},
    onToken?: (token: string) => void,
    onToolUsage?: (stage: 'tool_call' | 'tool_result' | 'generating', toolName?: string) => void,
  ): Promise<{response: string; usedTool?: boolean; toolName?: string}> {
    if (!this.context || !this.currentModelName) {
      throw new Error('Model not loaded');
    }

    if (!this.toolsEnabled) {
      // No tools enabled, use regular chat completion
      Logger.warn('⚠️  Tools are NOT enabled. Call LlamaService.enableTools() first.');
      Logger.debug('Available tools:', this.availableTools.length);
      const response = await this.chatCompletion(messages, config, onToken);
      return {response, usedTool: false};
    }

    Logger.info('✅ Tools are enabled. Available tools:', this.availableTools.map(t => t.name).join(', '));

    // Log user's message for debugging
    const userMessage = messages[messages.length - 1];
    if (userMessage) {
      Logger.info('👤 User prompt:', userMessage.content);
    }

    // LAYER 2: TRIGGER WORD DETECTION - Bypass model if trigger words detected
    if (userMessage) {
      const lowerContent = userMessage.content.toLowerCase();
      const triggerWords = ['search', 'find', 'news', 'latest', 'headlines', 'trending', "what's happening", 'current events'];

      const hasTrigger = triggerWords.some(word => lowerContent.includes(word));

      if (hasTrigger && this.availableTools.some(t => t.name === 'search_web')) {
        Logger.info('🔧 TRIGGER DETECTED - Forcing search_web call, bypassing model');

        // Extract query from user message
        let query = userMessage.content;
        // Remove common prefixes
        query = query.replace(/^(search|find|look up|get|show me|tell me about)\s+(for\s+)?(the\s+)?/i, '').trim();
        // If query is too generic, use original
        if (query.length < 3) {
          query = userMessage.content;
        }

        Logger.info(`📝 Extracted query: "${query}"`);

        // Call search_web directly
        onToolUsage?.('tool_call', 'search_web');

        const toolResult = await ToolService.executeTool({
          id: generateId(),
          name: 'search_web',
          arguments: {query},
        });

        Logger.info('🔧 Tool execution result:', toolResult);

        onToolUsage?.('tool_result', 'search_web');

        // Format results for user
        let responseText = '';
        if (toolResult.result && toolResult.result.success) {
          responseText = `Here's what I found searching for "${query}":\n\n`;
          if (toolResult.result.results) {
            responseText += toolResult.result.results.join('\n\n');
          }
        } else {
          responseText = `I tried to search for "${query}" but got no results. ${toolResult.error || ''}`;
        }

        return {
          response: responseText,
          usedTool: true,
          toolName: 'search_web',
        };
      }
    }

    try {
      // Add system prompt with tool definitions
      const systemMessage: Message = {
        id: 'system-tools',
        role: 'system',
        content: this.getToolSystemPrompt(),
        timestamp: Date.now(),
      };

      const messagesWithTools = [systemMessage, ...messages];

      // First LLM call - check if it wants to use a tool
      // Use lower temperature for more structured/deterministic output
      // Don't stream to UI during tool detection phase
      const toolDetectionConfig = {
        ...config,
        temperature: 0.1, // Lower temp for structured JSON output
        topP: 0.9,
        maxTokens: 100, // Limit tokens for faster tool detection
      };

      Logger.info('🔍 Starting tool detection phase (not streaming to UI)...');
      const firstResponse = await this.chatCompletion(
        messagesWithTools,
        toolDetectionConfig,
      );

      Logger.debug('=== TOOL DETECTION DEBUG ===');
      Logger.debug('Temperature:', toolDetectionConfig.temperature);
      Logger.debug('Model raw output:', firstResponse);
      Logger.debug('Output length:', firstResponse.length);

      // Try to parse tool call from response
      const toolCallMatch = this.extractToolCall(firstResponse);

      if (!toolCallMatch) {
        Logger.info('❌ NO TOOL CALL DETECTED');

        // LAYER 3: REFUSAL OVERRIDE - Check if model refused and force tool call
        const refusalPhrases = [
          "i don't have access",
          "i don't have real-time",
          'knowledge cutoff',
          'check reputable sources',
          'i cannot provide',
          "i don't have information about current",
          'my training data',
        ];

        const lowerResponse = firstResponse.toLowerCase();
        const isRefusal = refusalPhrases.some(phrase => lowerResponse.includes(phrase));

        if (isRefusal && userMessage) {
          const lowerContent = userMessage.content.toLowerCase();
          const searchKeywords = ['news', 'latest', 'headlines', 'trending', 'search', 'find'];
          const shouldSearch = searchKeywords.some(word => lowerContent.includes(word));

          if (shouldSearch && this.availableTools.some(t => t.name === 'search_web')) {
            Logger.warn('⚠️ Model refused - Overriding with forced search_web call');

            // Extract query from user message
            let query = userMessage.content;
            query = query.replace(/^(search|find|look up|get|show me|tell me about)\s+(for\s+)?(the\s+)?/i, '').trim();
            if (query.length < 3) {
              query = userMessage.content;
            }

            Logger.info(`📝 Override query: "${query}"`);

            // Force call search_web
            onToolUsage?.('tool_call', 'search_web');

            const toolResult = await ToolService.executeTool({
              id: generateId(),
              name: 'search_web',
              arguments: {query},
            });

            Logger.info('🔧 Override tool result:', toolResult);
            onToolUsage?.('tool_result', 'search_web');

            // Format results
            let responseText = '';
            if (toolResult.result && toolResult.result.success) {
              responseText = `Here's what I found searching for "${query}":\n\n`;
              if (toolResult.result.results) {
                responseText += toolResult.result.results.join('\n\n');
              }
            } else {
              responseText = `I tried to search for "${query}" but got no results. ${toolResult.error || ''}`;
            }

            return {
              response: responseText,
              usedTool: true,
              toolName: 'search_web',
            };
          }
        }

        // No tool call, filter any accidental JSON and return response
        const cleanResponse = this.filterToolJson(firstResponse);
        return {response: cleanResponse, usedTool: false};
      }

      Logger.info('✅ TOOL CALL DETECTED:', toolCallMatch);

      try {
        const toolCall = JSON.parse(toolCallMatch);

        // Support both "name" (new format) and "tool" (old format) fields
        const toolName = toolCall.name || toolCall.tool;
        const toolArgs = toolCall.arguments || {};

        if (!toolName || !ToolService.getTool(toolName)) {
          Logger.warn('⚠️  Invalid tool name or tool not found:', toolName);
          // Invalid tool call, filter JSON and return response
          const cleanResponse = this.filterToolJson(firstResponse);
          return {response: cleanResponse, usedTool: false};
        }

        Logger.info('✅ Valid tool call detected:', {name: toolName, arguments: toolArgs});

        // Notify UI: tool is being called
        if (onToolUsage) {
          onToolUsage('tool_call', toolName);
        }

        // Execute the tool
        const toolResult = await ToolService.executeTool({
          id: `tool-${Date.now()}`,
          name: toolName,
          arguments: toolArgs,
        });

        Logger.info('🔧 Tool execution result:', toolResult);

        // Notify UI: tool result received
        if (onToolUsage) {
          onToolUsage('tool_result', toolName);
        }

        if (toolResult.error) {
          // Tool execution failed
          const errorMessage: Message = {
            id: 'tool-error',
            role: 'system',
            content: `Tool execution failed: ${toolResult.error}`,
            timestamp: Date.now(),
          };

          // Notify UI: generating final response
          if (onToolUsage) {
            onToolUsage('generating');
          }

          const finalResponse = await this.chatCompletion(
            [...messagesWithTools, errorMessage],
            config,
            onToken,
          );

          // Filter out any JSON artifacts
          const cleanResponse = this.filterToolJson(finalResponse);

          return {
            response: cleanResponse,
            usedTool: true,
            toolName: toolName,
          };
        }

        // Tool executed successfully, provide results to LLM for final answer
        const toolResultMessage: Message = {
          id: 'tool-result',
          role: 'system',
          content: `FUNCTION RESULT:\n${JSON.stringify(toolResult.result, null, 2)}\n\n=== IMPORTANT INSTRUCTIONS ===\nNow answer the user's original question naturally using the information above. You MUST:\n1. Write a complete, helpful response in natural language\n2. DO NOT output any <function_call> tags or JSON\n3. DO NOT just repeat the tool data - explain it naturally\n4. Write at least 1-2 sentences explaining the answer\n\nRespond now in natural language:`,
          timestamp: Date.now(),
        };

        // Notify UI: generating final response
        if (onToolUsage) {
          onToolUsage('generating');
        }

        Logger.info('🎯 Generating final response with tool results...');
        const finalResponse = await this.chatCompletion(
          [...messagesWithTools, toolResultMessage],
          config,
          onToken, // THIS ENABLES STREAMING for the final response
        );

        Logger.debug('📝 Raw final response:', finalResponse);

        // Filter out any function call artifacts from final response
        const cleanResponse = this.filterToolJson(finalResponse);

        Logger.info('✨ Clean final response:', cleanResponse);

        // If the response is empty after filtering, the tool was likely used but no text was generated
        if (!cleanResponse) {
          Logger.warn('⚠️  Model generated empty response after using tool.');
        }

        return {
          response: cleanResponse,
          usedTool: true,
          toolName: toolName,
        };
      } catch (parseError) {
        // Failed to parse tool call, filter JSON and return response
        Logger.error('Failed to parse tool call:', parseError);
        const cleanResponse = this.filterToolJson(firstResponse);
        return {response: cleanResponse, usedTool: false};
      }
    } catch (error) {
      Logger.error('Chat completion with tools error:', error);
      throw error;
    }
  }
}
