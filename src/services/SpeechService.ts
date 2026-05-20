/**
 * SpeechService - on-device speech-to-text via whisper.rn.
 *
 * Push-to-talk: startListening() opens the mic and streams partial
 * transcripts; stopListening() finalizes and returns the full text.
 * Fully offline once the Whisper model is downloaded. No VAD context is
 * used - the user controls start/stop manually.
 */
import {Platform, PermissionsAndroid} from 'react-native';
import RNFS from 'react-native-fs';
import {initWhisper, WhisperContext} from 'whisper.rn';
import {RealtimeTranscriber} from 'whisper.rn/realtime-transcription';
import {AudioPcmStreamAdapter} from 'whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter';
import {ModelStorageService} from './ModelStorageService';
import {WHISPER_MODEL} from '../utils/constants';
import {DownloadStatus} from '../types';
import {Logger} from '../utils/Logger';

class SpeechServiceClass {
  private whisperContext: WhisperContext | null = null;
  private transcriber: RealtimeTranscriber | null = null;
  // Latest transcript text per slice index, joined in order for the full result.
  private sliceText: Map<number, string> = new Map();

  /** True if the Whisper model file is present on disk. */
  async isModelDownloaded(): Promise<boolean> {
    return ModelStorageService.modelExists(WHISPER_MODEL.filename);
  }

  /** Download the Whisper model (reuses the shared download infra). */
  async downloadModel(
    onProgress?: (progress: DownloadStatus) => void,
  ): Promise<string> {
    const url = ModelStorageService.getHuggingFaceDownloadUrl(
      WHISPER_MODEL.huggingFaceRepo,
      WHISPER_MODEL.filename,
    );
    Logger.info('🎤 Downloading Whisper model:', WHISPER_MODEL.filename);
    return ModelStorageService.downloadModel(
      url,
      WHISPER_MODEL.filename,
      onProgress,
    );
  }

  /** Initialize the Whisper context. No-op if already loaded. */
  async loadModel(): Promise<void> {
    if (this.whisperContext) {
      return;
    }
    const path = ModelStorageService.getModelPath(WHISPER_MODEL.filename);
    Logger.info('🎤 Loading Whisper context:', path);
    this.whisperContext = await initWhisper({filePath: path});
    Logger.info('✅ Whisper context loaded');
  }

  isModelLoaded(): boolean {
    return this.whisperContext !== null;
  }

  isListening(): boolean {
    return this.transcriber !== null;
  }

  /** Request microphone permission. iOS prompts on first stream access. */
  private async requestMicPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'LocalOS needs the microphone for speech-to-text.',
        buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  /**
   * Start recording from the mic and streaming partial transcripts.
   * @param onPartial called with the running transcript as it grows.
   */
  async startListening(onPartial: (text: string) => void): Promise<void> {
    if (!this.whisperContext) {
      throw new Error('Whisper model not loaded');
    }
    if (this.transcriber) {
      Logger.warn('🎤 startListening called while already listening');
      return;
    }

    const hasPermission = await this.requestMicPermission();
    if (!hasPermission) {
      throw new Error('Microphone permission denied');
    }

    this.sliceText.clear();
    const audioStream = new AudioPcmStreamAdapter();

    this.transcriber = new RealtimeTranscriber(
      {whisperContext: this.whisperContext, audioStream, fs: RNFS},
      {
        audioSliceSec: 30,
        transcribeOptions: {language: 'auto'},
      },
      {
        onTranscribe: event => {
          const index = event.sliceIndex ?? 0;
          const text = event.data?.result ?? '';
          this.sliceText.set(index, text);
          onPartial(this.joinTranscript());
        },
        onError: error => {
          Logger.error('🎤 Realtime transcribe error:', error);
        },
      },
    );

    Logger.info('🎤 Starting realtime transcription');
    await this.transcriber.start();
  }

  /** Stop recording and return the final transcript. */
  async stopListening(): Promise<string> {
    if (!this.transcriber) {
      return '';
    }
    Logger.info('🎤 Stopping realtime transcription');
    try {
      await this.transcriber.stop();
    } catch (error) {
      Logger.error('🎤 Error stopping transcriber:', error);
    }
    const transcript = this.joinTranscript();
    this.transcriber = null;
    this.sliceText.clear();
    Logger.info(`🎤 Transcript (${transcript.length} chars): ${transcript}`);
    return transcript;
  }

  /** Tear down mic + context. Call on unmount. */
  release(): void {
    if (this.transcriber) {
      this.transcriber.stop().catch(() => {});
      this.transcriber = null;
    }
    this.sliceText.clear();
    if (this.whisperContext) {
      this.whisperContext.release().catch(() => {});
      this.whisperContext = null;
    }
  }

  private joinTranscript(): string {
    return Array.from(this.sliceText.keys())
      .sort((a, b) => a - b)
      .map(k => (this.sliceText.get(k) ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }
}

export const SpeechService = new SpeechServiceClass();
