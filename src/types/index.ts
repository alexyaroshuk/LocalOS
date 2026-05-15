// Pocketpal-style inference timing stats. Surfaced under assistant bubbles.
// Native fields come from llama.rn's NativeCompletionResultTimings.
// `time_to_first_token_ms` is measured client-side (not in native timings).
export interface MessageTimings {
  predicted_per_token_ms?: number;
  predicted_per_second?: number;
  time_to_first_token_ms?: number;
  predicted_n?: number;
  prompt_n?: number;
  prompt_ms?: number;
}

// Message types for chat
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  timings?: MessageTimings;
}

// Action message type - actions are treated as messages in the chat
export interface ActionMessage {
  id: string;
  role: 'action';
  actionType: 'thinking' | 'tool_call' | 'tool_result' | 'generating' | 'decision';
  content: string; // Description like "Thought for 2s" or "Used search_web"
  timestamp: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: any;
  error?: string;
  isComplete: boolean;
}

// Model information
export interface ModelInfo {
  id: string;
  name: string;
  filename: string;
  size: number; // in bytes
  quantization: string; // e.g., 'Q4_K_M', 'Q5_K_S'
  downloaded: boolean;
  downloadProgress?: number;
  localPath?: string;
  huggingFaceRepo?: string;
}

// Llama context configuration
export interface LlamaConfig {
  contextSize: number;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  stopSequences: string[];
  seed?: number;
  repeatPenalty: number;
  nGpuLayers?: number; // for GPU acceleration
  // Optional overrides for tool detection phase
  toolDetectionTemp?: number;
  toolDetectionMaxTokens?: number;
}

// Union type for all chat items
export type ChatItem = Message | ActionMessage;

// Chat session
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatItem[];
  modelId: string;
  createdAt: number;
  updatedAt: number;
}

// Model download status
export interface DownloadStatus {
  modelId: string;
  progress: number; // 0-100
  bytesDownloaded: number;
  totalBytes: number;
  status: 'idle' | 'downloading' | 'completed' | 'error' | 'paused';
  error?: string;
}

// App state
export interface AppState {
  currentModel: ModelInfo | null;
  availableModels: ModelInfo[];
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  llamaConfig: LlamaConfig;
  isModelLoading: boolean;
  isGenerating: boolean;
}

// Tool/Function calling types
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (args: Record<string, any>) => Promise<any>;
  checkAvailability?: () => Promise<{available: boolean; reason?: string}>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  id: string;
  name: string;
  result: any;
  error?: string;
  success?: boolean;
  data?: any;
}

// Extended message type to support tool calls
export interface MessageWithTools extends Message {
  tool_calls?: ToolCall[];
  tool_result?: ToolResult;
}

// Agent action tracking types
export type AgentActionType = 'thinking' | 'decision' | 'tool_call' | 'tool_result' | 'generating';

export interface AgentAction {
  id: string;
  type: AgentActionType;
  startTime: number;
  endTime?: number;
  duration?: number; // in milliseconds
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: any;
  error?: string;
  thinkingContent?: string; // For storing the thought process if available
}

// Extended message type to support agent actions
export interface MessageWithActions extends Message {
  actions?: AgentAction[];
}
