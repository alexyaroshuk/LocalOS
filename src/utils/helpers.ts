/**
 * Utility functions for the LocalOS app
 */

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format timestamp to readable date/time
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Get chat template for specific model
 * Returns the prompt template based on model type
 */
export function getChatTemplate(
  modelName: string,
  messages: Array<{role: string; content: string}>,
): string {
  const modelLower = modelName.toLowerCase();

  // Llama 3 / 3.1 / 3.2 format
  if (modelLower.includes('llama-3') || modelLower.includes('llama3')) {
    let prompt = '<|begin_of_text|>';
    for (const msg of messages) {
      prompt += `<|start_header_id|>${msg.role}<|end_header_id|>\n\n${msg.content}<|eot_id|>`;
    }
    prompt += '<|start_header_id|>assistant<|end_header_id|>\n\n';
    return prompt;
  }

  // Phi-3 format
  if (modelLower.includes('phi')) {
    let prompt = '';
    for (const msg of messages) {
      if (msg.role === 'system') {
        prompt += `<|system|>\n${msg.content}<|end|>\n`;
      } else if (msg.role === 'user') {
        prompt += `<|user|>\n${msg.content}<|end|>\n`;
      } else {
        prompt += `<|assistant|>\n${msg.content}<|end|>\n`;
      }
    }
    prompt += '<|assistant|>\n';
    return prompt;
  }

  // Gemma format
  if (modelLower.includes('gemma')) {
    let prompt = '<bos>';
    for (const msg of messages) {
      if (msg.role === 'user') {
        prompt += `<start_of_turn>user\n${msg.content}<end_of_turn>\n`;
      } else if (msg.role === 'assistant') {
        prompt += `<start_of_turn>model\n${msg.content}<end_of_turn>\n`;
      }
    }
    prompt += '<start_of_turn>model\n';
    return prompt;
  }

  // Default/generic format (alpaca-style)
  let prompt = '';
  for (const msg of messages) {
    if (msg.role === 'system') {
      prompt += `### System:\n${msg.content}\n\n`;
    } else if (msg.role === 'user') {
      prompt += `### User:\n${msg.content}\n\n`;
    } else {
      prompt += `### Assistant:\n${msg.content}\n\n`;
    }
  }
  prompt += '### Assistant:\n';
  return prompt;
}

/**
 * Validate model file path
 */
export function isValidModelPath(path: string): boolean {
  return path.endsWith('.gguf');
}

/**
 * Extract model name from filename
 */
export function extractModelName(filename: string): string {
  return filename.replace('.gguf', '').replace(/-/g, ' ');
}
