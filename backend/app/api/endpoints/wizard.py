import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...core.security import get_password_hash
from ...db.models import AdminUser, AppSettings
from ...db.repository import apply_settings
from ...db.session import get_db
from ...schemas.settings import SetupWizardRequest
from ...services.llamacpp import LlamaCppClient
from ...services.ollama import OllamaClient
from ...services.paperless import PaperlessClient

router = APIRouter()
logger = logging.getLogger(__name__)


class TestOllamaRequest(BaseModel):
    ollama_url: str
    ollama_api_key: str | None = None
    api_key: str | None = None


class TestLlamacppRequest(BaseModel):
    llamacpp_url: str
    llamacpp_api_key: str | None = None
    api_key: str | None = None


class TestPaperlessRequest(BaseModel):
    paperless_url: str
    paperless_token: str


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
        username=request.username, hashed_password=get_password_hash(request.password)
    )
    db.add(new_admin)

    # Create settings
    new_settings = AppSettings()
    apply_settings(new_settings, request)
    db.add(new_settings)

    await db.commit()

    return {"status": "ok", "message": "Setup completed successfully"}



@router.post("/test-ollama")
async def test_ollama(request: TestOllamaRequest):
    """Test Ollama connection and fetch available models."""
    client = OllamaClient(
        base_url=request.ollama_url,
        api_key=request.ollama_api_key or request.api_key,
    )
    try:
        models = await client.get_models()
        return {"status": "ok", "models": [m.get("name") for m in models]}
    except Exception as e:
        logger.error(f"Test Ollama failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/test-llamacpp")
async def test_llamacpp(request: TestLlamacppRequest):
    """Test Llama.cpp connection and fetch available models."""
    client = LlamaCppClient(
        base_url=request.llamacpp_url,
        api_key=request.llamacpp_api_key or request.api_key,
    )
    try:
        models = await client.get_models()
        return {"status": "ok", "models": [m.get("name", m.get("id")) for m in models]}
    except Exception as e:
        logger.error(f"Test Llama.cpp failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/test-paperless")
async def test_paperless(request: TestPaperlessRequest):
    """Test Paperless connection."""
    client = PaperlessClient(base_url=request.paperless_url, token=request.paperless_token)
    try:
        tags = await client.get_tags()
        users = await client.get_users()
        groups = await client.get_groups()
        return {
            "status": "ok",
            "tags_count": len(tags),
            "tags": tags,
            "users": users,
            "groups": groups,
        }
    except Exception as e:
        logger.error(f"Test Paperless failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
