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
} from 'react-native';
import {ChatMessage} from '../components/ChatMessage';
import {TypingIndicator} from '../components/TypingIndicator';
import {Message, ChatSession, ModelInfo} from '../types';
import {LlamaService} from '../services/LlamaService';
import {StorageService} from '../services/StorageService';
import {generateId} from '../utils/helpers';
import {
  MAX_MESSAGE_LENGTH,
  MAX_CONTEXT_MESSAGES,
  ERROR_MESSAGES,
} from '../utils/constants';

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

  const flatListRef = useRef<FlatList>(null);

  // Load session on mount
  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({animated: true});
      }, 100);
    }
  }, [messages, streamingText]);

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
      console.error('Failed to load session:', error);
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

    // Check if model is loaded
    if (!LlamaService.isModelLoaded()) {
      Alert.alert('No Model', ERROR_MESSAGES.MODEL_NOT_LOADED, [
        {text: 'Select Model', onPress: onModelSelect},
        {text: 'Cancel', style: 'cancel'},
      ]);
      return;
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsGenerating(true);
    setStreamingText('');

    try {
      // Get recent messages for context (limit to avoid exceeding context window)
      const contextMessages = [...messages, userMessage].slice(
        -MAX_CONTEXT_MESSAGES,
      );

      // Generate response with streaming
      let fullResponse = '';
      const response = await LlamaService.chatCompletion(
        contextMessages,
        {},
        token => {
          // Streaming callback
          fullResponse += token;
          setStreamingText(fullResponse);
        },
      );

      // Create assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response || fullResponse,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStreamingText('');
    } catch (error) {
      console.error('Generation error:', error);
      Alert.alert('Error', ERROR_MESSAGES.GENERATION_FAILED);

      // Add error message
      const errorMessage: Message = {
        id: generateId(),
        role: 'system',
        content: 'Failed to generate response. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
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
          setMessages([]);
          createNewSession();
        },
      },
    ]);
  };

  const renderMessage = ({item}: {item: Message}) => (
    <ChatMessage message={item} />
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
          <Text style={styles.headerTitle}>
            {currentModel?.name || 'No Model Loaded'}
          </Text>
          {!currentModel && (
            <TouchableOpacity onPress={onModelSelect}>
              <Text style={styles.selectModelLink}>Select Model</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={handleClearChat}>
          <Text style={styles.clearButton}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
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
            {renderStreamingMessage()}
            {isGenerating && !streamingText && <TypingIndicator />}
          </>
        }
      />

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
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  selectModelLink: {
    fontSize: 13,
    color: '#007AFF',
    marginTop: 2,
  },
  clearButton: {
    fontSize: 15,
    color: '#FF3B30',
    fontWeight: '500',
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
});
