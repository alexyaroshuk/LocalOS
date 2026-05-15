import React, {useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Clipboard, Modal} from 'react-native';
import {Message, MessageTimings} from '../types';
import {formatTimestamp} from '../utils/helpers';

function formatTimings(t: MessageTimings): string {
  const parts: string[] = [];
  if (t.predicted_per_token_ms != null) {
    parts.push(`${t.predicted_per_token_ms.toFixed(0)} ms/token`);
  }
  if (t.predicted_per_second != null) {
    parts.push(`${t.predicted_per_second.toFixed(1)} t/s`);
  }
  if (t.time_to_first_token_ms != null) {
    parts.push(`${t.time_to_first_token_ms} ms TTFT`);
  }
  return parts.join(', ');
}

interface JournalProposal {
  title: string;
  folder: string;
  relativePath: string;
  content: string;
  date: string;
}

interface ChatMessageProps {
  message: Message;
  onCopy?: () => void;
  onEdit?: (messageId: string, content: string) => void;
  toolConfirmation?: {
    type: 'choice' | 'single';
    tools?: string[];
    tool?: string;
  };
  onToolSelection?: (messageId: string, toolName: string) => void;
  journalProposal?: JournalProposal;
  onProposalReview?: (proposal: JournalProposal) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onCopy,
  onEdit,
  toolConfirmation,
  onToolSelection,
  journalProposal,
  onProposalReview,
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

          {/* Action buttons + pocketpal-style timings for assistant messages */}
          {!isUser && message.id !== 'streaming' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCopy}>
                <Text style={styles.actionButtonIcon}>📋</Text>
              </TouchableOpacity>
              {message.timings && (
                <Text style={styles.timingsFooter}>
                  {formatTimings(message.timings)}
                </Text>
              )}
            </View>
          )}

          {/* Tool-specific confirmation buttons */}
          {!isUser && toolConfirmation && onToolSelection && (
            <View style={styles.confirmationButtons}>
              {toolConfirmation.type === 'choice' && toolConfirmation.tools && (
                // Multiple tool choice buttons
                toolConfirmation.tools.map((tool, index) => (
                  <TouchableOpacity
                    key={tool}
                    style={[
                      styles.confirmButton,
                      index === 0 ? styles.primaryButton : styles.secondaryButton
                    ]}
                    onPress={() => onToolSelection(message.id, tool)}>
                    <Text style={styles.confirmButtonText}>
                      {tool.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
              {toolConfirmation.type === 'single' && toolConfirmation.tool && (
                // Single "Use tool" button
                <TouchableOpacity
                  style={[styles.confirmButton, styles.singleToolButton]}
                  onPress={() => onToolSelection(message.id, toolConfirmation.tool!)}>
                  <Text style={styles.confirmButtonText}>
                    Use {toolConfirmation.tool.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Journal proposal button (hide during streaming) */}
          {!isUser && message.id !== 'streaming' && journalProposal && onProposalReview && (
            <View style={styles.journalProposalCard}>
              <View style={styles.journalProposalHeader}>
                <Text style={styles.journalProposalIcon}>📝</Text>
                <View style={styles.journalProposalInfo}>
                  <Text style={styles.journalProposalTitle}>
                    {journalProposal.title}
                  </Text>
                  <Text style={styles.journalProposalSubtitle}>
                    {journalProposal.folder}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.journalProposalButton}
                onPress={() => onProposalReview(journalProposal)}>
                <Text style={styles.journalProposalButtonText}>
                  📄 Review & Edit Note
                </Text>
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
  timingsFooter: {
    fontSize: 11,
    color: '#6C757D',
    opacity: 0.7,
    flexShrink: 1,
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
    alignItems: 'center',
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
  primaryButton: {
    backgroundColor: '#007AFF',
    borderColor: '#0066DD',
  },
  secondaryButton: {
    backgroundColor: '#5856D6',
    borderColor: '#4745B3',
  },
  singleToolButton: {
    backgroundColor: '#34C759',
    borderColor: '#2FB84B',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  journalProposalCard: {
    marginTop: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  journalProposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  journalProposalIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  journalProposalInfo: {
    flex: 1,
  },
  journalProposalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 2,
  },
  journalProposalSubtitle: {
    fontSize: 13,
    color: '#6C757D',
  },
  journalProposalButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  journalProposalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
