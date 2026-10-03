import logging
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_current_user, get_current_user_flexible
from ...core.events import event_broadcaster
from ...core.scheduler import (
    get_pending_documents_count,
    is_stale,
    perform_log_maintenance,
    reprocess_document,
    trigger_workflow,
    update_scheduler,
)
from ...core.security import get_password_hash, verify_password
from ...db.models import AdminUser, DocumentChangeLog, ProcessedDocument
from ...db.repository import apply_settings, get_app_settings
from ...db.session import get_db
from ...schemas.settings import SettingsResponse, SettingsUpdate

router = APIRouter()
logger = logging.getLogger(__name__)


class AdminAccountInfo(BaseModel):
    username: str


class AdminAccountUpdate(BaseModel):
    current_password: str
    new_username: str | None = None
    new_password: str | None = None

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, v: str | None) -> str | None:
        if v is not None:
            if not v or len(v) < 8:
                raise ValueError("New password must be at least 8 characters long")
        return v

    @field_validator("new_username")
    @classmethod
    def validate_new_username(cls, v: str | None) -> str | None:
        if v is not None:
            if not v.strip():
                raise ValueError("New username cannot be empty")
            return v.strip()
        return v


class SetupStatus(BaseModel):
    is_setup: bool


@router.get("/status", response_model=SetupStatus)
async def get_setup_status(db: AsyncSession = Depends(get_db)):
    """Check if the application has been set up."""
    admin_query = select(AdminUser).limit(1)
    admin_res = await db.execute(admin_query)
    has_admin = admin_res.scalar_one_or_none() is not None

    app_settings = await get_app_settings(db)
    has_settings = app_settings is not None

    return {"is_setup": has_admin and has_settings}


@router.get("/settings", response_model=SettingsResponse)
async def get_current_settings(
    db: AsyncSession = Depends(get_db), current_user: AdminUser = Depends(get_current_user)
):
    """Retrieve current application settings."""
    settings = await get_app_settings(db)
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    return SettingsResponse.model_validate(settings)


