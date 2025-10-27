# Agent Memory Search Test Queries

This file contains test queries to validate that the agent correctly discerns between:
1. Questions about the USER (should search archival memory)
2. General knowledge questions (should use model knowledge)
3. Current events (should use web search)

## Test Setup
1. First, insert some user data:
   - "My name is Alex"
   - "I live in Seattle, Washington"
   - "My favorite color is blue"
   - "I work as a software engineer"
   - "My email is alex@example.com"

## Category 1: Questions About USER (Should use archival_memory_search)

### Expected Behavior: Search memory FIRST, then respond with results or "I don't have that info yet"

| Query | Expected Tool | Expected Response |
|-------|---------------|-------------------|
| "Where do I live?" | `archival_memory_search` query="user location address city" | "You live in Seattle, Washington" (from memory) |
| "What's my email?" | `archival_memory_search` query="user email contact" | "Your email is alex@example.com" (from memory) |
| "What's my favorite color?" | `archival_memory_search` query="user favorite color preference" | "Your favorite color is blue" (from memory) |
| "What do you know about me?" | `archival_memory_search` query="user preferences facts" | List all stored info about user |
| "What's my name?" | `archival_memory_search` query="user name" | "Your name is Alex" (from memory) |
| "What do I do for work?" | `archival_memory_search` query="user work job profession" | "You work as a software engineer" (from memory) |
| "What's my phone number?" | `archival_memory_search` query="user phone number contact" | "I don't have your phone number yet" (not in memory) |

### Key Identifiers for User Questions:
- Contains personal pronouns: "my", "I", "me"
- Asks about personal information
- Asks about past user actions or statements

## Category 2: General Knowledge (Should use MODEL knowledge, NO tools)

### Expected Behavior: Answer directly using built-in knowledge, NO tool calls

| Query | Expected Tool | Expected Response |
|-------|---------------|-------------------|
| "What is the capital of France?" | NONE (use knowledge) | "Paris" |
| "Who invented the telephone?" | NONE (use knowledge) | "Alexander Graham Bell" |
| "What is React Native?" | NONE (use knowledge) | Technical explanation |
| "How do you make coffee?" | NONE (use knowledge) | Step-by-step guide |
| "What's 2+2?" | NONE (use knowledge) | "4" |
| "What is the capital of Washington state?" | NONE (use knowledge) | "Olympia" |

### Key Identifiers for General Questions:
- No personal pronouns
- Factual/encyclopedic questions
- General "how-to" or "what is" questions
- Historical facts
- Scientific/technical definitions

## Category 3: Current Events (Should use search_web)

### Expected Behavior: Use web search for real-time information

| Query | Expected Tool | Expected Response |
|-------|---------------|-------------------|
| "What's the weather today?" | `search_web` query="weather today" | Current weather info |
| "Latest news on AI?" | `search_web` query="latest AI news" | Recent AI news |
| "What's the stock price of Apple?" | `search_web` query="Apple stock price" | Current stock info |

### Key Identifiers for Current Events:
- Time-sensitive information ("today", "now", "latest")
- Real-time data (weather, stocks, news)
- Recent events

## Category 4: Context/Conversation History (Should use archival_memory_search)

### Expected Behavior: Search memory for past conversation context

| Query | Expected Tool | Expected Response |
|-------|---------------|-------------------|
| "What were we talking about yesterday?" | `archival_memory_search` query="conversation yesterday" | Summary of past conversation |
| "What tasks did we discuss?" | `archival_memory_search` query="tasks discussed" | List of tasks from memory |
| "Remind me what I told you about my project" | `archival_memory_search` query="user project" | Project details from memory |

## Testing Procedure

### Phase 1: Insert User Data
Run these commands to populate the agent's memory:
1. "My name is Alex"
2. "I live in Seattle, Washington"
3. "My favorite color is blue"
4. "I work as a software engineer"
5. "My email is alex@example.com"

**Expected**: Each should trigger `archival_memory_insert`

### Phase 2: Test User Questions
Ask each question from Category 1.

**Success criteria**:
- ✅ Agent calls `archival_memory_search` BEFORE responding
- ✅ Agent finds and returns stored information correctly
- ✅ For info not in memory (phone number), agent says "I don't have that yet" (after searching)

**Failure modes to watch for**:
- ❌ Agent responds without searching first
- ❌ Agent calls `archival_memory_insert` instead of search
- ❌ Agent says "I don't know" without searching
- ❌ Agent invents information not in memory

### Phase 3: Test General Knowledge
Ask questions from Category 2.

**Success criteria**:
- ✅ Agent answers directly using knowledge
- ✅ NO tool calls made
- ✅ Accurate responses

**Failure modes**:
- ❌ Agent searches memory unnecessarily
- ❌ Agent says it doesn't know factual information
- ❌ Agent uses web search for static facts

### Phase 4: Test Current Events
Ask questions from Category 3.

**Success criteria**:
- ✅ Agent calls `search_web`
- ✅ Returns current information

### Phase 5: Edge Cases

Test these tricky questions:

1. "Where is Seattle?" (General knowledge, NOT user question)
   - Expected: NO tools, answer "Seattle is a city in Washington state"
   - ❌ Should NOT search memory even though "Seattle" is in user's location

2. "Where do I live and what's the capital of that state?"
   - Expected: `archival_memory_search` for user location, then use knowledge for capital
   - Response: "You live in Seattle, Washington. The capital of Washington state is Olympia."

3. "Do I like blue?" (Testing synonym/inference)
   - Expected: `archival_memory_search` query="user favorite color preference like"
   - Response: "Yes, your favorite color is blue"

## Logging & Debugging

Check the logs at `dev/logs.txt` for:
- Tool detection phase
- Which tool was called (if any)
- Tool arguments
- Tool results
- Final response

Look for these log lines:
- `✅ TOOL CALL DETECTED:` - Shows which tool was used
- `❌ NO TOOL CALL DETECTED` - Model responded without tools
- `🔧 Tool execution result:` - Tool output
