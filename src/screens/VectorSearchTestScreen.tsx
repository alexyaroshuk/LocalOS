/**
 * Vector Search Test Screen
 * Demonstrates semantic search with embeddings
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import {EmbeddingService} from '../services/EmbeddingService';
import {DatabaseService} from '../services/DatabaseService';
import {Logger} from '../utils/Logger';

interface SearchResult {
  id: number;
  content: string;
  category: string;
  similarity?: number;
  source?: 'vector' | 'keyword' | 'hybrid';
}

// Test dataset to demonstrate semantic search
// Using new knowledge system with folder structure
const TEST_KNOWLEDGE = [
  {path: 'archive/tech/languages/TypeScript', content: 'Love programming in TypeScript. It has great type safety and tooling.', properties: {rating: 10, type: 'programming'}},
  {path: 'archive/tech/frameworks/React Native', content: 'Build mobile apps using React Native. Cross-platform development is efficient.', properties: {rating: 9, category: 'mobile'}},
  {path: 'archive/preferences/drinks/Coffee', content: 'Prefer coffee over tea. Usually drink it black in the morning.', properties: {preference: 'strong'}},
  {path: 'archive/preferences/colors/Blue', content: 'Favorite color is blue. Calming and professional.', properties: {preference: 'primary'}},
  {path: 'archive/tech/languages/Python', content: 'Second favorite programming language. Great for scripting and data science.', properties: {rating: 8, type: 'programming'}},
  {path: 'archive/preferences/music/Jazz', content: 'Like listening to jazz music. Miles Davis and John Coltrane are favorites.', properties: {genre: 'instrumental'}},
  {path: 'archive/habits/morning/Early Riser', content: 'Wake up early in the morning, usually around 6 AM. More productive in morning.', properties: {time: '6am'}},
];

export const VectorSearchTestScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [embeddingStats, setEmbeddingStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchType, setSearchType] = useState<'vector' | 'keyword' | 'hybrid'>('hybrid');
  const [searchTime, setSearchTime] = useState<number>(0);

  // Pre-defined test queries
  const TEST_QUERIES = [
    'What programming languages do I like?',
    'What do I build?',
    'What colors do I prefer?',
    'What beverages do I enjoy?',
    'Where do I live?',
  ];

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const stats = await EmbeddingService.getStats();
      setEmbeddingStats(stats);
    } catch (error) {
      Logger.error('Failed to load stats:', error);
    }
  };

  const loadTestData = async () => {
    if (!EmbeddingService.isModelLoaded()) {
      Alert.alert('Error', 'Please load an embedding model first');
      return;
    }

    setLoading(true);
    try {
      Logger.info('[VectorTest] Loading test knowledge with embeddings...');

      for (const entry of TEST_KNOWLEDGE) {
        // Generate embedding
        const embedding = await EmbeddingService.generateEmbedding(entry.content);

        // Create knowledge entry with embedding
        await DatabaseService.createKnowledge(
          entry.path,
          entry.content,
          entry.properties,
          embedding
        );
      }

      Alert.alert('Success', `Loaded ${TEST_KNOWLEDGE.length} test knowledge entries with embeddings`);
      await loadStats();
    } catch (error) {
      Logger.error('Failed to load test data:', error);
      Alert.alert('Error', `Failed to load test data: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async (query: string) => {
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter a search query');
      return;
    }

    if (!EmbeddingService.isModelLoaded()) {
      Alert.alert('Error', 'Please load an embedding model first');
      return;
    }

    setLoading(true);
    setSearchResults([]);

    try {
      const startTime = Date.now();
      let results: any[] = [];

      if (searchType === 'vector') {
        // Search both archive memories and knowledge
        const archiveResults = await EmbeddingService.semanticSearch(query, 3, 0.0);
        const knowledgeResults = await EmbeddingService.searchKnowledge(query, 3);

        // Normalize knowledge results to match archive format
        const normalizedKnowledge = knowledgeResults.map((k: any) => ({
          id: k.id,
          content: k.content,
          category: k.folder_path || 'knowledge',
          similarity: k.similarity,
          source: 'vector' as const,
        }));

        results = [...archiveResults, ...normalizedKnowledge]
          .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
          .slice(0, 5);
      } else if (searchType === 'keyword') {
        // Keyword search in both
        const archiveResults = await DatabaseService.searchArchive(query, 3);
        const knowledgeResults = await DatabaseService.searchKnowledge(query, undefined, 3);

        // Normalize knowledge results
        const normalizedKnowledge = knowledgeResults.map((k: any) => ({
          id: k.id,
          content: k.content,
          category: k.folder_path || 'knowledge',
        }));

        results = [...archiveResults, ...normalizedKnowledge].slice(0, 5);
      } else {
        // Hybrid search - combine archive and knowledge
        const archiveResults = await EmbeddingService.hybridSearch(query, 3);
        const knowledgeResults = await EmbeddingService.searchKnowledge(query, 3);

        // Normalize knowledge results
        const normalizedKnowledge = knowledgeResults.map((k: any) => ({
          id: k.id,
          content: k.content,
          category: k.folder_path || 'knowledge',
          similarity: k.similarity,
          source: 'hybrid' as const,
        }));

        results = [...archiveResults, ...normalizedKnowledge]
          .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
          .slice(0, 5);
      }

      const endTime = Date.now();
      setSearchTime(endTime - startTime);
      setSearchResults(results);

      Logger.info(`[VectorTest] Search completed in ${endTime - startTime}ms`);
      Logger.info(`[VectorTest] Found ${results.length} results`);
      if (results.length > 0) {
        Logger.info(`[VectorTest] Top result: "${results[0].content}" (${((results[0].similarity || 0) * 100).toFixed(1)}% match)`);
      }
    } catch (error) {
      Logger.error('Search failed:', error);
      Alert.alert('Error', `Search failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const clearDatabase = async () => {
    Alert.alert(
      'Clear All Memories',
      'This will delete all archive memories (but keep core memory and tasks). Use this when switching embedding models to avoid dimension mismatch errors.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear Memories',
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.clearAllMemories();
              await loadStats();
              setSearchResults([]);
              Alert.alert('Success', 'All archive memories cleared. You can now load test data with your current embedding model.');
            } catch (error) {
              Alert.alert('Error', `Failed to clear: ${error}`);
            }
          },
        },
      ]
    );
  };

  const backfillEmbeddings = async () => {
    if (!EmbeddingService.isModelLoaded()) {
      Alert.alert('Error', 'Please load an embedding model first');
      return;
    }

    setLoading(true);
    try {
      const result = await EmbeddingService.backfillEmbeddings();
      Alert.alert(
        'Backfill Complete',
        `Processed: ${result.processed}\nFailed: ${result.failed}`
      );
      await loadStats();
    } catch (error) {
      Alert.alert('Error', `Backfill failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const runMigration = async () => {
    setLoading(true);
    try {
      Logger.info('[VectorTest] Running database migration...');
      await DatabaseService.migrate();
      Alert.alert('Success', 'Database migration completed! The embedding column has been added.');
      await loadStats();
    } catch (error) {
      Logger.error('Migration failed:', error);
      Alert.alert('Error', `Migration failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vector Search Test</Text>
        <Text style={styles.subtitle}>
          Test semantic search with embeddings
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Model Status</Text>
        {embeddingStats ? (
          <View style={styles.statsContainer}>
            <Text style={styles.statText}>
              🤖 Chat Model: {embeddingStats.chatModelLoaded ? '✅' : '❌'}
              {embeddingStats.chatModelName && ` ${embeddingStats.chatModelName}`}
            </Text>
            <Text style={styles.statText}>
              🔢 Embedding Model: {embeddingStats.modelLoaded ? '✅' : '❌'}
              {embeddingStats.modelName && ` ${embeddingStats.modelName}`}
            </Text>
            {embeddingStats.chatModelLoaded && embeddingStats.modelLoaded && (
              <Text style={styles.dualModelText}>
                🎉 DUAL INSTANCE MODE - Agent can use semantic search!
              </Text>
            )}
            <Text style={styles.statText}>
              📊 Total Memories: {embeddingStats.dbStats.total}
            </Text>
            <Text style={styles.statText}>
              🎯 With Embeddings: {embeddingStats.dbStats.withEmbeddings} (
              {embeddingStats.dbStats.percentage.toFixed(1)}%)
            </Text>
            {embeddingStats.dbStats.dimensions && (
              <Text style={styles.statText}>
                📏 Embedding Dimensions: {embeddingStats.dbStats.dimensions}D
              </Text>
            )}
            {embeddingStats.dbStats.dimensionMismatch && (
              <Text style={styles.warningText}>
                ⚠️ DIMENSION MISMATCH! Clear DB and reload with current model.
              </Text>
            )}
          </View>
        ) : (
          <ActivityIndicator />
        )}
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={loadTestData}
          disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? 'Loading...' : 'Load Test Dataset'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.migrationButton]}
          onPress={runMigration}
          disabled={loading}>
          <Text style={styles.buttonText}>🔧 Run Database Migration</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={backfillEmbeddings}
          disabled={loading}>
          <Text style={styles.buttonText}>Backfill Embeddings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={clearDatabase}>
          <Text style={styles.buttonText}>Clear Database</Text>
        </TouchableOpacity>
      </View>

      {/* Search Type Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Search Type</Text>
        <View style={styles.searchTypeContainer}>
          {(['vector', 'keyword', 'hybrid'] as const).map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.searchTypeButton,
                searchType === type && styles.searchTypeButtonActive,
              ]}
              onPress={() => setSearchType(type)}>
              <Text
                style={[
                  styles.searchTypeText,
                  searchType === type && styles.searchTypeTextActive,
                ]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Search Query</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Enter search query..."
          placeholderTextColor="#666"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => runSearch(searchQuery)}
          disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? 'Searching...' : 'Search'}
          </Text>
        </TouchableOpacity>

        {/* Test Queries */}
        <Text style={styles.subtitle}>Or try a test query:</Text>
        {TEST_QUERIES.map((query, index) => (
          <TouchableOpacity
            key={index}
            style={styles.testQueryButton}
            onPress={() => {
              setSearchQuery(query);
              runSearch(query);
            }}>
            <Text style={styles.testQueryText}>{query}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results */}
      {searchResults.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Results ({searchResults.length}) - {searchTime}ms
          </Text>
          {searchResults.map((result, index) => (
            <View key={result.id} style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultRank}>#{index + 1}</Text>
                {result.similarity !== undefined && (
                  <Text style={styles.resultSimilarity}>
                    {(result.similarity * 100).toFixed(1)}% match
                  </Text>
                )}
                {result.source && (
                  <Text style={styles.resultSource}>
                    [{result.source}]
                  </Text>
                )}
              </View>
              <Text style={styles.resultContent}>{result.content}</Text>
              <Text style={styles.resultCategory}>
                Category: {result.category}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Embedding Models */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compatible Embedding Models</Text>
        <Text style={styles.subtitle}>
          Download GGUF embedding models (not chat models!)
        </Text>

        <View style={styles.modelCard}>
          <Text style={styles.modelName}>all-MiniLM-L6-v2 (Recommended)</Text>
          <Text style={styles.modelDetails}>
            • Size: ~25MB{'\n'}
            • Dimensions: 384{'\n'}
            • Best for: General-purpose, fast{'\n'}
            • Quality: Good
          </Text>
          <Text style={styles.modelLink}>
            https://huggingface.co/second-state/All-MiniLM-L6-v2-Embedding-GGUF
          </Text>
        </View>

        <View style={styles.modelCard}>
          <Text style={styles.modelName}>nomic-embed-text-v1.5</Text>
          <Text style={styles.modelDetails}>
            • Size: ~130MB{'\n'}
            • Dimensions: 768{'\n'}
            • Best for: High quality results{'\n'}
            • Quality: Excellent
          </Text>
          <Text style={styles.modelLink}>
            https://huggingface.co/nomic-ai/nomic-embed-text-v1.5-GGUF
          </Text>
        </View>

        <View style={styles.modelCard}>
          <Text style={styles.modelName}>bge-small-en-v1.5</Text>
          <Text style={styles.modelDetails}>
            • Size: ~35MB{'\n'}
            • Dimensions: 384{'\n'}
            • Best for: Balanced quality/size{'\n'}
            • Quality: Very Good
          </Text>
          <Text style={styles.modelLink}>
            https://huggingface.co/second-state/bge-small-en-v1.5-Embedding-GGUF
          </Text>
        </View>

        <View style={styles.modelCard}>
          <Text style={styles.modelName}>gte-small</Text>
          <Text style={styles.modelDetails}>
            • Size: ~33MB{'\n'}
            • Dimensions: 384{'\n'}
            • Best for: General text embedding{'\n'}
            • Quality: Very Good
          </Text>
          <Text style={styles.modelLink}>
            https://huggingface.co/second-state/gte-small-Embedding-GGUF
          </Text>
        </View>

        <Text style={styles.modelNote}>
          Note: Download the .gguf file, then add it via the Models screen
        </Text>
      </View>

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        <Text style={styles.instructionText}>
          1. Download an embedding model (see links above){'\n'}
          2. Load it via the Models screen{'\n'}
          3. Return here and tap "Load Test Dataset"{'\n'}
          4. Try different search types:{'\n'}
          {'   '}• Vector: Pure semantic search{'\n'}
          {'   '}• Keyword: Traditional FTS5 search{'\n'}
          {'   '}• Hybrid: Best of both worlds{'\n'}
          5. Compare results to see semantic understanding
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  statsContainer: {
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
  },
  statText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  warningText: {
    fontSize: 14,
    color: '#FF9500',
    marginTop: 8,
    marginBottom: 4,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  dualModelText: {
    fontSize: 14,
    color: '#34C759',
    marginTop: 8,
    marginBottom: 4,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  migrationButton: {
    backgroundColor: '#FF9500',
  },
  secondaryButton: {
    backgroundColor: '#5856D6',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonDisabled: {
    backgroundColor: '#333',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  searchTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  searchTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#222',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  searchTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  searchTypeText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  searchTypeTextActive: {
    color: '#fff',
  },
  searchInput: {
    backgroundColor: '#111',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  testQueryButton: {
    backgroundColor: '#222',
    padding: 10,
    borderRadius: 6,
    marginBottom: 6,
  },
  testQueryText: {
    color: '#007AFF',
    fontSize: 14,
  },
  resultCard: {
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  resultRank: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  resultSimilarity: {
    fontSize: 12,
    color: '#0F0',
    fontFamily: 'monospace',
  },
  resultSource: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  resultContent: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 6,
  },
  resultCategory: {
    fontSize: 12,
    color: '#999',
  },
  instructionText: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
  },
  modelCard: {
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#5856D6',
  },
  modelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  modelDetails: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 10,
    lineHeight: 18,
  },
  modelLink: {
    fontSize: 11,
    color: '#007AFF',
    fontFamily: 'monospace',
  },
  modelNote: {
    fontSize: 13,
    color: '#FF9500',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
