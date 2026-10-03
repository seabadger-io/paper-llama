import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.app.core.scheduler import (
    _build_document_queue,
    _run_processing_cycle,
    get_pending_documents_count,
    is_stale,
    perform_log_maintenance,
    reprocess_document,
)
from backend.app.db.models import AppSettings


@pytest.fixture(autouse=True)
def reset_scheduler_state():
    import backend.app.core.scheduler as sched
    sched.active_document_queue.clear()
    sched.current_document_id = None
    sched.is_processing = False
    sched.processing_queued = False
    yield
    sched.active_document_queue.clear()
    sched.current_document_id = None
    sched.is_processing = False
    sched.processing_queued = False


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


@pytest.mark.asyncio
@patch("backend.app.core.scheduler.AsyncSessionLocal")
@patch("backend.app.core.scheduler.DocumentProcessor")
async def test_run_processing_cycle_llamacpp_backend(
    mock_document_processor_class, mock_async_session_local
):
    settings = AppSettings()
    settings.paperless_url = "http://test"
    settings.paperless_token = "token"
    settings.ai_backend = "llamacpp"
    settings.ollama_url = None
    settings.ollama_model = None
    settings.llamacpp_url = "http://llamacpp:8080"
    settings.llamacpp_model = "test-llama-model"
    settings.query_tag_id = 999

    mock_session = AsyncMock()
    mock_async_session_local.return_value.__aenter__.return_value = mock_session

    mock_result_settings = MagicMock()
    mock_result_settings.scalar_one_or_none.return_value = settings

    mock_result_proc = MagicMock()
    mock_result_proc.all.return_value = []

    mock_session.execute.side_effect = [mock_result_settings, mock_result_proc]

    mock_processor_instance = AsyncMock()
    mock_document_processor_class.return_value = mock_processor_instance
    mock_processor_instance.get_cached_metadata.return_value = (
        [{"id": 999, "name": "query"}],
        [],
        [],
    )
    mock_processor_instance.paperless.get_documents.return_value = []

    await _run_processing_cycle()

    mock_processor_instance.get_cached_metadata.assert_called_once()
    mock_processor_instance.paperless.get_documents.assert_called_once()


@pytest.mark.asyncio
@patch("backend.app.core.scheduler.AsyncSessionLocal")
@patch("backend.app.core.scheduler.DocumentProcessor")
async def test_run_processing_cycle_llamacpp_missing_config(
    mock_document_processor_class, mock_async_session_local
):
    settings = AppSettings()
    settings.paperless_url = "http://test"
    settings.paperless_token = "token"
    settings.ai_backend = "llamacpp"
    settings.llamacpp_url = "http://llamacpp:8080"
    settings.llamacpp_model = None  # Missing model

    mock_session = AsyncMock()
    mock_async_session_local.return_value.__aenter__.return_value = mock_session

    mock_result_settings = MagicMock()
    mock_result_settings.scalar_one_or_none.return_value = settings

    mock_session.execute.return_value = mock_result_settings

    mock_processor_instance = AsyncMock()
    mock_document_processor_class.return_value = mock_processor_instance

    await _run_processing_cycle()

    mock_processor_instance.get_cached_metadata.assert_not_called()


@pytest.mark.asyncio
@patch("backend.app.core.scheduler.AsyncSessionLocal")
@patch("backend.app.core.scheduler.DocumentProcessor")
async def test_run_processing_cycle_invalid_ai_backend(
    mock_document_processor_class, mock_async_session_local
):
    settings = AppSettings()
    settings.paperless_url = "http://test"
    settings.paperless_token = "token"
    settings.ai_backend = "unknown_backend"

    mock_session = AsyncMock()
    mock_async_session_local.return_value.__aenter__.return_value = mock_session

    mock_result_settings = MagicMock()
    mock_result_settings.scalar_one_or_none.return_value = settings

    mock_session.execute.return_value = mock_result_settings

    mock_processor_instance = AsyncMock()
    mock_document_processor_class.return_value = mock_processor_instance

    await _run_processing_cycle()

    mock_processor_instance.get_cached_metadata.assert_not_called()


@pytest.mark.asyncio
@patch("backend.app.core.scheduler.AsyncSessionLocal")
async def test_get_pending_documents_count_unconfigured(mock_async_session_local):
    mock_session = AsyncMock()
    mock_async_session_local.return_value.__aenter__.return_value = mock_session

    mock_result_settings = MagicMock()
    mock_result_settings.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result_settings

    count = await get_pending_documents_count()
    assert count == 0


@pytest.mark.asyncio
@patch("backend.app.core.scheduler.AsyncSessionLocal")
@patch("backend.app.core.scheduler._build_document_queue")
@patch("backend.app.core.scheduler.DocumentProcessor")
async def test_get_pending_documents_count_delegates_to_build_queue(
    mock_document_processor_class, mock_build_queue, mock_async_session_local, mock_settings
):
    mock_session = AsyncMock()
    mock_async_session_local.return_value.__aenter__.return_value = mock_session

    mock_result_settings = MagicMock()
    mock_result_settings.scalar_one_or_none.return_value = mock_settings
    mock_session.execute.return_value = mock_result_settings

    mock_build_queue.return_value = [101, 102, 103]

    count = await get_pending_documents_count()
    assert count == 3
    mock_build_queue.assert_called_once()


