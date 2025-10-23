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
// Using a function to avoid Metro bundler trying to resolve at build time
let AppleLLM: any = null;

function loadAppleLLM() {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    // Try to load the package using dynamic require
    // Metro won't resolve this at build time because it's in a function
    const pkg = '@react-native-ai/apple';
    AppleLLM = require(pkg).default || require(pkg);
    console.log('✅ Loaded @react-native-ai/apple');
    return AppleLLM;
  } catch {
    console.log(
      '⚠️ Apple Intelligence package not installed.',
      'The app will use Llama.cpp instead.',
      '\nTo enable Apple Intelligence, run: npm install @react-native-ai/apple',
    );
    return null;
  }
}

// Try to load on module initialization (iOS only)
if (Platform.OS === 'ios') {
  loadAppleLLM();
}

export class AppleIntelligenceService {
  private static session: AppleLLMSession | null = null;
  private static isInitializing: boolean = false;

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

    if (!AppleLLM) {
      console.log('  ✗ Apple Intelligence package NOT loaded');
      console.log('  → Package status: @react-native-ai/apple is not installed');
      console.log('  → To install: npm install @react-native-ai/apple');
      console.log('  → Then run: cd ios && pod install && cd ..');
      return false;
    }

    console.log('  ✓ Apple Intelligence package loaded successfully');

    try {
      console.log('  → Calling AppleLLM.isAvailable()...');
      const available = await AppleLLM.isAvailable();
      console.log('  → Result:', available);

      if (available) {
        console.log('  ✅ Apple Intelligence IS available on this device!');
        console.log('  → Device meets all requirements (iOS 18+)');
      } else {
        console.log('  ✗ Apple Intelligence NOT available on this device');
        console.log('  → Most likely: iOS version < 18');
        console.log('  → Current iOS version:', Platform.Version);
        console.log('  → Required: iOS 18.0 or higher');
      }
      return available;
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
