import logging
import secrets

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.scheduler import trigger_workflow
from ...db.repository import get_app_settings
from ...db.session import AsyncSessionLocal, get_db

router = APIRouter()
logger = logging.getLogger(__name__)


def _extract_token(request: Request) -> str | None:
    """Extract a webhook token from headers or query parameters."""
    if token := request.headers.get("X-Webhook-Token"):
        return token.strip()
    if token := request.headers.get("X-API-Key"):
        return token.strip()
    if auth := request.headers.get("Authorization"):
        parts = auth.split()
        if len(parts) == 2 and parts[0].lower() in ("bearer", "token"):
            return parts[1].strip()
        return auth.strip()
    if token := request.query_params.get("token") or request.query_params.get("webhook_token"):
        return token.strip()
    return None


@router.post("/webhook")
async def paperless_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession | None = Depends(get_db),
):
    """
    Receives webhooks from paperless-ngx.
    Since paperless webhook payloads are unreliable for document IDs,
    we just trigger a regular processing workflow.
    """
    session_cm = None
    if db is None or not hasattr(db, "execute"):
        session_cm = AsyncSessionLocal()
        session = await session_cm.__aenter__()
    else:
        session = db

    try:
        settings = await get_app_settings(session)

        if settings and settings.webhook_tokens:
            accepted_tokens = [
                t.strip() for t in settings.webhook_tokens.split(",") if t.strip()
            ]
            if accepted_tokens:
                provided_token = _extract_token(request)
                if not provided_token or not any(
                    secrets.compare_digest(provided_token, expected)
                    for expected in accepted_tokens
                ):
                    logger.warning("Rejected webhook: missing or invalid authentication token.")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid or missing webhook token",
                    )

        logger.info("Received webhook from Paperless. Triggering workflow loop.")

        # Trigger the main workflow queueing mechanism
        background_tasks.add_task(trigger_workflow, from_webhook=True)

        return {"status": "queued", "message": "Workflow trigger queued."}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        if session_cm:
            await session_cm.__aexit__(None, None, None)
