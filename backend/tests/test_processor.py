from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.app.db.models import AppSettings
from backend.app.services.processor import DocumentProcessor


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
    settings.max_tags = 5
    settings.generate_correspondent = False
    settings.generate_document_type = False
    settings.generate_tags = False
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
    # Default to empty lists for metadata to avoid AsyncMock objects causing unawaited warnings
    proc.paperless.get_tags.return_value = []
    proc.paperless.get_correspondents.return_value = []
    proc.paperless.get_document_types.return_value = []
    proc.paperless.update_document.return_value = {}
    proc.paperless.update_document_content.return_value = {}
    proc.paperless.download_document.return_value = b""

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
    DocumentProcessor._metadata_cache["tags"] = [
        {"id": 1, "name": "inbox"},
        {"id": 2, "name": "receipt"},
    ]
    DocumentProcessor._metadata_cache["correspondents"] = [{"id": 1, "name": "Apple"}]
    DocumentProcessor._metadata_cache["document_types"] = []

    processor.paperless.get_document.return_value = {
        "id": 100,
        "content": "Invoice from Apple for $10",
        "title": "Scan 123",
        "tags": [1],
        "correspondent": None,
        "document_type": None,
        "created": "2023-01-01",
    }

    processor.ollama.generate_completion.return_value = """```json
    {
        "title": "Apple Receipt",
        "correspondent_id": 1,
        "tag_ids": [2],
        "created": "2023-01-02"
    }
    ```"""

    await processor.process_document(100)

    processor.paperless.update_document.assert_called_once_with(
        100,
        title="Apple Receipt",
        tags=[2],
        correspondent_id=1,
        document_type_id=None,
        created="2023-01-02",
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
        "created": "2023-01-01",
    }

    processor.ollama.generate_completion.return_value = (
        '{"title": "Test Doc", "tag_ids": [], "created": "2023-01-02"}'
    )

    await processor.process_document(100)

    processor.paperless.update_document.assert_called_once_with(
        100,
        title="Test Doc",
        tags=[],
        correspondent_id=None,
        document_type_id=None,
        created="2023-01-02",
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
        "created": "2023-01-01",
    }

    # Force completion logic error
    processor.ollama.generate_completion.side_effect = Exception("Ollama disconnected")
    mock_sleep = mocker.patch(
        "backend.app.services.processor.asyncio.sleep", new_callable=AsyncMock
    )

    await processor.process_document(100)

    # Asserts
    assert processor.ollama.generate_completion.call_count == 2
    mock_sleep.assert_called_once_with(2)
    assert (
        processor.db.add_called_count == 3
    )  # 1 processing log, 1 error lock log, 1 changelog max_retries
    assert processor.db.rollback_called_count == 1


@pytest.mark.asyncio
async def test_process_document_metadata_generation_with_permissions(processor, mock_settings):
    mock_settings.generate_tags = True
    mock_settings.metadata_owner_id = 42
    mock_settings.metadata_view_users = [1, 2]
    mock_settings.metadata_view_groups = [10]
    mock_settings.metadata_edit_users = [3]
    mock_settings.metadata_edit_groups = [20]

    DocumentProcessor._metadata_cache["timestamp"] = 9999999999
    DocumentProcessor._metadata_cache["tags"] = []
    DocumentProcessor._metadata_cache["correspondents"] = []
    DocumentProcessor._metadata_cache["document_types"] = []

    processor.paperless.get_document.return_value = {
        "id": 100,
        "content": "New content",
        "title": "Scan 123",
        "tags": [],
    }

    processor.ollama.generate_completion.return_value = '{"ai_recommended": {"tags": ["NewTag"]}}'
    processor.paperless.create_tag.return_value = 500

    await processor.process_document(100)

    # Check if create_tag was called with correct owner and permissions
    expected_perms = {
        "view": {"users": [1, 2], "groups": [10]},
        "change": {"users": [3], "groups": [20]},
    }
    processor.paperless.create_tag.assert_called_once_with(
        "NewTag", owner=42, set_permissions=expected_perms
    )


@pytest.mark.asyncio
async def test_process_document_metadata_generation_document_owner(processor, mock_settings):
    mock_settings.generate_correspondent = True
    mock_settings.metadata_owner_id = -1  # Sentinel for document owner

    DocumentProcessor._metadata_cache["timestamp"] = 9999999999
    DocumentProcessor._metadata_cache["tags"] = []
    DocumentProcessor._metadata_cache["correspondents"] = []
    DocumentProcessor._metadata_cache["document_types"] = []

    processor.paperless.get_document.return_value = {
        "id": 100,
        "content": "Content",
        "title": "Scan 123",
        "tags": [],
        "owner": 5,  # Document owner is 5
    }

    processor.ollama.generate_completion.return_value = (
        '{"ai_recommended": {"correspondent": "NewCorp"}}'
    )
    processor.paperless.create_correspondent.return_value = 600

    await processor.process_document(100)

    # Check if owner 5 was picked up from the document
    processor.paperless.create_correspondent.assert_called_once()
    args, kwargs = processor.paperless.create_correspondent.call_args
    assert kwargs["owner"] == 5


