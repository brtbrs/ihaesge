from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Source(TimestampMixin, Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    base_url: Mapped[str] = mapped_column(String(255), nullable=False)
    rss_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    news_items: Mapped[list["News"]] = relationship(back_populates="source")


class Stock(TimestampMixin, Base):
    __tablename__ = "stocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticker: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)

    aliases: Mapped[list["StockAlias"]] = relationship(back_populates="stock")
    news_relations: Mapped[list["NewsStock"]] = relationship(back_populates="stock")
    corporate_events: Mapped[list["CorporateEvent"]] = relationship(back_populates="stock")


class StockAlias(TimestampMixin, Base):
    __tablename__ = "stock_aliases"
    __table_args__ = (UniqueConstraint("stock_id", "alias", name="uq_stock_alias"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_id: Mapped[int] = mapped_column(ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    alias: Mapped[str] = mapped_column(String(100), nullable=False)

    stock: Mapped[Stock] = relationship(back_populates="aliases")


class CorporateEvent(TimestampMixin, Base):
    __tablename__ = "corporate_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_id: Mapped[int] = mapped_column(ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    event_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    stock: Mapped[Stock] = relationship(back_populates="corporate_events")


class Tag(TimestampMixin, Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    news_relations: Mapped[list["NewsTag"]] = relationship(back_populates="tag")


class News(TimestampMixin, Base):
    __tablename__ = "news"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    original_url: Mapped[str] = mapped_column(String(1000), unique=True, nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    sentiment: Mapped[str] = mapped_column(
        Enum("positive", "neutral", "negative", name="sentiment_enum"),
        default="neutral",
        nullable=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    source: Mapped[Source | None] = relationship(back_populates="news_items")
    stock_relations: Mapped[list["NewsStock"]] = relationship(back_populates="news")
    tag_relations: Mapped[list["NewsTag"]] = relationship(back_populates="news")


class NewsStock(TimestampMixin, Base):
    __tablename__ = "news_stocks"
    __table_args__ = (UniqueConstraint("news_id", "stock_id", name="uq_news_stock"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    news_id: Mapped[int] = mapped_column(ForeignKey("news.id", ondelete="CASCADE"), nullable=False)
    stock_id: Mapped[int] = mapped_column(ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)

    news: Mapped[News] = relationship(back_populates="stock_relations")
    stock: Mapped[Stock] = relationship(back_populates="news_relations")


class NewsTag(TimestampMixin, Base):
    __tablename__ = "news_tags"
    __table_args__ = (UniqueConstraint("news_id", "tag_id", name="uq_news_tag"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    news_id: Mapped[int] = mapped_column(ForeignKey("news.id", ondelete="CASCADE"), nullable=False)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)

    news: Mapped[News] = relationship(back_populates="tag_relations")
    tag: Mapped[Tag] = relationship(back_populates="news_relations")


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(50), default="email", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    settings: Mapped["UserSettings"] = relationship(back_populates="user", uselist=False)
    session_logs: Mapped[list["UserSessionLog"]] = relationship(back_populates="user")


class UserSettings(TimestampMixin, Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    preferred_language: Mapped[str] = mapped_column(String(10), default="id", nullable=False)
    notification_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped[User] = relationship(back_populates="settings")


class UserSessionLog(TimestampMixin, Base):
    __tablename__ = "user_session_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logged_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped[User] = relationship(back_populates="session_logs")


class PipelineLog(TimestampMixin, Base):
    __tablename__ = "pipeline_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    pipeline_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    details: Mapped[list["PipelineLogDetail"]] = relationship(back_populates="pipeline_log")


class PipelineLogDetail(TimestampMixin, Base):
    __tablename__ = "pipeline_log_details"

    id: Mapped[int] = mapped_column(primary_key=True)
    pipeline_log_id: Mapped[int] = mapped_column(
        ForeignKey("pipeline_logs.id", ondelete="CASCADE"), nullable=False
    )
    step_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    pipeline_log: Mapped[PipelineLog] = relationship(back_populates="details")
