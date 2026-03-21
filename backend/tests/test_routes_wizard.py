import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException

from backend.routes.wizard import run_setup_wizard, SetupWizardRequest
from backend.models import AdminUser

class MockDB:
    def __init__(self, scalar_return):
        self.scalar_return = scalar_return
        self.add_called_count = 0
        self.commit_called_count = 0
        
    async def execute(self, query):
        res = MagicMock()
        res.scalar_one_or_none.return_value = self.scalar_return
        return res
        
    def add(self, item):
        self.add_called_count += 1
        
    async def commit(self):
        self.commit_called_count += 1

@pytest.mark.asyncio
async def test_run_setup_wizard_already_configured():
    mock_db = MockDB(AdminUser())
    
    request = SetupWizardRequest(
        username="admin", 
        password="password",
        paperless_url="http://test",
        paperless_token="token",
        ollama_url="http://test",
        ollama_model="llama",
        schedule_interval_minutes=0
    )
    
    with pytest.raises(HTTPException) as exc_info:
        await run_setup_wizard(request, db=mock_db)
        
    assert exc_info.value.status_code == 400
    assert "Application already configured" in exc_info.value.detail

@pytest.mark.asyncio
async def test_run_setup_wizard_success():
    mock_db = MockDB(None)
    
    request = SetupWizardRequest(
        username="admin", 
        password="password",
        paperless_url="http://test",
        paperless_token="token",
        ollama_url="http://test",
        ollama_model="llama",
        schedule_interval_minutes=15
    )
    
    response = await run_setup_wizard(request, db=mock_db)
    
    assert response == {"status": "ok", "message": "Setup completed successfully"}
    assert mock_db.add_called_count == 2
    assert mock_db.commit_called_count == 1
