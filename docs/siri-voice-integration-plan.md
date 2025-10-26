# Siri + Voice Recording Integration Plan

## Overview

Implement Siri integration that automatically starts voice recording when the app is launched via Siri. This creates a seamless voice-first interaction where users can say "Hey Siri, open LocalOS" and immediately start talking to their AI assistant.

---

## User Experience Flow

1. User says: **"Hey Siri, open LocalOS"** or **"Hey Siri, chat with LocalOS"**
2. App launches and **detects Siri launch**
3. **Microphone automatically starts recording**
4. Visual indicator shows recording is active
5. User speaks their message
6. User taps stop button or waits for silence detection
7. Audio is **transcribed to text**
8. Text is sent to AI model for processing
9. AI response is displayed in chat

---

## Architecture Components

### 1. Siri Integration Layer

#### iOS Implementation
- **App Shortcuts** (iOS 16+) - Native Siri integration
- **NSUserActivity** - Activity-based app launching
- **Intents Extension** (optional) - For custom Siri commands

#### Android Implementation
- **App Actions** - Google Assistant integration
- **Intent Filters** - Voice command handling

### 2. Voice Recording Service

#### Core Features
- Real-time audio recording
- Silence detection (auto-stop)
- Audio format conversion (PCM -> compatible format)
- Permission management (microphone access)
- Visual feedback (waveform/recording indicator)

#### Dependencies
```json
{
  "@react-native-voice/voice": "^3.2.4",
  "react-native-audio-recorder-player": "^3.6.12"
}
```

**Note**: `@react-native-voice/voice` provides both speech-to-text AND recording capabilities, making it ideal for this use case.

### 3. Launch Detection Service

Detect and handle different launch contexts:
- **Normal launch** - User taps app icon
- **Siri launch** - Launched via Siri voice command
- **Deep link** - Launched via URL scheme
- **Push notification** - Background notification

### 4. Transcription Service

Convert recorded audio to text:
- **Option A**: On-device (Apple Speech Framework via `@react-native-voice/voice`)
- **Option B**: Cloud-based (Whisper API, if needed)
- **Option C**: Local Whisper model (via llama.rn or separate integration)

---

## Implementation Steps

### Phase 1: Dependencies & Permissions

#### 1.1 Install Required Packages

```bash
npm install @react-native-voice/voice react-native-audio-recorder-player
cd ios && pod install && cd ..
```

#### 1.2 iOS Configuration

**Info.plist** additions:
```xml
<!-- Microphone Permission -->
<key>NSMicrophoneUsageDescription</key>
<string>LocalOS needs microphone access for voice interactions</string>

<!-- Speech Recognition Permission -->
<key>NSSpeechRecognitionUsageDescription</key>
<string>LocalOS uses speech recognition to transcribe your voice</string>

<!-- Siri Integration -->
<key>NSUserActivityTypes</key>
<array>
  <string>com.localosapp.chat</string>
  <string>com.localosapp.voice-interaction</string>
</array>

<!-- App Shortcuts (iOS 16+) -->
<key>NSUserActivityTypes</key>
<array>
  <string>INStartCallIntent</string>
  <string>INSendMessageIntent</string>
</array>
```

**Capabilities** (Xcode):
- Enable "Siri" capability in target settings
- Add App Groups (if needed for intent extension)

#### 1.3 Android Configuration

**AndroidManifest.xml** additions:
```xml
<!-- Microphone Permission -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />

<!-- Voice Recognition -->
<uses-permission android:name="android.permission.SPEECH_RECOGNITION" />

<!-- App Actions Intent Filter -->
<activity android:name=".MainActivity">
  <intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LAUNCHER" />
  </intent-filter>

  <!-- Voice Assistant Integration -->
  <intent-filter>
    <action android:name="android.intent.action.ASSIST" />
    <category android:name="android.intent.category.DEFAULT" />
  </intent-filter>
</activity>
```

### Phase 2: Core Services Implementation

#### 2.1 VoiceService.ts

