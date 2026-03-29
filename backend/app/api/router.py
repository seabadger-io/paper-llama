from fastapi import APIRouter

from .endpoints import admin, auth, webhook, wizard

api_router = APIRouter()

# Authentication
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Admin functionality
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

# Webhooks and Setup
api_router.include_router(webhook.router, tags=["webhook"])
api_router.include_router(wizard.router, tags=["wizard"])
