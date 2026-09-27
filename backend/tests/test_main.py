from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.app.main import app, lifespan


@pytest.mark.asyncio
async def test_lifespan_starts_and_stops_scheduler():
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    )
    mock_session.commit = AsyncMock()
    mock_session_ctx = MagicMock()
    mock_session_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session_ctx.__aexit__ = AsyncMock(return_value=None)

    with (
        patch("backend.app.main.init_engine", new_callable=AsyncMock) as mock_init,
        patch("backend.app.main.start_scheduler") as mock_start,
        patch("backend.app.main.AsyncSessionLocal", return_value=mock_session_ctx),
        patch("backend.app.main.scheduler") as mock_sched,
    ):
        mock_sched.running = True
        async with lifespan(app):
            mock_init.assert_awaited_once()
            mock_start.assert_called_once()
        mock_sched.shutdown.assert_called_once_with(wait=False)
