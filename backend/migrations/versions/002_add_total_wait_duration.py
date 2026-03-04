"""add total_wait_duration to task

Revision ID: 002
Revises: 001
Create Date: 2026-03-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('task', sa.Column('total_wait_duration', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('task', 'total_wait_duration')
