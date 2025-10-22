import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {ToolService} from '../services/ToolService';
import {Tool, ToolResult} from '../types';

export const ToolTestScreen: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [testResults, setTestResults] = useState<Map<string, ToolResult>>(
    new Map(),
  );
  const [loading, setLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Initialize tool service and get all tools
    ToolService.initialize();
    setTools(ToolService.getAllTools());
  }, []);

  const handleTestTool = async (tool: Tool) => {
    try {
      setLoading(prev => new Set(prev).add(tool.name));

      // Prepare test arguments based on tool parameters
      const testArgs: Record<string, any> = {};

      for (const param of tool.parameters) {
        if (param.required) {
          // Provide default test values
          switch (tool.name) {
            case 'search_web':
              testArgs.query = 'React Native';
              break;
            case 'get_x_trends':
              testArgs.location = 'worldwide';
              break;
            // Add more cases as needed
          }
        }
      }

      console.log(`Testing tool: ${tool.name} with args:`, testArgs);

      const result = await ToolService.executeTool({
        id: `test-${Date.now()}`,
        name: tool.name,
        arguments: testArgs,
      });

      setTestResults(prev => new Map(prev).set(tool.name, result));

      if (result.error) {
        Alert.alert('Tool Error', `${tool.name} failed: ${result.error}`);
      } else {
        Alert.alert('Tool Success', `${tool.name} executed successfully!`);
      }
    } catch (error) {
      console.error(`Test error for ${tool.name}:`, error);
      Alert.alert('Test Error', `Failed to test ${tool.name}`);
    } finally {
      setLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(tool.name);
        return newSet;
      });
    }
  };

  const renderToolCard = (tool: Tool) => {
    const isLoading = loading.has(tool.name);
    const result = testResults.get(tool.name);

    return (
      <View key={tool.name} style={styles.toolCard}>
        <View style={styles.toolHeader}>
          <Text style={styles.toolName}>{tool.name}</Text>
          {result && !result.error && (
            <Text style={styles.successBadge}>✓ PASSED</Text>
          )}
          {result && result.error && (
            <Text style={styles.errorBadge}>✗ FAILED</Text>
          )}
        </View>

        <Text style={styles.toolDescription}>{tool.description}</Text>

        {tool.parameters.length > 0 && (
          <View style={styles.parametersSection}>
            <Text style={styles.parametersTitle}>Parameters:</Text>
            {tool.parameters.map(param => (
              <Text key={param.name} style={styles.parameterText}>
                • {param.name} ({param.type}){param.required ? ' *' : ''}: {param.description}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.testButton,
            isLoading && styles.testButtonDisabled,
          ]}
          onPress={() => handleTestTool(tool)}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.testButtonText}>Test Tool</Text>
          )}
        </TouchableOpacity>

        {result && (
          <View style={styles.resultSection}>
            <Text style={styles.resultTitle}>Last Result:</Text>
            {result.error ? (
              <Text style={styles.errorText}>{result.error}</Text>
            ) : (
              <ScrollView style={styles.resultScroll} nestedScrollEnabled>
                <Text style={styles.resultText}>
                  {JSON.stringify(result.result, null, 2)}
                </Text>
              </ScrollView>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tool Testing</Text>
        <Text style={styles.headerSubtitle}>
          {tools.length} tools available
        </Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How to Test</Text>
          <Text style={styles.infoText}>
            Tap "Test Tool" on any tool below to execute it with sample data.
            Results will appear below each tool.
          </Text>
          <Text style={styles.infoText}>
            Note: Some tools like search_web require internet connection.
          </Text>
        </View>

        {tools.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No tools registered</Text>
          </View>
        ) : (
          tools.map(renderToolCard)
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    margin: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
    marginBottom: 4,
  },
  toolCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  toolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toolName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  successBadge: {
    backgroundColor: '#34C759',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  errorBadge: {
    backgroundColor: '#FF3B30',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  toolDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  parametersSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  parametersTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  parameterText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  testButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  testButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  resultSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  resultScroll: {
    maxHeight: 150,
  },
  resultText: {
    fontSize: 12,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  bottomPadding: {
    height: 24,
  },
});
