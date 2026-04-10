/**
 * Service for persisting app data using AsyncStorage
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ChatSession, ModelInfo, LlamaConfig} from '../types';
import {STORAGE_KEYS, DEFAULT_LLAMA_CONFIG} from '../utils/constants';
import {Logger} from '../utils/Logger';

export class StorageService {
  /**
   * Save chat sessions
   */
  static async saveSessions(sessions: ChatSession[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CHAT_SESSIONS,
        JSON.stringify(sessions),
      );
    } catch (error) {
      console.error('Failed to save sessions:', error);
      throw error;
    }
  }

  /**
   * Load chat sessions
   */
  static async loadSessions(): Promise<ChatSession[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    }
  }

  /**
   * Save current session ID
   */
  static async saveCurrentSessionId(sessionId: string | null): Promise<void> {
    try {
      if (sessionId) {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, sessionId);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
      }
    } catch (error) {
      console.error('Failed to save current session:', error);
    }
  }

  /**
   * Load current session ID
   */
  static async loadCurrentSessionId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
    } catch (error) {
      console.error('Failed to load current session:', error);
      return null;
    }
  }

  /**
   * Save downloaded models info (deduplicated by path)
   */
  static async saveDownloadedModels(models: ModelInfo[]): Promise<void> {
    try {
      Logger.debug(`Saving ${models.length} models to storage...`);

      // Deduplicate by localPath and id before saving
      const seenPaths = new Set<string | undefined>();
      const seenIds = new Set<string>();
      let duplicateCount = 0;

      const deduplicated = models.filter(model => {
        if (seenIds.has(model.id)) {
          Logger.debug(`Removing duplicate model with id: ${model.id}`);
          duplicateCount++;
          return false;
        }
        if (model.localPath && seenPaths.has(model.localPath)) {
          Logger.debug(`Removing duplicate model with path: ${model.localPath}`);
          duplicateCount++;
          return false;
        }
        seenIds.add(model.id);
        if (model.localPath) {
          seenPaths.add(model.localPath);
        }
        return true;
      });

      Logger.debug(`Deduplicated from ${models.length} to ${deduplicated.length} models (${duplicateCount} removed)`);

      await AsyncStorage.setItem(
        STORAGE_KEYS.DOWNLOADED_MODELS,
        JSON.stringify(deduplicated),
      );

      Logger.debug('Models saved to AsyncStorage');
    } catch (error) {
      Logger.error('Failed to save downloaded models:', error instanceof Error ? error.message : String(error));
      console.error('Failed to save downloaded models:', error);
      throw error;
    }
  }

  /**
   * Load downloaded models info (deduplicated by path)
   */
  static async loadDownloadedModels(): Promise<ModelInfo[]> {
    try {
      Logger.debug('Loading downloaded models from AsyncStorage...');
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADED_MODELS);
      if (!data) {
        Logger.debug('No downloaded models found');
        return [];
      }

      Logger.debug('Parsing models data...');
      const models: ModelInfo[] = JSON.parse(data);
      Logger.debug(`Loaded ${models.length} models from storage`);

      // Deduplicate by localPath to prevent duplicates
      const seenPaths = new Set<string | undefined>();
      let duplicateCount = 0;

      const deduplicated = models.filter(model => {
        if (model.localPath && seenPaths.has(model.localPath)) {
          Logger.debug(`Removing duplicate model with path: ${model.localPath}`);
          duplicateCount++;
          return false;
        }
        if (model.localPath) {
          seenPaths.add(model.localPath);
        }
        return true;
      });

      Logger.debug(`Deduplicated from ${models.length} to ${deduplicated.length} models (${duplicateCount} removed)`);
      return deduplicated;
    } catch (error) {
      Logger.error('Failed to load downloaded models:', error instanceof Error ? error.message : String(error));
      console.error('Failed to load downloaded models:', error);
      return [];
    }
  }

  /**
   * Save Llama configuration
   */
  static async saveLlamaConfig(config: LlamaConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LLAMA_CONFIG,
        JSON.stringify(config),
      );
    } catch (error) {
      console.error('Failed to save llama config:', error);
      throw error;
    }
  }

  /**
   * Load Llama configuration
   */
  static async loadLlamaConfig(): Promise<LlamaConfig> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LLAMA_CONFIG);
      return data ? JSON.parse(data) : DEFAULT_LLAMA_CONFIG;
    } catch (error) {
      console.error('Failed to load llama config:', error);
      return DEFAULT_LLAMA_CONFIG;
    }
  }

  /**
   * Save current model info
   */
  static async saveCurrentModel(model: ModelInfo | null): Promise<void> {
    try {
      if (model) {
        Logger.debug(`Saving current model: ${model.name}`);
        await AsyncStorage.setItem(
          STORAGE_KEYS.CURRENT_MODEL,
          JSON.stringify(model),
        );
        Logger.debug('✅ Current model saved');
      } else {
        Logger.debug('Clearing current model');
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_MODEL);
        Logger.debug('✅ Current model cleared');
      }
    } catch (error) {
      Logger.error('Failed to save current model:', error instanceof Error ? error.message : String(error));
      console.error('Failed to save current model:', error);
    }
  }

  /**
   * Load current model info
   */
  static async loadCurrentModel(): Promise<ModelInfo | null> {
    try {
      Logger.debug('Loading current model from AsyncStorage...');
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_MODEL);
      if (data) {
        const model = JSON.parse(data);
        Logger.debug(`✅ Current model loaded: ${model.name}`);
        return model;
      } else {
        Logger.debug('No current model saved');
        return null;
      }
    } catch (error) {
      Logger.error('Failed to load current model:', error instanceof Error ? error.message : String(error));
      console.error('Failed to load current model:', error);
      return null;
    }
  }

  /**
   * Save recently used models (max 5)
   */
  static async addRecentModel(model: ModelInfo): Promise<void> {
    try {
      const recentModels = await this.loadRecentModels();

      // Remove if already exists (to move to front)
      const filtered = recentModels.filter(m => m.id !== model.id);

      // Add to front
      const updated = [model, ...filtered].slice(0, 5); // Keep max 5

      await AsyncStorage.setItem(
        STORAGE_KEYS.RECENT_MODELS,
        JSON.stringify(updated),
      );
    } catch (error) {
      console.error('Failed to save recent model:', error);
    }
  }

  /**
   * Load recently used models
   */
  static async loadRecentModels(): Promise<ModelInfo[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RECENT_MODELS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to load recent models:', error);
      return [];
    }
  }

  /**
   * Clear recent models history
   */
  static async clearRecentModels(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.RECENT_MODELS);
    } catch (error) {
      console.error('Failed to clear recent models:', error);
    }
  }

  /**
   * Clear all app data
   */
  static async clearAll(): Promise<void> {
    try {
      await AsyncStorage.clear();
      console.log('All data cleared');
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw error;
    }
  }

  /**
   * Delete a specific session
   */
  static async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.loadSessions();
      const filtered = sessions.filter(s => s.id !== sessionId);
      await this.saveSessions(filtered);

      // If deleted session was current, clear current
      const currentId = await this.loadCurrentSessionId();
      if (currentId === sessionId) {
        await this.saveCurrentSessionId(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }

  /**
   * Update a specific session
   */
  static async updateSession(session: ChatSession): Promise<void> {
    try {
      const sessions = await this.loadSessions();
      const index = sessions.findIndex(s => s.id === session.id);

      if (index >= 0) {
        sessions[index] = session;
      } else {
        sessions.push(session);
      }

      await this.saveSessions(sessions);
    } catch (error) {
      console.error('Failed to update session:', error);
      throw error;
    }
  }
}
