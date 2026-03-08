"""add is_admin flag to user

Revision ID: 004
Revises: 003
Create Date: 2026-03-08 00:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('user', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column('user', 'is_admin')
