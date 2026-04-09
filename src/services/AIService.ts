/**
 * Unified AI Service
 * Auto-detects and uses the best AI backend available:
 * - Apple Intelligence (iOS 18+) - preferred for speed and efficiency
 * - Llama.cpp (fallback) - works on Android and older iOS
 */

import {Platform} from 'react-native';
import {LlamaService} from './LlamaService';
import {AppleIntelligenceService} from './AppleIntelligenceService';
import {LMStudioService} from './LMStudioService';
import {Message, LlamaConfig} from '../types';
import {Logger, LogSection} from '../utils/Logger';

type AIBackend = 'apple' | 'llama' | 'lmstudio' | 'none';

export class AIService {
  private static currentBackend: AIBackend = 'none';
  private static initializationAttempted: boolean = false;

  /**
   * Initialize AI service (auto-detect best available option)
   * Returns the backend that was initialized
   */
  static async initialize(): Promise<AIBackend> {
    if (this.initializationAttempted && this.currentBackend !== 'none') {
      Logger.info(`Already initialized with backend: ${this.currentBackend}`);
      return this.currentBackend;
    }

    this.initializationAttempted = true;

    LogSection.start('🔍 AI BACKEND DETECTION');
    Logger.info('Platform:', Platform.OS);
    Logger.info('Platform Version:', Platform.Version);
    LogSection.header('Detection Process');

    // Use Llama.cpp as default
    Logger.info('✅ Using Llama.cpp as default backend');
    Logger.info('Load a GGUF model from Models screen to start chatting');
    Logger.info('You can switch to Apple Intelligence from the Chat screen if available');
    LogSection.end();
    this.currentBackend = 'llama';
    return 'llama';
  }

  /**
   * Check if any AI backend is ready
   */
  static isReady(): boolean {
    if (this.currentBackend === 'apple') {
      return AppleIntelligenceService.isInitializedCheck();
    } else if (this.currentBackend === 'llama') {
      return LlamaService.isModelLoaded();
    } else if (this.currentBackend === 'lmstudio') {
      return true; // readiness checked async via LMStudioService.isAvailable()
    }
    return false;
  }

  /**
   * Chat completion (auto-routes to available backend)
   */
  static async chatCompletion(
    messages: Message[],
    config: Partial<LlamaConfig> = {},
    onToken?: (token: string) => void,
  ): Promise<string> {
    if (!this.initializationAttempted) {
      await this.initialize();
    }

    if (this.currentBackend === 'apple') {
      return await AppleIntelligenceService.chatCompletion(
        messages,
        config,
        onToken,
      );
    } else if (this.currentBackend === 'llama') {
      return await LlamaService.chatCompletion(messages, config, onToken);
    } else if (this.currentBackend === 'lmstudio') {
      return await LMStudioService.chatCompletion(messages, config, onToken);
    } else {
      throw new Error('No AI backend available');
    }
  }

  /**
   * Chat completion with tool support
   */
  static async chatCompletionWithTools(
    messages: Message[],
    tools: Array<any>,
    config: Partial<LlamaConfig> = {},
    onToken?: (token: string) => void,
    onToolUsage?: (
      stage: 'tool_call' | 'tool_result' | 'generating',
      toolName?: string,
      toolArgs?: Record<string, any>,
      toolResult?: any
    ) => void,
  ): Promise<{response: string; usedTool?: boolean; toolName?: string}> {
    if (!this.initializationAttempted) {
      await this.initialize();
    }

    if (this.currentBackend === 'apple') {
      // Apple Intelligence has native tool calling!
      return await AppleIntelligenceService.chatCompletionWithTools(
        messages,
        tools,
        config,
        onToken,
        onToolUsage,
      );
    } else if (this.currentBackend === 'llama') {
      return await LlamaService.chatCompletionWithTools(
        messages,
        config,
        onToken,
        onToolUsage,
      );
    } else if (this.currentBackend === 'lmstudio') {
      return await LMStudioService.chatCompletionWithTools(
        messages,
        tools,
        config,
        onToken,
        onToolUsage,
      );
    } else {
      throw new Error('No AI backend available');
    }
  }

