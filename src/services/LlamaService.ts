/**
 * Service for managing llama.cpp model inference
 */
import {initLlama, LlamaContext} from 'llama.rn';
import {LlamaConfig, Message, Tool} from '../types';
import {DEFAULT_LLAMA_CONFIG} from '../utils/constants';
import {getChatTemplate, generateId} from '../utils/helpers';
import {ToolService} from './ToolService';
import {Logger} from '../utils/Logger';
import MemoryService from './MemoryService';
import {getModelConfig, ModelConfig} from '../types/modelConfig';
import {SYSTEM_PROMPTS, SystemPromptType, getDefaultPromptType} from './SystemPrompts';

export class LlamaService {
  private static context: LlamaContext | null = null;
  private static currentModelPath: string | null = null;
  private static currentModelName: string | null = null;
  private static isInitialized: boolean = false;
  private static toolsEnabled: boolean = false;
  private static availableTools: Tool[] = [];
  private static useLangchainPrompt: boolean = true; // Default to Langchain mode
  private static modelConfig: ModelConfig | null = null; // Model-specific configuration
  private static currentPromptType: SystemPromptType = 'letta'; // Current system prompt variant

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

      // Detect and configure model-specific settings
      this.modelConfig = getModelConfig(modelName);
      Logger.info('📋 Model type detected:', this.modelConfig.type);
      Logger.info('🔧 Tool format:', this.modelConfig.toolFormat);
      Logger.info('📝 Needs examples:', this.modelConfig.needsToolExamples);

      // Apply model-specific settings
      this.useLangchainPrompt = this.modelConfig.useLangchainPrompt;

      Logger.info('✅ Model loaded successfully:', modelName);
      Logger.info(`   Using ${this.modelConfig.displayName} configuration`);
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
        await this.context.release();
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
   * Set model configuration mode (1B vs 8B)
   */
  static setModelMode(modelType: import('../types/modelConfig').ModelType): void {
    const config = getModelConfig(modelType);
    this.modelConfig = config;

    // Apply model-specific settings
    this.useLangchainPrompt = config.useLangchainPrompt;

    Logger.info('📋 Model mode changed to:', config.displayName);
    Logger.info('🔧 Tool format:', config.toolFormat);
    Logger.info('🌡️  Temperature:', config.toolDetectionTemp);
    Logger.info('📊 Max tokens:', config.toolDetectionMaxTokens);
    Logger.info('📝 Needs examples:', config.needsToolExamples);
  }

  /**
   * Get current model configuration
   */
  static getModelConfig(): ModelConfig | null {
    return this.modelConfig;
  }

  /**
   * Set system prompt type
   */
  static setPromptType(promptType: SystemPromptType): void {
    this.currentPromptType = promptType;
    Logger.info('📝 System prompt changed to:', promptType);
  }

  /**
   * Get current system prompt type
   */
  static getPromptType(): SystemPromptType {
    return this.currentPromptType;
  }

