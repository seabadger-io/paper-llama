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
@patch('backend.app.core.scheduler.AsyncSessionLocal')
@patch('backend.app.core.scheduler.DocumentProcessor')
async def test_run_processing_cycle_halts_on_missing_query_tag(
    mock_document_processor_class,
    mock_async_session_local,
    mock_settings
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
    mock_processor_instance.get_cached_metadata.return_value = ([{"id": 1, "name": "inbox"}], [], [])

    # Run the cycle
    await _run_processing_cycle()

    # Assertions
    mock_processor_instance.get_cached_metadata.assert_called_once()
    # It should immediately return without querying paperless for documents
    mock_processor_instance.paperless.get_documents.assert_not_called()
    mock_processor_instance.process_document.assert_not_called()

@pytest.mark.asyncio
@patch('backend.app.core.scheduler.AsyncSessionLocal')
@patch('backend.app.core.scheduler.DocumentProcessor')
async def test_run_processing_cycle_reprocesses_stale_docs(
    mock_document_processor_class,
    mock_async_session_local,
    mock_settings
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
    mock_row_stale.status = 'processing'
    mock_row_stale.processed_at = stale_time

    mock_row_fresh = MagicMock()
    mock_row_fresh.document_id = 102
    mock_row_fresh.status = 'processing'
    mock_row_fresh.processed_at = fresh_time

    mock_result_proc = MagicMock()
    mock_result_proc.all.return_value = [mock_row_stale, mock_row_fresh]

    mock_session.execute.side_effect = [mock_result_settings, mock_result_proc]

    # Setup mock processor
    mock_processor_instance = AsyncMock()
    mock_document_processor_class.return_value = mock_processor_instance
    mock_processor_instance.get_cached_metadata.return_value = ([{"id": 999, "name": "query"}], [], [])

    # Paperless returns both documents
    mock_processor_instance.paperless.get_documents.return_value = [
        {"id": 101, "tags": [999]},
        {"id": 102, "tags": [999]}
    ]

    # Run the cycle
    await _run_processing_cycle()

    # Assertions
    # document 101 (stale) should be processed
    # document 102 (fresh) should be skipped
    mock_processor_instance.process_document.assert_called_once_with(101)

