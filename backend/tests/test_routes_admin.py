from unittest.mock import MagicMock

import pytest

from backend.app.api.endpoints.admin import (
    SettingsUpdate,
    get_current_settings,
    get_setup_status,
    update_settings,
)
from backend.app.db.models import AdminUser, AppSettings


class MockDB:
    def __init__(self, scalar_return):
        self.scalar_return = scalar_return
        self.commit_called_count = 0

    async def execute(self, query):
        res = MagicMock()
        if isinstance(self.scalar_return, list):
            res.scalar_one_or_none.side_effect = self.scalar_return
        else:
            res.scalar_one_or_none.return_value = self.scalar_return
        return res

    async def commit(self):
        self.commit_called_count += 1


@pytest.mark.asyncio
async def test_get_setup_status_false():
    mock_db = MockDB(None)
    status = await get_setup_status(db=mock_db)
    assert status == {"is_setup": False}


@pytest.mark.asyncio
async def test_get_setup_status_true():
    mock_db = MockDB([AdminUser(), AppSettings()])
    status = await get_setup_status(db=mock_db)
    assert status == {"is_setup": True}


@pytest.mark.asyncio
async def test_get_current_settings():
    mock_user = AdminUser(username="test")
    mock_settings = AppSettings(
        paperless_url="http://test",
        paperless_token="token",
        ollama_url="url",
        ollama_model="model",
        ollama_timeout=300,
        update_title=True,
        update_correspondent=True,
        update_document_type=True,
        update_tags=True,
        update_creation_date=True,
        document_word_limit=1500,
        schedule_interval_minutes=15,
        remove_query_tag=True,
        query_tag_id=1,
        force_process_tag_id=None,
    )
    mock_db = MockDB(mock_settings)

    result = await get_current_settings(db=mock_db, current_user=mock_user)
    assert result.paperless_url == "http://test"
    assert result.remove_query_tag is True
    assert result.update_creation_date is True


@pytest.mark.asyncio
async def test_get_current_settings_handles_none_for_creation_date():
    mock_user = AdminUser(username="test")
    # Simulate existing DB row where the new column is NULL
    mock_settings = AppSettings(
        update_creation_date=None,
        ollama_timeout=None,
        update_title=True,
        update_correspondent=True,
        update_document_type=True,
        update_tags=True,
        remove_query_tag=True,
        document_word_limit=1500,
        schedule_interval_minutes=0,
        ollama_url="http://ollama",
        ollama_api_key="test-ollama-key",
        llamacpp_api_key="test-llamacpp-key",
    )
    mock_db = MockDB(mock_settings)

    result = await get_current_settings(db=mock_db, current_user=mock_user)
    assert result.update_creation_date is False
    assert result.ollama_timeout == 300
    assert result.max_tags == 5
    assert result.generate_correspondent is False
    assert result.generate_document_type is False
    assert result.generate_tags is False
    assert result.ollama_api_key == "test-ollama-key"
    assert result.llamacpp_api_key == "test-llamacpp-key"


@pytest.mark.asyncio
async def test_update_settings(mocker):
    mock_user = AdminUser(username="test")
    mocker.patch("backend.app.api.endpoints.admin.update_scheduler")

    mock_settings = AppSettings()
    mock_db = MockDB(mock_settings)

    update_data = SettingsUpdate(
        paperless_url="http://new-url",
        remove_query_tag=False,
        ollama_url="http://new-ollama",
        ollama_timeout=600,
        ollama_api_key="new-key",
        llamacpp_api_key="new-llama-key",
        schedule_interval_minutes=15,
    )

    response = await update_settings(update_data, db=mock_db, current_user=mock_user)

    assert response == {"message": "Settings updated successfully"}
    assert mock_settings.paperless_url == "http://new-url"
    assert mock_settings.schedule_interval_minutes == 15
    assert mock_settings.ollama_timeout == 600
    assert mock_settings.ollama_api_key == "new-key"
    assert mock_settings.llamacpp_api_key == "new-llama-key"
    assert mock_db.commit_called_count == 1


@pytest.mark.asyncio
async def test_settings_advanced_parameters(mocker):
    mock_user = AdminUser(username="test")
    mocker.patch("backend.app.api.endpoints.admin.update_scheduler")

    mock_settings = AppSettings(
        paperless_url="http://test",
        paperless_token="token",
        ollama_url="http://localhost:11434",
        update_title=True,
        update_correspondent=True,
        update_document_type=True,
        update_tags=True,
        document_word_limit=1500,
        schedule_interval_minutes=15,
        remove_query_tag=True,
        ollama_temperature=0.7,
        ollama_context_size=8192,
        ollama_extra_params='{"top_p": 0.9}',
        llamacpp_temperature=0.5,
        llamacpp_max_tokens=2048,
        llamacpp_extra_params='{"top_k": 50}',
    )
    mock_db = MockDB(mock_settings)

    # Test GET
    result = await get_current_settings(db=mock_db, current_user=mock_user)
    assert result.ollama_temperature == 0.7
    assert result.ollama_context_size == 8192
    assert result.ollama_extra_params == '{"top_p": 0.9}'
    assert result.llamacpp_temperature == 0.5
    assert result.llamacpp_max_tokens == 2048
    assert result.llamacpp_extra_params == '{"top_k": 50}'

    # Test PUT
    update_data = SettingsUpdate(
        ollama_temperature=0.2,
        ollama_context_size=16384,
        ollama_extra_params='{"top_p": 0.95}',
        llamacpp_temperature=0.3,
        llamacpp_max_tokens=4096,
        llamacpp_extra_params='{"top_k": 40}',
    )
    response = await update_settings(update_data, db=mock_db, current_user=mock_user)
    assert response == {"message": "Settings updated successfully"}
    assert mock_settings.ollama_temperature == 0.2
    assert mock_settings.ollama_context_size == 16384
    assert mock_settings.ollama_extra_params == '{"top_p": 0.95}'
    assert mock_settings.llamacpp_temperature == 0.3
    assert mock_settings.llamacpp_max_tokens == 4096
    assert mock_settings.llamacpp_extra_params == '{"top_k": 40}'


def test_settings_validation_invalid_json():
    with pytest.raises(ValueError, match="Invalid JSON"):
        SettingsUpdate(ollama_extra_params="not valid json")


def test_settings_validation_reserved_key():
    with pytest.raises(ValueError, match="Reserved parameter"):
        SettingsUpdate(ollama_extra_params='{"model": "override", "top_p": 0.9}')


def test_settings_validation_temperature_negative():
    with pytest.raises(ValueError, match="Temperature cannot be negative"):
        SettingsUpdate(ollama_temperature=-0.5)


def test_settings_validation_context_size_invalid():
    with pytest.raises(ValueError, match="Value must be greater than zero"):
        SettingsUpdate(ollama_context_size=0)



