from unittest.mock import AsyncMock

import pytest

from backend.app.services.llamacpp import LlamaCppClient


@pytest.fixture
def llamacpp_client():
    return LlamaCppClient(base_url="http://test_llamacpp:8080")


def test_llamacpp_client_init(llamacpp_client):
    assert llamacpp_client.base_url == "http://test_llamacpp:8080"


@pytest.mark.asyncio
async def test_generate_completion(mocker, llamacpp_client):
    mock_response = mocker.Mock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "This is a completion"}}]
    }
    mock_response.raise_for_status = mocker.Mock()

    mock_client_instance = AsyncMock()
    mock_client_instance.post.return_value = mock_response
    mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client_instance)

    response_text = await llamacpp_client.generate_completion(
        model="llama3", prompt="Tell me a joke", system="You are an assistant"
    )

    mock_client_instance.post.assert_called_once_with(
        "http://test_llamacpp:8080/v1/chat/completions",
        json={
            "model": "llama3",
            "messages": [
                {"role": "system", "content": "You are an assistant"},
                {"role": "user", "content": "Tell me a joke"},
            ],
            "stream": False,
            "temperature": 0.0,
        },
    )
    assert response_text == "This is a completion"


@pytest.mark.asyncio
async def test_get_models(mocker, llamacpp_client):
    mock_response = mocker.Mock()
    mock_response.json.return_value = {"data": [{"id": "llama3"}]}
    mock_response.raise_for_status = mocker.Mock()

    mock_client_instance = AsyncMock()
    mock_client_instance.get.return_value = mock_response
    mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client_instance)

    models = await llamacpp_client.get_models()
    assert len(models) == 1
    assert models[0]["name"] == "llama3"
