import os
from dotenv import load_dotenv
import logging
from pathlib import Path

# Load environment variables from .env file if it exists
env_path = Path(".") / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)

# API settings
API_PORT = int(os.getenv("PORT", 8000))
API_HOST = os.getenv("HOST", "0.0.0.0")
API_ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "info").upper()

# Redis settings
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

# Rate limiting
RATE_LIMIT = int(os.getenv("RATE_LIMIT", 100))

# Configure logging
logging_config = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": LOG_LEVEL,
            "formatter": "default",
        },
    },
    "loggers": {
        "": {  # root logger
            "handlers": ["console"],
            "level": LOG_LEVEL,
        },
        "app": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "uvicorn": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
    },
}

# Initialize logging
logging.config.dictConfig(logging_config)
logger = logging.getLogger("app")