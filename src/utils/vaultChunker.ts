/**
 * Pure markdown chunker — no platform deps, fully unit-testable.
 * Used by VaultIndexService to split files into embedding-sized chunks.
 */

export interface Chunk {
  heading: string | null;
  text: string;
}

export const MAX_CHUNK_CHARS = 1024; // ~256 tokens at ~4 chars/token
export const MIN_CHUNK_CHARS = 16;

export function chunkMarkdown(markdown: string): Chunk[] {
  if (!markdown || markdown.trim().length === 0) {
    return [];
  }

  const lines = markdown.split(/\r?\n/);
  const sections: Chunk[] = [];
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text.length >= MIN_CHUNK_CHARS) {
      sections.push({heading: currentHeading, text});
    }
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  const out: Chunk[] = [];
  for (const section of sections) {
    if (section.text.length <= MAX_CHUNK_CHARS) {
      out.push(section);
    } else {
      out.push(...splitOversized(section));
    }
  }
  return out;
}

function splitOversized(chunk: Chunk): Chunk[] {
  const paragraphs = chunk.text.split(/\n\s*\n/);
  const out: Chunk[] = [];
  let buf = '';
  for (const p of paragraphs) {
    const candidate = buf ? `${buf}\n\n${p}` : p;
    if (candidate.length <= MAX_CHUNK_CHARS) {
      buf = candidate;
    } else {
      if (buf) out.push({heading: chunk.heading, text: buf});
      if (p.length <= MAX_CHUNK_CHARS) {
        buf = p;
      } else {
        for (let i = 0; i < p.length; i += MAX_CHUNK_CHARS) {
          out.push({heading: chunk.heading, text: p.slice(i, i + MAX_CHUNK_CHARS)});
        }
        buf = '';
      }
    }
  }
  if (buf) out.push({heading: chunk.heading, text: buf});
  return out.filter(c => c.text.length >= MIN_CHUNK_CHARS);
}

/** Stable djb2 32-bit hash for chunk deduplication. */
export function chunkHash(vaultPath: string, heading: string | null, text: string): string {
  const input = `${vaultPath}::${heading ?? ''}::${text}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
