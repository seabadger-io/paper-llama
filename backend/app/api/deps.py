import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..core.config import settings
from ..db.models import AdminUser, AppSettings
from ..db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> AdminUser:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    query = select(AdminUser).where(AdminUser.username == username)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    return user


async def get_settings(db: AsyncSession = Depends(get_db)) -> AppSettings:
    """Dependency to retrieve the application settings. Raises 404 if not found (Setup Wizard needed)."""
    query = select(AppSettings).limit(1)
    result = await db.execute(query)
    settings_obj = result.scalar_one_or_none()

    if not settings_obj:
        raise HTTPException(status_code=404, detail="Settings not configured. Run setup wizard.")

    return settings_obj
