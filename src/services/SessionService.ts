/**
 * SessionService — chat session persistence backed by SQLite.
 *
 * Sessions (the full conversation, including action/tool messages) live in the
 * `chat_sessions` table via DatabaseService. The "current session" pointer is a
 * single id kept in AsyncStorage (a tiny KV value, not worth a table).
 *
 * On first run after upgrading, existing sessions stored in AsyncStorage
 * (legacy StorageService) are migrated into SQLite once, then the legacy blob
 * is left untouched as a backup.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DatabaseService} from './DatabaseService';
import {ChatSession} from '../types';
import {STORAGE_KEYS} from '../utils/constants';
import {Logger} from '../utils/Logger';

export class SessionService {
  /**
   * Run once at app start (after DatabaseService.initialize()). Performs the
   * one-time AsyncStorage -> SQLite migration of existing sessions.
   */
  static async initialize(): Promise<void> {
    await this.migrateFromAsyncStorage();
  }

  private static async migrateFromAsyncStorage(): Promise<void> {
    try {
      const alreadyMigrated = await AsyncStorage.getItem(
        STORAGE_KEYS.SESSIONS_MIGRATED_SQLITE,
      );
      if (alreadyMigrated === 'true') {
        return;
      }

      const legacyRaw = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_SESSIONS);
      const legacySessions: ChatSession[] = legacyRaw ? JSON.parse(legacyRaw) : [];

      if (legacySessions.length > 0) {
        Logger.info(`[Sessions] Migrating ${legacySessions.length} session(s) from AsyncStorage to SQLite...`);
        for (const session of legacySessions) {
          // Guard against partially-formed legacy records
          await DatabaseService.upsertChatSession({
            id: session.id,
            title: session.title || 'Chat',
            modelId: session.modelId || '',
            messages: session.messages || [],
            createdAt: session.createdAt || Date.now(),
            updatedAt: session.updatedAt || Date.now(),
          });
        }
        Logger.info('[Sessions] Migration complete');
      }

      await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS_MIGRATED_SQLITE, 'true');
    } catch (error) {
      Logger.error('[Sessions] Migration failed:', error instanceof Error ? error.message : String(error));
      // Non-fatal: a failed migration shouldn't block the app. Sessions will
      // simply start empty from SQLite.
    }
  }

  /** All sessions, most recently updated first. */
  static async loadSessions(): Promise<ChatSession[]> {
    return DatabaseService.getChatSessions();
  }

  static async getSession(id: string): Promise<ChatSession | null> {
    return DatabaseService.getChatSession(id);
  }

  static async saveSession(session: ChatSession): Promise<void> {
    return DatabaseService.upsertChatSession(session);
  }

  static async deleteSession(id: string): Promise<void> {
    await DatabaseService.deleteChatSession(id);
    const currentId = await this.loadCurrentSessionId();
    if (currentId === id) {
      await this.saveCurrentSessionId(null);
    }
  }

  static async saveCurrentSessionId(sessionId: string | null): Promise<void> {
    try {
      if (sessionId) {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, sessionId);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
      }
    } catch (error) {
      Logger.error('[Sessions] Failed to save current session id:', error instanceof Error ? error.message : String(error));
    }
  }

  static async loadCurrentSessionId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
    } catch (error) {
      Logger.error('[Sessions] Failed to load current session id:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }
}
