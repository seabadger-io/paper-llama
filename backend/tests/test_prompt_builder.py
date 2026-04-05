import pytest

from backend.app.db.models import AppSettings
from backend.app.services.prompt_builder import build_prompt


@pytest.fixture
def base_settings():
    return AppSettings(
        update_title=True,
        update_correspondent=True,
        update_document_type=True,
        update_tags=True,
        update_creation_date=False,
        max_tags=5,
        document_word_limit=10,
        enable_ai_metadata_creation=False
    )

def test_prompt_builder_basic(base_settings):
    document_content = "This is a simple test document content."
    tags = [{"id": 1, "name": "finance"}]
    correspondents = [{"id": 10, "name": "Bank"}]
    document_types = [{"id": 5, "name": "Invoice"}]

    prompt = build_prompt(base_settings, document_content, tags, correspondents, document_types)

    # Assertions for basic presence
    assert "1:finance" in prompt
    assert "10:Bank" in prompt
    assert "5:Invoice" in prompt
    assert "EXPECTED JSON FORMAT" in prompt
    assert "ai_recommended" not in prompt

def test_prompt_builder_ai_metadata_creation(base_settings):
    base_settings.enable_ai_metadata_creation = True
    document_content = "This is a simple test document content."
    tags = []
    correspondents = []
    document_types = []

    prompt = build_prompt(base_settings, document_content, tags, correspondents, document_types)

    # AI Generation rules should be present
    assert "AI GENERATION RULES:" in prompt
    assert "ai_recommended" in prompt
    assert "New Correspondent Name" in prompt

def test_prompt_builder_document_limit(base_settings):
    base_settings.document_word_limit = 2
    document_content = "Word1 Word2 Word3 Word4"

    prompt = build_prompt(base_settings, document_content, [], [], [])

    assert "Word1 Word2" in prompt
    assert "Word3" not in prompt
