import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..database import get_db
from ..dependencies import create_access_token, get_current_user
from ..models import AdminUser, AppSettings, DocumentChangeLog, ProcessedDocument
from ..scheduler import trigger_workflow, update_scheduler

router = APIRouter()
logger = logging.getLogger(__name__)

# --- Models ---
class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class SettingsUpdate(BaseModel):
    paperless_url: str | None = None
    paperless_token: str | None = None
    ollama_url: str = "http://localhost:11434"
    ollama_model: str | None = None
    ollama_timeout: int = 300
    update_title: bool = True
    update_correspondent: bool = True
    update_document_type: bool = True
    update_tags: bool = True
    update_creation_date: bool = False
    document_word_limit: int = 1500
    schedule_interval_minutes: int = 0
    remove_query_tag: bool = True
    query_tag_id: int | None = None
    force_process_tag_id: int | None = None
    custom_prompt: str | None = None

class SetupStatus(BaseModel):
    is_setup: bool

# --- Setup Status ---
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

# --- Authentication ---
@router.post("/login", response_model=Token)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    query = select(AdminUser).where(AdminUser.username == request.username)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user or not user.verify_password(request.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# --- Settings ---
@router.get("/settings", response_model=SettingsUpdate)
async def get_current_settings(
    db: AsyncSession = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user)
):
    query = select(AppSettings).limit(1)
    result = await db.execute(query)
    settings = result.scalar_one_or_none()

    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    return SettingsUpdate(
        paperless_url=settings.paperless_url,
        paperless_token=settings.paperless_token,
        ollama_url=settings.ollama_url,
        ollama_model=settings.ollama_model,
        ollama_timeout=settings.ollama_timeout if settings.ollama_timeout is not None else 300,
        update_title=settings.update_title,
        update_correspondent=settings.update_correspondent,
        update_document_type=settings.update_document_type,
        update_tags=settings.update_tags,
        update_creation_date=settings.update_creation_date if settings.update_creation_date is not None else False,
        document_word_limit=settings.document_word_limit,
        schedule_interval_minutes=settings.schedule_interval_minutes,
        remove_query_tag=settings.remove_query_tag,
        query_tag_id=settings.query_tag_id,
        force_process_tag_id=settings.force_process_tag_id,
        custom_prompt=settings.custom_prompt
    )

@router.put("/settings")
async def update_settings(
    settings_data: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: AdminUser = Depends(get_current_user)
):
    query = select(AppSettings).limit(1)
    result = await db.execute(query)
    settings = result.scalar_one_or_none()

    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")

    settings.paperless_url = settings_data.paperless_url
    settings.paperless_token = settings_data.paperless_token
    settings.ollama_url = settings_data.ollama_url
    settings.ollama_model = settings_data.ollama_model
    settings.ollama_timeout = settings_data.ollama_timeout
    settings.update_title = settings_data.update_title
    settings.update_correspondent = settings_data.update_correspondent
    settings.update_document_type = settings_data.update_document_type
    settings.update_tags = settings_data.update_tags
    settings.update_creation_date = settings_data.update_creation_date
    settings.document_word_limit = settings_data.document_word_limit
    settings.schedule_interval_minutes = settings_data.schedule_interval_minutes
    settings.remove_query_tag = settings_data.remove_query_tag
    settings.query_tag_id = settings_data.query_tag_id
    settings.force_process_tag_id = settings_data.force_process_tag_id
    settings.custom_prompt = settings_data.custom_prompt

    await db.commit()

    # Update scheduler
    update_scheduler(settings.schedule_interval_minutes)

    return {"message": "Settings updated successfully"}

@router.post("/trigger")
async def trigger_processing(
    background_tasks: BackgroundTasks,
    current_user: AdminUser = Depends(get_current_user)
):
    """Manually trigger document processing."""
    background_tasks.add_task(trigger_workflow, from_webhook=True)
    return {"message": "Processing triggered"}

# --- Dashboard & Audit ---

@router.get("/processing")
async def get_processing(db: AsyncSession = Depends(get_db), current_user: AdminUser = Depends(get_current_user)):
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
    current_user: AdminUser = Depends(get_current_user)
):
    """Fetch the document change logs."""
    query = select(DocumentChangeLog).order_by(DocumentChangeLog.changed_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    logs = result.scalars().all()

    return [{
        "id": log.id,
        "document_id": log.document_id,
        "changed_at": log.changed_at,
        "original_state": log.original_state,
        "new_state": log.new_state
    } for log in logs]
