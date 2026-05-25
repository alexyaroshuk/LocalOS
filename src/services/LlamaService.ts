/**
 * Service for managing llama.cpp model inference
 */
import {initLlama, loadLlamaModelInfo, LlamaContext} from 'llama.rn';
import {Platform} from 'react-native';
import RNFS from 'react-native-fs';
import {LlamaConfig, Message, MessageTimings, Tool} from '../types';
import {DEFAULT_LLAMA_CONFIG} from '../utils/constants';
import {getChatTemplate, generateId, stripStopwords} from '../utils/helpers';
import {ToolService} from './ToolService';
import {Logger} from '../utils/Logger';
import {getModelConfig, ModelConfig} from '../types/modelConfig';
import {SYSTEM_PROMPTS, SystemPromptType} from './SystemPrompts';
import {PromptBuilder, TOKEN_BUDGETS} from './PromptBuilder';

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

  /** Pending vault write awaiting user confirmation. The preflight write-intent
   * flow stores a proposal here; the next user message of the form "yes/save it"
   * commits it. Cleared after commit or after a non-confirm message. */
  private static pendingProposal: {path: string; content: string; mode: 'create' | 'update' | 'append'} | null = null;
  private static thinkingEnabled: boolean = false; // When false, strip chain-of-thought blocks from output
  // Timings from the most recent context.completion() call. Read by
  // chatCompletionWithTimings / chatCompletionWithTools to surface pocketpal-style
  // stats (ms/token, tokens/sec, TTFT) under assistant bubbles.
  private static lastTimings: MessageTimings | undefined;

  // Serializes all load/release operations — prevents races when user switches models rapidly.
  private static contextOperationMutex: Promise<void> = Promise.resolve();
  // Tracks the in-flight context.completion() promise so release can wait for it.
  private static activeCompletionPromise: Promise<any> | null = null;
  private static isInferencing: boolean = false;
  // Last-one-wins: path of the most recently requested model load.
  private static pendingModelId: string | null = null;

  // Build a MessageTimings object from llama.rn's native result + client-measured TTFT.
  private static buildTimings(
    nativeTimings: any,
    ttftMs: number | undefined,
  ): MessageTimings | undefined {
    if (!nativeTimings && ttftMs == null) return undefined;
    const t = nativeTimings ?? {};
    return {
      predicted_per_token_ms: t.predicted_per_token_ms,
      predicted_per_second: t.predicted_per_second,
      predicted_n: t.predicted_n,
      prompt_n: t.prompt_n,
      prompt_ms: t.prompt_ms,
      time_to_first_token_ms: ttftMs,
    };
  }

  // Stop active completion, await it, then release the context.
  // Called inside the mutex — do NOT call through loadModel/releaseModel public APIs.
  private static async _releaseInternal(): Promise<void> {
    if (!this.context) return;

    if (this.isInferencing || this.activeCompletionPromise) {
      Logger.info('Stopping active completion before context release');
      try {
        await this.context.stopCompletion();
      } catch (stopErr) {
        // Expected if native layer is already torn down
        Logger.warn('stopCompletion threw during release (expected if native crashed):', stopErr);
      }
      if (this.activeCompletionPromise) {
        Logger.info('Waiting for in-flight completion to settle...');
        try { await this.activeCompletionPromise.catch(() => {}); } catch {}
      }
      this.isInferencing = false;
      this.activeCompletionPromise = null;
    }

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

    // Give the native layer time to fully free resources before reinit.
    Logger.debug('Context released, waiting 100ms before next init');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Wraps context.completion() to track the active promise for safe release.
  private static async _runCompletion<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isInferencing) {
      throw new Error('A completion is already in progress. Wait for it to finish before starting another.');
    }
    if (!this.context) {
      throw new Error('Model not loaded');
    }
    this.isInferencing = true;
    const promise = fn();
    this.activeCompletionPromise = promise as Promise<any>;
    try {
      return await promise;
    } finally {
      this.activeCompletionPromise = null;
      this.isInferencing = false;
    }
  }

  /**
   * Initialize and load a model
   */
  static async loadModel(
    modelPath: string,
    modelName: string,
    config: Partial<LlamaConfig> = {},
  ): Promise<void> {
    this.pendingModelId = modelPath;

    const operationPromise = this.contextOperationMutex.then(async () => {
      // Last-one-wins: skip if a newer load was requested while we waited
      if (this.pendingModelId !== modelPath) {
        Logger.info('Skipping outdated load for:', modelPath);
        return;
      }

    try {
      await this._releaseInternal();

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

        const fileSizeMB = stat.size / (1024 * 1024);
        Logger.info('✅ Model file validated:', {
          path: modelPath,
          size: `${fileSizeMB.toFixed(2)} MB`,
          exists: true,
        });

        // Warn for large models — iOS per-app memory is typically 2-3GB.
        // Model needs ~1.2× its file size in RAM.
        const estimatedRAMBytes = stat.size * 1.2;
        const WARN_THRESHOLD = 2 * 1024 * 1024 * 1024; // 2 GB
        if (estimatedRAMBytes > WARN_THRESHOLD) {
          Logger.warn(
            `⚠️ Large model: estimated RAM ~${(estimatedRAMBytes / (1024 ** 3)).toFixed(1)} GB. ` +
            'May exceed iOS per-app memory limit and crash.'
          );
        }
      } catch (fsError) {
        Logger.error('❌ File validation failed:', fsError);
        throw new Error(
          `Cannot load model - file validation failed: ${fsError instanceof Error ? fsError.message : String(fsError)}`
        );
      }

      // Lightweight pre-validation: reads GGUF metadata without full init.
      // Catches corrupt/truncated files before they cause a native SIGSEGV.
      try {
        await loadLlamaModelInfo(modelPath);
        Logger.info('✅ GGUF metadata readable');
      } catch (metaErr) {
        Logger.error('❌ GGUF metadata read failed — model file may be corrupt:', metaErr);
        throw new Error(
          `Model file failed metadata check (possibly corrupt or incomplete): ` +
          `${metaErr instanceof Error ? metaErr.message : String(metaErr)}`
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
        contextSize: this.modelConfig.contextSize,
        ...config,
      };

      // Enforce batch size constraints: n_batch ≤ n_ctx, n_ubatch ≤ n_batch.
      // Violating these causes undefined native behavior.
      const nCtx = llamaConfig.contextSize;
      const nBatch = Math.min(512, nCtx);
      const nUBatch = Math.min(512, nBatch);

      Logger.info('🚀 Initializing model with context size:', nCtx);

      this.context = await initLlama({
        model: modelPath,
        n_ctx: nCtx,
        n_batch: nBatch,
        n_ubatch: nUBatch,
        n_gpu_layers: llamaConfig.nGpuLayers,
        use_mlock: false,
        use_mmap: true,
        // Matches pocketpal: lets Metal/Vulkan auto-select optimised attention kernel.
        flash_attn_type: Platform.OS === 'ios' ? 'auto' : 'off',
      });

      this.currentModelPath = modelPath;
      this.currentModelName = modelName;
      this.isInitialized = true;

      // Apply model-specific settings
      this.useLangchainPrompt = this.modelConfig.useLangchainPrompt;

      Logger.info('✅ Model loaded successfully:', modelName);
      Logger.info(`   Using ${this.modelConfig.displayName} configuration`);
      Logger.info(`   Context window: ${llamaConfig.contextSize} tokens`);

      // Diagnostic: report the GGUF's chat-template capabilities so we know
      // whether the embedded jinja template can serialize OpenAI `tools`
      // into Gemma 4 / Llama 3.1 native tool DSL.
      try {
        const m: any = (this.context as any)?.model;
        const caps = m?.chatTemplates?.jinja?.defaultCaps;
        Logger.info('📋 Chat template caps:', {
          llamaChat: m?.chatTemplates?.llamaChat,
          jinjaDefault: m?.chatTemplates?.jinja?.default,
          toolUse: m?.chatTemplates?.jinja?.toolUse,
          tools: caps?.tools,
          toolCalls: caps?.toolCalls,
          systemRole: caps?.systemRole,
          parallelToolCalls: caps?.parallelToolCalls,
          isChatTemplateSupported: m?.isChatTemplateSupported,
        });
        if (caps && !caps.tools) {
          Logger.warn('⚠️ Loaded GGUF chat template does NOT declare tool support. Native agent loop will not receive tools — model may emit plain text instead of <|tool_call>.');
        }
      } catch (capErr) {
        Logger.debug('Chat template caps inspection failed:', capErr);
      }
    } catch (error) {
      Logger.error('Failed to load model:', error);
      this.isInitialized = false;
      throw error;
    }
    }); // end contextOperationMutex.then

    this.contextOperationMutex = operationPromise.catch(() => {});
    return operationPromise;
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
    this.pendingModelId = null;
    const operationPromise = this.contextOperationMutex.then(() => this._releaseInternal());
    this.contextOperationMutex = operationPromise.catch(() => {});
    return operationPromise;
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
      const t0 = Date.now();
      let ttftMs: number | undefined;

      // Use completion API with streaming
      const result = await this._runCompletion(() => this.context!.completion(
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
          if (data.token) {
            if (ttftMs === undefined) ttftMs = Date.now() - t0;
            if (onToken) onToken(data.token);
            fullResponse += data.token;
          }
        },
      ));

      // If streaming didn't capture the response, use the result
      if (!fullResponse && result.text) {
        fullResponse = result.text;
      }

      this.lastTimings = this.buildTimings((result as any).timings, ttftMs);

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

    // Per-model stop words override the default array when present.
    // Prevents leakage of next-turn markers like `<turn|>` for Gemma 4.
    const stop = this.modelConfig?.stopWords ?? llamaConfig.stopSequences;

    const completionParams = {
      n_predict: llamaConfig.maxTokens,
      temperature: llamaConfig.temperature,
      top_p: llamaConfig.topP,
      top_k: llamaConfig.topK,
      stop,
      // Let llama.rn split reasoning from answer server-side so we never
      // see thinking markers in the streamed `content` field.
      enable_thinking: this.thinkingEnabled,
      ...(this.thinkingEnabled ? {reasoning_format: 'auto' as const} : {}),
    };

    try {
      Logger.debug('Chat completion via embedded jinja template:', this.currentModelName);

      // Stream from `data.content` (cumulative clean answer) instead of
      // `data.token` (raw tokens that include special markers). This matches
      // pocketpal-ai's approach and avoids regex stripping on the hot path.
      let prevContent = '';
      let prevReasoning = '';
      const t0 = Date.now();
      let ttftMs: number | undefined;

      const result = await this._runCompletion(() => this.context!.completion(
        {
          ...completionParams,
          messages: chatMessages,
          jinja: true,
        },
        data => {
          const content = data.content ?? '';
          if (content.length > prevContent.length) {
            const delta = content.slice(prevContent.length);
            prevContent = content;
            if (delta) {
              if (ttftMs === undefined) ttftMs = Date.now() - t0;
              if (onToken) onToken(delta);
            }
          }

          // Forward reasoning deltas only if thinking explicitly enabled.
          // Otherwise discard - reasoning_content stays out of the chat UI.
          if (this.thinkingEnabled) {
            const reasoning = data.reasoning_content ?? '';
            if (reasoning.length > prevReasoning.length) {
              prevReasoning = reasoning;
              // Reasoning surfaced via lastReasoning for diagnostic UI;
              // intentionally not pushed to onToken to keep answer stream clean.
              this.lastReasoning = reasoning;
            }
          }
        },
      ));

      this.lastTimings = this.buildTimings((result as any).timings, ttftMs);

      // Prefer `result.content` (post-filter answer) over `result.text` (raw).
      // Fall back to accumulated stream content, then text.
      const finalText = (
        (result as any).content ??
        prevContent ??
        result.text ??
        ''
      ).trim();

      // Defensive strip: only kicks in if the GGUF lacked a chat template
      // that declared reasoning blocks. Normally a no-op now.
      return this.thinkingEnabled ? finalText : this.stripThinkingBlocks(finalText);
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
   * Same as chatCompletion but also returns the latest inference timings.
   * Used by the UI to render pocketpal-style stats under assistant bubbles.
   */
  static async chatCompletionWithTimings(
    messages: Message[],
    config: Partial<LlamaConfig> = {},
    onToken?: (token: string) => void,
  ): Promise<{text: string; timings?: MessageTimings}> {
    this.lastTimings = undefined;
    const text = await this.chatCompletion(messages, config, onToken);
    return {text, timings: this.lastTimings};
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
   * Also handles cases where llama.rn de-tokenizes special tokens to literal
   * text (drops the `<|` / `|>` brackets) and truncated/unclosed blocks.
   */
  private static stripThinkingBlocks(text: string): string {
    if (!text) return text;
    let out = text;

    // --- Gemma 4 channel blocks ---
    // Properly bracketed: <|channel>thought ... <channel|>
    out = out.replace(/<\|channel>[\s\S]*?<channel\|>/g, '');
    // Unclosed block - strip from <|channel> up to next turn marker or end
    out = out.replace(/<\|channel>[\s\S]*?(?=<\|turn>|<\|tool_call>|$)/g, '');
    // Bracketless variant emitted when llama.rn loses special-token brackets:
    //   channel\nthought\n...\nchannel
    out = out.replace(/(?:^|\n)\s*channel\s*\n\s*thought\b[\s\S]*?\n\s*channel\b\s*/gi, '\n');
    // Orphan closing marker
    out = out.replace(/<channel\|>/g, '');

    // --- Other Gemma 4 special tokens that may leak as text ---
    out = out.replace(/<\|think\|>/g, '');
    out = out.replace(/<\|turn>(?:system|user|model)?\s*/g, '');
    out = out.replace(/<turn\|>/g, '');

    // --- Generic thinking tags (DeepSeek, Claude-style debug, etc.) ---
    out = out.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');
    out = out.replace(/<thought>[\s\S]*?<\/thought>/gi, '');

    return out.replace(/\n{3,}/g, '\n\n').trim();
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
   * Slim system prompt for the native agent loop.
   * Model receives real tool schemas via the `tools` completion param,
   * so this skips the JSON dump, format examples, and tool-selection
   * heuristics that the legacy path bakes into the prompt.
   *
   * Honors the 'none' prompt variant (returns empty string).
   */
  private static getSlimSystemPrompt(): string {
    if (this.currentPromptType === 'none') {
      return '';
    }

    // Inject tool schemas directly. The jinja template in many GGUFs
    // (abliterated fine-tunes especially) silently drops the `tools` param,
    // so we never rely on the template to expose the tool list. We also
    // pin the call format to Pythonic `[fn(arg="value")]`, which our
    // extractToolCall rescue parses for every model.
    let toolsBlock = '';
    if (this.toolsEnabled && this.availableTools.length > 0) {
      const schemas = this.availableTools.map(tool => {
        const params = tool.parameters.map(p => {
          const req = p.required ? ' (required)' : '';
          return `    - ${p.name}: ${p.type}${req} — ${p.description}`;
        }).join('\n');
        return `- ${tool.name}: ${tool.description}\n  Parameters:\n${params || '    (none)'}`;
      }).join('\n\n');

      toolsBlock = `

# AVAILABLE TOOLS
${schemas}

# HOW TO CALL A TOOL
Respond with exactly: [tool_name(param1="value1", param2="value2")]
For no-parameter tools: [tool_name()]
Emit the bracket expression alone on its own line — no preamble. The tool
runs, the result comes back, then you write the final natural-language
answer. The name inside [name()] MUST be one of the AVAILABLE TOOLS above.

# BRACKETS ARE FOR TOOL CALLS ONLY
Plain replies must NEVER be wrapped in brackets. "yo." not "[yo.]".

# WHEN TO USE WHICH TOOL
- Find anything the user saved in their vault → search_vault.
- List files/folders in the vault → list_vault_files.
- Read a specific file you know by name → read_vault_file.
- See how notes link together (backlinks/links) → get_vault_connections.
- Save a NEW markdown file → save_vault_file(path, content).
- Change an EXISTING markdown file → update_vault_file(path, content).
- Read a specific web page → fetch_web_page(url).
- Time-sensitive / real-time public info (news, weather, prices, recent
  events, anything after your training) → search_web. Stable general
  knowledge (definitions, how things work, history) → answer directly, NO tool.
- Current date/time → get_current_datetime().
- No tool fits → answer directly and concisely.

# EXAMPLES

User: What do I have about cooking?
Assistant: [search_vault(query="cooking")]

User: What's in my vault?
Assistant: [list_vault_files()]

User: Read Recipe Collection.md
Assistant: [read_vault_file(file_path="Recipe Collection.md")]

User: What links to my Fitness note?
Assistant: [get_vault_connections(file_path="Fitness.md")]

User: Save a note that I prefer dark mode
Assistant: [save_vault_file(path="personal/preferences/ui.md", content="# UI preferences\n\nPrefers dark mode\n")]

User: Change my bank note, new password is 456
Assistant: [update_vault_file(path="personal/passwords/bank.md", content="# bank password\n\nbank password = 456\n")]

User: Latest AI news
Assistant: [search_web(query="latest AI news")]

User: Summarize https://example.com
Assistant: [fetch_web_page(url="https://example.com")]

User: What is React Native?
Assistant: A framework for building native iOS/Android apps from one React codebase.

User: What time is it?
Assistant: [get_current_datetime()]`;
    }

    const persona = `# CHARACTER
You are LocalOS — a cool, efficient on-device agent. Zero formal bullshit. Straight to the point. Smart friend, not corporate assistant. Confident, dry, occasionally witty. Never apologetic, never sycophantic.

# OUTPUT STYLE
- Be concise and direct. As short as the question allows — a fragment for small talk, a real answer when the question needs one. Do NOT pad, but do NOT punt.
- Greetings ("sup", "hi", "hey", "yo") → <=5 words. e.g. "yo." / "sup." / "what's up?"
- General-knowledge questions (people, places, facts, definitions, how-to) → answer directly from what you know. If it needs current/real-time data, call search_web. NEVER reply "nothing on that yet" to a general question.
- "nothing on that yet." is ONLY for when the user asks about THEIR OWN stored info and a vault tool returned empty. Never use it as a generic fallback.
- Tool result → just state the answer. No framing. "Bank pw: 123." not "Based on the vault, your bank password is 123."
- No restating the question. No follow-up questions unless genuinely needed.
- Lowercase is fine for casual replies.

HARD BAN — never emit these phrases:
- "I'm happy to" / "I'd be happy to" / "I'm excited to" / "I'm here to assist"
- "Based on the information available" / "It seems that" / "However, I can try"
- "I apologize" / "Unfortunately" / "Please note" / "Feel free to"
- "Can you tell me a bit about yourself" / "What topics would you like to discuss"
- Any self-introduction past message #1 of the session
- Echoing the user's question back at them

# TOOL USAGE
Call tools when they beat your own knowledge — current time/date, real-time facts, web search, the user's stored data. Never tell the user to check their clock or the web themselves. Just call the tool. Never claim you can't access something a tool provides.

No tool fits → answer direct. Stay terse.${toolsBlock}`;

    return persona;
  }

  /**
   * System prompt for the non-native paths (preflight tool narration,
   * legacy loop, context-stats, debug viewer). Delegates to the slim
   * prompt so there is ONE persona definition. The SYSTEM_PROMPTS variants
   * (letta, etc.) are no longer in the runtime path — they carried stale,
   * contradicting rules ('I don't have that yet', 'public facts →
   * search_web') that fought the slim prompt depending on which path ran.
   */
  private static getToolSystemPrompt(): string {
    return this.getSlimSystemPrompt();
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
   - When user shares personal info: USE vault_lookup then vault_write_proposal
   - When user asks "what do you know": USE vault_lookup or search_vault
   - When user asks about past conversations: USE conversation_search
   - ALWAYS check vault BEFORE saying "I don't know"

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
User: "I prefer TypeScript" → YOU MUST RESPOND: [vault_save(topic="TypeScript preference", content="# TypeScript preference\n\nPrefers TypeScript over JavaScript\n", path="personal/preferences/dev.md")]
User: "My favorite color is blue" → YOU MUST RESPOND: [vault_save(topic="favorite color", content="# general preferences\n\nFavorite color: blue\n", path="personal/preferences/general.md")]
User: "I work best in mornings" → YOU MUST RESPOND: [vault_save(topic="morning habit", content="# schedule habits\n\nWorks best in the mornings\n", path="personal/habits/schedule.md")]
User: "Remember I'm working on LocalOS" → YOU MUST RESPOND: [core_memory_append(label="current_focus", content="Working on LocalOS project")]

MEMORY - READ (User asks about themselves):
User: "What do you know about me?" → YOU MUST RESPOND: [search_vault(query="user preferences habits")]
User: "What are my preferences?" → YOU MUST RESPOND: [search_vault(query="preferences")]
User: "Do you remember what I said about TypeScript?" → YOU MUST RESPOND: [vault_lookup(query="TypeScript")]
User: "What did we discuss yesterday?" → YOU MUST RESPOND: [conversation_search(query="yesterday discussion", limit=5)]

ABSOLUTE RULES - NEVER VIOLATE THESE:
1. If user shares personal info → IMMEDIATELY call vault_save
2. If user asks "what do you know" → IMMEDIATELY call search_vault
3. DO NOT say "I don't have access" - YOU HAVE VAULT TOOLS
4. DO NOT respond with conversational text - CALL THE TOOL FIRST
5. Tool calls MUST be on their own line, not mixed with text`;
    } else {
      // 8B model with native tool support - simpler, more concise instructions
      prompt += `

To call a tool, output: [tool_name(param="value")]

REMEMBER:
- Check vault_lookup or search_vault when user asks about themselves
- Save important info with vault_save (single call), or core_memory_append for behavior hints
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
   * Layer-2 keyword triggers that run BEFORE the native/legacy agent loop.
   * Returns a final response when a trigger fires, or null to fall through
   * to the regular agent loop.
   *
   * Rationale: abliterated Q4_K_M 8B frequently narrates "I've updated my
   * knowledge" without emitting any tool call. Regex-detected high-confidence
   * intents (passwords, recall, save) deterministically route to the right
   * tool so the assistant never silently drops a user-stated fact.
   */
  private static async runPreflightTriggers(
    messages: Message[],
    config: Partial<LlamaConfig>,
    onToken?: (token: string) => void,
    onToolUsage?: (
      stage: 'tool_call' | 'tool_result' | 'generating',
      toolName?: string,
      toolArgs?: Record<string, any>,
      toolResult?: any,
    ) => void,
  ): Promise<{response: string; usedTool: boolean; toolName: string} | null> {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser || !lastUser.content) return null;
    const content = lastUser.content;
    const lower = content.toLowerCase();

    const hasTool = (name: string) => this.availableTools.some(t => t.name === name);

    // CONFIRM PENDING WRITE — if the assistant proposed a save last turn and the
    // user replies affirmatively, commit it now. Cleared in all other cases.
    if (this.pendingProposal) {
      const isYes = /^(yes|y|yep|yeah|sure|ok|okay|do it|save it|commit|proceed|go ahead|approve|confirm)\b/i.test(content.trim());
      if (isYes && hasTool('vault_commit_write')) {
        const p = this.pendingProposal;
        this.pendingProposal = null;
        Logger.info(`✍️  PREFLIGHT: vault_commit_write (user confirmed) ${p.path}`);
        return await this.runTriggerTool(
          'vault_commit_write',
          {path: p.path, content: p.content, mode: p.mode},
          messages, config, onToken, onToolUsage,
        );
      }
      const isNo = /^(no|n|nope|cancel|don't|do not|skip|stop)\b/i.test(content.trim());
      if (isNo) {
        this.pendingProposal = null;
        // fall through — let the model respond naturally
      } else if (!isYes) {
        // Different topic entirely — discard the stale proposal.
        this.pendingProposal = null;
      }
    }

    // DATETIME — already proven to work, kept here for both paths.
    const datetimeTriggers = ['what time', 'what date', 'current time', 'current date', "what's the time", "what's today", 'time is it', 'date is it', 'date today'];
    if (datetimeTriggers.some(w => lower.includes(w)) && hasTool('get_current_datetime')) {
      Logger.info('🕐 PREFLIGHT: get_current_datetime');
      return await this.runTriggerTool('get_current_datetime', {}, messages, config, onToken, onToolUsage);
    }

    // VAULT FILE READ vs SEARCH — disambiguate by intent verb.
    //  - "read/show/open/display/print/contents of X.md"  → read_vault_file (full content)
    //  - "where is/find/locate X.md"                      → search_vault (path lookup)
    const hasMdFile = /\b[\w\s-]+\.md\b/i.test(content);
    const mdMatch = content.match(/\b([A-Z][\w-]*(?:\s+[A-Z][\w-]*)*\.md)\b/) || content.match(/\b([\w-]+\.md)\b/i);
    const readVerbs = /\b(read|show|open|display|print|view|content|contents|what does|what['']?s in|what is in)\b/i;
    const findVerbs = /\b(where is|where can i find|find|locate|which folder)\b/i;

    if (hasMdFile && readVerbs.test(content) && hasTool('read_vault_file')) {
      const filePath = mdMatch ? mdMatch[1].trim() : content;
      Logger.info(`📖 PREFLIGHT: read_vault_file "${filePath}"`);
      return await this.runTriggerTool('read_vault_file', {file_path: filePath}, messages, config, onToken, onToolUsage);
    }

    if ((hasMdFile || findVerbs.test(content)) && hasTool('search_vault')) {
      const q = mdMatch ? mdMatch[1].trim() : stripStopwords(content);
      Logger.info(`🔍 PREFLIGHT: search_vault "${q}"`);
      return await this.runTriggerTool('search_vault', {query: q}, messages, config, onToken, onToolUsage);
    }

    // Write intent is handled by the model via vault_save tool — no regex preflight needed.

    // RECALL INTENT — questions about stored values.
    const recallPatterns: RegExp[] = [
      /\b(my|the)\s+[\w\s]+\s+password\b/i,
      /\bwhat['']?s\s+my\b/i,
      /\bdo\s+i\s+have\b/i,
      /\bdid\s+i\s+(tell|say|mention|save|store|write)\b/i,
      /\bi\s+forgot\b/i,
      /\bwhere\s+did\s+i\s+(save|store|put|write)\b/i,
      // Preference/fact recall — natural language style
      /\bwhat\s+[\w\s]{0,40}\s+do\s+i\b/i,  // "what beverages do I enjoy", "what languages do I use"
      /\bwhat\s+do\s+i\s+\w+\b/i,            // "what do I build", "what do I prefer"
      /\bwhere\s+do\s+i\s+\w+\b/i,           // "where do I live", "where do I work"
      /\bwhich\s+[\w\s]{0,40}\s+do\s+i\b/i,  // "which languages do I use"
      /\btell\s+me\s+(about\s+)?my\b/i,      // "tell me my preferences"
      /\bam\s+i\s+\w+\b/i,                   // "am I vegetarian"
    ];
    if (recallPatterns.some(re => re.test(content)) && hasTool('vault_lookup')) {
      const q = stripStopwords(content);
      Logger.info(`🧠 PREFLIGHT: vault_lookup (recall) "${q}"`);
      return await this.runTriggerTool('vault_lookup', {query: q}, messages, config, onToken, onToolUsage);
    }

    // BROAD SELF-RECALL — "what do you know about me", "what have you saved", "what do you remember"
    // These ask about the agent's knowledge, not a specific fact — use search_vault for top-K coverage.
    const broadRecallPatterns = [
      /what\s+do\s+you\s+know\s+about\s+me/i,
      /what\s+have\s+you\s+(saved|stored|recorded|remembered)/i,
      /what\s+do\s+you\s+remember\s+(about\s+me)?/i,
      /tell\s+me\s+what\s+you\s+know/i,
      /what\s+information\s+do\s+you\s+have/i,
      /do\s+you\s+know\s+anything\s+about\s+me/i,
    ];
    if (broadRecallPatterns.some(re => re.test(content)) && hasTool('search_vault')) {
      Logger.info('🧠 PREFLIGHT: search_vault (broad self-recall)');
      return await this.runTriggerTool('search_vault', {query: 'personal user preferences facts profile habits'}, messages, config, onToken, onToolUsage);
    }

    // VAULT KNOWLEDGE RECALL — "tell me about my X project / vault / notes".
    if (/\btell me about my\b/i.test(content) && hasTool('search_vault')) {
      const tail = content.replace(/^.*\btell me about my\b\s*/i, '').replace(/\?.*$/, '').trim();
      const q = stripStopwords(tail);
      if (q) {
        Logger.info(`📖 PREFLIGHT: search_vault (project recall) "${q}"`);
        return await this.runTriggerTool('search_vault', {query: q}, messages, config, onToken, onToolUsage);
      }
    }

    // VAULT STRUCTURE
    const vaultListTriggers = ['what folders', 'list folders', 'vault structure', 'folders in my vault'];
    if (vaultListTriggers.some(w => lower.includes(w)) && hasTool('list_vault_structure')) {
      Logger.info('📁 PREFLIGHT: list_vault_structure');
      return await this.runTriggerTool('list_vault_structure', {}, messages, config, onToken, onToolUsage);
    }

    return null;
  }

  /**
   * Chained vault write flow: lookup → branch on result → either confirm
   * "already saved", surface a diff, or build a proposal and store it for
   * confirmation. The model is then asked to narrate the outcome so the
   * user sees a natural reply with a clear yes/no question.
   */
  private static async runWriteIntentFlow(
    userText: string,
    messages: Message[],
    config: Partial<LlamaConfig>,
    onToken?: (token: string) => void,
    onToolUsage?: (
      stage: 'tool_call' | 'tool_result' | 'generating',
      toolName?: string,
      toolArgs?: Record<string, any>,
      toolResult?: any,
    ) => void,
  ): Promise<{response: string; usedTool: boolean; toolName: string} | null> {
    const parsed = this.parseWriteIntent(userText);
    if (!parsed) return null;
    const {topic, content, suggestedPath} = parsed;

    Logger.info(`💾 PREFLIGHT (write-intent): topic="${topic}" path="${suggestedPath}"`);

    // Step 1: lookup
    onToolUsage?.('tool_call', 'vault_lookup', {query: topic});
    const lookupRes = await ToolService.executeTool({
      id: generateId(),
      name: 'vault_lookup',
      arguments: {query: topic},
    });
    onToolUsage?.('tool_result', 'vault_lookup', {query: topic}, lookupRes);

    const lookup: any = lookupRes.result || {};
    let summary = '';
    let mode: 'create' | 'update' | 'append' = 'create';
    let storePending = false;

    if (lookup.found) {
      const existingSnippet = String(lookup.snippet || '').trim();
      if (existingSnippet && existingSnippet.includes(content.trim())) {
        summary = `Already saved at \`${lookup.path}\`. Nothing to do.`;
      } else {
        // Append new value to existing file rather than overwriting.
        mode = 'append';
        const commitArgs = {path: lookup.path, content, mode: 'append'};
        onToolUsage?.('tool_call', 'vault_commit_write', commitArgs);
        const commitRes = await ToolService.executeTool({
          id: generateId(),
          name: 'vault_commit_write',
          arguments: commitArgs,
        });
        onToolUsage?.('tool_result', 'vault_commit_write', commitArgs, commitRes);
        const ok = (commitRes.result as any)?.success;
        summary = ok
          ? `Updated \`${lookup.path}\` with the new value.`
          : `Couldn't update \`${lookup.path}\`: ${(commitRes.result as any)?.error}`;
      }
    } else {
      // No existing entry — write directly.
      mode = 'create';
      const commitArgs = {path: suggestedPath, content, mode: 'create'};
      onToolUsage?.('tool_call', 'vault_commit_write', commitArgs);
      const commitRes = await ToolService.executeTool({
        id: generateId(),
        name: 'vault_commit_write',
        arguments: commitArgs,
      });
      onToolUsage?.('tool_result', 'vault_commit_write', commitArgs, commitRes);
      const ok = (commitRes.result as any)?.success;
      summary = ok
        ? `Saved to \`${suggestedPath}\`.`
        : `Couldn't save: ${(commitRes.result as any)?.error}`;
    }

    onToolUsage?.('generating');
    Logger.info(`💾 PREFLIGHT write-flow result: mode=${mode}`);

    return {
      response: summary,
      usedTool: true,
      toolName: 'vault_commit_write',
    };
  }

  /**
   * Extract topic + content + suggested vault path from a write-intent user message.
   * Returns null if the message is not actually a save instruction.
   */
  private static parseWriteIntent(userText: string): {
    topic: string;
    content: string;
    suggestedPath: string;
  } | null {
    const text = userText.trim();

    // "My X password is Y" / "The X password is Y"
    const pwIs = text.match(/^(?:my|the)\s+([\w\s-]+?)\s+(?:password|pw|pass)\s+is\s+(.+)$/i);
    if (pwIs) {
      const topic = `${pwIs[1].trim().toLowerCase()} password`;
      const value = pwIs[2].trim().replace(/[.!?]+$/, '');
      const slug = pwIs[1].trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      return {
        topic,
        content: `# ${pwIs[1].trim()} password\n\n${topic} = ${value}\n`,
        suggestedPath: `personal/passwords/${slug}.md`,
      };
    }

    // "Save my X password as Y" / "Save my X token as Y"
    const saveAs = text.match(/^save\s+my\s+([\w\s-]+?)\s+(password|key|token|note)\s+(?:as|to)\s+(.+)$/i);
    if (saveAs) {
      const topicWord = saveAs[1].trim().toLowerCase();
      const kind = saveAs[2].toLowerCase();
      const value = saveAs[3].trim().replace(/[.!?]+$/, '');
      const slug = topicWord.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const folder = kind === 'password' || kind === 'key' || kind === 'token' ? 'passwords' : 'notes';
      return {
        topic: `${topicWord} ${kind}`,
        content: `# ${topicWord} ${kind}\n\n${topicWord} ${kind} = ${value}\n`,
        suggestedPath: `personal/${folder}/${slug}.md`,
      };
    }

    // "Remember that I prefer dark mode" / "Remember I prefer X"
    const remember = text.match(/^remember(?:\s+that)?\s+(?:i\s+)?(.+)$/i);
    if (remember) {
      const body = remember[1].trim().replace(/[.!?]+$/, '');
      // Try to derive a topic word (first 2-3 noun-ish words).
      const tokens = body.split(/\s+/).filter(w => !/^(prefer|like|want|use|need|enjoy|am|the|a|an|to)$/i.test(w));
      const slugWords = tokens.slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
      const slug = slugWords || 'note';
      return {
        topic: body,
        content: `# Preference\n\n${body}\n`,
        suggestedPath: `personal/preferences/${slug}.md`,
      };
    }

    // "Note that X" / "Save this: X"
    const note = text.match(/^(?:note\s+that|save\s+this[:\s]|store\s+this[:\s])\s*(.+)$/i);
    if (note) {
      const body = note[1].trim();
      const slug = body.split(/\s+/).slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'note';
      return {
        topic: body,
        content: `# Note\n\n${body}\n`,
        suggestedPath: `personal/notes/${slug}.md`,
      };
    }

    // Generic "key = value"
    const kv = text.match(/^([\w][\w\s-]{0,40})\s*=\s*(.+)$/);
    if (kv) {
      const key = kv[1].trim();
      const value = kv[2].trim();
      const slug = key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const folder = /password|secret|token|key/i.test(key) ? 'passwords' : 'notes';
      return {
        topic: key,
        content: `# ${key}\n\n${key} = ${value}\n`,
        suggestedPath: `personal/${folder}/${slug}.md`,
      };
    }

    // Generic "My X is Y"
    const myXisY = text.match(/^my\s+([\w][\w\s-]{1,40?})\s+is\s+(.+)$/i);
    if (myXisY) {
      const key = myXisY[1].trim().toLowerCase();
      const value = myXisY[2].trim().replace(/[.!?]+$/, '');
      const slug = key.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const folder =
        /password|pin|secret|token|key/.test(key) ? 'passwords' :
        /card|bank|account|ssn|tax|financial|credit|debit/.test(key) ? 'financial' :
        /email|phone|address|number/.test(key) ? 'contact' :
        'preferences';
      return {
        topic: key,
        content: `# ${key}\n\n${key} = ${value}\n`,
        suggestedPath: `personal/${folder}/${slug}.md`,
      };
    }

    return null;
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

    // Log result body so debugging shows what the tool actually returned
    try {
      const resultStr = JSON.stringify(toolResult.result);
      Logger.info(`🔧 ${toolName} result: ${resultStr.substring(0, 500)}`);
    } catch {}

    // Classify outcome: hard failure (no internet, file not found) vs empty
    // search vs a real hit. Each narrates differently. Errors are routed
    // through the model too, so the user hears "looks like no internet"
    // instead of a raw "Tool error: ..." dump.
    const r = toolResult.result as any;
    const hadError = !!toolResult.error || (r && r.success === false);
    const isEmpty =
      !hadError && r &&
      (r.found === false ||
        (Array.isArray(r.matches) && r.matches.length === 0) ||
        r.total_matches === 0);

    // Build prompt context so the model can give a natural answer
    const systemPrompt = this.getToolSystemPrompt();
    const systemMessage: Message = {
      id: 'system-tools',
      role: 'system',
      content: systemPrompt,
      timestamp: Date.now(),
    };

    const resultText = PromptBuilder.truncateToolResult(
      toolResult.error ? {error: toolResult.error} : toolResult.result,
    );
    const instruction = hadError
      ? `RESULT: ${resultText}\n\nThe tool FAILED. Read the "error"/"reason" field and tell the user plainly what went wrong in ONE short sentence (e.g. "looks like no internet", "no file named that", "couldn't reach search"). Do NOT invent an answer or claim it worked. NO tool syntax.`
      : isEmpty
      ? `RESULT: ${resultText}\n\nThe lookup found nothing. Tell the user directly that you don't have that info saved yet, and ask if they'd like to tell you. Do NOT pretend to know. Do NOT say "happy to help". NO tool syntax.`
      : `RESULT (vault data — this is real, treat as ground truth): ${resultText}\n\nThe RESULT above contains the user's actual stored info. Each match has a "full_content" or "snippet" field — read either and summarize specifics (file names, facts, preferences). Do NOT say "I don't have that" or "nothing on that yet" — the data is right there. Do NOT call another tool. NO tool syntax. 1–2 short sentences, plain prose.`;

    const toolResultMessage: Message = {
      id: 'tool-result',
      role: 'system',
      content: instruction,
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

  /** Levenshtein edit distance between two short strings. */
  private static editDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = Array.from({length: n + 1}, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[n];
  }

  /**
   * Nearest registered tool name within edit distance 2. Rescues typo'd
   * tool names from weak quants (e.g. "fault_lookup" → "vault_lookup")
   * without matching genuinely different names.
   */
  private static nearestToolName(name: string, known: string[]): string | null {
    // Pass 1: edit distance <= 2 — single-char typos ("fault_lookup").
    let best: string | null = null;
    let bestD = 3;
    for (const k of known) {
      const d = this.editDistance(name, k);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best) return best;

    // Pass 2: token-set overlap — semantic renames the model invents
    // ("support_web_fetch" → "fetch_web_page"). Require >=2 shared
    // underscore tokens AND a unique winner so ambiguous names don't match.
    const toks = (s: string) =>
      new Set(s.toLowerCase().split(/[_\s]+/).filter(Boolean));
    const nameToks = toks(name);
    let topK: string | null = null;
    let top = 0;
    let second = 0;
    for (const k of known) {
      const kToks = toks(k);
      let shared = 0;
      nameToks.forEach(t => {
        if (kToks.has(t)) shared++;
      });
      if (shared > top) {
        second = top;
        top = shared;
        topK = k;
      } else if (shared > second) {
        second = shared;
      }
    }
    return topK && top >= 2 && top > second ? topK : null;
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
   * Chat completion with tool support.
   *
   * Dispatches between the native agent loop (single-pass, jinja+tools)
   * and the legacy multi-pass detector based on the model's tool format.
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
  ): Promise<{response: string; usedTool?: boolean; toolName?: string; timings?: MessageTimings}> {
    if (!this.context || !this.currentModelName) {
      throw new Error('Model not loaded');
    }

    // Reset so the returned timings reflect only this call's final generation
    // (the last context.completion in the loop overwrites lastTimings).
    this.lastTimings = undefined;

    if (!this.toolsEnabled) {
      Logger.warn('⚠️  Tools are NOT enabled. Call LlamaService.enableTools() first.');
      const response = await this.chatCompletion(messages, config, onToken);
      return {response, usedTool: false, timings: this.lastTimings};
    }

    // Intent-guessing layers (regex preflight, trigger words, embedding
    // router) removed: the native tool-calling model decides. Safety nets in
    // the loop (fuzzy name rescue, history sanitize, leak guard, result
    // narration) catch the weak-quant failure modes.
    const modelConfig = this.modelConfig || getModelConfig(this.currentModelName);
    let result: {response: string; usedTool?: boolean; toolName?: string};
    if (modelConfig.toolFormat === 'transformers-native') {
      Logger.info('🧭 Native agent loop path (toolFormat=transformers-native)');
      result = await this.runNativeAgentLoop(messages, config, onToken, onToolUsage);
    } else {
      Logger.info('🧭 Legacy tool loop path (toolFormat=' + modelConfig.toolFormat + ')');
      result = await this.runLegacyToolLoop(messages, config, onToken, onToolUsage);
    }
    Logger.debug('⏱️  Timings:', this.lastTimings);
    return {...result, timings: this.lastTimings};
  }

  /**
   * Parse a Gemma 4 tool call from raw text when llama.cpp's response
   * parser didn't extract it into `tool_calls` (happens when driving
   * completion via `prompt:` instead of `messages:`).
   *
   * Format: `<|tool_call>call:fn_name{key:<|"|>val<|"|>,...}<tool_call|>`
   */
  private static parseGemma4ToolCallFromText(
    text: string,
  ): Array<{type: 'function'; id?: string; function: {name: string; arguments: string}}> | null {
    if (!text || !text.includes('<|tool_call>')) return null;
    const re = /<\|tool_call>call:([\w_]+)(\{[\s\S]*?\})<tool_call\|>/g;
    const calls: Array<{type: 'function'; function: {name: string; arguments: string}}> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const name = m[1];
      const body = m[2];
      let argsObj: Record<string, any> = {};
      try {
        argsObj = this.gemma4DecodeObject(body);
      } catch (decodeErr) {
        Logger.warn(`Gemma 4 args decode failed for ${name}:`, decodeErr);
      }
      calls.push({
        type: 'function',
        function: {name, arguments: JSON.stringify(argsObj)},
      });
    }
    return calls.length > 0 ? calls : null;
  }

  /**
   * Decode a Gemma 4 DSL object body `{k:v,k2:v2}` into a plain object.
   * Handles strings wrapped in `<|"|>...<|"|>`, numbers, booleans, null,
   * nested objects/arrays.
   */
  private static gemma4DecodeObject(body: string): Record<string, any> {
    const trimmed = body.trim();
    if (trimmed === '{}' || trimmed === '') return {};
    if (trimmed[0] !== '{' || trimmed[trimmed.length - 1] !== '}') {
      throw new Error(`Not an object body: ${trimmed.substring(0, 80)}`);
    }
    const inner = trimmed.slice(1, -1);
    const result: Record<string, any> = {};
    const parts = this.gemma4SplitTopLevel(inner, ',');
    for (const part of parts) {
      const idx = part.indexOf(':');
      if (idx < 0) continue;
      const key = part.slice(0, idx).trim();
      const raw = part.slice(idx + 1).trim();
      result[key] = this.gemma4DecodeValue(raw);
    }
    return result;
  }

  private static gemma4DecodeValue(raw: string): any {
    const s = raw.trim();
    if (s.startsWith('<|"|>') && s.endsWith('<|"|>')) {
      return s.slice(5, -5);
    }
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (s.startsWith('{') && s.endsWith('}')) return this.gemma4DecodeObject(s);
    if (s.startsWith('[') && s.endsWith(']')) {
      const inner = s.slice(1, -1);
      return this.gemma4SplitTopLevel(inner, ',').map(item => this.gemma4DecodeValue(item));
    }
    return s;
  }

  /**
   * Split a Gemma 4 DSL body on `sep` at top level (skipping nested braces,
   * brackets, and string delimiters).
   */
  private static gemma4SplitTopLevel(s: string, sep: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let inStr = false;
    let buf = '';
    for (let i = 0; i < s.length; i++) {
      if (s.startsWith('<|"|>', i)) {
        inStr = !inStr;
        buf += '<|"|>';
        i += 4;
        continue;
      }
      if (!inStr) {
        const c = s[i];
        if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') depth--;
        else if (c === sep && depth === 0) {
          parts.push(buf);
          buf = '';
          continue;
        }
      }
      buf += s[i];
    }
    if (buf.trim()) parts.push(buf);
    return parts;
  }

  /**
   * Encode a value into Gemma 4's tool DSL.
   * Strings wrapped in `<|"|>...<|"|>`, numbers/booleans literal, objects
   * as `{k:v,...}`, arrays as `[v,...]`. Matches the chat template's
   * format_argument macro.
   */
  private static gemma4Encode(v: any): string {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'string') return `<|"|>${v}<|"|>`;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return `[${v.map(x => this.gemma4Encode(x)).join(',')}]`;
    if (typeof v === 'object') {
      const body = Object.entries(v)
        .map(([k, vv]) => `${k}:${this.gemma4Encode(vv)}`)
        .join(',');
      return `{${body}}`;
    }
    return String(v);
  }

  /**
   * Build the inline `<|tool_response>response:name{...}<tool_response|>`
   * block for the result of one tool execution. Bare strings/numbers/etc.
   * get wrapped as `{result:<|"|>value<|"|>}` so the template parser sees
   * an object body.
   */
  private static gemma4ToolResponseBlock(name: string, result: any): string {
    let body: string;
    if (result === null || result === undefined) {
      body = '{}';
    } else if (typeof result === 'object' && !Array.isArray(result)) {
      body = this.gemma4Encode(result);
    } else {
      body = this.gemma4Encode({result});
    }
    return `<|tool_response>response:${name}${body}<tool_response|>`;
  }

  /**
   * Native agent loop using llama.rn's `tools` + `tool_choice` params.
   *
   * Gemma 4's chat template uses **inline injection** within a single
   * `<|turn>model...<turn|>` block: model emits `<|tool_call>...<tool_call|>`,
   * the app injects `<|tool_response>...<tool_response|>` after it, and the
   * model continues with the final answer in the same turn.
   *
   * llama.rn's bridge only supports `{role, content}` messages — no
   * `tool_calls` field, no `tool` role. So we accumulate the model's
   * tool call + our tool response into a `prefill_text` string and re-call
   * completion with that prefill until the model emits no more tool calls.
   */
  private static async runNativeAgentLoop(
    messages: Message[],
    config: Partial<LlamaConfig> = {},
    onToken?: (token: string) => void,
    onToolUsage?: (
      stage: 'tool_call' | 'tool_result' | 'generating',
      toolName?: string,
      toolArgs?: Record<string, any>,
      toolResult?: any
    ) => void,
  ): Promise<{response: string; usedTool: boolean; toolName?: string}> {
    if (!this.context) {
      throw new Error('Model not loaded');
    }

    const llamaConfig = {
      ...DEFAULT_LLAMA_CONFIG,
      contextSize: this.modelConfig?.contextSize ?? DEFAULT_LLAMA_CONFIG.contextSize,
      ...config,
    };

    const toolsSchema = ToolService.getToolsSchema();
    const stop = this.modelConfig?.stopWords ?? llamaConfig.stopSequences;
    const slimSystem = this.getSlimSystemPrompt();

    // Sanitize prior assistant turns: strip any leaked bracket tool-call
    // fragment (closed OR truncated) before feeding history back. Otherwise
    // the model reads its own past "[suggest_journal_entry(..." and imitates
    // it, poisoning every later turn into the same broken call. Drop turns
    // that are nothing but a stripped fragment so the template stays clean.
    const stripBracketCalls = (content: string): string =>
      content
        .replace(/\[[\w_]+\([\s\S]*?\)\]/g, '') // fully-closed [fn(...)]
        .replace(/\[\s*\w+\s*\([\s\S]*$/g, '') // unclosed/truncated tail
        .trim();

    // Conversation messages remain frozen at user input. Tool round-trips
    // accumulate into `prefill` instead of new messages, because the llama.rn
    // bridge type cannot represent `tool` role or `tool_calls` on assistant.
    const convo = [
      ...(slimSystem ? [{role: 'system', content: slimSystem}] : []),
      ...messages
        .map(m => ({
          role: m.role,
          content: m.role === 'assistant' ? stripBracketCalls(m.content) : m.content,
        }))
        .filter(m => m.role !== 'assistant' || m.content.length > 0),
    ];

    const MAX_ITERS = 5;
    let usedTool = false;
    let firstToolName: string | undefined;
    let finalText = '';
    let prefill = '';

    Logger.info(`🤖 Native agent loop starting (${toolsSchema.length} tools available)`);

    // Format the base prompt once using the GGUF's jinja template with tools.
    // Subsequent iterations append the accumulated `prefill` (inline tool
    // call + tool_response DSL) so the model keeps generating inside the
    // same open `<|turn>model\n` block instead of starting a fresh turn.
    // Capture chat_format / grammar so output parsing of `<|tool_call>`
    // tokens still works when we drive completion via raw `prompt:`.
    let basePrompt = '';
    let chatFormat: number | undefined;
    let grammar: string | undefined;
    let grammarTriggers: any[] | undefined;
    let preservedTokens: string[] | undefined;
    try {
      const ctx: any = this.context as any;
      const formatted: any = await ctx.getFormattedChat(convo as any, null, {
        jinja: true,
        tools: toolsSchema,
        tool_choice: 'auto',
        parallel_tool_calls: {},
        add_generation_prompt: true,
        enable_thinking: this.thinkingEnabled,
        ...(this.thinkingEnabled ? {reasoning_format: 'auto' as const} : {}),
      });
      basePrompt = (formatted && formatted.prompt) || '';
      chatFormat = formatted?.chat_format;
      grammar = formatted?.grammar;
      grammarTriggers = formatted?.grammar_triggers;
      preservedTokens = formatted?.preserved_tokens;
      Logger.debug(`Base prompt formatted (${basePrompt.length} chars, chat_format=${chatFormat})`);
      Logger.debug(`Base prompt head (first 1200 chars):\n${basePrompt.substring(0, 1200)}`);
      Logger.debug(`Base prompt tail (last 600 chars):\n${basePrompt.substring(Math.max(0, basePrompt.length - 600))}`);
    } catch (fmtErr) {
      Logger.warn('getFormattedChat failed, falling back to legacy loop:',
        fmtErr instanceof Error ? fmtErr.message : String(fmtErr));
      const legacy = await this.runLegacyToolLoop(messages, config, onToken, onToolUsage);
      return {
        response: legacy.response,
        usedTool: legacy.usedTool ?? false,
        toolName: legacy.toolName,
      };
    }

    for (let iter = 0; iter < MAX_ITERS; iter++) {
      Logger.debug(`Iteration ${iter + 1}/${MAX_ITERS}, prefill length=${prefill.length}`);

      let prevContent = '';
      let prevReasoning = '';
      let sawToolCall = false;
      const t0 = Date.now();
      let ttftMs: number | undefined;

      let result: any;
      try {
        result = await this._runCompletion(() => this.context!.completion(
          {
            prompt: basePrompt + prefill,
            n_predict: llamaConfig.maxTokens,
            temperature: llamaConfig.temperature,
            top_p: llamaConfig.topP,
            top_k: llamaConfig.topK,
            stop,
            // After we inject <|tool_response>...<tool_response|> the
            // tokenizer treats the trailing token as end-of-generation and
            // halts with tokensPredicted=0. Force past the natural EOS so
            // the model emits the answer; our stop array on <turn|> still
            // closes the turn correctly.
            ...(prefill ? {ignore_eos: true} : {}),
            ...(chatFormat !== undefined ? {chat_format: chatFormat} : {}),
            ...(grammar ? {grammar} : {}),
            ...(grammarTriggers ? {grammar_triggers: grammarTriggers} : {}),
            ...(preservedTokens ? {preserved_tokens: preservedTokens} : {}),
            ...(this.thinkingEnabled ? {reasoning_format: 'auto' as const} : {}),
          },
          data => {
            if (data.tool_calls && data.tool_calls.length > 0) {
              sawToolCall = true;
            }

            const content = data.content ?? '';
            if (content.length > prevContent.length) {
              const delta = content.slice(prevContent.length);
              prevContent = content;
              if (delta && ttftMs === undefined) ttftMs = Date.now() - t0;
              if (onToken && !sawToolCall) {
                onToken(delta);
              }
            }

            const reasoning = data.reasoning_content ?? '';
            if (reasoning.length > prevReasoning.length) {
              prevReasoning = reasoning;
              this.lastReasoning = reasoning.substring(0, 300);
            }
          },
        ));
        // Overwrite on every iter; final iter (after tool exec) wins,
        // which is the generation that produced the user-visible answer.
        this.lastTimings = this.buildTimings((result as any)?.timings, ttftMs);
      } catch (loopError) {
        if (iter === 0) {
          Logger.warn('Native loop failed on first iteration, falling back to legacy:',
            loopError instanceof Error ? loopError.message : String(loopError));
          const legacy = await this.runLegacyToolLoop(messages, config, onToken, onToolUsage);
          return {
            response: legacy.response,
            usedTool: legacy.usedTool ?? false,
            toolName: legacy.toolName,
          };
        }
        throw loopError;
      }

      if (!this.lastReasoning && result.reasoning_content) {
        this.lastReasoning = String(result.reasoning_content).substring(0, 300);
      }

      let toolCalls = result.tool_calls as
        | Array<{type: 'function'; id?: string; function: {name: string; arguments: string}}>
        | undefined;

      // FALLBACK 1: Gemma 4 native `<|tool_call>call:fn{...}<tool_call|>` tokens.
      if ((!toolCalls || toolCalls.length === 0) && result.content) {
        const parsed = this.parseGemma4ToolCallFromText(String(result.content));
        if (parsed && parsed.length > 0) {
          Logger.info(`🔄 Parsed ${parsed.length} tool call(s) from Gemma 4 text`);
          toolCalls = parsed;
        }
      }

      // FALLBACK 2: Pythonic `[fn(arg=...)]`, no-arg `[fn]`, or XML `<fn />`.
      // Llama 3.1 / abliterated fine-tunes often regress to this even when
      // their template should produce native `<|python_tag|>`. Reuse the
      // legacy regex extractor; normalize to OpenAI tool_calls shape.
      if ((!toolCalls || toolCalls.length === 0) && result.content) {
        const rescued = this.extractToolCall(String(result.content));
        if (rescued) {
          try {
            const obj = JSON.parse(rescued) as {name: string; arguments: Record<string, any>};
            // Normalize model hallucinations of tool names (e.g. suggest_vault_lookup → vault_lookup)
            const TOOL_ALIASES: Record<string, string> = {
              suggest_vault_lookup: 'vault_lookup',
              suggest_vault_search: 'search_vault',
              suggest_vault_write: 'vault_write_proposal',
              suggest_vault_write_proposal: 'vault_write_proposal',
            };
            if (TOOL_ALIASES[obj.name]) {
              Logger.debug(`Tool alias: '${obj.name}' → '${TOOL_ALIASES[obj.name]}'`);
              obj.name = TOOL_ALIASES[obj.name];
            }
            const knownTools = ToolService.getToolsSchema()
              .map((t: any) => t.function?.name)
              .filter(Boolean);
            // Fuzzy-correct typo'd names before the registry check. The
            // abliterated Q4 8B mangles tool names (e.g. "fault_lookup" for
            // "vault_lookup"); accept the nearest known name within edit
            // distance 2 so a single bad char doesn't drop the call.
            if (!knownTools.includes(obj.name)) {
              const near = this.nearestToolName(obj.name, knownTools);
              if (near) {
                Logger.info(`🔄 Fuzzy tool name: '${obj.name}' → '${near}'`);
                obj.name = near;
              }
            }
            if (knownTools.includes(obj.name)) {
              Logger.info(`🔄 Rescued Pythonic/XML tool call: ${obj.name}`);
              toolCalls = [{
                type: 'function',
                id: generateId(),
                function: {name: obj.name, arguments: JSON.stringify(obj.arguments || {})},
              }];
            } else {
              Logger.debug(`Rescue ignored — '${obj.name}' not in tool registry, no near match`);
            }
          } catch (rescueErr) {
            Logger.debug('Pythonic rescue parse failed:', rescueErr);
          }
        }
      }

      if (!toolCalls || toolCalls.length === 0) {
        // Prefer non-empty content; fall back to text or the streamed
        // accumulator. Empty string is treated as absent.
        const candidates = [result.content, result.text, prevContent];
        const picked = candidates.find(c => typeof c === 'string' && c.length > 0) ?? '';
        let rawContent = String(picked).trim();

        // Iter > 0 with a bracket-shaped response = model tried another tool
        // call after already getting tool data. Rescue failed (unknown name
        // like "read_vault_files" plural). Don't leak the leftover bracket
        // text — force one more turn with an explicit "answer now" nudge.
        // Bracket-shaped tool-call attempt. Do NOT require a closing ']' —
        // weak quants frequently emit a truncated/unclosed call
        // ("[suggest_journal_entry(date=...") which, if leaked, gets saved to
        // history and the model then imitates it, poisoning every later turn.
        const looksLikeToolCallAttempt =
          rawContent.length > 2 && /^\[\s*\w+\s*\(/.test(rawContent);
        if (iter > 0 && usedTool && looksLikeToolCallAttempt) {
          Logger.warn(`⚠️ Iter ${iter + 1}: model emitted bracket call "${rawContent}" after tool result. Forcing synthesis turn.`);
          convo.push({
            role: 'system',
            content:
              `Your previous output "${rawContent}" was not a valid tool call ` +
              `and you already have the data you need. Reply now with the ` +
              `final natural-language answer in 1 short sentence. Plain prose ` +
              `only. NO brackets, NO tool calls.`,
          });
          try {
            const ctx: any = this.context as any;
            const reformatted: any = await ctx.getFormattedChat(convo as any, null, {
              jinja: true,
              tools: toolsSchema,
              tool_choice: 'auto',
              parallel_tool_calls: {},
              add_generation_prompt: true,
              enable_thinking: this.thinkingEnabled,
              ...(this.thinkingEnabled ? {reasoning_format: 'auto' as const} : {}),
            });
            basePrompt = (reformatted && reformatted.prompt) || basePrompt;
            chatFormat = reformatted?.chat_format ?? chatFormat;
            grammar = reformatted?.grammar ?? grammar;
            grammarTriggers = reformatted?.grammar_triggers ?? grammarTriggers;
            preservedTokens = reformatted?.preserved_tokens ?? preservedTokens;
            prefill = '';
          } catch (reformatErr) {
            Logger.warn('Reformat for synthesis nudge failed:',
              reformatErr instanceof Error ? reformatErr.message : String(reformatErr));
          }
          continue;
        }

        // Two bracket cases to clean up before showing the reply:
        //  1. A bracket-shaped tool call that no fallback resolved (unknown or
        //     typo'd name, uninferable args). NEVER leak "[fn(...)]" to the
        //     user — strip it; if nothing readable remains, ask for a retry.
        //  2. A plain reply the model wrapped in brackets ("[yo.]") — unwrap.
        if (looksLikeToolCallAttempt) {
          Logger.warn(`⚠️ Unresolved bracket call leaked to output: "${rawContent}". Suppressing.`);
          let remainder = this.filterToolJson(rawContent);
          // filterToolJson only removes fully-closed [fn(...)]. Strip an
          // unclosed/truncated call from its '[' to end-of-string too, so it
          // never reaches the user or gets persisted to history.
          if (/^\[\s*\w+\s*\(/.test(remainder)) {
            remainder = remainder.replace(/\[\s*\w+\s*\([\s\S]*$/, '').trim();
          }
          rawContent = remainder || 'hmm, glitched on that — say it once more?';
        } else if (
          rawContent.length > 2 &&
          rawContent.startsWith('[') &&
          rawContent.endsWith(']')
        ) {
          rawContent = rawContent.slice(1, -1).trim();
        }
        finalText = rawContent;
        if (!this.thinkingEnabled) {
          finalText = this.stripThinkingBlocks(finalText);
        }
        Logger.info(`✅ Native loop done (iter=${iter + 1}, usedTool=${usedTool}, len=${finalText.length})`);
        Logger.info(`📝 Final agent text:\n${finalText}`);
        if (!finalText) {
          Logger.warn(`⚠️ Empty content on iter ${iter + 1}. Raw fields:`, {
            contentLen: result.content?.length ?? 0,
            textLen: result.text?.length ?? 0,
            prevContentLen: prevContent.length,
            stoppedWord: result.stopping_word,
            stoppedEos: result.stopped_eos,
            tokensPredicted: result.tokens_predicted,
          });
        }
        if (iter === 0 && !usedTool) {
          Logger.debug(`tool_calls field type: ${typeof result.tool_calls}, value: ${JSON.stringify(result.tool_calls)}`);
          Logger.debug(`Raw model content (first 500 chars): ${finalText.substring(0, 500)}`);
          // Guards removed: the 8B emits its own tool calls. Post-hoc
          // personal-question / save-hallucination guards used to discard the
          // model's reply and re-generate without the persona prompt (causing
          // the "I'd be happy to help" override) and stream a second time on
          // top of the first (causing duplicated/repeated text). The model's
          // reply now stands as-is.
        }
        break;
      }

      Logger.info(`🔧 Iter ${iter + 1}: model requested ${toolCalls.length} tool call(s)`);

      // Execute every requested tool, then append the inline
      // `<|tool_call>call:name{args}<tool_call|><|tool_response>response:name{result}<tool_response|>`
      // for each one to the prefill. This is Gemma 4's expected sequence.
      const execResults = await Promise.all(toolCalls.map(async tc => {
        const toolName = tc.function?.name ?? '';
        let args: Record<string, any> = {};
        try {
          args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch (parseErr) {
          Logger.warn(`Tool args JSON parse failed for ${toolName}:`, parseErr);
        }

        Logger.info(`🔧 → ${toolName}(${JSON.stringify(args)})`);
        onToolUsage?.('tool_call', toolName, args);

        const toolResult = await ToolService.executeTool({
          id: tc.id || generateId(),
          name: toolName,
          arguments: args,
        });

        // Full tool result for debugging — covers both success payload and error.
        try {
          const dump = JSON.stringify(toolResult.error ? {error: toolResult.error} : toolResult.result, null, 2);
          Logger.info(`🔧 ← ${toolName} result (${dump.length} chars):\n${dump}`);
        } catch (logErr) {
          Logger.warn(`Tool result stringify failed for ${toolName}:`, logErr);
        }

        onToolUsage?.('tool_result', toolName, args, toolResult);
        return {toolName, args, toolResult};
      }));

      usedTool = true;
      firstToolName = firstToolName ?? execResults[0].toolName;

      // Pick prefill format. Gemma 4 uses its inline DSL. Everything else
      // (Llama 3.1, Llama 3.2, abliterated fine-tunes, etc.) gets tool
      // results injected back into the conversation as system notes, then
      // basePrompt is re-rendered via getFormattedChat so the model's own
      // chat template formats things correctly.
      const isGemma = (this.currentModelName || '').toLowerCase().includes('gemma');

      if (isGemma) {
        for (const {toolName, args, toolResult} of execResults) {
          const argsBody = Object.keys(args).length === 0 ? '{}' : this.gemma4Encode(args);
          prefill += `<|tool_call>call:${toolName}${argsBody}<tool_call|>`;
          const payload = toolResult.error ? {error: toolResult.error} : toolResult.result;
          prefill += this.gemma4ToolResponseBlock(toolName, payload);
          prefill += '\n\n';
        }
      } else {
        // Non-Gemma path: rebuild base prompt with tool result in convo.
        for (const {toolName, toolResult} of execResults) {
          const payload = toolResult.error ? {error: toolResult.error} : toolResult.result;
          const resultText = PromptBuilder.truncateToolResult(payload, TOKEN_BUDGETS.toolResult);
          Logger.info(`🔧 ↪ ${toolName} model-visible (${resultText.length} chars):\n${resultText}`);

          // Classify the result so the model narrates the real outcome —
          // a failure (no internet, file not found) reads differently from
          // an empty search, which reads differently from a hit.
          const r: any = toolResult.result;
          const hadError = !!toolResult.error || (r && r.success === false);
          const isEmpty =
            !hadError && r &&
            (r.found === false ||
              r.total_matches === 0 ||
              (Array.isArray(r.matches) && r.matches.length === 0) ||
              (Array.isArray(r.results) && r.results.length === 0));

          const guidance = hadError
            ? `The tool FAILED — read the "error"/"reason" field and tell the user plainly ` +
              `what went wrong in ONE short sentence (e.g. "looks like no internet", ` +
              `"no file named that", "couldn't reach search"). Do NOT invent an answer or ` +
              `claim it worked.`
            : isEmpty
            ? `The tool returned NO results. Say you couldn't find anything on that in ONE ` +
              `short sentence. If it was the user's own saved info, offer to save it.`
            : `Read the result and answer the user's last message in 1–2 short sentences, ` +
              `stating the specific facts from the result. No framing like "based on the vault".`;

          convo.push({
            role: 'system',
            content:
              `Tool result for ${toolName}:\n${resultText}\n\n${guidance}\n` +
              `DO NOT call another tool. DO NOT emit any [bracket(...)] call. Plain prose only.`,
          });
        }
        try {
          const ctx: any = this.context as any;
          const reformatted: any = await ctx.getFormattedChat(convo as any, null, {
            jinja: true,
            tools: toolsSchema,
            tool_choice: 'auto',
            parallel_tool_calls: {},
            add_generation_prompt: true,
            enable_thinking: this.thinkingEnabled,
            ...(this.thinkingEnabled ? {reasoning_format: 'auto' as const} : {}),
          });
          basePrompt = (reformatted && reformatted.prompt) || basePrompt;
          chatFormat = reformatted?.chat_format ?? chatFormat;
          grammar = reformatted?.grammar ?? grammar;
          grammarTriggers = reformatted?.grammar_triggers ?? grammarTriggers;
          preservedTokens = reformatted?.preserved_tokens ?? preservedTokens;
          prefill = '';
          Logger.debug(`Rebuilt base prompt after tool result (${basePrompt.length} chars)`);
        } catch (reformatErr) {
          Logger.warn('Reformat after tool result failed:',
            reformatErr instanceof Error ? reformatErr.message : String(reformatErr));
        }
      }

      onToolUsage?.('generating');
    }

    // Detect actual iter-cap hit vs clean break with empty text
    if (!finalText && usedTool) {
      // Heuristic: prefill length grows by ~300 chars per tool round.
      // If we ran fewer than MAX_ITERS and content is just missing, surface
      // a friendlier message based on what tools we did use.
      Logger.warn(`⚠️ Loop ended with usedTool=true but empty final text (prefill=${prefill.length} chars)`);
      finalText = `I called ${firstToolName ?? 'a tool'} but the model produced no final answer. Try rephrasing or check the tool result in the logs.`;
    }

    return {response: finalText, usedTool, toolName: firstToolName};
  }

  /**
   * LEGACY tool loop — multi-pass detector with regex parsing.
   * Reached only when modelConfig.toolFormat !== 'transformers-native'.
   * Kept for older fine-tunes (1B custom function-calling, etc.) that
   * lack native tool token emission.
   */
  private static async runLegacyToolLoop(
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

      // VAULT FILE READ vs SEARCH — disambiguate by intent verb.
      //  - "read/show/open/contents of X.md"  → read_vault_file (full content)
      //  - "where is/find/locate X.md"        → search_vault (path lookup)
      const hasMdFile = /\b[\w\s-]+\.md\b/i.test(userMessage.content);
      const readVerbs = /\b(read|show|open|display|print|view|content|contents|what does|what['']?s in|what is in)\b/i;
      const findVerbs = /\b(where is|where can i find|find|locate|which folder)\b/i;
      const mdMatch = userMessage.content.match(/\b([A-Z][\w-]*(?:\s+[A-Z][\w-]*)*\.md)\b/) ||
                      userMessage.content.match(/\b([\w-]+\.md)\b/i);

      if (hasMdFile && readVerbs.test(userMessage.content) && this.availableTools.some(t => t.name === 'read_vault_file')) {
        const filePath = mdMatch ? mdMatch[1].trim() : userMessage.content;
        Logger.info(`📖 VAULT FILE READ TRIGGER - Reading: "${filePath}"`);
        return await this.runTriggerTool('read_vault_file', {file_path: filePath}, messages, config, onToken, onToolUsage);
      }

      const isWhereQuery = findVerbs.test(userMessage.content);
      if ((hasMdFile || isWhereQuery) && this.availableTools.some(t => t.name === 'search_vault')) {
        const searchQuery = mdMatch ? mdMatch[1].trim() : stripStopwords(userMessage.content);
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

        let query = stripStopwords(userMessage.content);
        if (query.length < 3) {
          query = userMessage.content.trim();
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

      // RECALL/MEMORY TRIGGER: high-confidence intent to look something up in the user's vault.
      // Prefers vault_lookup when present (Phase 2), falls back to search_vault.
      // Patterns the user typed in feedback: "password", "did I tell", "do I have",
      // "what's my", "remember when", "forgot", "where did I save".
      const recallPatterns: RegExp[] = [
        /\b(my|the)\s+\w+\s+password\b/i,
        /\bwhat['']?s\s+my\b/i,
        /\bdo\s+i\s+have\b/i,
        /\bdid\s+i\s+(tell|say|mention|save|store|write)\b/i,
        /\bremember\s+(when|that|the)\b/i,
        /\bi\s+forgot\b/i,
        /\bwhere\s+did\s+i\s+(save|store|put|write)\b/i,
        // Preference/fact recall — natural language style
        /\bwhat\s+[\w\s]{0,40}\s+do\s+i\b/i,
        /\bwhat\s+do\s+i\s+\w+\b/i,
        /\bwhere\s+do\s+i\s+\w+\b/i,
        /\bwhich\s+[\w\s]{0,40}\s+do\s+i\b/i,
        /\btell\s+me\s+(about\s+)?my\b/i,
        /\bam\s+i\s+\w+\b/i,
      ];
      const hasRecallTrigger = recallPatterns.some(re => re.test(userMessage.content));
      if (hasRecallTrigger) {
        const lookupTool = this.availableTools.find(t => t.name === 'vault_lookup');
        const searchTool = this.availableTools.find(t => t.name === 'search_vault');
        const tool = lookupTool || searchTool;
        if (tool) {
          const query = stripStopwords(userMessage.content);
          Logger.info(`🧠 RECALL TRIGGER DETECTED - Forcing ${tool.name} with query: "${query}"`);
          return await this.runTriggerTool(tool.name, {query}, messages, config, onToken, onToolUsage);
        }
      }

      // SAVE/REMEMBER TRIGGER: user is volunteering a fact to remember.
      // We do NOT auto-write — we route to a lookup first so the assistant can
      // diff against existing values and propose a write via the system-prompt flow.
      // Patterns: "remember that X", "save this", "note that X", "X = Y" (key/value form).
      const savePatterns: RegExp[] = [
        /\bremember\s+(that|this|I)\b/i,
        /\b(save|store|note)\s+(this|that|the\s+following)\b/i,
        /\bnote\s+that\b/i,
        /^[\w\s]{2,40}\s*=\s*\S+/,  // "bank password = 123" style
      ];
      const hasSaveTrigger = savePatterns.some(re => re.test(userMessage.content));
      if (hasSaveTrigger) {
        const lookupTool = this.availableTools.find(t => t.name === 'vault_lookup');
        const searchTool = this.availableTools.find(t => t.name === 'search_vault');
        const tool = lookupTool || searchTool;
        if (tool) {
          const query = stripStopwords(userMessage.content);
          Logger.info(`💾 SAVE TRIGGER DETECTED - Pre-flight ${tool.name} for diff check: "${query}"`);
          return await this.runTriggerTool(tool.name, {query}, messages, config, onToken, onToolUsage);
        }
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
