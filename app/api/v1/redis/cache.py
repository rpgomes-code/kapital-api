from fastapi import APIRouter, HTTPException
import logging
from app.utils.redis.redis_manager import redis_manager
from app.utils.redis.cache_strategies import ALL_CACHE_STRATEGIES

# Create a router with a specific prefix and tag
router = APIRouter(prefix="/v1/cache", tags=["Cache"])

# Logger for this module
logger = logging.getLogger(__name__)

# Get cache strategy information
@router.get("/strategy")
def get_cache_strategy():
    """
    Returns recommended caching strategies for all endpoints based on the config.
    This can be used by a caching layer or proxy to set appropriate cache TTLs.
    """
    return ALL_CACHE_STRATEGIES


# Clear Redis cache
@router.post("/clear")
def clear_cache():
    """
    Clear all Redis cache data.
    This is an administrative endpoint that should be secured in production.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    success = redis_manager.clear_all()
    if success:
        return {"message": "Cache cleared successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to clear cache")


# Cache stats endpoint
@router.get("/stats")
def get_cache_stats():
    """
    Get Redis cache statistics.
    This is an informational endpoint that should be secured in production.
    """
    if not redis_manager.is_connected():
        raise HTTPException(status_code=503, detail="Redis cache is not available")

    try:
        stats = redis_manager.client.info()

        # Base stats
        cache_stats = {
            "used_memory": stats.get("used_memory_human", "Unknown"),
            "used_memory_peak": stats.get("used_memory_peak_human", "Unknown"),
            "clients_connected": stats.get("connected_clients", 0),
            "uptime_days": stats.get("uptime_in_days", 0),
            "hits": stats.get("keyspace_hits", 0),
            "misses": stats.get("keyspace_misses", 0),
            "hit_rate": stats.get("keyspace_hits", 0) / max(1, (
                    stats.get("keyspace_hits", 0) + stats.get("keyspace_misses", 0))) * 100,
        }

        # Handle keys count more flexibly
        key_counts = {}
        for key, value in stats.items():
            if not key.startswith("db"):
                continue

            try:
                if isinstance(value, dict):
                    # Newer Redis clients return parsed dictionaries
                    key_counts[key] = value.get("keys", 0)
                elif isinstance(value, str):
                    # Older format returns strings
                    parts = value.split(",")
                    for part in parts:
                        if part.startswith("keys="):
                            key_counts[key] = int(part.split("=")[1])
                            break
                    else:
                        key_counts[key] = 0
                else:
                    # Fallback
                    key_counts[key] = 0
            except Exception as e:
                # Debug any parsing issues
                logger.debug(f"Error parsing Redis info for {key}: {e}")
                key_counts[key] = 0

        cache_stats["keys"] = key_counts
        return cache_stats
    except Exception as e:
        logger.error(f"Error getting cache stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get cache stats: {str(e)}")