import functools
import inspect
import logging
from typing import Optional, Callable, Dict, Any, Union
from datetime import timedelta
from .redis_manager import redis_manager

logger = logging.getLogger(__name__)

# Cache TTL lookup table based on the comments in the original code
CACHE_TTL_MAPPING = {
    "30 minutes": 30 * 60,
    "1 hour": 60 * 60,
    "1 day": 24 * 60 * 60,
    "1 week": 7 * 24 * 60 * 60,
    "1 month": 30 * 24 * 60 * 60,
    "3 months": 90 * 24 * 60 * 60,
}


def redis_cache(
        ttl: Optional[Union[int, str]] = None,
        invalidate_at_midnight: bool = False,
        key_prefix: str = "yfinance:",
        custom_key_generator: Optional[Callable] = None
):
    """
    Decorator to cache function results in Redis.

    Args:
        ttl: Time to live in seconds, or a string like "1 day", "30 minutes", etc.
        invalidate_at_midnight: If True, invalidate cache at midnight UTC (00:00)
        key_prefix: Prefix for Redis keys
        custom_key_generator: Optional function to generate custom cache keys

    Returns:
        Decorated function
    """

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Convert string TTL to seconds if provided
            ttl_seconds = None
            if ttl:
                if isinstance(ttl, str) and ttl in CACHE_TTL_MAPPING:
                    ttl_seconds = CACHE_TTL_MAPPING[ttl]
                elif isinstance(ttl, int):
                    ttl_seconds = ttl

            # Generate cache key
            if custom_key_generator:
                cache_key = custom_key_generator(*args, **kwargs)
            else:
                # Default key generation based on function name and arguments
                # For FastAPI endpoints, first arg is usually the path parameter
                func_args = inspect.signature(func).parameters
                arg_values = dict(zip(func_args.keys(), args))
                arg_values.update(kwargs)

                # Format the key as prefix:function:arg1:arg2:...
                key_parts = [key_prefix, func.__name__]

                # Add path parameters and query parameters to the key
                for param_name, param_value in arg_values.items():
                    # Skip 'self' or internal parameters
                    if param_name in ('self', 'kwargs', 'args') or param_name.startswith('_'):
                        continue
                    if param_value is not None:
                        key_parts.append(f"{param_name}:{param_value}")

                cache_key = ":".join(key_parts)

            # Try to get from cache
            cached_result = redis_manager.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for {cache_key}")
                return cached_result

            logger.debug(f"Cache miss for {cache_key}")

            # Execute function if not in cache
            result = await func(*args, **kwargs)  # Await the coroutine here

            # Store result in cache
            success = redis_manager.set(
                cache_key,
                result,
                ttl=ttl_seconds,
                invalidate_at_midnight=invalidate_at_midnight
            )

            if success:
                if invalidate_at_midnight:
                    logger.debug(f"Stored in cache {cache_key} until midnight UTC")
                elif ttl_seconds:
                    logger.debug(f"Stored in cache {cache_key} for {ttl_seconds} seconds")
                else:
                    logger.debug(f"Stored in cache {cache_key} without expiration")

            return result

        return wrapper

    return decorator