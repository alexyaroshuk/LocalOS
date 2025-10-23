import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {AIService} from '../services/AIService';
import {AppleIntelligenceService} from '../services/AppleIntelligenceService';

export const DebugInfoScreen = () => {
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    checkBackend();
  }, []);

  const checkBackend = async () => {
    setIsChecking(true);
    const logs: string[] = [];

    logs.push('=== DEVICE INFO ===');
    logs.push(`Platform: ${Platform.OS}`);
    logs.push(`Version: ${Platform.Version}`);
    logs.push('');

    logs.push('=== AI BACKEND DETECTION ===');

    if (Platform.OS === 'ios') {
      logs.push('✓ Running on iOS');

      // Check Apple Intelligence
      logs.push('');
      logs.push('Checking Apple Intelligence...');
      try {
        const available = await AppleIntelligenceService.isAvailable();
        if (available) {
          logs.push('✅ Apple Intelligence: AVAILABLE');
        } else {
          logs.push('❌ Apple Intelligence: NOT AVAILABLE');
          if (Platform.Version < '18') {
            logs.push(`   Reason: iOS ${Platform.Version} < iOS 18`);
          } else {
            logs.push('   Reason: Package not installed or device not supported');
          }
        }
      } catch (error) {
        logs.push('❌ Apple Intelligence: ERROR');
        logs.push(`   Error: ${error}`);
      }
    } else {
      logs.push('✓ Running on Android');
      logs.push('❌ Apple Intelligence: Not available (iOS only)');
    }

    logs.push('');
    logs.push('Initializing AI Service...');
    try {
      const backend = await AIService.initialize();
      const info = AIService.getBackendInfo();

      logs.push(`✅ Backend initialized: ${backend}`);
      logs.push(`   Model: ${info.modelName}`);
      logs.push(`   Ready: ${info.isReady}`);
    } catch (error) {
      logs.push('❌ Failed to initialize AI Service');
      logs.push(`   Error: ${error}`);
    }

    logs.push('');
    logs.push('=== RECOMMENDATIONS ===');

    if (Platform.OS === 'ios' && Platform.Version >= '18') {
      logs.push('Your device supports Apple Intelligence!');
      logs.push('');
      logs.push('To enable:');
      logs.push('1. npm install @react-native-ai/apple');
      logs.push('2. cd ios && pod install && cd ..');
      logs.push('3. Rebuild the app');
    } else if (Platform.OS === 'ios') {
      logs.push('Your iOS version is too old for Apple Intelligence');
      logs.push(`Current: iOS ${Platform.Version}`);
      logs.push('Required: iOS 18.0+');
      logs.push('');
      logs.push('Recommendation: Use Llama.cpp');
      logs.push('Load a GGUF model from Models screen');
    } else {
      logs.push('Android device detected');
      logs.push('Recommendation: Use Llama.cpp');
      logs.push('Load a GGUF model from Models screen');
    }

    setDebugInfo(logs);
    setIsChecking(false);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Debug Information</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={checkBackend}
          disabled={isChecking}>
          <Text style={styles.refreshText}>
            {isChecking ? 'Checking...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logContainer}>
        {debugInfo.map((line, index) => (
          <Text
            key={index}
            style={[
              styles.logLine,
              line.includes('✅') && styles.successLine,
              line.includes('❌') && styles.errorLine,
              line.includes('===') && styles.headerLine,
            ]}>
            {line}
          </Text>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          This screen shows debug info that would normally appear in console
          logs
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2D2D2D',
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  refreshText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  logContainer: {
    padding: 16,
  },
  logLine: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#D4D4D4',
    marginBottom: 4,
  },
  successLine: {
    color: '#4EC9B0',
    fontWeight: '600',
  },
  errorLine: {
    color: '#F48771',
    fontWeight: '600',
  },
  headerLine: {
    color: '#DCDCAA',
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 8,
  },
  footer: {
    padding: 16,
    backgroundColor: '#2D2D2D',
    marginTop: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#808080',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
