import asyncio
import logging
import sys
from datetime import UTC, datetime, timedelta
from types import ModuleType

from sqlalchemy import delete, update
from sqlalchemy.future import select

from ..db.models import AppSettings, DocumentChangeLog, ProcessedDocument
from ..db.session import AsyncSessionLocal
from ..services.processor import DocumentProcessor
from .events import event_broadcaster

logger = logging.getLogger(__name__)


class AsyncWorkflowScheduler:
    """Native asyncio recurring workflow scheduler replacing legacy APScheduler."""

    def __init__(self):
        self._interval_minutes: int = 0
        self._task: asyncio.Task | None = None
        self._running: bool = False
        self._wake_event: asyncio.Event | None = None
        self.is_processing: bool = False
        self.processing_queued: bool = False
        self.processing_lock: asyncio.Lock = asyncio.Lock()
        self.document_execution_lock: asyncio.Lock = asyncio.Lock()
        self.active_document_queue: list[int] = []
        self.current_document_id: int | None = None
        self.queue_lock: asyncio.Lock = asyncio.Lock()

    async def clear_queue(self) -> None:
        """Empties the active document queue under queue_lock."""
        async with self.queue_lock:
            self.active_document_queue.clear()

    def _enqueue_unlocked(self, doc_id: int) -> bool:
        """Internal helper to add a document if not currently processing or queued."""
        if (
            doc_id == self.current_document_id
            or doc_id in self.active_document_queue
        ):
            return False
        self.active_document_queue.append(doc_id)
        return True

    async def enqueue_document(self, doc_id: int) -> bool:
        """Queues a single document if not currently processing or already queued."""
        async with self.queue_lock:
            return self._enqueue_unlocked(doc_id)

    async def enqueue_documents(self, doc_ids: list[int]) -> list[int]:
        """Appends new documents to the queue avoiding duplicates, returning a snapshot."""
        async with self.queue_lock:
            for doc_id in (doc_ids or []):
                self._enqueue_unlocked(doc_id)
            return list(self.active_document_queue)

    async def pop_next_document(self) -> int | None:
        """Pops the next document from queue and marks it as current."""
        async with self.queue_lock:
            if not self.active_document_queue:
                return None
            doc_id = self.active_document_queue.pop(0)
            self.current_document_id = doc_id
            return doc_id

    async def finish_current_document(self) -> None:
        """Resets current_document_id to None after processing."""
        async with self.queue_lock:
            self.current_document_id = None

    async def get_active_and_pending_ids(self) -> set[int]:
        """Returns all IDs in the active queue plus currently processing document."""
        async with self.queue_lock:
            ids = set(self.active_document_queue)
            if self.current_document_id is not None:
                ids.add(self.current_document_id)
            return ids

    @property
    def running(self) -> bool:
        return self._running and self._task is not None and not self._task.done()

    def start(self):
        if self._running and self._task is not None and not self._task.done():
            return
        self._running = True
        self._wake_event = asyncio.Event()
        try:
            loop = asyncio.get_running_loop()
            self._task = loop.create_task(self._run_loop())
        except RuntimeError:
            pass

    def shutdown(self, wait: bool = False):
        self._running = False
        if self._wake_event:
            self._wake_event.set()
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = None

    def update_interval(self, interval_minutes: int):
        self._interval_minutes = interval_minutes
        if interval_minutes > 0:
            logger.info(f"Scheduling job to run every {interval_minutes} minutes.")
        else:
            logger.info("Automatic scheduling disabled (interval 0).")

        if self._running and (self._task is None or self._task.done()):
            try:
                loop = asyncio.get_running_loop()
                self._wake_event = asyncio.Event()
                self._task = loop.create_task(self._run_loop())
            except RuntimeError:
                pass
        elif self._wake_event:
            self._wake_event.set()

    def get_job(self, job_id: str):
        return self._task if (self.running and self._interval_minutes > 0) else None

    def remove_job(self, job_id: str):
        self.update_interval(0)

    async def _run_loop(self):
        while self._running:
            try:
                if self._interval_minutes > 0:
                    if self._wake_event:
                        self._wake_event.clear()
                    try:
                        await asyncio.wait_for(
                            self._wake_event.wait()
                            if self._wake_event
                            else asyncio.sleep(self._interval_minutes * 60),
                            timeout=self._interval_minutes * 60,
                        )
                        # Woken up by update_interval or shutdown
                        continue
                    except TimeoutError:
                        if self._running and self._interval_minutes > 0:
                            try:
                                await trigger_workflow(from_webhook=False)
                            except Exception as e:
                                logger.error(f"Error in scheduled workflow trigger: {e}")
                else:
                    if self._wake_event:
                        self._wake_event.clear()
                        await self._wake_event.wait()
                    else:
                        await asyncio.sleep(1)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Unexpected error in scheduler loop: {e}")
                await asyncio.sleep(5)


