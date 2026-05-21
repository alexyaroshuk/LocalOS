/**
 * App-wide runtime settings, persisted to AsyncStorage.
 *
 * Holds:
 *  - debugUI: gates the Tools/Vector/Files tabs and chat dev controls
 *  - inference: generation params (temperature/maxTokens/topP/topK) applied to
 *    real chat completions
 *  - promptType / thinkingEnabled: applied to LlamaService so the chosen system
 *    prompt and thinking-mode take effect app-wide
 *
 * Read live values via useSettings() so changing them in Settings re-renders
 * consumers and (for prompt/thinking) reconfigures LlamaService.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  STORAGE_KEYS,
  DEFAULT_DEBUG_UI,
  DEFAULT_LLAMA_CONFIG,
} from '../utils/constants';
import {LlamaService} from '../services/LlamaService';
import type {SystemPromptType} from '../services/SystemPrompts';

export interface InferenceSettings {
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
}

const DEFAULT_INFERENCE: InferenceSettings = {
  temperature: DEFAULT_LLAMA_CONFIG.temperature,
  maxTokens: DEFAULT_LLAMA_CONFIG.maxTokens,
  topP: DEFAULT_LLAMA_CONFIG.topP,
  topK: DEFAULT_LLAMA_CONFIG.topK,
};

interface SettingsContextValue {
  debugUI: boolean;
  setDebugUI: (value: boolean) => void;
  inference: InferenceSettings;
  setInference: (value: Partial<InferenceSettings>) => void;
  promptType: SystemPromptType;
  setPromptType: (value: SystemPromptType) => void;
  thinkingEnabled: boolean;
  setThinkingEnabled: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  debugUI: DEFAULT_DEBUG_UI,
  setDebugUI: () => {},
  inference: DEFAULT_INFERENCE,
  setInference: () => {},
  promptType: 'letta',
  setPromptType: () => {},
  thinkingEnabled: false,
  setThinkingEnabled: () => {},
});

export function SettingsProvider({children}: {children: ReactNode}) {
  const [debugUI, setDebugUIState] = useState<boolean>(DEFAULT_DEBUG_UI);
  const [inference, setInferenceState] = useState<InferenceSettings>(DEFAULT_INFERENCE);
  const [promptType, setPromptTypeState] = useState<SystemPromptType>(
    LlamaService.getPromptType(),
  );
  const [thinkingEnabled, setThinkingEnabledState] = useState<boolean>(
    LlamaService.isThinkingEnabled(),
  );
  const hydrated = useRef(false);

  // Hydrate persisted values once on mount, then apply prompt/thinking to
  // LlamaService so chat reflects the saved choices.
  useEffect(() => {
    (async () => {
      try {
        const [debug, infRaw, prompt, thinking] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.DEBUG_UI),
          AsyncStorage.getItem(STORAGE_KEYS.INFERENCE_SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.PROMPT_TYPE),
          AsyncStorage.getItem(STORAGE_KEYS.THINKING_ENABLED),
        ]);

        if (debug != null) {
          setDebugUIState(debug === 'true');
        }
        if (infRaw != null) {
          setInferenceState({...DEFAULT_INFERENCE, ...JSON.parse(infRaw)});
        }
        if (prompt != null) {
          setPromptTypeState(prompt as SystemPromptType);
          LlamaService.setPromptType(prompt as SystemPromptType);
        }
        if (thinking != null) {
          const val = thinking === 'true';
          setThinkingEnabledState(val);
          LlamaService.setThinkingEnabled(val);
        }
      } catch {
        // Fall back to defaults on read failure.
      } finally {
        hydrated.current = true;
      }
    })();
  }, []);

  const setDebugUI = (value: boolean) => {
    setDebugUIState(value);
    AsyncStorage.setItem(STORAGE_KEYS.DEBUG_UI, String(value)).catch(() => {});
  };

  const setInference = (value: Partial<InferenceSettings>) => {
    setInferenceState(prev => {
      const next = {...prev, ...value};
      AsyncStorage.setItem(
        STORAGE_KEYS.INFERENCE_SETTINGS,
        JSON.stringify(next),
      ).catch(() => {});
      return next;
    });
  };

  const setPromptType = (value: SystemPromptType) => {
    setPromptTypeState(value);
    LlamaService.setPromptType(value);
    AsyncStorage.setItem(STORAGE_KEYS.PROMPT_TYPE, value).catch(() => {});
  };

  const setThinkingEnabled = (value: boolean) => {
    setThinkingEnabledState(value);
    LlamaService.setThinkingEnabled(value);
    AsyncStorage.setItem(STORAGE_KEYS.THINKING_ENABLED, String(value)).catch(
      () => {},
    );
  };

  return (
    <SettingsContext.Provider
      value={{
        debugUI,
        setDebugUI,
        inference,
        setInference,
        promptType,
        setPromptType,
        thinkingEnabled,
        setThinkingEnabled,
      }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