@router.put("/settings")
async def update_settings(
    settings_data: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    app_settings = await get_app_settings(db)
    if not app_settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    apply_settings(app_settings, settings_data)
    await db.commit()

    # Update scheduler
    update_scheduler(app_settings.schedule_interval_minutes)

    return {"message": "Settings updated successfully"}



@router.get("/trigger/stats")
async def get_trigger_stats(current_user: AdminUser = Depends(get_current_user)):
    """Get statistics about the documents pending processing."""
    count = await get_pending_documents_count()
    return {"count": count}


@router.post("/trigger")
async def trigger_processing(
    background_tasks: BackgroundTasks, current_user: AdminUser = Depends(get_current_user)
):
    """Manually trigger document processing."""
    background_tasks.add_task(trigger_workflow, from_webhook=True)
    return {"message": "Processing triggered"}


@router.post("/documents/{document_id}/reprocess")
@router.post("/documents/{document_id}/retry")
async def reprocess_single_document(
    document_id: int,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """Manually re-process / retry a specific document."""
    if document_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    query = select(ProcessedDocument).where(ProcessedDocument.document_id == document_id)
    result = await db.execute(query)
    proc_doc = result.scalar_one_or_none()

    if proc_doc and proc_doc.status == "processing":
        if not is_stale(proc_doc.processed_at, timedelta(minutes=30)):
            raise HTTPException(
                status_code=409,
                detail=f"Document {document_id} is already being processed",
            )

    success = await reprocess_document(document_id)
    if not success:
        raise HTTPException(
            status_code=409,
            detail=f"Document {document_id} is already in the processing queue or being processed",
        )

    return {
        "message": f"Document {document_id} added to processing queue",
        "document_id": document_id,
    }


@router.get("/processing")
async def get_processing(
    db: AsyncSession = Depends(get_db), current_user: AdminUser = Depends(get_current_user)
):
    """Fetch documents currently being processed."""
    query = select(ProcessedDocument).where(ProcessedDocument.status == "processing")
    result = await db.execute(query)
    docs = result.scalars().all()
    return [{"document_id": d.document_id, "started_at": d.processed_at} for d in docs]


@router.get("/events")
async def get_events(
    request: Request,
    token: str | None = None,
    current_user: AdminUser = Depends(get_current_user_flexible),
):
    """Server-Sent Events stream for live document processing updates."""
    queue = await event_broadcaster.subscribe()

    async def stream_generator():
        try:
            async for chunk in event_broadcaster.event_generator(queue):
                if await request.is_disconnected():
                    break
                yield chunk
        finally:
            await event_broadcaster.unsubscribe(queue)

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/logs")
async def get_change_logs(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """Fetch the document change logs with pagination."""
    # Count total logs
    count_query = select(func.count()).select_from(DocumentChangeLog)
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    query = (
        select(DocumentChangeLog)
        .order_by(DocumentChangeLog.changed_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "logs": [
            {
                "id": log.id,
                "document_id": log.document_id,
                "changed_at": log.changed_at,
                "original_state": log.original_state,
                "new_state": log.new_state,
                "has_ai_interaction": bool(log.prompt_used or log.ai_response),
            }
            for log in logs
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/logs/{log_id}/details")
async def get_log_details(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """Fetch detailed AI interaction info (prompt and response) for a specific log entry on demand."""
    query = select(DocumentChangeLog).where(DocumentChangeLog.id == log_id)
    result = await db.execute(query)
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log entry not found")

    return {
        "id": log.id,
        "document_id": log.document_id,
        "changed_at": log.changed_at,
        "prompt_used": log.prompt_used,
        "ai_response": log.ai_response,
        "has_ai_interaction": bool(log.prompt_used or log.ai_response),
    }


@router.post("/logs/cleanup")
async def trigger_log_cleanup(
    db: AsyncSession = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """Manually trigger log retention pruning and prompt/response compaction."""
    settings = await get_app_settings(db)
    stats = await perform_log_maintenance(session=db, settings=settings)
    return {
        "message": "Log maintenance completed successfully",
        "deleted_logs": stats["deleted_logs"],
        "compacted_logs": stats["compacted_logs"],
    }


@router.get("/paperless/users")
async def get_paperless_users(
    db: AsyncSession = Depends(get_db), current_user: AdminUser = Depends(get_current_user)
):
    """Fetch users from Paperless."""
    settings = await get_app_settings(db)
    if not settings or not settings.paperless_url or not settings.paperless_token:
        return []

    from ...services.paperless import PaperlessClient

    try:
        client = PaperlessClient(settings.paperless_url, settings.paperless_token)
        return await client.get_users()
    except Exception as e:
        logger.error(f"Error fetching Paperless users: {e}")
        return []


@router.get("/paperless/groups")
async def get_paperless_groups(
    db: AsyncSession = Depends(get_db), current_user: AdminUser = Depends(get_current_user)
):
    """Fetch groups from Paperless."""
    settings = await get_app_settings(db)
    if not settings or not settings.paperless_url or not settings.paperless_token:
        return []

    from ...services.paperless import PaperlessClient

    try:
        client = PaperlessClient(settings.paperless_url, settings.paperless_token)
        return await client.get_groups()
    except Exception as e:
        logger.error(f"Error fetching Paperless groups: {e}")
        return []


@router.get("/account", response_model=AdminAccountInfo)
async def get_admin_account_info(current_user: AdminUser = Depends(get_current_user)):
    """Fetch the basic information for the currently logged in admin account."""
    return {"username": current_user.username}


@router.put("/account")
async def update_admin_account(
    update_data: AdminAccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    """
    Update admin username and/or password.
    Requires the current password to be provided for security.
    """
    # Verify current password
    if not verify_password(update_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid current password")

    if update_data.new_username:
        # Check if username is already taken by someone else (if the table ever expands)
        if update_data.new_username != current_user.username:
            check_query = select(AdminUser).where(AdminUser.username == update_data.new_username)
            check_res = await db.execute(check_query)
            if check_res.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Username already exists")
            current_user.username = update_data.new_username

    if update_data.new_password:
        current_user.hashed_password = get_password_hash(update_data.new_password)

    await db.commit()
    return {"message": "Account updated successfully"}
