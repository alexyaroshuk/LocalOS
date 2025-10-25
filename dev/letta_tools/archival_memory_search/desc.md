Description

Search archival memory using semantic (embedding-based) search with optional temporal filtering.

Examples:
# Search all passages
archival_memory_search(query="project updates")

Code


Download

Copy
    # Search with date range (inclusive of both dates)
    archival_memory_search(query="meetings", start_datetime="2024-01-15", end_datetime="2024-01-20")
    # This includes all passages from Jan 15 00:00:00 through Jan 20 23:59:59

    # Search passages from a specific day (inclusive)
    archival_memory_search(query="bug reports", start_datetime="2024-09-04", end_datetime="2024-09-04")
    # This includes ALL passages from September 4, 2024

    # Search with specific time range
    archival_memory_search(query="error logs", start_datetime="2024-01-15T09:30", end_datetime="2024-01-15T17:30")
    # This includes passages from 9:30 AM to 5:30 PM on Jan 15

    # Search from a specific point in time onwards
    archival_memory_search(query="customer feedback", start_datetime="2024-01-15T14:00")

Returns:
    str: Query result string containing matching passages with timestamps and content.
    # Search with date range (inclusive of both dates)
    archival_memory_search(query="meetings", start_datetime="2024-01-15", end_datetime="2024-01-20")
    # This includes all passages from Jan 15 00:00:00 through Jan 20 23:59:59

    # Search passages from a specific day (inclusive)
    archival_memory_search(query="bug reports", start_datetime="2024-09-04", end_datetime="2024-09-04")
    # This includes ALL passages from September 4, 2024

    # Search with specific time range
    archival_memory_search(query="error logs", start_datetime="2024-01-15T09:30", end_datetime="2024-01-15T17:30")
    # This includes passages from 9:30 AM to 5:30 PM on Jan 15

    # Search from a specific point in time onwards
    archival_memory_search(query="customer feedback", start_datetime="2024-01-15T14:00")

Returns:
    str: Query result string containing matching passages with timestamps and content.
Type

letta_core