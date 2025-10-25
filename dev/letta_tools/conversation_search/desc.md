Description

Search prior conversation history using hybrid search (text + semantic similarity).

Examples:
# Search all messages
conversation_search(query="project updates")

Code


Download

Copy
    # Search only assistant messages
    conversation_search(query="error handling", roles=["assistant"])

    # Search with date range (inclusive of both dates)
    conversation_search(query="meetings", start_date="2024-01-15", end_date="2024-01-20")
    # This includes all messages from Jan 15 00:00:00 through Jan 20 23:59:59

    # Search messages from a specific day (inclusive)
    conversation_search(query="bug reports", start_date="2024-09-04", end_date="2024-09-04")
    # This includes ALL messages from September 4, 2024

    # Search with specific time boundaries
    conversation_search(query="deployment", start_date="2024-01-15T09:00", end_date="2024-01-15T17:30")
    # This includes messages from 9 AM to 5:30 PM on Jan 15

    # Search with limit
    conversation_search(query="debugging", limit=10)

Returns:
    str: Query result string containing matching messages with timestamps and content.
    # Search only assistant messages
    conversation_search(query="error handling", roles=["assistant"])

    # Search with date range (inclusive of both dates)
    conversation_search(query="meetings", start_date="2024-01-15", end_date="2024-01-20")
    # This includes all messages from Jan 15 00:00:00 through Jan 20 23:59:59

    # Search messages from a specific day (inclusive)
    conversation_search(query="bug reports", start_date="2024-09-04", end_date="2024-09-04")
    # This includes ALL messages from September 4, 2024

    # Search with specific time boundaries
    conversation_search(query="deployment", start_date="2024-01-15T09:00", end_date="2024-01-15T17:30")
    # This includes messages from 9 AM to 5:30 PM on Jan 15

    # Search with limit
    conversation_search(query="debugging", limit=10)

Returns:
    str: Query result string containing matching messages with timestamps and content.
Type

letta_core