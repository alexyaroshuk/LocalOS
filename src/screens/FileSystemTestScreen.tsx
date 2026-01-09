import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {FileSystemService, FileOperationResult} from '../services/FileSystemService';
import {Logger} from '../utils/Logger';

export const FileSystemTestScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [testContent, setTestContent] = useState('Hello from LocalOS!\nThis is a test file.');
  const [testFilename, setTestFilename] = useState('test_file.txt');
  const [results, setResults] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [platformInfo, setPlatformInfo] = useState<any>(null);

  useEffect(() => {
    const info = FileSystemService.getPlatformInfo();
    setPlatformInfo(info);
    addResult(`📱 Platform: ${info.platform}`);
    addResult(`📁 Documents Path: ${info.documentsPath}`);
    addResult(`✅ App can write: ${info.appCanWrite}`);
    listFiles();
  }, []);

  const addResult = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ${message}`;
    setResults(prev => [formattedMessage, ...prev.slice(0, 19)]);
  };

  const listFiles = async () => {
    try {
      const result = await FileSystemService.listFiles();
      if (result.success && result.files) {
        setFiles(result.files);
        addResult(`📂 Found ${result.files.length} files`);
      } else {
        addResult(`❌ Failed to list files: ${result.error}`);
      }
    } catch (error) {
      addResult(`❌ Error listing files`);
    }
  };

  const handleCreateFile = async () => {
    if (!testFilename.trim() || !testContent.trim()) {
      Alert.alert('Error', 'Please enter filename and content');
      return;
    }

    setLoading(true);
    try {
      addResult(`📝 Creating file: ${testFilename}`);
      const result = await FileSystemService.createTestFile(testFilename, testContent);

      if (result.success) {
        addResult(`✅ File created successfully`);
        addResult(`📍 Path: ${result.path}`);
        addResult(`📊 Size: ${result.size} bytes`);
        await listFiles();
      } else {
        addResult(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      addResult(`❌ Exception: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReadFile = async () => {
    if (!testFilename.trim()) {
      Alert.alert('Error', 'Please enter a filename');
      return;
    }

    setLoading(true);
    try {
      addResult(`📖 Reading file: ${testFilename}`);
      const result = await FileSystemService.readTestFile(testFilename);

      if (result.success) {
        addResult(`✅ File read successfully`);
        addResult(`📊 Size: ${result.size} bytes`);
        addResult(`📍 Path: ${result.path}`);

        // Show content in TextInput
        setTestContent(result.content || '');

        // Show preview in results
        const preview = result.content?.substring(0, 100) || '';
        addResult(`📄 Content preview: "${preview}..."`);
      } else {
        addResult(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      addResult(`❌ Exception: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAppendFile = async () => {
    if (!testFilename.trim() || !testContent.trim()) {
      Alert.alert('Error', 'Please enter filename and content');
      return;
    }

    setLoading(true);
    try {
      addResult(`➕ Appending to file: ${testFilename}`);
      const result = await FileSystemService.appendToFile(testFilename, testContent);

      if (result.success) {
        addResult(`✅ Content appended successfully`);
        addResult(`📊 New size: ${result.size} bytes`);
        await listFiles();
      } else {
        addResult(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      addResult(`❌ Exception: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async () => {
    if (!testFilename.trim()) {
      Alert.alert('Error', 'Please enter a filename');
      return;
    }

    Alert.alert('Confirm', `Delete ${testFilename}?`, [
      {text: 'Cancel', onPress: () => {}, style: 'cancel'},
      {
        text: 'Delete',
        onPress: async () => {
          setLoading(true);
          try {
            addResult(`🗑️ Deleting file: ${testFilename}`);
            const result = await FileSystemService.deleteFile(testFilename);

            if (result.success) {
              addResult(`✅ File deleted successfully`);
              await listFiles();
            } else {
              addResult(`❌ Error: ${result.error}`);
            }
          } catch (error) {
            addResult(`❌ Exception: ${error}`);
          } finally {
            setLoading(false);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleClearResults = () => {
    setResults([]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📁 File System Test</Text>
        <Text style={styles.subtitle}>Test read/write operations on device</Text>
      </View>

      {/* Platform Info */}
      {platformInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Info</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>🔹 OS: {platformInfo.platform.toUpperCase()}</Text>
            <Text style={styles.infoText}>🔹 Can Write: ✅ Yes</Text>
            <Text style={styles.infoText}>🔹 Permission: Auto-granted</Text>
          </View>
        </View>
      )}

      {/* Filename Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test File Configuration</Text>
        <Text style={styles.label}>Filename</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., test_file.txt"
          value={testFilename}
          onChangeText={setTestFilename}
          editable={!loading}
        />
      </View>

      {/* Content Input */}
      <View style={styles.section}>
        <Text style={styles.label}>Content</Text>
        <TextInput
          style={[styles.input, styles.largeInput]}
          placeholder="Enter content to write..."
          value={testContent}
          onChangeText={setTestContent}
          multiline
          editable={!loading}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Operations</Text>

        <TouchableOpacity
          style={[styles.button, styles.buttonCreate, loading && styles.buttonDisabled]}
          onPress={handleCreateFile}
          disabled={loading}>
          <Text style={styles.buttonText}>📝 Create/Overwrite File</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonRead, loading && styles.buttonDisabled]}
          onPress={handleReadFile}
          disabled={loading}>
          <Text style={styles.buttonText}>📖 Read File</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonAppend, loading && styles.buttonDisabled]}
          onPress={handleAppendFile}
          disabled={loading}>
          <Text style={styles.buttonText}>➕ Append to File</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonDelete, loading && styles.buttonDisabled]}
          onPress={handleDeleteFile}
          disabled={loading}>
          <Text style={styles.buttonText}>🗑️ Delete File</Text>
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}
      </View>

      {/* Files List */}
      {files.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Files in Documents</Text>
          {files.map((file, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.fileItem}
              onPress={() => setTestFilename(file)}>
              <Text style={styles.fileName}>📄 {file}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results Log */}
      <View style={styles.section}>
        <View style={styles.resultsHeader}>
          <Text style={styles.sectionTitle}>Results Log</Text>
          <TouchableOpacity
            onPress={handleClearResults}
            style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultsBox}>
          {results.length === 0 ? (
            <Text style={styles.emptyResults}>No results yet. Try an operation above.</Text>
          ) : (
            results.map((result, idx) => (
              <Text key={idx} style={styles.resultLine}>
                {result}
              </Text>
            ))
          )}
        </View>
      </View>

      {/* Test Guide */}
      <View style={[styles.section, styles.guideSection]}>
        <Text style={styles.sectionTitle}>Test Guide</Text>
        <Text style={styles.guideText}>
          1️⃣ Enter a filename (e.g., "test.txt"){'\n'}
          2️⃣ Enter some content{'\n'}
          3️⃣ Click "Create/Overwrite File"{'\n'}
          4️⃣ Click "Read File" to verify{'\n'}
          5️⃣ Try "Append to File" or "Delete File"{'\n\n'}
          <Text style={styles.guideNote}>
            💡 Files are stored in your app's Documents directory
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    padding: 16,
    marginHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
    color: '#000',
  },
  largeInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  button: {
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonCreate: {
    backgroundColor: '#007AFF',
  },
  buttonRead: {
    backgroundColor: '#34C759',
  },
  buttonAppend: {
    backgroundColor: '#FF9500',
  },
  buttonDelete: {
    backgroundColor: '#FF3B30',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoText: {
    fontSize: 13,
    color: '#1565C0',
    marginVertical: 4,
    fontWeight: '500',
  },
  fileItem: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  fileName: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  resultsBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#333',
  },
  resultLine: {
    fontSize: 12,
    color: '#0F0',
    fontFamily: 'Courier New',
    marginVertical: 2,
    lineHeight: 16,
  },
  emptyResults: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  guideSection: {
    marginBottom: 20,
  },
  guideText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  guideNote: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
