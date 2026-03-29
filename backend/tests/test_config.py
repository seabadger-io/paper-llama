from backend.app.core.config import Settings


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
