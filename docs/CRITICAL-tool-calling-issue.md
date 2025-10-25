# 🚨 CRITICAL: Tool Calling Not Working - Root Cause Found

## Problem Summary

**Tools are NOT being called** despite:
- ✅ 7 tools registered correctly
- ✅ System prompt includes examples
- ✅ Memory tools implemented
- ❌ **Model outputs regular text instead of tool calls**

### Evidence from Logs:

```
User: "My favorite color is blue"
Expected: [core_memory_append(label="user_profile", content="Favorite color: blue")]
Actual: "That's interesting! Blue is a great color..." ❌

User: "What do you know about me?"
Expected: [archival_memory_search(query="user preferences", top_k=10)]
Actual: "I don't have any information about you yet..." ❌
```

---

## 🔍 ROOT CAUSE IDENTIFIED

### The Model Format Mismatch

Looking at [model documentation](../dev/model_doc/nguyenthanhthuan/Llama_3.2_1B_Intruct_Tool_Calling_V2.md):

**The model was fine-tuned using Langchain's `bind_tools()` method!**

```python
# What the model was trained on:
from langchain_ollama import ChatOllama
from pydantic import BaseModel, Field

class add(BaseModel):
    """Add two integers together."""
    a: int = Field(..., description="First integer")
    b: int = Field(..., description="Second integer")

tools = [add, multiply]
llm_with_tools = llm.bind_tools(tools)  # ← Langchain format
```

**But our code uses a different format:**
```typescript
// What we're sending:
Format: [tool_name(param="value")]

// Example:
[archival_memory_search(query="preferences", top_k=5)]
```

### Why This Matters

**Langchain's `bind_tools()` uses a specific prompt format that:**
1. Includes Pydantic schema in a specific way
2. Uses special tokens/markers the model expects
3. Formats tool calls in JSON, not brackets

**Our custom format doesn't match what the model saw during training!**

---

## 🎯 Solutions

### Option 1: Use Langchain Format (RECOMMENDED)

**Pros:**
- Model was trained on this format
- Higher success rate
- Standard approach

**Cons:**
- Need to restructure tool definitions to match Pydantic
- Need to replicate Langchain's prompt format

**Implementation:**
Need to:
1. Convert our Tool interface to Pydantic-style schemas
2. Use Langchain's exact prompt template
3. Parse Pydantic/JSON tool call outputs

### Option 2: Retrain/Fine-tune Model on Our Format

**Pros:**
- Can use any format we want
- Full control

**Cons:**
- Requires dataset creation
- Need to fine-tune 1B model (time + GPU)
- Not practical for immediate use

### Option 3: Try Different Model

**Pros:**
- Some models support custom formats
- Easier to match our existing code

**Cons:**
- May lose quality
- Need to test multiple models

### Option 4: Increase Prompting Strength (QUICK FIX TO TRY FIRST)

**Even if format doesn't match perfectly, we can try:**

1. **More explicit instructions:**
```typescript
CRITICAL: When you want to use a tool, you MUST output EXACTLY this format:
[tool_name(param="value")]

DO NOT write explanations. DO NOT use JSON. ONLY output the bracket format shown above.
```

2. **One-shot learning in examples:**
```typescript
User: "I prefer TypeScript"
Assistant: [archival_memory_insert(content="User prefers TypeScript", tags=["preference"])]

NOT like this: "I'll remember that..." ❌
YES like this: [archival_memory_insert(...)] ✅
```

3. **Increase temperature & maxTokens** (DONE):
```typescript
temperature: 0.7,  // Was 0.1
maxTokens: 150,    // Was 100
```

---

## 🧪 Testing Steps

### Step 1: Verify Current Prompt Format

Run the app and check logs for:
```
=== SYSTEM PROMPT DEBUG ===
Prompt length: [number]
Includes memory examples: [true/false]
Includes "What do you know": [true/false]
First 500 chars: [text]
```

This tells us if examples are reaching the model.

### Step 2: Try Explicit Tool Forcing

**Test prompt:**
```
Use the tool archival_memory_insert to save: I prefer TypeScript
```

