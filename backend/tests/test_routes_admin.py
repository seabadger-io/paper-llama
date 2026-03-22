from unittest.mock import MagicMock

import pytest

from backend.models import AdminUser, AppSettings
from backend.routes.admin import (
    SettingsUpdate,
    get_current_settings,
    get_setup_status,
    update_settings,
)


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
        update_title=True,
        update_correspondent=True,
        update_document_type=True,
        update_tags=True,
        document_word_limit=1500,
        schedule_interval_minutes=15,
        remove_query_tag=True,
        query_tag_id=1,
        force_process_tag_id=None
    )
    mock_db = MockDB(mock_settings)

    result = await get_current_settings(db=mock_db, current_user=mock_user)
    assert result.paperless_url == "http://test"
    assert result.remove_query_tag is True

@pytest.mark.asyncio
async def test_update_settings(mocker):
    mock_user = AdminUser(username="test")
    mocker.patch("backend.routes.admin.update_scheduler")

    mock_settings = AppSettings()
    mock_db = MockDB(mock_settings)

    update_data = SettingsUpdate(
        paperless_url="http://new-url",
        remove_query_tag=False,
        ollama_url="http://new-ollama",
        schedule_interval_minutes=15
    )

    response = await update_settings(update_data, db=mock_db, current_user=mock_user)

    assert response == {"message": "Settings updated successfully"}
    assert mock_settings.paperless_url == "http://new-url"
    assert mock_settings.schedule_interval_minutes == 15
    assert mock_db.commit_called_count == 1
