from fastapi import APIRouter, HTTPException, Query
import logging
from app.utils.redis.redis_manager import redis_manager
from app.models.health.health import HealthCheckResponse, ComponentStatus

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/health", tags=["Health Check"])

# Logger for this module
logger = logging.getLogger(__name__)

@router.get("/check", response_model=HealthCheckResponse, summary="System Health Check",
            description="Check the health of the API and its dependencies")
async def health_check():
    """
    Comprehensive health check endpoint that verifies the operational status of the API
    and its critical dependencies.

    This endpoint provides real-time diagnostics about the system's health, monitoring
    the core API service and the Redis caching layer. It's useful for monitoring systems,
    load balancers, and operational dashboards to verify service availability.

    Returns:
    - **HealthCheckResponse**: Object containing detailed health information
      - **status**: Overall system health ('healthy' or 'degraded')
      - **components**: Status of individual system components
      - **details**: Additional technical information about components

    Example response:
    ```json
    {
        "status": "healthy",
        "components": {
            "api": "up",
            "redis": "up"
        },
        "details": {
            "redis": {
                "version": "7.0.5",
                "memory_used": "2.5M",
                "clients_connected": 1,
                "uptime_days": 15
            }
        }
    }
    ```

    Notes:
    - The 'healthy' status indicates all components are functioning properly
    - The 'degraded' status indicates one or more components have issues but the API is still operational
    - Redis connection failures will result in 'degraded' status, but API will continue to function without caching
    - This endpoint is suitable for integration with automated monitoring and alerting systems
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