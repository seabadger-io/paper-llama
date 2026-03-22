"""Add AppSettings and custom prompt

Revision ID: e735d4aa3bff
Revises: 
Create Date: 2026-03-22 11:45:06.833424

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e735d4aa3bff'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'admin_users' not in tables:
        op.create_table('admin_users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_admin_users_id'), 'admin_users', ['id'], unique=False)
        op.create_index(op.f('ix_admin_users_username'), 'admin_users', ['username'], unique=True)
        op.create_table('app_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('paperless_url', sa.String(), nullable=True),
        sa.Column('paperless_token', sa.String(), nullable=True),
        sa.Column('ollama_url', sa.String(), nullable=True),
        sa.Column('ollama_model', sa.String(), nullable=True),
        sa.Column('update_title', sa.Boolean(), nullable=True),
        sa.Column('update_correspondent', sa.Boolean(), nullable=True),
        sa.Column('update_document_type', sa.Boolean(), nullable=True),
        sa.Column('update_tags', sa.Boolean(), nullable=True),
        sa.Column('document_word_limit', sa.Integer(), nullable=True),
        sa.Column('schedule_interval_minutes', sa.Integer(), nullable=True),
        sa.Column('remove_query_tag', sa.Boolean(), nullable=True),
        sa.Column('query_tag_id', sa.Integer(), nullable=True),
        sa.Column('force_process_tag_id', sa.Integer(), nullable=True),
        sa.Column('custom_prompt', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_app_settings_id'), 'app_settings', ['id'], unique=False)
        op.create_table('document_changelog',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('changed_at', sa.DateTime(), nullable=True),
        sa.Column('original_state', sa.JSON(), nullable=True),
        sa.Column('new_state', sa.JSON(), nullable=True),
        sa.Column('prompt_used', sa.Text(), nullable=True),
        sa.Column('ai_response', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_document_changelog_document_id'), 'document_changelog', ['document_id'], unique=False)
        op.create_index(op.f('ix_document_changelog_id'), 'document_changelog', ['id'], unique=False)
        op.create_table('processed_documents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('document_id', sa.Integer(), nullable=False),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_processed_documents_document_id'), 'processed_documents', ['document_id'], unique=True)
        op.create_index(op.f('ix_processed_documents_id'), 'processed_documents', ['id'], unique=False)
    else:
        # Backward compatibility for existing databases:
        # Existing DBs without Alembic already have tables. We just add the missing columns.
        columns = [c['name'] for c in inspector.get_columns('app_settings')]
        if 'custom_prompt' not in columns:
            op.add_column('app_settings', sa.Column('custom_prompt', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    
    if 'processed_documents' in tables:
        op.drop_index(op.f('ix_processed_documents_id'), table_name='processed_documents')
        op.drop_index(op.f('ix_processed_documents_document_id'), table_name='processed_documents')
        op.drop_table('processed_documents')
    if 'document_changelog' in tables:
        op.drop_index(op.f('ix_document_changelog_id'), table_name='document_changelog')
        op.drop_index(op.f('ix_document_changelog_document_id'), table_name='document_changelog')
        op.drop_table('document_changelog')
    if 'app_settings' in tables:
        op.drop_index(op.f('ix_app_settings_id'), table_name='app_settings')
        op.drop_table('app_settings')
    if 'admin_users' in tables:
        op.drop_index(op.f('ix_admin_users_username'), table_name='admin_users')
        op.drop_index(op.f('ix_admin_users_id'), table_name='admin_users')
        op.drop_table('admin_users')
