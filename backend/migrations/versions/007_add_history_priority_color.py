"""add task_history table and priority/color fields to task

Revision ID: 007
Revises: 006
Create Date: 2026-03-11 12:30:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    # create new table to capture task history entries
    op.create_table(
        'task_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('task_id', sa.Integer(), sa.ForeignKey('task.id')),  # simple FK
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('actor_user_id', sa.String(length=36), sa.ForeignKey('user.id')),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # add priority and color_code to task table
    op.add_column('task', sa.Column('priority', sa.String(length=10), nullable=False, server_default='Low'))
    op.add_column('task', sa.Column('color_code', sa.String(length=7), nullable=False, server_default='#808080'))


def downgrade():
    # drop the newly added columns and table
    op.drop_column('task', 'color_code')
    op.drop_column('task', 'priority')
    op.drop_table('task_history')
