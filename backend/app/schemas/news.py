from datetime import datetime

from pydantic import BaseModel


class NewsResponse(BaseModel):
    id: int
    title: str
    slug: str
    sentiment: str
    published_at: datetime | None