# --- Vision Fallback Reprocessing Tests ---


@pytest.mark.asyncio
async def test_ocr_force_mode_skips_text_prompt(processor, mock_settings, mocker):
    """When vision_fallback=force, the standard text prompt should never be called."""
    mock_settings.vision_fallback = "force"
    mock_settings.vision_pages = 2
    mock_settings.ai_backend = "ollama"
    mock_settings.max_retries = 1

    DocumentProcessor._metadata_cache["timestamp"] = 9999999999
    DocumentProcessor._metadata_cache["tags"] = []
    DocumentProcessor._metadata_cache["correspondents"] = []
    DocumentProcessor._metadata_cache["document_types"] = []

    processor.paperless.get_document.return_value = {
        "id": 101,
        "content": "Some existing text that should be ignored",
        "title": "Scan 101",
        "tags": [],
        "correspondent": None,
        "document_type": None,
        "created": "2023-01-01",
    }
    # Simulate PDF bytes and mock PyMuPDF conversion
    processor.paperless.download_document.return_value = b"%PDF-fake"
    mock_pdf_to_images = mocker.patch(
        "backend.app.services.processor._pdf_to_images_base64", return_value=["base64imgdata"]
    )

    processor.ollama.generate_completion.return_value = '{"title": "Vision Fallback Title"}'

    await processor.process_document(101)

    # PDF download must happen, standard prompt must NOT be called with text
    processor.paperless.download_document.assert_called_once_with(101)
    mock_pdf_to_images.assert_called_once_with(b"%PDF-fake", 2, document_id=101)
    # AI was called with images
    call_kwargs = processor.ollama.generate_completion.call_args
    assert call_kwargs.kwargs.get("images") == ["base64imgdata"]
    processor.paperless.update_document_content.assert_not_called()


@pytest.mark.asyncio
async def test_vision_fallback_triggers_on_empty_content(processor, mock_settings, mocker):
    """When vision_fallback=on and content is empty, Vision Fallback should run immediately."""
    mock_settings.vision_fallback = "on"
    mock_settings.vision_pages = 1
    mock_settings.ai_backend = "ollama"
    mock_settings.max_retries = 1

    DocumentProcessor._metadata_cache["timestamp"] = 9999999999
    DocumentProcessor._metadata_cache["tags"] = []
    DocumentProcessor._metadata_cache["correspondents"] = []
    DocumentProcessor._metadata_cache["document_types"] = []

    processor.paperless.get_document.return_value = {
        "id": 102,
        "content": "",  # Empty!
        "title": "Blank Scan",
        "tags": [],
        "correspondent": None,
        "document_type": None,
        "created": None,
    }
    processor.paperless.download_document.return_value = b"%PDF-fake"
    mock_pdf_to_images = mocker.patch(
        "backend.app.services.processor._pdf_to_images_base64", return_value=["img1"]
    )
    processor.ollama.generate_completion.return_value = '{"title": "Empty Doc Vision Fallback"}'

    await processor.process_document(102)

    processor.paperless.download_document.assert_called_once_with(102)
    mock_pdf_to_images.assert_called_once()
    call_kwargs = processor.ollama.generate_completion.call_args
    assert call_kwargs.kwargs.get("images") == ["img1"]


@pytest.mark.asyncio
async def test_vision_fallback_triggers_when_ai_flags_poor_quality(processor, mock_settings, mocker):
    """When vision_fallback=on, a second Vision Fallback pass is triggered if AI flags needs_vision_fallback=true."""
    mock_settings.vision_fallback = "on"
    mock_settings.vision_pages = 1
    mock_settings.ai_backend = "ollama"
    mock_settings.max_retries = 1

    DocumentProcessor._metadata_cache["timestamp"] = 9999999999
    DocumentProcessor._metadata_cache["tags"] = []
    DocumentProcessor._metadata_cache["correspondents"] = []
    DocumentProcessor._metadata_cache["document_types"] = []

    processor.paperless.get_document.return_value = {
        "id": 103,
        "content": "XZq@#$ garbage text",  # Gibberish
        "title": "Corrupted Scan",
        "tags": [],
        "correspondent": None,
        "document_type": None,
        "created": None,
    }
    processor.paperless.download_document.return_value = b"%PDF-fake"
    mock_pdf_to_images = mocker.patch(
        "backend.app.services.processor._pdf_to_images_base64", return_value=["imgdata"]
    )

    # First call: text-based, AI flags poor quality
    # Second call: vision-based Vision Fallback pass
    processor.ollama.generate_completion.side_effect = [
        '{"title": "Bad", "needs_vision_fallback": true}',
        '{"title": "Good Vision Fallback Title"}',
    ]

    await processor.process_document(103)

    # generate_completion was called twice: once for text, once for Vision Fallback
    assert processor.ollama.generate_completion.call_count == 2
    # Second call should have images
    mock_pdf_to_images.assert_called_once()
    second_call_kwargs = processor.ollama.generate_completion.call_args_list[1].kwargs
    assert second_call_kwargs.get("images") == ["imgdata"]
