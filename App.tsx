/**
 * LocalOS - Local AI Chat Application
 * Powered by llama.rn and llama.cpp
 */

import React, {useState, useEffect} from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Alert,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {ChatScreen} from './src/screens/ChatScreen';
import {ModelsScreen} from './src/screens/ModelsScreen';
import {ToolTestScreen} from './src/screens/ToolTestScreen';
import {VectorSearchTestScreen} from './src/screens/VectorSearchTestScreen';
import {VaultBrowserScreen} from './src/screens/VaultBrowserScreen';
import {FileSystemTestScreen} from './src/screens/FileSystemTestScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {ModelInfo} from './src/types';
import {SettingsProvider, useSettings} from './src/contexts/SettingsContext';
import {ModelStorageService} from './src/services/ModelStorageService';
import {ErrorBoundary} from './src/components/ErrorBoundary';
import {DatabaseProxy} from './src/services/DatabaseProxy';
import {Logger} from './src/utils/Logger';
import RNFS from 'react-native-fs';

type Screen = 'chat' | 'models' | 'tools' | 'vector' | 'vault' | 'filesystem' | 'settings';

function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SettingsProvider>
          <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
          <AppContent />
        </SettingsProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const {debugUI} = useSettings();
  const [currentScreen, setCurrentScreen] = useState<Screen>('chat');

  // If debug mode is turned off while viewing a debug-only screen, fall back
  // to chat so the user isn't stranded on a now-hidden tab.
  useEffect(() => {
    if (
      !debugUI &&
      (currentScreen === 'tools' ||
        currentScreen === 'vector' ||
        currentScreen === 'filesystem')
    ) {
      setCurrentScreen('chat');
    }
  }, [debugUI, currentScreen]);
  const [currentModel, setCurrentModel] = useState<ModelInfo | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  // Set when a chat-message source chip requests opening a vault file.
  // VaultBrowserScreen reads this prop and auto-opens the file.
  const [pendingVaultFile, setPendingVaultFile] = useState<string | null>(null);

  const handleOpenVaultFile = (relativePath: string) => {
    setPendingVaultFile(relativePath);
    setCurrentScreen('vault');
  };

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.info('🚀 APP INITIALIZATION STARTING');
      Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Initialize model storage
      Logger.info('📁 Initializing model storage...');
      await ModelStorageService.initialize();
      Logger.info('✅ Model storage initialized');

      // Initialize SQLite database
      Logger.info('🗄️ Initializing SQLite database...');
      const {DatabaseService} = require('./src/services/DatabaseService');
      await DatabaseService.initialize();
      DatabaseProxy.setUsingSQLite(true);
      Logger.info('✅ SQLite database initialized');

      // Migrate any legacy AsyncStorage chat sessions into SQLite (one-time)
      Logger.info('💬 Initializing session service...');
      const {SessionService} = require('./src/services/SessionService');
      await SessionService.initialize();
      Logger.info('✅ Session service initialized');

      // Initialize tool service (registers all tools)
      Logger.info('🔧 Initializing tool service...');
      const {ToolService} = require('./src/services/ToolService');
      ToolService.initialize();
      Logger.info('✅ Tool service initialized');

      // Initialize vault service
      Logger.info('🔐 Initializing vault service...');
      const {VaultService} = require('./src/services/VaultService');
      await VaultService.initialize();
      Logger.info('✅ Vault service initialized');

      // Load the last used model (if any)
      Logger.info('🤖 Checking for last used model...');
      const {StorageService} = require('./src/services/StorageService');
      const {LlamaService} = require('./src/services/LlamaService');
      const lastModel = await StorageService.loadCurrentModel();
      Logger.info('Last model data:', lastModel);

      if (lastModel && lastModel.downloaded && lastModel.localPath) {
        Logger.info(`📦 Found last used model: ${lastModel.name}`);
        Logger.info(`📍 Model path: ${lastModel.localPath}`);
        try {
          Logger.info('⏳ Loading model...');
          await LlamaService.loadModel(lastModel.localPath, lastModel.name);
          setCurrentModel(lastModel);
          Logger.info('✅ Last used model loaded successfully');
        } catch (error) {
          Logger.error('❌ Failed to load last used model');
          Logger.error('Error:', error instanceof Error ? error.message : String(error));
          // Clear the model if it fails to load
          await StorageService.saveCurrentModel(null);
          Logger.info('🧹 Cleared stale model reference');
          // Don't block app initialization if model load fails
        }
      } else {
        Logger.info('ℹ️ No previous model to load');
      }

      // Load the last used embedding model (if any)
      Logger.info('🔢 Checking for last used embedding model...');
      const lastEmbeddingModel = await StorageService.loadEmbeddingModel();
      Logger.debug('Last embedding model data:', lastEmbeddingModel);

      if (lastEmbeddingModel && lastEmbeddingModel.downloaded && lastEmbeddingModel.localPath) {
        Logger.info(`📦 Found last used embedding model: ${lastEmbeddingModel.name}`);
        Logger.info(`📍 Embedding model path: ${lastEmbeddingModel.localPath}`);
        try {
          // Verify file exists before loading
          const fileExists = await RNFS.exists(lastEmbeddingModel.localPath);
          if (!fileExists) {
            Logger.warn('⚠️ Embedding model file not found, clearing reference');
            await StorageService.saveEmbeddingModel(null);
          } else {
            Logger.info('⏳ Loading embedding model...');
            await LlamaService.loadEmbeddingModel(lastEmbeddingModel.localPath, lastEmbeddingModel.name);
            Logger.info('✅ Last used embedding model loaded successfully');
            Logger.info('🎉 DUAL INSTANCE MODE ACTIVE!');
          }
        } catch (error) {
          Logger.warn('⚠️ Failed to auto-load embedding model (non-critical)');
          Logger.warn('Error:', error instanceof Error ? error.message : String(error));
          // Clear the embedding model if it fails to load
          await StorageService.saveEmbeddingModel(null);
          Logger.info('🧹 Cleared stale embedding model reference');
          // Don't block app initialization if embedding model load fails
        }
      } else {
        Logger.info('ℹ️ No previous embedding model saved');
      }

      Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.info('✅ APP INITIALIZATION COMPLETE');
      Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      setIsInitialized(true);
    } catch (error) {
      Logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.error('❌ APP INITIALIZATION FAILED');
      Logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Logger.error('Error:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        Logger.error('Stack:', error.stack);
      }
      console.error('Failed to initialize app:', error);
      Alert.alert(
        'Initialization Error',
        'Failed to initialize app storage. Please restart the app.',
      );
    }
  };

  const handleModelLoaded = (model: ModelInfo) => {
    setCurrentModel(model);
    setCurrentScreen('chat');
  };

  const handleModelSelect = () => {
    setCurrentScreen('models');
  };

  if (!isInitialized) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {paddingTop: safeAreaInsets.top, paddingBottom: safeAreaInsets.bottom},
      ]}>
      {/* Main Content Area */}
      <View style={styles.contentContainer}>
        {/* Keep ChatScreen mounted to prevent generation interruption */}
        <View style={[styles.screenContainer, currentScreen !== 'chat' && styles.hiddenScreen]}>
          <ChatScreen
            currentModel={currentModel}
            onModelSelect={handleModelSelect}
            onOpenVaultFile={handleOpenVaultFile}
          />
        </View>

        {currentScreen === 'models' && (
          <View style={styles.screenContainer}>
            <ModelsScreen
              currentModel={currentModel}
              onModelLoaded={handleModelLoaded}
            />
          </View>
        )}

        {currentScreen === 'tools' && (
          <View style={styles.screenContainer}>
            <ToolTestScreen />
          </View>
        )}

        {currentScreen === 'vector' && (
          <View style={styles.screenContainer}>
            <VectorSearchTestScreen />
          </View>
        )}

        {currentScreen === 'vault' && (
          <View style={styles.screenContainer}>
            <VaultBrowserScreen
              initialFilePath={pendingVaultFile}
              onInitialFileHandled={() => setPendingVaultFile(null)}
            />
          </View>
        )}

        {currentScreen === 'filesystem' && (
          <View style={styles.screenContainer}>
            <FileSystemTestScreen />
          </View>
        )}

        {currentScreen === 'settings' && (
          <View style={styles.screenContainer}>
            <SettingsScreen />
          </View>
        )}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={[
            styles.navButton,
            currentScreen === 'chat' && styles.navButtonActive,
          ]}
          onPress={() => setCurrentScreen('chat')}>
          <Text
            style={[
              styles.navButtonText,
              currentScreen === 'chat' && styles.navButtonTextActive,
            ]}>
            Chat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navButton,
            currentScreen === 'models' && styles.navButtonActive,
          ]}
          onPress={() => setCurrentScreen('models')}>
          <Text
            style={[
              styles.navButtonText,
              currentScreen === 'models' && styles.navButtonTextActive,
            ]}>
            Models
          </Text>
        </TouchableOpacity>

        {debugUI && (
          <TouchableOpacity
            style={[
              styles.navButton,
              currentScreen === 'tools' && styles.navButtonActive,
            ]}
            onPress={() => setCurrentScreen('tools')}>
            <Text
              style={[
                styles.navButtonText,
                currentScreen === 'tools' && styles.navButtonTextActive,
              ]}>
              Tools
            </Text>
          </TouchableOpacity>
        )}

        {debugUI && (
          <TouchableOpacity
            style={[
              styles.navButton,
              currentScreen === 'vector' && styles.navButtonActive,
            ]}
            onPress={() => setCurrentScreen('vector')}>
            <Text
              style={[
                styles.navButtonText,
                currentScreen === 'vector' && styles.navButtonTextActive,
              ]}>
              Vector
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.navButton,
            currentScreen === 'vault' && styles.navButtonActive,
          ]}
          onPress={() => setCurrentScreen('vault')}>
          <Text
            style={[
              styles.navButtonText,
              currentScreen === 'vault' && styles.navButtonTextActive,
            ]}>
            Vault
          </Text>
        </TouchableOpacity>

        {debugUI && (
        <TouchableOpacity
          style={[
            styles.navButton,
            currentScreen === 'filesystem' && styles.navButtonActive,
          ]}
          onPress={() => setCurrentScreen('filesystem')}>
          <Text
            style={[
              styles.navButtonText,
              currentScreen === 'filesystem' && styles.navButtonTextActive,
            ]}>
            Files
          </Text>
        </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.navButton,
            currentScreen === 'settings' && styles.navButtonActive,
          ]}
          onPress={() => setCurrentScreen('settings')}>
          <Text
            style={[
              styles.navButtonText,
              currentScreen === 'settings' && styles.navButtonTextActive,
            ]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  screenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hiddenScreen: {
    opacity: 0,
    pointerEvents: 'none',
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  navButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonActive: {
    borderTopWidth: 2,
    borderTopColor: '#007AFF',
  },
  navButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  navButtonTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default App;
