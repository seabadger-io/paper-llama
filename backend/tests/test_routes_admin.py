from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.app.api.endpoints.admin import (
    AdminAccountUpdate,
    SettingsUpdate,
    get_current_settings,
    get_events,
    get_log_details,
    get_setup_status,
    reprocess_single_document,
    trigger_log_cleanup,
    update_admin_account,
    update_settings,
)
from backend.app.db.models import AdminUser, AppSettings, DocumentChangeLog, ProcessedDocument


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
        webhook_tokens="tok1, tok2",
    )

    response = await update_settings(update_data, db=mock_db, current_user=mock_user)

    assert response == {"message": "Settings updated successfully"}
    assert mock_settings.paperless_url == "http://new-url"
    assert mock_settings.schedule_interval_minutes == 15
    assert mock_settings.webhook_tokens == "tok1, tok2"
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


def test_settings_validation_negative_log_settings():
    with pytest.raises(ValueError, match="Value cannot be negative"):
        SettingsUpdate(log_retention_days=-1)
    with pytest.raises(ValueError, match="Value cannot be negative"):
        SettingsUpdate(log_compact_after_days=-5)
    with pytest.raises(ValueError, match="Value cannot be negative"):
        SettingsUpdate(log_max_ai_chars=-100)


@pytest.mark.asyncio
async def test_get_log_details_success():
    log = DocumentChangeLog(
        id=123,
        document_id=456,
        prompt_used="Sample prompt text",
        ai_response='{"title": "Test Title"}',
    )
    mock_db = MockDB(log)
    user = AdminUser(username="admin")

    details = await get_log_details(log_id=123, db=mock_db, current_user=user)
    assert details["id"] == 123
    assert details["document_id"] == 456
    assert details["prompt_used"] == "Sample prompt text"
    assert details["ai_response"] == '{"title": "Test Title"}'
    assert details["has_ai_interaction"] is True


@pytest.mark.asyncio
async def test_get_log_details_not_found():
    from fastapi import HTTPException

    mock_db = MockDB(None)
    user = AdminUser(username="admin")

    with pytest.raises(HTTPException) as exc_info:
        await get_log_details(log_id=999, db=mock_db, current_user=user)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_trigger_log_cleanup():
    from unittest.mock import patch

    mock_settings = AppSettings(
        log_retention_days=60,
        log_compact_after_days=15,
    )
    mock_db = MockDB(mock_settings)
    user = AdminUser(username="admin")

    with patch(
        "backend.app.api.endpoints.admin.perform_log_maintenance",
        return_value={"deleted_logs": 5, "compacted_logs": 12},
    ) as mock_maint:
        result = await trigger_log_cleanup(db=mock_db, current_user=user)
        assert result["deleted_logs"] == 5
        assert result["compacted_logs"] == 12
        assert result["message"] == "Log maintenance completed successfully"
        mock_maint.assert_called_once_with(session=mock_db, settings=mock_settings)


@pytest.mark.asyncio
async def test_get_events_endpoint():
    mock_request = MagicMock()
    mock_request.is_disconnected = AsyncMock(return_value=False)
    user = AdminUser(username="admin")

    response = await get_events(request=mock_request, token="valid_token", current_user=user)
    assert response.status_code == 200
    assert response.media_type == "text/event-stream"
    assert response.headers["Cache-Control"] == "no-cache"


@pytest.mark.asyncio
async def test_reprocess_single_document_success():
    import backend.app.core.scheduler as sched

    sched.active_document_queue.clear()
    sched.current_document_id = None
    mock_db = MockDB(None)
    user = AdminUser(username="admin")

    with patch("backend.app.core.scheduler.trigger_workflow", new_callable=AsyncMock):
        result = await reprocess_single_document(
            document_id=101,
            db=mock_db,
            current_user=user,
        )
        assert result == {
            "message": "Document 101 added to processing queue",
            "document_id": 101,
        }
        assert 101 in sched.active_document_queue


