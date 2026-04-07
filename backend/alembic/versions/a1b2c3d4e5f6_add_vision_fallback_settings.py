"""Add vision fallback settings

Revision ID: a1b2c3d4e5f6
Revises: 65fb48795450
Create Date: 2026-04-07 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '65fb48795450'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('vision_fallback', sa.String(), nullable=True, server_default='off'))
        batch_op.add_column(sa.Column('vision_pages', sa.Integer(), nullable=True, server_default=sa.text('3')))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.drop_column('vision_pages')
        batch_op.drop_column('vision_fallback')
