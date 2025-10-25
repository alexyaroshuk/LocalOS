import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import MemoryService from '../services/MemoryService';
import {MockDatabaseService} from '../services/MockDatabaseService';
import type {
  CoreMemoryBlock,
  ArchiveMemory,
  Task,
  UserFact,
} from '../services/MockDatabaseService';

export const MemoryViewerScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'core' | 'archive' | 'tasks' | 'facts'>('core');
  const [searchQuery, setSearchQuery] = useState('');

  // Core memory state
  const [coreMemory, setCoreMemory] = useState<any>(null);

  // Archive memory state
  const [archiveMemories, setArchiveMemories] = useState<ArchiveMemory[]>([]);

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);

  // User facts state
  const [userFacts, setUserFacts] = useState<UserFact[]>([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      switch (activeTab) {
        case 'core':
          const core = MemoryService.getCoreMemory();
          setCoreMemory(core);
          break;
        case 'archive':
          const archive = await MockDatabaseService.getRecentMemories(20);
          setArchiveMemories(archive);
          break;
        case 'tasks':
          const allTasks = await MockDatabaseService.getTasks();
          setTasks(allTasks);
          break;
        case 'facts':
          const facts = await MockDatabaseService.getAllUserFacts();
          setUserFacts(facts);
          break;
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load memory data');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      await loadData();
      return;
    }

    try {
      if (activeTab === 'archive') {
        const results = await MockDatabaseService.searchArchive(searchQuery, 20);
        setArchiveMemories(results);
      }
    } catch (error) {
      console.error('Search failed:', error);
      Alert.alert('Search Error', 'Failed to search memories');
    }
  };

  const renderCoreMemory = () => (
    <ScrollView
      style={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }>
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          💡 Core memory is always loaded into the AI's context. These are the most important facts the AI knows about you.
        </Text>
      </View>

      {coreMemory && (
        <>
          {Object.entries(coreMemory).map(([key, value]) => (
            <View key={key} style={styles.memoryCard}>
              <View style={styles.memoryHeader}>
                <Text style={styles.memoryLabel}>{key.replace(/_/g, ' ').toUpperCase()}</Text>
                <View style={styles.coreBadge}>
                  <Text style={styles.coreBadgeText}>CORE</Text>
                </View>
              </View>
              <Text style={styles.memoryContent}>{value as string}</Text>
            </View>
          ))}
        </>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );

  const renderArchiveMemory = () => (
    <View style={styles.content}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search archive memory..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>🔍</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            📦 Archive memory stores long-term information that the AI can search when needed.
          </Text>
        </View>

        {archiveMemories.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No archive memories found</Text>
          </View>
        ) : (
          archiveMemories.map(memory => (
            <View key={memory.id} style={styles.memoryCard}>
              <View style={styles.memoryHeader}>
                <View style={[styles.categoryBadge, getCategoryColor(memory.category)]}>
                  <Text style={styles.categoryBadgeText}>{memory.category.toUpperCase()}</Text>
                </View>
                <View style={styles.importanceBadge}>
                  <Text style={styles.importanceBadgeText}>★ {memory.importance}/10</Text>
                </View>
              </View>
              <Text style={styles.memoryContent}>{memory.content}</Text>
              <Text style={styles.memoryDate}>
                {new Date(memory.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );

  const renderTasks = () => (
    <ScrollView
      style={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }>
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          ✅ Tasks help the AI remember what you need to do and remind you proactively.
        </Text>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No tasks found</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Pending Tasks</Text>
          {tasks
            .filter(t => t.status === 'pending')
            .map(task => renderTask(task))}

          <Text style={styles.sectionTitle}>Completed Tasks</Text>
          {tasks
            .filter(t => t.status === 'completed')
            .map(task => renderTask(task))}
        </>
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );

  const renderTask = (task: Task) => (
    <View key={task.id} style={styles.taskCard}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle}>
          {task.status === 'completed' ? '✅ ' : '⭕ '}
          {task.title}
        </Text>
        {task.recurrence_rule && (
          <View style={styles.recurrenceBadge}>
            <Text style={styles.recurrenceBadgeText}>🔁 {task.recurrence_rule}</Text>
          </View>
        )}
      </View>
      {task.description && (
        <Text style={styles.taskDescription}>{task.description}</Text>
      )}
      <View style={styles.taskFooter}>
        {task.due_date && (
          <Text style={styles.taskDueDate}>
            Due: {new Date(task.due_date).toLocaleDateString()}
          </Text>
        )}
        {task.completed_at && (
          <Text style={styles.taskCompletedDate}>
            ✓ {new Date(task.completed_at).toLocaleDateString()}
          </Text>
        )}
      </View>
    </View>
  );

  const renderUserFacts = () => (
    <ScrollView
      style={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }>
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          🧠 User facts are what the AI has learned about you over time, with confidence scores.
        </Text>
      </View>

      {userFacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No user facts found</Text>
        </View>
      ) : (
        userFacts.map(fact => (
          <View key={fact.id} style={styles.factCard}>
            <View style={styles.factHeader}>
              <View style={[styles.categoryBadge, getCategoryColor(fact.category as any)]}>
                <Text style={styles.categoryBadgeText}>{fact.category.toUpperCase()}</Text>
              </View>
              <View style={styles.confidenceBadge}>
                <Text style={styles.confidenceBadgeText}>
                  {(fact.confidence * 100).toFixed(0)}% confident
                </Text>
              </View>
            </View>
            <Text style={styles.factContent}>{fact.fact}</Text>
            <Text style={styles.factDate}>
              Last confirmed: {new Date(fact.last_confirmed).toLocaleDateString()}
            </Text>
          </View>
        ))
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'fact':
        return {backgroundColor: '#007AFF'};
      case 'event':
        return {backgroundColor: '#34C759'};
      case 'preference':
        return {backgroundColor: '#FF9500'};
      case 'conversation':
        return {backgroundColor: '#AF52DE'};
      case 'habit':
        return {backgroundColor: '#FF3B30'};
      case 'personality':
        return {backgroundColor: '#5856D6'};
      case 'relationship':
        return {backgroundColor: '#FF2D55'};
      default:
        return {backgroundColor: '#8E8E93'};
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Memory Viewer</Text>
        <Text style={styles.headerSubtitle}>Explore what the AI knows</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'core' && styles.tabActive]}
          onPress={() => setActiveTab('core')}>
          <Text style={[styles.tabText, activeTab === 'core' && styles.tabTextActive]}>
            Core Memory
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'archive' && styles.tabActive]}
          onPress={() => setActiveTab('archive')}>
          <Text style={[styles.tabText, activeTab === 'archive' && styles.tabTextActive]}>
            Archive ({archiveMemories.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'tasks' && styles.tabActive]}
          onPress={() => setActiveTab('tasks')}>
          <Text style={[styles.tabText, activeTab === 'tasks' && styles.tabTextActive]}>
            Tasks ({tasks.filter(t => t.status === 'pending').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'facts' && styles.tabActive]}
          onPress={() => setActiveTab('facts')}>
          <Text style={[styles.tabText, activeTab === 'facts' && styles.tabTextActive]}>
            Facts ({userFacts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'core' && renderCoreMemory()}
      {activeTab === 'archive' && renderArchiveMemory()}
      {activeTab === 'tasks' && renderTasks()}
      {activeTab === 'facts' && renderUserFacts()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 18,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 12,
    margin: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18,
  },
  memoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  memoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  memoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.5,
  },
  memoryContent: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  memoryDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
  },
  coreBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  coreBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  importanceBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  importanceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#856404',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  taskDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taskDueDate: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  taskCompletedDate: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
  recurrenceBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  recurrenceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1976D2',
  },
  factCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  factHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  factContent: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  factDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
  },
  confidenceBadge: {
    backgroundColor: '#D4EDDA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  confidenceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#155724',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginLeft: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  bottomPadding: {
    height: 24,
  },
});
