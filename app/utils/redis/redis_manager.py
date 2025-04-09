import os
import redis
import orjson
import logging
import time
import backoff
from typing import Any, Optional, Dict, Union
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RedisManager:
    """
    Enhanced Redis connection manager for caching API responses with improved
    error handling and connection resilience.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisManager, cls).__new__(cls)
            # Initialize the Redis connection
            cls._instance._initialize_connection()
        return cls._instance

    def _initialize_connection(self):
        """Initialize the Redis connection with parameters from environment variables"""
        self.redis_host = os.getenv("REDIS_HOST", "localhost")
        self.redis_port = int(os.getenv("REDIS_PORT", 6379))
        self.redis_db = int(os.getenv("REDIS_DB", 0))
        self.redis_password = os.getenv("REDIS_PASSWORD", None)

        # Connection parameters
        self.max_retries = int(os.getenv("REDIS_MAX_RETRIES", 5))
        self.retry_delay = float(os.getenv("REDIS_RETRY_DELAY", 1.0))
        self.socket_timeout = float(os.getenv("REDIS_SOCKET_TIMEOUT", 5.0))
        self.socket_connect_timeout = float(os.getenv("REDIS_CONNECT_TIMEOUT", 5.0))

        # Connection pool settings
        self.connection_pool_size = int(os.getenv("REDIS_POOL_SIZE", 10))

        self._connect()

    @backoff.on_exception(
        backoff.expo,
        (redis.ConnectionError, redis.TimeoutError),
        max_tries=3,
        jitter=backoff.full_jitter
    )
    def _connect(self):
        """Attempt to establish a connection to Redis with exponential backoff"""
        try:
            self.client = redis.Redis(
                host=self.redis_host,
                port=self.redis_port,
                db=self.redis_db,
                password=self.redis_password,
                decode_responses=False,  # We'll handle serialization ourselves
                socket_timeout=self.socket_timeout,
                socket_connect_timeout=self.socket_connect_timeout,
                health_check_interval=30,  # Seconds between health checks
                retry_on_timeout=True,
                max_connections=self.connection_pool_size
            )
            # Test connection
            self.client.ping()
            logger.info(f"Connected to Redis at {self.redis_host}:{self.redis_port}")
        except redis.ConnectionError as e:
            logger.warning(f"Could not connect to Redis: {str(e)}. Caching will be disabled.")
            self.client = None
        except Exception as e:
            logger.error(f"Unexpected error connecting to Redis: {str(e)}")
            self.client = None

    def is_connected(self) -> bool:
        """Check if Redis is connected and available."""
        if self.client is None:
            return False

        try:
            return self.client.ping()
        except (redis.ConnectionError, redis.TimeoutError, Exception) as e:
            logger.warning(f"Redis connectivity check failed: {str(e)}")
            # Try to reconnect
            self._connect()
            # Return current state after reconnection attempt
            return self.client is not None and hasattr(self.client, 'ping') and self.client.ping()

    def get(self, key: str) -> Optional[Any]:
        """
        Get a value from Redis cache with automatic reconnection on failure.

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
        except (redis.ConnectionError, redis.TimeoutError) as e:
            logger.warning(f"Redis connection error getting key {key}: {str(e)}")
            self._connect()
            return None
        except Exception as e:
            logger.error(f"Error getting from Redis cache: {str(e)}")
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None, invalidate_at_midnight: bool = False) -> bool:
        """
        Set a value in Redis cache with improved error handling.

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
        except (redis.ConnectionError, redis.TimeoutError) as e:
            logger.warning(f"Redis connection error setting key {key}: {str(e)}")
            self._connect()
            return False
        except Exception as e:
            logger.error(f"Error setting Redis cache: {str(e)}")
            return False

    def delete(self, key: str) -> bool:
        """Delete a key from Redis cache."""
        if not self.is_connected():
            return False

        try:
            return bool(self.client.delete(key))
        except (redis.ConnectionError, redis.TimeoutError) as e:
            logger.warning(f"Redis connection error deleting key {key}: {str(e)}")
            self._connect()
            return False
        except Exception as e:
            logger.error(f"Error deleting from Redis cache: {str(e)}")
            return False

    def clear_all(self) -> bool:
        """Clear all keys in the current Redis database."""
        if not self.is_connected():
            return False

        try:
            return self.client.flushdb()
        except (redis.ConnectionError, redis.TimeoutError) as e:
            logger.warning(f"Redis connection error clearing all keys: {str(e)}")
            self._connect()
            return False
        except Exception as e:
            logger.error(f"Error clearing Redis cache: {str(e)}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Get Redis server statistics"""
        if not self.is_connected():
            return {"status": "disconnected"}

        try:
            info = self.client.info()
            stats = {
                "status": "connected",
                "version": info.get("redis_version", "unknown"),
                "uptime_days": info.get("uptime_in_days", 0),
                "memory": {
                    "used_memory_human": info.get("used_memory_human", "unknown"),
                    "used_memory_peak_human": info.get("used_memory_peak_human", "unknown"),
                    "used_memory_lua_human": info.get("used_memory_lua_human", "unknown"),
                },
                "clients": {
                    "connected_clients": info.get("connected_clients", 0),
                    "blocked_clients": info.get("blocked_clients", 0),
                },
                "stats": {
                    "total_connections_received": info.get("total_connections_received", 0),
                    "total_commands_processed": info.get("total_commands_processed", 0),
                    "instantaneous_ops_per_sec": info.get("instantaneous_ops_per_sec", 0),
                    "hits": info.get("keyspace_hits", 0),
                    "misses": info.get("keyspace_misses", 0),
                    "hit_rate": info.get("keyspace_hits", 0) / max(1, (
                            info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0))) * 100,
                }
            }

            # Add database-specific stats
            db_stats = {}
            for key, value in info.items():
                if key.startswith("db"):
                    if isinstance(value, dict):
                        db_stats[key] = value
                    else:
                        # Parse string format (older Redis versions)
                        db_dict = {}
                        parts = value.split(",")
                        for part in parts:
                            if "=" in part:
                                k, v = part.split("=")
                                db_dict[k] = int(v)
                        db_stats[key] = db_dict

            stats["keyspace"] = db_stats
            return stats
        except Exception as e:
            logger.error(f"Error getting Redis stats: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }


# Singleton instance
redis_manager = RedisManager()