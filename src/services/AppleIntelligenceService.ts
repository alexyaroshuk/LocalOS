/**
 * Apple Intelligence Service
 * Wrapper for Apple's on-device Foundation Models (iOS 18+)
 * Uses Vercel AI SDK with @react-native-ai/apple provider
 */

import {Platform} from 'react-native';
import {Message} from '../types';
import {createAppleProvider, apple as appleBase} from '@react-native-ai/apple';
import {generateText, streamText, tool} from 'ai';
import {z} from 'zod';
import {Logger} from '../utils/Logger';

// Type definitions for Apple Intelligence
interface AppleLLMConfig {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

// Define tools for Apple Intelligence
const getCurrentDateTimeTool = tool({
  description: 'Get the current date and time. Use this when the user asks about the current date, time, day of the week, or any time-related queries.',
  parameters: z.object({}),
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
});

const searchWebTool = tool({
  description: 'Search the web for information including current events, facts, trending topics, news, or any information that requires up-to-date knowledge.',
  parameters: z.object({
    query: z.string().describe('The search query to look up'),
  }),
  execute: async ({query}: {query: string}) => {
    try {
      const encodedQuery = encodeURIComponent(query);
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
      let results: string[] = [];

      if (data.Abstract) {
        results.push(data.Abstract);
      }

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
          query,
        };
      }

      return {
        success: true,
        query,
        results,
        source: 'DuckDuckGo',
      };
    } catch (error) {
      console.error('Web search error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        query,
      };
    }
  },
});

// Create Apple provider with tools registered (lazy - only when tools are used)
let appleWithTools: ReturnType<typeof createAppleProvider> | null = null;

function getAppleProviderWithTools() {
  if (!appleWithTools) {
    appleWithTools = createAppleProvider({
      availableTools: {
        get_current_datetime: getCurrentDateTimeTool,
        search_web: searchWebTool,
      },
    });
    console.log('✅ Created Apple provider with tools: get_current_datetime, search_web');
  }
  return appleWithTools;
}

// Check if packages are available
const isPackageAvailable = !!(appleBase && generateText && streamText);

if (Platform.OS === 'ios') {
  console.log('✅ Loaded @react-native-ai/apple with AI SDK');
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

    if (!isPackageAvailable || !appleBase) {
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
  static async initialize(_config: AppleLLMConfig = {}): Promise<void> {
    if (this.isInitialized) {
      console.log('Apple Intelligence already initialized');
      return;
    }

    if (!isPackageAvailable || !appleBase) {
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
    if (!isPackageAvailable || !appleBase || !generateText || !streamText) {
      const err = 'Apple Intelligence packages not available';
      Logger.error(err);
      throw new Error(err);
    }

    try {
      // Convert messages to AI SDK format and add context
      const aiMessages = messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content,
      }));

      // Add helpful context to system message
      if (aiMessages.length > 0 && aiMessages[0].role === 'system') {
        const currentDate = new Date();
        aiMessages[0].content += `\n\nCurrent date/time: ${currentDate.toLocaleString()}. You run offline with no internet. Knowledge cutoff: early 2025. If asked about current events, politely acknowledge this limitation.`;
      }

      console.log(
        `Generating response with Apple Intelligence (${messages.length} messages)`,
      );
      Logger.info(`Generating with Apple Intelligence (${messages.length} messages)`);
      console.log('AI Messages:', JSON.stringify(aiMessages, null, 2));
      console.log('Config:', {
        temperature: config.temperature ?? 0.7,
        topP: config.topP ?? 0.9,
        hasOnToken: !!onToken,
      });

      if (onToken) {
        // STREAMING mode - use the direct promise API
        console.log('Using streamText for streaming...');
        Logger.info('Calling Apple Intelligence streamText...');

        const result = await streamText({
          model: appleBase(),
          messages: aiMessages,
          temperature: config.temperature ?? 0.7,
          topP: config.topP ?? 0.9,
        });

        let fullResponse = '';

        try {
          // Iterate over the async stream with error handling
          for await (const chunk of result.textStream) {
            fullResponse += chunk;
            onToken(chunk);
          }
        } catch (streamError) {
          console.error('Streaming error, falling back to full text:', streamError);
          // If streaming fails, get the full text
          fullResponse = await result.text;
          if (fullResponse) {
            onToken(fullResponse);
          }
        }

        Logger.info(`Streaming complete: ${fullResponse.length} chars`);
        console.log(
          `✅ Apple Intelligence response complete (${fullResponse.length} chars)`,
        );

        return fullResponse;
      } else {
        // NON-STREAMING mode
        console.log('Using generateText (no streaming callback)...');
        Logger.info('Calling Apple Intelligence generateText...');

        const result = await generateText({
          model: appleBase(),
          messages: aiMessages,
          temperature: config.temperature ?? 0.7,
          topP: config.topP ?? 0.9,
        });

        Logger.info(`Got response: ${result.text.length} chars`);
        console.log(
          `✅ Apple Intelligence response complete (${result.text.length} chars)`,
        );

        return result.text;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      console.error('Apple Intelligence generation error:', error);
      console.error('Error details:', {
        message: errorMsg,
        stack: errorStack,
        name: error instanceof Error ? error.name : undefined,
        type: typeof error,
      });

      // Log to Logger utility so it appears in logs screen
      Logger.error('Apple Intelligence Error:', errorMsg);
      if (errorStack) {
        Logger.error('Stack trace:', errorStack);
      }

      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Apple Intelligence: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate with tool calling
   * NOTE: Apple Intelligence in current SDK version (@react-native-ai/apple@0.11.0)
   * does NOT properly support tool calling. This method falls back to regular chat.
   */
  static async chatCompletionWithTools(
    messages: Message[],
    _tools: Array<any>,
    config: AppleLLMConfig = {},
    onToken?: (token: string) => void,
    _onToolUsage?: (
      stage: 'tool_call' | 'tool_result' | 'generating',
      toolName?: string,
    ) => void,
  ): Promise<{response: string; usedTool?: boolean; toolName?: string}> {
    console.warn('⚠️  Apple Intelligence does not support tool calling in current SDK version');
    Logger.warn('Apple Intelligence tool calling is not supported - using regular chat');

    // Fall back to regular chat completion
    const response = await this.chatCompletion(messages, config, onToken);

    return {
      response,
      usedTool: false,
    };
  }

  /**
   * Check if tools are supported (they are not for Apple Intelligence)
   */
  static areToolsSupported(): boolean {
    return false;
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
