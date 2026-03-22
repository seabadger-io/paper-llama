import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..database import get_db
from ..models import AdminUser, AppSettings
from ..ollama_client import OllamaClient
from ..paperless_client import PaperlessClient

router = APIRouter()
logger = logging.getLogger(__name__)

class TestOllamaRequest(BaseModel):
    ollama_url: str

class TestPaperlessRequest(BaseModel):
    paperless_url: str
    paperless_token: str

class SetupWizardRequest(BaseModel):
    username: str
    password: str
    paperless_url: str
    paperless_token: str
    ollama_url: str
    ollama_model: str
    update_title: bool = True
    update_correspondent: bool = True
    update_document_type: bool = True
    update_tags: bool = True
    document_word_limit: int = 1500
    schedule_interval_minutes: int
    remove_query_tag: bool = True
    query_tag_id: int | None = None
    force_process_tag_id: int | None = None
    custom_prompt: str | None = None

@router.post("/wizard")
async def run_setup_wizard(request: SetupWizardRequest, db: AsyncSession = Depends(get_db)):
    """Run once to configure the application."""

    # Check if already setup
    admin_query = select(AdminUser).limit(1)
    admin_res = await db.execute(admin_query)
    if admin_res.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Application already configured.")

    # Create admin user
    new_admin = AdminUser(
        username=request.username,
        hashed_password=AdminUser.get_password_hash(request.password)
    )
    db.add(new_admin)

    # Create settings
    new_settings = AppSettings(
        paperless_url=request.paperless_url,
        paperless_token=request.paperless_token,
        ollama_url=request.ollama_url,
        ollama_model=request.ollama_model,
        update_title=request.update_title,
        update_correspondent=request.update_correspondent,
        update_document_type=request.update_document_type,
        update_tags=request.update_tags,
        document_word_limit=request.document_word_limit,
        schedule_interval_minutes=request.schedule_interval_minutes,
        remove_query_tag=request.remove_query_tag,
        query_tag_id=request.query_tag_id,
        force_process_tag_id=request.force_process_tag_id,
        custom_prompt=request.custom_prompt
    )
    db.add(new_settings)

    await db.commit()

    return {"status": "ok", "message": "Setup completed successfully"}

@router.post("/test-ollama")
async def test_ollama(request: TestOllamaRequest):
    """Test Ollama connection and fetch available models."""
    client = OllamaClient(base_url=request.ollama_url)
    try:
        models = await client.get_models()
        return {"status": "ok", "models": [m.get("name") for m in models]}
    except Exception as e:
        logger.error(f"Test Ollama failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/test-paperless")
async def test_paperless(request: TestPaperlessRequest):
    """Test Paperless connection."""
    client = PaperlessClient(base_url=request.paperless_url, token=request.paperless_token)
    try:
        tags = await client.get_tags()
        return {"status": "ok", "tags_count": len(tags), "tags": tags}
    except Exception as e:
        logger.error(f"Test Paperless failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
