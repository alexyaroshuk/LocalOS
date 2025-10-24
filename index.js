/**
 * @format
 */

// Polyfills for AI SDK - must be imported before anything else
import 'web-streams-polyfill/polyfill';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Global error handler to ensure JS errors appear in iOS System Diagnostics
// This will cause the app to crash natively, which iOS will capture
if (!__DEV__) {
  const defaultErrorHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Log to console for debugging
    console.error('Global Error Handler:', error, 'Fatal:', isFatal);

    // Call the default handler first
    if (defaultErrorHandler) {
      defaultErrorHandler(error, isFatal);
    }

    // For fatal errors, crash the app natively so iOS System Diagnostics captures it
    if (isFatal) {
      // This will trigger a native crash that iOS will log
      // The error message and stack trace will be in the crash report
      throw error;
    }
  });
}

AppRegistry.registerComponent(appName, () => App);
