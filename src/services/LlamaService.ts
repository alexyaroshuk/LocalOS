/**
 * Service for managing llama.cpp model inference
 */
import {initLlama, LlamaContext} from 'llama.rn';
import RNFS from 'react-native-fs';
import {LlamaConfig, Message, Tool} from '../types';
import {DEFAULT_LLAMA_CONFIG} from '../utils/constants';
import {getChatTemplate, generateId} from '../utils/helpers';
import {ToolService} from './ToolService';
import {Logger} from '../utils/Logger';
import MemoryService from './MemoryService';
import {getModelConfig, ModelConfig} from '../types/modelConfig';
import {SYSTEM_PROMPTS, SystemPromptType, getDefaultPromptType} from './SystemPrompts';

export class LlamaService {
  // Chat/Agent model context (primary)
  private static context: LlamaContext | null = null;
  private static currentModelPath: string | null = null;
  private static currentModelName: string | null = null;
  private static isInitialized: boolean = false;

  // Embedding model context (separate instance - runs alongside chat model!)
  private static embeddingContext: LlamaContext | null = null;
  private static embeddingModelPath: string | null = null;
  private static embeddingModelName: string | null = null;
  private static embeddingInitialized: boolean = false;

  private static toolsEnabled: boolean = false;
  private static availableTools: Tool[] = [];
  private static useLangchainPrompt: boolean = true; // Default to Langchain mode
  private static modelConfig: ModelConfig | null = null; // Model-specific configuration
  private static currentPromptType: SystemPromptType = 'letta'; // Current system prompt variant
  private static smartToolDetection: boolean = false; // Skip Layer 2 keyword triggers, let LLM decide
  private static lastReasoning: string = ''; // Store last model reasoning for UI display
  private static thinkingEnabled: boolean = false; // When false, strip chain-of-thought blocks from output

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

      // CRITICAL: Verify model file exists before attempting to load
      // This prevents native crashes in llama_model_has_encoder
      try {
        const fileExists = await RNFS.exists(modelPath);
        if (!fileExists) {
          const error = new Error(`Model file does not exist at path: ${modelPath}`);
          Logger.error('❌ Model file not found:', modelPath);
          throw error;
        }

        // Verify it's a file (not a directory)
        const stat = await RNFS.stat(modelPath);
        if (!stat.isFile()) {
          const error = new Error(`Path exists but is not a file: ${modelPath}`);
          Logger.error('❌ Path is not a file:', modelPath);
          throw error;
        }

        // Verify file is not empty
        if (stat.size === 0) {
          const error = new Error(`Model file is empty (0 bytes): ${modelPath}`);
          Logger.error('❌ Model file is empty:', modelPath);
          throw error;
        }

        Logger.info('✅ Model file validated:', {
          path: modelPath,
          size: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
          exists: true,
        });
      } catch (fsError) {
        Logger.error('❌ File validation failed:', fsError);
        throw new Error(
          `Cannot load model - file validation failed: ${fsError instanceof Error ? fsError.message : String(fsError)}`
        );
      }

      // Detect and configure model-specific settings FIRST
      this.modelConfig = getModelConfig(modelName);
      Logger.info('📋 Model type detected:', this.modelConfig.type);
      Logger.info('🔧 Tool format:', this.modelConfig.toolFormat);
      Logger.info('📝 Needs examples:', this.modelConfig.needsToolExamples);
      Logger.info('📏 Context size:', this.modelConfig.contextSize);

      // Use model-specific context size, not the hardcoded default
      const llamaConfig = {
        ...DEFAULT_LLAMA_CONFIG,
        contextSize: this.modelConfig.contextSize, // Use model's actual context size
        ...config,
      };

      Logger.info('🚀 Initializing model with context size:', llamaConfig.contextSize);

      // Initialize llama context
      // NOTE: use_mlock disabled for iOS - large models (6GB+) exceed app memory limits
      // use_mmap handles streaming the model from storage
      this.context = await initLlama({
        model: modelPath,
        n_ctx: llamaConfig.contextSize,
        n_gpu_layers: llamaConfig.nGpuLayers,
        use_mlock: false, // Disabled: iOS memory constraints (1-2GB limit) vs model size
        use_mmap: true,   // Memory mapping allows efficient streaming from disk
      });

      this.currentModelPath = modelPath;
      this.currentModelName = modelName;
      this.isInitialized = true;

