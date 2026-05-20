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
 * Extract vault file paths from a tool result body. Handles the shapes
 * returned by vault_lookup, search_vault, list_vault_files, and
 * read_vault_file. Returns deduped {path, label} pairs.
 */
export function extractVaultSources(
  toolResult: any,
): Array<{path: string; label: string}> {
  if (!toolResult) return [];
  const r = toolResult.result ?? toolResult;
  if (!r || typeof r !== 'object') return [];

  const seen = new Set<string>();
  const out: Array<{path: string; label: string}> = [];

  const add = (raw: unknown) => {
    if (typeof raw !== 'string') return;
    const path = raw.trim();
    if (!path || path.startsWith('/')) {
      // Skip absolute paths (would leak device paths). Only relative.
      return;
    }
    if (seen.has(path)) return;
    seen.add(path);
    const label = path.split('/').pop() || path;
    out.push({path, label});
  };

  // vault_lookup → { path: "Foo/Bar.md" }
  if (typeof r.path === 'string') add(r.path);

  // read_vault_file → { file: { path: "Foo/Bar.md" } }
  if (r.file && typeof r.file.path === 'string') add(r.file.path);

  // search_vault → { matches: [{ path }, ...] }
  if (Array.isArray(r.matches)) {
    for (const m of r.matches) add(m?.path);
  }

  // list_vault_files → { files: [{ path }, ...] }
  if (Array.isArray(r.files)) {
    for (const f of r.files) add(f?.path);
  }

  return out;
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

  // Llama 3 / 3.1 / 3.2 format (matches llama-3, llama3, llama_3)
  if (modelLower.includes('llama') && (modelLower.includes('3.') || modelLower.includes('3_') || modelLower.includes('3-') || modelLower.includes('3'))) {
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

  // Gemma 4 format - distinct from Gemma 2/3.
  // Uses <|turn>role / <turn|> markers and has a native system role.
  // Ref: https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4
  // Must run before the generic gemma branch below.
  if (modelLower.includes('gemma-4') || modelLower.includes('gemma4')) {
    let prompt = '';
    for (const msg of messages) {
      const role = msg.role === 'assistant' ? 'model' : msg.role;
      prompt += `<|turn>${role}\n${msg.content}<turn|>\n`;
    }
    prompt += '<|turn>model\n';
    return prompt;
  }

  // Gemma / Gemma 2 / Gemma 3 / Gemma 3n format
  // No dedicated system role - merge system content into first user turn.
  if (modelLower.includes('gemma')) {
    const systemParts: string[] = [];
    const turns: Array<{role: 'user' | 'assistant'; content: string}> = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        turns.push({role: msg.role, content: msg.content});
      }
    }

    const systemBlock = systemParts.join('\n\n').trim();
    let firstUserMerged = false;

    let prompt = '<bos>';
    for (const turn of turns) {
      if (turn.role === 'user') {
        const content = !firstUserMerged && systemBlock
          ? `${systemBlock}\n\n${turn.content}`
          : turn.content;
        firstUserMerged = true;
        prompt += `<start_of_turn>user\n${content}<end_of_turn>\n`;
      } else {
        prompt += `<start_of_turn>model\n${turn.content}<end_of_turn>\n`;
      }
    }

    // Edge case: system only, no user turn yet - emit as user turn
    if (!firstUserMerged && systemBlock) {
      prompt += `<start_of_turn>user\n${systemBlock}<end_of_turn>\n`;
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

const QUERY_STOPWORDS = new Set([
  'what', 'whats', 'where', 'when', 'who', 'why', 'how', 'which',
  'i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'we', 'our',
  'us', 'they', 'them', 'their', 'he', 'she', 'it', 'its',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would',
  'can', 'could', 'should', 'may', 'might', 'must',
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'some', 'any',
  'please', 'just', 'really', 'actually', 'basically', 'simply',
  'tell', 'show', 'give', 'find', 'search', 'lookup', 'look', 'get',
  'know', 'remember', 'about', 'for', 'with', 'from', 'into', 'on', 'in',
  'at', 'to', 'of', 'and', 'or', 'but', 'so', 'if', 'then', 'than',
  'help', 'cant', 'wont', 'dont', 'didnt', 'havent', 'wasnt', 'isnt',
  'arent', 'couldnt', 'shouldnt', 'wouldnt',
  'u', 'ur', 'plz', 'pls', 'thx', 'thanks',
]);

/**
 * Reduce a natural-language user utterance to a compact search query.
 * Lowercases, strips punctuation & contractions, removes stopwords/fillers.
 * Falls back to the trimmed original if stripping yields an empty string.
 */
export function stripStopwords(text: string): string {
  if (!text) return '';
  const cleaned = text
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w && !QUERY_STOPWORDS.has(w))
    .join(' ')
    .trim();
  return cleaned || text.trim();
}
