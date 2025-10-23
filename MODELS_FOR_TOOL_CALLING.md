# Recommended Models for Tool Calling

Tool calling (function calling) requires models specifically trained for this capability. **Base models often fail to reliably invoke tools**, even with good prompting.

## 🎯 Best Models for Tool Calling

### Llama 3.2 Fine-Tuned Models

These models are fine-tuned specifically for function calling:

1. **BluebrainAI/Llama-3.2-3B-Instruct-function-calling** (RECOMMENDED)
   - Download: https://huggingface.co/BluebrainAI/Llama-3.2-3B-Instruct-function-calling-gorilla-style-IM-START-END-5epochs
   - Size: 3B parameters
   - Trained specifically for gorilla-style function calling
   - Best performance for tool calling tasks

2. **nguyenthanhthuan/Llama_3.2_1B_Intruct_Tool_Calling_V2**
   - Download: https://huggingface.co/nguyenthanhthuan/Llama_3.2_1B_Intruct_Tool_Calling_V2
   - Size: 1B parameters (faster, lighter)
   - Good for devices with limited resources

### Phi-3 Fine-Tuned Models

1. **mzbac/Phi-3-mini-4k-instruct-function-calling**
   - Download: https://huggingface.co/mzbac/Phi-3-mini-4k-instruct-function-calling
   - Context: 4K tokens
   - Fast and accurate on function calling

2. **Trelis/Phi-3-mini-128k-instruct-function-calling**
   - Download: https://huggingface.co/Trelis/Phi-3-mini-128k-instruct-function-calling
   - Context: 128K tokens (very long context)
   - Excellent for complex multi-turn conversations

## ⚠️ Base Models (NOT RECOMMENDED)

### Issues with Base Models

**Llama 3.2 3B Base:**
- ❌ Success rate only ~80%
- ❌ Frequently fails to emit tool calls in correct format
- ❌ Often misunderstands when to call tools

**Phi-3 Mini Base:**
- ❌ No official tool calling support from Microsoft
- ❌ Often responds with "If I wouldn't run in a simulation, I would call tool X" instead of actually calling
- ❌ Unreliable for production use

**Meta Llama 3.2 3B Instruct** (your selected model)
- Download: https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf
- ⚠️ This is a base model - tool calling will be unreliable
- ✅ Great for general conversation
- ❌ Not optimized for function calling

## 🔧 How to Fix Tool Calling Issues

### Option 1: Use a Fine-Tuned Model (BEST)

Download one of the recommended models above and load it in the app.

### Option 2: Use More Explicit Prompting (MODERATE)

The updated system prompt in this app is now much more explicit:
- Clear examples of when to use tools
- Specific JSON format examples
- Warnings about common mistakes

This may improve base model performance from ~80% to ~90%, but still not as reliable as fine-tuned models.

### Option 3: Hybrid Approach (ADVANCED)

Implement a two-step process:
1. First ask the model IF it needs a tool
2. Then ask it to make the tool call

This adds latency but improves accuracy.

## 📊 Performance Comparison

| Model | Tool Call Accuracy | Speed | Context Length | Size |
|-------|-------------------|-------|----------------|------|
| BluebrainAI Llama 3.2 FC | ~95% | Medium | 128K | 3B |
| Llama 3.2 1B Tool Calling | ~90% | Fast | 128K | 1B |
| Phi-3 Mini FC (4K) | ~93% | Fast | 4K | 3.8B |
| Phi-3 Mini FC (128K) | ~93% | Medium | 128K | 3.8B |
| **Llama 3.2 3B Base** | **~80%** | Medium | 128K | 3B |
| **Phi-3 Mini Base** | **~60%** | Fast | 4K | 3.8B |

## 🚀 Quick Start

1. **Download a recommended model** (preferably BluebrainAI Llama 3.2 FC)
2. **Load it in the app** via the Models screen
3. **Enable tools** in the chat screen
4. **Test with these prompts**:
   - "What day is today?" (should call get_current_datetime)
   - "Search for React Native" (should call search_web)
   - "What is JavaScript?" (should NOT call tools)

## 💡 Tips for Better Results

1. **Be specific**: "What day is today?" works better than "Tell me about today"
2. **Use keywords**: Include "search", "current", "now", "today" when you want tools
3. **Check settings**: Make sure "Tools ON" is visible in the chat header
4. **Model size matters**: Larger models generally perform better, but 3B is the sweet spot for mobile

## 📚 Additional Resources

- [Function Calling with Llama 3.2](https://medium.com/@zilliz_learn/function-calling-with-ollama-llama-3-2-and-milvus-ac2bc2122538)
- [Phi-3 Function Calling Guide](https://medium.com/@mauryaanoop3/unleashing-llms-functional-calling-with-langchain-ollama-and-microsofts-phi-3-part-2-10fae91d7b01)
- [OpenAI Function Calling Best Practices](https://platform.openai.com/docs/guides/function-calling)
