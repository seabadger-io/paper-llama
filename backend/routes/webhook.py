import logging

from fastapi import APIRouter, BackgroundTasks, Request

from ..scheduler import trigger_workflow

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/webhook")
async def paperless_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Receives webhooks from paperless-ngx.
    Since paperless webhook payloads are unreliable for document IDs,
    we just trigger a regular processing workflow.
    """
    try:
        logger.info("Received webhook from Paperless. Triggering workflow loop.")

        # Trigger the main workflow queueing mechanism
        background_tasks.add_task(trigger_workflow, from_webhook=True)

        return {"status": "queued", "message": "Workflow trigger queued."}

    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return {"status": "error", "message": str(e)}
