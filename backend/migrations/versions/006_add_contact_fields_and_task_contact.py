"""add email/org/created_at to contact and add contact_id to task

Revision ID: 006
Revises: 005
Create Date: 2026-03-11 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    # add new columns to contact table
    op.add_column('contact', sa.Column('email', sa.String(length=120), nullable=True))
    op.add_column('contact', sa.Column('organization', sa.String(length=120), nullable=True))
    op.add_column('contact', sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))
    op.add_column('contact', sa.Column('user_id', sa.String(length=36), nullable=True))
    op.create_foreign_key('fk_contact_user', 'contact', 'user', ['user_id'], ['id'])

    # add contact_id on task table
    op.add_column('task', sa.Column('contact_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_task_contact', 'task', 'contact', ['contact_id'], ['id'])


def downgrade():
    # remove foreign keys then columns
    op.drop_constraint('fk_task_contact', 'task', type_='foreignkey')
    op.drop_column('task', 'contact_id')

    op.drop_constraint('fk_contact_user', 'contact', type_='foreignkey')
    op.drop_column('contact', 'user_id')
    op.drop_column('contact', 'created_at')
    op.drop_column('contact', 'organization')
    op.drop_column('contact', 'email')
