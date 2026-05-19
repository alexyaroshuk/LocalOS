/**
 * ToolRouterService
 *
 * Embedding-based intent router. When the model fails to emit a tool call,
 * this picks the most semantically relevant tool by comparing the user's
 * message against each tool's description.
 *
 * Replaces brittle regex preflight with deterministic semantic matching.
 * Reuses the already-loaded embedding model — zero infrastructure cost.
 */

import {Tool} from '../types';
import {EmbeddingService} from './EmbeddingService';
import {DatabaseService} from './DatabaseService';
import {Logger as L} from '../utils/Logger';

export interface RouteResult {
  tool: Tool;
  similarity: number;
  args: Record<string, any>;
}

export class ToolRouterService {
  private static toolEmbeddings: Map<string, number[]> = new Map();
  private static embeddingDim: number | null = null;

  /**
   * Embed each tool's description once. Idempotent — re-running skips
   * already-embedded tools. Called lazily on first route() invocation.
   */
  static async ensureEmbeddings(tools: Tool[]): Promise<void> {
    if (!EmbeddingService.isModelLoaded()) {
      return;
    }

    for (const tool of tools) {
      if (this.toolEmbeddings.has(tool.name)) continue;
      try {
        // Include name + description so semantic match captures both
        const text = `${tool.name}. ${tool.description}`;
        const emb = await EmbeddingService.generateEmbedding(text);
        this.toolEmbeddings.set(tool.name, emb);
        if (this.embeddingDim === null) {
          this.embeddingDim = emb.length;
        }
        L.debug(`[ToolRouter] Embedded "${tool.name}" (${emb.length}D)`);
      } catch (err) {
        L.warn(`[ToolRouter] Failed to embed "${tool.name}":`, err);
      }
    }
  }

  /**
   * Conversational openers / acknowledgements that should never trigger a
   * tool call. Short and high-frequency — model handles them inline.
   */
  private static readonly GREETING_RE = /^(hi|hello|hey|yo|sup|howdy|greetings|what'?s\s*up|wassup|good\s*(morning|afternoon|evening|night)|thanks|thank\s*you|ty|thx|ok|okay|cool|nice|got\s*it|sounds\s*good|bye|goodbye|cya|see\s*ya)[\s!.?]*$/i;

  /** Personal pronouns — strong signal the query is about user, not the web. */
  private static readonly PERSONAL_RE = /\b(my|me|i|i'?m|i'?ve|i'?d|i'?ll|mine|myself|i\s+have|i\s+had|do\s+i|did\s+i|am\s+i|was\s+i)\b/i;

  /**
   * Find the best matching tool for a user query.
   *
   * Returns null if:
   *  - Embedding model not loaded
   *  - smartMode is ON (LLM decides — router stays out of the way)
   *  - Query is a greeting / acknowledgement
   *  - Top similarity below threshold
   *  - Best-matching tool has parameters we can't infer (multi-arg writes)
   *
   * For routable tools, infers args automatically:
   *  - 0 required params → {}
   *  - 1 string param (query/text/topic) → that param = user message
   */
  static async route(
    query: string,
    tools: Tool[],
    threshold: number = 0.45,
    smartMode: boolean = false,
  ): Promise<RouteResult | null> {
    if (smartMode) {
      L.debug('[ToolRouter] Skipped — smart tool detection ON (LLM decides)');
      return null;
    }

    if (!EmbeddingService.isModelLoaded()) {
      L.debug('[ToolRouter] Skipped — embedding model not loaded');
      return null;
    }

    if (tools.length === 0) return null;

    const trimmed = query.trim();
    if (this.GREETING_RE.test(trimmed)) {
      L.info(`[ToolRouter] Skipped greeting/ack: "${trimmed.substring(0, 40)}"`);
      return null;
    }

    // Personal-pronoun questions are about the user's vault, never the web.
    // Drop search_web from candidates so a noisy 0.51 sim can't outrank
    // a genuine vault match at 0.48.
    const isPersonal = this.PERSONAL_RE.test(trimmed);
    const candidates = isPersonal
      ? tools.filter(t => t.name !== 'search_web' && t.name !== 'fetch_web_page')
      : tools;
    if (isPersonal) {
      L.debug('[ToolRouter] Personal pronoun detected — excluding web tools');
    }

    await this.ensureEmbeddings(candidates);

    let queryEmb: number[];
    try {
      queryEmb = await EmbeddingService.generateEmbedding(query);
    } catch (err) {
      L.warn('[ToolRouter] Failed to embed query:', err);
      return null;
    }

    let bestTool: Tool | null = null;
    let bestSim = -1;
    const allScores: Array<{name: string; sim: number}> = [];

    for (const tool of candidates) {
      const toolEmb = this.toolEmbeddings.get(tool.name);
      if (!toolEmb) continue;
      try {
        const sim = DatabaseService.cosineSimilarity(queryEmb, toolEmb);
        allScores.push({name: tool.name, sim});
        if (sim > bestSim) {
          bestSim = sim;
          bestTool = tool;
        }
      } catch (err) {
        // dimension mismatch — skip silently
      }
    }

    // Log top-3 for debugging
    const top3 = allScores.sort((a, b) => b.sim - a.sim).slice(0, 3);
    L.info(
      `[ToolRouter] Top-3 for "${query.substring(0, 60)}": ${top3
        .map(s => `${s.name}=${s.sim.toFixed(3)}`)
        .join(', ')}`,
    );

    if (!bestTool || bestSim < threshold) {
      L.info(`[ToolRouter] No tool above threshold ${threshold}`);
      return null;
    }

    // Infer arguments. Skip if tool has unfillable required params.
    const args = this.inferArgs(bestTool, query);
    if (args === null) {
      L.info(
        `[ToolRouter] Best match "${bestTool.name}" (sim=${bestSim.toFixed(3)}) but args not inferable — skipping`,
      );
      return null;
    }

    return {tool: bestTool, similarity: bestSim, args};
  }

  /**
   * Infer call arguments from user query for routed tools.
   *
   * Routable patterns:
   *  - 0 required params → {}
   *  - Exactly 1 required string param named query/text/topic/q → that = query
   *
   * Returns null if args cannot be safely inferred (skip routing).
   */
  private static inferArgs(tool: Tool, query: string): Record<string, any> | null {
    const required = tool.parameters.filter(p => p.required);

    if (required.length === 0) {
      return {};
    }

    if (required.length === 1) {
      const p = required[0];
      const inferable = ['query', 'text', 'topic', 'q', 'search', 'keyword'];
      if (p.type === 'string' && inferable.includes(p.name.toLowerCase())) {
        return {[p.name]: this.cleanQuery(query)};
      }
    }

    // Multi-param or non-inferable single param — can't safely route
    return null;
  }

  /**
   * Light cleanup on user query before passing as a tool arg.
   * Strips leading interrogatives and trailing punctuation so the
   * embedding match aligns with stored chunk topics.
   */
  private static cleanQuery(text: string): string {
    return text
      .replace(
        /^(what['']?s|what is|what|how|where|when|which|do i|did i|tell me|can you|please)\s+/i,
        '',
      )
      .replace(/\?+\s*$/, '')
      .trim();
  }

  /**
   * Clear cached tool embeddings. Call when tools change or embedding
   * model is swapped (different model = different dimensions).
   */
  static clearCache(): void {
    this.toolEmbeddings.clear();
    this.embeddingDim = null;
    L.info('[ToolRouter] Cache cleared');
  }

  /** Diagnostic: how many tools have cached embeddings. */
  static getCacheSize(): number {
    return this.toolEmbeddings.size;
  }
}

