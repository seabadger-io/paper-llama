import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...api.deps import get_current_user
from ...core.config import settings as core_settings
from ...core.scheduler import (
    get_pending_documents_count,
    trigger_workflow,
    update_scheduler,
)
from ...core.security import get_password_hash, verify_password
from ...db.models import AdminUser, AppSettings, DocumentChangeLog, ProcessedDocument
from ...db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)


class SettingsUpdate(BaseModel):
    paperless_url: str | None = None
    paperless_token: str | None = None
    ai_backend: str = "ollama"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str | None = None
    ollama_timeout: int = 300
    llamacpp_url: str = "http://localhost:8080"
    llamacpp_model: str | None = None
    llamacpp_timeout: int = 300
    max_retries: int = 3
    update_title: bool = True
    update_correspondent: bool = True
    update_document_type: bool = True
    update_tags: bool = True
    max_tags: int = 5
    generate_correspondent: bool = False
    generate_document_type: bool = False
    generate_tags: bool = False
    update_creation_date: bool = False
    document_word_limit: int = 1500
    schedule_interval_minutes: int = 0
    remove_query_tag: bool = True
    query_tag_id: int | None = None
    force_process_tag_id: int | None = None
    custom_prompt: str | None = None
    server_timezone: str = "UTC"
    metadata_use_system_defaults: bool = False
    metadata_owner_id: int | None = None
    metadata_view_users: list[int] = []
    metadata_view_groups: list[int] = []
    metadata_edit_users: list[int] = []
    metadata_edit_groups: list[int] = []
    vision_fallback: str = "off"
    vision_pages: int = 3


class AdminAccountInfo(BaseModel):
    username: str


class AdminAccountUpdate(BaseModel):
    current_password: str
    new_username: str | None = None
    new_password: str | None = None


class SetupStatus(BaseModel):
    is_setup: bool


@router.get("/status", response_model=SetupStatus)
async def get_setup_status(db: AsyncSession = Depends(get_db)):
    """Check if the application has been set up."""
    admin_query = select(AdminUser).limit(1)
    admin_res = await db.execute(admin_query)
    has_admin = admin_res.scalar_one_or_none() is not None

    settings_query = select(AppSettings).limit(1)
    sett_res = await db.execute(settings_query)
    has_settings = sett_res.scalar_one_or_none() is not None

    return {"is_setup": has_admin and has_settings}


@router.get("/settings", response_model=SettingsUpdate)
async def get_current_settings(
    db: AsyncSession = Depends(get_db), current_user: AdminUser = Depends(get_current_user)
):
    query = select(AppSettings).limit(1)
    result = await db.execute(query)
    settings = result.scalar_one_or_none()

    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    return SettingsUpdate(
        paperless_url=settings.paperless_url,
        paperless_token=settings.paperless_token,
        ai_backend=settings.ai_backend if settings.ai_backend is not None else "ollama",
        ollama_url=settings.ollama_url,
        ollama_model=settings.ollama_model,
        ollama_timeout=settings.ollama_timeout if settings.ollama_timeout is not None else 300,
        llamacpp_url=settings.llamacpp_url
        if settings.llamacpp_url is not None
        else "http://localhost:8080",
        llamacpp_model=settings.llamacpp_model,
        llamacpp_timeout=settings.llamacpp_timeout
        if settings.llamacpp_timeout is not None
        else 300,
        max_retries=settings.max_retries if settings.max_retries is not None else 3,
        update_title=settings.update_title,
        update_correspondent=settings.update_correspondent,
        update_document_type=settings.update_document_type,
        update_tags=settings.update_tags,
        max_tags=settings.max_tags if settings.max_tags is not None else 5,
        generate_correspondent=settings.generate_correspondent
        if settings.generate_correspondent is not None
        else False,
        generate_document_type=settings.generate_document_type
        if settings.generate_document_type is not None
        else False,
        generate_tags=settings.generate_tags if settings.generate_tags is not None else False,
        update_creation_date=settings.update_creation_date
        if settings.update_creation_date is not None
        else False,
        document_word_limit=settings.document_word_limit,
        schedule_interval_minutes=settings.schedule_interval_minutes,
        remove_query_tag=settings.remove_query_tag,
        query_tag_id=settings.query_tag_id,
        force_process_tag_id=settings.force_process_tag_id,
        custom_prompt=settings.custom_prompt,
        server_timezone=core_settings.TZ,
        metadata_use_system_defaults=settings.metadata_use_system_defaults
        if settings.metadata_use_system_defaults is not None
        else False,
        metadata_owner_id=settings.metadata_owner_id,
        metadata_view_users=settings.metadata_view_users or [],
        metadata_view_groups=settings.metadata_view_groups or [],
        metadata_edit_users=settings.metadata_edit_users or [],
        metadata_edit_groups=settings.metadata_edit_groups or [],
        vision_fallback=settings.vision_fallback or "off",
        vision_pages=settings.vision_pages if settings.vision_pages is not None else 3,
    )