scheduler = AsyncWorkflowScheduler()


async def _get_app_settings(session) -> AppSettings | None:
    """Helper to fetch singleton AppSettings from DB."""
    query = select(AppSettings).limit(1)
    result = await session.execute(query)
    return result.scalar_one_or_none()


def _is_ai_backend_configured(settings: AppSettings) -> bool:
    """Validates that the selected AI backend has its required configuration."""
    ai_backend = settings.ai_backend or "ollama"
    if ai_backend == "llamacpp":
        if not settings.llamacpp_url or not settings.llamacpp_model:
            logger.warning("Job skipped: Llama.cpp URL or Model is not configured.")
            return False
        return True
    elif ai_backend == "ollama":
        if not settings.ollama_url or not settings.ollama_model:
            logger.warning("Job skipped: Ollama URL or Model is not configured.")
            return False
        return True
    else:
        logger.warning(f"Job skipped: Invalid AI backend '{ai_backend}'.")
        return False


def is_stale(
    processed_at: datetime | None, max_age: timedelta = timedelta(minutes=30)
) -> bool:
    """Returns True if processed_at is older than max_age.

    Normalizes timezone-naive datetimes to UTC to prevent TypeError.
    Returns False if processed_at is None.
    """
    if not processed_at:
        return False
    if processed_at.tzinfo is None:
        processed_at = processed_at.replace(tzinfo=UTC)
    return datetime.now(UTC) - processed_at > max_age


async def _build_document_queue(
    session, settings: AppSettings, processor: DocumentProcessor
) -> list[int]:
    """Inspects Paperless and ProcessedDocument database records to determine

    which documents need processing (new, forced, error retries, or stale processing).
    """
    # We need processing state from DB to avoid re-processing and handle retries
    proc_query = select(
        ProcessedDocument.document_id, ProcessedDocument.status, ProcessedDocument.processed_at
    )
    proc_result = await session.execute(proc_query)
    processed_data = {
        row.document_id: (row.status, row.processed_at) for row in proc_result.all()
    }

    # First fetch tags to map the force_process_tag to its ID
    system_tags, _, _ = await processor.get_cached_metadata()

    if settings.query_tag_id:
        if not any(
            isinstance(t, dict) and t.get("id") == settings.query_tag_id
            for t in (system_tags or [])
        ):
            logger.error(
                f"Configured query tag ID '{settings.query_tag_id}' not found in Paperless. Stopping processing."
            )
            return []

    force_tag_id = settings.force_process_tag_id

    # Query documents from paperless
    tags_filter = [settings.query_tag_id] if settings.query_tag_id else None
    documents = await processor.paperless.get_documents(tags=tags_filter)

    new_docs = []
    error_docs = []

    for doc in (documents or []):
        if not isinstance(doc, dict):
            continue
        doc_id = doc.get("id")
        doc_tags = doc.get("tags") or []
        status_info = processed_data.get(doc_id)
        status, processed_at = status_info if status_info else (None, None)

        if status == "success":
            if force_tag_id and force_tag_id in doc_tags:
                logger.info(
                    f"Document {doc_id} already processed, but force tag found. Reprocessing."
                )
                new_docs.append(doc_id)
            else:
                continue  # Skip successfully processed
        elif status == "error":
            error_docs.append(doc_id)
        elif status == "processing":
            # Check for staleness (e.g., 30 minutes)
            if is_stale(processed_at, timedelta(minutes=30)):
                logger.warning(
                    f"Document {doc_id} has been in processing for too long. Adding to retry queue."
                )
                error_docs.append(doc_id)
            else:
                continue  # Still actively processing (probably)
        else:
            new_docs.append(doc_id)

    return new_docs + error_docs


