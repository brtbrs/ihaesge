from fastapi import FastAPI

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging

configure_logging()

app = FastAPI(
    title=settings.project_name,
    version=settings.project_version,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Basic health check endpoint for container orchestrators."""
    return {"status": "ok", "service": settings.project_name}
