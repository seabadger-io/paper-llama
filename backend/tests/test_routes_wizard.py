from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from backend.app.api.endpoints import wizard
from backend.app.db.models import AdminUser, AppSettings


class MockDB:
    def __init__(self, scalar_return):
        self.scalar_return = scalar_return
        self.add_called_count = 0
        self.commit_called_count = 0
        self.added_items = []

    async def execute(self, query):
        res = MagicMock()
        res.scalar_one_or_none.return_value = self.scalar_return
        return res

    def add(self, item):
        self.add_called_count += 1
        self.added_items.append(item)

    async def commit(self):
        self.commit_called_count += 1


@pytest.mark.asyncio
async def test_run_setup_wizard_already_configured():
    mock_db = MockDB(AdminUser())

    request = wizard.SetupWizardRequest(
        username="admin",
        password="password",
        paperless_url="http://test",
        paperless_token="token",
        ollama_url="http://test",
        ollama_model="llama",
        schedule_interval_minutes=0,
    )

    with pytest.raises(HTTPException) as exc_info:
        await wizard.run_setup_wizard(request, db=mock_db)

    assert exc_info.value.status_code == 400
    assert "Application already configured" in exc_info.value.detail


@pytest.mark.asyncio
async def test_run_setup_wizard_success():
    mock_db = MockDB(None)

    request = wizard.SetupWizardRequest(
        username="admin",
        password="password",
        paperless_url="http://test",
        paperless_token="token",
        ollama_url="http://test",
        ollama_model="llama",
        schedule_interval_minutes=15,
    )

    response = await wizard.run_setup_wizard(request, db=mock_db)

    assert response == {"status": "ok", "message": "Setup completed successfully"}
    assert mock_db.add_called_count == 2
    assert mock_db.commit_called_count == 1


@pytest.mark.asyncio
async def test_run_setup_wizard_with_api_key():
    mock_db = MockDB(None)

    request = wizard.SetupWizardRequest(
        username="admin",
        password="password",
        paperless_url="http://test",
        paperless_token="token",
        ai_backend="llamacpp",
        ollama_url="http://test:11434",
        ollama_model="llama",
        llamacpp_url="http://test:8080",
        llamacpp_model="gpt-4o",
        llamacpp_api_key="sk-test-key-123",
        schedule_interval_minutes=10,
    )

    response = await wizard.run_setup_wizard(request, db=mock_db)
    assert response["status"] == "ok"
    settings_obj = [x for x in mock_db.added_items if isinstance(x, AppSettings)][0]
    assert settings_obj.llamacpp_api_key == "sk-test-key-123"


@pytest.mark.asyncio
async def test_test_ollama_endpoint_with_api_key(mocker):
    mock_client = mocker.patch("backend.app.api.endpoints.wizard.OllamaClient")
    instance = mock_client.return_value
    instance.get_models = AsyncMock(return_value=[{"name": "llama3:8b"}])

    res = await wizard.test_ollama(
        wizard.TestOllamaRequest(ollama_url="http://ollama:11434", ollama_api_key="ollama-key")
    )
    assert res == {"status": "ok", "models": ["llama3:8b"]}
    mock_client.assert_called_once_with(base_url="http://ollama:11434", api_key="ollama-key")


@pytest.mark.asyncio
async def test_test_llamacpp_endpoint_with_api_key(mocker):
    mock_client = mocker.patch("backend.app.api.endpoints.wizard.LlamaCppClient")
    instance = mock_client.return_value
    instance.get_models = AsyncMock(return_value=[{"id": "qwen2.5"}])

    res = await wizard.test_llamacpp(
        wizard.TestLlamacppRequest(llamacpp_url="http://llama:8080", api_key="sk-llamacpp-key")
    )
    assert res == {"status": "ok", "models": ["qwen2.5"]}
    mock_client.assert_called_once_with(base_url="http://llama:8080", api_key="sk-llamacpp-key")


@pytest.mark.asyncio
async def test_run_setup_wizard_with_advanced_ai_params():
    mock_db = MockDB(None)

    request = wizard.SetupWizardRequest(
        username="admin",
        password="password",
        paperless_url="http://test",
        paperless_token="token",
        ai_backend="ollama",
        ollama_url="http://test:11434",
        ollama_model="llama3",
        ollama_temperature=0.6,
        ollama_context_size=8192,
        ollama_extra_params='{"top_p": 0.95}',
        schedule_interval_minutes=10,
    )

    response = await wizard.run_setup_wizard(request, db=mock_db)
    assert response["status"] == "ok"
    settings_obj = [x for x in mock_db.added_items if isinstance(x, AppSettings)][0]
    assert settings_obj.ollama_temperature == 0.6
    assert settings_obj.ollama_context_size == 8192
    assert settings_obj.ollama_extra_params == '{"top_p": 0.95}'