async def get_pending_documents_count() -> int:
    """Calculates the number of documents currently waiting for processing."""
    async with AsyncSessionLocal() as session:
        # Load settings
        settings = await _get_app_settings(session)

        if not settings or not settings.paperless_url or not settings.paperless_token:
            return 0

        processor = DocumentProcessor(db_session=session, settings=settings)
        discovered = await _build_document_queue(session, settings, processor)
        active_ids = await scheduler.get_active_and_pending_ids()
        return len(set(discovered) | active_ids)


async def perform_log_maintenance(
    session=None, settings: AppSettings | None = None
) -> dict[str, int]:
    """Prunes logs older than log_retention_days and compacts logs older than log_compact_after_days."""
    should_close = False
    session_ctx = None
    if session is None:
        session_ctx = AsyncSessionLocal()
        session = await session_ctx.__aenter__()
        should_close = True
    try:
        if settings is None:
            settings = await _get_app_settings(session)

        if not settings:
            return {"deleted_logs": 0, "compacted_logs": 0}

        now = datetime.now(UTC)
        deleted_count = 0
        compacted_count = 0

        # 1. Prune logs older than log_retention_days (if > 0)
        retention_days = getattr(settings, "log_retention_days", 90) or 0
        if retention_days > 0:
            cutoff = now - timedelta(days=retention_days)
            del_stmt = delete(DocumentChangeLog).where(DocumentChangeLog.changed_at < cutoff)
            del_res = await session.execute(del_stmt)
            deleted_count = (
                del_res.rowcount
                if del_res.rowcount is not None and del_res.rowcount >= 0
                else 0
            )

        # 2. Compact logs older than log_compact_after_days (if > 0)
        compact_days = getattr(settings, "log_compact_after_days", 30) or 0
        if compact_days > 0:
            cutoff = now - timedelta(days=compact_days)
            compact_stmt = (
                update(DocumentChangeLog)
                .where(
                    DocumentChangeLog.changed_at < cutoff,
                    (DocumentChangeLog.prompt_used.is_not(None))
                    | (DocumentChangeLog.ai_response.is_not(None)),
                )
                .values(prompt_used=None, ai_response=None)
            )
            compact_res = await session.execute(compact_stmt)
            compacted_count = (
                compact_res.rowcount
                if compact_res.rowcount is not None and compact_res.rowcount >= 0
                else 0
            )

        if deleted_count > 0 or compacted_count > 0:
            await session.commit()
            logger.info(
                f"Log maintenance complete: {deleted_count} logs pruned, {compacted_count} logs compacted."
            )

        return {"deleted_logs": deleted_count, "compacted_logs": compacted_count}
    finally:
        if should_close and session_ctx is not None:
            await session_ctx.__aexit__(None, None, None)


async def _run_processing_cycle():
    """The core logic that queries paperless for new documents and processes them."""
    logger.info("Running document check cycle...")

    async with AsyncSessionLocal() as session:
        # Load settings
        settings = await _get_app_settings(session)

        if not settings or not settings.paperless_url or not settings.paperless_token:
            logger.warning("Job skipped: Paperless URL or Token is not configured.")
            return

        if not _is_ai_backend_configured(settings):
            await scheduler.clear_queue()
            return

        processor = DocumentProcessor(db_session=session, settings=settings)
        discovered_docs = await _build_document_queue(session, settings, processor)

        queue_snapshot = await scheduler.enqueue_documents(discovered_docs)

        if queue_snapshot:
            event_broadcaster.publish(
                "workflow_started",
                {"queue_count": len(queue_snapshot), "document_ids": queue_snapshot},
            )

        # Run log retention pruning and prompt/response compaction
        try:
            await perform_log_maintenance(session, settings)
        except Exception as e:
            logger.warning(f"Error during log maintenance: {e}")

        processed_count = 0
        while True:
            doc_id = await scheduler.pop_next_document()
            if doc_id is None:
                break

            try:
                async with scheduler.document_execution_lock:
                    await processor.process_document(doc_id)
                processed_count += 1
            finally:
                await scheduler.finish_current_document()

            # Small delay to keep the system responsive
            await asyncio.sleep(1)

        if processed_count > 0:
            event_broadcaster.publish(
                "workflow_completed",
                {"processed_count": processed_count},
            )