If this works → Model can call tools, just needs better triggers
If this fails → Model fundamentally not understanding our format

### Step 3: Test Known Working Tool

**Test prompt:**
```
Latest news about AI
```

We know `search_web` sometimes works. If it works now → Tool calling works, just needs better examples.

### Step 4: Compare with Langchain Format

Create a test using Langchain's exact prompt format to see if that works better.

---

## 📋 Immediate Actions Taken

### 1. ✅ Added Debug Logging
```typescript
Logger.debug('=== SYSTEM PROMPT DEBUG ===');
Logger.debug('Prompt length:', systemPrompt.length);
Logger.debug('Includes memory examples:', systemPrompt.includes('archival_memory_search'));
```

### 2. ✅ Increased Temperature
```typescript
// Before: 0.1 (too conservative)
// After: 0.7 (more willing to try new formats)
temperature: 0.7
```

### 3. ✅ Increased maxTokens
```typescript
// Before: 100 (may cut off tool calls)
// After: 150 (enough space)
maxTokens: 150
```

### 4. ✅ Added Comprehensive Examples
System prompt now includes 8+ memory tool examples showing exact format.

---

## 🔬 Investigation Needed

### Questions to Answer:

1. **Does `search_web` reliably work?**
   - If YES: Format is acceptable, just need better memory examples
   - If NO: Format is fundamentally wrong

2. **What does Langchain's `bind_tools()` actually send to the model?**
   - Need to inspect Langchain source code
   - Or capture actual prompts Langchain generates

3. **Can we find the exact prompt format used during training?**
   - Check model training code
   - Look for function-calling-sharegpt dataset examples

4. **Is there a simpler 1B model that works with custom format?**
   - Maybe try Llama 3.2 3B
   - Or different function-calling model

---

## 🎯 Recommended Next Steps

### SHORT TERM (Try Now):

1. **Run the app with new debug logging**
   - Check if examples are in the prompt
   - Verify prompt length > 2000

2. **Test with explicit instruction:**
   ```
   Use archival_memory_insert tool to save: I prefer blue color
   ```

3. **Test search_web:**
   ```
   Latest news about AI
   ```

4. **Compare outputs** - Does search_web work better than memory tools?

### MEDIUM TERM (If Above Fails):

5. **Research Langchain's prompt format**
   - Find exact format `bind_tools()` uses
   - Replicate it in our code

6. **Create Pydantic-style tool schemas**
   - Convert our Tool interface
   - Match Langchain's schema format

7. **Test with Langchain format**
   - See if tool calling improves

### LONG TERM (If Format Change Needed):

8. **Restructure entire tool calling system**
   - Use Langchain-compatible format
   - Update all tool definitions
   - Update tool parsing

9. **Or switch to different model**
   - Find model that works with bracket format
   - Maybe Llama 3.2 3B or Qwen

---

## 📚 References

- [Model Docs](../dev/model_doc/nguyenthanhthuan/Llama_3.2_1B_Intruct_Tool_Calling_V2.md)
- [Training Dataset](https://huggingface.co/datasets/nguyenthanhthuan/function-calling-sharegpt)
- [Langchain Ollama Docs](https://python.langchain.com/docs/integrations/chat/ollama_functions)
- [Recent Logs](../dev/logs_newest.txt)

---

## 💡 Key Insights

1. **Model training matters** - Can't just use any format
2. **Langchain format ≠ Custom format** - They're fundamentally different
3. **Examples help but may not be enough** - If format is wrong, examples won't fix it
4. **Temperature matters** - 0.1 was too conservative
5. **Need to verify assumptions** - Test if search_web works to isolate the problem

---

**Status:** Investigation ongoing
**Priority:** Critical - Tool calling is core functionality
**Next Action:** Run app with debug logging, test explicit tool commands

---

## 🤔 Question for You

Before we restructure everything to use Langchain format, let's test:

1. **Does "Latest news about AI" trigger `search_web`?**
2. **Does "Use archival_memory_insert to save: I like blue" work?**

This tells us if the format is salvageable or if we need bigger changes.

**Please run these tests and share the logs!**
