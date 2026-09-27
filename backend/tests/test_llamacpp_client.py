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
            "response_format": {"type": "json_object"},
        },
    )
    assert response_text == "This is a completion"


@pytest.mark.asyncio
async def test_generate_completion_with_custom_options(mocker):
    client = LlamaCppClient(
        base_url="http://test_llamacpp:8080",
        temperature=0.8,
        max_tokens=2048,
        extra_params={"top_k": 40, "model": "override_attempt"},
    )
    mock_response = mocker.Mock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "Custom llama completion"}}]
    }
    mock_response.raise_for_status = mocker.Mock()

    mock_client_instance = AsyncMock()
    mock_client_instance.post.return_value = mock_response
    mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client_instance)

    response_text = await client.generate_completion(model="llama3", prompt="Hello")

    # model in extra_params should be filtered out from top-level payload
    mock_client_instance.post.assert_called_once_with(
        "http://test_llamacpp:8080/v1/chat/completions",
        json={
            "model": "llama3",
            "messages": [{"role": "user", "content": "Hello"}],
            "stream": False,
            "temperature": 0.8,
            "response_format": {"type": "json_object"},
            "max_tokens": 2048,
            "top_k": 40,
        },
    )
    assert response_text == "Custom llama completion"


@pytest.mark.asyncio
async def test_generate_completion_token_usage(mocker, llamacpp_client):
    mock_response = mocker.Mock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "Llama joke"}}],
        "usage": {
            "prompt_tokens": 120,
            "completion_tokens": 45,
            "total_tokens": 165,
            "completion_tokens_details": {"reasoning_tokens": 15},
        },
    }
    mock_response.raise_for_status = mocker.Mock()

    mock_client_instance = AsyncMock()
    mock_client_instance.post.return_value = mock_response
    mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client_instance)

    text, usage = await llamacpp_client.generate_completion(
        model="llama3", prompt="Tell me a joke", return_usage=True
    )
    assert text == "Llama joke"
    assert usage == {
        "prompt_tokens": 120,
        "completion_tokens": 45,
        "total_tokens": 165,
        "reasoning_tokens": 15,
    }
    assert llamacpp_client.last_usage == usage



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


def test_llamacpp_headers():
    client_no_key = LlamaCppClient()
    assert client_no_key._get_headers() == {}

    client_with_key = LlamaCppClient(api_key="my-secret-key")
    assert client_with_key._get_headers() == {"Authorization": "Bearer my-secret-key"}

    client_bearer_key = LlamaCppClient(api_key="Bearer custom-token")
    assert client_bearer_key._get_headers() == {"Authorization": "Bearer custom-token"}


@pytest.mark.asyncio
async def test_llamacpp_passes_auth_header_to_client(mocker):
    client = LlamaCppClient(base_url="http://test:8080", api_key="secret-key")

    mock_response = mocker.Mock()
    mock_response.json.return_value = {"data": []}
    mock_response.raise_for_status = mocker.Mock()

    mock_client_instance = AsyncMock()
    mock_client_instance.get.return_value = mock_response

    mock_async_client = mocker.patch("httpx.AsyncClient")
    mock_async_client.return_value.__aenter__.return_value = mock_client_instance

    await client.get_models()

    mock_async_client.assert_called_once_with(
        timeout=300.0,
        headers={"Authorization": "Bearer secret-key"},
    )