  /**
   * Get system prompt with tool definitions
   * Uses configurable prompt variants for testing
   */
  private static getToolSystemPrompt(): string {
    // Get core memory
    let coreMemory = '';
    try {
      coreMemory = MemoryService.getFormattedCoreMemory();
    } catch (error) {
      Logger.warn('Core memory not available:', error);
    }

    // If no tools enabled, return just core memory
    if (!this.toolsEnabled || this.availableTools.length === 0) {
      return coreMemory;
    }

    // Get model config to determine if examples are needed
    const modelConfig = this.modelConfig || getModelConfig(this.currentModelName || '');
    const needsExamples = modelConfig.needsToolExamples;

    // Create tools JSON schema
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

    // Use selected prompt variant
    const promptConfig = SYSTEM_PROMPTS[this.currentPromptType];
    return promptConfig.getPrompt(coreMemory, toolsJson, needsExamples);
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

    // Get model config to determine if examples are needed
    const modelConfig = this.modelConfig || getModelConfig(this.currentModelName || '');
    const needsExamples = modelConfig.needsToolExamples;

    let prompt = `You have access to the following tools:

${toolsJson}

CRITICAL TOOL USAGE RULES:

1. MEMORY TOOLS - Use these to remember and recall information:
   - When user shares personal info: USE core_memory_append or archival_memory_insert
   - When user asks "what do you know": USE archival_memory_search
   - When user asks about past conversations: USE conversation_search
   - ALWAYS search memory BEFORE saying "I don't know"

2. WEB SEARCH - Use ONLY for current events/news:
   - Keywords: "news", "latest", "headlines", "trending", "current events"
   - DO NOT use for questions about the USER

3. TIME/DATE - Use for time-related queries:
   - Keywords: "what time", "what day", "date", "when is"

Format: [tool_name(param="value")]`;

    // Only add examples if the model needs them (1B model)
    if (needsExamples) {
      prompt += `

MANDATORY RESPONSE FORMAT:
- You MUST start your response with a tool call [tool_name(params)]
- NEVER respond with plain text without calling a tool
- ALWAYS use tools when the user's message matches any pattern below

CRITICAL EXAMPLES - YOU MUST FOLLOW THESE EXACTLY:

TIME/DATE:
User: "What time is it?" → YOU MUST RESPOND: [get_current_datetime()]
User: "What day is today?" → YOU MUST RESPOND: [get_current_datetime()]

WEB SEARCH (Current events ONLY):
User: "Latest headlines" → YOU MUST RESPOND: [search_web(query="headlines today")]
User: "News about AI" → YOU MUST RESPOND: [search_web(query="AI news")]
User: "What's trending" → YOU MUST RESPOND: [search_web(query="trending topics")]

MEMORY - WRITE (User shares info about themselves):
User: "I prefer TypeScript" → YOU MUST RESPOND: [archival_memory_insert(content="User prefers TypeScript over JavaScript", tags=["preference", "programming"])]
User: "My favorite color is blue" → YOU MUST RESPOND: [core_memory_append(label="user_profile", content="Favorite color: blue")]
User: "I work best in mornings" → YOU MUST RESPOND: [archival_memory_insert(content="User works best in the morning hours", tags=["habit", "productivity"])]
User: "Remember I'm working on LocalOS" → YOU MUST RESPOND: [core_memory_append(label="current_focus", content="Working on LocalOS project")]

MEMORY - READ (User asks about themselves):
User: "What do you know about me?" → YOU MUST RESPOND: [archival_memory_search(query="user preferences habits", top_k=10)]
User: "What are my preferences?" → YOU MUST RESPOND: [archival_memory_search(query="preferences", top_k=5)]
User: "Do you remember what I said about TypeScript?" → YOU MUST RESPOND: [archival_memory_search(query="TypeScript", top_k=3)]
User: "What did we discuss yesterday?" → YOU MUST RESPOND: [conversation_search(query="yesterday discussion", limit=5)]

ABSOLUTE RULES - NEVER VIOLATE THESE:
1. If user shares personal info → IMMEDIATELY call archival_memory_insert or core_memory_append
2. If user asks "what do you know" → IMMEDIATELY call archival_memory_search
3. DO NOT say "I don't have access" - YOU HAVE MEMORY TOOLS
4. DO NOT respond with conversational text - CALL THE TOOL FIRST
5. Tool calls MUST be on their own line, not mixed with text`;
    } else {
      // 8B model with native tool support - simpler, more concise instructions
      prompt += `

To call a tool, output: [tool_name(param="value")]

REMEMBER:
- Check archival_memory_search when user asks about themselves
- Save important info with archival_memory_insert or core_memory_append
- Use search_web only for current events/news, not for user information`;
    }

    return prompt;
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
    // Use lazy matching (.*?) to handle nested brackets in array parameters like tags=["a","b"]
    const pythonicPattern = /\[([\w_]+)\((.*?)\)\]/s;
    const pythonicMatch = pythonicPattern.exec(text);

    if (pythonicMatch) {
      const functionName = pythonicMatch[1];
      const argsString = pythonicMatch[2];

      // Parse arguments: param="value", param=123, param=["array", "values"]
      const args: Record<string, any> = {};
      if (argsString.trim()) {
        // More flexible pattern that handles strings, numbers, and arrays
        // Matches: key="value", key='value', key=123, key=["a","b"], key=True, key=None
        const argPattern = /([\w_]+)\s*=\s*(?:["']([^"']*)["']|\[([^\]]*)\]|(\w+)|(\d+))/g;
        let argMatch;
        while ((argMatch = argPattern.exec(argsString)) !== null) {
          const key = argMatch[1];

          if (argMatch[2] !== undefined) {
            // Quoted string: param="value"
            args[key] = argMatch[2];
          } else if (argMatch[3] !== undefined) {
            // Array: param=["a", "b"]
            // Parse the array content
            const arrayContent = argMatch[3];
            const arrayItems = arrayContent.split(',').map(item => {
              const trimmed = item.trim();
              // Remove quotes if present
              return trimmed.replace(/^["']|["']$/g, '');
            }).filter(item => item.length > 0);
            args[key] = arrayItems;
          } else if (argMatch[4] !== undefined) {
            // Word: param=True, param=None, param=word
            const word = argMatch[4];
            if (word === 'True' || word === 'true') args[key] = true;
            else if (word === 'False' || word === 'false') args[key] = false;
            else if (word === 'None' || word === 'null') args[key] = null;
            else args[key] = word;
          } else if (argMatch[5] !== undefined) {
            // Number: param=123
            args[key] = parseInt(argMatch[5], 10);
          }
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
      Logger.info('📝 System prompt type:', this.currentPromptType);
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
      const systemPrompt = this.getToolSystemPrompt();

      // DEBUG: Log system prompt to verify it includes memory examples
      Logger.debug('=== SYSTEM PROMPT DEBUG ===');
      Logger.debug('Prompt length:', systemPrompt.length);
      Logger.debug('Includes memory examples:', systemPrompt.includes('archival_memory_search'));
      Logger.debug('Includes "What do you know":', systemPrompt.includes('What do you know about me'));
      if (systemPrompt.length > 0) {
        Logger.debug('First 500 chars:', systemPrompt.substring(0, 500));
      }

      const systemMessage: Message = {
        id: 'system-tools',
        role: 'system',
        content: systemPrompt,
        timestamp: Date.now(),
      };

      const messagesWithTools = [systemMessage, ...messages];

      // First LLM call - check if it wants to use a tool
      // Use model-specific temperature and maxTokens
      // Don't stream to UI during tool detection phase
      const modelConfig = this.modelConfig || getModelConfig(this.currentModelName || '');
      const toolDetectionConfig = {
        ...config,
        temperature: modelConfig.toolDetectionTemp, // Model-specific temperature
        topP: 0.9,
        maxTokens: modelConfig.toolDetectionMaxTokens, // Model-specific token limit
      };

      Logger.debug('🎯 Tool detection config:', {
        modelType: modelConfig.type,
        temperature: toolDetectionConfig.temperature,
        maxTokens: toolDetectionConfig.maxTokens,
      });

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
