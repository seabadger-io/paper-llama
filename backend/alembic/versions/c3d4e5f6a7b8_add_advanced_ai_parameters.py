"""Add advanced AI parameters (temperature, context size, max tokens, extra params)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-26 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('ollama_temperature', sa.Float(), nullable=True, server_default=sa.text('0.0')))
        batch_op.add_column(sa.Column('ollama_context_size', sa.Integer(), nullable=True, server_default=sa.text('4096')))
        batch_op.add_column(sa.Column('ollama_extra_params', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('llamacpp_temperature', sa.Float(), nullable=True, server_default=sa.text('0.0')))
        batch_op.add_column(sa.Column('llamacpp_max_tokens', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('llamacpp_extra_params', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('app_settings', schema=None) as batch_op:
        batch_op.drop_column('llamacpp_extra_params')
        batch_op.drop_column('llamacpp_max_tokens')
        batch_op.drop_column('llamacpp_temperature')
        batch_op.drop_column('ollama_extra_params')
        batch_op.drop_column('ollama_context_size')
        batch_op.drop_column('ollama_temperature')
