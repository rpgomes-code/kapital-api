import time
import logging

from fastapi import (
    APIRouter, 
    HTTPException, 
    Depends, 
    Query, 
    Path, 
    BackgroundTasks
)

from app.utils.auth.auth import verify_admin

from app.utils.redis.redis_manager import redis_manager
from app.utils.redis.cache_service import cache_service
from app.models.redis.cache import (
    CacheInvalidateRequest, 
    CacheSetRequest, 
    CacheStatsResponse, 
    CacheClearResponse, 
    CacheStrategiesResponse,
    KeyListResponse,
    KeyValueResponse,
    PingResponse,
    MaintenanceResponse
)

logger = logging.getLogger(__name__)

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/cache", tags=["Cache Management"])

# Get cache statistics
@router.get("/stats", response_model=CacheStatsResponse, summary="Cache Statistics")
async def get_cache_stats(admin: bool = Depends(verify_admin)):
    """
    Get detailed cache statistics including hit rate, memory usage, and more.
    
    This endpoint provides comprehensive statistics about the Redis cache, including application-level
    metrics like hit/miss rates and server-level information like memory usage and client connections.
    It's useful for monitoring cache efficiency and diagnosing performance issues.
    
    Parameters:
    - None required
    
    Returns:
    - **CacheStatsResponse**: Object containing detailed cache statistics
      - **application_stats**: Application-level metrics (hits, misses, rates)
      - **redis_stats**: Redis server metrics (memory, clients, etc.)
    
    Example response:
    ```json
    {
        "application_stats": {
            "hits": 1250,
            "misses": 420,
            "sets": 450,
            "errors": 5,
            "hit_rate": 74.85,
            "total_requests": 1670,
            "uptime_seconds": 3600
        },
        "redis_stats": {
            "status": "connected",
            "version": "7.0.5",
            "memory": {
                "used_memory_human": "6.5M",
                "used_memory_peak_human": "7.2M"
            },
            "clients": {
                "connected_clients": 2
            }
        }
    }
    ```
    
    Notes:
    - This endpoint is restricted to administrators
    - Hit rate is calculated as (hits / (hits + misses)) * 100
    - Memory statistics are provided in human-readable format
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    return cache_service.get_stats()


# Reset cache statistics
@router.post("/stats/reset", summary="Reset Cache Statistics")
async def reset_cache_stats(admin: bool = Depends(verify_admin)):
    """
    Reset cache statistics counters to zero.
    
    This endpoint resets all application-level cache statistics (hits, misses, etc.) 
    without affecting the actual cache data or Redis server statistics. It's useful 
    for beginning a fresh monitoring period or after making significant changes to 
    the caching strategy.
    
    Parameters:
    - None required
    
    Returns:
    - Simple message confirming the statistics have been reset
    
    Example response:
    ```json
    {
        "message": "Cache statistics reset successfully"
    }
    ```
    
    Notes:
    - This endpoint is restricted to administrators
    - Only application-level statistics are reset (hits, misses, etc.)
    - Redis server statistics are not affected by this operation
    - The uptime counter is reset to the current time
    """
    cache_service.reset_stats()
    return {"message": "Cache statistics reset successfully"}


# Clear all cache data
@router.post("/clear", response_model=CacheClearResponse, summary="Clear All Cache")
async def clear_cache(admin: bool = Depends(verify_admin)):
    """
    Clear all Redis cache data.
    
    This endpoint removes all cached data from Redis, effectively purging the entire cache.
    It's useful for troubleshooting, after major data updates, or when deploying new API versions
    with incompatible data structures.
    
    Parameters:
    - None required
    
    Returns:
    - **CacheClearResponse**: Object containing the operation result
      - **success**: Whether the operation was successful
      - **keys_affected**: Number of keys that were cleared (-1 if unknown)
      - **message**: Description of the action performed
    
    Example response:
    ```json
    {
        "success": true,
        "keys_affected": -1,
        "message": "Cache cleared successfully"
    }
    ```
    
    Notes:
    - This endpoint is restricted to administrators
    - This operation cannot be undone - all cached data will be permanently removed
    - Application statistics are also reset after clearing the cache
    - After clearing, the API may experience temporarily reduced performance until the cache is rebuilt
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
@router.post("/invalidate", response_model=CacheClearResponse, summary="Invalidate Cache Keys by Pattern")
async def invalidate_cache(
        request: CacheInvalidateRequest,
        admin: bool = Depends(verify_admin)
):
    """
    Invalidate specific cache keys matching a pattern.
    
    This endpoint selectively removes cached data that matches a specified pattern.
    It provides finer control than clearing the entire cache, allowing targeted
    invalidation of specific data categories or entities.
    
    Parameters:
    - **pattern**: Pattern to match keys for invalidation (supports wildcards)
    - **reason**: Optional reason for invalidation (for logging purposes)
    
    Pattern examples:
    - `"*:ticker:AAPL"` - Invalidate all AAPL ticker data
    - `"market:*"` - Invalidate all market data
    - `"*:history:*"` - Invalidate all historical data
    
    Returns:
    - **CacheClearResponse**: Object containing the operation result
      - **success**: Whether the operation was successful
      - **keys_affected**: Number of keys that were invalidated
      - **message**: Description of the action performed
    
    Example response:
    ```json
    {
        "success": true,
        "keys_affected": 15,
        "message": "Successfully invalidated 15 cache keys matching pattern 'ticker:AAPL:*'"
    }
    ```
    
    Notes:
    - This endpoint is restricted to administrators
    - The pattern uses Redis KEYS command syntax (glob-style wildcards)
    - Invalid patterns will not raise an error but may match no keys
    - This operation is useful after specific data updates or when certain cache entries become stale
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
@router.get("/keys", response_model=KeyListResponse, summary="List Cache Keys")
async def get_cache_keys(
        pattern: str = Query("*", description="Pattern to match keys (supports wildcard *)"),
        limit: int = Query(100, description="Maximum number of keys to return", ge=1, le=1000),
        admin: bool = Depends(verify_admin)
):
    """
    Get all cache keys matching a pattern with TTL information.
    
    This endpoint retrieves a list of cache keys that match the specified pattern,
    along with metadata about each key such as TTL (time to live) and size.
    It's useful for exploring the cache contents, diagnosing issues, and
    planning cache management strategies.
    
    Parameters:
    - **pattern**: Pattern to match keys (uses Redis glob-style wildcards)
    - **limit**: Maximum number of keys to return (default: 100, max: 1000)
    
    Returns:
    - **KeyListResponse**: Object containing the matched keys and metadata
      - **keys**: List of cache key information objects
      - **count**: Number of keys returned
      - **pattern**: Pattern used to match keys
    
    Example response:
    ```json
    {
        "keys": [
            {
                "key": "kapital:ticker:AAPL:info",
                "ttl": 259200,
                "size": 45237,
                "created": null
            },
            {
                "key": "kapital:ticker:MSFT:info",
                "ttl": 259200,
                "size": 42150,
                "created": null
            }
        ],
        "count": 2,
        "pattern": "kapital:ticker:*:info"
    }
    ```
    
    Notes:
    - This endpoint is restricted to administrators
    - The pattern uses Redis KEYS command syntax (glob-style wildcards)
    - The 'created' field is typically null as Redis doesn't track creation time by default
    - This operation can be expensive on large databases - use specific patterns when possible
    - Results are limited to protect against returning too many keys
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

        return {
            "keys": result,
            "count": len(result),
            "pattern": pattern
        }
    except Exception as e:
        logger.error(f"Error getting cache keys: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache keys: {str(e)}")


