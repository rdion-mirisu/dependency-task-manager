"""add unique constraint on category per user

Revision ID: 009
Revises: 008
Create Date: 2026-03-11 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    # Add a unique constraint for (user_id, name) to prevent duplicate names
    op.create_unique_constraint(
        "uq_category_user_name",
        "category",
        ["user_id", "name"],
    )


def downgrade():
    op.drop_constraint("uq_category_user_name", "category", type_="unique")
