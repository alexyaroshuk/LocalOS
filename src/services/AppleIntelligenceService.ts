/**
 * Apple Intelligence Service
 * Wrapper for Apple's on-device Foundation Models (iOS 18+)
 * Uses Vercel AI SDK with @react-native-ai/apple provider
 */

import {Platform} from 'react-native';
import {Message} from '../types';

// Type definitions for Apple Intelligence
interface AppleLLMConfig {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

// Dynamic import of Apple Intelligence module (iOS only)
let apple: any = null;
let generateText: any = null;
let streamText: any = null;
let isPackageAvailable = false;

function loadAppleAI() {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    // Load the AI SDK provider and functions
    const appleModule = require('@react-native-ai/apple');
    apple = appleModule.apple;

    const aiModule = require('ai');
    generateText = aiModule.generateText;
    streamText = aiModule.streamText;

    console.log('✅ Loaded @react-native-ai/apple with AI SDK');
    isPackageAvailable = true;
    return true;
  } catch (error) {
    console.log(
      '⚠️ Apple Intelligence package not installed.',
      'The app will use Llama.cpp instead.',
      '\nTo enable Apple Intelligence, run: npm install @react-native-ai/apple ai @ai-sdk/react',
      '\nError:',
      error,
    );
    isPackageAvailable = false;
    return false;
  }
}

// Try to load on module initialization (iOS only)
if (Platform.OS === 'ios') {
  loadAppleAI();
}

export class AppleIntelligenceService {
  private static isInitialized: boolean = false;

  /**
   * Check if Apple Intelligence is available on this device
   */
  static async isAvailable(): Promise<boolean> {
    console.log('  → Checking Apple Intelligence availability...');

    if (Platform.OS !== 'ios') {
      console.log('  ✗ Platform is not iOS:', Platform.OS);
      return false;
    }

    console.log('  ✓ Platform is iOS');
    console.log('  ✓ iOS Version:', Platform.Version);

    if (!isPackageAvailable || !apple) {
      console.log('  ✗ Apple Intelligence package NOT loaded');
      console.log('  → Package status: @react-native-ai/apple is not installed');
      console.log('  → To install: npm install @react-native-ai/apple ai @ai-sdk/react');
      console.log('  → Then run: cd ios && pod install && cd ..');
      return false;
    }

    console.log('  ✓ Apple Intelligence package loaded successfully');

    try {
      // Check iOS version - Apple Intelligence requires iOS 18+
      const iosVersion = parseFloat(String(Platform.Version));
      console.log('  → iOS version:', iosVersion);

      if (iosVersion >= 18) {
        console.log('  ✅ Apple Intelligence IS available on this device!');
        console.log('  → Device meets all requirements (iOS 18+)');
        return true;
      } else {
        console.log('  ✗ Apple Intelligence NOT available on this device');
        console.log('  → iOS version < 18 (current: ' + iosVersion + ')');
        console.log('  → Required: iOS 18.0 or higher');
        return false;
      }
    } catch (error) {
      console.error('  ✗ Error checking Apple Intelligence availability');
      console.error('  → Error:', error);
      return false;
    }
  }

  /**
   * Initialize Apple Intelligence session
   */
  static async initialize(config: AppleLLMConfig = {}): Promise<void> {
    if (this.isInitialized) {
      console.log('Apple Intelligence already initialized');
      return;
    }

    if (!isPackageAvailable || !apple) {
      throw new Error('Apple Intelligence package not available');
    }

    try {
      console.log('Initializing Apple Intelligence with AI SDK...');
      // The AI SDK doesn't require explicit session initialization
      // Just mark as initialized
      this.isInitialized = true;
      console.log('✅ Apple Intelligence initialized');
    } catch (error) {
      console.error('Failed to initialize Apple Intelligence:', error);
      throw error;
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
    if (!isPackageAvailable || !apple || !generateText || !streamText) {
      throw new Error('Apple Intelligence not available');
    }

    try {
      // Convert messages to AI SDK format
      const aiMessages = messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }));

      console.log(
        `Generating response with Apple Intelligence (${messages.length} messages)`,
      );

      if (onToken) {
        // Streaming response
        const result = await streamText({
          model: apple(),
          messages: aiMessages,
          temperature: config.temperature ?? 0.7,
          maxTokens: config.maxTokens ?? 512,
          topP: config.topP ?? 0.9,
        });

        let fullResponse = '';

        // Stream the text
        for await (const textPart of result.textStream) {
          fullResponse += textPart;
          onToken(textPart);
        }

        console.log(
          `✅ Apple Intelligence response complete (${fullResponse.length} chars)`,
        );
        return fullResponse;
      } else {
        // Non-streaming response
        const result = await generateText({
          model: apple(),
          messages: aiMessages,
          temperature: config.temperature ?? 0.7,
          maxTokens: config.maxTokens ?? 512,
          topP: config.topP ?? 0.9,
        });

        console.log(
          `✅ Apple Intelligence response complete (${result.text.length} chars)`,
        );
        return result.text;
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
    if (!isPackageAvailable || !apple || !generateText || !streamText) {
      throw new Error('Apple Intelligence not available');
    }

    try {
      // Convert messages to AI SDK format
      const aiMessages = messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }));

      // Format tools for AI SDK
      const aiTools = tools.reduce((acc, tool) => {
        acc[tool.name] = {
          description: tool.description,
          parameters: tool.parameters,
        };
        return acc;
      }, {} as Record<string, any>);

      console.log(
        `Generating with tools (${tools.length} tools available)...`,
      );

      if (onToken) {
        // Streaming with tools
        const result = await streamText({
          model: apple(),
          messages: aiMessages,
          tools: aiTools,
          temperature: config.temperature ?? 0.7,
          maxTokens: config.maxTokens ?? 512,
          topP: config.topP ?? 0.9,
        });

        let fullResponse = '';
        let usedTool = false;
        let toolName: string | undefined;

        // Stream the text
        for await (const textPart of result.textStream) {
          fullResponse += textPart;
          onToken(textPart);
        }

        // Check for tool calls
        const finalResult = await result.response;
        if (finalResult.toolCalls && finalResult.toolCalls.length > 0) {
          usedTool = true;
          toolName = finalResult.toolCalls[0].toolName;
          console.log(`✅ Tool called: ${toolName}`);

          if (onToolUsage) {
            onToolUsage('tool_call', toolName);
          }
        }

        return {
          response: fullResponse,
          usedTool,
          toolName,
        };
      } else {
        // Non-streaming with tools
        const result = await generateText({
          model: apple(),
          messages: aiMessages,
          tools: aiTools,
          temperature: config.temperature ?? 0.7,
          maxTokens: config.maxTokens ?? 512,
          topP: config.topP ?? 0.9,
        });

        let usedTool = false;
        let toolName: string | undefined;

        if (result.toolCalls && result.toolCalls.length > 0) {
          usedTool = true;
          toolName = result.toolCalls[0].toolName;
          console.log(`✅ Tool called: ${toolName}`);

          if (onToolUsage) {
            onToolUsage('tool_call', toolName);
          }
        }

        return {
          response: result.text,
          usedTool,
          toolName,
        };
      }
    } catch (error) {
      console.error('Apple Intelligence tool calling error:', error);
      throw error;
    }
  }

  /**
   * Check if session is initialized
   */
  static isInitializedCheck(): boolean {
    return this.isInitialized;
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
    try {
      this.isInitialized = false;
      console.log('✅ Apple Intelligence session released');
    } catch (error) {
      console.error('Error releasing Apple Intelligence session:', error);
    }
  }
}
