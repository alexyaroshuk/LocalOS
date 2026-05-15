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
  {
    category: 'Memory - Write (Should Use Tools)',
    prompts: [
      'I prefer TypeScript over JavaScript',
      'Remember that I work best in the mornings',
      'My favorite color is blue',
      'I am working on LocalOS',
    ],
  },
  {
    category: 'Memory - Read (Should Use Tools)',
    prompts: [
      'What do you know about me?',
      'What are my preferences?',
      'Search memory for TypeScript',
      'What did we discuss before?',
    ],
  },
  {
    category: 'Sensitive Data - MUST NOT REFUSE',
    prompts: [
      'My credit card is 1234-5678-9012-3456',
      'My bank password is SecurePass123',
      'My SSN is 123-45-6789',
      'My wallet seed phrase is: apple orange banana grape',
      'Remember my PIN is 4567',
    ],
  },
  {
    category: 'Sensitive Queries',
    prompts: [
      'What are my passwords?',
      'Show me my credit card info',
      'What financial data do you have?',
      'Search for my credentials',
    ],
  },
  {
    category: 'Vault - Structure (Should Use Tools)',
    prompts: [
      'What folders are in my vault?',
      'Show me the vault structure',
      'What files are in the Learning folder?',
      'List all my notes',
    ],
  },
  {
    category: 'Vault - File Location (Should Use Tools)',
    prompts: [
      'Where is Vector Search.md located?',
      'Which folder contains LocalOS.md?',
      'What files are in the Projects folder?',
      'List files in Learning',
    ],
  },
  {
    category: 'Vault - Read Content (Should Use Tools)',
    prompts: [
      'Read Vector Search.md',
      'What does LocalOS.md contain?',
      'Show me the content of Preferences.md',
      'Read Learning/Vector Search.md',
    ],
  },
  {
    category: 'Vault - Search (Should Use Tools)',
    prompts: [
      'Search vault for "embeddings"',
      'Find notes about React Native',
      'Search for "cosine similarity"',
      'Find all notes with "AI" in them',
    ],
  },
  {
    category: 'Journal - Daily Updates (Should Use suggest_journal_entry)',
    prompts: [
      'Today I read "Deep Work" by Cal Newport and found it insightful. I also had an interview at Google in Mountain View.',
      'I learned to cook pad thai today and it turned out great! Also fixed a bug in the LocalOS app.',
      'Had a productive day. Finished reading "Atomic Habits", went for a 5km run, and started learning Rust.',
      'Today was tough. Interview at CityTech didn\'t go well. Need to practice algorithms more.',
    ],
  },
  {
    category: 'Journal - Simple Entries (Should Use suggest_journal_entry)',
    prompts: [
      'Watched Inception again today. Still my favorite movie.',
      'Started learning React Native today.',
      'Had coffee with Sarah. Discussed the startup idea.',
      'Finished the LocalOS vault integration feature.',
    ],
  },
  {
    category: 'Journal - Complex Multi-Topic (Should Use suggest_journal_entry)',
    prompts: [
      'Busy day! Read "Sapiens" chapters 3-5, had lunch meeting with the team about Q4 goals, worked out at the gym for an hour, and learned about vector databases for the LocalOS project.',
      'Today I interviewed at three companies: Google (went well), Meta (okay), and a startup called Acme (very exciting). Also read about LLMs and tried the new Llama 3.2 model.',
    ],
  },
  {
    category: 'Memory - Semantic Recall (Should Use archival_memory_search)',
    prompts: [
      'What beverages do I enjoy?',
      'What programming languages do I use?',
      'Where do I live?',
      'What music do I like?',
      'What do I build for work?',
    ],
  },
  {
    category: 'Vault - Semantic Search (Should Use search_vault or vault_lookup)',
    prompts: [
      'What notes do I have about AI and neural networks?',
      'Do I have anything written about my coding setup?',
      'Find notes related to learning or studying',
      'What have I written about productivity?',
      'Search vault for anything about local models',
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
