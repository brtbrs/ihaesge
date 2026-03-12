import asyncio
import logging

from app.pipelines.news_pipeline import run_news_pipeline

logger = logging.getLogger(__name__)


async def worker_loop(poll_interval_seconds: int = 30) -> None:
    """Simple async worker loop placeholder; can be replaced with Celery/RQ in next iteration."""
    logger.info("Worker loop started with interval=%s", poll_interval_seconds)
    while True:
        await run_news_pipeline()
        await asyncio.sleep(poll_interval_seconds)
