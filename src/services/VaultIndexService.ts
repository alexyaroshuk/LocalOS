/**
 * VaultIndexService
 *
 * Builds and queries a semantic search index over the user's vault markdown
 * files. The vault on disk is the source of truth; this service produces a
 * derived embedding index in the `vault_chunks` SQLite table. Chunks are
 * split by markdown headings (H1/H2/H3) and capped at ~256 tokens.
 *
 * Reuses: EmbeddingService.generateEmbedding for vectors,
 *         DatabaseService vault_chunks CRUD for storage.
 */

import RNFS from 'react-native-fs';
import {DatabaseService} from './DatabaseService';
import {EmbeddingService} from './EmbeddingService';
import {LlamaService} from './LlamaService';
import {VaultService} from './VaultService';
import {Logger} from '../utils/Logger';
import {chunkMarkdown, chunkHash, Chunk} from '../utils/vaultChunker';

export type VaultChunk = Chunk;

export interface VaultSearchHit {
  path: string;
  heading: string | null;
  snippet: string;
  similarity: number;
  mtime: number;
}

export class VaultIndexService {
  /** Re-export pure chunker for callers that want to test or preview chunking. */
  static chunkMarkdown(markdown: string): VaultChunk[] {
    return chunkMarkdown(markdown);
  }

  /** Re-export pure hash. */
  static chunkHash(vaultPath: string, heading: string | null, text: string): string {
    return chunkHash(vaultPath, heading, text);
  }

  /**
   * Read one vault file from disk, extract [[wiki links]] (always), chunk and
   * embed it (requires embedding model). Replaces all prior index rows for the
   * path so stale data is never left behind.
   */
  static async indexVaultFile(absolutePath: string): Promise<{
    chunksIndexed: number;
    linksIndexed: number;
    skipped: boolean;
    reason?: string;
  }> {
    // ── 1. Stat the file ─────────────────────────────────────────────────
    let stat;
    try {
      stat = await RNFS.stat(absolutePath);
    } catch (err) {
      Logger.warn(`[VaultIndex] stat failed for ${absolutePath}`, err);
      return {chunksIndexed: 0, linksIndexed: 0, skipped: true, reason: 'stat failed'};
    }
    const mtime = stat.mtime ? new Date(stat.mtime).getTime() : Date.now();

    const md = await RNFS.readFile(absolutePath, 'utf8');

    // ── 2. Link extraction (no embedding model required) ──────────────────
    let linksIndexed = 0;
    try {
      const vaultRoot = VaultService.getActiveVaultPath();
      const markdownFile = await VaultService.readMarkdownFile(absolutePath);
      const rawLinks = markdownFile.links;

      let allVaultFiles: import('../types/vault').VaultFile[] | null = null;

      const resolvedLinks = await Promise.all(
        rawLinks.map(async linkText => {
          if (!allVaultFiles && vaultRoot) {
            const scan = await VaultService.scanVault(vaultRoot);
            allVaultFiles = scan.files;
          }
          let resolvedPath: string | null = null;
          if (allVaultFiles) {
            const match = (allVaultFiles as import('../types/vault').VaultFile[]).find(
              f => f.basename.toLowerCase() === linkText.toLowerCase(),
            );
            resolvedPath = match ? match.path : null;
          }
          return {targetName: linkText, resolvedPath};
        }),
      );

      await DatabaseService.upsertVaultLinks(absolutePath, resolvedLinks);
      linksIndexed = resolvedLinks.length;
      Logger.info(`[VaultIndex] Links indexed for ${absolutePath}: ${linksIndexed}`);
    } catch (linkErr) {
      Logger.warn(`[VaultIndex] Link extraction failed for ${absolutePath}`, linkErr);
    }

    // ── 3. Chunk embedding (requires embedding model) ─────────────────────
    if (!LlamaService.isEmbeddingModelLoaded()) {
      return {chunksIndexed: 0, linksIndexed, skipped: true, reason: 'embedding model not loaded'};
    }

    const chunks = this.chunkMarkdown(md);
    if (chunks.length === 0) {
      await DatabaseService.deleteVaultChunksForPath(absolutePath);
      return {chunksIndexed: 0, linksIndexed, skipped: true, reason: 'empty file'};
    }

    // Replace strategy: wipe old chunks before inserting new ones.
    await DatabaseService.deleteVaultChunksForPath(absolutePath);

    let indexed = 0;
    for (const chunk of chunks) {
      const hash = this.chunkHash(absolutePath, chunk.heading, chunk.text);
      try {
        const embedding = await EmbeddingService.generateEmbedding(chunk.text);
        await DatabaseService.upsertVaultChunk({
          vaultPath: absolutePath,
          heading: chunk.heading,
          chunkText: chunk.text,
          embedding,
          mtime,
          chunkHash: hash,
        });
        indexed++;
      } catch (err) {
        Logger.warn(`[VaultIndex] chunk embed/store failed (${absolutePath} @ ${chunk.heading})`, err);
      }
    }

    Logger.info(`[VaultIndex] Indexed ${absolutePath} → ${indexed}/${chunks.length} chunks`);
    return {chunksIndexed: indexed, linksIndexed, skipped: false};
  }

