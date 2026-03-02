"""Initial tables

Revision ID: 001
Revises: 
Create Date: 2026-03-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create user table
    op.create_table('user',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('username', sa.String(80), nullable=False),
        sa.Column('email', sa.String(120), nullable=False),
        sa.Column('password_hash', sa.String(128), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username')
    )

    # Create contact table
    op.create_table('contact',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100)),
        sa.Column('phone', sa.String(20)),
        sa.PrimaryKeyConstraint('id')
    )

    # Create task table
    op.create_table('task',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # Create waiting_detail table
    op.create_table('waiting_detail',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer()),
        sa.Column('contact_id', sa.Integer()),
        sa.Column('reason', sa.String(255)),
        sa.Column('wait_start_per_date', sa.DateTime()),
        sa.ForeignKeyConstraint(['contact_id'], ['contact.id']),
        sa.ForeignKeyConstraint(['task_id'], ['task.id']),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('waiting_detail')
    op.drop_table('task')
    op.drop_table('contact')
    op.drop_table('user')
