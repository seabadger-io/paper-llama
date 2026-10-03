import pytest
from pydantic import ValidationError

from backend.app.db.models import AppSettings
from backend.app.schemas.settings import (
    AppSettingsBase,
    SettingsResponse,
    SettingsUpdate,
    SetupWizardRequest,
)


def test_app_settings_base_defaults():
    settings = AppSettingsBase()
    assert settings.ai_backend == "ollama"
    assert settings.ollama_url == "http://localhost:11434"
    assert settings.ollama_timeout == 300
    assert settings.ollama_temperature == 0.0
    assert settings.ollama_context_size == 4096
    assert settings.llamacpp_url == "http://localhost:8080"
    assert settings.schedule_interval_minutes == 0
    assert settings.metadata_use_system_defaults is True
    assert settings.webhook_tokens == ""
    assert settings.update_title is True
    assert settings.update_correspondent is True
    assert settings.update_document_type is True
    assert settings.update_tags is True
    assert settings.max_tags == 5
    assert settings.generate_correspondent is False
    assert settings.generate_document_type is False
    assert settings.generate_tags is False
    assert settings.update_creation_date is False
    assert settings.log_ai_interactions is True
    assert settings.log_max_ai_chars == 0
    assert settings.log_retention_days == 0
    assert settings.log_compact_after_days == 30


def test_settings_validation_errors():
    with pytest.raises(ValidationError):
        SettingsUpdate(ollama_extra_params="invalid json")

    with pytest.raises(ValidationError):
        SettingsUpdate(ollama_extra_params='{"prompt": "cannot override reserved"}')

    with pytest.raises(ValidationError):
        SettingsUpdate(ollama_temperature=-1.0)

    with pytest.raises(ValidationError):
        SettingsUpdate(ollama_context_size=0)

    with pytest.raises(ValidationError):
        SettingsUpdate(log_retention_days=-1)

    with pytest.raises(ValidationError):
        SettingsUpdate(log_compact_after_days=-1)

    with pytest.raises(ValidationError):
        SettingsUpdate(log_max_ai_chars=-1)


def test_settings_response_from_attributes():
    orm_settings = AppSettings(
        paperless_url="http://test-paperless",
        paperless_token="test-token",
        ollama_url="http://test-ollama:11434",
        ollama_model="llama3",
        update_creation_date=None,  # Should fallback to False
        ollama_timeout=None,  # Should fallback to 300
    )

    response = SettingsResponse.model_validate(orm_settings)
    assert response.paperless_url == "http://test-paperless"
    assert response.paperless_token == "test-token"
    assert response.ollama_model == "llama3"
    assert response.update_creation_date is False
    assert response.ollama_timeout == 300
    assert response.server_timezone is not None


def test_setup_wizard_request_validation():
    # Valid setup request
    req = SetupWizardRequest(
        username="admin",
        password="secretpassword",
        paperless_url="http://paperless",
        paperless_token="token",
        ollama_url="http://ollama",
        ollama_model="llama3",
    )
    assert req.username == "admin"
    assert req.password == "secretpassword"

    # Password too short
    with pytest.raises(ValidationError):
        SetupWizardRequest(
            username="admin",
            password="short",
            paperless_url="http://paperless",
            paperless_token="token",
            ollama_url="http://ollama",
            ollama_model="llama3",
        )

    # Empty username
    with pytest.raises(ValidationError):
        SetupWizardRequest(
            username="   ",
            password="secretpassword",
            paperless_url="http://paperless",
            paperless_token="token",
            ollama_url="http://ollama",
            ollama_model="llama3",
        )
