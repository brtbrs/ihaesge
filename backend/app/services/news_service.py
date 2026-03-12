from sqlalchemy.ext.asyncio import AsyncSession

from app.models import News
from app.repositories.news_repository import NewsRepository


class NewsService:
    """Service layer for orchestrating news business rules."""

    def __init__(self, session: AsyncSession) -> None:
        self.repository = NewsRepository(session)

    async def get_news_by_slug(self, slug: str) -> News | None:
        return await self.repository.get_by_slug(slug)
