# Provide an event loop fixture for pytest-asyncio to avoid ScopeMismatch errors when testing module-scoped fixtures
import asyncio

import pytest


@pytest.fixture(scope="session")
def event_loop():
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_httpx_client(mocker):
    """Mocks the httpx.AsyncClient to avoid making actual HTTP requests during tests."""
    mock_client = mocker.AsyncMock()
    mocker.patch("httpx.AsyncClient", return_value=mock_client)
    return mock_client
