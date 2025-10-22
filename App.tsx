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
import {ModelInfo} from './src/types';
import {ModelStorageService} from './src/services/ModelStorageService';

type Screen = 'chat' | 'models' | 'tools';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [currentScreen, setCurrentScreen] = useState<Screen>('chat');
  const [currentModel, setCurrentModel] = useState<ModelInfo | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize model storage
      await ModelStorageService.initialize();
      console.log('App initialized successfully');
      setIsInitialized(true);
    } catch (error) {
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
      {/* Main Content */}
      {currentScreen === 'chat' ? (
        <ChatScreen
          currentModel={currentModel}
          onModelSelect={handleModelSelect}
        />
      ) : currentScreen === 'models' ? (
        <ModelsScreen
          currentModel={currentModel}
          onModelLoaded={handleModelLoaded}
        />
      ) : (
        <ToolTestScreen />
      )}

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
