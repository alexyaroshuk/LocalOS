Description

The memory_insert command allows you to insert text at a specific location in a memory block.

Examples:
# Update a block containing information about the user (append to the end of the block)
memory_insert(label="customer", new_str="The customer's ticket number is 12345")

Code


Download

Copy
    # Update a block containing information about the user (insert at the beginning of the block)
    memory_insert(label="customer", new_str="The customer's ticket number is 12345", insert_line=0)

Returns:
    Optional[str]: None is always returned as this function does not produce a response.
    # Update a block containing information about the user (insert at the beginning of the block)
    memory_insert(label="customer", new_str="The customer's ticket number is 12345", insert_line=0)

Returns:
    Optional[str]: None is always returned as this function does not produce a response.
Type

letta_sleeptime_core