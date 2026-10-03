
from backend.app.db.models import AppSettings
from backend.app.services.ai_base import BaseAIClient
from backend.app.services.ai_factory import create_ai_client
from backend.app.services.llamacpp import LlamaCppClient
from backend.app.services.ollama import OllamaClient


def test_create_ai_client_ollama():
    settings = AppSettings(
        ai_backend="ollama",
        ollama_url="http://my-ollama:11434",
        ollama_timeout=120,
        ollama_api_key="ollama-secret",
        ollama_temperature=0.7,
        ollama_context_size=8192,
        ollama_extra_params='{"top_k": 40}',
    )

    client = create_ai_client(settings)
    assert isinstance(client, OllamaClient)
    assert isinstance(client, BaseAIClient)
    assert client.base_url == "http://my-ollama:11434"
    assert client.timeout == 120.0
    assert client.api_key == "ollama-secret"
    assert client.temperature == 0.7
    assert client.context_size == 8192
    assert client.extra_params == {"top_k": 40}


def test_create_ai_client_llamacpp():
    settings = AppSettings(
        ai_backend="llamacpp",
        llamacpp_url="http://my-llamacpp:8080",
        llamacpp_timeout=60,
        llamacpp_api_key="Bearer llama-token",
        llamacpp_temperature=0.2,
        llamacpp_max_tokens=2048,
        llamacpp_extra_params='{"top_p": 0.9}',
    )

    client = create_ai_client(settings)
    assert isinstance(client, LlamaCppClient)
    assert isinstance(client, BaseAIClient)
    assert client.base_url == "http://my-llamacpp:8080"
    assert client.timeout == 60.0
    assert client.api_key == "Bearer llama-token"
    assert client.temperature == 0.2
    assert client.max_tokens == 2048
    assert client.extra_params == {"top_p": 0.9}


def test_base_ai_client_headers():
    client_no_key = OllamaClient(base_url="http://localhost:11434")
    assert client_no_key._get_headers() == {}

    client_plain_key = OllamaClient(base_url="http://localhost:11434", api_key="secret")
    assert client_plain_key._get_headers() == {"Authorization": "Bearer secret"}

    client_bearer_key = OllamaClient(base_url="http://localhost:11434", api_key="Bearer custom")
    assert client_bearer_key._get_headers() == {"Authorization": "Bearer custom"}


def test_base_ai_client_filter_extra_params():
    client = OllamaClient(
        base_url="http://localhost:11434",
        extra_params={"prompt": "bad", "format": "bad", "top_k": 40, "seed": 42},
    )
    filtered = client._filter_extra_params()
    assert "prompt" not in filtered
    assert "format" not in filtered
    assert filtered == {"top_k": 40, "seed": 42}
