"""add waiting timestamps, deadline and google oauth fields

Revision ID: 003
Revises: 002
Create Date: 2026-03-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    # task table adjustments
    op.add_column('task', sa.Column('waiting_started_at', sa.DateTime(), nullable=True))
    op.add_column('task', sa.Column('waiting_ended_at', sa.DateTime(), nullable=True))
    op.add_column('task', sa.Column('deadline', sa.DateTime(), nullable=True))

    # user table adjustments
    op.add_column('user', sa.Column('google_access_token', sa.String(length=500), nullable=True))
    op.add_column('user', sa.Column('google_refresh_token', sa.String(length=500), nullable=True))
    op.add_column('user', sa.Column('google_token_expiry', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('task', 'deadline')
    op.drop_column('task', 'waiting_ended_at')
    op.drop_column('task', 'waiting_started_at')

    op.drop_column('user', 'google_token_expiry')
    op.drop_column('user', 'google_refresh_token')
    op.drop_column('user', 'google_access_token')
