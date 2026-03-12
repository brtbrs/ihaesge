import logging
from logging.config import dictConfig

from app.core.config import settings


def configure_logging() -> None:
    """Configure application-wide logging format and level."""
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                }
            },
            "root": {
                "level": settings.log_level.upper(),
                "handlers": ["console"],
            },
        }
    )
    logging.getLogger(__name__).info("Logging configured")
