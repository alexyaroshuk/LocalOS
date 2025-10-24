/**
 * Crash Reporter Utility
 * Logs errors and crashes to both console and iOS System Diagnostics
 */

import {Logger} from './Logger';

export class CrashReporter {
  /**
   * Log a non-fatal error
   * This will be logged but won't crash the app
   */
  static logError(error: Error, context?: string): void {
    const errorMessage = context
      ? `[${context}] ${error.message}`
      : error.message;

    Logger.error(errorMessage);

    if (error.stack) {
      Logger.error('Stack trace:', error.stack);
    }

    // In production, you could send to a crash reporting service here
    if (!__DEV__) {
      console.error(`[CrashReporter] ${errorMessage}`, error.stack);
    }
  }

  /**
   * Log a fatal error that will crash the app
   * This ensures the crash appears in iOS System Diagnostics
   */
  static logFatalError(error: Error, context?: string): never {
    const errorMessage = context
      ? `FATAL: [${context}] ${error.message}`
      : `FATAL: ${error.message}`;

    Logger.error(errorMessage);

    if (error.stack) {
      Logger.error('Stack trace:', error.stack);
    }

    // In production, crash natively so iOS captures it
    if (!__DEV__) {
      console.error(`[CrashReporter FATAL] ${errorMessage}`, error.stack);
      // This will trigger a native crash
      throw error;
    }

    // In dev mode, just throw the error (React will catch and show red box)
    throw error;
  }

  /**
   * Log an unhandled promise rejection
   */
  static logUnhandledRejection(
    reason: any,
    promise: Promise<any>,
    context?: string,
  ): void {
    const errorMessage = context
      ? `Unhandled Promise Rejection in ${context}: ${reason}`
      : `Unhandled Promise Rejection: ${reason}`;

    Logger.error(errorMessage);

    if (reason?.stack) {
      Logger.error('Stack trace:', reason.stack);
    }

    // Log to console for iOS System Diagnostics
    console.error('[CrashReporter] Unhandled Rejection:', reason, promise);
  }

  /**
   * Log app state information (useful for crash context)
   */
  static logAppState(state: Record<string, any>): void {
    Logger.info('App State:', JSON.stringify(state, null, 2));
    console.log('[CrashReporter] App State:', state);
  }
}

// Setup global promise rejection handler
const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  CrashReporter.logUnhandledRejection(event.reason, event.promise);
};

// Add listener for unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
}