      // Apply model-specific settings
      this.useLangchainPrompt = this.modelConfig.useLangchainPrompt;

      Logger.info('✅ Model loaded successfully:', modelName);
      Logger.info(`   Using ${this.modelConfig.displayName} configuration`);
      Logger.info(`   Context window: ${llamaConfig.contextSize} tokens`);
    } catch (error) {
      Logger.error('Failed to load model:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Load an embedding model as a separate instance
   * This runs alongside the chat model!
   */
  static async loadEmbeddingModel(
    modelPath: string,
    modelName: string,
  ): Promise<void> {
    try {
      // Release existing embedding context if any
      await this.releaseEmbeddingModel();

      Logger.info('[EmbedModel] Loading embedding model from:', modelPath);

      // CRITICAL: Verify model file exists before attempting to load
      // This prevents native crashes in llama_model_has_encoder
      try {
        const fileExists = await RNFS.exists(modelPath);
        if (!fileExists) {
          const error = new Error(`Embedding model file does not exist at path: ${modelPath}`);
          Logger.error('[EmbedModel] ❌ Model file not found:', modelPath);
          throw error;
        }

        // Verify it's a file (not a directory)
        const stat = await RNFS.stat(modelPath);
        if (!stat.isFile()) {
          const error = new Error(`Path exists but is not a file: ${modelPath}`);
          Logger.error('[EmbedModel] ❌ Path is not a file:', modelPath);
          throw error;
        }

        // Verify file is not empty
        if (stat.size === 0) {
          const error = new Error(`Embedding model file is empty (0 bytes): ${modelPath}`);
          Logger.error('[EmbedModel] ❌ Model file is empty:', modelPath);
          throw error;
        }

        Logger.info('[EmbedModel] ✅ Model file validated:', {
          path: modelPath,
          size: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
          exists: true,
        });
      } catch (fsError) {
        Logger.error('[EmbedModel] ❌ File validation failed:', fsError);
        throw new Error(
          `Cannot load embedding model - file validation failed: ${fsError instanceof Error ? fsError.message : String(fsError)}`
        );
      }

      // Initialize a SEPARATE llama context for embeddings
      this.embeddingContext = await initLlama({
        model: modelPath,
        embedding: true, // Enable embedding mode
        use_mlock: false, // Disabled: iOS memory constraints
        use_mmap: true,   // Memory mapping for efficient loading
        n_ctx: 512, // Small context for embeddings
        n_parallel: 4, // Enable parallel mode for isolated sequence slots
      });

      // Enable parallel mode to isolate embeddings and prevent KV cache pollution
      try {
        await this.embeddingContext.parallel.enable({n_parallel: 4});
        Logger.info('[EmbedModel] Parallel mode enabled for isolated embeddings');
      } catch (parallelError) {
        Logger.warn('[EmbedModel] Failed to enable parallel mode:', parallelError);
        // Fallback to regular embedding mode if parallel not available
      }

      this.embeddingModelPath = modelPath;
      this.embeddingModelName = modelName;
      this.embeddingInitialized = true;

      Logger.info('[EmbedModel] ✅ Embedding model loaded successfully');
      Logger.info('[EmbedModel] Chat model:', this.currentModelName || 'none');
      Logger.info('[EmbedModel] Embed model:', this.embeddingModelName);
      Logger.info('[EmbedModel] 🎉 DUAL INSTANCE MODE ACTIVE!');
    } catch (error) {
      Logger.error('[EmbedModel] Failed to load:', error);
      this.embeddingInitialized = false;
      throw error;
    }
  }

  /**
   * Release the embedding model (keeps chat model running)
   */
  static async releaseEmbeddingModel(): Promise<void> {
    if (this.embeddingContext) {
      try {
        await this.embeddingContext.release();
        Logger.info('[EmbedModel] Embedding context released');
      } catch (error) {
        Logger.error('[EmbedModel] Failed to release:', error);
      }
      this.embeddingContext = null;
      this.embeddingModelPath = null;
      this.embeddingModelName = null;
      this.embeddingInitialized = false;
    }
  }

  /**
   * Release the current chat model and free resources
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
   * Force reload the model (useful for interrupting stuck generations)
   * This releases and reloads the model to get a fresh context
   */
  static async forceReloadModel(): Promise<void> {
    const modelPath = this.currentModelPath;
    const modelName = this.currentModelName;

    if (!modelPath || !modelName) {
      throw new Error('No model currently loaded to reload');
    }

    Logger.info('🔄 Force reloading model:', modelName);

    // Release current context (this may hang if generation is stuck)
    await this.releaseModel();

    // Reload with same model
    await this.loadModel(modelPath, modelName);

    Logger.info('✅ Model force-reloaded successfully');
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
        // Use model's actual context size from modelConfig, not the default
        contextSize: this.modelConfig?.contextSize ?? DEFAULT_LLAMA_CONFIG.contextSize,
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
   * Generate chat completion with message history.
   * Prefers the GGUF's embedded Jinja chat template (jinja=true) so special
   * tokens, BOS/EOS, and system-role handling are correct per model.
   * Falls back to the hand-rolled getChatTemplate if the native path rejects
   * the messages (e.g. GGUF lacks chat_template metadata).
   */
  static async chatCompletion(
    messages: Message[],
    config: Partial<LlamaConfig> = {},
    onToken?: (token: string) => void,
  ): Promise<string> {
    if (!this.context || !this.currentModelName) {
      throw new Error('Model not loaded');
    }

    const llamaConfig = {
      ...DEFAULT_LLAMA_CONFIG,
      contextSize: this.modelConfig?.contextSize ?? DEFAULT_LLAMA_CONFIG.contextSize,
      ...config,
    };

    const chatMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const completionParams = {
      n_predict: llamaConfig.maxTokens,
      temperature: llamaConfig.temperature,
      top_p: llamaConfig.topP,
      top_k: llamaConfig.topK,
      stop: llamaConfig.stopSequences,
    };

    try {
      Logger.debug('Chat completion via embedded jinja template:', this.currentModelName);

      let fullResponse = '';
      const result = await this.context.completion(
        {
          ...completionParams,
          messages: chatMessages,
          jinja: true,
        },
        data => {
          if (data.token && onToken) {
            onToken(data.token);
            fullResponse += data.token;
          }
        },
      );

      if (!fullResponse && result.text) {
        fullResponse = result.text;
      }

      const trimmed = fullResponse.trim();
      return this.thinkingEnabled ? trimmed : this.stripThinkingBlocks(trimmed);
    } catch (jinjaError) {
      Logger.warn(
        'Jinja chat path failed, falling back to manual template:',
        jinjaError instanceof Error ? jinjaError.message : String(jinjaError),
      );

      try {
        const prompt = getChatTemplate(this.currentModelName, chatMessages);
        const fallback = await this.completion(prompt, config, onToken);
        return this.thinkingEnabled ? fallback : this.stripThinkingBlocks(fallback);
      } catch (error) {
        Logger.error('Chat completion error:', error);
        throw error;
      }
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
   * Generate embedding vector for text
   * Uses the dedicated embedding model instance
   *
   * CRITICAL: Uses parallel.embedding() to isolate each embedding in its own
   * sequence slot. This prevents KV cache pollution where tokens from previous
   * embeddings would affect subsequent ones, causing semantic drift.
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingContext) {
      throw new Error('Embedding model not loaded. Call loadEmbeddingModel() first.');
    }

    try {
      Logger.debug(`[EmbedModel] Generating embedding for: ${text.substring(0, 50)}...`);

      // Use parallel mode to isolate each embedding in its own sequence slot
      // This prevents KV cache pollution from affecting results
      const {promise} = await this.embeddingContext.parallel.embedding(text);
      const result = await promise;

      Logger.debug(`[EmbedModel] Generated: ${result.embedding.length} dimensions`);

      // CRITICAL: Copy the embedding to avoid buffer reuse issues!
      // The embedding context may return a reusable Float32Array buffer
      // that gets overwritten on the next call. We need our own copy.
      const embeddingCopy: number[] = Array.isArray(result.embedding)
        ? [...result.embedding]
        : Array.from(result.embedding);
      return embeddingCopy;
    } catch (error) {
      Logger.error('[EmbedModel] Generation error:', error);
      throw error;
    }
  }

  /**
   * Check if embedding model is loaded
   */
  static isEmbeddingModelLoaded(): boolean {
    return this.embeddingInitialized && this.embeddingContext !== null;
  }

  /**
   * Get embedding model info
   */
  static getEmbeddingModelInfo(): {path: string; name: string} | null {
    if (!this.embeddingModelPath || !this.embeddingModelName) {
      return null;
    }
    return {
      path: this.embeddingModelPath,
      name: this.embeddingModelName,
    };
  }

  /**
   * Check if current model supports embeddings (legacy)
   * Embedding models typically have "embed" in their name
   */
  static isEmbeddingModel(): boolean {
    if (!this.currentModelName) {
      return false;
    }
    const name = this.currentModelName.toLowerCase();
    return name.includes('embed') || name.includes('embedding');
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
   * Enable or disable smart tool detection (skips Layer 2 keyword triggers)
   */
  static setSmartToolDetection(enabled: boolean): void {
    this.smartToolDetection = enabled;
    Logger.info(`🧠 Smart tool detection: ${enabled ? 'ON (LLM decides)' : 'OFF (keyword triggers active)'}`);
  }

  static isSmartToolDetection(): boolean {
    return this.smartToolDetection;
  }

  /**
   * Enable or disable thinking mode. When disabled, chain-of-thought blocks
   * emitted by the model (Gemma 4 `<|channel>thought...<channel|>`, DeepSeek
   * `<think>...</think>`, etc.) are stripped from the final response.
   */
  static setThinkingEnabled(enabled: boolean): void {
    this.thinkingEnabled = enabled;
    Logger.info(`🧠 Thinking mode: ${enabled ? 'ON (pass-through)' : 'OFF (strip thoughts)'}`);
  }

  static isThinkingEnabled(): boolean {
    return this.thinkingEnabled;
  }

  /**
   * Remove chain-of-thought blocks from model output.
   * Covers Gemma 4 channel syntax plus common <think>/<thinking>/<thought> tags.
   */
  private static stripThinkingBlocks(text: string): string {
    if (!text) return text;
    let out = text;
    // Gemma 4: <|channel>thought ... <channel|>
    out = out.replace(/<\|channel>thought[\s\S]*?<channel\|>/g, '');
    // <think>...</think>, <thinking>...</thinking>, <thought>...</thought>
    out = out.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');
    out = out.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
    return out.trim();
  }

  /**
   * Get last model reasoning for display
   */
  static getLastReasoning(): string {
    return this.lastReasoning;
  }

  /**
   * Get full system prompt text (for debugging/viewing)
   */
  static getFullSystemPrompt(): string {
    return this.getToolSystemPrompt();
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 chars)
   */
  static estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get context usage stats
   */
  static getContextStats(messages: Message[]): {
    contextSize: number;
    systemPromptTokens: number;
    messagesTokens: number;
    totalTokens: number;
    remainingTokens: number;
    usagePercent: number;
  } {
    const modelConfig = this.modelConfig || getModelConfig(this.currentModelName || '');
    const contextSize = modelConfig.contextSize;

    const systemPrompt = this.getToolSystemPrompt();
    const systemPromptTokens = this.estimateTokenCount(systemPrompt);

    const messagesText = messages.map(m => m.content).join('');
    const messagesTokens = this.estimateTokenCount(messagesText);

    const totalTokens = systemPromptTokens + messagesTokens;
    const remainingTokens = contextSize - totalTokens;
    const usagePercent = (totalTokens / contextSize) * 100;

    return {
      contextSize,
      systemPromptTokens,
      messagesTokens,
      totalTokens,
      remainingTokens,
      usagePercent,
    };
  }

  /**
   * Get system prompt with tool definitions
   * Uses configurable prompt variants for testing
   */
  private static getToolSystemPrompt(): string {
    // 'none' prompt variant: bypass everything for raw base-model testing
    if (this.currentPromptType === 'none') {
      return '';
    }

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

    // Compact JSON - no pretty printing to save ~50% tokens
    const toolsJson = JSON.stringify(toolSchemas);

    // Use selected prompt variant
    const promptConfig = SYSTEM_PROMPTS[this.currentPromptType];
    Logger.debug('Building system prompt with smartToolDetection:', this.smartToolDetection);
    return promptConfig.getPrompt(coreMemory, toolsJson, needsExamples, this.smartToolDetection);
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

    // Compact JSON - no pretty printing to save tokens
    const toolsJson = JSON.stringify(toolSchemas);

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
   * Execute a tool directly (triggered without model) and generate a natural language response.
   * Used by trigger-word handlers so the model narrates the result instead of returning raw JSON.
   */
  private static async runTriggerTool(
    toolName: string,
    toolArgs: Record<string, any>,
    messages: Message[],
    config: Partial<LlamaConfig>,
    onToken?: (token: string) => void,
    onToolUsage?: (
      stage: 'tool_call' | 'tool_result' | 'generating',
      toolName?: string,
      toolArgs?: Record<string, any>,
      toolResult?: any,
    ) => void,
  ): Promise<{response: string; usedTool: boolean; toolName: string}> {
    onToolUsage?.('tool_call', toolName, toolArgs);

    const toolResult = await ToolService.executeTool({
      id: generateId(),
      name: toolName,
      arguments: toolArgs,
    });

    onToolUsage?.('tool_result', toolName, toolArgs, toolResult);

    if (toolResult.error) {
      return {response: `Tool error: ${toolResult.error}`, usedTool: true, toolName};
    }

    // Build prompt context so the model can give a natural answer
    const systemPrompt = this.getToolSystemPrompt();
    const systemMessage: Message = {
      id: 'system-tools',
      role: 'system',
      content: systemPrompt,
      timestamp: Date.now(),
    };
    const toolResultMessage: Message = {
      id: 'tool-result',
      role: 'system',
      content: `RESULT: ${JSON.stringify(toolResult.result)}\n\nRespond naturally using this data. NO tool syntax.`,
      timestamp: Date.now(),
    };

    onToolUsage?.('generating');

    const modelConfig = this.modelConfig || getModelConfig(this.currentModelName || '');
    const finalResponseConfig = {
      ...config,
      temperature: config.temperature ?? Math.min(modelConfig.toolDetectionTemp * 1.5, 0.7),
    };

    const finalResponse = await this.chatCompletion(
      [systemMessage, ...messages, toolResultMessage],
      finalResponseConfig,
      onToken,
    );

    return {
      response: this.filterToolJson(finalResponse),
      usedTool: true,
      toolName,
    };
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
    Logger.debug('🔍 extractToolCall input:', text.substring(0, 300));

    // FIRST: Try XML self-closing tag format (8B model native format)
    // Example: <archival_memory_insert content="text" tags=["tag1", "tag2"] />
    // Also supports parameterless: <get_current_datetime />
    // Match everything between <tool_name and />, handling paths with slashes
    const xmlPattern = /<([\w_]+)((?:\s+[\w_]+\s*=\s*(?:"[^"]*"|'[^']*'|\[[^\]]*\]))*)\s*\/>/;
    const xmlMatch = xmlPattern.exec(text);

    if (xmlMatch) {
      const functionName = xmlMatch[1];
      const attrsString = xmlMatch[2]; // May be undefined/empty for parameterless tools
      Logger.debug('✅ Found XML format tool:', functionName);
      Logger.debug('Attributes string:', attrsString || '(none)');

      // Parse XML attributes (if any)
      const args: Record<string, any> = {};
      if (attrsString && attrsString.trim()) {
        // Match: attr="value" or attr=["array", "items"]
        // The pattern now handles values with slashes, quotes, etc.
        const attrPattern = /([\w_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\[([^\]]*)\])/g;
        let attrMatch;
        while ((attrMatch = attrPattern.exec(attrsString)) !== null) {
          const key = attrMatch[1];
          if (attrMatch[2] !== undefined) {
            // Double-quoted string (handles paths with / like "Books/File.md")
            args[key] = attrMatch[2];
          } else if (attrMatch[3] !== undefined) {
            // Single-quoted string
            args[key] = attrMatch[3];
          } else if (attrMatch[4] !== undefined) {
            // Array: ["item1", "item2"]
            const arrayContent = attrMatch[4];
            const arrayItems = arrayContent.split(',').map(item => {
              const trimmed = item.trim();
              return trimmed.replace(/^["']|["']$/g, '');
            }).filter(item => item.length > 0);
            args[key] = arrayItems;
          }
        }
      }

      Logger.debug('Parsed XML args:', args);
      return JSON.stringify({name: functionName, arguments: args});
    }

    // SECOND: Try Pythonic bracket format: [function_name(param1="val1", param2="val2")]
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

    // THIRD: Try no-argument bracket format: [tool_name] (model omits parens for no-arg tools)
    const noArgBracketPattern = /\[([\w_]+)\]/;
    const noArgMatch = noArgBracketPattern.exec(text);
    if (noArgMatch) {
      const functionName = noArgMatch[1];
      // Accept the match — if tool doesn't exist, it will fail gracefully during execution
      Logger.debug('✅ Found no-arg bracket format tool:', functionName);
      return JSON.stringify({name: functionName, arguments: {}});
    }

    // FOURTH: Try non-bracket Pythonic format (when model outputs reasoning + tool call without brackets)
    // Pattern: tool_name(param="value", ...)
    const nonBracketPattern = /\n\s*([\w_]+)\((.*?)\)(?:\n|$)/s;
    const nonBracketMatch = nonBracketPattern.exec(text);

    if (nonBracketMatch) {
      const functionName = nonBracketMatch[1];
      const argsString = nonBracketMatch[2];
      Logger.debug('✅ Found non-bracket Pythonic format tool:', functionName);

      // Parse arguments (same logic as bracket format)
      const args: Record<string, any> = {};
      if (argsString.trim()) {
        const argPattern = /([\w_]+)\s*=\s*(?:["']([^"']*)["']|\[([^\]]*)\]|(\w+)|(\d+))/g;
        let argMatch;
        while ((argMatch = argPattern.exec(argsString)) !== null) {
          const key = argMatch[1];
          if (argMatch[2] !== undefined) {
            args[key] = argMatch[2];
          } else if (argMatch[3] !== undefined) {
            const arrayContent = argMatch[3];
            const arrayItems = arrayContent.split(',').map(item => {
              const trimmed = item.trim();
              return trimmed.replace(/^["']|["']$/g, '');
            }).filter(item => item.length > 0);
            args[key] = arrayItems;
          } else if (argMatch[4] !== undefined) {
            const word = argMatch[4];
            if (word === 'True' || word === 'true') args[key] = true;
            else if (word === 'False' || word === 'false') args[key] = false;
            else if (word === 'None' || word === 'null') args[key] = null;
            else args[key] = word;
          } else if (argMatch[5] !== undefined) {
            args[key] = parseInt(argMatch[5], 10);
          }
        }
      }

      return JSON.stringify({name: functionName, arguments: args});
    }

    // Fall back to old XML format for backwards compatibility
    const tagPattern = /<function_call>\s*(\{[\s\S]*?\})\s*<\/function_call>/;
    const tagMatch = tagPattern.exec(text);
    if (tagMatch) {
      return tagMatch[1];
    }

    // FIFTH: Try any valid JSON that has "name" or "tool" or "type": "function"
    // Handles: {"name": "...", "arguments": {...}} or {"type": "function", "name": "...", "parameters": {...}}
    // Look for JSON blocks more carefully
    const jsonStartIndex = text.indexOf('{');
    if (jsonStartIndex !== -1) {
      let braceCount = 0;
      let jsonEndIndex = -1;

      for (let i = jsonStartIndex; i < text.length; i++) {
        if (text[i] === '{') braceCount++;
        else if (text[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEndIndex = i;
            break;
          }
        }
      }

      if (jsonEndIndex !== -1) {
        const potentialJson = text.substring(jsonStartIndex, jsonEndIndex + 1);
        try {
          const parsed = JSON.parse(potentialJson);

          // Handle OpenAI format: {"type": "function", "name": "...", "parameters": {...}}
          if (parsed.type === 'function' && parsed.name) {
            Logger.debug('✅ Found OpenAI JSON function format:', parsed.name);
            return JSON.stringify({
              name: parsed.name,
              arguments: parsed.parameters || {},
            });
          }

          // Handle our format: {"name": "...", "arguments": {...}}
          if (parsed.name) {
            Logger.debug('✅ Found standard JSON format:', parsed.name);
            return JSON.stringify({
              name: parsed.name,
              arguments: parsed.arguments || {},
            });
          }

          // Handle old format: {"tool": "...", ...}
          if (parsed.tool) {
            Logger.debug('✅ Found legacy tool format:', parsed.tool);
            return JSON.stringify({
              name: parsed.tool,
              arguments: parsed.arguments || {},
            });
          }
        } catch (e) {
          Logger.debug('Failed to parse JSON block:', (e as Error).message);
        }
      }
    }

    // Last resort: try raw JSON pattern
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
    onToolUsage?: (
      stage: 'tool_call' | 'tool_result' | 'generating',
      toolName?: string,
      toolArgs?: Record<string, any>,
      toolResult?: any
    ) => void,
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
    // Skipped when smartToolDetection is enabled (LLM always decides in that mode)
    if (userMessage && !this.smartToolDetection) {
      const lowerContent = userMessage.content.toLowerCase();

      // VAULT FILE SEARCH TRIGGER (must run before web search to prevent false positives)
      // Handles: "where is X.md", "find X.md", queries containing a .md filename
      const hasMdFile = /\b[\w\s-]+\.md\b/i.test(userMessage.content);
      const isWhereQuery = lowerContent.includes('where is') || lowerContent.includes('where can i find');
      if ((hasMdFile || isWhereQuery) && this.availableTools.some(t => t.name === 'search_vault')) {
        // Extract the filename/search term
        let searchQuery = userMessage.content;
        // Match Title Case filename (e.g. "Vector Search.md") — uppercase words only, avoids sentence prefixes
        // Fallback to single lowercase word filename (e.g. "readme.md")
        const mdMatch = userMessage.content.match(/\b([A-Z][\w-]*(?:\s+[A-Z][\w-]*)*\.md)\b/) ||
                        userMessage.content.match(/\b([\w-]+\.md)\b/i);
        if (mdMatch) {
          searchQuery = mdMatch[1].trim();
        } else {
          searchQuery = searchQuery.replace(/^(where is|where can i find|find|locate)\s+/i, '').replace(/\?.*$/, '').trim();
        }
        Logger.info(`🔍 VAULT FILE SEARCH TRIGGER - Searching vault for: "${searchQuery}"`);
        return await this.runTriggerTool('search_vault', {query: searchQuery}, messages, config, onToken, onToolUsage);
      }

      // VAULT FILES IN FOLDER TRIGGER
      // Handles: "what files are in [folder]", "files in [folder]", "list files in [folder]"
      const filesInFolderMatch = lowerContent.match(/(?:what files|list files|files)\s+(?:are\s+)?(?:in|inside)\s+(?:the\s+)?([a-z0-9 _-]+?)(?:\s+folder)?(?:\s*\?|$)/i);
      if (filesInFolderMatch && this.availableTools.some(t => t.name === 'list_vault_files')) {
        const folderName = filesInFolderMatch[1].trim();
        Logger.info(`📂 VAULT FILES IN FOLDER TRIGGER - Listing files in: "${folderName}"`);
        return await this.runTriggerTool('list_vault_files', {folder: folderName}, messages, config, onToken, onToolUsage);
      }

      // Detect vault-related queries to suppress false web search triggers
      const isVaultQuery = lowerContent.includes('vault') || lowerContent.includes('note') || lowerContent.includes('folder') || hasMdFile;

      const triggerWords = ['search', 'find', 'news', 'latest', 'headlines', 'trending', "what's happening", 'current events'];
      const hasTrigger = triggerWords.some(word => lowerContent.includes(word));

      if (hasTrigger && !isVaultQuery && this.availableTools.some(t => t.name === 'search_web')) {
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
        const toolArgs = {query};
        onToolUsage?.('tool_call', 'search_web', toolArgs);

        const toolResult = await ToolService.executeTool({
          id: generateId(),
          name: 'search_web',
          arguments: toolArgs,
        });

        Logger.info('🔧 Tool execution result:', toolResult);

        onToolUsage?.('tool_result', 'search_web', toolArgs, toolResult);

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

      // DATETIME TRIGGER: Bypass model for time/date queries
      const datetimeTriggers = ['what time', 'what date', 'current time', 'current date', "what's the time", "what's today", "what day is", 'time is it', 'date is it', 'date today'];
      const hasDatetimeTrigger = datetimeTriggers.some(w => lowerContent.includes(w));
      if (hasDatetimeTrigger && this.availableTools.some(t => t.name === 'get_current_datetime')) {
        Logger.info('🕐 DATETIME TRIGGER DETECTED - Forcing get_current_datetime call');
        return await this.runTriggerTool('get_current_datetime', {}, messages, config, onToken, onToolUsage);
      }

      // VAULT LISTING TRIGGER: Bypass model for vault structure queries (folders only)
      const vaultListTriggers = ['what folders', 'list folders', 'vault structure', 'folders in my vault', 'folders in the vault'];
      const hasVaultListTrigger = vaultListTriggers.some(w => lowerContent.includes(w));
      if (hasVaultListTrigger && this.availableTools.some(t => t.name === 'list_vault_structure')) {
        Logger.info('📁 VAULT LIST TRIGGER DETECTED - Forcing list_vault_structure call');
        return await this.runTriggerTool('list_vault_structure', {}, messages, config, onToken, onToolUsage);
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

      // Skip system message injection when prompt is empty ('none' variant)
      // so the model receives raw user turns only - useful for diagnosing
      // whether garbage output stems from prompt or from model/quant.
      const messagesWithTools: Message[] = systemPrompt
        ? [
            {
              id: 'system-tools',
              role: 'system',
              content: systemPrompt,
              timestamp: Date.now(),
            },
            ...messages,
          ]
        : [...messages];

      // First LLM call - check if it wants to use a tool
      // Use model-specific temperature and maxTokens
      // Don't stream to UI during tool detection phase
      const modelConfig = this.modelConfig || getModelConfig(this.currentModelName || '');

      // Allow config to override model defaults for testing
      const toolDetectionConfig = {
        ...config,
        temperature: config.toolDetectionTemp ?? modelConfig.toolDetectionTemp, // Use override if provided
        topP: config.topP ?? 0.9,
        maxTokens: config.toolDetectionMaxTokens ?? modelConfig.toolDetectionMaxTokens, // Use override if provided
      };

      Logger.debug('🎯 Tool detection config:', {
        modelType: modelConfig.type,
        temperature: toolDetectionConfig.temperature,
        maxTokens: toolDetectionConfig.maxTokens,
        overridesUsed: {
          temp: config.toolDetectionTemp !== undefined,
          maxTokens: config.toolDetectionMaxTokens !== undefined,
        },
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
        // Model decided not to use a tool - store its response as reasoning
        const reasoning = firstResponse.substring(0, 300).trim();
        this.lastReasoning = reasoning;
        Logger.info('💭 Model decision (no tool):', reasoning.replace(/\s+/g, ' '));

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
            const overrideArgs = {query};
            onToolUsage?.('tool_call', 'search_web', overrideArgs);

            const toolResult = await ToolService.executeTool({
              id: generateId(),
              name: 'search_web',
              arguments: overrideArgs,
            });

            Logger.info('🔧 Override tool result:', toolResult);
            onToolUsage?.('tool_result', 'search_web', overrideArgs, toolResult);

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

      // Extract reasoning text (everything before the tool call)
      // Try to find text before [ or < (bracket or XML format)
      let reasoning = '';
      const pythonMatch = firstResponse.match(/^([\s\S]*?)\[[\w_]+/);
      const xmlMatch = firstResponse.match(/^([\s\S]*?)<[\w_]+/);

      if (pythonMatch) {
        reasoning = pythonMatch[1].trim();
      } else if (xmlMatch) {
        reasoning = xmlMatch[1].trim();
      } else {
        // Fallback: try first 200 chars if no clear tool marker
        reasoning = firstResponse.substring(0, 200).trim();
      }

      // Clean up reasoning: remove extra whitespace, keep key thoughts
      reasoning = reasoning.replace(/\s+/g, ' ').trim();

      this.lastReasoning = reasoning.substring(0, 300); // Store up to 300 chars for UI
      Logger.info('💭 Model reasoning:', reasoning.substring(0, 350));
      Logger.debug('Full reasoning stored:', this.lastReasoning);

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

        Logger.info(`✅ Decided to use tool: ${toolName} with args:`, toolArgs);

        // Notify UI: tool is being called
        if (onToolUsage) {
          onToolUsage('tool_call', toolName, toolArgs);
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
          onToolUsage('tool_result', toolName, toolArgs, toolResult);
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
        // Use compact JSON to save tokens
        const toolResultMessage: Message = {
          id: 'tool-result',
          role: 'system',
          content: `RESULT: ${JSON.stringify(toolResult.result)}\n\nRespond naturally using this data. NO tool syntax.`,
          timestamp: Date.now(),
        };

        // Notify UI: generating final response
        if (onToolUsage) {
          onToolUsage('generating');
        }

        // Build config for final response generation
        // If no temperature specified, use model-appropriate default (slightly higher than tool detection)
        const modelConfig = this.modelConfig || getModelConfig(this.currentModelName || '');
        const finalResponseConfig = {
          ...config,
          temperature: config.temperature ?? Math.min(modelConfig.toolDetectionTemp * 1.5, 0.7), // Use 1.5x tool detection temp, capped at 0.7
        };

        Logger.info('🎯 Generating final response with tool results...');
        Logger.debug('Final response temperature:', finalResponseConfig.temperature);
        const finalResponse = await this.chatCompletion(
          [...messagesWithTools, toolResultMessage],
          finalResponseConfig,
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
