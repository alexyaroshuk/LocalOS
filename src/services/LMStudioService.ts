/// <reference lib="dom" />
/**
 * LM Studio Service
 * Connects to a local LM Studio instance via its OpenAI-compatible API.
 * Default endpoint: http://localhost:1234
 *
 * Used for dev testing — lets you run any model in LM Studio and use it
 * from the app without downloading a GGUF file.
 */

import {Message, LlamaConfig, Tool} from '../types';
import {Logger} from '../utils/Logger';
import {ToolService} from './ToolService';

export interface LMStudioConfig {
  baseUrl: string;
  modelId?: string; // If null, uses whatever model is currently loaded in LM Studio
}

// Physical devices need your machine's LAN IP (e.g. http://192.168.1.x:1234).
// Android emulators can use http://10.0.2.2:1234.
// iOS simulator can use http://localhost:1234.
// Use LMStudioService.setBaseUrl() or the in-app custom URL dialog to configure.
const DEFAULT_BASE_URL = 'http://172.20.10.3:1234';

export class LMStudioService {
  private static baseUrl: string = DEFAULT_BASE_URL;
  private static selectedModel: string | null = null;
  private static abortController: AbortController | null = null;

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  static setBaseUrl(url: string): void {
    // Strip trailing slash
    this.baseUrl = url.replace(/\/$/, '');
    Logger.info(`[LMStudio] Base URL set to: ${this.baseUrl}`);
  }

  static getBaseUrl(): string {
    return this.baseUrl;
  }

  /** Manually pin to a specific model ID (as shown in /v1/models). */
  static setModel(modelId: string | null): void {
    this.selectedModel = modelId;
    Logger.info(`[LMStudio] Model set to: ${modelId ?? '(auto)'}`);
  }

  static getCurrentModel(): string | null {
    return this.selectedModel;
  }

  // ---------------------------------------------------------------------------
  // Availability & Model List
  // ---------------------------------------------------------------------------

