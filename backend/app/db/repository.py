from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from .models import AppSettings


async def get_app_settings(db: AsyncSession) -> AppSettings | None:
    """Fetch the singleton application settings row."""
    query = select(AppSettings).limit(1)
    result = await db.execute(query)
    return result.scalar_one_or_none()


def apply_settings(app_settings: AppSettings, data: BaseModel | dict) -> AppSettings:
    """
    Applies settings from an AppSettingsBase schema or dict to an AppSettings DB model instance.
    Preserves existing API keys if the new value is None.
    Strips whitespace from webhook_tokens.
    """
    if isinstance(data, BaseModel):
        data_dict = data.model_dump(exclude_unset=False)
    elif isinstance(data, dict):
        data_dict = dict(data)
    else:
        raise ValueError(f"Expected BaseModel or dict, got {type(data)}")

    # Non-database columns that might be present on request schemas
    ignored_fields = {"server_timezone", "username", "password"}

    for key, value in data_dict.items():
        if key in ignored_fields:
            continue
        if not hasattr(app_settings, key):
            continue

        # If API key is None, do not overwrite existing DB value
        if key in ("ollama_api_key", "llamacpp_api_key") and value is None:
            continue

        if key == "webhook_tokens":
            value = value.strip() if value else ""

        setattr(app_settings, key, value)

    return app_settings
