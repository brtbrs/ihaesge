"""initial schema

Revision ID: 20260101_000001
Revises: 
Create Date: 2026-01-01 00:00:01
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260101_000001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False, unique=True),
        sa.Column("base_url", sa.String(length=255), nullable=False),
        sa.Column("rss_url", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "stocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticker", sa.String(length=10), nullable=False, unique=True),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("sector", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("auth_provider", sa.String(length=50), nullable=False, server_default="email"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "pipeline_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pipeline_name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "stock_aliases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stock_id", sa.Integer(), nullable=False),
        sa.Column("alias", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["stock_id"], ["stocks.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("stock_id", "alias", name="uq_stock_alias"),
    )

    op.create_table(
        "corporate_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stock_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("event_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["stock_id"], ["stocks.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "news",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("slug", sa.String(length=500), nullable=False, unique=True),
        sa.Column("original_url", sa.String(length=1000), nullable=False, unique=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column(
            "sentiment",
            sa.Enum("positive", "neutral", "negative", name="sentiment_enum"),
            nullable=False,
            server_default="neutral",
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["source_id"], ["sources.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "user_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("preferred_language", sa.String(length=10), nullable=False, server_default="id"),
        sa.Column("notification_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "user_session_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("logged_in_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "pipeline_log_details",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pipeline_log_id", sa.Integer(), nullable=False),
        sa.Column("step_name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["pipeline_log_id"], ["pipeline_logs.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "news_stocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("news_id", sa.Integer(), nullable=False),
        sa.Column("stock_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["news_id"], ["news.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["stock_id"], ["stocks.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("news_id", "stock_id", name="uq_news_stock"),
    )

    op.create_table(
        "news_tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("news_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["news_id"], ["news.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("news_id", "tag_id", name="uq_news_tag"),
    )


def downgrade() -> None:
    op.drop_table("news_tags")
    op.drop_table("news_stocks")
    op.drop_table("pipeline_log_details")
    op.drop_table("user_session_logs")
    op.drop_table("user_settings")
    op.drop_table("news")
    op.drop_table("corporate_events")
    op.drop_table("stock_aliases")
    op.drop_table("pipeline_logs")
    op.drop_table("users")
    op.drop_table("tags")
    op.drop_table("stocks")
    op.drop_table("sources")
    op.execute("DROP TYPE IF EXISTS sentiment_enum")
