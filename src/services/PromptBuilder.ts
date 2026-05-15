/**
 * PromptBuilder
 *
 * Token budget utilities for keeping prompts within the model's context
 * window. Pure functions only — no llama.rn or filesystem dependencies — so
 * they can be unit-tested under Node without device-only modules.
 *
 * Budget rationale (8192 ctx default for Llama-3.1-8B):
 *   system prompt + core memory  ≤ 1500
 *   tool schemas                 ≤  500
 *   tool results (injected)      ≤ 1500
 *   conversation history          rolling
 *   response headroom            ≥ 1000
 */

/** Conservative char-per-token estimate. Matches what LlamaService.getTokenCount
 * falls back to when the real tokenizer isn't available. */
const CHARS_PER_TOKEN_EST = 4;

export const TOKEN_BUDGETS = {
  systemAndCoreMemory: 1500,
  toolSchemas: 500,
  toolResult: 1500,
  responseHeadroom: 1000,
  summarizeAtFillRatio: 0.8,
} as const;

export class PromptBuilder {
  /** Rough token count from char length. Use only when you don't have access
   * to a real tokenizer — the LlamaService.tokenize path is preferred when
   * a model is loaded. */
  static estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN_EST);
  }

  /** Truncate text to fit within an approximate token budget. Adds an
   * ellipsis marker so downstream consumers (and the model) know the
   * content was clipped. */
  static truncateToTokens(text: string, maxTokens: number): string {
    if (!text) return '';
    const maxChars = Math.max(0, maxTokens * CHARS_PER_TOKEN_EST);
    if (text.length <= maxChars) return text;
    // Keep the head — most tool results put the salient info first.
    const marker = '\n…[truncated]';
    return text.slice(0, Math.max(0, maxChars - marker.length)) + marker;
  }

  /**
   * Format a tool result payload as a string and clip it to the token
   * budget. Accepts strings, objects, errors, and arrays.
   */
  static truncateToolResult(payload: unknown, maxTokens: number = TOKEN_BUDGETS.toolResult): string {
    let text: string;
    if (payload == null) {
      text = '';
    } else if (typeof payload === 'string') {
      text = payload;
    } else {
      try {
        text = JSON.stringify(payload);
      } catch {
        text = String(payload);
      }
    }
    return this.truncateToTokens(text, maxTokens);
  }

  /**
   * Decide whether the message history is close to filling the context.
   * Returns true when system + history exceed the configured fill ratio of
   * total context size, accounting for the response headroom we want to
   * preserve.
   */
  static needsSummarization(args: {
    systemPromptChars: number;
    messagesChars: number;
    contextSize: number;
    fillRatio?: number;
  }): boolean {
    const fillRatio = args.fillRatio ?? TOKEN_BUDGETS.summarizeAtFillRatio;
    const totalTokens = this.estimateTokens(' '.repeat(args.systemPromptChars + args.messagesChars));
    const budget = args.contextSize - TOKEN_BUDGETS.responseHeadroom;
    return totalTokens >= budget * fillRatio;
  }

  /**
   * Rolling-window trim: keep the most recent messages whose combined
   * length fits within `keepTokens`. Older messages get dropped — the
   * caller is responsible for summarizing them into a single system note
   * if it wants to preserve any signal from them.
   */
  static rollingWindow<T extends {content: string}>(messages: T[], keepTokens: number): {
    kept: T[];
    droppedCount: number;
    droppedChars: number;
  } {
    const keepChars = keepTokens * CHARS_PER_TOKEN_EST;
    const kept: T[] = [];
    let running = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const len = (m.content || '').length;
      if (running + len > keepChars && kept.length > 0) {
        const droppedCount = i + 1;
        const droppedChars = messages.slice(0, droppedCount).reduce((s, x) => s + (x.content || '').length, 0);
        return {kept, droppedCount, droppedChars};
      }
      running += len;
      kept.unshift(m);
    }
    return {kept, droppedCount: 0, droppedChars: 0};
  }
}
