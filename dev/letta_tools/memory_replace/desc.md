Description

The memory_replace command allows you to replace a specific string in a memory block with a new string. This is used for making precise edits.

Do NOT attempt to replace long strings, e.g. do not attempt to replace the entire contents of a memory block with a new string.

Examples:
# Update a block containing information about the user
memory_replace(label="human", old_str="Their name is Alice", new_str="Their name is Bob")

Code


Download

Copy
    # Update a block containing a todo list
    memory_replace(label="todos", old_str="- [ ] Step 5: Search the web", new_str="- [x] Step 5: Search the web")

    # Pass an empty string to
    memory_replace(label="human", old_str="Their name is Alice", new_str="")

    # Bad example - do NOT add (view-only) line numbers to the args
    memory_replace(label="human", old_str="1: Their name is Alice", new_str="1: Their name is Bob")

    # Bad example - do NOT include the line number warning either
    memory_replace(label="human", old_str="# NOTE: Line numbers shown below (with arrows like '1→') are to help during editing. Do NOT include line number prefixes in your memory edit tool calls.
    # Update a block containing a todo list
    memory_replace(label="todos", old_str="- [ ] Step 5: Search the web", new_str="- [x] Step 5: Search the web")

    # Pass an empty string to
    memory_replace(label="human", old_str="Their name is Alice", new_str="")

    # Bad example - do NOT add (view-only) line numbers to the args
    memory_replace(label="human", old_str="1: Their name is Alice", new_str="1: Their name is Bob")

    # Bad example - do NOT include the line number warning either
    memory_replace(label="human", old_str="# NOTE: Line numbers shown below (with arrows like '1→') are to help during editing. Do NOT include line number prefixes in your memory edit tool calls.
1→ Their name is Alice", new_str="1→ Their name is Bob")

Code


Download

Copy
    # Good example - no line numbers or line number warning (they are view-only), just the text
    memory_replace(label="human", old_str="Their name is Alice", new_str="Their name is Bob")

Returns:
    str: The success message
    # Good example - no line numbers or line number warning (they are view-only), just the text
    memory_replace(label="human", old_str="Their name is Alice", new_str="Their name is Bob")

Returns:
    str: The success message
Type

letta_sleeptime_core