def test_wizard_validation_reserved_key():
    with pytest.raises(ValueError, match="Reserved parameter"):
        wizard.SetupWizardRequest(
            username="admin",
            password="password",
            paperless_url="http://test",
            paperless_token="token",
            ollama_url="http://test:11434",
            ollama_model="llama3",
            ollama_extra_params='{"stream": true}',
            schedule_interval_minutes=10,
        )


@pytest.mark.asyncio
async def test_run_setup_wizard_preserves_empty_webhook_tokens():
    mock_db = MockDB(None)

    request = wizard.SetupWizardRequest(
        username="admin",
        password="password",
        paperless_url="http://test",
        paperless_token="token",
        ollama_url="http://test:11434",
        ollama_model="llama3",
        schedule_interval_minutes=10,
        webhook_tokens="",
    )

    response = await wizard.run_setup_wizard(request, db=mock_db)
    assert response["status"] == "ok"
    settings_obj = [x for x in mock_db.added_items if isinstance(x, AppSettings)][0]
    assert settings_obj.webhook_tokens == ""


@pytest.mark.asyncio
async def test_run_setup_wizard_accepts_custom_webhook_tokens():
    mock_db = MockDB(None)

    request = wizard.SetupWizardRequest(
        username="admin",
        password="password",
        paperless_url="http://test",
        paperless_token="token",
        ollama_url="http://test:11434",
        ollama_model="llama3",
        schedule_interval_minutes=10,
        webhook_tokens="my_custom_token_1, my_custom_token_2",
    )

    response = await wizard.run_setup_wizard(request, db=mock_db)
    assert response["status"] == "ok"
    settings_obj = [x for x in mock_db.added_items if isinstance(x, AppSettings)][0]
    assert settings_obj.webhook_tokens == "my_custom_token_1, my_custom_token_2"


@pytest.mark.asyncio
async def test_run_setup_wizard_logging_settings():
    mock_db = MockDB(None)

    request = wizard.SetupWizardRequest(
        username="admin",
        password="password",
        paperless_url="http://test",
        paperless_token="token",
        ollama_url="http://test:11434",
        ollama_model="llama3",
        schedule_interval_minutes=10,
        log_ai_interactions=False,
        log_max_ai_chars=500,
        log_retention_days=14,
        log_compact_after_days=7,
    )

    response = await wizard.run_setup_wizard(request, db=mock_db)
    assert response["status"] == "ok"
    settings_obj = [x for x in mock_db.added_items if isinstance(x, AppSettings)][0]
    assert settings_obj.log_ai_interactions is False
    assert settings_obj.log_max_ai_chars == 500
    assert settings_obj.log_retention_days == 14
    assert settings_obj.log_compact_after_days == 7


@pytest.mark.asyncio
async def test_run_setup_wizard_default_metadata_and_schedule():
    mock_db = MockDB(None)

    # Omitting schedule_interval_minutes and metadata_use_system_defaults
    request = wizard.SetupWizardRequest(
        username="admin",
        password="password",
        paperless_url="http://test",
        paperless_token="token",
        ollama_url="http://test:11434",
        ollama_model="llama3",
    )

    response = await wizard.run_setup_wizard(request, db=mock_db)
    assert response["status"] == "ok"
    settings_obj = [x for x in mock_db.added_items if isinstance(x, AppSettings)][0]
    assert settings_obj.schedule_interval_minutes == 0
    assert settings_obj.metadata_use_system_defaults is True


def test_setup_wizard_request_password_validation():
    # Password shorter than 8 characters should fail
    with pytest.raises(ValueError, match="at least 8 characters"):
        wizard.SetupWizardRequest(
            username="admin",
            password="short",
            paperless_url="http://test",
            paperless_token="token",
            ollama_url="http://test",
            ollama_model="llama",
        )

    # Empty password should fail
    with pytest.raises(ValueError, match="at least 8 characters"):
        wizard.SetupWizardRequest(
            username="admin",
            password="",
            paperless_url="http://test",
            paperless_token="token",
            ollama_url="http://test",
            ollama_model="llama",
        )

    # Empty username should fail
    with pytest.raises(ValueError, match="Username cannot be empty"):
        wizard.SetupWizardRequest(
            username="   ",
            password="validpassword123",
            paperless_url="http://test",
            paperless_token="token",
            ollama_url="http://test",
            ollama_model="llama",
        )

    # Valid password and username should succeed
    req = wizard.SetupWizardRequest(
        username=" admin ",
        password="validpassword123",
        paperless_url="http://test",
        paperless_token="token",
        ollama_url="http://test",
        ollama_model="llama",
    )
    assert req.username == "admin"
    assert req.password == "validpassword123"
