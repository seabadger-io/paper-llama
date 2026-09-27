import logging

import httpx

logger = logging.getLogger(__name__)


RESERVED_KEYS = {
    "model",
    "messages",
    "prompt",
    "system",
    "stream",
    "response_format",
    "images",
}


class LlamaCppClient:
    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        timeout: float = 300.0,
        api_key: str | None = None,
        temperature: float = 0.0,
        max_tokens: int | None = None,
        extra_params: dict | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = float(timeout)  # AI generation can be slow
        self.api_key = api_key
        self.temperature = float(temperature) if temperature is not None else 0.0
        self.max_tokens = int(max_tokens) if max_tokens else None
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
        """Fetch available models from the llama.cpp instance."""
        async with httpx.AsyncClient(timeout=self.timeout, headers=self._get_headers()) as client:
            try:
                response = await client.get(f"{self.base_url}/v1/models")
                response.raise_for_status()
                data = response.json()
                # standard OpenAI compatible /v1/models returns {"data": [{"id": "model_id", ...}]}
                models = data.get("data", [])
                # Normalize output to be comparable to ollama client (which often has 'name' key instead of 'id', but we will expose 'id')
                for m in models:
                    if "name" not in m and "id" in m:
                        m["name"] = m["id"]
                return models
            except Exception as e:
                logger.error(f"Failed to fetch llama.cpp models: {e}")
                raise

    async def generate_completion(
        self,
        model: str,
        prompt: str,
        system: str = "",
        images: list[str] | None = None,
        return_usage: bool = False,
    ) -> str | tuple[str, dict | None]:
        """Send a prompt to llama.cpp and receive the generated text (and optionally token usage).

        images: optional list of base64-encoded image strings for vision models.
                They are embedded using the OpenAI vision message format.
        """
        messages = []
        if system:
            messages.append({"role": "system", "content": system})

        if images:
            # OpenAI vision format: content is a list of content parts
            content_parts = [{"type": "text", "text": prompt}]
            for img_b64 in images:
                content_parts.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"},
                    }
                )
            messages.append({"role": "user", "content": content_parts})
        else:
            messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "temperature": self.temperature,
            "response_format": {"type": "json_object"},
        }
        if self.max_tokens:
            payload["max_tokens"] = self.max_tokens

        if self.extra_params:
            safe_extra = {k: v for k, v in self.extra_params.items() if k not in RESERVED_KEYS}
            payload.update(safe_extra)

        async with httpx.AsyncClient(timeout=self.timeout, headers=self._get_headers()) as client:
            try:
                response = await client.post(f"{self.base_url}/v1/chat/completions", json=payload)
                response.raise_for_status()
                data = response.json()

                token_usage = None
                usage = data.get("usage")
                if isinstance(usage, dict):
                    prompt_tokens = usage.get("prompt_tokens")
                    completion_tokens = usage.get("completion_tokens")
                    total_tokens = usage.get("total_tokens")
                    reasoning_tokens = None
                    if isinstance(usage.get("completion_tokens_details"), dict):
                        reasoning_tokens = usage["completion_tokens_details"].get("reasoning_tokens")
                    if reasoning_tokens is None:
                        reasoning_tokens = usage.get("reasoning_tokens")

                    if prompt_tokens is not None or completion_tokens is not None or total_tokens is not None:
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
                    logger.debug(f"Llama.cpp token usage: {token_usage}")

                choices = data.get("choices", [])
                content = choices[0].get("message", {}).get("content", "") if choices else ""
                if return_usage:
                    return content, token_usage
                return content
            except Exception as e:
                err_msg = str(e) or type(e).__name__
                logger.error(f"Failed to generate llama.cpp completion: {err_msg}")
                raise Exception(err_msg) from e

