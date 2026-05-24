from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.app.core.scheduler import _run_processing_cycle
from backend.app.db.models import AppSettings


@pytest.fixture
def mock_settings():
    settings = AppSettings()
    settings.paperless_url = "http://test"
    settings.paperless_token = "token"
    settings.ollama_url = "http://ollama"
    settings.ollama_model = "llama"
    settings.query_tag_id = 999
    return settings


@pytest.mark.asyncio
@patch("backend.app.core.scheduler.AsyncSessionLocal")
@patch("backend.app.core.scheduler.DocumentProcessor")
async def test_run_processing_cycle_halts_on_missing_query_tag(
    mock_document_processor_class, mock_async_session_local, mock_settings
):
    # Setup mock session
    mock_session = AsyncMock()
    mock_async_session_local.return_value.__aenter__.return_value = mock_session

    # Session returns mock_settings on the first query and an empty list on the second
    mock_result_settings = MagicMock()
    mock_result_settings.scalar_one_or_none.return_value = mock_settings

    mock_result_docs = MagicMock()
    mock_result_docs.scalars().all.return_value = []

    mock_session.execute.side_effect = [mock_result_settings, mock_result_docs]

    # Setup mock processor
    mock_processor_instance = AsyncMock()
    mock_document_processor_class.return_value = mock_processor_instance

    # Return system_tags that DO NOT contain our query_tag_id (999)
    mock_processor_instance.get_cached_metadata.return_value = (
        [{"id": 1, "name": "inbox"}],
        [],
        [],
    )

    # Run the cycle
    await _run_processing_cycle()

    # Assertions
    mock_processor_instance.get_cached_metadata.assert_called_once()
    # It should immediately return without querying paperless for documents
    mock_processor_instance.paperless.get_documents.assert_not_called()
    mock_processor_instance.process_document.assert_not_called()


@pytest.mark.asyncio
@patch("backend.app.core.scheduler.AsyncSessionLocal")
@patch("backend.app.core.scheduler.DocumentProcessor")
async def test_run_processing_cycle_reprocesses_stale_docs(
    mock_document_processor_class, mock_async_session_local, mock_settings
):
    from datetime import UTC, datetime, timedelta

    mock_session = AsyncMock()
    mock_async_session_local.return_value.__aenter__.return_value = mock_session

    # 1. Settings result
    mock_result_settings = MagicMock()
    mock_result_settings.scalar_one_or_none.return_value = mock_settings

    # One document is 'processing' but very old (stale)
    # One document is 'processing' and fresh
    stale_time = datetime.now(UTC) - timedelta(minutes=45)
    fresh_time = datetime.now(UTC) - timedelta(minutes=5)

    mock_row_stale = MagicMock()
    mock_row_stale.document_id = 101
    mock_row_stale.status = "processing"
    mock_row_stale.processed_at = stale_time

    mock_row_fresh = MagicMock()
    mock_row_fresh.document_id = 102
    mock_row_fresh.status = "processing"
    mock_row_fresh.processed_at = fresh_time

    mock_result_proc = MagicMock()
    mock_result_proc.all.return_value = [mock_row_stale, mock_row_fresh]

    mock_session.execute.side_effect = [mock_result_settings, mock_result_proc]

    # Setup mock processor
    mock_processor_instance = AsyncMock()
    mock_document_processor_class.return_value = mock_processor_instance
    mock_processor_instance.get_cached_metadata.return_value = (
        [{"id": 999, "name": "query"}],
        [],
        [],
    )

    # Paperless returns both documents
    mock_processor_instance.paperless.get_documents.return_value = [
        {"id": 101, "tags": [999]},
        {"id": 102, "tags": [999]},
    ]

    # Run the cycle
    await _run_processing_cycle()

    # Assertions
    # document 101 (stale) should be processed
    # document 102 (fresh) should be skipped
    mock_processor_instance.process_document.assert_called_once_with(101)


@pytest.mark.asyncio
@patch("backend.app.core.scheduler._run_processing_cycle")
async def test_trigger_workflow_success_resets_is_processing(mock_run_cycle):
    import backend.app.core.scheduler as scheduler_mod

    # Reset states
    scheduler_mod.is_processing = False
    scheduler_mod.processing_queued = False

    mock_run_cycle.return_value = None

    await scheduler_mod.trigger_workflow()

    assert mock_run_cycle.call_count == 1
    assert scheduler_mod.is_processing is False
    assert scheduler_mod.processing_queued is False


@pytest.mark.asyncio
@patch("backend.app.core.scheduler._run_processing_cycle")
async def test_trigger_workflow_resets_is_processing_on_max_retries(mock_run_cycle):
    import backend.app.core.scheduler as scheduler_mod

    # Reset states
    scheduler_mod.is_processing = False
    scheduler_mod.processing_queued = False

    # Make the cycle raise an exception every time
    mock_run_cycle.side_effect = Exception("Processing failed")

    # We also mock asyncio.sleep to avoid waiting 10s between retries
    with patch("backend.app.core.scheduler.asyncio.sleep", AsyncMock()) as mock_sleep:
        await scheduler_mod.trigger_workflow()

        # Verify that run_processing_cycle was called 3 times (max_retries)
        assert mock_run_cycle.call_count == 3
        # Verify that sleep was called 2 times (between the 3 attempts)
        assert mock_sleep.call_count == 2
        # Verify that is_processing is reset to False
        assert scheduler_mod.is_processing is False
        assert scheduler_mod.processing_queued is False


@pytest.mark.asyncio
@patch("backend.app.core.scheduler._run_processing_cycle")
async def test_trigger_workflow_queues_and_runs_again(mock_run_cycle):
    import backend.app.core.scheduler as scheduler_mod

    # Reset states
    scheduler_mod.is_processing = False
    scheduler_mod.processing_queued = False

    # We want the first cycle to queue a new request
    # To do this, we can set processing_queued to True during the execution of _run_processing_cycle
    call_count = 0
    async def side_effect_run():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            scheduler_mod.processing_queued = True

    mock_run_cycle.side_effect = side_effect_run

    await scheduler_mod.trigger_workflow()

    # It should run twice: once for the initial call, and once for the queued call
    assert mock_run_cycle.call_count == 2
    assert scheduler_mod.is_processing is False
    assert scheduler_mod.processing_queued is False
