/**
 * Service for managing llama.cpp model inference
 */
import {initLlama, LlamaContext, releaseContext} from 'llama.rn';
import {LlamaConfig, Message, Tool} from '../types';
import {DEFAULT_LLAMA_CONFIG} from '../utils/constants';
import {getChatTemplate} from '../utils/helpers';
import {ToolService} from './ToolService';

export class LlamaService {
  private static context: LlamaContext | null = null;
  private static currentModelPath: string | null = null;
  private static currentModelName: string | null = null;
  private static isInitialized: boolean = false;
  private static toolsEnabled: boolean = false;
  private static availableTools: Tool[] = [];

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

      console.log('Loading model from:', modelPath);

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

      console.log('Model loaded successfully:', modelName);
    } catch (error) {
      console.error('Failed to load model:', error);
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
        console.log('Model context released');
      } catch (error) {
        console.error('Failed to release context:', error);
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

      console.log('Starting completion with config:', llamaConfig);

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

      console.log('Completion finished');
      return fullResponse.trim();
    } catch (error) {
      console.error('Completion error:', error);
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
      console.log('Generated prompt template for:', this.currentModelName);

      // Use the completion method with the formatted prompt
      return await this.completion(prompt, config, onToken);
    } catch (error) {
      console.error('Chat completion error:', error);
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
        console.log('Generation stopped');
      } catch (error) {
        console.error('Failed to stop generation:', error);
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
      console.error('Failed to get model info:', error);
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
      console.error('Tokenization error:', error);
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
      console.error('Failed to count tokens:', error);
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
    console.log(`Tools enabled: ${this.availableTools.length} tools available`);
  }

  /**
   * Disable function calling
   */
  static disableTools(): void {
    this.toolsEnabled = false;
    this.availableTools = [];
    console.log('Tools disabled');
  }

  /**
   * Check if tools are enabled
   */
  static areToolsEnabled(): boolean {
    return this.toolsEnabled;
  }

  /**
   * Get system prompt with tool definitions for Llama 3.2
   */
  private static getToolSystemPrompt(): string {
    if (!this.toolsEnabled || this.availableTools.length === 0) {
      return '';
    }

    const toolDescriptions = this.availableTools
      .map(tool => {
        const params = tool.parameters
          .map(p => {
            const required = p.required ? ' (required)' : ' (optional)';
            return `  - ${p.name}: ${p.type}${required} - ${p.description}`;
          })
          .join('\n');

        return `## ${tool.name}\n${tool.description}\n\nParameters:\n${params || '  None'}`;
      })
      .join('\n\n');

    return `You are a helpful AI assistant with access to the following tools:

${toolDescriptions}

When you need to use a tool, respond with ONLY a JSON object in this exact format:
{
  "tool": "tool_name",
  "arguments": {
    "param1": "value1"
  }
}

After receiving tool results, provide your final answer to the user based on those results.

IMPORTANT:
- Use tools when the user asks for information you cannot answer directly
- Output ONLY the JSON tool call, nothing else
- Wait for tool results before providing your final answer
- If you don't need a tool, respond normally`;
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
      const response = await this.chatCompletion(messages, config, onToken);
      return {response, usedTool: false};
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
      const firstResponse = await this.chatCompletion(
        messagesWithTools,
        config,
        onToken,
      );

      // Try to parse tool call from response
      const toolCallMatch = firstResponse.match(/\{[\s\S]*?"tool"[\s\S]*?\}/);

      if (!toolCallMatch) {
        // No tool call, return response as-is
        return {response: firstResponse, usedTool: false};
      }

      try {
        const toolCall = JSON.parse(toolCallMatch[0]);

        if (!toolCall.tool || !ToolService.getTool(toolCall.tool)) {
          // Invalid tool call, return original response
          return {response: firstResponse, usedTool: false};
        }

        console.log('Tool call detected:', toolCall);

        // Notify UI: tool is being called
        if (onToolUsage) {
          onToolUsage('tool_call', toolCall.tool);
        }

        // Execute the tool
        const toolResult = await ToolService.executeTool({
          id: `tool-${Date.now()}`,
          name: toolCall.tool,
          arguments: toolCall.arguments || {},
        });

        // Notify UI: tool result received
        if (onToolUsage) {
          onToolUsage('tool_result', toolCall.tool);
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

          return {
            response: finalResponse,
            usedTool: true,
            toolName: toolCall.tool,
          };
        }

        // Tool executed successfully, provide results to LLM for final answer
        const toolResultMessage: Message = {
          id: 'tool-result',
          role: 'system',
          content: `Tool "${toolCall.tool}" returned:\n${JSON.stringify(toolResult.result, null, 2)}\n\nNow provide a helpful answer to the user based on this information.`,
          timestamp: Date.now(),
        };

        // Notify UI: generating final response
        if (onToolUsage) {
          onToolUsage('generating');
        }

        const finalResponse = await this.chatCompletion(
          [...messagesWithTools, toolResultMessage],
          config,
          onToken,
        );

        return {
          response: finalResponse,
          usedTool: true,
          toolName: toolCall.tool,
        };
      } catch (parseError) {
        // Failed to parse tool call, return original response
        console.error('Failed to parse tool call:', parseError);
        return {response: firstResponse, usedTool: false};
      }
    } catch (error) {
      console.error('Chat completion with tools error:', error);
      throw error;
    }
  }
}
