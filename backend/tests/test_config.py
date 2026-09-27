import importlib

from backend.app.core.config import Settings
from backend.app.db import session as db_session


def test_secret_key_generation():
    # Test that it generates a key when set to the default value
    settings = Settings(SECRET_KEY="GENERATE_ON_STARTUP")
    assert settings.SECRET_KEY != "GENERATE_ON_STARTUP"
    assert len(settings.SECRET_KEY) == 64  # token_hex(32) is 64 chars


def test_secret_key_preservation():
    # Test that it DOES NOT override a provided secret key
    custom_key = "my_custom_secret_key"
    settings = Settings(SECRET_KEY=custom_key)
    assert settings.SECRET_KEY == custom_key


def test_database_url_default_and_custom(monkeypatch):
    # Test that DATABASE_URL defaults to empty in Settings unless specified
    default_settings = Settings()
    assert default_settings.DATABASE_URL == ""

    # Test that DATABASE_URL is read from environment if provided
    custom_url = "sqlite+aiosqlite:////custom/path/paper_llama.db"
    monkeypatch.setenv("DATABASE_URL", custom_url)
    env_settings = Settings()
    assert env_settings.DATABASE_URL == custom_url


def test_session_database_url_resolution(monkeypatch, tmp_path):
    # Test that session uses custom DATABASE_URL and creates directory if needed
    test_db = tmp_path / "subdir" / "test.db"
    test_url = f"sqlite+aiosqlite:///{test_db.as_posix()}"
    monkeypatch.setenv("DATABASE_URL", test_url)

    # Re-import to reload module with monkeypatched environment
    reloaded_session = importlib.reload(db_session)
    assert reloaded_session.DATABASE_URL == test_url
    assert (tmp_path / "subdir").exists()


def test_login_rate_limit_settings_default_and_env(monkeypatch):
    # Default settings
    cfg = Settings()
    assert cfg.LOGIN_RATE_LIMIT_PER_MINUTE == 5

    # Overridden via environment variables
    monkeypatch.setenv("LOGIN_RATE_LIMIT_PER_MINUTE", "10")
    env_cfg = Settings()
    assert env_cfg.LOGIN_RATE_LIMIT_PER_MINUTE == 10

    # Disabled via 0 or negative
    monkeypatch.setenv("LOGIN_RATE_LIMIT_PER_MINUTE", "0")
    disabled_cfg = Settings()
    assert disabled_cfg.LOGIN_RATE_LIMIT_PER_MINUTE == 0


