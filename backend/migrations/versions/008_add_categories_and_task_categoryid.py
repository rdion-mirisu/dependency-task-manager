"""create categories table and add category_id to task

Revision ID: 008
Revises: 007
Create Date: 2026-03-11 13:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    # new categories table
    op.create_table(
        'category',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('user.id'), nullable=False),
    )
    # add nullable foreign key column to tasks
    op.add_column('task', sa.Column('category_id', sa.Integer(), sa.ForeignKey('category.id'), nullable=True))


def downgrade():
    # remove column then drop table
    op.drop_column('task', 'category_id')
    op.drop_table('category')
