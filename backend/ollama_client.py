import logging

import httpx

logger = logging.getLogger(__name__)

class OllamaClient:
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url.rstrip('/')
        self.timeout = 240.0 # AI generation can be slow

    async def get_models(self) -> list[dict]:
        """Fetch available models from the Ollama instance."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                data = response.json()
                return data.get("models", [])
            except Exception as e:
                logger.error(f"Failed to fetch Ollama models: {e}")
                raise

    async def generate_completion(self, model: str, prompt: str, system: str = "") -> str:
        """Send a prompt to Ollama and receive the generated text."""
        payload = {
            "model": model,
            "prompt": prompt,
            "system": system,
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", "")
            except Exception as e:
                logger.error(f"Failed to generate Ollama completion: {e}")
                raise
