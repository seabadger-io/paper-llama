import logging

import httpx

logger = logging.getLogger(__name__)


class OllamaClient:
    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        timeout: float = 300.0,
        api_key: str | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = float(timeout)  # AI generation can be slow
        self.api_key = api_key

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
        self, model: str, prompt: str, system: str = "", images: list[str] | None = None
    ) -> str:
        """Send a prompt to Ollama and receive the generated text.

        images: optional list of base64-encoded image strings for vision models.
        """
        payload = {
            "model": model,
            "prompt": prompt,
            "system": system,
            "stream": False,
            "format": "json",
        }
        if images:
            payload["images"] = images

        async with httpx.AsyncClient(timeout=self.timeout, headers=self._get_headers()) as client:
            try:
                response = await client.post(f"{self.base_url}/api/generate", json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("response", "")
            except Exception as e:
                err_msg = str(e) or type(e).__name__
                logger.error(f"Failed to generate Ollama completion: {err_msg}")
                raise Exception(err_msg) from e
