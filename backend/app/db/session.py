import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

# The database file is in /data/ relative to the project root.
# This file is now at backend/app/db/session.py
# Go up 3 levels to get to project root (db -> app -> backend)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
DB_PATH = os.path.join(BASE_DIR, "data", "paper_llama.db")
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db():
    """Dependency to get the database session"""
    async with AsyncSessionLocal() as session:
        yield session

async def init_engine():
    """Initialize the database metadata."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