Create `src/services/VoiceService.ts`:

```typescript
import Voice from '@react-native-voice/voice';
import { PermissionsAndroid, Platform } from 'react-native';

class VoiceServiceClass {
  private isRecording: boolean = false;
  private recognizedText: string = '';

  async initialize() {
    Voice.onSpeechStart = this.onSpeechStart;
    Voice.onSpeechEnd = this.onSpeechEnd;
    Voice.onSpeechResults = this.onSpeechResults;
    Voice.onSpeechError = this.onSpeechError;
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true; // iOS handles via Info.plist
  }

  async startRecording() {
    try {
      await this.requestPermissions();
      await Voice.start('en-US');
      this.isRecording = true;
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }

  async stopRecording(): Promise<string> {
    try {
      await Voice.stop();
      this.isRecording = false;
      return this.recognizedText;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return '';
    }
  }

  private onSpeechResults = (e: any) => {
    this.recognizedText = e.value[0];
  };

  private onSpeechStart = () => {
    console.log('Speech started');
  };

  private onSpeechEnd = () => {
    console.log('Speech ended');
  };

  private onSpeechError = (e: any) => {
    console.error('Speech error:', e);
  };

  async destroy() {
    Voice.destroy().then(Voice.removeAllListeners);
  }
}

export const VoiceService = new VoiceServiceClass();
```

#### 2.2 AppLaunchService.ts

Create `src/services/AppLaunchService.ts`:

```typescript
import { Linking, Platform } from 'react-native';

export type LaunchSource = 'normal' | 'siri' | 'deeplink' | 'notification';

class AppLaunchServiceClass {
  private launchSource: LaunchSource = 'normal';
  private launchActivity: any = null;

  async initialize() {
    // iOS: Check for NSUserActivity
    if (Platform.OS === 'ios') {
      const { RNUserActivity } = require('react-native');
      RNUserActivity?.onUserActivityReceived((activity: any) => {
        this.handleUserActivity(activity);
      });
    }

    // Both: Check initial URL
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      this.launchSource = 'deeplink';
    }
  }

  private handleUserActivity(activity: any) {
    console.log('User activity received:', activity);

    // Check if launched via Siri
    if (activity.activityType?.includes('com.localosapp')) {
      this.launchSource = 'siri';
      this.launchActivity = activity;
    }
  }

  getLaunchSource(): LaunchSource {
    return this.launchSource;
  }

  getLaunchActivity(): any {
    return this.launchActivity;
  }

  isSiriLaunch(): boolean {
    return this.launchSource === 'siri';
  }

  reset() {
    this.launchSource = 'normal';
    this.launchActivity = null;
  }
}

export const AppLaunchService = new AppLaunchServiceClass();
```

#### 2.3 Native Module for NSUserActivity (iOS)

Create `ios/LocalOSApp/RNUserActivity.h`:

```objc
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RNUserActivity : RCTEventEmitter <RCTBridgeModule>
@end
```

Create `ios/LocalOSApp/RNUserActivity.m`:

```objc
#import "RNUserActivity.h"

@implementation RNUserActivity

RCT_EXPORT_MODULE();

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onUserActivityReceived"];
}

- (void)handleUserActivity:(NSUserActivity *)userActivity {
  [self sendEventWithName:@"onUserActivityReceived" body:@{
    @"activityType": userActivity.activityType ?: @"",
    @"title": userActivity.title ?: @"",
    @"userInfo": userActivity.userInfo ?: @{}
  }];
}

@end
```

Update `ios/LocalOSApp/AppDelegate.mm`:

```objc
#import "RNUserActivity.h"

- (BOOL)application:(UIApplication *)application
continueUserActivity:(NSUserActivity *)userActivity
  restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler {

  // Notify React Native about the user activity
  [[NSNotificationCenter defaultCenter] postNotificationName:@"UserActivityReceived"
                                                      object:userActivity];
  return YES;
}
```

### Phase 3: UI Integration

#### 3.1 Update ChatScreen.tsx

Modify `src/screens/ChatScreen.tsx`:

