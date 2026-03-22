from unittest.mock import AsyncMock

import pytest

from backend.ollama_client import OllamaClient


@pytest.fixture
def ollama_client():
    return OllamaClient(base_url="http://test_ollama:11434")

def test_ollama_client_init(ollama_client):
    assert ollama_client.base_url == "http://test_ollama:11434"

@pytest.mark.asyncio
async def test_generate_completion(mocker, ollama_client):
    mock_response = mocker.Mock()
    mock_response.json.return_value = {"response": "This is a completion"}
    mock_response.raise_for_status = mocker.Mock()

    mock_client_instance = AsyncMock()
    mock_client_instance.post.return_value = mock_response
    mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client_instance)

    response_text = await ollama_client.generate_completion(
        model="llama3",
        prompt="Tell me a joke",
        system="You are an assistant"
    )

    # Verify standard request payload to Ollama
    mock_client_instance.post.assert_called_once_with(
        "http://test_ollama:11434/api/generate",
        json={
            "model": "llama3",
            "prompt": "Tell me a joke",
            "system": "You are an assistant",
            "stream": False
        }
    )
    assert response_text == "This is a completion"

@pytest.mark.asyncio
async def test_get_models(mocker, ollama_client):
    mock_response = mocker.Mock()
    mock_response.json.return_value = {"models": [{"name": "llama3"}]}
    mock_response.raise_for_status = mocker.Mock()

    mock_client_instance = AsyncMock()
    mock_client_instance.get.return_value = mock_response
    mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client_instance)

    models = await ollama_client.get_models()
    assert len(models) == 1
    assert models[0]["name"] == "llama3"
