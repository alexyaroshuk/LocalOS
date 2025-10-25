Description

Memory management tool with various sub-commands for memory block operations.

Examples:
# List all memory blocks
memory(agent_state, "view", path="/memories")

Code


Download

Copy
    # View specific memory block content
    memory(agent_state, "view", path="/memories/user_preferences")

    # View first 10 lines of a memory block
    memory(agent_state, "view", path="/memories/user_preferences", view_range=10)

    # Replace text in a memory block
    memory(agent_state, "str_replace", path="/memories/user_preferences", old_str="theme: dark", new_str="theme: light")

    # Insert text at line 5
    memory(agent_state, "insert", path="/memories/notes", insert_line=5, insert_text="New note here")

    # Delete a memory block
    memory(agent_state, "delete", path="/memories/old_notes")

    # Rename a memory block
    memory(agent_state, "rename", old_path="/memories/temp", new_path="/memories/permanent")

    # Update the description of a memory block
    memory(agent_state, "rename", path="/memories/temp", description="The user's temporary notes.")

    # Create a memory block with starting text
    memory(agent_state, "create", path="/memories/coding_preferences", "description": "The user's coding preferences.", "file_text": "The user seems to add type hints to all of their Python code.")

    # Create an empty memory block
    memory(agent_state, "create", path="/memories/coding_preferences", "description": "The user's coding preferences.")
    # View specific memory block content
    memory(agent_state, "view", path="/memories/user_preferences")

    # View first 10 lines of a memory block
    memory(agent_state, "view", path="/memories/user_preferences", view_range=10)

    # Replace text in a memory block
    memory(agent_state, "str_replace", path="/memories/user_preferences", old_str="theme: dark", new_str="theme: light")

    # Insert text at line 5
    memory(agent_state, "insert", path="/memories/notes", insert_line=5, insert_text="New note here")

    # Delete a memory block
    memory(agent_state, "delete", path="/memories/old_notes")

    # Rename a memory block
    memory(agent_state, "rename", old_path="/memories/temp", new_path="/memories/permanent")

    # Update the description of a memory block
    memory(agent_state, "rename", path="/memories/temp", description="The user's temporary notes.")

    # Create a memory block with starting text
    memory(agent_state, "create", path="/memories/coding_preferences", "description": "The user's coding preferences.", "file_text": "The user seems to add type hints to all of their Python code.")

    # Create an empty memory block
    memory(agent_state, "create", path="/memories/coding_preferences", "description": "The user's coding preferences.")
Type

letta_memory_core