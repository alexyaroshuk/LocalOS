## Model Information

The Meta Llama 3.1 collection of multilingual large language models (LLMs) is a collection of pretrained and instruction tuned generative models in 8B, 70B and 405B sizes (text in/text out). The Llama 3.1 instruction tuned text only models (8B, 70B, 405B) are optimized for multilingual dialogue use cases and outperform many of the available open source and closed chat models on common industry benchmarks.

**Model developer**: Meta

**Model Architecture:** Llama 3.1 is an auto-regressive language model that uses an optimized transformer architecture. The tuned versions use supervised fine-tuning (SFT) and reinforcement learning with human feedback (RLHF) to align with human preferences for helpfulness and safety. 


<table>
  <tr>
   <td>
   </td>
   <td><strong>Training Data</strong>
   </td>
   <td><strong>Params</strong>
   </td>
   <td><strong>Input modalities</strong>
   </td>
   <td><strong>Output modalities</strong>
   </td>
   <td><strong>Context length</strong>
   </td>
   <td><strong>GQA</strong>
   </td>
   <td><strong>Token count</strong>
   </td>
   <td><strong>Knowledge cutoff</strong>
   </td>
  </tr>
  <tr>
   <td rowspan="3" >Llama 3.1 (text only)
   </td>
   <td rowspan="3" >A new mix of publicly available online data.
   </td>
   <td>8B
   </td>
   <td>Multilingual Text
   </td>
   <td>Multilingual Text and code
   </td>
   <td>128k
   </td>
   <td>Yes
   </td>
   <td rowspan="3" >15T+
   </td>
   <td rowspan="3" >December 2023
   </td>
  </tr>
  <tr>
   <td>70B
   </td>
   <td>Multilingual Text
   </td>
   <td>Multilingual Text and code
   </td>
   <td>128k
   </td>
   <td>Yes
   </td>
  </tr>
  <tr>
   <td>405B
   </td>
   <td>Multilingual Text
   </td>
   <td>Multilingual Text and code
   </td>
   <td>128k
   </td>
   <td>Yes
   </td>
  </tr>
</table>


**Supported languages:** English, German, French, Italian, Portuguese, Hindi, Spanish, and Thai.

**Llama 3.1 family of models**. Token counts refer to pretraining data only. All model versions use Grouped-Query Attention (GQA) for improved inference scalability.

**Model Release Date:** July 23, 2024.

**Status:** This is a static model trained on an offline dataset. Future versions of the tuned models will be released as we improve model safety with community feedback.

**License:** A custom commercial license, the Llama 3.1 Community License, is available at: [https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/LICENSE](https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/LICENSE)

Where to send questions or comments about the model Instructions on how to provide feedback or comments on the model can be found in the model [README](https://github.com/meta-llama/llama3). For more technical information about generation parameters and recipes for how to use Llama 3.1 in applications, please go [here](https://github.com/meta-llama/llama-recipes). 


## Intended Use

**Intended Use Cases** Llama 3.1 is intended for commercial and research use in multiple languages. Instruction tuned text only models are intended for assistant-like chat, whereas pretrained models can be adapted for a variety of natural language generation tasks. The Llama 3.1 model collection also supports the ability to leverage the outputs of its models to improve other models including synthetic data generation and distillation. The Llama 3.1 Community License allows for these use cases. 

**Out-of-scope** Use in any manner that violates applicable laws or regulations (including trade compliance laws). Use in any other way that is prohibited by the Acceptable Use Policy and Llama 3.1 Community License. Use in languages beyond those explicitly referenced as supported in this model card**.
**<span style="text-decoration:underline;">Note</span>: Llama 3.1 has been trained on a broader collection of languages than the 8 supported languages. Developers may fine-tune Llama 3.1 models for languages beyond the 8 supported languages provided they comply with the Llama 3.1 Community License and the Acceptable Use Policy and in such cases are responsible for ensuring that any uses of Llama 3.1 in additional languages is done in a safe and responsible manner.

## How to use

This repository contains two versions of Meta-Llama-3.1-8B-Instruct, for use with transformers and with the original `llama` codebase.

### Use with transformers

Starting with `transformers >= 4.43.0` onward, you can run conversational inference using the Transformers `pipeline` abstraction or by leveraging the Auto classes with the `generate()` function.

Make sure to update your transformers installation via `pip install --upgrade transformers`.

```python
import transformers
import torch
model_id = "meta-llama/Meta-Llama-3.1-8B-Instruct"
pipeline = transformers.pipeline(
    "text-generation",
    model=model_id,
    model_kwargs={"torch_dtype": torch.bfloat16},
    device_map="auto",
)
messages = [
    {"role": "system", "content": "You are a pirate chatbot who always responds in pirate speak!"},
    {"role": "user", "content": "Who are you?"},
]
outputs = pipeline(
    messages,
    max_new_tokens=256,
)
print(outputs[0]["generated_text"][-1])
```

Note: You can also find detailed recipes on how to use the model locally, with `torch.compile()`, assisted generations, quantised and more at [`huggingface-llama-recipes`](https://github.com/huggingface/huggingface-llama-recipes)

### Tool use with transformers

LLaMA-3.1 supports multiple tool use formats. You can see a full guide to prompt formatting [here](https://llama.meta.com/docs/model-cards-and-prompt-formats/llama3_1/).

Tool use is also supported through [chat templates](https://huggingface.co/docs/transformers/main/chat_templating#advanced-tool-use--function-calling) in Transformers. 
Here is a quick example showing a single simple tool:

```python
# First, define a tool
def get_current_temperature(location: str) -> float:
    """
    Get the current temperature at a location.
    
    Args:
        location: The location to get the temperature for, in the format "City, Country"
    Returns:
        The current temperature at the specified location in the specified units, as a float.
    """
    return 22.  # A real function should probably actually get the temperature!
# Next, create a chat and apply the chat template
messages = [
  {"role": "system", "content": "You are a bot that responds to weather queries."},
  {"role": "user", "content": "Hey, what's the temperature in Paris right now?"}
]
inputs = tokenizer.apply_chat_template(messages, tools=[get_current_temperature], add_generation_prompt=True)
```

You can then generate text from this input as normal. If the model generates a tool call, you should add it to the chat like so:

```python
tool_call = {"name": "get_current_temperature", "arguments": {"location": "Paris, France"}}
messages.append({"role": "assistant", "tool_calls": [{"type": "function", "function": tool_call}]})
```

and then call the tool and append the result, with the `tool` role, like so:

```python
messages.append({"role": "tool", "name": "get_current_temperature", "content": "22.0"})
```

After that, you can `generate()` again to let the model use the tool result in the chat. Note that this was a very brief introduction to tool calling - for more information,
see the [LLaMA prompt format docs](https://llama.meta.com/docs/model-cards-and-prompt-formats/llama3_1/) and the Transformers [tool use documentation](https://huggingface.co/docs/transformers/main/chat_templating#advanced-tool-use--function-calling).


### Use with `llama`

Please, follow the instructions in the [repository](https://github.com/meta-llama/llama)

To download Original checkpoints, see the example command below leveraging `huggingface-cli`:

```
huggingface-cli download meta-llama/Meta-Llama-3.1-8B-Instruct --include "original/*" --local-dir Meta-Llama-3.1-8B-Instruct
```