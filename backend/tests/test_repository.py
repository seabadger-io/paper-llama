from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.app.db.models import AppSettings
from backend.app.db.repository import apply_settings, get_app_settings
from backend.app.schemas.settings import SettingsUpdate


@pytest.mark.asyncio
async def test_get_app_settings():
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_settings = AppSettings(paperless_url="http://paperless")
    mock_result.scalar_one_or_none.return_value = mock_settings
    mock_session.execute.return_value = mock_result

    result = await get_app_settings(mock_session)
    assert result == mock_settings
    mock_session.execute.assert_called_once()


def test_apply_settings_from_schema():
    app_settings = AppSettings(
        paperless_url="http://old-url",
        ollama_api_key="secret-ollama-key",
        llamacpp_api_key="secret-llamacpp-key",
        webhook_tokens="old-token",
    )

    update = SettingsUpdate(
        paperless_url="http://new-url",
        ollama_api_key=None,  # Should NOT overwrite existing secret
        llamacpp_api_key="new-llama-key",  # Should update
        webhook_tokens="   new-tok1, new-tok2   ",  # Should strip whitespace
    )

    apply_settings(app_settings, update)

    assert app_settings.paperless_url == "http://new-url"
    assert app_settings.ollama_api_key == "secret-ollama-key"
    assert app_settings.llamacpp_api_key == "new-llama-key"
    assert app_settings.webhook_tokens == "new-tok1, new-tok2"


def test_apply_settings_from_dict():
    app_settings = AppSettings(
        paperless_url="http://old-url",
        schedule_interval_minutes=0,
    )

    data = {
        "paperless_url": "http://updated-url",
        "schedule_interval_minutes": 30,
        "non_existent_column": "ignore_me",
        "server_timezone": "America/New_York",
    }

    apply_settings(app_settings, data)

    assert app_settings.paperless_url == "http://updated-url"
    assert app_settings.schedule_interval_minutes == 30
    assert not hasattr(app_settings, "non_existent_column")