@pytest.mark.asyncio
async def test_reprocess_single_document_invalid_id():
    from fastapi import HTTPException

    mock_db = MockDB(None)
    user = AdminUser(username="admin")

    with pytest.raises(HTTPException) as exc_info:
        await reprocess_single_document(
            document_id=0,
            db=mock_db,
            current_user=user,
        )
    assert exc_info.value.status_code == 400

    with pytest.raises(HTTPException) as exc_info_neg:
        await reprocess_single_document(
            document_id=-5,
            db=mock_db,
            current_user=user,
        )
    assert exc_info_neg.value.status_code == 400


@pytest.mark.asyncio
async def test_reprocess_single_document_conflict_when_currently_processing():
    from datetime import UTC, datetime

    from fastapi import HTTPException

    proc_doc = ProcessedDocument(
        document_id=102,
        status="processing",
        processed_at=datetime.now(UTC),
    )
    mock_db = MockDB(proc_doc)
    user = AdminUser(username="admin")

    with pytest.raises(HTTPException) as exc_info:
        await reprocess_single_document(
            document_id=102,
            db=mock_db,
            current_user=user,
        )
    assert exc_info.value.status_code == 409
    assert "already being processed" in exc_info.value.detail


@pytest.mark.asyncio
async def test_reprocess_single_document_conflict_when_already_in_queue():
    from fastapi import HTTPException

    import backend.app.core.scheduler as sched

    sched.active_document_queue = [105]
    mock_db = MockDB(None)
    user = AdminUser(username="admin")

    with pytest.raises(HTTPException) as exc_info:
        await reprocess_single_document(
            document_id=105,
            db=mock_db,
            current_user=user,
        )
    assert exc_info.value.status_code == 409
    assert "already in the processing queue" in exc_info.value.detail


@pytest.mark.asyncio
async def test_reprocess_single_document_allows_stale_processing():
    from datetime import UTC, datetime, timedelta

    import backend.app.core.scheduler as sched

    sched.active_document_queue.clear()
    sched.current_document_id = None

    stale_time = datetime.now(UTC) - timedelta(minutes=45)
    proc_doc = ProcessedDocument(
        document_id=103,
        status="processing",
        processed_at=stale_time,
    )
    mock_db = MockDB(proc_doc)
    user = AdminUser(username="admin")

    with patch("backend.app.core.scheduler.trigger_workflow", new_callable=AsyncMock):
        result = await reprocess_single_document(
            document_id=103,
            db=mock_db,
            current_user=user,
        )
        assert result["document_id"] == 103
        assert 103 in sched.active_document_queue


def test_admin_account_update_validation():
    # Password < 8 characters should fail
    with pytest.raises(ValueError, match="at least 8 characters"):
        AdminAccountUpdate(current_password="oldpassword", new_password="short")

    # Empty new_password should fail
    with pytest.raises(ValueError, match="at least 8 characters"):
        AdminAccountUpdate(current_password="oldpassword", new_password="")

    # Empty/whitespace new_username should fail
    with pytest.raises(ValueError, match="cannot be empty"):
        AdminAccountUpdate(current_password="oldpassword", new_username="   ")

    # Valid data should pass
    update = AdminAccountUpdate(
        current_password="oldpassword",
        new_username=" newadmin ",
        new_password="newvalidpassword123",
    )
    assert update.new_username == "newadmin"
    assert update.new_password == "newvalidpassword123"

    # None new_password / new_username should pass
    update_none = AdminAccountUpdate(current_password="oldpassword")
    assert update_none.new_username is None
    assert update_none.new_password is None


@pytest.mark.asyncio
async def test_update_admin_account_success():
    from backend.app.core.security import get_password_hash, verify_password

    user = AdminUser(username="admin", hashed_password=get_password_hash("currentpass123"))
    mock_db = MockDB(None)

    update_data = AdminAccountUpdate(
        current_password="currentpass123",
        new_username="updatedadmin",
        new_password="newsecretpassword",
    )

    result = await update_admin_account(update_data, db=mock_db, current_user=user)
    assert result == {"message": "Account updated successfully"}
    assert user.username == "updatedadmin"
    assert verify_password("newsecretpassword", user.hashed_password)
    assert mock_db.commit_called_count == 1
