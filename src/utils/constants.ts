/**
 * App constants and configuration
 */

// Default Llama configuration
export const DEFAULT_LLAMA_CONFIG = {
  contextSize: 2048,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxTokens: 512,
  stopSequences: [],
  repeatPenalty: 1.1,
  nGpuLayers: 99, // Use GPU acceleration if available (will use CPU if not supported)
};

// Recommended models for mobile devices
export const RECOMMENDED_MODELS = [
  {
    id: 'llama-3.2-3b-q4',
    name: 'Llama 3.2 3B (Q4)',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: 2100000000, // ~2GB
    quantization: 'Q4_K_M',
    downloaded: false,
    huggingFaceRepo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
  },
  {
    id: 'phi-3-mini-q4',
    name: 'Phi-3 Mini (Q4)',
    filename: 'Phi-3-mini-4k-instruct-Q4_K_M.gguf',
    size: 2300000000, // ~2.3GB
    quantization: 'Q4_K_M',
    downloaded: false,
    huggingFaceRepo: 'microsoft/Phi-3-mini-4k-instruct-gguf',
  },
  {
    id: 'gemma-2b-q4',
    name: 'Gemma 2B (Q4)',
    filename: 'gemma-2b-it-Q4_K_M.gguf',
    size: 1560000000, // ~1.5GB
    quantization: 'Q4_K_M',
    downloaded: false,
    huggingFaceRepo: 'google/gemma-2b-it-gguf',
  },
];

// Storage keys for AsyncStorage
export const STORAGE_KEYS = {
  CHAT_SESSIONS: '@localos_chat_sessions',
  CURRENT_SESSION: '@localos_current_session',
  DOWNLOADED_MODELS: '@localos_downloaded_models',
  LLAMA_CONFIG: '@localos_llama_config',
  CURRENT_MODEL: '@localos_current_model',
  RECENT_MODELS: '@localos_recent_models',
};

// File paths
export const MODEL_STORAGE_DIR = 'models';

// System prompts
export const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful AI assistant running locally on this device. Be concise and accurate in your responses.';

// Error messages
export const ERROR_MESSAGES = {
  MODEL_NOT_LOADED: 'Please load a model first',
  MODEL_LOAD_FAILED: 'Failed to load model. Please try again.',
  DOWNLOAD_FAILED: 'Failed to download model. Please check your connection.',
  INSUFFICIENT_STORAGE: 'Not enough storage space for this model',
  INVALID_MODEL_FILE: 'Invalid model file format',
  GENERATION_FAILED: 'Failed to generate response',
};

// UI Constants
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_CONTEXT_MESSAGES = 20; // Keep last 20 messages in context
