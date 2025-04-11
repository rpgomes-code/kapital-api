import time
import logging

from enum import Enum

from typing import (
    Dict, 
    Any, 
    Optional, 
    Tuple
)

from app.utils.redis.redis_manager import redis_manager

logger = logging.getLogger(__name__)

class CacheStrategy(str, Enum):
    """Cache strategy types"""
    NO_CACHE = "no_cache"
    SHORT = "short"  # 30 seconds to 5 minutes
    MEDIUM = "medium"  # 5 to 30 minutes
    LONG = "long"  # 30 minutes to 2 hours
    DAILY = "daily"  # Invalidated at midnight
    WEEKLY = "weekly"  # 1 week
    MONTHLY = "monthly"  # 30 days
    QUARTERLY = "quarterly"  # 90 days

class CacheService:
    """
    Service for managing cache configurations and operations.
    """

    # Default TTL values in seconds
    DEFAULT_TTL = {
        CacheStrategy.NO_CACHE: 0,
        CacheStrategy.SHORT: 60,  # 1 minute
        CacheStrategy.MEDIUM: 900,  # 15 minutes
        CacheStrategy.LONG: 3600,  # 1 hour
        CacheStrategy.DAILY: 86400,  # 1 day
        CacheStrategy.WEEKLY: 604800,  # 7 days
        CacheStrategy.MONTHLY: 2592000,  # 30 days
        CacheStrategy.QUARTERLY: 7776000  # 90 days
    }

    # Default strategy by data type
    DATA_TYPE_STRATEGIES = {
        "market_data": CacheStrategy.SHORT,
        "ticker_info": CacheStrategy.LONG,
        "financial_statements": CacheStrategy.DAILY,
        "historical_prices": CacheStrategy.DAILY,
        "company_profile": CacheStrategy.MONTHLY,
        "recommendations": CacheStrategy.DAILY,
        "search_results": CacheStrategy.SHORT
    }

    def __init__(self):
        """Initialize the cache service"""
        self.stats = {
            "hits": 0,
            "misses": 0,
            "errors": 0,
            "sets": 0
        }
        self._last_stats_reset = time.time()

    def get_ttl(self, strategy: CacheStrategy) -> int:
        """Get TTL in seconds for a given strategy"""
        return self.DEFAULT_TTL.get(strategy, 300)  # Default to 5 minutes

    def get_strategy_for_endpoint(self, endpoint: str) -> CacheStrategy:
        """Determine cache strategy for an endpoint"""
        endpoint_lower = endpoint.lower()

        # Market data
        if any(x in endpoint_lower for x in ["market", "status", "summary"]):
            return CacheStrategy.SHORT

        # Search and quotes
        if any(x in endpoint_lower for x in ["search", "trending", "quote"]):
            return CacheStrategy.SHORT

        # Historical data
        if any(x in endpoint_lower for x in ["history", "download"]):
            return CacheStrategy.DAILY

        # Financial data
        if any(x in endpoint_lower for x in ["financial", "balance", "income", "cash", "earnings"]):
            return CacheStrategy.DAILY

        # Company info
        if any(x in endpoint_lower for x in ["profile", "info", "officer", "sector"]):
            return CacheStrategy.MONTHLY

        # Recommendations
        if any(x in endpoint_lower for x in ["recommend", "trend", "analyst"]):
            return CacheStrategy.DAILY

        # Default
        return CacheStrategy.MEDIUM

    def generate_cache_key(self, prefix: str, params: Dict[str, Any]) -> str:
        """
        Generate a cache key from a prefix and parameters

        Args:
            prefix: Key prefix (usually the endpoint name)
            params: Parameters to include in the key

        Returns:
            Formatted cache key
        """
        # Start with the prefix
        key_parts = [prefix]

        # Add parameters, sorted by key for consistency
        for k, v in sorted(params.items()):
            # Skip internal parameters
            if k.startswith('_'):
                continue

            # Skip None values
            if v is None:
                continue

            # Format the value based on type
            if isinstance(v, (list, tuple)):
                param_value = ",".join(str(x) for x in v)
            elif isinstance(v, dict):
                # For dicts, use a hash to avoid overly long keys
                param_value = str(hash(frozenset(v.items())))
            elif isinstance(v, bool):
                param_value = str(v).lower()
            else:
                param_value = str(v)

            key_parts.append(f"{k}:{param_value}")

        return ":".join(key_parts)

    def get(self, key: str) -> Tuple[Optional[Any], bool]:
        """
        Get a value from the cache with statistics

        Args:
            key: Cache key

        Returns:
            Tuple of (value, is_hit) where value is None if not found
        """
        value = redis_manager.get(key)
        if value is not None:
            self.stats["hits"] += 1
            return value, True
        else:
            self.stats["misses"] += 1
            return None, False

    def set(self, key: str, value: Any, strategy: Optional[CacheStrategy] = None, ttl: Optional[int] = None) -> bool:
        """
        Set a value in the cache with the appropriate TTL

        Args:
            key: Cache key
            value: Value to cache
            strategy: Cache strategy (determines TTL)
            ttl: Explicit TTL in seconds (overrides strategy)

        Returns:
            True if successful
        """
        invalidate_at_midnight = False

        if ttl is None:
            if strategy is None:
                strategy = CacheStrategy.MEDIUM

            if strategy == CacheStrategy.DAILY:
                invalidate_at_midnight = True
                ttl = None  # Will be calculated by redis_manager
            elif strategy == CacheStrategy.NO_CACHE:
                return True  # Don't cache
            else:
                ttl = self.get_ttl(strategy)

        result = redis_manager.set(key, value, ttl=ttl, invalidate_at_midnight=invalidate_at_midnight)
        if result:
            self.stats["sets"] += 1
        else:
            self.stats["errors"] += 1
        return result

    def invalidate(self, key_pattern: str) -> int:
        """
        Invalidate keys matching a pattern

        Args:
            key_pattern: Pattern to match (can include *)

        Returns:
            Number of keys invalidated
        """
        if not redis_manager.is_connected():
            return 0

        try:
            keys = redis_manager.client.keys(key_pattern)
            if keys:
                return redis_manager.client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Error invalidating keys with pattern {key_pattern}: {str(e)}")
            self.stats["errors"] += 1
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self.stats["hits"] + self.stats["misses"]
        hit_rate = (self.stats["hits"] / total_requests * 100) if total_requests > 0 else 0

        redis_stats = redis_manager.get_stats() if redis_manager.is_connected() else {"status": "disconnected"}

        return {
            "application_stats": {
                "hits": self.stats["hits"],
                "misses": self.stats["misses"],
                "sets": self.stats["sets"],
                "errors": self.stats["errors"],
                "hit_rate": hit_rate,
                "total_requests": total_requests,
                "uptime_seconds": time.time() - self._last_stats_reset
            },
            "redis_stats": redis_stats
        }

    def reset_stats(self) -> None:
        """Reset cache statistics"""
        self.stats = {
            "hits": 0,
            "misses": 0,
            "errors": 0,
            "sets": 0
        }
        self._last_stats_reset = time.time()

    def get_strategies(self) -> Dict[str, Any]:
        """Get all cache strategies configuration"""
        return {
            "strategies": {name: {"ttl_seconds": self.get_ttl(name)} for name in CacheStrategy},
            "data_types": self.DATA_TYPE_STRATEGIES,
            "examples": {
                "market_status": {
                    "endpoint": "/v1/market/status",
                    "strategy": CacheStrategy.SHORT,
                    "ttl_seconds": self.get_ttl(CacheStrategy.SHORT)
                },
                "ticker_info": {
                    "endpoint": "/v1/ticker/AAPL/info",
                    "strategy": CacheStrategy.LONG,
                    "ttl_seconds": self.get_ttl(CacheStrategy.LONG)
                },
                "financial_statements": {
                    "endpoint": "/v1/ticker/MSFT/balance-sheet",
                    "strategy": CacheStrategy.DAILY,
                    "invalidates": "midnight UTC"
                }
            }
        }

# Create singleton instance
cache_service = CacheService()