from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def api_health_check() -> dict[str, str]:
    """Versioned API health check endpoint."""
    return {"status": "ok", "scope": "api-v1"}
