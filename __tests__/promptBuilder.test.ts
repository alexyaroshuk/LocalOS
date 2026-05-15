/**
 * Unit tests for the PromptBuilder token-budget utilities.
 */

import {PromptBuilder, TOKEN_BUDGETS} from '../src/services/PromptBuilder';

describe('PromptBuilder.estimateTokens', () => {
  test('empty string is zero tokens', () => {
    expect(PromptBuilder.estimateTokens('')).toBe(0);
  });

  test('scales roughly with char length', () => {
    expect(PromptBuilder.estimateTokens('1234')).toBe(1);
    expect(PromptBuilder.estimateTokens('12345678')).toBe(2);
    expect(PromptBuilder.estimateTokens('a'.repeat(400))).toBe(100);
  });
});

describe('PromptBuilder.truncateToTokens', () => {
  test('under-budget text is returned unchanged', () => {
    const text = 'short string';
    expect(PromptBuilder.truncateToTokens(text, 1000)).toBe(text);
  });

  test('over-budget text is clipped and marked', () => {
    const text = 'x'.repeat(10000);
    const out = PromptBuilder.truncateToTokens(text, 10); // ~40 chars
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out).toMatch(/truncated/);
  });

  test('returns empty string for empty input', () => {
    expect(PromptBuilder.truncateToTokens('', 100)).toBe('');
  });
});

describe('PromptBuilder.truncateToolResult', () => {
  test('stringifies objects', () => {
    const out = PromptBuilder.truncateToolResult({found: true, path: 'p/x.md'}, 100);
    expect(out).toContain('found');
    expect(out).toContain('p/x.md');
  });

  test('passes through strings', () => {
    expect(PromptBuilder.truncateToolResult('hello world', 100)).toBe('hello world');
  });

  test('handles null/undefined safely', () => {
    expect(PromptBuilder.truncateToolResult(null)).toBe('');
    expect(PromptBuilder.truncateToolResult(undefined)).toBe('');
  });

  test('clips large payloads to default budget', () => {
    const big = {data: 'x'.repeat(50000)};
    const out = PromptBuilder.truncateToolResult(big);
    // Default budget is 1500 tokens => ~6000 chars
    expect(out.length).toBeLessThanOrEqual(TOKEN_BUDGETS.toolResult * 4 + 20);
    expect(out).toMatch(/truncated/);
  });
});

describe('PromptBuilder.needsSummarization', () => {
  test('under fill ratio returns false', () => {
    const result = PromptBuilder.needsSummarization({
      systemPromptChars: 1000,
      messagesChars: 1000,
      contextSize: 8192,
    });
    expect(result).toBe(false);
  });

  test('above fill ratio returns true', () => {
    const result = PromptBuilder.needsSummarization({
      systemPromptChars: 15000,
      messagesChars: 15000,
      contextSize: 8192,
    });
    expect(result).toBe(true);
  });
});

describe('PromptBuilder.rollingWindow', () => {
  test('keeps everything when under budget', () => {
    const messages = [
      {content: 'a'.repeat(100)},
      {content: 'b'.repeat(100)},
      {content: 'c'.repeat(100)},
    ];
    const result = PromptBuilder.rollingWindow(messages, 1000);
    expect(result.kept.length).toBe(3);
    expect(result.droppedCount).toBe(0);
  });

  test('drops oldest when over budget', () => {
    const messages = [
      {content: 'old'.repeat(200)},   // ~600 chars
      {content: 'mid'.repeat(200)},
      {content: 'new'.repeat(200)},
    ];
    // 200 tokens budget = ~800 chars; should keep last 1, drop 2.
    const result = PromptBuilder.rollingWindow(messages, 200);
    expect(result.kept.length).toBeLessThan(3);
    expect(result.droppedCount).toBeGreaterThan(0);
    // Most recent must be retained.
    expect(result.kept[result.kept.length - 1].content).toContain('new');
  });
});
