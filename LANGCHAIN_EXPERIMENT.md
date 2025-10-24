# Experiment: Adding LangChain.js to React Native

**⚠️ WARNING:** This is experimental and will significantly increase app size (~30-50MB)

## Step 1: Install Dependencies

```bash
npm install langchain @langchain/core
npm install react-native-get-random-values
npm install react-native-url-polyfill
npm install web-streams-polyfill
npm install expo-crypto  # For crypto polyfill
```

## Step 2: Add Polyfills to index.js

```javascript
// index.js - MUST BE FIRST IMPORTS
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import 'web-streams-polyfill/polyfill';

// Polyfill crypto
import {polyfillWebCrypto} from 'expo-crypto';
polyfillWebCrypto();

// Polyfill ReadableStream
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = ReadableStream;
}

// Polyfill Symbol.asyncIterator if needed
if (!Symbol.asyncIterator) {
  Symbol.asyncIterator = Symbol('asyncIterator');
}

// ... rest of your index.js
```

## Step 3: Create LangChain Service

```typescript
// src/services/LangChainToolService.ts
import {Tool} from '@langchain/core/tools';
import {ChatOpenAI} from '@langchain/openai';
import {AgentExecutor, createReactAgent} from 'langchain/agents';

class GetCurrentDateTimeTool extends Tool {
  name = 'get_current_datetime';
  description = 'Get the current date and time. Use when user asks about current time/date.';

  async _call(_input: string): Promise<string> {
    const now = new Date();
    return JSON.stringify({
      datetime: now.toISOString(),
      formatted: now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
  }
}

class SearchWebTool extends Tool {
  name = 'search_web';
  description = 'Search the web for information. Input should be a search query string.';

  async _call(query: string): Promise<string> {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json`;

    const response = await fetch(url);
    const data = await response.json();

    return JSON.stringify({
      results: data.RelatedTopics?.slice(0, 5).map((t: any) => t.Text) || [],
    });
  }
}

export class LangChainToolService {
  private static agent: AgentExecutor | null = null;

  static async initialize(llmEndpoint: string) {
    // NOTE: This won't work with llama.rn - needs cloud API
    // You'd need to create a custom LLM wrapper for llama.rn
    const llm = new ChatOpenAI({
      openAIApiKey: 'dummy',
      configuration: {
        baseURL: llmEndpoint, // Your local llama.rn server?
      },
    });

    const tools = [
      new GetCurrentDateTimeTool(),
      new SearchWebTool(),
    ];

    this.agent = await createReactAgent({
      llm,
      tools,
      prompt: ChatPromptTemplate.fromMessages([
        ['system', 'You are a helpful assistant with tool access.'],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ]),
    });
  }

  static async chat(message: string): Promise<string> {
    if (!this.agent) {
      throw new Error('LangChain not initialized');
    }

    const result = await this.agent.invoke({
      input: message,
    });

    return result.output;
  }
}
```

## Step 4: Use in Your App

```typescript
// In ChatScreen.tsx
import {LangChainToolService} from '../services/LangChainToolService';

// Initialize
useEffect(() => {
  LangChainToolService.initialize('http://localhost:8080/v1');
}, []);

// Use
const response = await LangChainToolService.chat("What time is it?");
```

## Problems You'll Encounter

### 1. **llama.rn Incompatibility**
LangChain expects cloud API endpoints (OpenAI-compatible). llama.rn runs in-process, not as a server.

**Solution:** You'd need to:
- Create a custom LLM class that wraps llama.rn
- Implement LangChain's BaseChatModel interface
- This is a LOT of work

### 2. **Bundle Size**
Adding LangChain will increase your app by 30-50MB.

### 3. **Performance**
Extra layers of abstraction = slower responses.

### 4. **Native Module Conflicts**
Polyfills might conflict with llama.rn's native modules.

## Verdict

**Don't do this for your use case.** Our manual implementation is better for:
- Local LLMs
- Mobile apps
- Performance
- Bundle size

Use LangChain if you:
- Use cloud APIs exclusively (OpenAI, Anthropic)
- Need Langchain's advanced features (memory, chains, multi-agent)
- Don't care about bundle size
- Are okay with experimental React Native support