```typescript
import { VoiceService } from '../services/VoiceService';
import { AppLaunchService } from '../services/AppLaunchService';

// Add state
const [isRecording, setIsRecording] = useState(false);
const [voiceInput, setVoiceInput] = useState('');

// Initialize on mount
useEffect(() => {
  VoiceService.initialize();

  // Check if launched via Siri
  if (AppLaunchService.isSiriLaunch()) {
    handleSiriLaunch();
  }

  return () => {
    VoiceService.destroy();
  };
}, []);

// Handle Siri launch
const handleSiriLaunch = async () => {
  console.log('App launched via Siri - starting voice recording');
  await startVoiceRecording();

  // Reset launch source after handling
  AppLaunchService.reset();
};

// Start voice recording
const startVoiceRecording = async () => {
  try {
    setIsRecording(true);
    await VoiceService.startRecording();
  } catch (error) {
    console.error('Failed to start voice recording:', error);
    setIsRecording(false);
  }
};

// Stop voice recording
const stopVoiceRecording = async () => {
  try {
    const transcribedText = await VoiceService.stopRecording();
    setIsRecording(false);

    if (transcribedText) {
      setVoiceInput(transcribedText);
      setInputText(transcribedText);
      // Optionally auto-send
      // handleSend(transcribedText);
    }
  } catch (error) {
    console.error('Failed to stop voice recording:', error);
    setIsRecording(false);
  }
};

// Add microphone button to UI
<TouchableOpacity
  onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
  style={styles.micButton}>
  <Text>{isRecording ? '🔴 Stop' : '🎤 Record'}</Text>
</TouchableOpacity>
```

#### 3.2 Add Visual Recording Indicator

```typescript
{isRecording && (
  <View style={styles.recordingIndicator}>
    <View style={styles.pulsingDot} />
    <Text style={styles.recordingText}>Listening...</Text>
  </View>
)}

// Styles
const styles = StyleSheet.create({
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 8,
  },
  recordingText: {
    color: 'white',
    fontWeight: '600',
  },
  micButton: {
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 24,
    marginLeft: 8,
  },
});
```

### Phase 4: App Shortcuts Configuration (iOS 16+)

#### 4.1 Create Shortcuts Intent

Create `ios/LocalOSApp/Shortcuts.swift`:

```swift
import AppIntents

@available(iOS 16.0, *)
struct OpenChatIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Chat"
    static var description = IntentDescription("Opens LocalOS and starts a voice conversation")

    @MainActor
    func perform() async throws -> some IntentResult {
        // Notify React Native that app was opened via Siri
        NotificationCenter.default.post(
            name: NSNotification.Name("SiriLaunchDetected"),
            object: nil,
            userInfo: ["source": "app_shortcut"]
        )
        return .result()
    }
}

@available(iOS 16.0, *)
struct LocalOSShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenChatIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Start chatting with \(.applicationName)",
                "Talk to \(.applicationName)"
            ],
            shortTitle: "Chat",
            systemImageName: "message.fill"
        )
    }
}
```

#### 4.2 Update Xcode Project

1. Add Swift file to Xcode project
2. Create Bridging Header if needed
3. Enable "Supports App Intents" in Info.plist

### Phase 5: Testing & Refinement

#### 5.1 Test Cases

- [ ] Normal app launch - no auto-recording
- [ ] Siri launch - auto-start recording
- [ ] Permission denied - graceful handling
- [ ] Background/foreground transitions
- [ ] Microphone in use by another app
- [ ] Silent speech (no input detected)
- [ ] Long speech (>1 minute)
- [ ] Multiple rapid launches

#### 5.2 User Feedback

- Recording indicator visibility
- Haptic feedback on start/stop
- Audio cues (optional beep)
- Error messages clarity
- Transcription accuracy display

---

## Advanced Features (Future)

### 1. Continuous Conversation Mode
- Keep mic open for follow-up questions
- Detect "stop" or silence to end session
- Chain multiple queries

