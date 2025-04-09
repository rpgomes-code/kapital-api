from fastapi import APIRouter, HTTPException, Query
import logging
from app.utils.redis.redis_manager import redis_manager
from app.models.health.health import HealthCheckResponse, ComponentStatus

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/health", tags=["Health Check"])

# Logger for this module
logger = logging.getLogger(__name__)

@router.get("/health", response_model=HealthCheckResponse, summary="System Health Check", 
            description="Check the health of the API and its dependencies")
async def health_check():
    """
    Health check endpoint that verifies Redis connectivity and returns overall system status.
    
    Returns:
        - **status**: Overall health status ('healthy' or 'degraded')
        - **components**: Status of individual system components
        - **details**: Additional information about components
    """
    # Initialize default response
    components = ComponentStatus(api="up", redis="unknown")
    status = "healthy"
    details = {}

    # Check Redis connection
    try:
        if redis_manager.is_connected():
            redis_info = redis_manager.client.info()
            components.redis = "up"
            details["redis"] = {
                "version": redis_info.get("redis_version", "unknown"),
                "memory_used": redis_info.get("used_memory_human", "unknown"),
                "clients_connected": redis_info.get("connected_clients", 0),
                "uptime_days": redis_info.get("uptime_in_days", 0)
            }
        else:
            components.redis = "down"
            status = "degraded"
    except Exception as e:
        components.redis = "down"
        status = "degraded"
        details["redis_error"] = str(e)

    return HealthCheckResponse(
        status=status,
        components=components,
        details=details
    )