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
  Switch,
  TextInput,
} from 'react-native';
import {ToolService} from '../services/ToolService';
import {AIService} from '../services/AIService';
import {LlamaService} from '../services/LlamaService';
import {Tool, ToolResult, Message} from '../types';
import {generateId} from '../utils/helpers';
import {Logger} from '../utils/Logger';
import {ModelType, MODEL_CONFIGS} from '../types/modelConfig';

export const ToolTestScreen: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [testResults, setTestResults] = useState<Map<string, ToolResult>>(
    new Map(),
  );
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [backendInfo, setBackendInfo] = useState<string>('');
  const [modelMode, setModelMode] = useState<ModelType>('llama-3.2-1b-function-calling');
  const [toolParams, setToolParams] = useState<Map<string, Record<string, string>>>(new Map());
  const [toolAvailability, setToolAvailability] = useState<Map<string, {available: boolean; reason?: string}>>(new Map());

  useEffect(() => {
    // Initialize tool service and get all tools
    ToolService.initialize();
    const allTools = ToolService.getAllTools();
    setTools(allTools);

    // Enable tools for testing
    AIService.enableTools();
    Logger.info('🔧 Tools enabled for testing');

    // Get current backend info
    const info = AIService.getBackendInfo();
    setBackendInfo(`${info.backend} - ${info.modelName}`);
    Logger.info('Tools supported?', AIService.areToolsSupported());

    // Check availability for all tools
    checkAllToolsAvailability(allTools);
  }, []);

  const checkAllToolsAvailability = async (toolsList: Tool[]) => {
    const availabilityMap = new Map<string, {available: boolean; reason?: string}>();

    for (const tool of toolsList) {
      if (tool.checkAvailability) {
        try {
          const result = await tool.checkAvailability();
          availabilityMap.set(tool.name, result);
        } catch (error) {
          availabilityMap.set(tool.name, {
            available: false,
            reason: 'Availability check failed',
          });
        }
      } else {
        availabilityMap.set(tool.name, {available: true});
      }
    }

    setToolAvailability(availabilityMap);
  };

  const handleToggleModelMode = (value: boolean) => {
    const newMode: ModelType = value ? 'llama-3.1-8b-instruct' : 'llama-3.2-1b-function-calling';
    setModelMode(newMode);
    LlamaService.setModelMode(newMode);

    const config = MODEL_CONFIGS[newMode];
    Logger.info(`Switched to ${config.displayName}`);

    Alert.alert(
      'Model Mode Changed',
      `${config.displayName}\n\n` +
      `Tool Format: ${config.toolFormat}\n` +
      `Temperature: ${config.toolDetectionTemp}\n` +
      `Max Tokens: ${config.toolDetectionMaxTokens}\n` +
      `Context Size: ${config.contextSize.toLocaleString()}\n\n` +
      `${config.description}`,
    );
  };

  // Get sample test data for tool parameters
  const getDefaultParamValue = (toolName: string, paramName: string): string => {
    const sampleData: Record<string, Record<string, string>> = {
      core_memory_append: {
        label: 'user_profile',
        content: 'Favorite color: blue, enjoys TypeScript programming',
      },
      core_memory_replace: {
        label: 'user_profile',
        old_content: 'New user',
        new_content: 'Experienced developer who loves React Native',
      },
      archival_memory_insert: {
        content: 'User prefers working in the morning, drinks coffee',
        tags: 'habit, preference',
      },
      archival_memory_search: {
        query: 'TypeScript programming preferences',
        top_k: '5',
      },
      conversation_search: {
        query: 'React Native discussion',
        limit: '5',
      },
      search_web: {
        query: 'Latest React Native news',
      },
    };

    return sampleData[toolName]?.[paramName] || '';
  };

  const handleDirectToolTest = async (toolName: string) => {
    try {
      Logger.info(`Direct tool execution test: ${toolName}`);

      const tool = ToolService.getTool(toolName);
      if (!tool) {
        Alert.alert('Error', `${toolName} tool not found`);
        return;
      }

      // Get manual parameters or use defaults
      const params = toolParams.get(toolName) || {};
      const args: Record<string, any> = {};

      // Build args from manual params or defaults
      for (const param of tool.parameters) {
        if (params[param.name]) {
          // User has entered a value
          args[param.name] = params[param.name];
        } else {
          // Use sample data if available
          const defaultValue = getDefaultParamValue(toolName, param.name);
          if (defaultValue) {
            args[param.name] = defaultValue;
          } else if (param.required) {
            // Fallback for required params
            args[param.name] = `sample_${param.name}`;
          }
        }
      }

      Logger.info('Executing with args:', args);

      const result = await tool.execute(args);
      Logger.info('Direct tool result:', result);

      Alert.alert(
        'Direct Tool Execution Result',
        JSON.stringify(result, null, 2),
        [{text: 'OK'}]
      );
    } catch (error) {
      Logger.error('Direct tool test error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : String(error));
    }
  };

  const handleTestTool = async (tool: Tool) => {
    try {
      setLoading(prev => new Set(prev).add(tool.name));

      // Check if tools are supported by current backend
      if (!AIService.areToolsSupported()) {
        Alert.alert(
          'Tools Not Supported',
          `Current backend (${AIService.getCurrentBackend()}) does not support tool calling. Switch to Llama backend to test tools.`
        );
        setLoading(prev => {
          const newSet = new Set(prev);
          newSet.delete(tool.name);
          return newSet;
        });
        return;
      }

      // Create test prompt that should trigger the tool
      let testPrompt = '';
      switch (tool.name) {
        case 'get_current_datetime':
          testPrompt = 'What is the current date and time?';
          break;
        case 'search_web':
          testPrompt = 'Search the web for React Native tutorials';
          break;
        default:
          testPrompt = `Use the ${tool.name} tool to help me`;
      }

      Logger.info(`Testing tool with AI backend: ${tool.name}`);
      Logger.info(`Test prompt: "${testPrompt}"`);

      // Create messages with very explicit system prompt for tool testing
      const messages: Message[] = [
        {
          id: generateId(),
          role: 'user',
          content: testPrompt,
          timestamp: Date.now(),
        },
      ];

      // Call AI with tools enabled
      const result = await AIService.chatCompletionWithTools(
        messages,
        [tool],
        {},
        undefined,
        (stage, toolName) => {
          Logger.info(`Tool stage: ${stage}, tool: ${toolName}`);
        }
      );

      const toolResult: ToolResult = {
        success: result.usedTool || false,
        data: result.response,
        result: result, // Store full result for display
      };

      setTestResults(prev => new Map(prev).set(tool.name, toolResult));

      if (result.usedTool) {
        Alert.alert(
          'Tool Called! ✅',
          `The AI successfully called ${result.toolName}.\n\nFull response:\n${result.response}`
        );
      } else {
        Alert.alert(
          'Tool NOT Called ❌',
          `The AI did not call the ${tool.name} tool.\n\nResponse: ${result.response}`
        );
      }
    } catch (error) {
      Logger.error(`Test error for ${tool.name}:`, error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      Alert.alert('Test Error', `Failed to test ${tool.name}: ${errorMsg}`);

      setTestResults(prev => new Map(prev).set(tool.name, {
        success: false,
        error: errorMsg,
      }));
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
    const availability = toolAvailability.get(tool.name);

    return (
      <View key={tool.name} style={styles.toolCard}>
        <View style={styles.toolHeader}>
          <Text style={styles.toolName}>{tool.name}</Text>
          {availability && !availability.available && (
            <Text style={styles.unavailableBadge}>⚠ OFFLINE</Text>
          )}
          {result && !result.error && (
            <Text style={styles.successBadge}>✓ PASSED</Text>
          )}
          {result && result.error && (
            <Text style={styles.errorBadge}>✗ FAILED</Text>
          )}
        </View>

        <Text style={styles.toolDescription}>{tool.description}</Text>

        {availability && !availability.available && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ {availability.reason || 'Tool not available'}
            </Text>
          </View>
        )}

        {tool.parameters.length > 0 && (
          <View style={styles.parametersSection}>
            <Text style={styles.parametersTitle}>Parameters (auto-filled with sample data):</Text>
            {tool.parameters.map(param => {
              const sampleValue = getDefaultParamValue(tool.name, param.name);
              return (
                <View key={param.name} style={styles.paramInputContainer}>
                  <Text style={styles.paramLabel}>
                    {param.name}{param.required ? ' *' : ''}:
                  </Text>
                  <TextInput
                    style={styles.paramInput}
                    placeholder={sampleValue || `Enter ${param.name}`}
                    value={toolParams.get(tool.name)?.[param.name] || ''}
                    onChangeText={(text) => {
                      const currentParams = toolParams.get(tool.name) || {};
                      setToolParams(new Map(toolParams).set(tool.name, {
                        ...currentParams,
                        [param.name]: text,
                      }));
                    }}
                  />
                  {sampleValue && !toolParams.get(tool.name)?.[param.name] && (
                    <Text style={styles.sampleHint}>
                      Sample: {sampleValue}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.buttonRow}>
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
              <Text style={styles.testButtonText}>Test with AI</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.directTestButton}
            onPress={() => handleDirectToolTest(tool.name)}>
            <Text style={styles.directTestButtonText}>Direct Call</Text>
          </TouchableOpacity>
        </View>

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
          {tools.length} tools available | Backend: {backendInfo}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.modelModeCard}>
          <View style={styles.toggleHeader}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleTitle}>Model Configuration</Text>
              <Text style={styles.modelModeSubtitle}>
                {MODEL_CONFIGS[modelMode].displayName}
              </Text>
            </View>
            <Switch
              value={modelMode === 'llama-3.1-8b-instruct'}
              onValueChange={handleToggleModelMode}
              trackColor={{false: '#D1D1D6', true: '#FF9500'}}
              thumbColor="#FFFFFF"
            />
          </View>
          <Text style={styles.toggleDescription}>
            {MODEL_CONFIGS[modelMode].description}
          </Text>
          <View style={styles.modelConfigDetails}>
            <Text style={styles.configDetailText}>
              Tool Format: <Text style={styles.configDetailValue}>{MODEL_CONFIGS[modelMode].toolFormat}</Text>
            </Text>
            <Text style={styles.configDetailText}>
              Temperature: <Text style={styles.configDetailValue}>{MODEL_CONFIGS[modelMode].toolDetectionTemp}</Text>
            </Text>
            <Text style={styles.configDetailText}>
              Max Tokens: <Text style={styles.configDetailValue}>{MODEL_CONFIGS[modelMode].toolDetectionMaxTokens}</Text>
            </Text>
            <Text style={styles.configDetailText}>
              Context Size: <Text style={styles.configDetailValue}>{MODEL_CONFIGS[modelMode].contextSize.toLocaleString()}</Text>
            </Text>
            <Text style={styles.configDetailText}>
              Needs Examples: <Text style={styles.configDetailValue}>{MODEL_CONFIGS[modelMode].needsToolExamples ? 'Yes' : 'No'}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How Tool Testing Works</Text>
          <Text style={styles.infoText}>
            Tests whether the current AI backend can actually call tools during generation.
          </Text>
          <Text style={styles.infoText}>
            ⚠️ Apple Intelligence does NOT support tool calling (SDK limitation).
          </Text>
          <Text style={styles.infoText}>
            ✅ Llama DOES support tool calling (enable tools in Settings first).
          </Text>
          <Text style={styles.infoText}>
            Current backend: <Text style={{fontWeight: 'bold'}}>{backendInfo}</Text>
          </Text>
          <Text style={styles.infoText}>
            Tools supported: <Text style={{fontWeight: 'bold'}}>{AIService.areToolsSupported() ? 'YES ✅' : 'NO ❌'}</Text>
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
  toggleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#34C759',
  },
  modelModeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
    marginTop: 0,
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  toggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  toggleSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  modelModeSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
  },
  toggleDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  modelConfigDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  configDetailText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
  configDetailValue: {
    fontWeight: '600',
    color: '#000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 8,
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
    marginLeft: 4,
  },
  unavailableBadge: {
    backgroundColor: '#FF9500',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 4,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    fontWeight: '500',
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
    marginBottom: 12,
  },
  parameterText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  paramInputContainer: {
    marginBottom: 10,
  },
  paramLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  paramInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#000',
  },
  sampleHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  directTestButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directTestButtonText: {
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