### 2. Custom Siri Phrases
- "Ask LocalOS about [topic]"
- "Tell LocalOS to remember [note]"
- "Search my memories for [query]"

### 3. Background Processing
- Use Intent Extension for background execution
- Process queries without opening app UI
- Return responses via Siri voice output

### 4. Local Whisper Integration
- Use llama.rn or separate model for offline transcription
- Complete privacy - no cloud services
- Larger model = better accuracy

### 5. Wake Word Detection
- "Hey LocalOS" wake word
- Always-listening mode (battery considerations)
- Privacy controls

---

## Security & Privacy Considerations

### Permissions
- Request microphone permission with clear explanation
- Allow users to revoke at any time
- Never record without explicit indicator

### Data Handling
- All audio processing on-device (no cloud upload)
- Transcribed text stays local
- No audio storage unless user explicitly saves

### User Control
- Manual start/stop override
- Visual recording indicator always visible
- Easy access to disable Siri integration

---

## Technical Challenges & Solutions

### Challenge 1: Detecting Siri Launch
**Problem**: React Native doesn't natively expose NSUserActivity

**Solution**:
- Create native module (RNUserActivity) to bridge iOS activity data
- Use event emitter to notify React Native
- Check on app mount and handle appropriately

### Challenge 2: Auto-start Timing
**Problem**: Recording may start before UI is ready

**Solution**:
- Use loading state to delay recording start
- Show immediate visual feedback (loading spinner → recording indicator)
- Queue recording start until ChatScreen is mounted

### Challenge 3: Permission Timing
**Problem**: Permission prompt may interrupt flow

**Solution**:
- Pre-request permissions on first app launch
- Store permission status
- Show custom prompt before Siri integration setup

### Challenge 4: Cross-Platform Consistency
**Problem**: Android uses different launch mechanisms

**Solution**:
- Abstract launch detection into service layer
- Implement platform-specific detectors
- Unified API for React Native components

---

## Dependencies Summary

### NPM Packages
```json
{
  "@react-native-voice/voice": "^3.2.4",
  "react-native-audio-recorder-player": "^3.6.12"
}
```

### Native Dependencies (iOS)
- Speech Framework (built-in)
- AVFoundation (built-in)
- Intents Framework (built-in)
- AppIntents Framework (iOS 16+)

### Native Dependencies (Android)
- SpeechRecognizer API (built-in)
- AudioRecord (built-in)

---

## Implementation Timeline

### Week 1: Core Voice Infrastructure
- Install dependencies
- Create VoiceService
- Implement basic recording/transcription
- Add UI controls to ChatScreen

### Week 2: Launch Detection
- Create AppLaunchService
- Implement iOS NSUserActivity bridge
- Add Android intent handling
- Test launch detection

### Week 3: Siri Integration
- Configure Info.plist
- Create App Shortcuts
- Implement auto-recording on Siri launch
- Test end-to-end flow

### Week 4: Polish & Testing
- Visual indicators
- Error handling
- Permission flows
- User testing & refinement

---

## Success Metrics

- ✅ App launches within 2 seconds of Siri command
- ✅ Recording starts automatically on Siri launch
- ✅ Transcription accuracy >90% for clear speech
- ✅ Permissions requested gracefully with clear messaging
- ✅ No crashes or hangs during voice interaction
- ✅ Works on both iOS and Android

---

## References

- [React Native Voice Documentation](https://github.com/react-native-voice/voice)
- [Apple Siri Integration Guide](https://developer.apple.com/documentation/sirikit)
- [App Intents (iOS 16+)](https://developer.apple.com/documentation/appintents)
- [NSUserActivity Documentation](https://developer.apple.com/documentation/foundation/nsuseractivity)
- [Android App Actions](https://developer.android.com/guide/app-actions)

---

## Next Steps

1. Review and approve this plan
2. Set up development branch
3. Begin Phase 1 implementation
4. Test on physical devices (Siri requires real device)
5. Iterate based on user feedback

**Questions or modifications needed?** Let me know before we start implementation!
