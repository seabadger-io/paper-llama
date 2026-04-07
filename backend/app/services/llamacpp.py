import logging

import httpx

logger = logging.getLogger(__name__)


class LlamaCppClient:
    def __init__(self, base_url: str = "http://localhost:8080", timeout: float = 300.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = float(timeout)  # AI generation can be slow

    async def get_models(self) -> list[dict]:
        """Fetch available models from the llama.cpp instance."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
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
        self, model: str, prompt: str, system: str = "", images: list[str] | None = None
    ) -> str:
        """Send a prompt to llama.cpp and receive the generated text.

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
            "temperature": 0.0,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(f"{self.base_url}/v1/chat/completions", json=payload)
                response.raise_for_status()
                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    return ""
                return choices[0].get("message", {}).get("content", "")
            except Exception as e:
                err_msg = str(e) or type(e).__name__
                logger.error(f"Failed to generate llama.cpp completion: {err_msg}")
                raise Exception(err_msg) from e
