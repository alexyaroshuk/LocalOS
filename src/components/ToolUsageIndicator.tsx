import React, {useEffect, useState, useRef} from 'react';
import {View, Text, StyleSheet, Animated} from 'react-native';

interface ToolUsageIndicatorProps {
  stage: 'thinking' | 'using_tool' | 'processing';
  toolName?: string;
}

export const ToolUsageIndicator: React.FC<ToolUsageIndicatorProps> = ({
  stage,
  toolName,
}) => {
  const [dotCount, setDotCount] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Animate dots
    const interval = setInterval(() => {
      setDotCount(prev => (prev + 1) % 4);
    }, 500);

    return () => clearInterval(interval);
  }, [fadeAnim]);

  const getToolDisplayName = (name?: string): string => {
    if (!name) return 'tool';

    // Map tool names to user-friendly display names
    const toolNameMap: {[key: string]: string} = {
      'get_current_datetime': 'date & time',
      'search_web': 'web search',
      'get_x_trends': 'X trends',
    };

    return toolNameMap[name] || name.replace(/_/g, ' ');
  };

  const getMessage = () => {
    switch (stage) {
      case 'thinking':
        return 'Thinking';
      case 'using_tool':
        return toolName ? `Using ${getToolDisplayName(toolName)}` : 'Using tool';
      case 'processing':
        return 'Processing results';
      default:
        return 'Working';
    }
  };

  const getIcon = () => {
    switch (stage) {
      case 'thinking':
        return '🤔';
      case 'using_tool':
        // Show specific icons for different tools
        if (toolName === 'search_web') return '🔍';
        if (toolName === 'get_current_datetime') return '🕐';
        if (toolName === 'get_x_trends') return '📱';
        return '🔧';
      case 'processing':
        return '⚙️';
      default:
        return '💭';
    }
  };

  const dots = '.'.repeat(dotCount);

  return (
    <Animated.View style={[styles.container, {opacity: fadeAnim}]}>
      <View style={styles.content}>
        <Text style={styles.icon}>{getIcon()}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.text}>
            {getMessage()}
            <Text style={styles.dots}>{dots}</Text>
          </Text>
          {toolName && stage === 'using_tool' && (
            <Text style={styles.toolName}>
              {getToolDisplayName(toolName)}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginVertical: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  text: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  dots: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    minWidth: 12,
  },
  toolName: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
    textTransform: 'capitalize',
  },
});
