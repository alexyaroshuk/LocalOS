// Message types for chat
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
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
}

// Chat session
export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
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
}

// Extended message type to support tool calls
export interface MessageWithTools extends Message {
  tool_calls?: ToolCall[];
  tool_result?: ToolResult;
}
