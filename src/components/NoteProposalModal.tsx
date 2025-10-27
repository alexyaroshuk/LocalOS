/**
 * NoteProposalModal - Bottom sheet for reviewing and editing proposed notes
 */
import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Markdown from 'react-native-markdown-display';

interface NoteProposal {
  title: string;
  folder: string;
  relativePath: string;
  content: string;
  date: string;
}

interface NoteProposalModalProps {
  visible: boolean;
  proposal: NoteProposal | null;
  onClose: () => void;
  onSave: (content: string) => void;
  onRefine: () => void;
}

export const NoteProposalModal: React.FC<NoteProposalModalProps> = ({
  visible,
  proposal,
  onClose,
  onSave,
  onRefine,
}) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('preview');
  const [editedContent, setEditedContent] = useState('');

  React.useEffect(() => {
    if (proposal) {
      setEditedContent(proposal.content);
      setActiveTab('preview');
    }
  }, [proposal]);

  if (!proposal) {
    return null;
  }

  const handleSave = () => {
    onSave(editedContent);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerIcon}>📝</Text>
              <View>
                <Text style={styles.title}>{proposal.title}</Text>
                <Text style={styles.subtitle}>{proposal.folder}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'preview' && styles.activeTab]}
              onPress={() => setActiveTab('preview')}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'preview' && styles.activeTabText,
                ]}>
                Preview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'edit' && styles.activeTab]}
              onPress={() => setActiveTab('edit')}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'edit' && styles.activeTabText,
                ]}>
                Edit
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <View style={styles.contentContainer}>
            {activeTab === 'preview' ? (
              <ScrollView style={styles.previewScroll}>
                <Markdown style={markdownStyles}>{editedContent}</Markdown>
              </ScrollView>
            ) : (
              <TextInput
                style={styles.editor}
                value={editedContent}
                onChangeText={setEditedContent}
                multiline
                placeholder="Edit your note here..."
                placeholderTextColor="#999"
                textAlignVertical="top"
              />
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onRefine}>
              <Text style={styles.secondaryButtonText}>💬 Refine</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
              <Text style={styles.primaryButtonText}>💾 Save to Vault</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const {height} = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.85,
    minHeight: height * 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
    lineHeight: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  previewScroll: {
    flex: 1,
    padding: 16,
  },
  editor: {
    flex: 1,
    padding: 16,
    fontSize: 15,
    color: '#1a1a1a',
    fontFamily: 'Courier',
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: '#1a1a1a',
  },
  heading1: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    color: '#1a1a1a',
  },
  heading2: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
    color: '#1a1a1a',
  },
  heading3: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    color: '#1a1a1a',
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 12,
  },
  listItem: {
    marginBottom: 6,
  },
  bullet_list: {
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  code_inline: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'Courier',
    fontSize: 14,
    color: '#c7254e',
  },
  fence: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontFamily: 'Courier',
    fontSize: 14,
  },
  blockquote: {
    backgroundColor: '#f9f9f9',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    paddingLeft: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  hr: {
    backgroundColor: '#e0e0e0',
    height: 1,
    marginVertical: 16,
  },
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  strong: {
    fontWeight: '700',
  },
  em: {
    fontStyle: 'italic',
  },
});