  /** Pings LM Studio's /v1/models to check if the server is reachable. */
  static async isAvailable(): Promise<boolean> {
    const url = `${this.baseUrl}/v1/models`;
    Logger.info(`[LMStudio] Checking availability at ${url}`);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      Logger.info(`[LMStudio] Ping response: ${response.status} ${response.statusText}`);
      return response.ok;
    } catch (err: any) {
      Logger.error(`[LMStudio] Unreachable at ${url} — ${err?.message ?? err}`);
      return false;
    }
  }

  /** Returns the list of model IDs currently loaded in LM Studio. */
  static async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return (data.data ?? []).map((m: {id: string}) => m.id);
    } catch (error) {
      Logger.error('[LMStudio] Failed to fetch models:', error);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Chat Completion
  // ---------------------------------------------------------------------------

  static async chatCompletion(
    messages: Message[],
    config: Partial<LlamaConfig> = {},
    onToken?: (token: string) => void,
  ): Promise<string> {
    const model = this.selectedModel ?? (await this._getFirstAvailableModel());
    const payload = {
      model,
      messages: messages.map(m => ({role: m.role, content: m.content})),
      temperature: config.temperature ?? 0.7,
      top_p: config.topP ?? 0.9,
      max_tokens: config.maxTokens ?? 2048,
      stream: !!onToken,
    };

    Logger.debug('[LMStudio] chatCompletion →', {model, stream: payload.stream});

    this.abortController = new AbortController();

    try {
      if (onToken) {
        return await this._streamCompletion(payload, onToken);
      } else {
        return await this._nonStreamCompletion(payload);
      }
    } finally {
      this.abortController = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Tool Calling
  // ---------------------------------------------------------------------------

  static async chatCompletionWithTools(
    messages: Message[],
    tools: Tool[],
    config: Partial<LlamaConfig> = {},
    onToken?: (token: string) => void,
    onToolUsage?: (
      stage: 'tool_call' | 'tool_result' | 'generating',
      toolName?: string,
      toolArgs?: Record<string, any>,
      toolResult?: any,
    ) => void,
  ): Promise<{response: string; usedTool?: boolean; toolName?: string}> {
    const model = this.selectedModel ?? (await this._getFirstAvailableModel());
    const openAITools = tools.map(_toolToOpenAI);

    const apiMessages: OpenAIMessage[] = messages.map(m => ({
      role: m.role as OpenAIMessage['role'],
      content: m.content,
    }));

    Logger.debug('[LMStudio] chatCompletionWithTools →', {
      model,
      tools: openAITools.map(t => t.function.name),
    });

    this.abortController = new AbortController();

    try {
      // Phase 1: Tool detection (non-streaming so we can inspect tool_calls)
      const detectionPayload = {
        model,
        messages: apiMessages,
        tools: openAITools,
        tool_choice: 'auto',
        temperature: config.toolDetectionTemp ?? config.temperature ?? 0.4,
        max_tokens: config.toolDetectionMaxTokens ?? 512,
        stream: false,
      };

      const detectionResponse = await this._rawCompletion(detectionPayload);
      const choice = detectionResponse.choices?.[0];

      if (choice?.finish_reason === 'tool_calls' && choice.message?.tool_calls?.length) {
        const toolCall = choice.message.tool_calls[0];
        const toolName = toolCall.function.name;
        let toolArgs: Record<string, any> = {};

        try {
          toolArgs = JSON.parse(toolCall.function.arguments ?? '{}');
        } catch {
          Logger.warn('[LMStudio] Failed to parse tool args:', toolCall.function.arguments);
        }

        Logger.info(`[LMStudio] Tool call detected: ${toolName}`, toolArgs);
        onToolUsage?.('tool_call', toolName, toolArgs);

        // Execute the tool
        let toolResult: any;
        try {
          toolResult = await ToolService.executeTool({id: toolCall.id, name: toolName, arguments: toolArgs});
        } catch (err: any) {
          toolResult = {error: err?.message ?? 'Tool execution failed'};
        }

        Logger.debug('[LMStudio] Tool result:', toolResult);
        onToolUsage?.('tool_result', toolName, toolArgs, toolResult);

        // Phase 2: Final response with tool result (streaming)
        onToolUsage?.('generating');
        const finalMessages: OpenAIMessage[] = [
          ...apiMessages,
          {role: 'assistant', content: null, tool_calls: choice.message.tool_calls},
          {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          },
        ];

        const finalPayload = {
          model,
          messages: finalMessages,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens ?? 2048,
          stream: !!onToken,
        };

        const finalResponse = onToken
          ? await this._streamCompletion(finalPayload, onToken)
          : await this._nonStreamCompletion(finalPayload);

        return {response: finalResponse, usedTool: true, toolName};
      }

      // No tool call — return the text content directly (stream it if callback given)
      const content = choice?.message?.content ?? '';

      if (onToken) {
        // Re-stream the already-received content token by token
        for (const char of content) {
          onToken(char);
        }
      }

      return {response: content, usedTool: false};
    } finally {
      this.abortController = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Stop
  // ---------------------------------------------------------------------------

  static stopGeneration(): void {
    this.abortController?.abort();
    Logger.info('[LMStudio] Generation stopped');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private static async _getFirstAvailableModel(): Promise<string> {
    const models = await this.getAvailableModels();
    if (models.length === 0) {
      throw new Error(
        'LM Studio: no models are currently loaded. Load a model in LM Studio first.',
      );
    }
    return models[0];
  }

  private static async _rawCompletion(payload: Record<string, any>): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`LM Studio API error ${response.status}: ${text}`);
    }

    return response.json();
  }

  private static async _nonStreamCompletion(payload: Record<string, any>): Promise<string> {
    const data = await this._rawCompletion({...payload, stream: false});
    return data.choices?.[0]?.message?.content ?? '';
  }

  private static async _streamCompletion(
    payload: Record<string, any>,
    onToken: (token: string) => void,
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Accept: 'text/event-stream'},
      body: JSON.stringify({...payload, stream: true}),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`LM Studio API error ${response.status}: ${text}`);
    }

    const reader = (response as any).body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined;
    if (!reader) {
      // Fallback: response.body not available — read full body and emit at once
      const text = await response.text();
      const content = _parseSSEFull(text);
      onToken(content);
      return content;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          return fullText;
        }
        try {
          const chunk = JSON.parse(data);
          const token: string = chunk.choices?.[0]?.delta?.content ?? '';
          if (token) {
            fullText += token;
            onToken(token);
          }
        } catch {
          // Malformed chunk — skip
        }
      }
    }

    return fullText;
  }
}

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

function _toolToOpenAI(tool: Tool): Record<string, any> {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const param of tool.parameters) {
    properties[param.name] = {
      type: param.type,
      description: param.description,
      ...(param.enum ? {enum: param.enum} : {}),
    };
    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties,
        ...(required.length ? {required} : {}),
      },
    },
  };
}

/** Parse a full SSE body (non-streaming fallback) and concatenate content. */
function _parseSSEFull(body: string): string {
  let result = '';
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) {
      continue;
    }
    const data = trimmed.slice(5).trim();
    if (data === '[DONE]') {
      break;
    }
    try {
      const chunk = JSON.parse(data);
      result += chunk.choices?.[0]?.delta?.content ?? '';
    } catch {
      // skip
    }
  }
  return result;
}
