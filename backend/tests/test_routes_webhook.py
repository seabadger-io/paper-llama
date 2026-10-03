from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import BackgroundTasks, HTTPException, Request

from backend.app.api.endpoints.webhook import paperless_webhook
from backend.app.db.models import AppSettings


class MockDB:
    def __init__(self, settings_return):
        self.settings_return = settings_return

    async def execute(self, query):
        res = MagicMock()
        res.scalar_one_or_none.return_value = self.settings_return
        return res


def make_mock_request(headers=None, query_params=None):
    mock_request = AsyncMock(spec=Request)
    mock_request.headers = headers or {}
    mock_request.query_params = query_params or {}
    mock_request.json.return_value = {"document_id": 123}
    return mock_request


@pytest.mark.asyncio
async def test_paperless_webhook_queues_workflow_when_no_tokens_configured():
    mock_request = make_mock_request()
    mock_bg_tasks = AsyncMock(spec=BackgroundTasks)
    mock_db = MockDB(AppSettings(webhook_tokens=""))

    response = await paperless_webhook(
        request=mock_request, background_tasks=mock_bg_tasks, db=mock_db
    )

    assert response == {"status": "queued", "message": "Workflow trigger queued."}
    assert mock_bg_tasks.add_task.call_count == 1
    call_args, call_kwargs = mock_bg_tasks.add_task.call_args
    assert call_kwargs.get("from_webhook") is True


@pytest.mark.asyncio
async def test_paperless_webhook_with_valid_x_webhook_token_header():
    mock_request = make_mock_request(headers={"X-Webhook-Token": "secret123"})
    mock_bg_tasks = AsyncMock(spec=BackgroundTasks)
    mock_db = MockDB(AppSettings(webhook_tokens="secret123"))

    response = await paperless_webhook(
        request=mock_request, background_tasks=mock_bg_tasks, db=mock_db
    )

    assert response == {"status": "queued", "message": "Workflow trigger queued."}
    assert mock_bg_tasks.add_task.call_count == 1


@pytest.mark.asyncio
async def test_paperless_webhook_with_valid_authorization_bearer_header():
    mock_request = make_mock_request(headers={"Authorization": "Bearer secret123"})
    mock_bg_tasks = AsyncMock(spec=BackgroundTasks)
    mock_db = MockDB(AppSettings(webhook_tokens="secret123"))

    response = await paperless_webhook(
        request=mock_request, background_tasks=mock_bg_tasks, db=mock_db
    )

    assert response == {"status": "queued", "message": "Workflow trigger queued."}
    assert mock_bg_tasks.add_task.call_count == 1


@pytest.mark.asyncio
async def test_paperless_webhook_with_valid_query_param():
    mock_request = make_mock_request(query_params={"token": "secret123"})
    mock_bg_tasks = AsyncMock(spec=BackgroundTasks)
    mock_db = MockDB(AppSettings(webhook_tokens="secret123"))

    response = await paperless_webhook(
        request=mock_request, background_tasks=mock_bg_tasks, db=mock_db
    )

    assert response == {"status": "queued", "message": "Workflow trigger queued."}
    assert mock_bg_tasks.add_task.call_count == 1


@pytest.mark.asyncio
async def test_paperless_webhook_with_multiple_comma_separated_tokens():
    mock_bg_tasks = AsyncMock(spec=BackgroundTasks)
    mock_db = MockDB(AppSettings(webhook_tokens="token1, token2, token3"))

    # Verify second token matches
    mock_request = make_mock_request(headers={"X-Webhook-Token": "token2"})
    response = await paperless_webhook(
        request=mock_request, background_tasks=mock_bg_tasks, db=mock_db
    )
    assert response == {"status": "queued", "message": "Workflow trigger queued."}

    # Verify third token matches via query param
    mock_request3 = make_mock_request(query_params={"token": "token3"})
    response3 = await paperless_webhook(
        request=mock_request3, background_tasks=mock_bg_tasks, db=mock_db
    )
    assert response3 == {"status": "queued", "message": "Workflow trigger queued."}


@pytest.mark.asyncio
async def test_paperless_webhook_missing_token_raises_401():
    mock_request = make_mock_request()
    mock_bg_tasks = AsyncMock(spec=BackgroundTasks)
    mock_db = MockDB(AppSettings(webhook_tokens="required_token"))

    with pytest.raises(HTTPException) as exc_info:
        await paperless_webhook(
            request=mock_request, background_tasks=mock_bg_tasks, db=mock_db
        )

    assert exc_info.value.status_code == 401
    assert "Invalid or missing webhook token" in exc_info.value.detail
    assert mock_bg_tasks.add_task.call_count == 0


@pytest.mark.asyncio
async def test_paperless_webhook_invalid_token_raises_401():
    mock_request = make_mock_request(headers={"X-Webhook-Token": "wrong_token"})
    mock_bg_tasks = AsyncMock(spec=BackgroundTasks)
    mock_db = MockDB(AppSettings(webhook_tokens="valid_token_1, valid_token_2"))

    with pytest.raises(HTTPException) as exc_info:
        await paperless_webhook(
            request=mock_request, background_tasks=mock_bg_tasks, db=mock_db
        )

    assert exc_info.value.status_code == 401
    assert "Invalid or missing webhook token" in exc_info.value.detail
    assert mock_bg_tasks.add_task.call_count == 0
