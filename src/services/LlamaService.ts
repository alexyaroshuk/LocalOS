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
   * Get system prompt with tool definitions
   * Optimized for local models like Llama 3.2 and Phi-3
   */
  private static getToolSystemPrompt(): string {
    if (!this.toolsEnabled || this.availableTools.length === 0) {
      return '';
    }

    const toolDescriptions = this.availableTools
      .map(tool => {
        const params = tool.parameters
          .map(p => {
            const required = p.required ? 'REQUIRED' : 'OPTIONAL';
            return `    - ${p.name} (${p.type}, ${required}): ${p.description}`;
          })
          .join('\n');

        return `{
  "name": "${tool.name}",
  "description": "${tool.description}",
  "parameters": {
${params || '    (none)'}
  }
}`;
      })
      .join('\n\n');

    return `You are a helpful AI assistant with access to tools. You MUST use these tools when the user asks for information you cannot provide.

# AVAILABLE TOOLS

${toolDescriptions}

# CRITICAL RULES FOR TOOL USAGE

YOU MUST CALL A TOOL WHEN:
1. User asks "What day is today?" → MUST call get_current_datetime
2. User asks "What time is it?" → MUST call get_current_datetime
3. User asks "What's the date?" → MUST call get_current_datetime
4. User says "search" or "find" or "look up" → MUST call search_web
5. User asks about current events or news → MUST call search_web
6. User asks about trending topics → MUST call search_web
7. User asks "Search the web for X" → MUST call search_web with query="X"
8. User asks "Find information about X" → MUST call search_web with query="X"
9. User asks about a specific person's current info → MUST call search_web
10. User mentions needing up-to-date information → MUST call search_web

RESPOND NORMALLY (NO TOOL) WHEN:
- User says greetings: "Hi", "Hello", "How are you?"
- User asks general knowledge: "What is JavaScript?" (well-known concept)
- User asks for explanations: "Explain React" (well-known concept)
- User asks for advice or opinions
- User asks about historical facts that don't need real-time data

# HOW TO CALL A TOOL

When you need to call a tool, respond with ONLY this JSON format (NO other text):

{"tool": "tool_name", "arguments": {"param": "value"}}

EXAMPLES:

User: "What day is today?"
Assistant: {"tool": "get_current_datetime", "arguments": {}}

User: "Search for Elon Musk"
Assistant: {"tool": "search_web", "arguments": {"query": "Elon Musk"}}

User: "Who is the president?"
Assistant: {"tool": "search_web", "arguments": {"query": "current president"}}

User: "What is React?"
Assistant: React is a JavaScript library for building user interfaces...

# IMPORTANT NOTES

- DO NOT say "I would call" or "I should call" - JUST OUTPUT THE JSON
- DO NOT explain what you're doing - ONLY output the JSON
- DO NOT add any text before or after the JSON
- If unsure whether you know something, USE THE TOOL
- Current date/time questions ALWAYS need the tool - you don't know what day it is
- Person names you don't recognize ALWAYS need web search`;
  }

  /**
   * Filter out JSON tool calls from text
   */
  private static filterToolJson(text: string): string {
    // Remove JSON tool call patterns from the response
    const toolJsonPattern = /\{[\s\S]*?"tool"[\s\S]*?\}/g;
    let cleaned = text.replace(toolJsonPattern, '').trim();

    // Remove standalone closing braces that might be left over
    cleaned = cleaned.replace(/^\s*\}\s*$/, '').trim();

    // Remove any remaining JSON-like fragments at the start/end
    cleaned = cleaned.replace(/^\s*[\{\}]\s*/g, '').replace(/\s*[\{\}]\s*$/g, '').trim();

    // If the result is empty or just punctuation, return a friendly message
    if (!cleaned || /^[\s\{\}\[\],.:;!?-]*$/.test(cleaned)) {
      return '';
    }

    return cleaned;
  }

  /**
   * Extract tool call from response
   */
  private static extractToolCall(text: string): string | null {
    const toolJsonPattern = /\{[\s\S]*?"tool"[\s\S]*?\}/;
    const match = toolJsonPattern.exec(text);
    return match ? match[0] : null;
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
      console.warn('⚠️  Tools are NOT enabled. Call LlamaService.enableTools() first.');
      console.log('Available tools:', this.availableTools.length);
      const response = await this.chatCompletion(messages, config, onToken);
      return {response, usedTool: false};
    }

    console.log('✅ Tools are enabled. Available tools:', this.availableTools.map(t => t.name).join(', '));

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
      // Use lower temperature for more structured/deterministic output
      // Don't stream to UI during tool detection phase
      const toolDetectionConfig = {
        ...config,
        temperature: 0.1, // Lower temp for structured JSON output
        topP: 0.9,
        maxTokens: 100, // Limit tokens for faster tool detection
      };

      console.log('🔍 Starting tool detection phase (not streaming to UI)...');
      const firstResponse = await this.chatCompletion(
        messagesWithTools,
        toolDetectionConfig,
      );

      console.log('=== TOOL DETECTION DEBUG ===');
      console.log('Temperature:', toolDetectionConfig.temperature, '(lower = more structured)');
      console.log('Model raw output:', firstResponse);
      console.log('Output length:', firstResponse.length);

      // Try to parse tool call from response
      const toolCallMatch = this.extractToolCall(firstResponse);

      if (!toolCallMatch) {
        console.log('❌ NO TOOL CALL DETECTED');
        console.log('Possible reasons:');
        console.log('1. Model responded normally (expected for non-tool questions)');
        console.log('2. Model said "I would call" instead of outputting JSON');
        console.log('3. Model is not trained for tool calling (use a fine-tuned model)');
        console.log('See MODELS_FOR_TOOL_CALLING.md for recommended models');
        // No tool call, filter any accidental JSON and return response
        const cleanResponse = this.filterToolJson(firstResponse);
        return {response: cleanResponse, usedTool: false};
      }

      console.log('✅ TOOL CALL DETECTED:', toolCallMatch);

      try {
        const toolCall = JSON.parse(toolCallMatch);

        if (!toolCall.tool || !ToolService.getTool(toolCall.tool)) {
          // Invalid tool call, filter JSON and return response
          const cleanResponse = this.filterToolJson(firstResponse);
          return {response: cleanResponse, usedTool: false};
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

          // Filter out any JSON artifacts
          const cleanResponse = this.filterToolJson(finalResponse);

          return {
            response: cleanResponse,
            usedTool: true,
            toolName: toolCall.tool,
          };
        }

        // Tool executed successfully, provide results to LLM for final answer
        const toolResultMessage: Message = {
          id: 'tool-result',
          role: 'system',
          content: `TOOL RESULTS:\n${JSON.stringify(toolResult.result, null, 2)}\n\n=== IMPORTANT INSTRUCTIONS ===\nNow answer the user's original question naturally using the information above. You MUST:\n1. Write a complete, helpful response in natural language\n2. DO NOT output any JSON, braces {}, or brackets []\n3. DO NOT just repeat the tool data - explain it naturally\n4. DO NOT output single characters like "}" or "{"\n5. Write at least 1-2 sentences explaining the answer\n\nRespond now in natural language:`,
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

        // Filter out any JSON artifacts from final response
        const cleanResponse = this.filterToolJson(finalResponse);

        // If the response is empty after filtering, the tool was likely used but no text was generated
        // This can happen if the model only outputs the tool JSON
        if (!cleanResponse) {
          console.log('⚠️  Model generated empty response after using tool. Tool result was processed but no text was generated.');
        }

        return {
          response: cleanResponse,
          usedTool: true,
          toolName: toolCall.tool,
        };
      } catch (parseError) {
        // Failed to parse tool call, filter JSON and return response
        console.error('Failed to parse tool call:', parseError);
        const cleanResponse = this.filterToolJson(firstResponse);
        return {response: cleanResponse, usedTool: false};
      }
    } catch (error) {
      console.error('Chat completion with tools error:', error);
      throw error;
    }
  }
}
