import logging
from abc import ABC, abstractmethod
from typing import Any

from ..core.constants import RESERVED_AI_PARAMS as RESERVED_KEYS

logger = logging.getLogger(__name__)


class BaseAIClient(ABC):
    """Abstract base class for LLM backend clients (Ollama, Llama.cpp, etc.)."""

    def __init__(
        self,
        base_url: str,
        timeout: float = 300.0,
        api_key: str | None = None,
        temperature: float = 0.0,
        extra_params: dict | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = float(timeout)
        self.api_key = api_key
        self.temperature = float(temperature) if temperature is not None else 0.0
        self.extra_params = extra_params or {}
        self.last_usage: dict | None = None

    def _get_headers(self) -> dict[str, str]:
        """Normalize authentication headers."""
        if not self.api_key:
            return {}
        token = self.api_key.strip()
        if token.lower().startswith("bearer "):
            return {"Authorization": token}
        return {"Authorization": f"Bearer {token}"}

    def _filter_extra_params(self) -> dict[str, Any]:
        """Filter out reserved system keys from custom extra parameters."""
        if not self.extra_params:
            return {}
        return {k: v for k, v in self.extra_params.items() if k not in RESERVED_KEYS}

    def _build_usage_dict(
        self,
        prompt_tokens: int | None,
        completion_tokens: int | None,
        total_tokens: int | None = None,
        reasoning_tokens: int | None = None,
    ) -> dict | None:
        """Construct standard token usage dictionary."""
        if prompt_tokens is not None or completion_tokens is not None:
            if total_tokens is None:
                total_tokens = (prompt_tokens or 0) + (completion_tokens or 0)
            return {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "reasoning_tokens": reasoning_tokens,
            }
        return None

    @abstractmethod
    async def get_models(self) -> list[dict]:
        """Fetch available models from the backend."""
        pass

    @abstractmethod
    async def generate_completion(
        self,
        model: str,
        prompt: str,
        system: str = "",
        images: list[str] | None = None,
        return_usage: bool = False,
    ) -> str | tuple[str, dict | None]:
        """Send a prompt and receive generated text (and optionally token usage)."""
        pass
