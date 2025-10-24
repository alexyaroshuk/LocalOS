---
base_model:
- meta-llama/Llama-3.2-1B-Instruct
language:
- en
- vi
license: apache-2.0
tags:
- text-generation-inference
- transformers
- unsloth
- llama
- trl
- Ollama
- Tool-Calling
datasets:
- nguyenthanhthuan/function-calling-sharegpt
---
# Function Calling Llama Model Version 2

## Overview
A specialized fine-tuned version of the **`meta-llama/Llama-3.2-1B-Instruct`** model enhanced with function/tool calling capabilities. The model leverages the **`nguyenthanhthuan/function-calling-sharegpt`** dataset for training.

## Model Specifications

* **Base Architecture**: meta-llama/Llama-3.2-1B-Instruct
* **Primary Language**: English (Function/Tool Calling), Vietnamese
* **Licensing**: Apache 2.0
* **Primary Developer**: nguyenthanhthuan_banhmi
* **Key Capabilities**: text-generation-inference, transformers, unsloth, llama, trl, Ollama, Tool-Calling

## Getting Started

### Prerequisites
Method 1:
1. Install [Ollama](https://ollama.com/)
2. Install required Python packages:
   ```bash
   pip install langchain pydantic torch langchain-ollama langchain_core
   ```
Method 2:
1. Click use this model
2. Click Ollama

### Installation Steps

1. Clone the repository
2. Navigate to the project directory
3. Create the model in Ollama:
   ```bash
   ollama create <model_name> -f <path_to_modelfile>
   ```

## Implementation Guide

### Model Initialization

```python
from langchain_ollama import ChatOllama 

# Initialize model instance
llm = ChatOllama(model="<model_name>")
```

### Basic Usage Example

```python
# Arithmetic computation example
query = "What is 3 * 12? Also, what is 11 + 49?"
response = llm.invoke(query)

print(response.content)
# Output:
# 1. 3 times 12 is 36.
# 2. 11 plus 49 is 60.
```

### Advanced Function Calling (English Recommended)

#### Basic Arithmetic Tools (Different from the first version)
```python
from pydantic import BaseModel

# Note that the docstrings here are crucial, as they will be passed along
# to the model along with the class name.
class add(BaseModel):
    """Add two integers together."""

    a: int = Field(..., description="First integer")
    b: int = Field(..., description="Second integer")

class multiply(BaseModel):
    """Multiply two integers together."""

    a: int = Field(..., description="First integer")
    b: int = Field(..., description="Second integer")

tools = [add, multiply]
llm_with_tools = llm.bind_tools(tools)

# Execute query and parser result (Different from the first version)
from langchain_core.output_parsers.openai_tools import PydanticToolsParser

query = "What is 3 * 12? Also, what is 11 + 49?"
chain = llm_with_tools | PydanticToolsParser(tools=tools)
result = chain.invoke(query)
print(result)

# Output:
# [multiply(a=3, b=12), add(a=11, b=49)]
```

#### Complex Tool Integration (Different from the first version)

```python
from pydantic import BaseModel, Field
from typing import List, Optional

class SendEmail(BaseModel):
    """Send an email to specified recipients."""

    to: List[str] = Field(..., description="List of email recipients")
    subject: str = Field(..., description="Email subject")
    body: str = Field(..., description="Email content/body")
    cc: Optional[List[str]] = Field(None, description="CC recipients")
    attachments: Optional[List[str]] = Field(None, description="List of attachment file paths")

class WeatherInfo(BaseModel):
    """Get weather information for a specific location."""

    city: str = Field(..., description="City name")
    country: Optional[str] = Field(None, description="Country name")
    units: str = Field("celsius", description="Temperature units (celsius/fahrenheit)")

class SearchWeb(BaseModel):
    """Search the web for given query."""

    query: str = Field(..., description="Search query")
    num_results: int = Field(5, description="Number of results to return")
    language: str = Field("en", description="Search language")

class CreateCalendarEvent(BaseModel):
    """Create a calendar event."""

    title: str = Field(..., description="Event title")
    start_time: str = Field(..., description="Event start time (ISO format)")
    end_time: str = Field(..., description="Event end time (ISO format)")
    description: Optional[str] = Field(None, description="Event description")
    attendees: Optional[List[str]] = Field(None, description="List of attendee emails")

class TranslateText(BaseModel):
    """Translate text between languages."""

    text: str = Field(..., description="Text to translate")
    source_lang: str = Field(..., description="Source language code (e.g., 'en', 'es')")
    target_lang: str = Field(..., description="Target language code (e.g., 'fr', 'de')")

class SetReminder(BaseModel):
    """Set a reminder for a specific time."""

    message: str = Field(..., description="Reminder message")
    time: str = Field(..., description="Reminder time (ISO format)")
    priority: str = Field("normal", description="Priority level (low/normal/high)")
tools = [
    SendEmail,
    WeatherInfo,
    SearchWeb,
    CreateCalendarEvent,
    TranslateText,
    SetReminder
]
llm_tools = llm.bind_tools(tools)

# # Execute query and parser result (Different from the first version)
from langchain_core.output_parsers.openai_tools import PydanticToolsParser

query = "Set a reminder to call John at 3 PM tomorrow. Also, translate 'Hello, how are you?' to Spanish."
chain = llm_tools | PydanticToolsParser(tools=tools)
result = chain.invoke(query)
print(result)

# Output:
# [SetReminder(message='Set a reminder for a specific time.', time='3 PM tomorrow', priority='normal'),
# TranslateText(text='Hello, how are you?', source_lang='en', target_lang='es')]
```

## Core Features

* Arithmetic computation support
* Advanced function/tool calling capabilities
* Seamless Langchain integration
* Full Ollama platform compatibility

## Technical Details

### Dataset Information
Training utilized the **`nguyenthanhthuan/function-calling-sharegpt`** dataset, featuring comprehensive function calling interaction examples.

### Known Limitations

* Basic function/tool calling
* English language support exclusively
* Ollama installation dependency

## Important Notes & Considerations

### Potential Limitations and Edge Cases

* **Function Parameter Sensitivity**: The model may occasionally misinterpret complex parameter combinations, especially when multiple optional parameters are involved. Double-check parameter values in critical applications.

* **Response Format Variations**:
  - In some cases, the function calling format might deviate from the expected JSON structure
  - The model may generate additional explanatory text alongside the function call
  - Multiple function calls in a single query might not always be processed in the expected order

* **Error Handling Considerations**:
  - Empty or null values might not be handled consistently across different function types
  - Complex nested objects may sometimes be flattened unexpectedly
  - Array inputs might occasionally be processed as single values

### Best Practices for Reliability

1. **Input Validation**:
   - Always validate input parameters before processing
   - Implement proper error handling for malformed function calls
   - Consider adding default values for optional parameters

2. **Testing Recommendations**:
   - Test with various input combinations and edge cases
   - Implement retry logic for inconsistent responses
   - Log and monitor function call patterns for debugging

3. **Performance Optimization**:
   - Keep function descriptions concise and clear
   - Limit the number of simultaneous function calls
   - Cache frequently used function results when possible

### Known Issues

* Model may struggle with:
  - Very long function descriptions
  - Highly complex nested parameter structures
  - Ambiguous or overlapping function purposes
  - Non-English parameter values or descriptions

## Development

### Contributing Guidelines
We welcome contributions through issues and pull requests for improvements and bug fixes.

### License Information
Released under Apache 2.0 license. See LICENSE file for complete terms.

## Academic Citation

```bibtex
@misc{function-calling-llama,
    author = {nguyenthanhthuan_banhmi},
    title = {Function Calling Llama Model Version 2} ,
    year = {2024},
    publisher = {GitHub},
    journal = {GitHub repository}
}
```