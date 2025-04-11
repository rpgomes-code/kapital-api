from pydantic import (
    BaseModel, 
    Field
)

from typing import (
    Dict, 
    Any, 
    Optional, 
    List
)    

from app.utils.redis.cache_service import CacheStrategy

class CacheKeyInfo(BaseModel):
    """Information about a single cache key"""
    key: str = Field(..., description="The cache key")
    ttl: Optional[int] = Field(None, description="Time to live in seconds, or None if no expiry")
    size: Optional[int] = Field(None, description="Size of the cached value in bytes")
    created: Optional[str] = Field(None, description="Creation timestamp if available")
    
    class Config:
        schema_extra = {
            "example": {
                "key": "kapital:ticker:AAPL:info",
                "ttl": 259200,
                "size": 45237,
                "created": None
            }
        }

class CacheInvalidateRequest(BaseModel):
    """Request model for invalidating cached keys by pattern"""
    pattern: str = Field(..., description="Pattern to match cache keys (supports wildcards)")
    reason: Optional[str] = Field(None, description="Optional reason for invalidation (for logging)")
    
    class Config:
        schema_extra = {
            "example": {
                "pattern": "kapital:ticker:AAPL:*",
                "reason": "Updated company information"
            }
        }

class CacheSetRequest(BaseModel):
    """Request model for manually setting a cache value"""
    key: str = Field(..., description="The cache key to set")
    value: Any = Field(..., description="The value to cache (must be JSON serializable)")
    ttl: Optional[int] = Field(None, description="Time to live in seconds (overrides strategy)")
    strategy: Optional[CacheStrategy] = Field(None, description="Caching strategy to use")
    
    class Config:
        schema_extra = {
            "example": {
                "key": "kapital:custom:market:status",
                "value": {"status": "open", "time": "09:30:00"},
                "ttl": 3600,
                "strategy": None
            }
        }

class CacheStatsResponse(BaseModel):
    """Response model for cache statistics"""
    application_stats: Dict[str, Any] = Field(..., description="Application-level cache statistics")
    redis_stats: Dict[str, Any] = Field(..., description="Redis server statistics")

    class Config:
        schema_extra = {
            "example": {
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
        }

class CacheClearResponse(BaseModel):
    """Response model for cache clearing operations"""
    success: bool = Field(..., description="Whether the operation was successful")
    keys_affected: int = Field(..., description="Number of keys affected by the operation")
    message: str = Field(..., description="Informational message about the operation")

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "keys_affected": 156,
                "message": "Successfully cleared 156 cache keys"
            }
        }

class CacheStrategiesResponse(BaseModel):
    """Response model for cache strategies information"""
    strategies: Dict[str, Any] = Field(..., description="Available cache strategies and their TTLs")
    data_types: Dict[str, Any] = Field(..., description="Default strategies for different data types")
    examples: Dict[str, Any] = Field(..., description="Example endpoints with their caching strategy")
    
    class Config:
        schema_extra = {
            "example": {
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
        }

class KeyListResponse(BaseModel):
    """Response model for cache key listing"""
    keys: List[CacheKeyInfo] = Field(..., description="List of cache keys matching the pattern")
    count: int = Field(..., description="Total number of keys returned")
    pattern: str = Field(..., description="Pattern used to match keys")
    
    class Config:
        schema_extra = {
            "example": {
                "keys": [
                    {
                        "key": "kapital:ticker:AAPL:info",
                        "ttl": 259200,
                        "size": 45237,
                        "created": None
                    },
                    {
                        "key": "kapital:ticker:AAPL:history",
                        "ttl": 86400,
                        "size": 128500,
                        "created": None
                    }
                ],
                "count": 2,
                "pattern": "kapital:ticker:AAPL:*"
            }
        }

class KeyValueResponse(BaseModel):
    """Response model for retrieving a specific cache key value"""
    key: str = Field(..., description="The cache key")
    value: Any = Field(..., description="The cached value")
    ttl: Optional[int] = Field(None, description="Time to live in seconds, or None if no expiry")
    
    class Config:
        schema_extra = {
            "example": {
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
        }

class PingResponse(BaseModel):
    """Response model for Redis ping check"""
    status: str = Field(..., description="Connection status ('connected' or 'disconnected')")
    latency_ms: float = Field(..., description="Round-trip latency in milliseconds")
    
    class Config:
        schema_extra = {
            "example": {
                "status": "connected",
                "latency_ms": 0.53
            }
        }

class MaintenanceResponse(BaseModel):
    """Response model for cache maintenance task"""
    message: str = Field(..., description="Status message")
    status: str = Field(..., description="Task status ('running', 'completed', 'failed')")
    
    class Config:
        schema_extra = {
            "example": {
                "message": "Cache maintenance tasks scheduled",
                "status": "running"
            }
        }