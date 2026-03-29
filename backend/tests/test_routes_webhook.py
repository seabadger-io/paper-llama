from unittest.mock import AsyncMock

import pytest
from fastapi import BackgroundTasks, Request

from backend.app.api.endpoints.webhook import paperless_webhook


@pytest.mark.asyncio
async def test_paperless_webhook_queues_workflow():
    mock_request = AsyncMock(spec=Request)
    mock_request.json.return_value = {"document_id": 123}

    mock_bg_tasks = AsyncMock(spec=BackgroundTasks)

    # We patch trigger_workflow instead of evaluating it here, so we just capture the task addition
    response = await paperless_webhook(request=mock_request, background_tasks=mock_bg_tasks)

    assert response == {"status": "queued", "message": "Workflow trigger queued."}

    # Verify the background task was added
    assert mock_bg_tasks.add_task.call_count == 1

    # Check that from_webhook=True was passed natively
    # (since the implementation is background_tasks.add_task(trigger_workflow, from_webhook=True))
    call_args, call_kwargs = mock_bg_tasks.add_task.call_args
    assert call_kwargs.get("from_webhook") is True
