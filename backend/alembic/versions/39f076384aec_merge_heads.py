"""Merge heads

Revision ID: 39f076384aec
Revises: 77c214df7ddd, a1b2c3d4e5f6
Create Date: 2026-04-07 16:46:43.411448

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '39f076384aec'
down_revision: Union[str, Sequence[str], None] = ('77c214df7ddd', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
