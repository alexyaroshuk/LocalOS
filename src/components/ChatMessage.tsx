import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert, Clipboard} from 'react-native';
import {Message} from '../types';
import {formatTimestamp} from '../utils/helpers';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({message}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const handleLongPress = () => {
    Alert.alert(
      'Message Options',
      'What would you like to do?',
      [
        {
          text: 'Copy',
          onPress: () => {
            Clipboard.setString(message.content);
            Alert.alert('Copied', 'Message copied to clipboard');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
    );
  };

  if (isSystem) {
    return (
      <TouchableOpacity
        style={styles.systemContainer}
        onLongPress={handleLongPress}
        delayLongPress={500}>
        <Text style={styles.systemText} selectable={true}>
          {message.content}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.messageContainer,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}>
      <TouchableOpacity
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
        onLongPress={handleLongPress}
        delayLongPress={500}
        activeOpacity={0.7}>
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userText : styles.assistantText,
          ]}
          selectable={true}>
          {message.content}
        </Text>
        <Text style={styles.timestamp} selectable={false}>
          {formatTimestamp(message.timestamp)}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: 4,
    marginHorizontal: 12,
    flexDirection: 'row',
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  assistantContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#E9ECEF',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#000000',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.6,
  },
  systemContainer: {
    marginVertical: 8,
    marginHorizontal: 12,
    padding: 8,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    alignItems: 'center',
  },
  systemText: {
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
  },
});