@pytest.mark.asyncio
async def test_build_document_queue_classification(mock_settings):
    from datetime import UTC, datetime, timedelta

    mock_session = AsyncMock()
    mock_processor = AsyncMock()

    mock_processor.get_cached_metadata.return_value = (
        [{"id": 999, "name": "query"}],
        [],
        [],
    )
    mock_settings.force_process_tag_id = 777

    # DB state:
    # 1: success (no force tag) -> skip
    # 2: success (with force tag 777) -> reprocess
    # 3: error -> retry
    # 4: processing (fresh, 5m ago) -> skip
    # 5: processing (stale, 45m ago) -> retry
    # 6: not in DB -> new doc
    stale_time = datetime.now(UTC) - timedelta(minutes=45)
    fresh_time = datetime.now(UTC) - timedelta(minutes=5)

    def make_row(doc_id, status, dt):
        r = MagicMock()
        r.document_id = doc_id
        r.status = status
        r.processed_at = dt
        return r

    mock_proc_rows = [
        make_row(1, "success", fresh_time),
        make_row(2, "success", fresh_time),
        make_row(3, "error", fresh_time),
        make_row(4, "processing", fresh_time),
        make_row(5, "processing", stale_time),
    ]

    mock_proc_result = MagicMock()
    mock_proc_result.all.return_value = mock_proc_rows
    mock_session.execute.return_value = mock_proc_result

    # Paperless returns docs
    mock_processor.paperless.get_documents.return_value = [
        {"id": 1, "tags": [999]},
        {"id": 2, "tags": [999, 777]},
        {"id": 3, "tags": [999]},
        {"id": 4, "tags": [999]},
        {"id": 5, "tags": [999]},
        {"id": 6, "tags": [999]},
    ]

    queue = await _build_document_queue(mock_session, mock_settings, mock_processor)

    # Expected:
    # new_docs: [2 (force tag), 6 (new)]
    # error_docs: [3 (error), 5 (stale processing)]
    # queue = new_docs + error_docs = [2, 6, 3, 5]
    assert queue == [2, 6, 3, 5]


@pytest.mark.asyncio
async def test_perform_log_maintenance(mock_settings):
    mock_session = AsyncMock()

    mock_settings.log_retention_days = 90
    mock_settings.log_compact_after_days = 30

    # del_res rowcount = 4, compact_res rowcount = 8
    mock_del_res = MagicMock()
    mock_del_res.rowcount = 4

    mock_compact_res = MagicMock()
    mock_compact_res.rowcount = 8

    mock_session.execute.side_effect = [mock_del_res, mock_compact_res]

    stats = await perform_log_maintenance(session=mock_session, settings=mock_settings)

    assert stats["deleted_logs"] == 4
    assert stats["compacted_logs"] == 8
    assert mock_session.execute.call_count == 2
    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_perform_log_maintenance_default_retention():
    """Verify that when log_retention_days is omitted/missing, default is 0 (keep indefinitely, no deletion)."""
    mock_session = AsyncMock()

    # Empty object without log_retention_days / log_compact_after_days
    class DummySettings:
        pass

    dummy = DummySettings()
    dummy.log_compact_after_days = 0
    stats = await perform_log_maintenance(session=mock_session, settings=dummy)

    assert stats["deleted_logs"] == 0
    assert stats["compacted_logs"] == 0
    mock_session.execute.assert_not_called()
    mock_session.commit.assert_not_called()



@pytest.mark.asyncio
async def test_async_workflow_scheduler_lifecycle():
    from backend.app.core.scheduler import AsyncWorkflowScheduler

    sched = AsyncWorkflowScheduler()
    assert sched.running is False

    sched.start()
    assert sched.running is True

    sched.update_interval(5)
    assert sched._interval_minutes == 5
    assert sched.get_job("doc_processing_job") is not None

    sched.remove_job("doc_processing_job")
    assert sched._interval_minutes == 0

    sched.shutdown()
    assert sched.running is False


@pytest.mark.asyncio
async def test_async_workflow_scheduler_triggers_workflow():
    from backend.app.core.scheduler import AsyncWorkflowScheduler

    sched = AsyncWorkflowScheduler()
    sched._interval_minutes = 1

    called = False

    async def fake_wait_for(coro, timeout=None):
        nonlocal called
        if asyncio.iscoroutine(coro):
            coro.close()
        if not called:
            called = True
            raise TimeoutError()
        await asyncio.sleep(10)

    with (
        patch("backend.app.core.scheduler.trigger_workflow", new_callable=AsyncMock) as mock_trigger,
        patch("asyncio.wait_for", side_effect=fake_wait_for),
    ):
        sched.start()
        # Allow loop to iterate once
        await asyncio.sleep(0.05)
        sched.shutdown()

        mock_trigger.assert_awaited_once_with(from_webhook=False)


