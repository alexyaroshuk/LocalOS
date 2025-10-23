import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ScrollView} from 'react-native';

interface DebugTestPromptsProps {
  onPromptSelect: (prompt: string) => void;
  disabled?: boolean;
}

const TEST_PROMPTS = [
  {
    category: 'General Knowledge (No Tools)',
    prompts: [
      'Hi',
      'What is React Native?',
      'Explain async/await in JavaScript',
      'What is machine learning?',
      'How does HTTP work?',
    ],
  },
  {
    category: 'Current Time/Date (Should Use Tool)',
    prompts: [
      'What day is today?',
      'What time is it?',
      "What's the current date?",
      'What day of the week is it?',
    ],
  },
  {
    category: 'Web Search (Should Use Tool)',
    prompts: [
      'Search for React Native',
      "What's trending on Twitter?",
      'Latest news about AI',
      'Search for Llama 3.2 release',
    ],
  },
];

export const DebugTestPrompts: React.FC<DebugTestPromptsProps> = ({
  onPromptSelect,
  disabled = false,
}) => {
  // Start expanded by default so users can see the prompts immediately
  const [isExpanded, setIsExpanded] = React.useState(true);

  if (!isExpanded) {
    return (
      <TouchableOpacity
        style={styles.expandButton}
        onPress={() => setIsExpanded(true)}>
        <Text style={styles.expandButtonText}>🧪 Quick Tests</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quick Test Prompts</Text>
        <TouchableOpacity onPress={() => setIsExpanded(false)}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {TEST_PROMPTS.map((category, idx) => (
          <View key={idx} style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.category}</Text>
            <View style={styles.promptsGrid}>
              {category.prompts.map((prompt, promptIdx) => (
                <TouchableOpacity
                  key={promptIdx}
                  style={[
                    styles.promptButton,
                    disabled && styles.promptButtonDisabled,
                  ]}
                  onPress={() => !disabled && onPromptSelect(prompt)}
                  disabled={disabled}>
                  <Text style={styles.promptButtonText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  expandButton: {
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  expandButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    height: 250,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    fontSize: 20,
    color: '#666',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  promptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  promptButton: {
    backgroundColor: '#F0F4FF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    margin: 4,
  },
  promptButtonDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#CCCCCC',
  },
  promptButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
});
