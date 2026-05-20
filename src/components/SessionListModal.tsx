import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import {ChatSession, Message} from '../types';
import {formatTimestamp, truncateText} from '../utils/helpers';

interface SessionListModalProps {
  visible: boolean;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNew: () => void;
  onDelete: (sessionId: string) => void;
  onClose: () => void;
}

// First user/assistant message text, for a one-line preview under the title.
function getPreview(session: ChatSession): string {
  const firstText = session.messages.find(
    m => m.role === 'user' || m.role === 'assistant',
  ) as Message | undefined;
  if (!firstText?.content) {
    return 'No messages yet';
  }
  return truncateText(firstText.content.replace(/\n+/g, ' ').trim(), 60);
}

function countMessages(session: ChatSession): number {
  return session.messages.filter(
    m => m.role === 'user' || m.role === 'assistant',
  ).length;
}

export const SessionListModal: React.FC<SessionListModalProps> = ({
  visible,
  sessions,
  currentSessionId,
  onSelect,
  onNew,
  onDelete,
  onClose,
}) => {
  const confirmDelete = (session: ChatSession) => {
    Alert.alert(
      'Delete Session',
      `Delete "${truncateText(session.title, 40)}"? This cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete', style: 'destructive', onPress: () => onDelete(session.id)},
      ],
    );
  };

  const renderItem = ({item}: {item: ChatSession}) => {
    const isActive = item.id === currentSessionId;
    return (
      <TouchableOpacity
        style={[styles.sessionRow, isActive && styles.sessionRowActive]}
        onPress={() => onSelect(item.id)}
        activeOpacity={0.7}>
        <View style={styles.sessionDotColumn}>
          {isActive && <View style={styles.activeDot} />}
        </View>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionTitle} numberOfLines={1}>
            {item.title || 'Untitled chat'}
          </Text>
          <Text style={styles.sessionPreview} numberOfLines={1}>
            {getPreview(item)}
          </Text>
          <Text style={styles.sessionMeta}>
            {countMessages(item)} messages · {formatTimestamp(item.updatedAt)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => confirmDelete(item)}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <Text style={styles.deleteButtonText}>🗑</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Sessions</Text>
            <TouchableOpacity style={styles.newButton} onPress={onNew}>
              <Text style={styles.newButtonText}>＋ New</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={sessions}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No saved sessions yet</Text>
              </View>
            }
          />

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  newButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  newButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 4,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sessionRowActive: {
    backgroundColor: '#F0F7FF',
  },
  sessionDotColumn: {
    width: 16,
    alignItems: 'center',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  sessionInfo: {
    flex: 1,
    marginLeft: 4,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  sessionPreview: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  sessionMeta: {
    fontSize: 11,
    color: '#999',
    marginTop: 3,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  closeButton: {
    marginTop: 12,
    marginHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
});
