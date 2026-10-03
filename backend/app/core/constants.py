"""Application-wide constants."""

RESERVED_AI_PARAMS: frozenset[str] = frozenset(
    {
        "model",
        "prompt",
        "system",
        "stream",
        "format",
        "images",
        "messages",
        "response_format",
    }
)