  /**
   * Index every .md file in the active vault. Sequential — embedding is
   * single-instance and parallelism would queue at llama.rn anyway.
   */
  static async indexFullVault(onProgress?: (done: number, total: number, currentPath: string) => void): Promise<{
    filesIndexed: number;
    chunksIndexed: number;
    skipped: number;
    durationMs: number;
  }> {
    const vaultPath = VaultService.getActiveVaultPath();
    if (!vaultPath) {
      throw new Error('No active vault configured');
    }
    if (!LlamaService.isEmbeddingModelLoaded()) {
      throw new Error('Embedding model not loaded — cannot index vault');
    }

    const start = Date.now();
    const scan = await VaultService.scanVault(vaultPath);
    let filesIndexed = 0;
    let chunksIndexed = 0;
    let skipped = 0;

    for (let i = 0; i < scan.files.length; i++) {
      const file = scan.files[i];
      onProgress?.(i, scan.files.length, file.path);
      const result = await this.indexVaultFile(file.path);
      if (result.skipped) {
        skipped++;
      } else {
        filesIndexed++;
        chunksIndexed += result.chunksIndexed;
      }
    }

    const durationMs = Date.now() - start;
    Logger.info(
      `[VaultIndex] Full vault indexed: ${filesIndexed} files, ${chunksIndexed} chunks, ${skipped} skipped, ${durationMs}ms`
    );
    return {filesIndexed, chunksIndexed, skipped, durationMs};
  }

  /**
   * Remove all index rows (chunks + links) for a vault file. Call when a
   * file is deleted from disk.
   */
  static async removeFileFromIndex(absolutePath: string): Promise<{chunksRemoved: number; linksRemoved: number}> {
    const chunksRemoved = await DatabaseService.deleteVaultChunksForPath(absolutePath);
    const linksRemoved = await DatabaseService.deleteVaultLinksForPath(absolutePath);
    Logger.info(`[VaultIndex] Removed index for ${absolutePath}: ${chunksRemoved} chunks, ${linksRemoved} links`);
    return {chunksRemoved, linksRemoved};
  }

  /** @deprecated Use removeFileFromIndex instead */
  static async removeChunksForPath(absolutePath: string): Promise<number> {
    const result = await this.removeFileFromIndex(absolutePath);
    return result.chunksRemoved;
  }

  /**
   * Semantic top-k search over indexed chunks. Falls back to keyword
   * search when the embedding model is not loaded so the assistant still
   * gets a useful answer.
   */
  static async searchChunks(
    query: string,
    options: {topK?: number; minSimilarity?: number} = {}
  ): Promise<VaultSearchHit[]> {
    const topK = options.topK ?? 3;
    const minSimilarity = options.minSimilarity ?? 0.0;

    if (!LlamaService.isEmbeddingModelLoaded()) {
      Logger.info('[VaultIndex] Embedding model not loaded — using keyword fallback');
      const rows = await DatabaseService.keywordSearchVaultChunks(query, topK);
      return rows.map(r => ({
        path: r.vaultPath,
        heading: r.heading,
        snippet: this.truncateSnippet(r.chunkText),
        similarity: 0,
        mtime: r.mtime,
      }));
    }

    const queryEmbedding = await EmbeddingService.generateEmbedding(query);
    const rows = await DatabaseService.searchVaultChunks(queryEmbedding, {
      topK,
      minSimilarity,
      recencyBoost: true,
    });
    return rows.map(r => ({
      path: r.vaultPath,
      heading: r.heading,
      snippet: this.truncateSnippet(r.chunkText),
      similarity: r.similarity,
      mtime: r.mtime,
    }));
  }

  private static truncateSnippet(text: string, maxChars: number = 200): string {
    // Skip YAML frontmatter — otherwise the snippet is just `---\ndate:\ntags:\n---`
    // and the model sees no actual content. If stripping leaves nothing
    // (chunk was frontmatter-only), fall back to the original text so
    // downstream "quote from snippet" prompts have something to quote.
    let body = text;
    const fmMatch = body.match(/^---\n[\s\S]*?\n---\n?/);
    if (fmMatch) {
      const stripped = body.slice(fmMatch[0].length).trimStart();
      body = stripped.length > 0 ? stripped : text;
    }
    if (body.length <= maxChars) {
      return body;
    }
    return body.slice(0, maxChars).trim() + '…';
  }
}
