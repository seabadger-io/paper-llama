"""Add webhook_tokens setting

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-03 11:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('webhook_tokens', sa.String(), nullable=True, server_default=sa.text("''")))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.drop_column('webhook_tokens')
