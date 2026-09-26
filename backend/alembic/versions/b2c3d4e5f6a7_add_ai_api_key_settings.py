"""Add AI backend API key settings

Revision ID: b2c3d4e5f6a7
Revises: 39f076384aec
Create Date: 2026-09-26 19:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = '39f076384aec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('ollama_api_key', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('llamacpp_api_key', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.drop_column('llamacpp_api_key')
        batch_op.drop_column('ollama_api_key')