@router.put("/settings")
async def update_settings(
    settings_data: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user),
):
    query = select(AppSettings).limit(1)
    result = await db.execute(query)
    app_settings = result.scalar_one_or_none()

    if not app_settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    app_settings.paperless_url = settings_data.paperless_url
    app_settings.paperless_token = settings_data.paperless_token
    app_settings.ai_backend = settings_data.ai_backend
    app_settings.ollama_url = settings_data.ollama_url
    app_settings.ollama_model = settings_data.ollama_model
    app_settings.ollama_timeout = settings_data.ollama_timeout
    app_settings.llamacpp_url = settings_data.llamacpp_url
    app_settings.llamacpp_model = settings_data.llamacpp_model
    app_settings.llamacpp_timeout = settings_data.llamacpp_timeout
    app_settings.max_retries = settings_data.max_retries
    app_settings.update_title = settings_data.update_title
    app_settings.update_correspondent = settings_data.update_correspondent
    app_settings.update_document_type = settings_data.update_document_type
    app_settings.update_tags = settings_data.update_tags
    app_settings.max_tags = settings_data.max_tags
    app_settings.generate_correspondent = settings_data.generate_correspondent
    app_settings.generate_document_type = settings_data.generate_document_type
    app_settings.generate_tags = settings_data.generate_tags
    app_settings.update_creation_date = settings_data.update_creation_date
    app_settings.document_word_limit = settings_data.document_word_limit
    app_settings.schedule_interval_minutes = settings_data.schedule_interval_minutes
    app_settings.remove_query_tag = settings_data.remove_query_tag
    app_settings.query_tag_id = settings_data.query_tag_id
    app_settings.force_process_tag_id = settings_data.force_process_tag_id
    app_settings.custom_prompt = settings_data.custom_prompt
    app_settings.metadata_use_system_defaults = settings_data.metadata_use_system_defaults
    app_settings.metadata_owner_id = settings_data.metadata_owner_id
    app_settings.metadata_view_users = settings_data.metadata_view_users
    app_settings.metadata_view_groups = settings_data.metadata_view_groups
    app_settings.metadata_edit_users = settings_data.metadata_edit_users
    app_settings.metadata_edit_groups = settings_data.metadata_edit_groups
    app_settings.vision_fallback = settings_data.vision_fallback
    app_settings.vision_pages = settings_data.vision_pages

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


@router.get("/processing")
async def get_processing(
    db: AsyncSession = Depends(get_db), current_user: AdminUser = Depends(get_current_user)
):
    """Fetch documents currently being processed."""
    query = select(ProcessedDocument).where(ProcessedDocument.status == "processing")
    result = await db.execute(query)
    docs = result.scalars().all()
    return [{"document_id": d.document_id, "started_at": d.processed_at} for d in docs]


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
            }
            for log in logs
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/paperless/users")
async def get_paperless_users(
    db: AsyncSession = Depends(get_db), current_user: AdminUser = Depends(get_current_user)
):
    """Fetch users from Paperless."""
    query = select(AppSettings).limit(1)
    result = await db.execute(query)
    settings = result.scalar_one_or_none()
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
    query = select(AppSettings).limit(1)
    result = await db.execute(query)
    settings = result.scalar_one_or_none()
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
