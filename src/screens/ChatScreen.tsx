import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import {ChatMessage} from '../components/ChatMessage';
import {TypingIndicator} from '../components/TypingIndicator';
import {ToolUsageIndicator} from '../components/ToolUsageIndicator';
import {DebugTestPrompts} from '../components/DebugTestPrompts';
import {LogViewerScreen} from './LogViewerScreen';
import {Toast} from '../components/Toast';
import {Message, ChatSession, ModelInfo} from '../types';
import {AIService} from '../services/AIService';
import {LlamaService} from '../services/LlamaService';
import {StorageService} from '../services/StorageService';
import {generateId} from '../utils/helpers';
import {
  MAX_MESSAGE_LENGTH,
  MAX_CONTEXT_MESSAGES,
  ERROR_MESSAGES,
} from '../utils/constants';
import {Logger} from '../utils/Logger';

interface ChatScreenProps {
  currentModel: ModelInfo | null;
  onModelSelect: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  currentModel,
  onModelSelect,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(
    null,
  );
  const [streamingText, setStreamingText] = useState('');
  const [toolsEnabled, setToolsEnabled] = useState(true); // Enable tools by default
  const [toolUsageState, setToolUsageState] = useState<{
    stage: 'thinking' | 'using_tool' | 'processing' | null;
    toolName?: string;
  }>({stage: null});
  const [aiBackend, setAiBackend] = useState<'apple' | 'llama' | 'none'>('llama');
  const [backendInfo, setBackendInfo] = useState<string>('Initializing...');
  const [showLogs, setShowLogs] = useState(false);
  const [promptMode, setPromptMode] = useState<'langchain' | 'legacy'>('langchain');
  const [contextStats, setContextStats] = useState<{
    totalTokens: number;
    remainingTokens: number;
    usagePercent: number;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{id: string; content: string} | null>(null);

  const flatListRef = useRef<FlatList>(null);

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
  };

  const handleCopy = () => {
    showToastMessage('Copied to clipboard');
  };

  const handleEdit = (messageId: string, content: string) => {
    setEditingMessage({id: messageId, content});
    setInputText(content);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  // Initialize AI backend and load session on mount
  useEffect(() => {
    initializeAI();
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update prompt mode display when it changes
  useEffect(() => {
    const checkPromptMode = () => {
      const isLangchain = LlamaService.isLangchainMode();
      setPromptMode(isLangchain ? 'langchain' : 'legacy');
    };

    // Check initially
    checkPromptMode();

    // Check periodically (in case it's changed from ToolTestScreen)
    const interval = setInterval(checkPromptMode, 1000);

    return () => clearInterval(interval);
  }, []);

  const initializeAI = async () => {
    try {
      Logger.info('🔍 Initializing AI backend...');
      const backend = await AIService.initialize();
      const info = AIService.getBackendInfo();

      setAiBackend(backend);
      setBackendInfo(info.modelName);

      Logger.info('✅ AI Backend:', backend);
      Logger.info('✅ Model:', info.modelName);

      // Enable tools
      if (toolsEnabled) {
        AIService.enableTools();
      }

      // Show user what backend is being used
      if (backend === 'apple') {
      /*   Alert.alert(
          '🚀 Apple Intelligence',
          'Using on-device Apple AI\n\n• 10x faster than Llama\n• Native tool calling\n• Zero downloads\n• Private & offline',
          [{text: 'Got it!'}],
        ); */
      } else if (backend === 'llama') {
        // Only show if model is loaded
        if (!info.isReady) {
          Alert.alert(
            'Llama.cpp Backend',
            'Apple Intelligence not available.\n\nPlease load a model from the Models screen.',
            [
              {text: 'Load Model', onPress: onModelSelect},
              {text: 'Later', style: 'cancel'},
            ],
          );
        }
      }
    } catch (error) {
      Logger.error('Failed to initialize AI:', error);
      setBackendInfo('Initialization failed');
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({animated: true});
      }, 100);
    }
  }, [messages, streamingText]);

  // Update context stats when messages change
  useEffect(() => {
    if (aiBackend === 'llama' && toolsEnabled && messages.length > 0) {
      try {
        const stats = LlamaService.getContextStats(messages);
        setContextStats({
          totalTokens: stats.totalTokens,
          remainingTokens: stats.remainingTokens,
          usagePercent: stats.usagePercent,
        });
      } catch (error) {
        Logger.debug('Failed to get context stats:', error);
      }
    } else {
      setContextStats(null);
    }
  }, [messages, aiBackend, toolsEnabled]);

