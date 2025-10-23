/**
 * Persistent Logger
 * Works in both development and production (IPA builds)
 * Logs are stored in memory and can be viewed in-app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface LogEntry {
  timestamp: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

const MAX_LOGS = 500; // Keep last 500 logs in memory
const STORAGE_KEY = '@localos_debug_logs';

class LoggerService {
  private logs: LogEntry[] = [];
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();

  constructor() {
    this.loadLogsFromStorage();
  }

  /**
   * Load logs from storage on init
   */
  private async loadLogsFromStorage() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Save logs to storage (debounced)
   */
  private saveLogsToStorage = (() => {
    let timeout: NodeJS.Timeout;
    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        try {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
        } catch {
          // Ignore storage errors
        }
      }, 1000);
    };
  })();

  /**
   * Add a log entry
   */
  private addLog(level: LogEntry['level'], message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
    };

    this.logs.push(entry);

    // Keep only last MAX_LOGS entries
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }

    // Also log to console in development
    if (__DEV__) {
      const consoleMethod = console[level] || console.log;
      if (data !== undefined) {
        consoleMethod(message, data);
      } else {
        consoleMethod(message);
      }
    }

    // Notify listeners
    this.listeners.forEach(listener => listener([...this.logs]));

    // Save to storage
    this.saveLogsToStorage();
  }

  /**
   * Log methods
   */
  log(message: string, data?: any) {
    this.addLog('log', message, data);
  }

  info(message: string, data?: any) {
    this.addLog('info', message, data);
  }

  warn(message: string, data?: any) {
    this.addLog('warn', message, data);
  }

  error(message: string, data?: any) {
    this.addLog('error', message, data);
  }

  debug(message: string, data?: any) {
    this.addLog('debug', message, data);
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  async clearLogs() {
    this.logs = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
    this.listeners.forEach(listener => listener([]));
  }

  /**
   * Subscribe to log updates
   */
  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.add(listener);
    // Immediately call with current logs
    listener([...this.logs]);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Export logs as string
   */
  exportLogs(): string {
    return this.logs
      .map(log => {
        const date = new Date(log.timestamp).toISOString();
        const level = log.level.toUpperCase().padEnd(5);
        const dataStr = log.data ? ` | ${JSON.stringify(log.data)}` : '';
        return `[${date}] ${level} | ${log.message}${dataStr}`;
      })
      .join('\n');
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter(log => log.log === level);
  }
}

// Export singleton instance
export const Logger = new LoggerService();

// Export formatted log section helpers
export const LogSection = {
  start(title: string) {
    Logger.log('='.repeat(50));
    Logger.log(title);
    Logger.log('='.repeat(50));
  },

  end() {
    Logger.log('='.repeat(50));
  },

  header(text: string) {
    Logger.log('-'.repeat(50));
    Logger.log(text);
    Logger.log('-'.repeat(50));
  },
};
