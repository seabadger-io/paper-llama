from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.models import AppSettings
from backend.processor import DocumentProcessor


class MockDB:
    def __init__(self):
        self.add_called_count = 0
        self.commit_called_count = 0
        self.rollback_called_count = 0
        # For existing ProcessedDocument lookups
        self.scalar_return = None

    async def execute(self, query):
        res = MagicMock()
        res.scalar_one_or_none.return_value = self.scalar_return
        return res

    def add(self, item):
        self.add_called_count += 1

    async def commit(self):
        self.commit_called_count += 1

    async def rollback(self):
        self.rollback_called_count += 1

@pytest.fixture
def mock_db_session():
    return MockDB()

@pytest.fixture
def mock_settings():
    settings = AppSettings()
    settings.paperless_url = "http://test"
    settings.paperless_token = "token"
    settings.ollama_url = "http://ollama"
    settings.ollama_model = "llama"
    settings.ollama_timeout = 300
    settings.update_title = True
    settings.update_tags = True
    settings.update_correspondent = True
    settings.update_creation_date = True
    settings.remove_query_tag = True
    settings.query_tag_id = 1
    settings.force_process_tag_id = None
    settings.document_word_limit = 1500
    return settings

@pytest.fixture
def processor(mock_db_session, mock_settings):
    # Reset cache before each test
    DocumentProcessor._metadata_cache["timestamp"] = 0
    DocumentProcessor._metadata_cache["tags"] = []

    proc = DocumentProcessor(mock_db_session, mock_settings)
    proc.paperless = AsyncMock()
    proc.ollama = AsyncMock()
    return proc

@pytest.mark.asyncio
async def test_get_cached_metadata_fetches_once(processor):
    processor.paperless.get_tags.return_value = [{"id": 1, "name": "tag1"}]
    processor.paperless.get_correspondents.return_value = []
    processor.paperless.get_document_types.return_value = []

    # First call should fetch
    t1, c1, d1 = await processor.get_cached_metadata()
    assert len(t1) == 1
    assert processor.paperless.get_tags.call_count == 1

    # Second call should use cache
    t2, c2, d2 = await processor.get_cached_metadata()
    assert processor.paperless.get_tags.call_count == 1
    assert t1 == t2

@pytest.mark.asyncio
async def test_process_document_success(processor, mocker):
    DocumentProcessor._metadata_cache["timestamp"] = 9999999999
    DocumentProcessor._metadata_cache["tags"] = [{"id": 1, "name": "inbox"}, {"id": 2, "name": "receipt"}]
    DocumentProcessor._metadata_cache["correspondents"] = [{"id": 1, "name": "Apple"}]
    DocumentProcessor._metadata_cache["document_types"] = []

    processor.paperless.get_document.return_value = {
        "id": 100,
        "content": "Invoice from Apple for $10",
        "title": "Scan 123",
        "tags": [1],
        "correspondent": None,
        "document_type": None,
        "created": "2023-01-01"
    }

    processor.ollama.generate_completion.return_value = '''```json
    {
        "title": "Apple Receipt",
        "correspondent_id": 1,
        "tag_ids": [2],
        "created": "2023-01-02"
    }
    ```'''

    await processor.process_document(100)

    processor.paperless.update_document.assert_called_once_with(
        100,
        title="Apple Receipt",
        tags=[2],
        correspondent_id=1,
        document_type_id=None,
        created="2023-01-02"
    )

    assert processor.db.add_called_count == 3
    assert processor.db.commit_called_count == 3

@pytest.mark.asyncio
async def test_process_document_force_tag_removal(processor, mock_settings):
    mock_settings.force_process_tag_id = 99

    DocumentProcessor._metadata_cache["timestamp"] = 9999999999
    DocumentProcessor._metadata_cache["tags"] = [{"id": 99, "name": "force"}]
    DocumentProcessor._metadata_cache["correspondents"] = []
    DocumentProcessor._metadata_cache["document_types"] = []

    processor.paperless.get_document.return_value = {
        "id": 100,
        "content": "Test",
        "title": "Scan 123",
        "tags": [99],
        "correspondent": None,
        "document_type": None,
        "created": "2023-01-01"
    }

    processor.ollama.generate_completion.return_value = '{"title": "Test Doc", "tag_ids": [], "created": "2023-01-02"}'

    await processor.process_document(100)

    processor.paperless.update_document.assert_called_once_with(
        100,
        title="Test Doc",
        tags=[],
        correspondent_id=None,
        document_type_id=None,
        created="2023-01-02"
    )

@pytest.mark.asyncio
async def test_process_document_retry_error(processor, mock_settings, mocker):
    mock_settings.max_retries = 2

    DocumentProcessor._metadata_cache["timestamp"] = 9999999999
    DocumentProcessor._metadata_cache["tags"] = [{"id": 1, "name": "inbox"}]
    DocumentProcessor._metadata_cache["correspondents"] = []
    DocumentProcessor._metadata_cache["document_types"] = []

    processor.paperless.get_document.return_value = {
        "id": 100,
        "content": "Invoice",
        "title": "Scan 123",
        "tags": [1],
        "correspondent": None,
        "document_type": None,
        "created": "2023-01-01"
    }

    # Force completion logic error
    processor.ollama.generate_completion.side_effect = Exception("Ollama disconnected")
    mock_sleep = mocker.patch("backend.processor.asyncio.sleep", new_callable=AsyncMock)

    await processor.process_document(100)

    # Asserts
    assert processor.ollama.generate_completion.call_count == 2
    mock_sleep.assert_called_once_with(2)
    assert processor.db.add_called_count == 3 # 1 processing log, 1 error lock log, 1 changelog max_retries
    assert processor.db.rollback_called_count == 1