@pytest.mark.asyncio
async def test_reprocess_document_enqueues_and_triggers_when_idle():
    import backend.app.core.scheduler as sched

    sched.is_processing = False
    sched.active_document_queue.clear()

    with patch("backend.app.core.scheduler.trigger_workflow", new_callable=AsyncMock) as mock_trigger:
        success = await reprocess_document(document_id=77)

        assert success is True
        assert 77 in sched.active_document_queue
        # Allow asyncio.create_task to run
        await asyncio.sleep(0.01)
        mock_trigger.assert_called_once_with(from_webhook=False)


@pytest.mark.asyncio
async def test_reprocess_document_enqueues_without_trigger_when_already_processing():
    import backend.app.core.scheduler as sched

    sched.is_processing = True
    sched.active_document_queue.clear()

    with patch("backend.app.core.scheduler.trigger_workflow", new_callable=AsyncMock) as mock_trigger:
        success = await reprocess_document(document_id=88)

        assert success is True
        assert 88 in sched.active_document_queue
        await asyncio.sleep(0.01)
        mock_trigger.assert_not_called()


@pytest.mark.asyncio
async def test_reprocess_document_prevents_duplicate_in_active_queue():
    import backend.app.core.scheduler as sched

    sched.is_processing = True
    sched.active_document_queue.clear()

    first = await reprocess_document(document_id=99)
    assert first is True
    assert sched.active_document_queue == [99]

    # Attempt to re-queue the exact same document
    second = await reprocess_document(document_id=99)
    assert second is False
    assert sched.active_document_queue == [99]


@pytest.mark.asyncio
async def test_reprocess_document_prevents_duplicate_when_currently_processing():
    import backend.app.core.scheduler as sched

    sched.current_document_id = 123
    sched.active_document_queue.clear()

    success = await reprocess_document(document_id=123)
    assert success is False
    assert sched.active_document_queue == []


@pytest.mark.asyncio
@patch("backend.app.core.scheduler.AsyncSessionLocal")
@patch("backend.app.core.scheduler.DocumentProcessor")
@patch("backend.app.core.scheduler._build_document_queue")
async def test_run_processing_cycle_drains_queue_and_deduplicates(
    mock_build_queue, mock_processor_class, mock_session_local, mock_settings
):
    import backend.app.core.scheduler as sched

    mock_session = AsyncMock()
    mock_session_local.return_value.__aenter__.return_value = mock_session

    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = mock_settings
    mock_session.execute.return_value = mock_res

    mock_processor_instance = AsyncMock()
    mock_processor_class.return_value = mock_processor_instance

    # Document 50 is manually pre-queued
    sched.active_document_queue = [50]
    # Discovered documents include 50 (duplicate) and 60 (new)
    mock_build_queue.return_value = [50, 60]

    await _run_processing_cycle()

    # Both documents should be processed exactly once, in order
    assert mock_processor_instance.process_document.call_count == 2
    mock_processor_instance.process_document.assert_any_call(50)
    mock_processor_instance.process_document.assert_any_call(60)

    # Queue should be fully drained and current_document_id reset to None
    assert sched.active_document_queue == []
    assert sched.current_document_id is None


@pytest.mark.asyncio
async def test_queue_clear_and_helpers():
    from backend.app.core.scheduler import (
        _is_ai_backend_configured,
        scheduler,
    )
    from backend.app.db.models import AppSettings

    # Test enqueue and clear
    await scheduler.enqueue_documents([101, 102])
    assert scheduler.active_document_queue == [101, 102]

    await scheduler.clear_queue()
    assert scheduler.active_document_queue == []

    # Test pop and finish
    await scheduler.enqueue_documents([201])
    doc_id = await scheduler.pop_next_document()
    assert doc_id == 201
    assert scheduler.current_document_id == 201

    await scheduler.finish_current_document()
    assert scheduler.current_document_id is None

    # Test _is_ai_backend_configured
    settings = AppSettings()
    settings.ai_backend = "ollama"
    settings.ollama_url = "http://localhost:11434"
    settings.ollama_model = "llama3"
    assert _is_ai_backend_configured(settings) is True

    settings.ollama_model = ""
    assert _is_ai_backend_configured(settings) is False

    settings.ai_backend = "invalid_backend"
    assert _is_ai_backend_configured(settings) is False


def test_is_stale_aware_and_naive():
    from datetime import UTC, datetime, timedelta

    assert is_stale(None) is False

    # Aware datetimes
    aware_stale = datetime.now(UTC) - timedelta(minutes=35)
    aware_fresh = datetime.now(UTC) - timedelta(minutes=10)
    assert is_stale(aware_stale) is True
    assert is_stale(aware_fresh) is False

    # Naive UTC datetimes (e.g. SQLite strips timezone info from DateTime columns)
    naive_stale = (datetime.now(UTC) - timedelta(minutes=35)).replace(tzinfo=None)
    naive_fresh = (datetime.now(UTC) - timedelta(minutes=10)).replace(tzinfo=None)
    assert is_stale(naive_stale) is True
    assert is_stale(naive_fresh) is False

    # Custom max_age
    assert is_stale(aware_fresh, max_age=timedelta(minutes=5)) is True







