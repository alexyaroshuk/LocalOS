/**
 * Model-specific configurations for different LLMs
 */

export type ModelType = 'llama-3.2-1b-function-calling' | 'llama-3.1-8b-instruct' | 'llama-8x3b-moe' | 'gemma-4-e4b' | 'gemma-4-e2b';

export interface ModelConfig {
  /** Model type identifier */
  type: ModelType;

  /** Display name */
  displayName: string;

  /** Tool calling format */
  toolFormat: 'langchain-pydantic' | 'transformers-native';

  /** Whether model needs special tool prompting */
  needsToolExamples: boolean;

  /** Temperature settings for tool detection */
  toolDetectionTemp: number;

  /** Max tokens for tool detection phase */
  toolDetectionMaxTokens: number;

  /** Whether to use legacy or langchain prompt style */
  useLangchainPrompt: boolean;

  /** Context window size */
  contextSize: number;

  /** Stop sequences as plain strings. Forwarded to llama.rn `stop` param. */
  stopWords?: string[];

  /** Model description */
  description: string;
}

/**
 * Predefined model configurations
 */
export const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
  'llama-3.2-1b-function-calling': {
    type: 'llama-3.2-1b-function-calling',
    displayName: 'Llama 3.2 1B (Custom Function Calling)',
    toolFormat: 'langchain-pydantic',
    needsToolExamples: true, // Needs extensive examples
    toolDetectionTemp: 0.7,
    toolDetectionMaxTokens: 150,
    useLangchainPrompt: true,
    contextSize: 4096,
    description: 'Custom fine-tuned for function calling using Langchain format. Requires explicit examples in prompt.',
  },
  'llama-3.1-8b-instruct': {
    type: 'llama-3.1-8b-instruct',
    displayName: 'Llama 3.1 8B (Official Tool Support)',
    toolFormat: 'transformers-native',
    needsToolExamples: true, // Q4_K_M quant + abliterated variant under-fires tools without examples
    toolDetectionTemp: 0.1, // Determinism > creativity for routing
    toolDetectionMaxTokens: 512,
    useLangchainPrompt: false, // Use native transformers format
    contextSize: 8192, // 8K context - realistic for mobile (128K theoretical max, but memory intensive)
    stopWords: [
      '<|eot_id|>',
      '<|end_of_text|>',
      '<|start_header_id|>user',
      '<|start_header_id|>system',
    ],
    description: 'Official Meta model with native tool calling via transformers chat templates. Better tool calling accuracy.',
  },
  'llama-8x3b-moe': {
    type: 'llama-8x3b-moe',
    displayName: 'Llama 3.2 8x3B MOE (18.4B)',
    toolFormat: 'langchain-pydantic',
    needsToolExamples: true, // MOE models benefit from tool examples
    toolDetectionTemp: 0.7,
    toolDetectionMaxTokens: 250,
    useLangchainPrompt: true,
    contextSize: 2048, // Reduced context for large 18.4B model on mobile - mmap handles rest
    stopWords: [
      '<|eot_id|>',
      '<|end_of_text|>',
      '<|start_header_id|>user',
    ],
    description: 'Large 18.4B Mixture of Experts model. Requires mmap (no mlock on iOS due to memory constraints). Good reasoning and tool calling.',
  },
  'gemma-4-e4b': {
    type: 'gemma-4-e4b',
    displayName: 'Gemma 4 E4B',
    toolFormat: 'transformers-native',
    needsToolExamples: false,
    toolDetectionTemp: 0.3,
    toolDetectionMaxTokens: 512,
    useLangchainPrompt: false,
    contextSize: 4096,
    stopWords: [
      '<turn|>',
      '<|turn>user',
      '<|turn>system',
    ],
    description: 'Gemma 4 E4B with native tool calling (<|tool_call> tokens). Uses jinja chat template + tools param. Avoid Q2_K - use Q4_K_M or higher.',
  },
  'gemma-4-e2b': {
    type: 'gemma-4-e2b',
    displayName: 'Gemma 4 E2B',
    toolFormat: 'transformers-native',
    needsToolExamples: false,
    toolDetectionTemp: 0.3,
    toolDetectionMaxTokens: 512,
    useLangchainPrompt: false,
    contextSize: 4096,
    stopWords: [
      '<turn|>',
      '<|turn>user',
      '<|turn>system',
    ],
    description: 'Gemma 4 E2B - smaller variant, better fit for iOS memory constraints.',
  },
};

/**
 * Detect model type from model name
 */
export function detectModelType(modelName: string): ModelType {
  const lowerName = modelName.toLowerCase();

  // Gemma 4 variants (native <|tool_call> tokens, jinja-aware chat template).
  // E4B: 4B effective params. E2B: 2B effective params.
  if (lowerName.includes('gemma')) {
    if (lowerName.includes('e4b') || lowerName.includes('4b')) {
      return 'gemma-4-e4b';
    }
    if (lowerName.includes('e2b') || lowerName.includes('2b')) {
      return 'gemma-4-e2b';
    }
    return 'gemma-4-e4b';
  }

  // Check for Llama 8x3B MOE (must check before 8B to avoid false matches)
  if ((lowerName.includes('8x3b') || lowerName.includes('8x 3b') || lowerName.includes('8x3 b')) &&
      (lowerName.includes('3.2') || lowerName.includes('llama'))) {
    return 'llama-8x3b-moe';
  }

  // Check for Llama 3.1 8B
  if (lowerName.includes('llama') && lowerName.includes('3.1') && lowerName.includes('8b')) {
    return 'llama-3.1-8b-instruct';
  }

  // Check for Llama 3.2 1B function calling
  if (lowerName.includes('llama') && lowerName.includes('3.2') && lowerName.includes('1b')) {
    return 'llama-3.2-1b-function-calling';
  }

  // Default to 3.2 1B (current model)
  return 'llama-3.2-1b-function-calling';
}

/**
 * Get configuration for a model
 */
export function getModelConfig(modelName: string): ModelConfig {
  const modelType = detectModelType(modelName);
  return MODEL_CONFIGS[modelType];
}