  /**
   * Get current backend information
   */
  static getBackendInfo(): {
    backend: AIBackend;
    modelName: string;
    isReady: boolean;
  } {
    const isReady = this.isReady();

    if (this.currentBackend === 'apple') {
      const info = AppleIntelligenceService.getModelInfo();
      return {
        backend: 'apple',
        modelName: `${info.name} (${info.backend})`,
        isReady,
      };
    } else if (this.currentBackend === 'llama') {
      const llamaModel = LlamaService.getCurrentModel();
      return {
        backend: 'llama',
        modelName: llamaModel?.name || 'No model loaded',
        isReady,
      };
    } else if (this.currentBackend === 'lmstudio') {
      const model = LMStudioService.getCurrentModel() ?? 'auto (LM Studio)';
      return {
        backend: 'lmstudio',
        modelName: model,
        isReady,
      };
    } else {
      return {
        backend: 'none',
        modelName: 'No backend initialized',
        isReady: false,
      };
    }
  }

  /**
   * Get current backend type
   */
  static getCurrentBackend(): AIBackend {
    return this.currentBackend;
  }

  /**
   * Check if tools are supported
   */
  static areToolsSupported(): boolean {
    if (this.currentBackend === 'apple') {
      return false; // Apple Intelligence does NOT support tool calling in current SDK
    } else if (this.currentBackend === 'llama') {
      return LlamaService.areToolsEnabled();
    } else if (this.currentBackend === 'lmstudio') {
      return true; // LM Studio supports OpenAI-native tool calling
    }
    return false;
  }

  /**
   * Enable tools (if backend supports it)
   */
  static enableTools(tools?: any[]): void {
    if (this.currentBackend === 'llama') {
      LlamaService.enableTools(tools);
    } else if (this.currentBackend === 'lmstudio') {
      // LMStudio auto-fetches tools from ToolService if none provided
      // (ToolService must be initialized first)
      const {ToolService} = require('./ToolService');
      ToolService.initialize();
    }
    // Apple Intelligence does not support tools in current SDK version
  }

  /**
   * Disable tools
   */
  static disableTools(): void {
    if (this.currentBackend === 'llama') {
      LlamaService.disableTools();
    }
  }

  /**
   * Stop ongoing generation
   */
  static async stopGeneration(): Promise<void> {
    if (this.currentBackend === 'llama') {
      await LlamaService.stopGeneration();
    } else if (this.currentBackend === 'lmstudio') {
      LMStudioService.stopGeneration();
    }
    // Apple Intelligence doesn't expose a stop API yet
  }

  /**
   * Release resources
   */
  static async release(): Promise<void> {
    if (this.currentBackend === 'apple') {
      await AppleIntelligenceService.release();
    } else if (this.currentBackend === 'llama') {
      await LlamaService.releaseModel();
    }
    this.currentBackend = 'none';
    this.initializationAttempted = false;
    Logger.info('✅ AI Service released');
  }

  /**
   * Force switch to specific backend (advanced usage)
   */
  static async switchBackend(backend: 'apple' | 'llama' | 'lmstudio'): Promise<boolean> {
    Logger.info(`🔄 Switching to ${backend} backend...`);
    Logger.info(`🔄 Attempting to switch to ${backend} backend...`);

    // Release current backend
    await this.release();

    // Reset initialization flag so next call doesn't skip
    this.initializationAttempted = false;

    if (backend === 'apple') {
      if (Platform.OS !== 'ios') {
        Logger.error('Apple Intelligence only available on iOS');
        Logger.error('Apple Intelligence only available on iOS');
        return false;
      }

      const available = await AppleIntelligenceService.isAvailable();
      if (!available) {
        Logger.error('Apple Intelligence not available on this device');
        Logger.error('Apple Intelligence not available on this device');
        // Fall back to llama
        this.currentBackend = 'llama';
        this.initializationAttempted = true;
        return false;
      }

      await AppleIntelligenceService.initialize();
      this.currentBackend = 'apple';
      this.initializationAttempted = true;
      Logger.info('✅ Switched to Apple Intelligence');
      Logger.info('✅ Switched to Apple Intelligence');
      return true;
    } else if (backend === 'lmstudio') {
      const available = await LMStudioService.isAvailable();
      if (!available) {
        Logger.error(
          `LM Studio not reachable at ${LMStudioService.getBaseUrl()}. ` +
          'Make sure LM Studio is running with the local server enabled.',
        );
        return false;
      }
      this.currentBackend = 'lmstudio';
      this.initializationAttempted = true;
      Logger.info(`✅ Switched to LM Studio (${LMStudioService.getBaseUrl()})`);
      return true;
    } else {
      this.currentBackend = 'llama';
      this.initializationAttempted = true;
      Logger.info('✅ Switched to Llama.cpp');
      Logger.info('✅ Switched to Llama.cpp');
      return true;
    }
  }
}
