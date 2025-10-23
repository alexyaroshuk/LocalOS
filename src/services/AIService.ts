/**
 * Unified AI Service
 * Auto-detects and uses the best AI backend available:
 * - Apple Intelligence (iOS 18+) - preferred for speed and efficiency
 * - Llama.cpp (fallback) - works on Android and older iOS
 */

import {Platform} from 'react-native';
import {LlamaService} from './LlamaService';
import {AppleIntelligenceService} from './AppleIntelligenceService';
import {Message, LlamaConfig} from '../types';

type AIBackend = 'apple' | 'llama' | 'none';

export class AIService {
  private static currentBackend: AIBackend = 'none';
  private static initializationAttempted: boolean = false;

  /**
   * Initialize AI service (auto-detect best available option)
   * Returns the backend that was initialized
   */
  static async initialize(): Promise<AIBackend> {
    if (this.initializationAttempted) {
      console.log(`Already initialized with backend: ${this.currentBackend}`);
      return this.currentBackend;
    }

    this.initializationAttempted = true;

    console.log('🔍 Detecting available AI backends...');

    // Try Apple Intelligence first (iOS 18+ only)
    if (Platform.OS === 'ios') {
      try {
        const appleAvailable = await AppleIntelligenceService.isAvailable();
        if (appleAvailable) {
          await AppleIntelligenceService.initialize();
          this.currentBackend = 'apple';
          console.log('✅ Using Apple Intelligence (Neural Engine)');
          return 'apple';
        }
      } catch (error) {
        console.log('Apple Intelligence initialization failed:', error);
      }
    }

    // Fallback to Llama.cpp (works everywhere)
    console.log('✅ Using Llama.cpp (requires manual model loading)');
    this.currentBackend = 'llama';
    return 'llama';
  }

  /**
   * Check if any AI backend is ready
   */
  static isReady(): boolean {
    if (this.currentBackend === 'apple') {
      return AppleIntelligenceService.isInitialized();
    } else if (this.currentBackend === 'llama') {
      return LlamaService.isModelLoaded();
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
      return true; // Apple Intelligence has native tool calling
    } else if (this.currentBackend === 'llama') {
      return LlamaService.areToolsEnabled();
    }
    return false;
  }

  /**
   * Enable tools (if backend supports it)
   */
  static enableTools(tools?: any[]): void {
    if (this.currentBackend === 'llama') {
      LlamaService.enableTools(tools);
    }
    // Apple Intelligence tools are always available (native support)
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
    console.log('✅ AI Service released');
  }

  /**
   * Force switch to specific backend (advanced usage)
   */
  static async switchBackend(backend: 'apple' | 'llama'): Promise<boolean> {
    console.log(`Attempting to switch to ${backend} backend...`);

    // Release current backend
    await this.release();

    if (backend === 'apple') {
      if (Platform.OS !== 'ios') {
        console.error('Apple Intelligence only available on iOS');
        return false;
      }

      const available = await AppleIntelligenceService.isAvailable();
      if (!available) {
        console.error('Apple Intelligence not available on this device');
        return false;
      }

      await AppleIntelligenceService.initialize();
      this.currentBackend = 'apple';
      console.log('✅ Switched to Apple Intelligence');
      return true;
    } else {
      this.currentBackend = 'llama';
      console.log('✅ Switched to Llama.cpp');
      return true;
    }
  }
}