async def reprocess_document(document_id: int) -> bool:
    """Queues a document for reprocessing.

    If a processing cycle is currently in progress, the document is added to
    the active document queue (if not already present). Otherwise, a new
    processing workflow is initiated.

    Returns True if successfully queued or started, False if the document is
    already in the active queue or currently being processed.
    """
    if not await scheduler.enqueue_document(document_id):
        logger.info(
            f"Document {document_id} is already in the active queue or currently processing."
        )
        return False

    logger.info(
        f"Document {document_id} added to active processing queue. (Queue size: {len(scheduler.active_document_queue)})"
    )

    # If workflow is not currently active, start it
    async with scheduler.processing_lock:
        if not scheduler.is_processing:
            logger.info(f"Starting processing cycle for manual document {document_id}.")
            asyncio.create_task(trigger_workflow(from_webhook=False))

    return True


async def trigger_workflow(from_webhook=False):
    """Entry point to trigger the workflow, handling overlaps and queues."""
    async with scheduler.processing_lock:
        if scheduler.is_processing:
            if from_webhook:
                logger.info("Processing already in progress, queuing processing request.")
                scheduler.processing_queued = True
            else:
                logger.info("Processing already in progress, timed scheduler skipped.")
            return

        scheduler.is_processing = True

    try:
        max_retries = 3
        retry_count = 0
        while True:
            try:
                await _run_processing_cycle()
                retry_count = 0  # reset on success
            except Exception as e:
                retry_count += 1
                logger.exception(
                    f"Error during processing cycle (Attempt {retry_count}/{max_retries}): {e}"
                )
                if retry_count >= max_retries:
                    logger.error("Max retries reached. Aborting this workflow trigger.")
                    break
                logger.info("Waiting 10 seconds before retrying...")
                await asyncio.sleep(10)
                continue

            async with scheduler.processing_lock:
                if scheduler.processing_queued:
                    logger.info("Processing was queued. Starting another cycle.")
                    scheduler.processing_queued = False
                elif scheduler.active_document_queue:
                    logger.info("Active document queue has remaining items. Starting another cycle.")
                else:
                    break
    except Exception as e:
        logger.error(f"Critical error in workflow trigger: {e}")
    finally:
        async with scheduler.processing_lock:
            scheduler.is_processing = False
            scheduler.processing_queued = False


def update_scheduler(interval_minutes: int):
    """Updates the background job interval."""
    scheduler.update_interval(interval_minutes)


def start_scheduler():
    """Starts the background scheduler."""
    scheduler.start()


def stop_scheduler():
    """Stops the background scheduler."""
    scheduler.shutdown(wait=False)


class _SchedulerModule(ModuleType):
    @property
    def is_processing(self) -> bool:
        return scheduler.is_processing

    @is_processing.setter
    def is_processing(self, value: bool):
        scheduler.is_processing = value

    @property
    def processing_queued(self) -> bool:
        return scheduler.processing_queued

    @processing_queued.setter
    def processing_queued(self, value: bool):
        scheduler.processing_queued = value

    @property
    def active_document_queue(self) -> list[int]:
        return scheduler.active_document_queue

    @active_document_queue.setter
    def active_document_queue(self, value: list[int]):
        scheduler.active_document_queue = value

    @property
    def current_document_id(self) -> int | None:
        return scheduler.current_document_id

    @current_document_id.setter
    def current_document_id(self, value: int | None):
        scheduler.current_document_id = value

    @property
    def queue_lock(self) -> asyncio.Lock:
        return scheduler.queue_lock

    @property
    def processing_lock(self) -> asyncio.Lock:
        return scheduler.processing_lock

    @property
    def document_execution_lock(self) -> asyncio.Lock:
        return scheduler.document_execution_lock


sys.modules[__name__].__class__ = _SchedulerModule
