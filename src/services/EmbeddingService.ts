/**
 * Embedding Service
 * Manages text embeddings for semantic search
 * Wraps LlamaService embedding functionality
 */

import {LlamaService} from './LlamaService';
import {DatabaseService} from './DatabaseService';
import {Logger} from '../utils/Logger';

export class EmbeddingService {
  private static embeddingModelLoaded: boolean = false;
  private static embeddingModelPath: string | null = null;

  /**
   * Load an embedding model
   * Note: This is separate from the chat model
   */
  static async loadEmbeddingModel(modelPath: string, modelName: string): Promise<void> {
    try {
      Logger.info('[EmbeddingService] Loading embedding model:', modelName);
      await LlamaService.loadModel(modelPath, modelName);
      this.embeddingModelLoaded = true;
      this.embeddingModelPath = modelPath;
      Logger.info('[EmbeddingService] Embedding model loaded successfully');
    } catch (error) {
      Logger.error('[EmbeddingService] Failed to load embedding model:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embeddingModelLoaded) {
      throw new Error('Embedding model not loaded. Call loadEmbeddingModel() first.');
    }

    try {
      const embedding = await LlamaService.generateEmbedding(text);
      return embedding;
    } catch (error) {
      Logger.error('[EmbeddingService] Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  static async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  /**
   * Save memory with automatic embedding generation
   */
  static async saveMemoryWithEmbedding(
    content: string,
    category: 'fact' | 'event' | 'preference' | 'conversation',
    importance: number,
    metadata?: Record<string, any>
  ): Promise<any> {
    try {
      // Generate embedding
      Logger.info('[EmbeddingService] Generating embedding for memory...');
      const embedding = await this.generateEmbedding(content);

      // Save to database with embedding
      const memory = await DatabaseService.saveMemory(
        content,
        category,
        importance,
        metadata,
        embedding
      );

      Logger.info('[EmbeddingService] Memory saved with embedding');
      return memory;
    } catch (error) {
      Logger.error('[EmbeddingService] Failed to save memory with embedding:', error);
      throw error;
    }
  }

  /**
   * Add embeddings to existing memories that don't have them
   */
  static async backfillEmbeddings(limit?: number): Promise<{processed: number; failed: number}> {
    try {
      Logger.info('[EmbeddingService] Starting embedding backfill...');

      // Get memories without embeddings
      const allMemories = await DatabaseService.getRecentMemories(limit || 1000);
      const memoriesWithoutEmbeddings = allMemories.filter(m => !m.embedding);

      Logger.info(`[EmbeddingService] Found ${memoriesWithoutEmbeddings.length} memories without embeddings`);

      let processed = 0;
      let failed = 0;

      for (const memory of memoriesWithoutEmbeddings) {
        try {
          const embedding = await this.generateEmbedding(memory.content);
          await DatabaseService.updateMemoryEmbedding(memory.id, embedding);
          processed++;
          Logger.debug(`[EmbeddingService] Backfilled embedding for memory ${memory.id}`);
        } catch (error) {
          Logger.error(`[EmbeddingService] Failed to backfill memory ${memory.id}:`, error);
          failed++;
        }
      }

      Logger.info(`[EmbeddingService] Backfill complete: ${processed} processed, ${failed} failed`);
      return {processed, failed};
    } catch (error) {
      Logger.error('[EmbeddingService] Backfill failed:', error);
      throw error;
    }
  }

  /**
   * Semantic search using embeddings
   */
  static async semanticSearch(
    query: string,
    limit: number = 5,
    minSimilarity: number = 0.0
  ): Promise<Array<any>> {
    try {
      // Generate embedding for query
      Logger.info('[EmbeddingService] Generating query embedding...');
      const queryEmbedding = await this.generateEmbedding(query);

      // Search database
      const results = await DatabaseService.searchByVector(queryEmbedding, limit, minSimilarity);

      Logger.info(`[EmbeddingService] Found ${results.length} semantic matches`);
      return results;
    } catch (error) {
      Logger.error('[EmbeddingService] Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Hybrid search (keyword + semantic)
   */
  static async hybridSearch(
    query: string,
    limit: number = 5
  ): Promise<Array<any>> {
    try {
      // Generate embedding for query
      Logger.info('[EmbeddingService] Generating query embedding for hybrid search...');
      const queryEmbedding = await this.generateEmbedding(query);

      // Hybrid search
      const results = await DatabaseService.searchHybrid(query, queryEmbedding, limit);

      Logger.info(`[EmbeddingService] Hybrid search returned ${results.length} results`);
      return results;
    } catch (error) {
      Logger.error('[EmbeddingService] Hybrid search failed:', error);
      throw error;
    }
  }

  /**
   * Get embedding statistics
   */
  static async getStats(): Promise<{
    modelLoaded: boolean;
    modelPath: string | null;
    dbStats: {total: number; withEmbeddings: number; percentage: number};
  }> {
    const dbStats = await DatabaseService.getEmbeddingStats();

    return {
      modelLoaded: this.embeddingModelLoaded,
      modelPath: this.embeddingModelPath,
      dbStats,
    };
  }

  /**
   * Unload embedding model
   */
  static async unloadModel(): Promise<void> {
    await LlamaService.releaseModel();
    this.embeddingModelLoaded = false;
    this.embeddingModelPath = null;
    Logger.info('[EmbeddingService] Embedding model unloaded');
  }

  /**
   * Check if embedding model is loaded
   */
  static isModelLoaded(): boolean {
    return this.embeddingModelLoaded;
  }
}
