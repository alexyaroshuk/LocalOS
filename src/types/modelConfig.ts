/**
 * Model-specific configurations for different LLMs
 */

export type ModelType = 'llama-3.2-1b-function-calling' | 'llama-3.1-8b-instruct';

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
    contextSize: 131072, // 128k context!
    description: 'Official Meta model with native tool calling via transformers chat templates. Better tool calling accuracy.',
  },
};

/**
 * Detect model type from model name
 */
export function detectModelType(modelName: string): ModelType {
  const lowerName = modelName.toLowerCase();

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
