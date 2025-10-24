/**
 * @format
 */

// Polyfills for AI SDK - must be imported before anything else
import 'web-streams-polyfill/polyfill';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
