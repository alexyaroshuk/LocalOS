/**
 * Model-specific configurations for different LLMs
 */

export type ModelType = 'llama-3.2-1b-function-calling' | 'llama-3.1-8b-instruct' | 'llama-8x3b-moe' | 'gemma-3n-e4b' | 'gemma-3n-e2b';

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
    needsToolExamples: false, // Native tool support, no examples needed
    toolDetectionTemp: 0.3, // Lower temp for more precise tool calling
    toolDetectionMaxTokens: 512, // Increased from 200 - need room for complete XML tool calls
    useLangchainPrompt: false, // Use native transformers format
    contextSize: 8192, // 8K context - realistic for mobile (128K theoretical max, but memory intensive)
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
    description: 'Large 18.4B Mixture of Experts model. Requires mmap (no mlock on iOS due to memory constraints). Good reasoning and tool calling.',
  },
  'gemma-3n-e4b': {
    type: 'gemma-3n-e4b',
    displayName: 'Gemma 3n E4B',
    toolFormat: 'langchain-pydantic',
    needsToolExamples: true,
    toolDetectionTemp: 0.4,
    toolDetectionMaxTokens: 256,
    useLangchainPrompt: true,
    contextSize: 4096,
    description: 'Gemma 3n E4B (MatFormer + Per-Layer Embeddings). Requires llama.rn >=0.9 for full support. Avoid Q2_K - use Q4_K_M or higher.',
  },
  'gemma-3n-e2b': {
    type: 'gemma-3n-e2b',
    displayName: 'Gemma 3n E2B',
    toolFormat: 'langchain-pydantic',
    needsToolExamples: true,
    toolDetectionTemp: 0.4,
    toolDetectionMaxTokens: 256,
    useLangchainPrompt: true,
    contextSize: 4096,
    description: 'Gemma 3n E2B - smaller variant, better fit for iOS memory constraints.',
  },
};

/**
 * Detect model type from model name
 */
export function detectModelType(modelName: string): ModelType {
  const lowerName = modelName.toLowerCase();

  // Gemma 3n variants (uploaders sometimes mislabel as "gemma-4")
  // E4B: 4B effective params via MatFormer
  // E2B: 2B effective params - lighter
  if (lowerName.includes('gemma')) {
    if (lowerName.includes('e4b') || lowerName.includes('4b')) {
      return 'gemma-3n-e4b';
    }
    if (lowerName.includes('e2b') || lowerName.includes('2b')) {
      return 'gemma-3n-e2b';
    }
    // Unknown Gemma variant - default to E4B config
    return 'gemma-3n-e4b';
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
