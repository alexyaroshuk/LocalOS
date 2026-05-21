import React, {useState} from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {useSettings} from '../contexts/SettingsContext';
import {APP_VERSION} from '../utils/constants';
import {SYSTEM_PROMPTS, SystemPromptType} from '../services/SystemPrompts';
import {LlamaService} from '../services/LlamaService';
import {Slider} from '../components/Slider';

export const SettingsScreen: React.FC = () => {
  const {
    debugUI,
    setDebugUI,
    inference,
    setInference,
    promptType,
    setPromptType,
    thinkingEnabled,
    setThinkingEnabled,
  } = useSettings();

  const {temperature, maxTokens, topP, topK} = inference;

  // Prompt viewer state
  const [showPromptViewer, setShowPromptViewer] = useState<boolean>(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Settings</Text>

      {/* System Prompt (copied from Tool Test screen) */}
      <View style={styles.promptSelectorCard}>
        <Text style={styles.promptSelectorTitle}>System Prompt Variant</Text>
        <Text style={styles.promptSelectorSubtitle}>
          {SYSTEM_PROMPTS[promptType].name}
        </Text>
        <Text style={styles.promptSelectorDesc}>
          {SYSTEM_PROMPTS[promptType].description}
        </Text>
        <View style={styles.promptButtonRow}>
          {(Object.keys(SYSTEM_PROMPTS) as SystemPromptType[]).map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.promptButton,
                promptType === type && styles.promptButtonActive,
              ]}
              onPress={() => setPromptType(type)}>
              <Text
                style={[
                  styles.promptButtonText,
                  promptType === type && styles.promptButtonTextActive,
                ]}>
                {SYSTEM_PROMPTS[type].name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Prompt Viewer Toggle */}
        <TouchableOpacity
          style={styles.promptViewerToggle}
          onPress={() => setShowPromptViewer(!showPromptViewer)}>
          <Text style={styles.promptViewerToggleText}>
            {showPromptViewer ? '▼' : '▶'} View Full Prompt Text
          </Text>
        </TouchableOpacity>

        {/* Collapsible Prompt Viewer */}
        {showPromptViewer &&
          (() => {
            const fullPrompt = LlamaService.getFullSystemPrompt();
            const charCount = fullPrompt.length;
            const tokenEstimate = LlamaService.estimateTokenCount(fullPrompt);
            return (
              <View style={styles.promptViewerContainer}>
                <View style={styles.promptStats}>
                  <Text style={styles.promptStatText}>
                    Characters:{' '}
                    <Text style={styles.promptStatValue}>
                      {charCount.toLocaleString()}
                    </Text>
                  </Text>
                  <Text style={styles.promptStatText}>
                    Est. Tokens:{' '}
                    <Text style={styles.promptStatValue}>
                      {tokenEstimate.toLocaleString()}
                    </Text>
                  </Text>
                </View>
                <ScrollView style={styles.promptTextScroll} nestedScrollEnabled>
                  <Text style={styles.promptText} selectable>
                    {fullPrompt}
                  </Text>
                </ScrollView>
              </View>
            );
          })()}
      </View>

      {/* Inference Settings (copied from Tool Test screen) */}
      <View style={styles.inferenceSettingsCard}>
        <View style={styles.inferenceHeader}>
          <Text style={styles.inferenceTitle}>Inference Settings</Text>
        </View>
        <Text style={styles.inferenceSubtitle}>
          Adjust generation parameters (affects tool calling behavior)
        </Text>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelRow}>
            <Text style={styles.settingLabel}>Temperature</Text>
            <Text style={styles.settingValue}>{temperature.toFixed(2)}</Text>
          </View>
          <Slider
            value={temperature}
            min={0}
            max={2}
            step={0.05}
            onChange={val => setInference({temperature: val})}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelRow}>
            <Text style={styles.settingLabel}>Max Tokens</Text>
            <Text style={styles.settingValue}>{maxTokens}</Text>
          </View>
          <Slider
            value={maxTokens}
            min={64}
            max={4096}
            step={64}
            onChange={val => setInference({maxTokens: val})}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelRow}>
            <Text style={styles.settingLabel}>Top P</Text>
            <Text style={styles.settingValue}>{topP.toFixed(2)}</Text>
          </View>
          <Slider
            value={topP}
            min={0}
            max={1}
            step={0.05}
            onChange={val => setInference({topP: val})}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelRow}>
            <Text style={styles.settingLabel}>Top K</Text>
            <Text style={styles.settingValue}>{topK}</Text>
          </View>
          <Slider
            value={topK}
            min={1}
            max={100}
            step={1}
            onChange={val => setInference({topK: val})}
          />
        </View>

        <View style={styles.thinkingRow}>
          <View style={styles.thinkingInfo}>
            <Text style={styles.settingLabel}>Thinking Mode</Text>
            <Text style={styles.thinkingHint}>
              Off = strip {'<|channel>thought<channel|>'} / {'<think>'} blocks
              from output. On = pass through (useful for debugging reasoning
              models).
            </Text>
          </View>
          <Switch
            value={thinkingEnabled}
            onValueChange={setThinkingEnabled}
            trackColor={{false: '#D1D1D6', true: '#9C27B0'}}
            thumbColor="#FFFFFF"
          />
        </View>

        <Text style={styles.inferenceHint}>
          💡 Lower temperature (0.1-0.3) may help with tool calling accuracy.
          Higher values increase creativity but reduce reliability.
        </Text>
      </View>

      {/* Developer */}
      <Text style={styles.sectionLabel}>DEVELOPER</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Debug Mode</Text>
            <Text style={styles.rowSubtitle}>
              Show Tools, Vector, and Files tabs plus chat developer controls
              (backend switcher, tools toggle, logs, context meter, test
              prompts).
            </Text>
          </View>
          <Switch
            value={debugUI}
            onValueChange={setDebugUI}
            trackColor={{false: '#D1D1D6', true: '#34C759'}}
          />
        </View>
      </View>

      {/* About */}
      <Text style={styles.sectionLabel}>ABOUT</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>Version</Text>
          <Text style={styles.rowValue}>{APP_VERSION}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 4,
    lineHeight: 18,
  },
  rowValue: {
    fontSize: 16,
    color: '#8E8E93',
  },

  // --- Copied verbatim from ToolTestScreen ---
  promptSelectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#9C27B0',
  },
  promptSelectorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  promptSelectorSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9C27B0',
    marginBottom: 4,
  },
  promptSelectorDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  promptButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },
  promptButtonActive: {
    backgroundColor: '#9C27B0',
    borderColor: '#9C27B0',
  },
  promptButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  promptButtonTextActive: {
    color: '#FFFFFF',
  },
  promptViewerToggle: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D1D6',
  },
  promptViewerToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9C27B0',
  },
  promptViewerContainer: {
    marginTop: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  promptStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  promptStatText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  promptStatValue: {
    fontWeight: '700',
    color: '#9C27B0',
  },
  promptTextScroll: {
    maxHeight: 300,
  },
  promptText: {
    fontSize: 11,
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  inferenceSettingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inferenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inferenceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  inferenceSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  inferenceHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 8,
  },
  thinkingInfo: {
    flex: 1,
    marginRight: 12,
  },
  thinkingHint: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  settingRow: {
    marginBottom: 12,
  },
  settingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    fontVariant: ['tabular-nums'],
  },
});
