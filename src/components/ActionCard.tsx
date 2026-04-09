import React, {useState, memo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Platform} from 'react-native';
import {AgentAction} from '../types';

interface ActionCardProps {
  action: AgentAction;
}

export const ActionCard: React.FC<ActionCardProps> = memo(({action}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  const getActionIcon = (type: string): string => {
    switch (type) {
      case 'thinking':
        return '🤔';
      case 'decision':
        return '🧠';
      case 'tool_call':
        return '🔧';
      case 'tool_result':
        return '✅';
      case 'generating':
        return '✨';
      default:
        return '💭';
    }
  };

  const getActionTitle = (): string => {
    const isInProgress = !action.endTime;
    const duration = action.duration ? ` for ${formatDuration(action.duration)}` : '';

    switch (action.type) {
      case 'thinking':
        return isInProgress ? 'Thinking...' : `Thought${duration}`;
      case 'decision':
        return 'Model reasoning';
      case 'tool_call':
        return isInProgress
          ? `Using ${action.toolName || 'tool'}...`
          : `Used ${action.toolName || 'tool'}${duration}`;
      case 'tool_result':
        return isInProgress
          ? `Processing result from ${action.toolName || 'tool'}...`
          : `Got result from ${action.toolName || 'tool'}${duration}`;
      case 'generating':
        return isInProgress ? 'Generating...' : `Generated response${duration}`;
      default:
        return isInProgress ? 'Processing...' : `Action${duration}`;
    }
  };

  const getActionColor = (): string => {
    switch (action.type) {
      case 'thinking':
        return '#007AFF';
      case 'decision':
        return '#9B59B6';
      case 'tool_call':
        return '#FF9500';
      case 'tool_result':
        return '#34C759';
      case 'generating':
        return '#5856D6';
      default:
        return '#8E8E93';
    }
  };

  const hasDetails = (): boolean => {
    return !!(
      action.toolArgs ||
      action.toolResult ||
      action.thinkingContent ||
      action.error
    );
  };

  const renderDetails = () => {
    if (!isExpanded || !hasDetails()) {
      return null;
    }

    return (
      <View style={styles.detailsContainer}>
        {action.thinkingContent && (
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Thought Process:</Text>
            <Text style={styles.detailText}>{action.thinkingContent}</Text>
          </View>
        )}

        {action.toolArgs && (
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Tool Arguments:</Text>
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>
                {JSON.stringify(action.toolArgs, null, 2)}
              </Text>
            </View>
          </View>
        )}

        {action.toolResult && (
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Tool Result:</Text>
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>
                {typeof action.toolResult === 'string'
                  ? action.toolResult
                  : JSON.stringify(action.toolResult, null, 2)}
              </Text>
            </View>
          </View>
        )}

        {action.error && (
          <View style={styles.detailSection}>
            <Text style={[styles.detailLabel, styles.errorLabel]}>Error:</Text>
            <Text style={styles.errorText}>{action.error}</Text>
          </View>
        )}
      </View>
    );
  };

  const isInProgress = !action.endTime;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.header,
          {borderLeftColor: getActionColor()},
          isInProgress && styles.inProgressHeader,
        ]}
        onPress={() => hasDetails() && setIsExpanded(!isExpanded)}
        activeOpacity={hasDetails() ? 0.7 : 1}>
        <View style={styles.headerContent}>
          <Text style={styles.icon}>{getActionIcon(action.type)}</Text>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{getActionTitle()}</Text>
          </View>
          {hasDetails() && (
            <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
          )}
        </View>
      </TouchableOpacity>
      {renderDetails()}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 16,
  },
  header: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 3,
  },
  inProgressHeader: {
    backgroundColor: '#F0F8FF',
    opacity: 0.9,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  expandIcon: {
    fontSize: 10,
    color: '#8E8E93',
    marginLeft: 8,
  },
  detailsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginTop: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  detailSection: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#1A1A1A',
    lineHeight: 18,
  },
  codeBlock: {
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: '#1A1A1A',
    lineHeight: 16,
  },
  errorLabel: {
    color: '#FF3B30',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    lineHeight: 18,
  },
});
