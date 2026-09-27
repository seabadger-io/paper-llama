"""Add log retention and AI interaction logging settings

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-27 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('log_ai_interactions', sa.Boolean(), nullable=True, server_default=sa.text('1')))
        batch_op.add_column(sa.Column('log_max_ai_chars', sa.Integer(), nullable=True, server_default=sa.text('0')))
        batch_op.add_column(sa.Column('log_retention_days', sa.Integer(), nullable=True, server_default=sa.text('90')))
        batch_op.add_column(sa.Column('log_compact_after_days', sa.Integer(), nullable=True, server_default=sa.text('30')))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.drop_column('log_compact_after_days')
        batch_op.drop_column('log_retention_days')
        batch_op.drop_column('log_max_ai_chars')
        batch_op.drop_column('log_ai_interactions')
