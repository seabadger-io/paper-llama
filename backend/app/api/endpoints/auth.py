import asyncio
import logging
import time
from collections import defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ...core.config import settings
from ...core.security import create_access_token, verify_password
from ...db.models import AdminUser
from ...db.session import get_db

logger = logging.getLogger(__name__)


class InMemoryRateLimiter:
    """In-memory sliding window rate limiter per client IP."""

    def __init__(
        self,
        max_attempts: int | None = None,
        window_seconds: int = 60,
    ):
        self._max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    @property
    def max_attempts(self) -> int:
        if self._max_attempts is not None:
            return self._max_attempts
        return settings.LOGIN_RATE_LIMIT_PER_MINUTE

    @max_attempts.setter
    def max_attempts(self, val: int | None) -> None:
        self._max_attempts = val

    async def is_rate_limited(self, key: str) -> tuple[bool, int]:
        """Checks if key has reached or exceeded max_attempts within the sliding window.

        If limited, returns (True, retry_after_seconds).
        If not limited or disabled (max_attempts <= 0), returns (False, 0).
        """
        if self.max_attempts <= 0:
            return False, 0

        async with self._lock:
            now = time.monotonic()
            cutoff = now - self.window_seconds

            # Filter out timestamps outside the sliding window
            valid_attempts = [t for t in self._attempts[key] if t > cutoff]

            if len(valid_attempts) >= self.max_attempts:
                oldest_in_window = valid_attempts[0]
                retry_after = max(1, int(oldest_in_window + self.window_seconds - now))
                self._attempts[key] = valid_attempts
                return True, retry_after

            valid_attempts.append(now)
            self._attempts[key] = valid_attempts
            return False, 0

    def reset(self, key: str | None = None) -> None:
        """Clears recorded attempts for a key or for all keys."""
        if key is not None:
            self._attempts.pop(key, None)
        else:
            self._attempts.clear()


login_limiter = InMemoryRateLimiter()


def get_client_ip(request: Request) -> str:
    """Extracts client IP from X-Forwarded-For header or client host."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


@router.post("/login", response_model=Token)
async def login(
    http_request: Request,
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    client_ip = get_client_ip(http_request)
    is_limited, retry_after = await login_limiter.is_rate_limited(client_ip)
    if is_limited:
        logger.warning(
            f"Rate limit exceeded for login attempts from IP '{client_ip}'. Retry after {retry_after}s."
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    query = select(AdminUser).where(AdminUser.username == request.username)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

