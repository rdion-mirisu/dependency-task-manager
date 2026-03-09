"""add category/urgency to task and contact details to waiting_detail

Revision ID: 005
Revises: 004
Create Date: 2026-03-10 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    # task fields
    op.add_column('task', sa.Column('category', sa.String(length=100), nullable=False, server_default=''))
    op.add_column('task', sa.Column('urgency', sa.String(length=50), nullable=False, server_default=''))
    op.alter_column('task', 'description', existing_type=sa.TEXT(), nullable=False, server_default='')

    # waiting_detail adjustments
    op.add_column('waiting_detail', sa.Column('contact_name', sa.String(length=100), nullable=False, server_default=''))
    op.add_column('waiting_detail', sa.Column('department', sa.String(length=100), nullable=False, server_default=''))
    op.alter_column('waiting_detail', 'reason', existing_type=sa.String(length=255), nullable=False, server_default='')
    # drop the old foreign key column, if it exists
    with op.batch_alter_table('waiting_detail') as batch_op:
        batch_op.drop_column('contact_id')


def downgrade():
    # downgrade reverse of upgrade
    with op.batch_alter_table('waiting_detail') as batch_op:
        batch_op.add_column(sa.Column('contact_id', sa.Integer(), sa.ForeignKey('contact.id')))
        batch_op.drop_column('department')
        batch_op.drop_column('contact_name')
        batch_op.alter_column('reason', existing_type=sa.String(length=255), nullable=True, server_default=None)

    op.alter_column('task', 'description', existing_type=sa.TEXT(), nullable=True, server_default=None)
    op.drop_column('task', 'urgency')
    op.drop_column('task', 'category')
