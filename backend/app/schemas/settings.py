import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..core.config import settings as core_settings
from ..core.constants import RESERVED_AI_PARAMS


class AppSettingsBase(BaseModel):
    # Paperless Settings
    paperless_url: str | None = None
    paperless_token: str | None = None

    # AI Backend Selection
    ai_backend: str = "ollama"

    # Ollama Settings
    ollama_url: str = "http://localhost:11434"
    ollama_model: str | None = None
    ollama_timeout: int = 300
    ollama_api_key: str | None = None
    ollama_temperature: float = 0.0
    ollama_context_size: int | None = 4096
    ollama_extra_params: str | None = None

    # Llama.cpp Settings
    llamacpp_url: str = "http://localhost:8080"
    llamacpp_model: str | None = None
    llamacpp_timeout: int = 300
    llamacpp_api_key: str | None = None
    llamacpp_temperature: float = 0.0
    llamacpp_max_tokens: int | None = None
    llamacpp_extra_params: str | None = None

    # Processing Settings
    max_retries: int = 3
    update_title: bool = True
    update_correspondent: bool = True
    update_document_type: bool = True
    update_tags: bool = True
    max_tags: int = 5
    generate_correspondent: bool = False
    generate_document_type: bool = False
    generate_tags: bool = False
    update_creation_date: bool = False
    document_word_limit: int = 1500
    schedule_interval_minutes: int = 0
    webhook_tokens: str = ""
    remove_query_tag: bool = True
    query_tag_id: int | None = None
    force_process_tag_id: int | None = None
    custom_prompt: str | None = None

    # Vision Fallback Settings
    vision_fallback: str = "off"
    vision_pages: int = 3

    # Metadata Permissions
    metadata_use_system_defaults: bool = True
    metadata_owner_id: int | None = None
    metadata_view_users: list[int] = Field(default_factory=list)
    metadata_view_groups: list[int] = Field(default_factory=list)
    metadata_edit_users: list[int] = Field(default_factory=list)
    metadata_edit_groups: list[int] = Field(default_factory=list)

    # Logging and Retention Settings
    log_ai_interactions: bool = True
    log_max_ai_chars: int = 0
    log_retention_days: int = 0
    log_compact_after_days: int = 30

    @field_validator(
        "update_creation_date",
        "generate_correspondent",
        "generate_document_type",
        "generate_tags",
        mode="before",
    )
    @classmethod
    def validate_bool_fallback_false(cls, v: Any) -> bool:
        if v is None:
            return False
        return bool(v)

    @field_validator(
        "update_title",
        "update_correspondent",
        "update_document_type",
        "update_tags",
        "remove_query_tag",
        "metadata_use_system_defaults",
        "log_ai_interactions",
        mode="before",
    )
    @classmethod
    def validate_bool_fallback_true(cls, v: Any) -> bool:
        if v is None:
            return True
        return bool(v)

    @field_validator(
        "log_max_ai_chars", "log_retention_days", mode="before"
    )
    @classmethod
    def validate_non_negative_int(cls, v: Any) -> int:
        if v is None or v == "":
            return 0
        try:
            val = int(v)
        except (ValueError, TypeError):
            raise ValueError("Value must be an integer")
        if val < 0:
            raise ValueError("Value cannot be negative")
        return val

    @field_validator("log_compact_after_days", mode="before")
    @classmethod
    def validate_compact_after_days(cls, v: Any) -> int:
        if v is None or v == "":
            return 30
        try:
            val = int(v)
        except (ValueError, TypeError):
            raise ValueError("Value must be an integer")
        if val < 0:
            raise ValueError("Value cannot be negative")
        return val

    @field_validator("ollama_timeout", "llamacpp_timeout", mode="before")
    @classmethod
    def validate_timeout(cls, v: Any) -> int:
        if v is None or v == "":
            return 300
        try:
            val = int(v)
        except (ValueError, TypeError):
            raise ValueError("Value must be an integer")
        if val <= 0:
            raise ValueError("Timeout must be greater than zero")
        return val

    @field_validator("max_tags", mode="before")
    @classmethod
    def validate_max_tags(cls, v: Any) -> int:
        if v is None or v == "":
            return 5
        try:
            val = int(v)
        except (ValueError, TypeError):
            raise ValueError("Value must be an integer")
        if val < 0:
            raise ValueError("Value cannot be negative")
        return val

    @field_validator("max_retries", "vision_pages", mode="before")
    @classmethod
    def validate_retries_and_pages(cls, v: Any) -> int:
        if v is None or v == "":
            return 3
        try:
            val = int(v)
        except (ValueError, TypeError):
            raise ValueError("Value must be an integer")
        if val < 0:
            raise ValueError("Value cannot be negative")
        return val

    @field_validator("document_word_limit", mode="before")
    @classmethod
    def validate_document_word_limit(cls, v: Any) -> int:
        if v is None or v == "":
            return 1500
        try:
            val = int(v)
        except (ValueError, TypeError):
            raise ValueError("Value must be an integer")
        if val < 0:
            raise ValueError("Value cannot be negative")
        return val

    @field_validator("schedule_interval_minutes", mode="before")
    @classmethod
    def validate_schedule_interval(cls, v: Any) -> int:
        if v is None or v == "":
            return 0
        try:
            val = int(v)
        except (ValueError, TypeError):
            raise ValueError("Value must be an integer")
        if val < 0:
            raise ValueError("Value cannot be negative")
        return val

    @field_validator("vision_fallback", mode="before")
    @classmethod
    def validate_vision_fallback(cls, v: Any) -> str:
        if v is None or v == "":
            return "off"
        return str(v)

    @field_validator(
        "metadata_view_users",
        "metadata_view_groups",
        "metadata_edit_users",
        "metadata_edit_groups",
        mode="before",
    )
    @classmethod
    def validate_list_fallback(cls, v: Any) -> list[int]:
        if v is None or v == "":
            return []
        return list(v)

    @field_validator("ollama_temperature", "llamacpp_temperature", mode="before")
    @classmethod
    def validate_temperature(cls, v: Any) -> float:
        if v is None or v == "":
            return 0.0
        try:
            val = float(v)
        except (ValueError, TypeError):
            raise ValueError("Temperature must be a valid number")
        if val < 0.0:
            raise ValueError("Temperature cannot be negative")
        return val

    @field_validator("ai_backend", mode="before")
    @classmethod
    def validate_ai_backend(cls, v: Any) -> str:
        if v is None or v == "":
            return "ollama"
        return str(v)

    @field_validator("ollama_url", mode="before")
    @classmethod
    def validate_ollama_url(cls, v: Any) -> str:
        if v is None or v == "":
            return "http://localhost:11434"
        return str(v)

    @field_validator("llamacpp_url", mode="before")
    @classmethod
    def validate_llamacpp_url(cls, v: Any) -> str:
        if v is None or v == "":
            return "http://localhost:8080"
        return str(v)

    @field_validator("ollama_context_size", mode="before")
    @classmethod
    def validate_ollama_context_size(cls, v: Any) -> int | None:
        if v is None or v == "":
            return 4096
        try:
            val = int(v)
        except (ValueError, TypeError):
            raise ValueError("Value must be an integer")
        if val <= 0:
            raise ValueError("Value must be greater than zero")
        return val

    @field_validator("llamacpp_max_tokens", mode="before")
    @classmethod
    def validate_llamacpp_max_tokens(cls, v: Any) -> int | None:
        if v is None or v == "":
            return None
        try:
            val = int(v)
        except (ValueError, TypeError):
            raise ValueError("Value must be an integer")
        if val <= 0:
            raise ValueError("Value must be greater than zero")
        return val

    @field_validator("webhook_tokens", mode="before")
    @classmethod
    def validate_webhook_tokens(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v).strip()

    @field_validator("ollama_extra_params", "llamacpp_extra_params", mode="before")
    @classmethod
    def validate_extra_params(cls, v: Any) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            v_str = v.strip()
            if not v_str:
                return None
            try:
                parsed = json.loads(v_str)
            except Exception as e:
                raise ValueError(f"Invalid JSON in extra parameters: {e}")
        elif isinstance(v, dict):
            parsed = v
        else:
            raise ValueError("Extra parameters must be a valid JSON string or object")

        if not isinstance(parsed, dict):
            raise ValueError("Extra parameters must be a JSON object (key-value mapping)")

        reserved_found = [k for k in parsed.keys() if k in RESERVED_AI_PARAMS]
        if reserved_found:
            raise ValueError(
                f"Reserved parameter(s) cannot be overridden: {', '.join(reserved_found)}"
            )

        return json.dumps(parsed)


class SettingsUpdate(AppSettingsBase):
    server_timezone: str = Field(default_factory=lambda: core_settings.TZ)
    model_config = ConfigDict(from_attributes=True)


class SettingsResponse(AppSettingsBase):
    server_timezone: str = Field(default_factory=lambda: core_settings.TZ)
    model_config = ConfigDict(from_attributes=True)


class SetupWizardRequest(AppSettingsBase):
    username: str
    password: str
    paperless_url: str
    paperless_token: str
    ollama_url: str
    ollama_model: str

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not v or len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Username cannot be empty")
        return v.strip()
