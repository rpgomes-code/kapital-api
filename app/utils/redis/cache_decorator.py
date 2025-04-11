import json
import time
import inspect
import logging
import hashlib
import functools

from typing import (
    Optional, 
    Callable, 
    Union
)

from app.utils.redis.cache_service import (
    cache_service, 
    CacheStrategy
)

from app.utils.redis.redis_manager import redis_manager
from app.utils.redis.circuit_breaker import redis_circuit

logger = logging.getLogger(__name__)

# Cache TTL lookup table based on string values
CACHE_TTL_MAPPING = {
    "30 seconds": 30,
    "1 minute": 60,
    "5 minutes": 300,
    "15 minutes": 900,
    "30 minutes": 30 * 60,
    "1 hour": 60 * 60,
    "2 hours": 2 * 60 * 60,
    "6 hours": 6 * 60 * 60,
    "12 hours": 12 * 60 * 60,
    "1 day": 24 * 60 * 60,
    "2 days": 2 * 24 * 60 * 60,
    "1 week": 7 * 24 * 60 * 60,
    "2 weeks": 14 * 24 * 60 * 60,
    "1 month": 30 * 24 * 60 * 60,
    "3 months": 90 * 24 * 60 * 60,
}

def redis_cache(
        ttl: Optional[Union[int, str, CacheStrategy]] = None,
        invalidate_at_midnight: bool = False,
        key_prefix: str = "kapital:",
        custom_key_generator: Optional[Callable] = None,
        disable_on_error: bool = True,
        cache_null_responses: bool = False,
        bypass_cache_param: str = None
):
    """
    Enhanced decorator to cache function results in Redis with improved error handling.

    Args:
        ttl: Time to live - can be:
            - An integer number of seconds
            - A string from CACHE_TTL_MAPPING like "1 day", "30 minutes", etc.
            - A CacheStrategy enum value
        invalidate_at_midnight: If True, invalidate cache at midnight UTC (00:00)
        key_prefix: Prefix for Redis keys
        custom_key_generator: Optional function to generate custom cache keys
        disable_on_error: If True, bypass cache on Redis errors to ensure service availability
        cache_null_responses: If True, cache None/null responses
        bypass_cache_param: Name of a query parameter that, if true, will bypass the cache

    Returns:
        Decorated function
    """

    def decorator(func):
        # Use circuit breaker pattern with the redis cache decorator
        @redis_circuit
        def get_from_cache(key):
            return redis_manager.get(key)

        @redis_circuit
        def set_in_cache(key, value, ttl_seconds, invalidate_at_midnight):
            return redis_manager.set(
                key,
                value,
                ttl=ttl_seconds,
                invalidate_at_midnight=invalidate_at_midnight
            )

        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Check if cache should be bypassed
            should_bypass_cache = False
            if bypass_cache_param and bypass_cache_param in kwargs:
                bypass_value = kwargs.get(bypass_cache_param)
                if isinstance(bypass_value, bool):
                    should_bypass_cache = bypass_value
                elif isinstance(bypass_value, str):
                    should_bypass_cache = bypass_value.lower() in ('true', 't', 'yes', 'y', '1')

            # Early return if cache bypass is requested
            if should_bypass_cache:
                return await func(*args, **kwargs)

            # Determine TTL seconds
            ttl_seconds = None
            if ttl:
                if isinstance(ttl, int):
                    ttl_seconds = ttl
                elif isinstance(ttl, str) and ttl in CACHE_TTL_MAPPING:
                    ttl_seconds = CACHE_TTL_MAPPING[ttl]
                elif isinstance(ttl, CacheStrategy):
                    ttl_seconds = cache_service.get_ttl(ttl)

            # Generate cache key
            if custom_key_generator:
                cache_key = custom_key_generator(*args, **kwargs)
            else:
                # Default key generation based on function name and arguments
                func_args = inspect.signature(func).parameters
                arg_values = dict(zip(func_args.keys(), args))
                arg_values.update(kwargs)

                # Format the key as prefix:function:arg1:arg2:...
                key_parts = [key_prefix, func.__name__]

                # Add path parameters and query parameters to the key
                sorted_params = sorted(arg_values.items())
                for param_name, param_value in sorted_params:
                    # Skip 'self' or internal parameters
                    if param_name in ('self', 'kwargs', 'args') or param_name.startswith(
                            '_') or param_name == bypass_cache_param:
                        continue
                    if param_value is not None:
                        # For complex objects, use a hash to avoid very long keys
                        if isinstance(param_value, (dict, list, tuple)):
                            try:
                                param_hash = hashlib.md5(json.dumps(param_value, sort_keys=True).encode()).hexdigest()[
                                             :8]
                                key_parts.append(f"{param_name}:{param_hash}")
                            except (TypeError, ValueError):
                                # If it can't be JSON serialized, use string representation
                                key_parts.append(f"{param_name}:{str(param_value)}")
                        else:
                            key_parts.append(f"{param_name}:{param_value}")

                cache_key = ":".join(key_parts)

            # Try to get from cache
            cached_result = None
            try:
                cached_result = get_from_cache(cache_key)
                if cached_result is not None:
                    logger.debug(f"Cache hit for {cache_key}")
                    return cached_result
                logger.debug(f"Cache miss for {cache_key}")
            except Exception as e:
                if disable_on_error:
                    logger.warning(f"Cache error for {cache_key}, bypassing cache: {str(e)}")
                    # Continue execution without cache
                else:
                    # Re-raise the exception if we want to fail on cache errors
                    logger.error(f"Fatal cache error for {cache_key}: {str(e)}")
                    raise

            # Execute function if not in cache
            start_time = time.time()
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time

            # Skip caching for None/null values if configured not to cache them
            if result is None and not cache_null_responses:
                return result

            # Store result in cache
            try:
                success = set_in_cache(
                    cache_key,
                    result,
                    ttl_seconds,
                    invalidate_at_midnight
                )

                if success:
                    if invalidate_at_midnight:
                        logger.debug(f"Stored in cache {cache_key} until midnight UTC")
                    elif ttl_seconds:
                        logger.debug(f"Stored in cache {cache_key} for {ttl_seconds} seconds")
                    else:
                        logger.debug(f"Stored in cache {cache_key} without expiration")

                    # Log cache performance metrics for slow operations
                    if execution_time > 0.5:  # Log for operations that took more than 500ms
                        logger.info(
                            f"Performance gain opportunity: {func.__name__} took {execution_time:.3f}s "
                            f"to execute and is now cached for future requests"
                        )
            except Exception as e:
                # Just log the error and continue - we don't want caching failures to break the app
                logger.warning(f"Failed to store in cache {cache_key}: {str(e)}")

            return result

        return wrapper

    return decorator

# Context manager for temporary cache bypass
class BypassCache:
    """
    Context manager to temporarily disable Redis cache.

    Example:
    ```python
    with BypassCache():
        # Code here will not use Redis cache
        result = await get_user_data(user_id)
    ```
    """

    def __init__(self):
        self.original_is_connected = None

    def __enter__(self):
        self.original_is_connected = redis_manager.is_connected
        # Temporarily override the is_connected method to return False
        redis_manager.is_connected = lambda: False
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Restore the original is_connected method
        if self.original_is_connected is not None:
            redis_manager.is_connected = self.original_is_connected