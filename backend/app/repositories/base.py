from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    """Base repository implementing simple CRUD helpers."""

    def __init__(self, model: type[ModelType], session: AsyncSession) -> None:
        self.model = model
        self.session = session

    async def get(self, entity_id: int) -> ModelType | None:
        stmt = select(self.model).where(getattr(self.model, "id") == entity_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, obj: ModelType) -> ModelType:
        self.session.add(obj)
        await self.session.flush()
        return obj
