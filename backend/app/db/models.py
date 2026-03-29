from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String, Text

from .session import Base


class AdminUser(Base):
    """Stores the single admin user credentials."""
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

class AppSettings(Base):
    """Stores the global application configuration."""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)

    # Paperless Settings
    paperless_url = Column(String, nullable=True)
    paperless_token = Column(String, nullable=True)

    # Ollama Settings
    ollama_url = Column(String, default="http://localhost:11434")
    ollama_model = Column(String, nullable=True)
    ollama_timeout = Column(Integer, default=300)

    # Processing Settings
    max_retries = Column(Integer, default=3)
    update_title = Column(Boolean, default=True)
    update_correspondent = Column(Boolean, default=True)
    update_document_type = Column(Boolean, default=True)
    update_tags = Column(Boolean, default=True)
    update_creation_date = Column(Boolean, default=False)
    document_word_limit = Column(Integer, default=1500)
    schedule_interval_minutes = Column(Integer, default=0) # 0 means manual/webhook only
    remove_query_tag = Column(Boolean, default=True) # Whether to remove the query tag after processing
    query_tag_id = Column(Integer, nullable=True) # Tag ID used to poll documents
    force_process_tag_id = Column(Integer, nullable=True) # Tag ID that forces reprocessing
    custom_prompt = Column(Text, nullable=True) # Custom instructions for the AI

class ProcessedDocument(Base):
    """Tracks documents that have already been processed to avoid infinite loops."""
    __tablename__ = "processed_documents"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, unique=True, index=True, nullable=False)
    processed_at = Column(DateTime, default=lambda: datetime.now(UTC))
    status = Column(String, default="success") # success, error, skipped
    error_message = Column(Text, nullable=True)

class DocumentChangeLog(Base):
    """Audit log of changes made to documents."""
    __tablename__ = "document_changelog"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, index=True, nullable=False)
    changed_at = Column(DateTime, default=lambda: datetime.now(UTC))

    # Store JSON strings for what was changed
    original_state = Column(JSON, nullable=True) # {title, tags, correspondent, document_type}
    new_state = Column(JSON, nullable=True)      # {title, tags, correspondent, document_type}

    # Metadata about the AI decision
    prompt_used = Column(Text, nullable=True)
    ai_response = Column(Text, nullable=True)
