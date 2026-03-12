from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import News
from app.repositories.base import BaseRepository


class NewsRepository(BaseRepository[News]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(News, session)

    async def get_by_slug(self, slug: str) -> News | None:
        result = await self.session.execute(select(News).where(News.slug == slug))
        return result.scalar_one_or_none()