# Get value for a specific cache key
@router.get("/key/{key}", response_model=KeyValueResponse, summary="Get Cache Key Value")
async def get_cache_value(
        key: str = Path(..., description="Cache key to retrieve"),
        admin: bool = Depends(verify_admin)
):
    """
    Get the value for a specific cache key.
    
    This endpoint retrieves the current value and metadata for a specific cache key.
    It's useful for debugging, verifying cached content, and diagnosing issues with
    specific cache entries.
    
    Parameters:
    - **key**: The exact cache key to retrieve
    
    Returns:
    - **KeyValueResponse**: Object containing the key, value, and TTL information
      - **key**: The cache key
      - **value**: The cached value
      - **ttl**: Time to live in seconds, or null if no expiry
    
    Example response:
    ```json
    {
        "key": "kapital:ticker:AAPL:info",
        "value": {
            "symbol": "AAPL",
            "shortName": "Apple Inc.",
            "longName": "Apple Inc.",
            "sector": "Technology",
            "industry": "Consumer Electronics"
        },
        "ttl": 259200
    }
    ```
    
    Notes:
    - This endpoint is restricted to administrators
    - Returns 404 if the key does not exist in the cache
    - The TTL value represents the seconds remaining until expiry
    - TTL is null for keys with no expiration
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
@router.post("/key", summary="Set Cache Key Value")
async def set_cache_value(
        request: CacheSetRequest,
        admin: bool = Depends(verify_admin)
):
    """
    Set a value in the cache with optional TTL or strategy.
    
    This endpoint allows manual insertion or update of values in the cache.
    It provides full control over the cache key, value, and expiration settings,
    useful for preheating the cache or testing different caching strategies.
    
    Parameters:
    - **key**: The cache key to set
    - **value**: The value to cache (must be JSON serializable)
    - **ttl**: Optional time to live in seconds (overrides strategy)
    - **strategy**: Optional caching strategy to use
    
    Returns:
    - Object containing information about the set operation
    
    Example response:
    ```json
    {
        "success": true,
        "key": "kapital:custom:market:status",
        "ttl": 3600,
        "strategy": null,
        "message": "Cache value set successfully"
    }
    ```
    
    Notes:
    - This endpoint is restricted to administrators
    - If both TTL and strategy are provided, TTL takes precedence
    - The value must be JSON serializable 
    - Setting a key with existing value will override the previous value
    - This operation can be useful for testing or for manually inserting computed values
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
@router.delete("/key/{key}", summary="Delete Cache Key")
async def delete_cache_key(
        key: str = Path(..., description="Cache key to delete"),
        admin: bool = Depends(verify_admin)
):
    """
    Delete a specific cache key.
    
    This endpoint removes a single cache entry identified by its key.
    It provides precise control for removing specific cached values,
    useful when individual entries become invalid or for testing purposes.
    
    Parameters:
    - **key**: The exact cache key to delete
    
    Returns:
    - Object containing information about the delete operation
    
    Example response:
    ```json
    {
        "success": true,
        "key": "kapital:ticker:AAPL:info",
        "message": "Cache key 'kapital:ticker:AAPL:info' deleted successfully"
    }
    ```
    
    Notes:
    - This endpoint is restricted to administrators
    - Returns 404 if the key does not exist in the cache
    - Deleting a key is permanent and cannot be undone
    - This operation affects only the specified key, not any pattern-matched keys
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
@router.get("/strategy", response_model=CacheStrategiesResponse, summary="Get Cache Strategies")
async def get_cache_strategies():
    """
    Get information about the different caching strategies used by the API.
    
    This endpoint provides comprehensive documentation about the API's caching strategies,
    including default TTLs for different data types and examples of how these strategies
    are applied to specific endpoints. It's useful for understanding how the cache behaves
    and optimizing API usage patterns.
    
    Parameters:
    - None required
    
    Returns:
    - **CacheStrategiesResponse**: Object containing cache strategy information
      - **strategies**: Available strategies and their TTL values
      - **data_types**: Default strategies for different types of data
      - **examples**: Example endpoints with their assigned strategies
    
    Example response:
    ```json
    {
        "strategies": {
            "SHORT": {"ttl_seconds": 60},
            "MEDIUM": {"ttl_seconds": 900},
            "LONG": {"ttl_seconds": 3600},
            "DAILY": {"ttl_seconds": 86400}
        },
        "data_types": {
            "market_data": "SHORT",
            "ticker_info": "LONG",
            "financial_statements": "DAILY"
        },
        "examples": {
            "market_status": {
                "endpoint": "/v1/market/status",
                "strategy": "SHORT",
                "ttl_seconds": 60
            }
        }
    }
    ```
    
    Notes:
    - This endpoint is publicly accessible to help users understand caching behavior
    - The 'DAILY' strategy invalidates at midnight UTC regardless of TTL seconds
    - Different data types have different optimal caching strategies based on update frequency
    - Understanding these strategies can help optimize API usage and reduce redundant requests
    """
    return cache_service.get_strategies()


# Ping Redis for health check
@router.get("/ping", response_model=PingResponse, summary="Redis Ping Health Check")
async def ping_redis():
    """
    Simple health check to verify Redis connectivity.
    
    This endpoint performs a basic connectivity test to the Redis cache server,
    measuring latency and confirming availability. It's useful for monitoring systems,
    troubleshooting connectivity issues, and verifying that the caching layer is
    operational.
    
    Parameters:
    - None required
    
    Returns:
    - **PingResponse**: Object containing connection status and latency
      - **status**: Connection status ('connected' or 'disconnected')
      - **latency_ms**: Round-trip latency in milliseconds
    
    Example response:
    ```json
    {
        "status": "connected",
        "latency_ms": 0.53
    }
    ```
    
    Notes:
    - This is a lightweight operation that doesn't affect cache data
    - High latency (>10ms) may indicate network issues or Redis server load
    - Connection failures will return a 503 Service Unavailable response
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
@router.post("/maintenance", response_model=MaintenanceResponse, summary="Run Cache Maintenance")
async def run_cache_maintenance(
        background_tasks: BackgroundTasks,
        admin: bool = Depends(verify_admin)
):
    """
    Run cache maintenance tasks in the background.
    
    This endpoint initiates background maintenance operations on the Redis cache,
    including memory optimization, expired key cleanup, and analytics collection.
    It helps maintain optimal cache performance without interrupting regular API operations.
    
    Maintenance operations include:
    - Memory purging to reclaim unused memory
    - Keyspace analysis to identify distribution patterns
    - Statistics collection for monitoring
    
    Parameters:
    - None required
    
    Returns:
    - **MaintenanceResponse**: Object confirming that maintenance tasks were scheduled
      - **message**: Description of the action taken
      - **status**: Current status of the maintenance task
    
    Example response:
    ```json
    {
        "message": "Cache maintenance tasks scheduled",
        "status": "running"
    }
    ```
    
    Notes:
    - This endpoint is restricted to administrators
    - Maintenance operations run in the background and don't block the response
    - These tasks help optimize Redis memory usage and performance
    - For large Redis instances, maintenance can temporarily increase CPU usage
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