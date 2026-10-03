import logging

import httpx

from ..core.constants import RESERVED_AI_PARAMS as RESERVED_KEYS

logger = logging.getLogger(__name__)


class OllamaClient:
    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        timeout: float = 300.0,
        api_key: str | None = None,
        temperature: float = 0.0,
        context_size: int | None = 4096,
        extra_params: dict | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = float(timeout)  # AI generation can be slow
        self.api_key = api_key
        self.temperature = float(temperature) if temperature is not None else 0.0
        self.context_size = int(context_size) if context_size else None
        self.extra_params = extra_params or {}
        self.last_usage: dict | None = None

    def _get_headers(self) -> dict[str, str]:
        if not self.api_key:
            return {}
        token = self.api_key.strip()
        if token.lower().startswith("bearer "):
            return {"Authorization": token}
        return {"Authorization": f"Bearer {token}"}

    async def get_models(self) -> list[dict]:
        """Fetch available models from the Ollama instance."""
        async with httpx.AsyncClient(timeout=self.timeout, headers=self._get_headers()) as client:
            try:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                data = response.json()
                return data.get("models", [])
            except Exception as e:
                logger.error(f"Failed to fetch Ollama models: {e}")
                raise

    async def generate_completion(
        self,
        model: str,
        prompt: str,
        system: str = "",
        images: list[str] | None = None,
        return_usage: bool = False,
    ) -> str | tuple[str, dict | None]:
        """Send a prompt to Ollama and receive the generated text (and optionally token usage).

        images: optional list of base64-encoded image strings for vision models.
        """
        options: dict = {
            "temperature": self.temperature,
        }
        if self.context_size:
            options["num_ctx"] = self.context_size
        if self.extra_params:
            safe_extra = {k: v for k, v in self.extra_params.items() if k not in RESERVED_KEYS}
            options.update(safe_extra)

        payload = {
            "model": model,
            "prompt": prompt,
            "system": system,
            "stream": False,
            "format": "json",
            "options": options,
        }
        if images:
            payload["images"] = images

        async with httpx.AsyncClient(timeout=self.timeout, headers=self._get_headers()) as client:
            try:
                response = await client.post(f"{self.base_url}/api/generate", json=payload)
                response.raise_for_status()
                data = response.json()

                prompt_tokens = data.get("prompt_eval_count")
                completion_tokens = data.get("eval_count")
                reasoning_tokens = data.get("reasoning_eval_count")
                if reasoning_tokens is None and isinstance(data.get("eval_count_details"), dict):
                    reasoning_tokens = data["eval_count_details"].get("reasoning_tokens")

                token_usage = None
                if prompt_tokens is not None or completion_tokens is not None:
                    total_tokens = data.get("total_tokens")
                    if total_tokens is None:
                        total_tokens = (prompt_tokens or 0) + (completion_tokens or 0)
                    token_usage = {
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "total_tokens": total_tokens,
                    }
                    if reasoning_tokens is not None:
                        token_usage["reasoning_tokens"] = reasoning_tokens

                self.last_usage = token_usage
                if token_usage:
                    logger.debug(f"Ollama token usage: {token_usage}")

                content = data.get("response", "")
                if return_usage:
                    return content, token_usage
                return content
            except Exception as e:
                err_msg = str(e) or type(e).__name__
                logger.error(f"Failed to generate Ollama completion: {err_msg}")
                raise Exception(err_msg) from e

