import json
import logging

from ..db.models import AppSettings
from .ai_base import BaseAIClient
from .llamacpp import LlamaCppClient
from .ollama import OllamaClient

logger = logging.getLogger(__name__)


def create_ai_client(settings: AppSettings) -> BaseAIClient:
    """
    Factory function to instantiate the active AI backend client based on settings.
    Avoids instantiating both clients when only one is used.
    """
    ai_backend = (getattr(settings, "ai_backend", None) or "ollama").lower()

    if ai_backend == "llamacpp":
        extra_params = None
        raw_extra = getattr(settings, "llamacpp_extra_params", None)
        if raw_extra:
            try:
                extra_params = json.loads(raw_extra) if isinstance(raw_extra, str) else raw_extra
            except Exception as e:
                logger.warning(f"Failed to parse llamacpp_extra_params: {e}")

        return LlamaCppClient(
            base_url=getattr(settings, "llamacpp_url", None) or "http://localhost:8080",
            timeout=float(getattr(settings, "llamacpp_timeout", None) or 300),
            api_key=getattr(settings, "llamacpp_api_key", None),
            temperature=float(getattr(settings, "llamacpp_temperature", None) or 0.0),
            max_tokens=getattr(settings, "llamacpp_max_tokens", None),
            extra_params=extra_params,
        )
    else:
        extra_params = None
        raw_extra = getattr(settings, "ollama_extra_params", None)
        if raw_extra:
            try:
                extra_params = json.loads(raw_extra) if isinstance(raw_extra, str) else raw_extra
            except Exception as e:
                logger.warning(f"Failed to parse ollama_extra_params: {e}")

        return OllamaClient(
            base_url=getattr(settings, "ollama_url", None) or "http://localhost:11434",
            timeout=float(getattr(settings, "ollama_timeout", None) or 300),
            api_key=getattr(settings, "ollama_api_key", None),
            temperature=float(getattr(settings, "ollama_temperature", None) or 0.0),
            context_size=getattr(settings, "ollama_context_size", None),
            extra_params=extra_params,
        )
