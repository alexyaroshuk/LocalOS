/**
 * Apple Intelligence Service
 * Wrapper for Apple's on-device Foundation Models (iOS 18+)
 */

import {Platform} from 'react-native';
import {Message} from '../types';

// Type definitions for Apple Intelligence
interface AppleLLMSession {
  id: string;
}

interface AppleLLMConfig {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

interface AppleLLMResult {
  text: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: any;
  }>;
}

// Dynamic import of Apple Intelligence module (iOS only)
let AppleLLM: any = null;

if (Platform.OS === 'ios') {
  try {
    // Try both package names
    try {
      AppleLLM = require('@react-native-ai/apple').default;
    } catch {
      AppleLLM = require('react-native-apple-llm').default;
    }
  } catch (error) {
    console.log(
      'Apple Intelligence package not installed. Run: npm install @react-native-ai/apple',
    );
  }
}

export class AppleIntelligenceService {
  private static session: AppleLLMSession | null = null;
  private static isInitializing: boolean = false;

  /**
   * Check if Apple Intelligence is available on this device
   */
  static async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    if (!AppleLLM) {
      console.log('❌ Apple Intelligence package not installed');
      return false;
    }

    try {
      const available = await AppleLLM.isAvailable();
      if (available) {
        console.log('✅ Apple Intelligence is available on this device');
      } else {
        console.log(
          '⚠️ Apple Intelligence not available (requires iOS 18+)',
        );
      }
      return available;
    } catch (error) {
      console.error('Error checking Apple Intelligence availability');
      return false;
    }
  }

  /**
   * Initialize Apple Intelligence session
   */
  static async initialize(config: AppleLLMConfig = {}): Promise<void> {
    if (this.session) {
      console.log('Apple Intelligence session already initialized');
      return;
    }

    if (this.isInitializing) {
      console.log('Apple Intelligence initialization in progress...');
      return;
    }

    if (!AppleLLM) {
      throw new Error('Apple Intelligence package not available');
    }

    this.isInitializing = true;

    try {
      console.log('Initializing Apple Intelligence session...');

      const sessionConfig = {
        systemPrompt:
          config.systemPrompt ||
          'You are a helpful AI assistant running locally on this device. Be concise and accurate.',
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens ?? 512,
        topP: config.topP ?? 0.9,
      };

      this.session = await AppleLLM.createSession(sessionConfig);
      console.log('✅ Apple Intelligence session initialized');
    } catch (error) {
      console.error('Failed to initialize Apple Intelligence:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Generate chat completion
   */
  static async chatCompletion(
    messages: Message[],
    config: AppleLLMConfig = {},
    onToken?: (token: string) => void,
  ): Promise<string> {
    if (!this.session) {
      await this.initialize(config);
    }

    if (!AppleLLM || !this.session) {
      throw new Error('Apple Intelligence not initialized');
    }

    try {
      const formattedMessages = messages.map(msg => ({
        role: msg.role === 'system' ? 'system' : msg.role,
        content: msg.content,
      }));

      console.log(
        `Generating response with Apple Intelligence (${formattedMessages.length} messages)`,
      );

      if (onToken) {
        // Streaming response
        let fullResponse = '';
        await AppleLLM.generateStream(
          this.session,
          formattedMessages,
          (token: string) => {
            fullResponse += token;
            onToken(token);
          },
        );
        console.log(
          `✅ Apple Intelligence response complete (${fullResponse.length} chars)`,
        );
        return fullResponse;
      } else {
        // Non-streaming response
        const response = await AppleLLM.generate(
          this.session,
          formattedMessages,
        );
        console.log(
          `✅ Apple Intelligence response complete (${response.length} chars)`,
        );
        return response;
      }
    } catch (error) {
      console.error('Apple Intelligence generation error:', error);
      throw error;
    }
  }

  /**
   * Generate with tool calling (Apple Intelligence has native support!)
   */
  static async chatCompletionWithTools(
    messages: Message[],
    tools: Array<any>,
    config: AppleLLMConfig = {},
    onToken?: (token: string) => void,
    onToolUsage?: (
      stage: 'tool_call' | 'tool_result' | 'generating',
      toolName?: string,
    ) => void,
  ): Promise<{response: string; usedTool?: boolean; toolName?: string}> {
    if (!this.session) {
      await this.initialize(config);
    }

    if (!AppleLLM || !this.session) {
      throw new Error('Apple Intelligence not initialized');
    }

    try {
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Format tools for Apple Intelligence
      const formattedTools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));

      console.log(
        `Generating with tools (${tools.length} tools available)...`,
      );

      const result: AppleLLMResult = await AppleLLM.generateWithTools(
        this.session,
        formattedMessages,
        formattedTools,
        onToken,
      );

      if (result.toolCalls && result.toolCalls.length > 0) {
        const toolCall = result.toolCalls[0];
        console.log(`✅ Tool called: ${toolCall.name}`);

        if (onToolUsage) {
          onToolUsage('tool_call', toolCall.name);
        }

        return {
          response: result.text,
          usedTool: true,
          toolName: toolCall.name,
        };
      }

      return {
        response: result.text,
        usedTool: false,
      };
    } catch (error) {
      console.error('Apple Intelligence tool calling error:', error);
      throw error;
    }
  }

  /**
   * Check if session is initialized
   */
  static isInitialized(): boolean {
    return this.session !== null;
  }

  /**
   * Get model info
   */
  static getModelInfo(): {name: string; size: string; backend: string} {
    return {
      name: 'Apple Intelligence',
      size: '~3B parameters',
      backend: 'Neural Engine',
    };
  }

  /**
   * Release session and free resources
   */
  static async release(): Promise<void> {
    if (this.session && AppleLLM) {
      try {
        await AppleLLM.releaseSession(this.session);
        this.session = null;
        console.log('✅ Apple Intelligence session released');
      } catch (error) {
        console.error('Error releasing Apple Intelligence session:', error);
      }
    }
  }
}
