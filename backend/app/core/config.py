import logging
import secrets

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # API Security
    # We use a default that we can detect and replace with a random key if not overridden
    SECRET_KEY: str = "GENERATE_ON_STARTUP"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Timezone for display
    TZ: str = "UTC"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.SECRET_KEY == "GENERATE_ON_STARTUP":
            # Generate a secure random hex key for this session
            self.SECRET_KEY = secrets.token_hex(32)
            logger.warning(
                "No SECRET_KEY was provided. A secure random key has been generated for this session. "
                "Existing login tokens will be invalidated if the application restarts."
            )


settings = Settings()
