/**
 * Unit tests for the pure markdown chunker.
 */

import {
  chunkMarkdown,
  chunkHash,
  MAX_CHUNK_CHARS,
  MIN_CHUNK_CHARS,
} from '../src/utils/vaultChunker';

describe('chunkMarkdown', () => {
  test('empty input returns empty array', () => {
    expect(chunkMarkdown('')).toEqual([]);
    expect(chunkMarkdown('   \n  \n')).toEqual([]);
  });

  test('content without headings becomes a single chunk with null heading', () => {
    const md = 'Just some prose without any heading at all. Enough chars.';
    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBe(1);
    expect(chunks[0].heading).toBeNull();
    expect(chunks[0].text).toContain('Just some prose');
  });

  test('splits on H1/H2/H3 boundaries and assigns heading', () => {
    const md = [
      '# Top',
      'Top body content here is long enough.',
      '',
      '## Sub A',
      'Sub A body content here is long enough.',
      '',
      '### Sub Sub',
      'Sub sub body content here is long enough.',
    ].join('\n');
    const chunks = chunkMarkdown(md);
    const headings = chunks.map(c => c.heading);
    expect(headings).toEqual(['Top', 'Sub A', 'Sub Sub']);
  });

  test('H4 and deeper are NOT split as new chunks (only H1-H3)', () => {
    const md = [
      '# Top',
      'Top body content here is long enough.',
      '#### Deep',
      'Deep body stays in the Top chunk.',
    ].join('\n');
    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBe(1);
    expect(chunks[0].heading).toBe('Top');
    expect(chunks[0].text).toContain('#### Deep');
  });

  test('skips chunks below MIN_CHUNK_CHARS', () => {
    const md = [
      '# A',
      'tiny',
      '## B',
      'Long enough body to be kept as a chunk easily.',
    ].join('\n');
    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBe(1);
    expect(chunks[0].heading).toBe('B');
  });

  test('force-splits oversized section on paragraph boundaries', () => {
    const para = 'X'.repeat(800);
    const md = `# Big\n\n${para}\n\n${para}\n\n${para}`;
    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    chunks.forEach(c => {
      expect(c.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
      expect(c.heading).toBe('Big');
    });
  });

  test('hard-splits a single oversized paragraph on char count', () => {
    const para = 'Y'.repeat(MAX_CHUNK_CHARS * 2 + 50);
    const md = `# Huge\n\n${para}`;
    const chunks = chunkMarkdown(md);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    chunks.forEach(c => {
      expect(c.text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    });
  });

  test('respects MIN_CHUNK_CHARS constant', () => {
    expect(MIN_CHUNK_CHARS).toBeGreaterThan(0);
    expect(MIN_CHUNK_CHARS).toBeLessThan(MAX_CHUNK_CHARS);
  });
});

describe('chunkHash', () => {
  test('deterministic across calls', () => {
    const a = chunkHash('/v/a.md', 'Heading', 'body text');
    const b = chunkHash('/v/a.md', 'Heading', 'body text');
    expect(a).toBe(b);
  });

  test('different content yields different hash', () => {
    const a = chunkHash('/v/a.md', 'H', 'text one');
    const b = chunkHash('/v/a.md', 'H', 'text two');
    expect(a).not.toBe(b);
  });

  test('different path yields different hash', () => {
    const a = chunkHash('/v/a.md', 'H', 'same text');
    const b = chunkHash('/v/b.md', 'H', 'same text');
    expect(a).not.toBe(b);
  });

  test('null vs empty heading are equivalent in input but produce distinguishable behavior', () => {
    // The implementation treats null and '' identically (?? ''); confirm so
    // callers don't have to special-case missing headings.
    const a = chunkHash('/p', null, 'x');
    const b = chunkHash('/p', '', 'x');
    expect(a).toBe(b);
  });

  test('output is 8-char hex', () => {
    const h = chunkHash('/p', 'H', 'body');
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });
});
