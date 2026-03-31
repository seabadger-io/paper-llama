import asyncio
import logging
from datetime import UTC, datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.future import select

from ..db.models import AppSettings, ProcessedDocument
from ..db.session import AsyncSessionLocal
from ..services.processor import DocumentProcessor

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

is_processing = False
processing_queued = False
processing_lock = asyncio.Lock()

async def _run_processing_cycle():
    """The core logic that queries paperless for new documents and processes them."""
    logger.info("Running document check cycle...")

    async with AsyncSessionLocal() as session:
        # Load settings
        query = select(AppSettings).limit(1)
        result = await session.execute(query)
        settings = result.scalar_one_or_none()

        if not settings or not settings.paperless_url or not settings.paperless_token:
            logger.warning("Job skipped: Paperless URL or Token is not configured.")
            return

        if not settings.ollama_url or not settings.ollama_model:
            logger.warning("Job skipped: Ollama URL or Model is not configured.")
            return



        # We need processing state from DB to avoid re-processing and handle retries
        proc_query = select(ProcessedDocument.document_id, ProcessedDocument.status, ProcessedDocument.processed_at)
        proc_result = await session.execute(proc_query)
        processed_data = {row.document_id: (row.status, row.processed_at) for row in proc_result.all()}

        processor = DocumentProcessor(db_session=session, settings=settings)

        # First fetch tags to map the force_process_tag to its ID
        system_tags, _, _ = await processor.get_cached_metadata()

        if settings.query_tag_id:
            if not any(t.get("id") == settings.query_tag_id for t in system_tags):
                logger.error(f"Configured query tag ID '{settings.query_tag_id}' not found in Paperless. Stopping processing.")
                return

        force_tag_id = settings.force_process_tag_id

        # Query documents from paperless
        tags_filter = [settings.query_tag_id] if settings.query_tag_id else None
        documents = await processor.paperless.get_documents(tags=tags_filter)

        new_docs = []
        error_docs = []

        for doc in documents:
            doc_id = doc.get("id")
            doc_tags = doc.get("tags", [])
            status_info = processed_data.get(doc_id)
            status, processed_at = status_info if status_info else (None, None)

            if status == "success":
                if force_tag_id and force_tag_id in doc_tags:
                    logger.info(f"Document {doc_id} already processed, but force tag found. Reprocessing.")
                    new_docs.append(doc_id)
                else:
                    continue # Skip successfully processed
            elif status == "error":
                error_docs.append(doc_id)
            elif status == "processing":
                # Check for staleness (e.g., 30 minutes)
                if processed_at and datetime.now(UTC) - processed_at > timedelta(minutes=30):
                    logger.warning(f"Document {doc_id} has been in processing for too long. Adding to retry queue.")
                    error_docs.append(doc_id)
                else:
                    continue # Still actively processing (probably)
            else:
                new_docs.append(doc_id)

        queue = new_docs + error_docs

        for doc_id in queue:
            # We do this sequentially to not overload Ollama or Paperless
            await processor.process_document(doc_id)
            # Small delay to keep the system responsive
            await asyncio.sleep(1)

async def trigger_workflow(from_webhook=False):
    """Entry point to trigger the workflow, handling overlaps and queues."""
    global is_processing, processing_queued

    async with processing_lock:
        if is_processing:
            if from_webhook:
                logger.info("Processing already in progress, queuing processing request.")
                processing_queued = True
            else:
                logger.info("Processing already in progress, timed scheduler skipped.")
            return

        is_processing = True

    try:
        max_retries = 3
        retry_count = 0
        while True:
            try:
                await _run_processing_cycle()
                retry_count = 0 # reset on success
            except Exception as e:
                retry_count += 1
                logger.exception(f"Error during processing cycle (Attempt {retry_count}/{max_retries}):")
                if retry_count >= max_retries:
                    logger.error("Max retries reached. Aborting this workflow trigger.")
                    break
                logger.info("Waiting 10 seconds before retrying...")
                await asyncio.sleep(10)
                continue

            async with processing_lock:
                if processing_queued:
                    logger.info("Processing was queued. Starting another cycle.")
                    processing_queued = False
                else:
                    is_processing = False
                    break
    except Exception as e:
        async with processing_lock:
            is_processing = False
            processing_queued = False
        logger.error(f"Critical error in workflow trigger: {e}")

def update_scheduler(interval_minutes: int):
    """Updates the background job interval."""
    # Remove existing job if it exists
    if scheduler.get_job('doc_processing_job'):
        scheduler.remove_job('doc_processing_job')

    if interval_minutes > 0:
        logger.info(f"Scheduling job to run every {interval_minutes} minutes.")
        scheduler.add_job(
            trigger_workflow,
            'interval',
            minutes=interval_minutes,
            id='doc_processing_job',
            kwargs={'from_webhook': False}
        )
    else:
        logger.info("Automatic scheduling disabled (interval 0).")

def start_scheduler():
    """Starts the APScheduler."""
    if not scheduler.running:
        scheduler.start()
