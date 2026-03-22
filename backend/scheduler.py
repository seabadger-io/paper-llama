import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.future import select

from .database import AsyncSessionLocal
from .models import AppSettings, ProcessedDocument
from .processor import DocumentProcessor

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



        # We need processing state from DB to avoid re-processing
        proc_query = select(ProcessedDocument.document_id)
        proc_result = await session.execute(proc_query)
        already_processed_ids = set(proc_result.scalars().all())

        processor = DocumentProcessor(db_session=session, settings=settings)

        try:
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

            for doc in documents:
                doc_id = doc.get("id")
                doc_tags = doc.get("tags", [])

                if doc_id in already_processed_ids:
                    # Allow reprocessing if the force tag is present
                    if force_tag_id and force_tag_id in doc_tags:
                        logger.info(f"Document {doc_id} already processed, but force tag found. Reprocessing.")
                    else:
                        continue # Skip already processed

                # We do this sequentially to not overload Ollama or Paperless
                await processor.process_document(doc_id)
                # Small delay to keep the system responsive
                await asyncio.sleep(1)

        except Exception as e:
            logger.error(f"Error during scheduled run: {e}")

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
        while True:
            await _run_processing_cycle()

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
