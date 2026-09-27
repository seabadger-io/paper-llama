from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from backend.app.api.endpoints.auth import (
    InMemoryRateLimiter,
    LoginRequest,
    get_client_ip,
    login,
    login_limiter,
)
from backend.app.core.security import get_password_hash
from backend.app.db.models import AdminUser


def make_mock_request(ip: str | None = "192.168.1.100", forwarded_for: str | None = None):
    req = MagicMock()
    req.headers = {}
    if forwarded_for is not None:
        req.headers["x-forwarded-for"] = forwarded_for
    if ip is not None:
        client = MagicMock()
        client.host = ip
        req.client = client
    else:
        req.client = None
    return req


class MockDB:
    def __init__(self, user: AdminUser | None):
        self.user = user

    async def execute(self, query):
        res = MagicMock()
        res.scalar_one_or_none.return_value = self.user
        return res


@pytest.fixture(autouse=True)
def reset_limiter():
    login_limiter.reset()
    yield
    login_limiter.reset()


def test_get_client_ip():
    # Direct client IP
    req1 = make_mock_request(ip="10.0.0.1")
    assert get_client_ip(req1) == "10.0.0.1"

    # Forwarded header takes precedence
    req2 = make_mock_request(ip="10.0.0.1", forwarded_for="203.0.113.195, 70.41.3.18")
    assert get_client_ip(req2) == "203.0.113.195"

    # Forwarded header single IP with whitespace
    req3 = make_mock_request(ip="10.0.0.1", forwarded_for=" 198.51.100.2 ")
    assert get_client_ip(req3) == "198.51.100.2"

    # No client and no header
    req4 = make_mock_request(ip=None)
    assert get_client_ip(req4) == "127.0.0.1"


@pytest.mark.asyncio
async def test_login_success():
    hashed = get_password_hash("secret123")
    user = AdminUser(username="admin", hashed_password=hashed)
    mock_db = MockDB(user)
    http_req = make_mock_request(ip="192.168.1.50")
    login_req = LoginRequest(username="admin", password="secret123")

    result = await login(http_request=http_req, request=login_req, db=mock_db)
    assert "access_token" in result
    assert result["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_credentials_raises_401():
    hashed = get_password_hash("secret123")
    user = AdminUser(username="admin", hashed_password=hashed)
    mock_db = MockDB(user)
    http_req = make_mock_request(ip="192.168.1.51")
    login_req = LoginRequest(username="admin", password="wrongpassword")

    with pytest.raises(HTTPException) as exc_info:
        await login(http_request=http_req, request=login_req, db=mock_db)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Incorrect username or password"


@pytest.mark.asyncio
async def test_login_rate_limiting_max_5_per_minute_per_ip():
    hashed = get_password_hash("secret123")
    user = AdminUser(username="admin", hashed_password=hashed)
    mock_db = MockDB(user)
    http_req = make_mock_request(ip="192.168.1.99")
    login_req = LoginRequest(username="admin", password="wrongpassword")

    # 5 attempts should be processed (and fail with 401)
    for i in range(5):
        with pytest.raises(HTTPException) as exc_info:
            await login(http_request=http_req, request=login_req, db=mock_db)
        assert exc_info.value.status_code == 401

    # 6th attempt from the SAME IP must be rejected with 429 Too Many Requests
    with pytest.raises(HTTPException) as exc_info:
        await login(http_request=http_req, request=login_req, db=mock_db)

    assert exc_info.value.status_code == 429
    assert "Too many login attempts" in exc_info.value.detail
    assert "Retry-After" in exc_info.value.headers
    retry_after = int(exc_info.value.headers["Retry-After"])
    assert 1 <= retry_after <= 60

    # But an attempt from a DIFFERENT IP should still succeed (or fail with 401, not 429)
    other_ip_req = make_mock_request(ip="192.168.1.100")
    with pytest.raises(HTTPException) as exc_info:
        await login(http_request=other_ip_req, request=login_req, db=mock_db)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_rate_limiter_window_expiration():
    limiter = InMemoryRateLimiter(max_attempts=5, window_seconds=60)
    ip = "10.10.10.10"

    current_time = 1000.0

    with patch("time.monotonic", side_effect=lambda: current_time):
        # 5 attempts at t=1000.0
        for _ in range(5):
            limited, _ = await limiter.is_rate_limited(ip)
            assert limited is False

        # 6th attempt at t=1000.0 is blocked
        limited, retry_after = await limiter.is_rate_limited(ip)
        assert limited is True
        assert retry_after == 60

        # Advance time by 61 seconds
        current_time = 1061.0

        # Now an attempt is allowed again
        limited, _ = await limiter.is_rate_limited(ip)
        assert limited is False


@pytest.mark.asyncio
async def test_rate_limiter_disabled_via_zero_or_negative_limit():
    from backend.app.core.config import settings

    hashed = get_password_hash("secret123")
    user = AdminUser(username="admin", hashed_password=hashed)
    mock_db = MockDB(user)
    http_req = make_mock_request(ip="192.168.1.77")
    login_req = LoginRequest(username="admin", password="wrongpassword")

    # Disable via LOGIN_RATE_LIMIT_PER_MINUTE = 0
    original_limit = settings.LOGIN_RATE_LIMIT_PER_MINUTE
    try:
        settings.LOGIN_RATE_LIMIT_PER_MINUTE = 0
        for _ in range(8):
            with pytest.raises(HTTPException) as exc_info:
                await login(http_request=http_req, request=login_req, db=mock_db)
            assert exc_info.value.status_code == 401

        # Also test negative number (e.g. -1)
        settings.LOGIN_RATE_LIMIT_PER_MINUTE = -1
        for _ in range(5):
            with pytest.raises(HTTPException) as exc_info:
                await login(http_request=http_req, request=login_req, db=mock_db)
            assert exc_info.value.status_code == 401
    finally:
        settings.LOGIN_RATE_LIMIT_PER_MINUTE = original_limit


@pytest.mark.asyncio
async def test_rate_limiter_custom_limit_via_settings():
    from backend.app.core.config import settings

    hashed = get_password_hash("secret123")
    user = AdminUser(username="admin", hashed_password=hashed)
    mock_db = MockDB(user)
    http_req = make_mock_request(ip="192.168.1.66")
    login_req = LoginRequest(username="admin", password="wrongpassword")

    # Set custom limit to 2
    original_limit = settings.LOGIN_RATE_LIMIT_PER_MINUTE
    try:
        settings.LOGIN_RATE_LIMIT_PER_MINUTE = 2
        # 2 attempts allowed (fail with 401)
        for _ in range(2):
            with pytest.raises(HTTPException) as exc_info:
                await login(http_request=http_req, request=login_req, db=mock_db)
            assert exc_info.value.status_code == 401

        # 3rd attempt blocked with 429
        with pytest.raises(HTTPException) as exc_info:
            await login(http_request=http_req, request=login_req, db=mock_db)
        assert exc_info.value.status_code == 429
    finally:
        settings.LOGIN_RATE_LIMIT_PER_MINUTE = original_limit

