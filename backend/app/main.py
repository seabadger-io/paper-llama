import asyncio
import logging
import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import update
from sqlalchemy.future import select

from .api.router import api_router
from .core.scheduler import start_scheduler, trigger_workflow, update_scheduler
from .db.models import AppSettings, ProcessedDocument
from .db.session import AsyncSessionLocal, init_engine

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database...")
    await init_engine()

    logger.info("Starting scheduler...")
    start_scheduler()

    # Initialize scheduler interval from DB if set
    async with AsyncSessionLocal() as session:
        # Cleanup any stuck processing states from previous crashes
        await session.execute(
            update(ProcessedDocument)
            .where(ProcessedDocument.status == "processing")
            .values(status="error", error_message="Interrupted by application restart")
        )
        await session.commit()

        query = select(AppSettings).limit(1)
        result = await session.execute(query)
        settings = result.scalar_one_or_none()
        if settings and settings.schedule_interval_minutes > 0:
            update_scheduler(settings.schedule_interval_minutes)
        if settings:
            # If the wizard has been run already, trigger a processing cycle on startup
            logger.info("Triggering initial processing cycle in background...")
            asyncio.create_task(trigger_workflow())

    yield
    # Shutdown
    logger.info("Shutting down...")


app = FastAPI(title="Paper Llama API", lifespan=lifespan)

# Allow CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Router (includes all sub-routers)
app.include_router(api_router, prefix="/api")

# Serve Frontend SPA
# We expect the frontend to be in a sibling directory to 'app'
# Since main.py is in app/, we go up two levels to get to project root
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(backend_dir)
frontend_dir = os.path.join(project_root, "frontend")
assets_dir = os.path.join(frontend_dir, "assets")

if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/api/health")
def healthcheck():
    return {"status": "ok"}


@app.get("/{catchall:path}")
def serve_spa(catchall: str):
    if catchall.startswith("api/"):
        return {"error": "Not found"}

    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Frontend not found"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8021, reload=True)
