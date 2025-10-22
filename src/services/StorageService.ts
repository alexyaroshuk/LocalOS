/**
 * Service for persisting app data using AsyncStorage
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ChatSession, ModelInfo, LlamaConfig} from '../types';
import {STORAGE_KEYS, DEFAULT_LLAMA_CONFIG} from '../utils/constants';

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
   * Save downloaded models info
   */
  static async saveDownloadedModels(models: ModelInfo[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.DOWNLOADED_MODELS,
        JSON.stringify(models),
      );
    } catch (error) {
      console.error('Failed to save downloaded models:', error);
      throw error;
    }
  }

  /**
   * Load downloaded models info
   */
  static async loadDownloadedModels(): Promise<ModelInfo[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADED_MODELS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
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
        await AsyncStorage.setItem(
          STORAGE_KEYS.CURRENT_MODEL,
          JSON.stringify(model),
        );
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_MODEL);
      }
    } catch (error) {
      console.error('Failed to save current model:', error);
    }
  }

  /**
   * Load current model info
   */
  static async loadCurrentModel(): Promise<ModelInfo | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_MODEL);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to load current model:', error);
      return null;
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
