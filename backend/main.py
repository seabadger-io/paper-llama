from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
import os
import logging
from sqlalchemy.future import select

from .database import init_engine, AsyncSessionLocal
from .models import AppSettings
from .scheduler import start_scheduler, update_scheduler
from .routes import admin, wizard, webhook

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
        query = select(AppSettings).limit(1)
        result = await session.execute(query)
        settings = result.scalar_one_or_none()
        if settings and settings.schedule_interval_minutes > 0:
            update_scheduler(settings.schedule_interval_minutes)
            
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

# API Routers
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(wizard.router, prefix="/api", tags=["wizard"])
app.include_router(webhook.router, prefix="/api", tags=["webhook"])

@app.get("/api/health")
def healthcheck():
    return {"status": "ok"}

# Serve Frontend SPA
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
assets_dir = os.path.join(frontend_dir, "assets")

if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/{catchall:path}")
def serve_spa(catchall: str):
    if catchall.startswith("api/"):
        return {"error": "Not found"}
        
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Frontend not found"}

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8021, reload=True)
