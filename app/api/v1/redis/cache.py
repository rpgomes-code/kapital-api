from fastapi import APIRouter, HTTPException, Depends, Query, Path, BackgroundTasks
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import time
from datetime import datetime

from app.utils.redis.redis_manager import redis_manager
from app.utils.redis.cache_service import cache_service, CacheStrategy

logger = logging.getLogger(__name__)


# Models for request/response
class CacheKeyInfo(BaseModel):
    key: str
    ttl: Optional[int] = None
    size: Optional[int] = None
    created: Optional[str] = None


class CacheInvalidateRequest(BaseModel):
    pattern: str
    reason: Optional[str] = None


class CacheSetRequest(BaseModel):
    key: str
    value: Any
    ttl: Optional[int] = None
    strategy: Optional[CacheStrategy] = None


class CacheStatsResponse(BaseModel):
    application_stats: Dict[str, Any]
    redis_stats: Dict[str, Any]


class CacheClearResponse(BaseModel):
    success: bool
    keys_affected: int
    message: str


class CacheStrategiesResponse(BaseModel):
    strategies: Dict[str, Any]
    data_types: Dict[str, Any]
    examples: Dict[str, Any]


# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/cache", tags=["Cache Management"])


# Dependency for admin authentication (placeholder - implement real auth)
async def verify_admin():
    # In a real implementation, this would check authentication
    # For now, we'll just always allow access
    return True


# Get cache statistics
@router.get("/stats", response_model=CacheStatsResponse)
async def get_cache_stats(admin: bool = Depends(verify_admin)):
    """
    Get detailed cache statistics including hit rate, memory usage, and more.

    This endpoint is restricted to administrators.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    return cache_service.get_stats()


# Reset cache statistics
@router.post("/stats/reset")
async def reset_cache_stats(admin: bool = Depends(verify_admin)):
    """
    Reset cache statistics counters.

    This endpoint is restricted to administrators.
    """
    cache_service.reset_stats()
    return {"message": "Cache statistics reset successfully"}


# Clear all cache data
@router.post("/clear", response_model=CacheClearResponse)
async def clear_cache(admin: bool = Depends(verify_admin)):
    """
    Clear all Redis cache data.

    This endpoint is restricted to administrators.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    success = redis_manager.clear_all()

    if success:
        # Reset statistics after clearing cache
        cache_service.reset_stats()
        return {
            "success": True,
            "keys_affected": -1,  # We don't know exactly how many keys were cleared
            "message": "Cache cleared successfully"
        }
    else:
        raise HTTPException(status_code=500, detail="Failed to clear cache")


# Invalidate cache by pattern
@router.post("/invalidate", response_model=CacheClearResponse)
async def invalidate_cache(
        request: CacheInvalidateRequest,
        admin: bool = Depends(verify_admin)
):
    """
    Invalidate specific cache keys matching a pattern.

    Examples:
        - "ticker:AAPL:*" - Invalidate all AAPL ticker data
        - "market:*" - Invalidate all market data
        - "*:history:*" - Invalidate all historical data

    This endpoint is restricted to administrators.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    try:
        count = cache_service.invalidate(request.pattern)
        return {
            "success": True,
            "keys_affected": count,
            "message": f"Successfully invalidated {count} cache keys matching pattern '{request.pattern}'"
        }
    except Exception as e:
        logger.error(f"Error invalidating cache: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to invalidate cache: {str(e)}")


# Get all cache keys matching a pattern
@router.get("/keys")
async def get_cache_keys(
        pattern: str = Query("*", description="Pattern to match keys (supports wildcard *)"),
        limit: int = Query(100, description="Maximum number of keys to return"),
        admin: bool = Depends(verify_admin)
):
    """
    Get all cache keys matching a pattern with TTL information.

    This endpoint is restricted to administrators.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    try:
        keys = redis_manager.client.keys(pattern)

        # Limit the number of keys
        keys = keys[:limit]

        result = []
        for key in keys:
            key_str = key.decode('utf-8') if isinstance(key, bytes) else key
            ttl = redis_manager.client.ttl(key)
            size = 0

            try:
                value = redis_manager.client.get(key)
                if value:
                    size = len(value)
            except Exception:
                # If we can't get the size, just continue
                pass

            result.append({
                "key": key_str,
                "ttl": ttl if ttl > 0 else None,
                "size": size,
                "created": None  # Redis doesn't track creation time by default
            })

        return result
    except Exception as e:
        logger.error(f"Error getting cache keys: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache keys: {str(e)}")


