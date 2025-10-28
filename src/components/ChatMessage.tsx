import React, {useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Clipboard, Modal} from 'react-native';
import {Message} from '../types';
import {formatTimestamp} from '../utils/helpers';

interface ChatMessageProps {
  message: Message;
  onCopy?: () => void;
  onEdit?: (messageId: string, content: string) => void;
  onConfirmationResponse?: (messageId: string, response: 'yes' | 'no') => void;
  showConfirmationButtons?: boolean; // Controlled by parent
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onCopy,
  onEdit,
  onConfirmationResponse,
  showConfirmationButtons = false,
}) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const [showContextMenu, setShowContextMenu] = useState(false);

  const handleCopy = () => {
    Clipboard.setString(message.content);
    setShowContextMenu(false);
    onCopy?.();
  };

  const handleEdit = () => {
    setShowContextMenu(false);
    onEdit?.(message.id, message.content);
  };

  const handleLongPress = () => {
    if (isUser) {
      setShowContextMenu(true);
    }
  };

  if (isSystem) {
    return (
      <View style={styles.systemContainer}>
        <Text style={styles.systemText}>
          {message.content}
        </Text>
      </View>
    );
  }

  return (
    <>
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userContainer : styles.assistantContainer,
        ]}>
        <View style={styles.messageWrapper}>
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.assistantBubble,
            ]}>
            {isUser ? (
              <TouchableOpacity
                onLongPress={handleLongPress}
                delayLongPress={500}
                activeOpacity={0.7}>
                <Text
                  style={[styles.messageText, styles.userText]}>
                  {message.content}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text
                style={[styles.messageText, styles.assistantText]}>
                {message.content}
              </Text>
            )}
            <Text style={styles.timestamp}>
              {formatTimestamp(message.timestamp)}
            </Text>
          </View>

          {/* Action buttons for assistant messages */}
          {!isUser && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCopy}>
                <Text style={styles.actionButtonIcon}>📋</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Yes/No confirmation buttons */}
          {!isUser && showConfirmationButtons && onConfirmationResponse && (
            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.yesButton]}
                onPress={() => onConfirmationResponse(message.id, 'yes')}>
                <Text style={styles.confirmButtonText}>✓ Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.noButton]}
                onPress={() => onConfirmationResponse(message.id, 'no')}>
                <Text style={styles.confirmButtonText}>✗ No</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Context menu modal for user messages */}
      {isUser && (
        <Modal
          visible={showContextMenu}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowContextMenu(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowContextMenu(false)}>
            <View style={styles.contextMenu}>
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={handleCopy}>
                <Text style={styles.contextMenuText}>Copy</Text>
              </TouchableOpacity>
              <View style={styles.contextMenuDivider} />
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={handleEdit}>
                <Text style={styles.contextMenuText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
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
  messageWrapper: {
    maxWidth: '80%',
  },
  messageBubble: {
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
  actionButtons: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  actionButtonIcon: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  contextMenuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  contextMenuText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
  },
  contextMenuDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  confirmationButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  yesButton: {
    backgroundColor: '#34C759',
    borderColor: '#2FB84B',
  },
  noButton: {
    backgroundColor: '#FF3B30',
    borderColor: '#E6342A',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
