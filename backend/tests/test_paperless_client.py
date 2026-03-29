from unittest.mock import AsyncMock

import pytest

from backend.app.services.paperless import PaperlessClient


@pytest.fixture
def paperless_client():
    return PaperlessClient(base_url="http://test_paperless:8000", token="test_token")

def test_paperless_client_init(paperless_client):
    assert paperless_client.base_url == "http://test_paperless:8000"
    assert paperless_client.headers["Authorization"] == "Token test_token"
    assert paperless_client.headers["Accept"] == "application/json"

@pytest.mark.asyncio
async def test_get_paperless(mocker, paperless_client):
    mock_response = mocker.Mock()
    mock_response.json.return_value = {"results": [{"id": 1, "name": "tag1"}]}
    mock_response.raise_for_status = mocker.Mock()

    mock_client_instance = AsyncMock()
    mock_client_instance.get.return_value = mock_response

    # We need to mock httpx.AsyncClient itself to return our mock_client_instance when used as a context manager
    mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client_instance)

    data = await paperless_client._get("tags/")

    # Verify httpx client was called with correct parameters
    mock_client_instance.get.assert_called_once_with(
        "http://test_paperless:8000/api/tags/",
        headers=paperless_client.headers,
        params=None
    )
    assert "results" in data

@pytest.mark.asyncio
async def test_get_all_paginated(mocker, paperless_client):
    mock_response_1 = mocker.Mock()
    mock_response_1.json.return_value = {
        "results": [{"id": 1, "name": "tag1"}],
        "next": "http://test_paperless:8000/api/tags/?page=2"
    }
    mock_response_1.raise_for_status = mocker.Mock()

    mock_response_2 = mocker.Mock()
    mock_response_2.json.return_value = {
        "results": [{"id": 2, "name": "tag2"}],
        "next": None
    }
    mock_response_2.raise_for_status = mocker.Mock()

    mock_client_instance = AsyncMock()
    # The first call gets response 1, the second gets response 2
    mock_client_instance.get.side_effect = [mock_response_1, mock_response_2]

    mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client_instance)

    results = await paperless_client._get_all("tags/")

    assert len(results) == 2
    assert results[0]["id"] == 1
    assert results[1]["id"] == 2
    assert mock_client_instance.get.call_count == 2

@pytest.mark.asyncio
async def test_patch_document(mocker, paperless_client):
    mock_response = mocker.Mock()
    mock_response.json.return_value = {"id": 123, "title": "Updated Title"}
    mock_response.raise_for_status = mocker.Mock()

    mock_client_instance = AsyncMock()
    mock_client_instance.patch.return_value = mock_response
    mocker.patch("httpx.AsyncClient.__aenter__", return_value=mock_client_instance)

    response = await paperless_client.update_document(
        document_id=123,
        title="Updated Title",
        tags=[1, 2]
    )

    mock_client_instance.patch.assert_called_once_with(
        "http://test_paperless:8000/api/documents/123/",
        headers=paperless_client.headers,
        json={"title": "Updated Title", "tags": [1, 2]}
    )
    assert response["title"] == "Updated Title"
