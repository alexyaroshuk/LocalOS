import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
} from 'react-native';
import {Logger} from '../utils/Logger';
import {AIService} from '../services/AIService';

interface LogEntry {
  timestamp: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

interface LogViewerScreenProps {
  onClose?: () => void;
}

export const LogViewerScreen = ({onClose}: LogViewerScreenProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>(
    'all',
  );
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    // Subscribe to log updates
    const unsubscribe = Logger.subscribe(setLogs);
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    if (autoScroll && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({animated: true});
      }, 100);
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

  const handleClear = () => {
    Alert.alert('Clear Logs', 'Are you sure you want to clear all logs?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => Logger.clearLogs(),
      },
    ]);
  };

  const handleShare = async () => {
    try {
      const logsText = Logger.exportLogs();
      await Share.share({
        message: logsText,
        title: 'LocalOS Debug Logs',
      });
    } catch {
      Alert.alert('Error', 'Failed to share logs');
    }
  };

  const handleRunDiagnostics = async () => {
    Logger.log('🔍 Running diagnostics...');

    Logger.log('Platform:', Platform.OS);
    Logger.log('Platform Version:', Platform.Version);

    const backend = AIService.getCurrentBackend();
    const info = AIService.getBackendInfo();

    Logger.log('AI Backend:', backend);
    Logger.log('Model:', info.modelName);
    Logger.log('Ready:', info.isReady);

    if (backend === 'llama') {
      Logger.info(
        'Using Llama.cpp - Load a GGUF model from Models screen to start chatting',
      );
    } else if (backend === 'apple') {
      Logger.info('Using Apple Intelligence - Ready to chat!');
    }

    Logger.log('Diagnostics complete ✓');
  };

  const getLogStyle = (level: string) => {
    switch (level) {
      case 'error':
        return styles.errorLog;
      case 'warn':
        return styles.warnLog;
      case 'info':
        return styles.infoLog;
      case 'debug':
        return styles.debugLog;
      default:
        return styles.normalLog;
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return '🔴';
      case 'warn':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'debug':
        return '🔧';
      default:
        return '📝';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>📋 Logs ({filteredLogs.length})</Text>
          {onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕ Close</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.diagnosticsButton}
            onPress={handleRunDiagnostics}>
            <Text style={styles.buttonText}>🔍 Test</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.buttonText}>↗️ Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['all', 'error', 'warn', 'info'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}>
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logs List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.logsContainer}
        contentContainerStyle={styles.logsContent}
        onScrollBeginDrag={() => setAutoScroll(false)}
        onScrollEndDrag={event => {
          const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent;
          const isAtBottom =
            contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
          setAutoScroll(isAtBottom);
        }}>
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No logs yet</Text>
            <Text style={styles.emptySubtext}>
              Logs will appear here as the app runs
            </Text>
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleRunDiagnostics}>
              <Text style={styles.testButtonText}>Run Test Logs</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredLogs.map((log, index) => {
            const time = new Date(log.timestamp).toLocaleTimeString();
            return (
              <View key={index} style={[styles.logEntry, getLogStyle(log.level)]}>
                <View style={styles.logHeader}>
                  <Text style={styles.logIcon}>{getLogIcon(log.level)}</Text>
                  <Text style={styles.logTime}>{time}</Text>
                  <Text style={styles.logLevel}>{log.level.toUpperCase()}</Text>
                </View>
                <Text style={styles.logMessage}>{log.message}</Text>
                {log.data !== undefined && (
                  <Text style={styles.logData}>
                    {typeof log.data === 'object'
                      ? JSON.stringify(log.data, null, 2)
                      : String(log.data)}
                  </Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <TouchableOpacity
          style={styles.scrollToBottomButton}
          onPress={() => {
            setAutoScroll(true);
            scrollViewRef.current?.scrollToEnd({animated: true});
          }}>
          <Text style={styles.scrollToBottomText}>↓ Scroll to bottom</Text>
        </TouchableOpacity>
      )}
    </View>
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
  headerLeft: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#3D3D3D',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  diagnosticsButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  shareButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#2D2D2D',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#3D3D3D',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  logsContainer: {
    flex: 1,
  },
  logsContent: {
    padding: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#555',
    marginBottom: 20,
  },
  testButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  logEntry: {
    backgroundColor: '#2D2D2D',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  normalLog: {
    borderLeftColor: '#007AFF',
  },
  errorLog: {
    borderLeftColor: '#FF3B30',
    backgroundColor: '#3D2D2D',
  },
  warnLog: {
    borderLeftColor: '#FF9500',
    backgroundColor: '#3D352D',
  },
  infoLog: {
    borderLeftColor: '#34C759',
  },
  debugLog: {
    borderLeftColor: '#8E8E93',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  logIcon: {
    fontSize: 14,
  },
  logTime: {
    fontSize: 11,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  logLevel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },
  logMessage: {
    fontSize: 13,
    color: '#E0E0E0',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  logData: {
    fontSize: 11,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#1E1E1E',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  scrollToBottomButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollToBottomText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
});