  // Save session whenever messages change
  useEffect(() => {
    if (currentSession && messages.length > 0) {
      saveSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const loadSession = async () => {
    try {
      const sessionId = await StorageService.loadCurrentSessionId();
      if (sessionId) {
        const sessions = await StorageService.loadSessions();
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
          setCurrentSession(session);
          setMessages(session.messages);
          return;
        }
      }
      // Create new session if none exists
      createNewSession();
    } catch (error) {
      Logger.error('Failed to load session:', error);
      createNewSession();
    }
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      modelId: currentModel?.id || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setCurrentSession(newSession);
    setMessages([]);
    StorageService.saveCurrentSessionId(newSession.id);
  };

  const saveSession = async () => {
    if (!currentSession) return;

    const updatedSession: ChatSession = {
      ...currentSession,
      messages,
      updatedAt: Date.now(),
      // Auto-generate title from first user message
      title:
        messages.length > 0 && currentSession.title === 'New Chat'
          ? messages[0].content.substring(0, 50) + '...'
          : currentSession.title,
    };

    setCurrentSession(updatedSession);
    await StorageService.updateSession(updatedSession);
  };

  const handleSend = async () => {
    if (!inputText.trim() || isGenerating) return;

    // Check if AI backend is ready
    if (!AIService.isReady()) {
      Alert.alert(
        'AI Not Ready',
        aiBackend === 'apple'
          ? 'Apple Intelligence not ready. Please try again.'
          : 'Please load a model from the Models screen.',
        [
          {text: 'Load Model', onPress: onModelSelect},
          {text: 'Cancel', style: 'cancel'},
        ],
      );
      return;
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.info('💬 CHAT MESSAGE (from Chat Screen)');
    Logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Logger.info(`User: ${inputText.trim()}`);
    Logger.info(`Tools enabled: ${toolsEnabled}`);

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsGenerating(true);
    setStreamingText('');
    setToolUsageState({stage: null});

    try {
      // Get recent messages for context (limit to avoid exceeding context window)
      let contextMessages = [...messages, userMessage].slice(
        -MAX_CONTEXT_MESSAGES,
      );

      // Add system prompt if not present AND tools are not enabled
      // When tools are enabled, LlamaService will add its own comprehensive system prompt
      if (!toolsEnabled && (contextMessages.length === 0 || contextMessages[0].role !== 'system')) {
        const systemPrompt: Message = {
          id: generateId(),
          role: 'system',
          content: `You are a helpful AI assistant running locally on this device. Be concise and accurate.`,
          timestamp: Date.now(),
        };
        contextMessages = [systemPrompt, ...contextMessages];
        Logger.info('📝 Added basic system prompt (tools disabled)');
      } else if (toolsEnabled) {
        Logger.info('📝 Skipping ChatScreen system prompt - LlamaService will add tool-enabled prompt');
      }

      // Generate response with tool support if enabled
      let fullResponse = '';
      let usedTool = false;
      let toolName = '';

      if (toolsEnabled && AIService.areToolsSupported()) {
        // Show "Thinking..." state
        setToolUsageState({stage: 'thinking'});

        // Use tool-enabled chat completion
        const result = await AIService.chatCompletionWithTools(
          contextMessages,
          [], // Tools are auto-registered in AIService
          {},
          token => {
            // Streaming callback
            fullResponse += token;
            setStreamingText(fullResponse);
          },
          // Tool usage callback
          (stage, tool) => {
            if (stage === 'tool_call') {
              setToolUsageState({stage: 'using_tool', toolName: tool});
              setStreamingText(''); // Clear streaming text during tool use
            } else if (stage === 'tool_result') {
              setToolUsageState({stage: 'processing'});
            } else if (stage === 'generating') {
              setToolUsageState({stage: null});
            }
          },
        );

        fullResponse = result.response;
        usedTool = result.usedTool || false;
        toolName = result.toolName || '';

        // Log tool usage for debugging
        if (usedTool) {
          Logger.info('✅ Tool was used:', toolName);
        } else {
          Logger.info('ℹ️  No tool was used (normal response)');
        }
      } else {
        // Regular chat completion without tools
        const response = await AIService.chatCompletion(
          contextMessages,
          {},
          token => {
            // Streaming callback
            fullResponse += token;
            setStreamingText(fullResponse);
          },
        );
        fullResponse = response;
      }

      // Clear tool usage state
      setToolUsageState({stage: null});

      // Create assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStreamingText('');

      // Show tool usage indicator
      if (usedTool) {
        Logger.info(`🔧 Tool used: ${toolName}`);
        Logger.info(`✨ Response generated using tool data`);
      } else {
        Logger.info(`💬 Regular response (no tools used)`);
      }
    } catch (error) {
      Logger.error('Generation error:', error);
      Logger.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });

      const errorMsg = error instanceof Error ? error.message : ERROR_MESSAGES.GENERATION_FAILED;
      Alert.alert('Error', errorMsg);

      // Add error message
      const errorMessage: Message = {
        id: generateId(),
        role: 'system',
        content: 'Failed to generate response. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setToolUsageState({stage: null});
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearChat = () => {
    Alert.alert('Clear Chat', 'Are you sure you want to clear this chat?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          Logger.info('🗑️ CHAT CLEARED - User cleared all messages in chat');
          Logger.info(`Previous message count: ${messages.length}`);
          setMessages([]);
          createNewSession();
          Logger.info('✅ New chat session created');
        },
      },
    ]);
  };

  const toggleTools = () => {
    const newToolsState = !toolsEnabled;
    setToolsEnabled(newToolsState);

    if (newToolsState) {
      AIService.enableTools();
    } else {
      AIService.disableTools();
    }

    const toolMessage =
      aiBackend === 'apple'
        ? newToolsState
          ? 'Apple Intelligence native tool calling enabled (95%+ accuracy)'
          : 'Tool calling disabled'
        : newToolsState
        ? 'Llama tool calling enabled (~80% accuracy - consider using Apple Intelligence for better results)'
        : 'Tool calling disabled';

    Alert.alert('Tools ' + (newToolsState ? 'Enabled' : 'Disabled'), toolMessage);
  };

  const switchBackend = async () => {
    const targetBackend = aiBackend === 'apple' ? 'llama' : 'apple';

    Alert.alert(
      'Switch Backend',
      `Switch to ${targetBackend === 'apple' ? 'Apple Intelligence' : 'Llama.cpp'}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Switch',
          onPress: async () => {
            try {
              const success = await AIService.switchBackend(targetBackend);
              if (success) {
                const info = AIService.getBackendInfo();
                setAiBackend(targetBackend);
                setBackendInfo(info.modelName);
                Alert.alert(
                  'Backend Switched',
                  `Now using ${targetBackend === 'apple' ? 'Apple Intelligence' : 'Llama.cpp'}`,
                );
              } else {
                Alert.alert(
                  'Switch Failed',
                  targetBackend === 'apple'
                    ? 'Apple Intelligence not available on this device'
                    : 'Could not switch to Llama.cpp',
                );
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to switch backend');
              Logger.error('Backend switch error:', error);
            }
          },
        },
      ],
    );
  };

  const renderMessage = ({item}: {item: Message}) => (
    <ChatMessage
      message={item}
      onCopy={handleCopy}
      onEdit={handleEdit}
    />
  );

  const renderStreamingMessage = () => {
    if (!streamingText) return null;

    const streamingMessage: Message = {
      id: 'streaming',
      role: 'assistant',
      content: streamingText,
      timestamp: Date.now(),
    };

    return <ChatMessage message={streamingMessage} />;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.modelInfoRow}>
            <Text style={styles.headerTitle}>{backendInfo}</Text>
            {aiBackend === 'apple' && (
              <View style={styles.applebadge}>
                <Text style={styles.appleBadgeText}>⚡ Apple AI</Text>
              </View>
            )}
          </View>
          {aiBackend === 'llama' && toolsEnabled && (
            <View style={styles.promptModeContainer}>
              <View style={[
                styles.promptModeBadge,
                promptMode === 'langchain' ? styles.promptModeLangchain : styles.promptModeLegacy
              ]}>
                <Text style={styles.promptModeText}>
                  {promptMode === 'langchain' ? '🔗 Langchain' : '📝 Legacy'}
                </Text>
              </View>
            </View>
          )}
          {contextStats && (
            <View style={styles.contextMeterContainer}>
              <View style={styles.contextMeterBar}>
                <View
                  style={[
                    styles.contextMeterFill,
                    {
                      width: `${Math.min(contextStats.usagePercent, 100)}%`,
                      backgroundColor:
                        contextStats.usagePercent < 50
                          ? '#34C759'
                          : contextStats.usagePercent < 80
                          ? '#FF9500'
                          : '#FF3B30',
                    },
                  ]}
                />
              </View>
              <Text style={styles.contextMeterText}>
                {contextStats.totalTokens.toLocaleString()}
                {' / '}
                {(contextStats.totalTokens + contextStats.remainingTokens).toLocaleString()}
                {' tokens ('}
                {contextStats.usagePercent.toFixed(0)}
                {'%)'}
              </Text>
            </View>
          )}
          {aiBackend === 'llama' && !AIService.isReady() && (
            <TouchableOpacity onPress={onModelSelect}>
              <Text style={styles.selectModelLink}>Load Model</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={switchBackend} style={styles.backendButton}>
            <Text style={styles.backendButtonText}>
              {aiBackend === 'apple' ? '🔄 → Llama' : '🔄 → Apple'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTools} style={styles.toolsButton}>
            <Text
              style={[
                styles.toolsButtonText,
                toolsEnabled && styles.toolsButtonActive,
              ]}>
              Tools {toolsEnabled ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowLogs(true)}>
            <Text style={styles.logsButton}>📋 Logs</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearChat}>
            <Text style={styles.clearButton}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages - Wrap in Pressable to handle taps on empty space */}
      <Pressable style={styles.messageList} onPress={() => {}}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {currentModel
                  ? 'Start a conversation!'
                  : 'Please load a model to start chatting'}
              </Text>
            </View>
          }
          ListFooterComponent={
            <>
              {toolUsageState.stage && (
                <ToolUsageIndicator
                  stage={toolUsageState.stage}
                  toolName={toolUsageState.toolName}
                />
              )}
              {renderStreamingMessage()}
              {isGenerating && !streamingText && !toolUsageState.stage && (
                <TypingIndicator />
              )}
            </>
          }
        />
      </Pressable>

      {/* Debug Test Prompts */}
      <DebugTestPrompts
        onPromptSelect={prompt => setInputText(prompt)}
        disabled={isGenerating}
      />

      {/* Edit Mode Banner */}
      {editingMessage && (
        <View style={styles.editBanner}>
          <View style={styles.editBannerContent}>
            <Text style={styles.editBannerTitle}>Editing message</Text>
            <Text style={styles.editBannerText} numberOfLines={1}>
              {editingMessage.content}
            </Text>
          </View>
          <TouchableOpacity onPress={cancelEdit} style={styles.editCancelButton}>
            <Text style={styles.editCancelText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type your message..."
          placeholderTextColor="#999"
          multiline
          maxLength={MAX_MESSAGE_LENGTH}
          editable={!isGenerating}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() || isGenerating) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isGenerating}>
          {isGenerating ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        visible={showToast}
        onHide={() => setShowToast(false)}
      />

      {/* Log Viewer Modal */}
      <Modal
        visible={showLogs}
        animationType="slide"
        onRequestClose={() => setShowLogs(false)}>
        <LogViewerScreen onClose={() => setShowLogs(false)} />
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  modelInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  applebadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  appleBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  selectModelLink: {
    fontSize: 13,
    color: '#007AFF',
    marginTop: 2,
  },
  promptModeContainer: {
    marginTop: 4,
  },
  promptModeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  promptModeLangchain: {
    backgroundColor: '#34C759',
  },
  promptModeLegacy: {
    backgroundColor: '#FF9500',
  },
  promptModeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contextMeterContainer: {
    marginTop: 6,
  },
  contextMeterBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 3,
  },
  contextMeterFill: {
    height: '100%',
    borderRadius: 2,
  },
  contextMeterText: {
    fontSize: 9,
    color: '#666',
    fontWeight: '500',
  },
  backendButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  backendButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  toolsButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
  },
  toolsButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  toolsButtonActive: {
    color: '#34C759',
  },
  logsButton: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  clearButton: {
    fontSize: 15,
    color: '#FF3B30',
    fontWeight: '500',
  },
  messageList: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
    height: 40,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editBanner: {
    backgroundColor: '#FFF3CD',
    borderTopWidth: 1,
    borderTopColor: '#FFE69C',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editBannerContent: {
    flex: 1,
    marginRight: 12,
  },
  editBannerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 2,
  },
  editBannerText: {
    fontSize: 14,
    color: '#856404',
  },
  editCancelButton: {
    padding: 4,
  },
  editCancelText: {
    fontSize: 20,
    color: '#856404',
    fontWeight: '600',
  },
});