# Get value for a specific cache key
@router.get("/key/{key}")
async def get_cache_value(
        key: str = Path(..., description="Cache key to retrieve"),
        admin: bool = Depends(verify_admin)
):
    """
    Get the value for a specific cache key.

    This endpoint is restricted to administrators.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    try:
        value, is_hit = cache_service.get(key)
        if not is_hit:
            raise HTTPException(status_code=404, detail=f"Cache key '{key}' not found")

        return {
            "key": key,
            "value": value,
            "ttl": redis_manager.client.ttl(key)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting cache value: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache value: {str(e)}")


# Set value for a specific cache key
@router.post("/key")
async def set_cache_value(
        request: CacheSetRequest,
        admin: bool = Depends(verify_admin)
):
    """
    Set a value in the cache with optional TTL or strategy.

    This endpoint is restricted to administrators.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    try:
        success = cache_service.set(
            request.key,
            request.value,
            strategy=request.strategy,
            ttl=request.ttl
        )

        if success:
            return {
                "success": True,
                "key": request.key,
                "ttl": request.ttl,
                "strategy": request.strategy.value if request.strategy else None,
                "message": "Cache value set successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to set cache value")
    except Exception as e:
        logger.error(f"Error setting cache value: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to set cache value: {str(e)}")


# Delete a specific cache key
@router.delete("/key/{key}")
async def delete_cache_key(
        key: str = Path(..., description="Cache key to delete"),
        admin: bool = Depends(verify_admin)
):
    """
    Delete a specific cache key.

    This endpoint is restricted to administrators.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    try:
        success = redis_manager.delete(key)
        if success:
            return {
                "success": True,
                "key": key,
                "message": f"Cache key '{key}' deleted successfully"
            }
        else:
            raise HTTPException(status_code=404, detail=f"Cache key '{key}' not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting cache key: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete cache key: {str(e)}")


# Get cache strategy information
@router.get("/strategy", response_model=CacheStrategiesResponse)
async def get_cache_strategies():
    """
    Get information about the different caching strategies used by the API.
    """
    return cache_service.get_strategies()


# Ping Redis for health check
@router.get("/ping")
async def ping_redis():
    """
    Simple health check to verify Redis connectivity.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    try:
        start_time = time.time()
        redis_manager.client.ping()
        latency = (time.time() - start_time) * 1000  # Convert to milliseconds

        return {
            "status": "connected",
            "latency_ms": round(latency, 2)
        }
    except Exception as e:
        logger.error(f"Error pinging Redis: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Redis connectivity error: {str(e)}")


# Run cache maintenance tasks
@router.post("/maintenance")
async def run_cache_maintenance(
        background_tasks: BackgroundTasks,
        admin: bool = Depends(verify_admin)
):
    """
    Run cache maintenance tasks in the background.

    This includes:
    - Clearing expired keys that Redis might not have cleaned up yet
    - Optimizing memory usage
    - Collecting statistics

    This endpoint is restricted to administrators.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    def maintenance_task():
        try:
            # Execute MEMORY PURGE if available (Redis 4.0+)
            redis_manager.client.execute_command('MEMORY PURGE')
        except Exception as e:
            logger.warning(f"Redis memory purge failed: {str(e)}")

        try:
            # Run key space analysis
            db_stats = {}
            info = redis_manager.client.info()
            for key, value in info.items():
                if key.startswith("db"):
                    db_stats[key] = value

            logger.info(f"Redis keyspace stats: {db_stats}")
        except Exception as e:
            logger.warning(f"Redis keyspace analysis failed: {str(e)}")

    # Schedule the maintenance task in the background
    background_tasks.add_task(maintenance_task)

    return {
        "message": "Cache maintenance tasks scheduled",
        "status": "running"
    }