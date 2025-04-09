from fastapi import APIRouter, HTTPException, Query
import logging
from app.utils.redis.redis_manager import redis_manager

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/health", tags=["Health Check"])

# Logger for this module
logger = logging.getLogger(__name__)

@router.get("/health")
async def health_check():
    """
    Health check endpoint that verifies Redis connectivity and returns overall system status.
    """
    status = {
        "status": "healthy",
        "components": {
            "api": "up",
            "redis": "unknown"
        },
        "details": {}
    }

    # Check Redis connection
    try:
        if redis_manager.is_connected():
            redis_info = redis_manager.client.info()
            status["components"]["redis"] = "up"
            status["details"]["redis"] = {
                "version": redis_info.get("redis_version", "unknown"),
                "memory_used": redis_info.get("used_memory_human", "unknown"),
                "clients_connected": redis_info.get("connected_clients", 0),
                "uptime_days": redis_info.get("uptime_in_days", 0)
            }
        else:
            status["components"]["redis"] = "down"
            status["status"] = "degraded"
    except Exception as e:
        status["components"]["redis"] = "down"
        status["status"] = "degraded"
        status["details"]["redis_error"] = str(e)

    return status