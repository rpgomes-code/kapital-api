import os
import redis
import orjson
import logging
from typing import Any, Optional, Dict, Union
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RedisManager:
    """
    Redis connection manager for caching yfinance API responses.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisManager, cls).__new__(cls)
            # Initialize the Redis connection
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = int(os.getenv("REDIS_PORT", 6379))
            redis_db = int(os.getenv("REDIS_DB", 0))
            redis_password = os.getenv("REDIS_PASSWORD", None)

            try:
                cls._instance.client = redis.Redis(
                    host=redis_host,
                    port=redis_port,
                    db=redis_db,
                    password=redis_password,
                    decode_responses=False,  # We'll handle serialization ourselves
                    socket_timeout=5,
                    socket_connect_timeout=5
                )
                # Test connection
                cls._instance.client.ping()
                logger.info(f"Connected to Redis at {redis_host}:{redis_port}")
            except redis.ConnectionError as e:
                logger.warning(f"Could not connect to Redis: {str(e)}. Caching will be disabled.")
                cls._instance.client = None

        return cls._instance

    def is_connected(self) -> bool:
        """Check if Redis is connected and available."""
        if self.client is None:
            return False

        try:
            return self.client.ping()
        except:
            return False

    def get(self, key: str) -> Optional[Any]:
        """
        Get a value from Redis cache.

        Args:
            key: The cache key

        Returns:
            The deserialized value or None if not found
        """
        if not self.is_connected():
            return None

        try:
            data = self.client.get(key)
            if data:
                return orjson.loads(data)
            return None
        except Exception as e:
            logger.error(f"Error getting from Redis cache: {str(e)}")
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None, invalidate_at_midnight: bool = False) -> bool:
        """
        Set a value in Redis cache.

        Args:
            key: The cache key
            value: The value to store (will be serialized with orjson)
            ttl: Time to live in seconds (optional)
            invalidate_at_midnight: If True, sets expiry to next midnight UTC (overrides ttl)

        Returns:
            True if successful, False otherwise
        """
        if not self.is_connected():
            return False

        try:
            # Serialize the value
            serialized_value = orjson.dumps(value)

            # Calculate TTL if we want to invalidate at midnight
            if invalidate_at_midnight:
                now = datetime.utcnow()
                tomorrow = now + timedelta(days=1)
                midnight = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0)
                ttl = int((midnight - now).total_seconds())

            # Set in Redis
            if ttl:
                return self.client.setex(key, ttl, serialized_value)
            else:
                return self.client.set(key, serialized_value)
        except Exception as e:
            logger.error(f"Error setting Redis cache: {str(e)}")
            return False

    def delete(self, key: str) -> bool:
        """Delete a key from Redis cache."""
        if not self.is_connected():
            return False

        try:
            return bool(self.client.delete(key))
        except Exception as e:
            logger.error(f"Error deleting from Redis cache: {str(e)}")
            return False

    def clear_all(self) -> bool:
        """Clear all keys in the current Redis database."""
        if not self.is_connected():
            return False

        try:
            return self.client.flushdb()
        except Exception as e:
            logger.error(f"Error clearing Redis cache: {str(e)}")
            return False


# Singleton instance
redis_manager = RedisManager()