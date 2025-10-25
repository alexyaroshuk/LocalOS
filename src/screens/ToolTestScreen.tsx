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
import {SystemPromptType, SYSTEM_PROMPTS} from '../services/SystemPrompts';

export const ToolTestScreen: React.FC = () => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [testResults, setTestResults] = useState<Map<string, ToolResult>>(
    new Map(),
  );
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [backendInfo, setBackendInfo] = useState<string>('');
  const [modelMode, setModelMode] = useState<ModelType>('llama-3.2-1b-function-calling');
  const [promptType, setPromptType] = useState<SystemPromptType>('letta');
  const [toolParams, setToolParams] = useState<Map<string, Record<string, string>>>(new Map());
  const [toolAvailability, setToolAvailability] = useState<Map<string, {available: boolean; reason?: string}>>(new Map());

  // Inference settings state (for final response)
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(512);
  const [topP, setTopP] = useState<number>(0.9);
  const [topK, setTopK] = useState<number>(40);

  // Model config overrides (for tool detection phase)
  const [toolDetectionTemp, setToolDetectionTemp] = useState<number>(
    MODEL_CONFIGS[modelMode].toolDetectionTemp
  );
  const [toolDetectionMaxTokens, setToolDetectionMaxTokens] = useState<number>(
    MODEL_CONFIGS[modelMode].toolDetectionMaxTokens
  );

  // Prompt viewer state
  const [showPromptViewer, setShowPromptViewer] = useState<boolean>(false);

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

    // Get current prompt type from LlamaService to persist selection
    const currentPromptType = LlamaService.getPromptType();
    setPromptType(currentPromptType);
    Logger.info('📝 Current prompt type:', currentPromptType);

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

    const config = MODEL_CONFIGS[newMode];
    Logger.info(`Loading config preset: ${config.displayName}`);

    // Update tool detection settings to match new preset
    setToolDetectionTemp(config.toolDetectionTemp);
    setToolDetectionMaxTokens(config.toolDetectionMaxTokens);

    Alert.alert(
      'Config Preset Loaded',
      `Using ${config.displayName} settings as testing preset:\n\n` +
      `Tool Format: ${config.toolFormat}\n` +
      `Temperature: ${config.toolDetectionTemp}\n` +
      `Max Tokens: ${config.toolDetectionMaxTokens}\n\n` +
      `⚠️ Note: This doesn't change your loaded model, only the test settings. Your actual model is still loaded.`,
    );
  };

  const handlePromptTypeChange = (newType: SystemPromptType) => {
    setPromptType(newType);
    LlamaService.setPromptType(newType);

    const config = SYSTEM_PROMPTS[newType];
    Logger.info(`Switched to ${config.name} system prompt`);

    Alert.alert(
      'System Prompt Changed',
      `${config.name}\n\n${config.description}\n\nTest the tools to see if this prompt works better!`,
    );
  };

  const handleClearContext = () => {
    Alert.alert(
      'Clear Context',
      'This will clear the conversation history and free up context. Continue?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              Logger.info('🗑️ CONTEXT CLEARED - User cleared model context from Tool Test screen');
              Logger.info('Action: Releasing model to free memory and reset conversation history');
              // Clear messages by releasing and reloading the model
              await LlamaService.releaseModel();
              Logger.info('✅ Context cleared successfully - Model will reload on next use');
              Alert.alert('Success', 'Context has been cleared. The model will reload on next use.');
            } catch (error) {
              Logger.error('❌ Failed to clear context:', error);
              Alert.alert('Error', 'Failed to clear context');
            }
          },
        },
      ],
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
          testPrompt = 'Search for latest React Native news';
          break;
        // Memory tools - specific prompts
        case 'archival_memory_insert':
          testPrompt = 'My favorite color is blue. Remember this.';
          break;
        case 'archival_memory_search':
          testPrompt = 'What do you know about me?';
          break;
        case 'core_memory_append':
          testPrompt = 'I prefer concise responses. Update how you talk to me.';
          break;
        case 'core_memory_replace':
          testPrompt = 'Actually, I prefer detailed responses instead of concise ones.';
          break;
        default:
          testPrompt = `Test the ${tool.name} tool`;
      }

      Logger.info('═══════════════════════════════════════════════════════════');
      Logger.info('🧪 TOOL TEST STARTED (from Tool Test Screen)');
      Logger.info('═══════════════════════════════════════════════════════════');
      Logger.info(`Tool being tested: ${tool.name}`);
      Logger.info(`Test prompt: "${testPrompt}"`);
      Logger.info(`Inference settings - Temp: ${temperature}, MaxTokens: ${maxTokens}, TopP: ${topP}, TopK: ${topK}`);

      // Create messages with very explicit system prompt for tool testing
      const messages: Message[] = [
        {
          id: generateId(),
          role: 'user',
          content: testPrompt,
          timestamp: Date.now(),
        },
      ];

      // Call AI with tools enabled using current inference settings
      const result = await AIService.chatCompletionWithTools(
        messages,
        [tool],
        {
          // Final response generation settings
          temperature,
          maxTokens,
          topP,
          topK,
          // Tool detection phase overrides
          toolDetectionTemp,
          toolDetectionMaxTokens,
        },
        undefined,
        (stage, toolName) => {
          Logger.info(`Tool stage: ${stage}, tool: ${toolName}`);
        }
      );

      const toolResult: ToolResult = {
        id: generateId(),
        name: tool.name,
        success: result.usedTool || false,
        data: result.response,
        result: result, // Store full result for display
      };

      setTestResults(prev => new Map(prev).set(tool.name, toolResult));

      if (result.usedTool) {
        Logger.info('✅ TOOL TEST SUCCESS - Tool was called!');
        Logger.info(`Tool called: ${result.toolName}`);
        Logger.info('═══════════════════════════════════════════════════════════');
        Alert.alert(
          'Tool Called! ✅',
          `The AI successfully called ${result.toolName}.\n\nFull response:\n${result.response}`
        );
      } else {
        Logger.warn('❌ TOOL TEST FAILED - Tool was NOT called');
        Logger.warn(`Expected tool: ${tool.name}`);
        Logger.warn(`Response: ${result.response.substring(0, 200)}`);
        Logger.info('═══════════════════════════════════════════════════════════');
        Alert.alert(
          'Tool NOT Called ❌',
          `The AI did not call the ${tool.name} tool.\n\nResponse: ${result.response}`
        );
      }
    } catch (error) {
      Logger.error('❌ TOOL TEST ERROR:', error);
      Logger.info('═══════════════════════════════════════════════════════════');
      const errorMsg = error instanceof Error ? error.message : String(error);
      Alert.alert('Test Error', `Failed to test ${tool.name}: ${errorMsg}`);

      setTestResults(prev => new Map(prev).set(tool.name, {
        id: generateId(),
        name: tool.name,
        result: null,
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
              <Text style={styles.toggleTitle}>Testing Config Preset</Text>
              <Text style={styles.modelModeSubtitle}>
                {MODEL_CONFIGS[modelMode].displayName} Settings
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
            Load default settings for testing. {MODEL_CONFIGS[modelMode].description}
          </Text>
          <View style={styles.modelConfigDetails}>
            <Text style={styles.configDetailText}>
              Tool Format: <Text style={styles.configDetailValue}>{MODEL_CONFIGS[modelMode].toolFormat}</Text>
            </Text>
            <Text style={styles.configDetailText}>
              Detection Temp: <Text style={styles.configDetailValue}>{MODEL_CONFIGS[modelMode].toolDetectionTemp}</Text>
            </Text>
            <Text style={styles.configDetailText}>
              Detection MaxTokens: <Text style={styles.configDetailValue}>{MODEL_CONFIGS[modelMode].toolDetectionMaxTokens}</Text>
            </Text>
            <Text style={styles.configDetailText}>
              Needs Examples: <Text style={styles.configDetailValue}>{MODEL_CONFIGS[modelMode].needsToolExamples ? 'Yes' : 'No'}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.promptSelectorCard}>
          <Text style={styles.promptSelectorTitle}>System Prompt Variant</Text>
          <Text style={styles.promptSelectorSubtitle}>
            {SYSTEM_PROMPTS[promptType].name}
          </Text>
          <Text style={styles.promptSelectorDesc}>
            {SYSTEM_PROMPTS[promptType].description}
          </Text>
          <View style={styles.promptButtonRow}>
            {(Object.keys(SYSTEM_PROMPTS) as SystemPromptType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.promptButton,
                  promptType === type && styles.promptButtonActive,
                ]}
                onPress={() => handlePromptTypeChange(type)}>
                <Text
                  style={[
                    styles.promptButtonText,
                    promptType === type && styles.promptButtonTextActive,
                  ]}>
                  {SYSTEM_PROMPTS[type].name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Prompt Viewer Toggle */}
          <TouchableOpacity
            style={styles.promptViewerToggle}
            onPress={() => setShowPromptViewer(!showPromptViewer)}>
            <Text style={styles.promptViewerToggleText}>
              {showPromptViewer ? '▼' : '▶'} View Full Prompt Text
            </Text>
          </TouchableOpacity>

          {/* Collapsible Prompt Viewer */}
          {showPromptViewer && (() => {
            const fullPrompt = LlamaService.getFullSystemPrompt();
            const charCount = fullPrompt.length;
            const tokenEstimate = LlamaService.estimateTokenCount(fullPrompt);
            return (
              <View style={styles.promptViewerContainer}>
                <View style={styles.promptStats}>
                  <Text style={styles.promptStatText}>
                    Characters: <Text style={styles.promptStatValue}>{charCount.toLocaleString()}</Text>
                  </Text>
                  <Text style={styles.promptStatText}>
                    Est. Tokens: <Text style={styles.promptStatValue}>{tokenEstimate.toLocaleString()}</Text>
                  </Text>
                </View>
                <ScrollView style={styles.promptTextScroll} nestedScrollEnabled>
                  <Text style={styles.promptText} selectable>
                    {fullPrompt}
                  </Text>
                </ScrollView>
              </View>
            );
          })()}
        </View>

        <View style={styles.inferenceSettingsCard}>
          <View style={styles.inferenceHeader}>
            <Text style={styles.inferenceTitle}>Inference Settings</Text>
            <TouchableOpacity
              style={styles.clearContextButton}
              onPress={handleClearContext}>
              <Text style={styles.clearContextButtonText}>🗑️ Clear Context</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.inferenceSubtitle}>
            Adjust generation parameters (affects tool calling behavior)
          </Text>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Temperature: {temperature.toFixed(2)}</Text>
            <View style={styles.settingInputRow}>
              <TextInput
                style={styles.settingInput}
                value={temperature.toString()}
                onChangeText={(text) => {
                  const val = parseFloat(text);
                  if (!isNaN(val) && val >= 0 && val <= 2) setTemperature(val);
                }}
                keyboardType="numeric"
                placeholder="0.7"
              />
              <Text style={styles.settingRange}>0.0 - 2.0</Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Max Tokens: {maxTokens}</Text>
            <View style={styles.settingInputRow}>
              <TextInput
                style={styles.settingInput}
                value={maxTokens.toString()}
                onChangeText={(text) => {
                  const val = parseInt(text);
                  if (!isNaN(val) && val > 0) setMaxTokens(val);
                }}
                keyboardType="numeric"
                placeholder="512"
              />
              <Text style={styles.settingRange}>1 - 4096</Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Top P: {topP.toFixed(2)}</Text>
            <View style={styles.settingInputRow}>
              <TextInput
                style={styles.settingInput}
                value={topP.toString()}
                onChangeText={(text) => {
                  const val = parseFloat(text);
                  if (!isNaN(val) && val >= 0 && val <= 1) setTopP(val);
                }}
                keyboardType="numeric"
                placeholder="0.9"
              />
              <Text style={styles.settingRange}>0.0 - 1.0</Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Top K: {topK}</Text>
            <View style={styles.settingInputRow}>
              <TextInput
                style={styles.settingInput}
                value={topK.toString()}
                onChangeText={(text) => {
                  const val = parseInt(text);
                  if (!isNaN(val) && val > 0) setTopK(val);
                }}
                keyboardType="numeric"
                placeholder="40"
              />
              <Text style={styles.settingRange}>1 - 100</Text>
            </View>
          </View>

          <Text style={styles.inferenceHint}>
            💡 Lower temperature (0.1-0.3) may help with tool calling accuracy. Higher values increase creativity but reduce reliability.
          </Text>
        </View>

        <View style={styles.modelConfigCard}>
          <Text style={styles.modelConfigTitle}>Model Config (Tool Detection Phase)</Text>
          <Text style={styles.modelConfigSubtitle}>
            Advanced: Configure how the model detects tool calls
          </Text>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Detection Temp: {toolDetectionTemp.toFixed(2)}</Text>
            <View style={styles.settingInputRow}>
              <TextInput
                style={styles.settingInput}
                value={toolDetectionTemp.toString()}
                onChangeText={(text) => {
                  const val = parseFloat(text);
                  if (!isNaN(val) && val >= 0 && val <= 2) setToolDetectionTemp(val);
                }}
                keyboardType="numeric"
                placeholder="0.3"
              />
              <Text style={styles.settingRange}>0.0 - 2.0</Text>
            </View>
            <Text style={styles.paramHelp}>
              Controls randomness during tool detection. Lower = more precise/deterministic tool calls. Recommended: 0.1-0.3 for 8B, 0.5-0.7 for 1B.
            </Text>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Detection MaxTokens: {toolDetectionMaxTokens}</Text>
            <View style={styles.settingInputRow}>
              <TextInput
                style={styles.settingInput}
                value={toolDetectionMaxTokens.toString()}
                onChangeText={(text) => {
                  const val = parseInt(text);
                  if (!isNaN(val) && val > 0) setToolDetectionMaxTokens(val);
                }}
                keyboardType="numeric"
                placeholder="512"
              />
              <Text style={styles.settingRange}>50 - 1024</Text>
            </View>
            <Text style={styles.paramHelp}>
              Maximum tokens for tool call output. Too low = truncated tool calls (tool fails). Too high = wasted tokens. Recommended: 512 for complex tools, 200 for simple ones.
            </Text>
          </View>

          <Text style={styles.modelConfigHint}>
            ⚙️ These settings control the FIRST pass where the model decides whether to call a tool. The inference settings above control the SECOND pass (final response generation).
          </Text>
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
  promptSelectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 0,
    borderWidth: 2,
    borderColor: '#9C27B0',
  },
  promptSelectorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  promptSelectorSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9C27B0',
    marginBottom: 4,
  },
  promptSelectorDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  promptButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },
  promptButtonActive: {
    backgroundColor: '#9C27B0',
    borderColor: '#9C27B0',
  },
  promptButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  promptButtonTextActive: {
    color: '#FFFFFF',
  },
  promptViewerToggle: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },
  promptViewerToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9C27B0',
  },
  promptViewerContainer: {
    marginTop: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  promptStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  promptStatText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  promptStatValue: {
    fontWeight: '700',
    color: '#9C27B0',
  },
  promptTextScroll: {
    maxHeight: 300,
  },
  promptText: {
    fontSize: 11,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  inferenceSettingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inferenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inferenceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  inferenceSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  inferenceHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  clearContextButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearContextButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  settingRow: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  settingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingInput: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#000',
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  settingRange: {
    fontSize: 12,
    color: '#666',
    minWidth: 80,
  },
  paramHelp: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  modelConfigCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFD54F',
  },
  modelConfigTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F57C00',
  },
  modelConfigSubtitle: {
    fontSize: 13,
    color: '#E65100',
    marginBottom: 16,
    marginTop: 4,
  },
  modelConfigHint: {
    fontSize: 12,
    color: '#E65100',
    marginTop: 12,
    fontStyle: 'italic',
    lineHeight: 16,
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
